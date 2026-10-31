"""Volentify Mesh gateway ingest and read APIs (PRD §2–3, §10.2)."""

from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from ..core import db
from ..core.security import (
    RateLimiter, client_key, current_claims, issue_mesh_token, require_mesh_token, require_roles,
)
from ..engines.geo import bbox_around
from ..schemas import (
    MeshEvent, MeshEventType, MeshIncident, MeshIngestRequest, MeshIngestResponse, MeshNode, MeshPriority,
    MeshReviewRequest, MeshToken,
)
from .common import new_code, new_id, now, tag

router = APIRouter(prefix="/api/mesh", tags=["mesh"])
_ingest_limiter = RateLimiter(limit=60, window_s=60)

# Sensitive event types are summarised for unverified readers (OD-02).
SENSITIVE_TYPES = {"PERSON_MISSING", "PERSON_TRAPPED", "MEDICAL_EMERGENCY", "PERSON_RESCUED"}
PROMOTE_SKILL = {
    "PERSON_TRAPPED": "Rescue & Search", "PERSON_MISSING": "Rescue & Search", "FLOOD": "Boat Rescue",
    "MEDICAL_EMERGENCY": "Paramedic", "FIRE": "Rescue & Search", "RESOURCE_REQUEST": "Food & Shelter Logistics",
}
PRIORITY_TO_URGENCY = {"CRITICAL": "CRITICAL", "HIGH": "HIGH", "MEDIUM": "MODERATE", "LOW": "LOW"}


def _crew_size(count: object) -> int:
    """Roughly one responder per four people reported, capped for a single mission."""
    return max(1, min(20, count // 4)) if isinstance(count, int) else 1


@router.post("/token", response_model=MeshToken)
def gateway_token(node_uuid: Optional[str] = None, claims: dict = Depends(require_roles("VOLUNTEER",
                  "INCIDENT_ADMIN", "NGO_MEMBER"))):
    """Short-lived bearer token for a gateway phone, issued at volunteer check-in (OD-01)."""
    token, expires = issue_mesh_token(claims["sub"], node_uuid)
    return MeshToken(token=token, expires_at=expires)


@router.post("/ingest", response_model=MeshIngestResponse)
def ingest(body: MeshIngestRequest, request: Request, response: Response,
           token: dict = Depends(require_mesh_token)):
    _ingest_limiter.check(f"{client_key(request)}:{token.get('sub')}")
    received = now()

    def persist(store):
        store.upsert_node(body.gateway_node_id, {"last_lat": body.gateway_lat, "last_lng": body.gateway_lng,
                                                 "battery_level": body.gateway_battery})
        accepted, duplicates = [], []
        known = {d["id"] for d in store.list_disasters()}
        for ev in body.events:
            store.upsert_node(ev.origin_node_id, {"last_lat": ev.lat, "last_lng": ev.lng})
            row = {"id": new_id("me"), "event_id": ev.event_id, "origin_node_id": ev.origin_node_id,
                   "disaster_id": ev.disaster_id if ev.disaster_id in known else None, "type": ev.type, "priority": ev.priority, "payload": ev.payload,
                   "lat": ev.lat, "lng": ev.lng, "observed_at": ev.observed_at, "hop_count": ev.hop_count,
                   "ttl": ev.ttl, "received_at": received, "review_status": "UNREVIEWED",
                   "promoted_task_id": None}
            (accepted if store.insert_mesh_event(row) else duplicates).append(ev.event_id)
        return accepted, duplicates

    try:
        (accepted, duplicates), source = db.write(persist, durable=True)
    except db.DurabilityUnavailable:
        # Gateways must keep events in their outbox and retry with backoff (AT-08).
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Persistence unavailable — retry later",
                            headers={"Retry-After": "30"})
    tag(response, source)
    return MeshIngestResponse(accepted_count=len(accepted), duplicate_count=len(duplicates),
                              gateway_ack_id=f"ack_{secrets.token_hex(4)}", accepted_ids=accepted,
                              duplicate_ids=duplicates,
                              persistence="durable" if source == "database" else "volatile")


def _redact(ev: dict) -> dict:
    if ev["type"] in SENSITIVE_TYPES:
        count = ev["payload"].get("count") if isinstance(ev["payload"], dict) else None
        return {**ev, "payload": {"redacted": True, **({"count_band": "1-5" if count <= 5 else "6+"}
                                                     if isinstance(count, int) else {})}}
    return ev


@router.get("/events", response_model=list[MeshEvent])
def list_events(request: Request, response: Response, disaster_id: Optional[str] = None,
                priority: Optional[MeshPriority] = None, type: Optional[MeshEventType] = None,
                max_age_minutes: Optional[int] = Query(None, ge=1, le=60 * 24 * 30),
                limit: int = Query(50, ge=1, le=500)):
    since = now() - timedelta(minutes=max_age_minutes) if max_age_minutes else None
    rows, source = db.read(lambda s: s.list_mesh_events(
        disaster_id, priority.value if priority else None, type.value if type else None, since, limit))
    claims = current_claims(request) or {}
    trusted = claims.get("role") in {"INCIDENT_ADMIN", "NGO_MEMBER"} and claims.get("verified")
    tag(response, source)
    return rows if trusted else [_redact(r) for r in rows]


@router.get("/nodes", response_model=list[MeshNode])
def list_nodes(response: Response):
    rows, source = db.read(lambda s: s.list_mesh_nodes())
    tag(response, source)
    return [{**n, "active": db.node_is_active(n["last_seen_at"])} for n in rows]


@router.get("/incidents", response_model=list[MeshIncident])
def list_incidents(response: Response):
    """Active incident bounding boxes for offline caching on phones."""
    rows, source = db.read(lambda s: s.list_disasters())
    tag(response, source)
    return [{"disaster_id": d["id"], "code": d["code"], "title": d["title"], "category": d["category"],
             "severity": d["severity"], "center": (d["lat"], d["lng"]),
             "bbox": bbox_around(d["lat"], d["lng"], d["radius_km"]), "radius_km": d["radius_km"]}
            for d in rows if d["status"] == "ACTIVE"]


@router.patch("/events/{event_id}", response_model=MeshEvent)
def review_event(event_id: str, body: MeshReviewRequest, response: Response,
                 claims: dict = Depends(require_roles("INCIDENT_ADMIN", "NGO_MEMBER"))):
    """FR-16: mark a field report reviewed, or promote it to an official mission."""
    def review(store):
        ev = store.get_mesh_event(event_id)
        if not ev:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mesh event not found")
        if body.action == "REVIEWED":
            return store.update_mesh_event(event_id, {"review_status": "REVIEWED"})
        if ev["review_status"] == "PROMOTED":
            return ev
        disaster_id = ev["disaster_id"]
        if not disaster_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Link the report to an incident first")
        disaster = store.get_disaster(disaster_id)
        if not disaster:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Linked incident no longer exists")
        ts = now()
        label = ev["type"].replace("_", " ").title()
        payload = ev["payload"] if isinstance(ev["payload"], dict) else {}
        task = store.create_task({
            "id": new_id("tsk"), "code": new_code("TSK"), "title": f"{label} — mesh report",
            "description": f"Promoted from mesh event {ev['event_id']}. Field payload: {payload}",
            "urgency": PRIORITY_TO_URGENCY[ev["priority"]],
            "required_skill": PROMOTE_SKILL.get(ev["type"], "Rescue & Search"),
            "lat": ev["lat"] if ev["lat"] is not None else disaster["lat"],
            "lng": ev["lng"] if ev["lng"] is not None else disaster["lng"],
            "location_name": disaster["location"], "quantity_needed": _crew_size(payload.get("count")),
            "status": "OPEN", "disaster_id": disaster_id, "created_by_id": claims["sub"], "assigned_to_id": None,
            "created_at": ts, "updated_at": ts,
        })
        return store.update_mesh_event(event_id, {"review_status": "PROMOTED", "promoted_task_id": task["id"]})

    row, source = db.write(review)
    tag(response, source)
    return row
