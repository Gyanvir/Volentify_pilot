"""Volentify API — FastAPI application.

Local:      uvicorn api.index:app --reload --port 8000   (run from frontend/)
Production: Vercel Python serverless function; vercel.json rewrites /api/* here.
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from api._lib.core import db  # noqa: E402
from api._lib.engines import surge, triage  # noqa: E402
from api._lib.routers import auth, entities, intelligence, mesh  # noqa: E402

VERSION = "3.5.0"

app = FastAPI(title="Volentify Disaster Intelligence API", version=VERSION,
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)

for module in (auth, entities, mesh, intelligence):
    app.include_router(module.router)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Flatten pydantic errors into one readable sentence plus field details."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    message = str(first.get("msg", "Invalid request")).removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {message}", "errors": [
        {"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "message": e.get("msg")} for e in errors]})


@app.get("/api/health")
def health():
    started = time.perf_counter()
    surge.predict({"lat": 19.81, "lng": 85.83, "wind_speed": 140.0, "rainfall_mm": 250.0})
    triage.deterministic("flood people trapped need boat")
    inference_ms = round((time.perf_counter() - started) * 1000, 3)
    return {
        "status": "ONLINE",
        "system": "VOLENTIFY DISASTER INTELLIGENCE PLATFORM",
        "version": VERSION,
        "database": db.database_status(),
        "ml_inference": "ONLINE",
        "inference_selftest_ms": inference_ms,
    }
