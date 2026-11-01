"""API acceptance tests (PRD §14). Run from frontend/: python -m pytest tests -q"""

import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api._lib.core import db  # noqa: E402
from api._lib.core.config import get_settings  # noqa: E402
from api._lib.engines import dispatch, surge, triage  # noqa: E402
from api._lib.routers import auth, entities, mesh  # noqa: E402
from api.index import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    from api._lib.core.config import DATABASE_URL_VARS
    for name in DATABASE_URL_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("VOLENTIFY_ENV", "test")
    monkeypatch.setenv("NEXTAUTH_SECRET", "test-secret-that-is-at-least-32-bytes-long")
    monkeypatch.setenv("VOLENTIFY_ADMIN_EMAILS", "chief@ndrf.gov.in")
    get_settings.cache_clear()
    db.MEMORY.reset()
    db._state["down_until"] = 0.0
    db._pg = None
    for limiter in (auth._login_limiter, entities._report_limiter, mesh._ingest_limiter):
        limiter._hits.clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def signup(client, email, role="VOLUNTEER", skills=("Boat Rescue",)):
    r = client.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "s3cure-pass!"})
    assert r.status_code == 201, r.text
    assert r.json()["requiresOnboarding"] is True
    r = client.post("/api/auth/onboard", json={
        "phone": "+91 98765 43210", "role": role, "state_district": "Puri, Odisha", "lat": 19.81, "lng": 85.83,
        "skills": list(skills), "profile": {"blood_group": "O+"}})
    assert r.status_code == 200, r.text
    return r.json()["user"]


def mesh_event(**over):
    base = {"event_id": str(uuid.uuid4()), "origin_node_id": str(uuid.uuid4()), "disaster_id": "dis_remal_puri",
            "type": "PERSON_TRAPPED", "priority": "CRITICAL", "payload": {"count": 4},
            "lat": 19.81, "lng": 85.83, "observed_at": datetime.now(timezone.utc).isoformat(),
            "hop_count": 2, "ttl": 3}
    base.update(over)
    return base


# ─── health & entities ──────────────────────────────────────────────────────

def test_health_reports_fallback_without_database(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ONLINE" and body["database"] == "FALLBACK"


def test_entity_lists_serve_fallback_dataset(client):
    for path in ("/api/disasters", "/api/tasks", "/api/alerts", "/api/volunteers", "/api/organizations"):
        r = client.get(path)
        assert r.status_code == 200 and len(r.json()) > 0, path
        assert r.headers["X-Data-Source"] == "memory"


def test_disaster_dossier_and_briefing(client):
    dossier = client.get("/api/disasters/CYC-2026-REMAL").json()
    assert dossier["disaster"]["id"] == "dis_remal_puri" and dossier["evidence"] and dossier["tasks"]
    brief = client.get("/api/disasters/dis_remal_puri/briefing").json()
    assert brief["conflicting_count"] >= 1 and brief["supporting_count"] >= 3
    assert len(brief["brief"].split()) <= 151


# ─── auth & onboarding ──────────────────────────────────────────────────────

def test_register_onboard_issues_muster_pass(client):
    user = signup(client, "asha@example.org")
    assert user["onboarded"] and user["phone"] == "9876543210"
    assert user["muster"]["code"].startswith("TAC-VOL-")
    me = client.get("/api/auth/me").json()
    assert me["requiresOnboarding"] is False
    assert client.get("/api/volunteers/me").json()["skills"] == ["Boat Rescue"]


def test_onboarding_rejects_invalid_phone(client):
    client.post("/api/auth/register", json={"name": "X Y", "email": "x@example.org", "password": "s3cure-pass!"})
    r = client.post("/api/auth/onboard", json={"phone": "12345", "role": "CITIZEN", "state_district": "Delhi"})
    assert r.status_code == 422 and "10-digit" in r.json()["detail"]


def test_login_wrong_password(client):
    signup(client, "b@example.org")
    assert client.post("/api/auth/login", json={"email": "b@example.org", "password": "nope-nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "b@example.org", "password": "s3cure-pass!"}).status_code == 200


def test_elevated_roles_need_verification(client):
    signup(client, "ngo@example.org", role="NGO_MEMBER")
    r = client.post("/api/tasks", json={"title": "Pack kits", "required_skill": "Manual Packing", "lat": 20.2,
                                        "lng": 86.6, "disaster_id": "dis_remal_puri"})
    assert r.status_code == 403 and "verification" in r.json()["detail"]


def test_rbac_blocks_citizen_broadcast(client):
    signup(client, "c@example.org", role="CITIZEN")
    r = client.post("/api/alerts", json={"title": "Test alert", "category": "Flood", "location": "Puri",
                                         "state": "Odisha", "description": "Testing broadcast", "advisory": "Stay safe now"})
    assert r.status_code == 403


def test_admin_allowlist_can_broadcast(client):
    signup(client, "chief@ndrf.gov.in", role="INCIDENT_ADMIN")
    r = client.post("/api/alerts", json={"title": "Evacuate now", "category": "Cyclone", "level": "CRITICAL",
                                         "location": "Puri", "state": "Odisha", "description": "Surge expected",
                                         "advisory": "Move to shelters"})
    assert r.status_code == 201 and r.json()["code"].startswith("ALT-")


# ─── mesh (AT-06 … AT-09) ───────────────────────────────────────────────────

def gateway(client):
    signup(client, f"gw-{uuid.uuid4().hex[:6]}@example.org")
    return {"Authorization": f"Bearer {client.post('/api/mesh/token').json()['token']}"}


def test_ingest_requires_bearer(client):
    r = client.post("/api/mesh/ingest", json={"gateway_node_id": str(uuid.uuid4()), "events": []})
    assert r.status_code == 401


def test_ingest_is_idempotent(client):
    headers = gateway(client)
    batch = {"gateway_node_id": str(uuid.uuid4()), "events": [mesh_event(), mesh_event(priority="LOW")]}
    first = client.post("/api/mesh/ingest", json=batch, headers=headers).json()
    assert first["accepted_count"] == 2 and first["duplicate_count"] == 0 and first["persistence"] == "volatile"
    replay = client.post("/api/mesh/ingest", json=batch, headers=headers).json()
    assert replay["accepted_count"] == 0 and replay["duplicate_count"] == 2


@pytest.mark.parametrize("override", [
    {"payload": {"blob": "x" * 5000}}, {"ttl": 6}, {"lat": 19.8, "lng": None}, {"lat": 120.0},
    {"type": "ALIEN_INVASION"}, {"priority": "URGENT"},
])
def test_ingest_validation(client, override):
    headers = gateway(client)
    r = client.post("/api/mesh/ingest", json={"gateway_node_id": str(uuid.uuid4()),
                                              "events": [mesh_event(**override)]}, headers=headers)
    assert r.status_code == 422


def test_ingest_batch_limit(client):
    headers = gateway(client)
    r = client.post("/api/mesh/ingest", json={"gateway_node_id": str(uuid.uuid4()),
                                              "events": [mesh_event() for _ in range(101)]}, headers=headers)
    assert r.status_code == 422


def test_null_gps_is_accepted(client):
    headers = gateway(client)
    r = client.post("/api/mesh/ingest", json={"gateway_node_id": str(uuid.uuid4()),
                                              "events": [mesh_event(lat=None, lng=None)]}, headers=headers)
    assert r.status_code == 200 and r.json()["accepted_count"] == 1


def test_events_redacted_for_public(client):
    events = client.get("/api/mesh/events").json()
    trapped = next(e for e in events if e["type"] == "PERSON_TRAPPED")
    assert trapped["payload"].get("redacted") is True


def test_events_filters_and_nodes(client):
    crit = client.get("/api/mesh/events", params={"priority": "CRITICAL"}).json()
    assert crit and all(e["priority"] == "CRITICAL" for e in crit)
    nodes = client.get("/api/mesh/nodes").json()
    assert any(n["active"] for n in nodes) and any(not n["active"] for n in nodes)
    incidents = client.get("/api/mesh/incidents").json()
    assert incidents and len(incidents[0]["bbox"]) == 4


def test_admin_promotes_mesh_report(client):
    signup(client, "chief@ndrf.gov.in", role="INCIDENT_ADMIN")
    event_id = "d4a1b8c2-3e5f-4a7b-9c1d-2e4f6a8b0c2e"
    r = client.patch(f"/api/mesh/events/{event_id}", json={"action": "PROMOTE"})
    assert r.status_code == 200 and r.json()["review_status"] == "PROMOTED"
    task_id = r.json()["promoted_task_id"]
    assert any(t["id"] == task_id for t in client.get("/api/tasks").json())


def test_ingest_refuses_volatile_ack_when_database_down(client, monkeypatch):
    headers = gateway(client)
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@127.0.0.1:1/none?pgbouncer=true")
    get_settings.cache_clear()
    db._pg = None
    r = client.post("/api/mesh/ingest", json={"gateway_node_id": str(uuid.uuid4()), "events": [mesh_event()]},
                    headers=headers)
    assert r.status_code == 503 and r.headers["Retry-After"] == "30"
    reads = client.get("/api/disasters")
    assert reads.status_code == 200 and reads.headers["X-Data-Source"] == "fallback"
    assert client.get("/api/health").json()["database"] == "DEGRADED"


# ─── engines ────────────────────────────────────────────────────────────────

def test_dispatch_protects_rare_specialists(client):
    result = client.post("/api/match/dispatch-batch").json()
    assert result["latency_ms"] < 50 and result["tasks_evaluated"] > 0
    by_task = {}
    for a in result["assignments"]:
        by_task.setdefault(a["task_code"], []).append(a)
    # Critical boat rescue goes to boat specialists, and specialists are never spent on kit packing
    # while generic responders are available.
    packing = by_task.get("TSK-003", [])
    assert packing and all(a["volunteer_name"] in {"Anita Patel", "Manoj Nayak"} for a in packing[:2])
    order = [a["urgency"] for a in result["assignments"]]
    assert order == sorted(order, key=dispatch.URGENCY_RANK.get)
    assert any(b["task_code"] == "TSK-003" for b in result["bottlenecks"]) or len(packing) == 4


def test_specialist_tasks_never_get_untrained_responders():
    task = {"id": "t", "code": "T", "title": "Triage", "urgency": "CRITICAL", "required_skill": "Paramedic",
            "lat": 20.0, "lng": 85.0, "quantity_needed": 1, "status": "OPEN"}
    vols = [{"id": "v", "name": "Packer", "skills": ["Manual Packing"], "lat": 20.0, "lng": 85.0,
             "availability": "AVAILABLE"}]
    result = dispatch.dispatch_batch([task], vols)
    assert result["assignments"] == [] and result["bottlenecks"][0]["deficit"] == 1


def test_squander_penalty_applied():
    pool = dispatch.skill_pool([{"skills": ["Paramedic"]}, {"skills": ["Manual Packing"]}])
    task = {"urgency": "LOW", "required_skill": "Manual Packing", "lat": 0, "lng": 0}
    medic = dispatch.score(task, {"skills": ["Paramedic"], "lat": 0, "lng": 0}, pool, 0)
    packer = dispatch.score(task, {"skills": ["Manual Packing"], "lat": 0, "lng": 0}, pool, 0)
    assert medic.squander and not packer.squander and packer.score > medic.score * 50


def test_laya_hindi_flood():
    r = triage.triage("बाढ़ से लोग फंसे हैं, नाव चाहिए", "Assam", "hi")
    assert r["disaster_type"] == "Flood" and r["severity"] == "CRITICAL" and r["urgency_score"] == 5
    assert r["flags"]["trapped_civilians"] and "Boats" in r["needs"] and r["language"] == "hi"
    assert r["tier"] == "deterministic" and r["latency_ms"] < 35


def test_laya_english_and_counts():
    r = triage.triage("Building collapse in Kangra, 12 people trapped, two injured, need ambulance")
    assert r["disaster_type"] == "Collapse" and r["trapped_count"] == 12 and r["flags"]["medical_emergency"]


def test_laya_api_endpoint(client):
    r = client.post("/api/triage/laya", json={"text": "Heavy flood, villagers need drinking water and food"})
    body = r.json()
    assert r.status_code == 200 and body["flags"]["food_water_needed"] and body["severity"] == "HIGH"


def test_surge_model_thresholds(client):
    remal = client.post("/api/predict", json={"lat": 19.8135, "lng": 85.8312, "district": "Puri",
                                              "state": "Odisha", "wind_speed": 142.0, "rainfall_mm": 285.0}).json()
    assert remal["risk_level"] == "CRITICAL" and remal["predicted_surge_m"] > 2.5
    inland = surge.predict({"lat": 28.61, "lng": 77.21, "wind_speed": 18.0, "rainfall_mm": 0.0})
    assert inland["risk_level"] == "MODERATE" and inland["predicted_surge_m"] < 0.05
    assert inland["features"]["x6_coast_distance_km"] > 500


def test_event_dedup_clusters(client):
    now = datetime.now(timezone.utc)
    reports = [
        {"id": "r1", "text": "Heavy flooding in Guwahati, water above danger mark", "source": "NDMA",
         "timestamp": (now - timedelta(minutes=50)).isoformat()},
        {"id": "r2", "text": "Guwahati villages submerged after flood, SDRF deployed", "source": "News",
         "timestamp": (now - timedelta(minutes=10)).isoformat()},
        {"id": "r3", "text": "Cyclone approaching Puri coast at 145 km/h", "source": "IMD",
         "timestamp": now.isoformat()},
    ]
    events = client.post("/api/events/ingest", json=reports).json()
    assert len(events) == 2
    flood = next(e for e in events if e["disaster_type"] == "Flood")
    assert sorted(flood["report_ids"]) == ["r1", "r2"] and flood["location"] == "Guwahati"


def test_citizen_report_links_to_incident(client):
    r = client.post("/api/reports", json={"text": "Family of 5 trapped on roof, water rising fast",
                                          "location": "Paradip", "lat": 20.26, "lng": 86.67})
    body = r.json()
    assert r.status_code == 201 and body["linked_disaster_id"] == "dis_remal_puri" and body["stored"]
    assert body["triage"]["severity"] == "CRITICAL"


def test_validation_errors_are_readable(client):
    r = client.post("/api/predict", json={"lat": 999, "lng": 0, "wind_speed": 1, "rainfall_mm": 1})
    assert r.status_code == 422 and r.json()["detail"].startswith("lat:")
    json.dumps(r.json())


def test_database_url_aliases_and_derived_session_key(client, monkeypatch):
    """Vercel's Neon integration may name the variable DB_URL; sessions must survive a missing NEXTAUTH_SECRET."""
    monkeypatch.setenv("VOLENTIFY_ENV", "production")
    monkeypatch.delenv("NEXTAUTH_SECRET", raising=False)
    monkeypatch.setenv("DB_URL", "postgresql://u:p@127.0.0.1:1/neondb?sslmode=require")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.database_url_var == "DB_URL"
    assert settings.session_secret_source == "derived" and len(settings.session_secret) == 64
    body = client.get("/api/health").json()
    assert body["configuration"]["database_variable"] == "DB_URL"
    assert body["configuration"]["session_key"] == "derived"
    assert "p@" not in str(body)


def test_missing_secret_breaks_only_sign_in(client, monkeypatch):
    monkeypatch.setenv("VOLENTIFY_ENV", "production")
    monkeypatch.delenv("NEXTAUTH_SECRET", raising=False)
    get_settings.cache_clear()
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/disasters").status_code == 200
    r = client.post("/api/auth/register", json={"name": "A B", "email": "a@b.co", "password": "longpassword1"})
    assert r.status_code == 503


def test_research_archive_records_forecasts_and_snapshots(client, monkeypatch):
    from api._lib.core import research
    from api._lib.engines import intel
    from api._lib.routers import research as research_router
    research._memory.clear()
    research_router._collect_limiter._hits.clear()

    async def fake_feed(limit=40):
        items = [{"title": "Heavy rain warning", "description": "Orange alert", "link": "x", "source": "IMD",
                  "severity": "HIGH", "published_at": "2026-11-01T00:00:00+00:00"}]
        research.record_many("cap_alert", "NDMA SACHET", [(research.fingerprint("a"), i) for i in items])
        return {"source": "NDMA SACHET CAP feed", "mode": "LIVE", "items": items}

    monkeypatch.setattr(intel, "sachet_bulletins", fake_feed)
    client.post("/api/predict", json={"lat": 19.8, "lng": 85.8, "wind_speed": 150, "rainfall_mm": 200})
    r = client.post("/api/research/collect")
    assert r.status_code == 200 and r.json()["cap_feed_mode"] == "LIVE"
    client.post("/api/research/collect")  # same alert again is not archived twice
    kinds = client.get("/api/research/summary").json()["kinds"]
    assert kinds["forecast"]["count"] == 1 and kinds["cap_alert"]["count"] == 1
    assert kinds["platform_snapshot"]["count"] == 2
    assert client.get("/api/research/export").status_code == 401


def test_localhost_public_url_ignored_in_production(client, monkeypatch):
    monkeypatch.setenv("VOLENTIFY_ENV", "production")
    monkeypatch.setenv("NEXTAUTH_URL", "http://localhost:3000")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "abc.apps.googleusercontent.com")
    get_settings.cache_clear()
    r = client.get("/api/auth/google/start", headers={"x-forwarded-host": "volentify.vercel.app",
                                                      "x-forwarded-proto": "https"}, follow_redirects=False)
    assert r.status_code == 302
    assert "redirect_uri=https%3A%2F%2Fvolentify.vercel.app%2Fauth%2Fcallback" in r.headers["location"]
