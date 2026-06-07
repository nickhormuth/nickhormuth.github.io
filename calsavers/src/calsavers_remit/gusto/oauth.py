"""Gusto OAuth bootstrap.

One-time flow to mint a long-lived refresh token:
  1. Open the authorize URL in the browser.
  2. Operator (Nick) signs into Gusto and grants the requested scopes.
  3. Gusto redirects back to http://localhost:<port>/oauth/callback?code=...
  4. We exchange the code for access + refresh tokens.
  5. The refresh token is written to .env.
"""

from __future__ import annotations

import http.server
import secrets
import threading
import urllib.parse
import webbrowser
from dataclasses import dataclass

import httpx

from ..config import GustoConfig, write_refresh_token

AUTHORIZE_PATH = "/oauth/authorize"
TOKEN_PATH = "/oauth/token"


@dataclass
class _CallbackResult:
    code: str | None = None
    state: str | None = None
    error: str | None = None


def _authorize_url(cfg: GustoConfig, state: str) -> str:
    auth_host = cfg.api_base.replace("api.", "app.", 1)
    params = {
        "response_type": "code",
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "state": state,
    }
    return f"{auth_host}{AUTHORIZE_PATH}?{urllib.parse.urlencode(params)}"


def _serve_callback(cfg: GustoConfig, state: str, result: _CallbackResult) -> threading.Thread:
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/oauth/callback":
                self.send_response(404)
                self.end_headers()
                return
            qs = urllib.parse.parse_qs(parsed.query)
            result.code = qs.get("code", [None])[0]
            result.state = qs.get("state", [None])[0]
            result.error = qs.get("error", [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            msg = "OK — you can close this tab." if result.code else f"Error: {result.error}"
            self.wfile.write(msg.encode())

        def log_message(self, *_: object) -> None:
            pass  # suppress access log

    server = http.server.HTTPServer((cfg.redirect_host, cfg.redirect_port), Handler)

    def serve() -> None:
        server.handle_request()  # serve exactly one request, then shut down

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    return t


def bootstrap(cfg: GustoConfig) -> str:
    """Run the OAuth flow end-to-end. Returns the refresh token and writes it to .env."""
    state = secrets.token_urlsafe(16)
    result = _CallbackResult()
    thread = _serve_callback(cfg, state, result)

    url = _authorize_url(cfg, state)
    print(f"Opening browser to:\n  {url}\n")
    print("If your browser doesn't open, paste that URL manually.\n")
    webbrowser.open(url)

    thread.join(timeout=300)  # 5 min to complete the sign-in
    if not result.code:
        raise RuntimeError(f"OAuth callback did not return a code (error={result.error})")
    if result.state != state:
        raise RuntimeError("OAuth state mismatch — possible CSRF; aborting")

    token_url = f"{cfg.api_base}{TOKEN_PATH}"
    resp = httpx.post(
        token_url,
        data={
            "grant_type": "authorization_code",
            "code": result.code,
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "redirect_uri": cfg.redirect_uri,
        },
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    refresh_token: str = body["refresh_token"]
    write_refresh_token(refresh_token)
    return refresh_token
