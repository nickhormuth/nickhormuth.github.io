"""Minimal Gusto API client.

Only the endpoints we need for the CalSavers pull:
- Refresh the access token from the long-lived refresh token
- List companies (so the operator can discover company_uuid)
- List processed payrolls in a date window
- Get a single payroll with deductions

The Gusto API has versioning via the X-Gusto-API-Version header; this client pins
to a known version so a future Gusto change can't silently break our shape
assumptions. Bump the constant when we explicitly handle a newer version.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from ..config import GustoConfig, write_refresh_token

API_VERSION = "2024-04-01"  # pinned; see module docstring


class GustoError(RuntimeError):
    pass


@dataclass
class _Tokens:
    access_token: str
    refresh_token: str


class GustoClient:
    def __init__(self, cfg: GustoConfig) -> None:
        if not cfg.refresh_token:
            raise GustoError("No refresh token in .env — run `make oauth` first.")
        self.cfg = cfg
        self._tokens: _Tokens | None = None
        self._http = httpx.Client(
            base_url=cfg.api_base,
            timeout=30,
            headers={"X-Gusto-API-Version": API_VERSION, "Accept": "application/json"},
        )

    def _refresh(self) -> _Tokens:
        cfg = self.cfg
        assert cfg.refresh_token is not None
        resp = self._http.post(
            "/oauth/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": cfg.refresh_token,
                "client_id": cfg.client_id,
                "client_secret": cfg.client_secret,
            },
        )
        if resp.status_code != 200:
            raise GustoError(f"Token refresh failed: {resp.status_code} {resp.text}")
        body = resp.json()
        rotated = body.get("refresh_token", cfg.refresh_token)
        # Gusto rotates refresh tokens on every use; persist the new one.
        if rotated != cfg.refresh_token:
            write_refresh_token(rotated)
        return _Tokens(access_token=body["access_token"], refresh_token=rotated)

    def _auth_headers(self) -> dict[str, str]:
        if self._tokens is None:
            self._tokens = self._refresh()
        return {"Authorization": f"Bearer {self._tokens.access_token}"}

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        resp = self._http.get(path, params=params, headers=self._auth_headers())
        if resp.status_code == 401:  # access token expired mid-session
            self._tokens = None
            resp = self._http.get(path, params=params, headers=self._auth_headers())
        if resp.status_code >= 400:
            raise GustoError(f"GET {path} failed: {resp.status_code} {resp.text}")
        return resp.json()

    # --- public surface ---

    def list_companies(self) -> list[dict[str, Any]]:
        return self._get("/v1/me")["roles"][0]["payroll_admin"]["companies"]

    def list_processed_payrolls(
        self, company_uuid: str, start_date: str, end_date: str
    ) -> list[dict[str, Any]]:
        return self._get(
            f"/v1/companies/{company_uuid}/payrolls",
            params={
                "processing_statuses": "processed",
                "start_date": start_date,
                "end_date": end_date,
            },
        )

    def get_payroll(self, company_uuid: str, payroll_uuid: str) -> dict[str, Any]:
        return self._get(
            f"/v1/companies/{company_uuid}/payrolls/{payroll_uuid}",
            params={"include": "benefits,deductions"},
        )

    def close(self) -> None:
        self._http.close()
