from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"


def load() -> None:
    load_dotenv(ENV_PATH, override=False)


@dataclass(frozen=True)
class GustoConfig:
    client_id: str
    client_secret: str
    refresh_token: str | None
    company_uuid: str | None
    api_base: str
    redirect_host: str
    redirect_port: int

    @property
    def redirect_uri(self) -> str:
        return f"http://{self.redirect_host}:{self.redirect_port}/oauth/callback"


def gusto() -> GustoConfig:
    load()
    missing = [k for k in ("GUSTO_CLIENT_ID", "GUSTO_CLIENT_SECRET") if not os.getenv(k)]
    if missing:
        raise RuntimeError(
            f"Missing required env vars: {', '.join(missing)}. "
            f"Copy .env.example to .env and fill in values from https://dev.gusto.com."
        )
    return GustoConfig(
        client_id=os.environ["GUSTO_CLIENT_ID"],
        client_secret=os.environ["GUSTO_CLIENT_SECRET"],
        refresh_token=os.getenv("GUSTO_REFRESH_TOKEN") or None,
        company_uuid=os.getenv("GUSTO_COMPANY_UUID") or None,
        api_base=os.getenv("GUSTO_API_BASE", "https://api.gusto-demo.com").rstrip("/"),
        redirect_host=os.getenv("GUSTO_OAUTH_REDIRECT_HOST", "localhost"),
        redirect_port=int(os.getenv("GUSTO_OAUTH_REDIRECT_PORT", "8765")),
    )


def write_refresh_token(token: str) -> None:
    """Append or update GUSTO_REFRESH_TOKEN in .env (creates file if absent)."""
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text().splitlines()
    replaced = False
    for i, line in enumerate(lines):
        if line.startswith("GUSTO_REFRESH_TOKEN="):
            lines[i] = f"GUSTO_REFRESH_TOKEN={token}"
            replaced = True
            break
    if not replaced:
        lines.append(f"GUSTO_REFRESH_TOKEN={token}")
    ENV_PATH.write_text("\n".join(lines) + "\n")
