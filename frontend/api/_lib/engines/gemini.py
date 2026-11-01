"""Minimal Gemini client (JSON structured output). Returns None on any failure so callers fall back.

Two kinds of key work:
  • Google AI Studio keys ("AIza…")      → generativelanguage.googleapis.com
  • Vertex AI express-mode keys ("AQ.…")  → aiplatform.googleapis.com
The endpoint is chosen from the key and the other is tried if the first rejects it.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from ..core.config import get_settings

AI_STUDIO = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
VERTEX_EXPRESS = "https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent"
TIMEOUT_S = 8.0
_state: dict[str, Optional[str]] = {"last_error": None, "endpoint": None}


def available() -> bool:
    return bool(get_settings().gemini_api_key)


def last_error() -> Optional[str]:
    return _state["last_error"]


def _endpoints(key: str) -> list[str]:
    return [VERTEX_EXPRESS, AI_STUDIO] if key.startswith("AQ.") else [AI_STUDIO, VERTEX_EXPRESS]


def _summarise(resp: httpx.Response) -> str:
    try:
        message = resp.json().get("error", {}).get("message", "")
    except ValueError:
        message = resp.text
    return f"HTTP {resp.status_code}: {str(message).strip()[:180]}"


def generate_text(prompt: str, *, json_output: bool = False, temperature: float = 0.2) -> Optional[str]:
    settings = get_settings()
    key = settings.gemini_api_key
    if not key:
        _state["last_error"] = "GEMINI_API_KEY is not set"
        return None
    config: dict[str, Any] = {"temperature": temperature}
    if json_output:
        config["responseMimeType"] = "application/json"
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": config}
    error = None
    for endpoint in _endpoints(key):
        try:
            resp = httpx.post(endpoint.format(model=settings.gemini_model), json=body, timeout=TIMEOUT_S,
                              headers={"x-goog-api-key": key})
        except httpx.HTTPError as exc:
            error = f"{type(exc).__name__}: {str(exc)[:180]}"
            break  # network trouble — the other endpoint will not do better
        if resp.status_code in (400, 401, 403, 404) and endpoint != _endpoints(key)[-1]:
            error = _summarise(resp)
            continue  # key belongs to the other service, or the model is not offered there
        if resp.status_code != 200:
            error = _summarise(resp)
            break
        try:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, ValueError):
            error = "Unexpected response shape (blocked or empty candidate)"
            break
        _state.update(last_error=None, endpoint="vertex-express" if endpoint == VERTEX_EXPRESS else "ai-studio")
        return text
    _state["last_error"] = error
    return None


def generate_json(prompt: str, schema_hint: str) -> Optional[dict[str, Any]]:
    text = generate_text(f"{prompt}\n\nRespond only with JSON matching: {schema_hint}", json_output=True)
    if text is None:
        return None
    try:
        data = json.loads(text)
    except ValueError:
        _state["last_error"] = "Model returned non-JSON output"
        return None
    return data if isinstance(data, dict) else None


def probe() -> dict[str, Any]:
    """Live check used by /api/health?deep=1."""
    if not available():
        return {"configured": False, "ok": False, "error": "GEMINI_API_KEY is not set"}
    ok = generate_text("Reply with the single word: ready", temperature=0.0) is not None
    return {"configured": True, "ok": ok, "model": get_settings().gemini_model,
            **({"endpoint": _state["endpoint"]} if ok else {"error": _state["last_error"]})}
