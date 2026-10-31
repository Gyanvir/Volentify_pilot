"""Minimal Gemini client (JSON structured output). Returns None on any failure so callers fall back."""

from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from ..core.config import get_settings

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT_S = 8.0


def available() -> bool:
    return bool(get_settings().gemini_api_key)


def generate_json(prompt: str, schema_hint: str) -> Optional[dict[str, Any]]:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None
    body = {
        "contents": [{"role": "user", "parts": [{"text": f"{prompt}\n\nRespond only with JSON matching: {schema_hint}"}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    try:
        resp = httpx.post(ENDPOINT.format(model=settings.gemini_model), json=body, timeout=TIMEOUT_S,
                          headers={"x-goog-api-key": settings.gemini_api_key})
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None
