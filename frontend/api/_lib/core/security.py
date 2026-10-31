"""Sessions, password hashing, Google ID-token verification, mesh bearer tokens and muster passes."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status

from .config import get_settings

SESSION_COOKIE = "volentify_session"
NONCE_COOKIE = "volentify_oauth_nonce"
ELEVATED_ROLES = {"INCIDENT_ADMIN", "NGO_MEMBER"}
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

ROLE_PASS = {
    "VOLUNTEER": ("VOL", "First Responder Tactical Muster Pass"),
    "CITIZEN": ("CIT", "Civilian SOS Evacuation Clearance Pass"),
    "NGO_MEMBER": ("NGO", "Relief Supply Fleet Pass"),
    "INCIDENT_ADMIN": ("EOC", "EOC Incident Controller Clearance Pass"),
    "RESEARCHER": ("RES", "Research Analyst Access Pass"),
}


# ─── Passwords (scrypt, stdlib) ─────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored or not stored.startswith("scrypt$"):
        return False
    _, salt_b64, digest_b64 = stored.split("$")
    digest = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64), n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


# ─── Session JWT (HS256, shared with Next.js middleware) ─────────────────────

def issue_session(user: dict) -> str:
    settings = get_settings()
    now = int(time.time())
    claims = {
        "sub": user["id"], "email": user["email"], "name": user["name"], "role": user["role"],
        "onboarded": bool(user.get("onboarded")), "verified": bool(user.get("is_verified")), "iat": now, "exp": now + settings.session_ttl_hours * 3600,
        "typ": "session",
    }
    return jwt.encode(claims, settings.session_secret, algorithm="HS256")


def decode_session(token: str) -> Optional[dict]:
    try:
        claims = jwt.decode(token, get_settings().session_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return claims if claims.get("typ") == "session" else None


def session_cookie_kwargs() -> dict[str, Any]:
    settings = get_settings()
    return {"httponly": True, "secure": settings.is_production, "samesite": "lax", "path": "/",
            "max_age": settings.session_ttl_hours * 3600}


def current_claims(request: Request) -> Optional[dict]:
    token = request.cookies.get(SESSION_COOKIE)
    return decode_session(token) if token else None


def require_session(request: Request) -> dict:
    claims = current_claims(request)
    if not claims:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue")
    return claims


def require_roles(*roles: str):
    def dependency(claims: dict = Depends(require_session)) -> dict:
        if claims["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role does not have access to this action")
        if claims["role"] in ELEVATED_ROLES and not claims.get("verified"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is awaiting verification by an administrator")
        return claims
    return dependency


# ─── Google ID token verification ───────────────────────────────────────────

_jwks_client: Optional[jwt.PyJWKClient] = None


def verify_google_id_token(id_token: str, expected_nonce: Optional[str]) -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured")
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, lifespan=3600)
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(id_token, signing_key.key, algorithms=["RS256"], audience=settings.google_client_id)
    except (jwt.PyJWTError, OSError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in could not be verified") from exc
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unexpected token issuer")
    if not claims.get("email_verified"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your Google email is not verified")
    if expected_nonce is not None and not hmac.compare_digest(str(claims.get("nonce", "")), expected_nonce):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign-in request expired — please try again")
    return claims


# ─── Mesh gateway bearer tokens (SEC-01, OD-01) ─────────────────────────────

def issue_mesh_token(user_id: str, node_uuid: Optional[str]) -> tuple[str, datetime]:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.mesh_token_ttl_minutes)
    claims = {"sub": user_id, "node": node_uuid, "typ": "mesh", "exp": int(expires.timestamp()),
              "iat": int(time.time()), "jti": secrets.token_hex(8)}
    return jwt.encode(claims, settings.session_secret, algorithm="HS256"), expires


def require_mesh_token(request: Request) -> dict:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        _audit_auth_failure(request, "missing bearer")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token required",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = jwt.decode(header[7:].strip(), get_settings().session_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        claims = {}
    if claims.get("typ") != "mesh":
        _audit_auth_failure(request, "invalid token")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired gateway token",
                            headers={"WWW-Authenticate": "Bearer"})
    return claims


def _audit_auth_failure(request: Request, reason: str) -> None:
    # SEC-06: non-sensitive audit line — never log the token itself.
    client = request.client.host if request.client else "unknown"
    print(f"[auth-audit] {request.method} {request.url.path} rejected ({reason}) from {client}")


# ─── Muster passes ──────────────────────────────────────────────────────────

def muster_code(user_id: str, role: str) -> str:
    prefix, _ = ROLE_PASS[role]
    digest = hashlib.sha256(f"{user_id}:{role}".encode()).hexdigest()[:4].upper()
    return f"TAC-{prefix}-{digest}"


def muster_signature(user_id: str, code: str, issued_at: datetime) -> str:
    message = f"{user_id}|{code}|{int(issued_at.timestamp())}".encode()
    return hmac.new(get_settings().session_secret.encode(), message, hashlib.sha256).hexdigest()[:24]


# ─── Rate limiting (SEC-06) ─────────────────────────────────────────────────

class RateLimiter:
    """Sliding-window limiter. Per-instance on serverless — a guard rail, not a quota system."""

    def __init__(self, limit: int, window_s: float) -> None:
        self.limit, self.window = limit, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests — retry shortly",
                                headers={"Retry-After": str(int(self.window))})
        hits.append(now)


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
