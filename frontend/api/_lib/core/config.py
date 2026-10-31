"""Runtime configuration, read once from environment variables (see frontend/.env.example)."""

from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass
from functools import lru_cache


def _load_dotenv() -> None:
    """Read frontend/.env for local development (Next.js loads it for the web app; uvicorn does not)."""
    path = Path(__file__).resolve().parents[3] / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip().strip('"')


@dataclass(frozen=True)
class Settings:
    database_url: str
    session_secret: str
    google_client_id: str
    gemini_api_key: str
    gemini_model: str
    impossibl_api_key: str
    impossibl_api_url: str
    environment: str
    admin_emails: frozenset[str]
    public_url: str
    session_ttl_hours: int = 72
    mesh_token_ttl_minutes: int = 240

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_local(self) -> bool:
        """Local development: elevated roles are auto-verified so every console is explorable."""
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    environment = _env("VERCEL_ENV") or _env("VOLENTIFY_ENV", "development")
    secret = _env("NEXTAUTH_SECRET") or _env("SESSION_SECRET")
    if not secret:
        if environment != "development":
            raise RuntimeError("NEXTAUTH_SECRET must be set outside local development")
        secret = "volentify-local-development-secret-change-me"
    return Settings(
        database_url=_env("DATABASE_URL"),
        session_secret=secret,
        google_client_id=_env("GOOGLE_CLIENT_ID") or _env("NEXT_PUBLIC_GOOGLE_CLIENT_ID"),
        gemini_api_key=_env("GEMINI_API_KEY"),
        gemini_model=_env("GEMINI_MODEL", "gemini-2.5-flash"),
        impossibl_api_key=_env("IMPOSSIBL_API_KEY"),
        impossibl_api_url=_env("IMPOSSIBL_API_URL", "https://api.impossibl.com/v1/triage"),
        environment=environment,
        admin_emails=frozenset(e.strip().lower() for e in _env("VOLENTIFY_ADMIN_EMAILS").split(",") if e.strip()),
        public_url=_env("NEXTAUTH_URL").rstrip("/"),
    )
