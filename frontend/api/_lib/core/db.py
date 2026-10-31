"""Data access with zero-downtime fallback (PRD §1.2, §9).

`PostgresStore` talks to Supabase PostgreSQL through PgBouncer (transaction mode, port 6543).
`MemoryStore` serves the pre-cached tactical dataset when the database is not configured or is
unreachable. Both implement the same methods, so routers never branch on the backend.

Reads silently degrade to the fallback store. Writes that must be durable (mesh ingest) raise
`DurabilityUnavailable` instead, so gateways keep their outbox and retry (PRD AT-08).
"""

from __future__ import annotations

import copy
import json
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional, TypeVar
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .config import get_settings
from ..data import fallback as fb

T = TypeVar("T")

ACTIVE_TASK_STATES = ("ASSIGNED", "IN_PROGRESS")
NODE_LIVENESS = timedelta(minutes=30)  # OD-06


class DurabilityUnavailable(RuntimeError):
    """Raised when a write requires PostgreSQL but it is unreachable."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── In-memory store ────────────────────────────────────────────────────────

class MemoryStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.users: dict[str, dict] = {
                fb.SYSTEM_USER_ID: {
                    "id": fb.SYSTEM_USER_ID, "name": "Volentify Command", "email": "command@volentify.org",
                    "phone": "", "password_hash": None, "role": "INCIDENT_ADMIN", "state_district": "New Delhi",
                    "lat": None, "lng": None, "provider": "system", "google_id": None, "avatar_url": None,
                    "blood_group": None, "emergency_contact": None, "is_verified": True, "onboarded": True,
                    "org_id": "org_ndrf", "profile_data": {}, "muster_code": None, "muster_issued_at": None,
                    "created_at": fb.ago(days=30), "updated_at": fb.ago(days=30),
                }
            }
            self.volunteers = {v["id"]: copy.deepcopy(v) for v in fb.MOCK_VOLUNTEERS}
            self.disasters = {d["id"]: copy.deepcopy(d) for d in fb.MOCK_HAZARDS}
            self.evidence = [copy.deepcopy(e) for e in fb.MOCK_EVIDENCE]
            self.tasks = {t["id"]: copy.deepcopy(t) for t in fb.MOCK_TASKS}
            self.alerts = [copy.deepcopy(a) for a in fb.MOCK_ALERTS]
            self.orgs = [copy.deepcopy(o) for o in fb.MOCK_ORGANIZATIONS]
            self.mesh_nodes = {n["node_uuid"]: copy.deepcopy(n) for n in fb.MOCK_MESH_NODES}
            self.mesh_events = {e["event_id"]: copy.deepcopy(e) for e in fb.MOCK_MESH_EVENTS}

    # users
    def get_user(self, user_id: str) -> Optional[dict]:
        return copy.deepcopy(self.users.get(user_id))

    def get_user_by_email(self, email: str) -> Optional[dict]:
        return copy.deepcopy(next((u for u in self.users.values() if u["email"] == email.lower()), None))

    def get_user_by_google(self, google_id: str) -> Optional[dict]:
        return copy.deepcopy(next((u for u in self.users.values() if u.get("google_id") == google_id), None))

    def create_user(self, user: dict) -> dict:
        with self._lock:
            if self.get_user_by_email(user["email"]):
                raise ValueError("email already registered")
            self.users[user["id"]] = copy.deepcopy(user)
        return copy.deepcopy(user)

    def update_user(self, user_id: str, fields: dict) -> Optional[dict]:
        with self._lock:
            if user_id not in self.users:
                return None
            self.users[user_id].update(copy.deepcopy(fields), updated_at=utcnow())
            return copy.deepcopy(self.users[user_id])

    def list_users(self, limit: int = 200) -> list[dict]:
        users = sorted(self.users.values(), key=lambda u: u["created_at"], reverse=True)
        return copy.deepcopy(users[:limit])

    # volunteers
    def upsert_volunteer_profile(self, user_id: str, fields: dict) -> dict:
        with self._lock:
            existing = next((v for v in self.volunteers.values() if v.get("user_id") == user_id), None)
            user = self.users[user_id]
            if existing:
                existing.update(fields, name=user["name"], verified=user["is_verified"])
                return copy.deepcopy(existing)
            profile = {
                "id": f"vol_{user_id[-8:]}", "user_id": user_id, "name": user["name"], "skills": [],
                "lat": 20.59, "lng": 78.96, "location_name": "Field Location", "availability": "AVAILABLE",
                "verified": user["is_verified"], "missions_done": 0, "total_hours": 0.0, "equipment": [],
                "badge_level": "Tier-1 Field Responder", "response_rate": 98.0, "active_missions": 0,
            }
            profile.update(fields)
            self.volunteers[profile["id"]] = profile
            return copy.deepcopy(profile)

    def get_volunteer_by_user(self, user_id: str) -> Optional[dict]:
        return copy.deepcopy(next((v for v in self.volunteers.values() if v.get("user_id") == user_id), None))

    def list_volunteers(self, availability: Optional[str] = None) -> list[dict]:
        vols = list(self.volunteers.values())
        if availability:
            vols = [v for v in vols if v["availability"] == availability]
        return copy.deepcopy(vols)

    def set_availability(self, volunteer_id: str, availability: str) -> Optional[dict]:
        with self._lock:
            vol = self.volunteers.get(volunteer_id)
            if not vol:
                return None
            vol["availability"] = availability
            return copy.deepcopy(vol)

    # disasters & evidence
    def list_disasters(self) -> list[dict]:
        order = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        return copy.deepcopy(sorted(self.disasters.values(), key=lambda d: (order[d["severity"]], d["title"])))

    def get_disaster(self, disaster_id: str) -> Optional[dict]:
        d = self.disasters.get(disaster_id) or next(
            (x for x in self.disasters.values() if x["code"] == disaster_id), None)
        return copy.deepcopy(d)

    def list_evidence(self, disaster_id: str) -> list[dict]:
        ev = [e for e in self.evidence if e["disaster_id"] == disaster_id]
        return copy.deepcopy(sorted(ev, key=lambda e: e["created_at"], reverse=True))

    def add_evidence(self, evidence: dict) -> dict:
        with self._lock:
            self.evidence.append(copy.deepcopy(evidence))
        return evidence

    # tasks
    def list_tasks(self, status: Optional[str] = None, disaster_id: Optional[str] = None,
                   assigned_to: Optional[str] = None) -> list[dict]:
        tasks = list(self.tasks.values())
        if status:
            tasks = [t for t in tasks if t["status"] == status]
        if disaster_id:
            tasks = [t for t in tasks if t["disaster_id"] == disaster_id]
        if assigned_to:
            tasks = [t for t in tasks if t["assigned_to_id"] == assigned_to]
        return copy.deepcopy(sorted(tasks, key=lambda t: t["created_at"], reverse=True))

    def get_task(self, task_id: str) -> Optional[dict]:
        return copy.deepcopy(self.tasks.get(task_id))

    def create_task(self, task: dict) -> dict:
        with self._lock:
            self.tasks[task["id"]] = copy.deepcopy(task)
        return task

    def update_task(self, task_id: str, fields: dict) -> Optional[dict]:
        with self._lock:
            task = self.tasks.get(task_id)
            if not task:
                return None
            task.update(fields, updated_at=utcnow())
            return copy.deepcopy(task)

    # alerts & organisations
    def list_alerts(self, limit: int = 100) -> list[dict]:
        return copy.deepcopy(sorted(self.alerts, key=lambda a: a["created_at"], reverse=True)[:limit])

    def create_alert(self, alert: dict) -> dict:
        with self._lock:
            self.alerts.append(copy.deepcopy(alert))
        return alert

    def list_organizations(self) -> list[dict]:
        return copy.deepcopy(self.orgs)

    # mesh
    def upsert_node(self, node_uuid: str, fields: dict) -> dict:
        with self._lock:
            node = self.mesh_nodes.get(node_uuid)
            if node is None:
                node = {"id": f"mn_{node_uuid[:8]}", "node_uuid": node_uuid, "volunteer_id": None,
                        "last_lat": None, "last_lng": None, "battery_level": None,
                        "last_seen_at": utcnow(), "created_at": utcnow()}
                self.mesh_nodes[node_uuid] = node
            node.update({k: v for k, v in fields.items() if v is not None})
            node["last_seen_at"] = utcnow()
            return copy.deepcopy(node)

    def insert_mesh_event(self, event: dict) -> bool:
        with self._lock:
            if event["event_id"] in self.mesh_events:
                return False
            self.mesh_events[event["event_id"]] = copy.deepcopy(event)
            return True

    def get_mesh_event(self, event_id: str) -> Optional[dict]:
        return copy.deepcopy(self.mesh_events.get(event_id))

    def update_mesh_event(self, event_id: str, fields: dict) -> Optional[dict]:
        with self._lock:
            ev = self.mesh_events.get(event_id)
            if not ev:
                return None
            ev.update(fields)
            return copy.deepcopy(ev)

    def list_mesh_events(self, disaster_id: Optional[str] = None, priority: Optional[str] = None,
                         type_: Optional[str] = None, since: Optional[datetime] = None,
                         limit: int = 50) -> list[dict]:
        evs = list(self.mesh_events.values())
        if disaster_id:
            evs = [e for e in evs if e["disaster_id"] == disaster_id]
        if priority:
            evs = [e for e in evs if e["priority"] == priority]
        if type_:
            evs = [e for e in evs if e["type"] == type_]
        if since:
            evs = [e for e in evs if e["observed_at"] >= since]
        return copy.deepcopy(sorted(evs, key=lambda e: e["observed_at"], reverse=True)[:limit])

    def list_mesh_nodes(self) -> list[dict]:
        return copy.deepcopy(sorted(self.mesh_nodes.values(), key=lambda n: n["last_seen_at"], reverse=True))


# ─── PostgreSQL store ───────────────────────────────────────────────────────

def _clean_dsn(url: str) -> str:
    """psycopg rejects Prisma-only query params such as ?pgbouncer=true."""
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in {"pgbouncer", "connection_limit", "schema"}]
    return urlunsplit(parts._replace(query=urlencode(query)))


_USER_COLS = ("id, name, email, phone, password_hash, role, state_district, lat, lng, provider, google_id, "
              "avatar_url, blood_group, emergency_contact, is_verified, onboarded, org_id, profile_data, "
              "muster_code, muster_issued_at, created_at, updated_at")
_VOL_SELECT = (
    "SELECT vp.id, vp.user_id, u.name, vp.skills, vp.current_lat AS lat, vp.current_lng AS lng, "
    "vp.location_name, vp.availability, u.is_verified AS verified, vp.missions_done, vp.total_hours, "
    "vp.equipment, vp.badge_level, vp.response_rate, "
    "(SELECT count(*) FROM tasks t WHERE t.assigned_to_id = vp.user_id "
    " AND t.status IN ('ASSIGNED','IN_PROGRESS'))::int AS active_missions "
    "FROM volunteer_profiles vp JOIN users u ON u.id = vp.user_id")
_DISASTER_COLS = ("id, code, title, category, severity, lat, lng, location, state, radius_km, polygon_geojson, "
                  "status, affected_pop, summary, wind_speed_kmh, rainfall_mm, surge_meters, org_id, "
                  "created_at, updated_at")
_TASK_COLS = ("id, code, title, description, urgency, required_skill, lat, lng, location_name, quantity_needed, "
              "status, disaster_id, created_by_id, assigned_to_id, created_at, updated_at")
_MESH_COLS = ("id, event_id, origin_node_id, disaster_id, type, priority, payload, lat, lng, observed_at, "
              "hop_count, ttl, received_at, review_status, promoted_task_id")
_NODE_COLS = "id, node_uuid, volunteer_id, last_lat, last_lng, battery_level, last_seen_at, created_at"


class PostgresStore:
    def __init__(self, dsn: str) -> None:
        self.dsn = _clean_dsn(dsn)

    def _conn(self):
        import psycopg
        from psycopg.rows import dict_row
        # prepare_threshold=None: PgBouncer transaction pooling cannot share prepared statements.
        return psycopg.connect(self.dsn, row_factory=dict_row, connect_timeout=5,
                               prepare_threshold=None, autocommit=True)

    @staticmethod
    def _utc(row: Optional[dict]) -> Optional[dict]:
        # Prisma DateTime columns are `timestamp(3)` holding UTC; make them timezone-aware.
        if row:
            for key, value in row.items():
                if isinstance(value, datetime) and value.tzinfo is None:
                    row[key] = value.replace(tzinfo=timezone.utc)
        return row

    def _all(self, sql: str, params: tuple | dict = ()) -> list[dict]:
        with self._conn() as conn:
            return [self._utc(r) for r in conn.execute(sql, params).fetchall()]  # type: ignore[misc]

    def _one(self, sql: str, params: tuple | dict = ()) -> Optional[dict]:
        with self._conn() as conn:
            return self._utc(conn.execute(sql, params).fetchone())

    @staticmethod
    def _json(value: Any):
        from psycopg.types.json import Jsonb
        return Jsonb(value)

    def ping(self) -> None:
        self._one("SELECT 1 AS ok")

    @staticmethod
    def _disaster(row: Optional[dict]) -> Optional[dict]:
        if row and isinstance(row.get("polygon_geojson"), str):
            try:
                row["polygon_geojson"] = json.loads(row["polygon_geojson"])
            except ValueError:
                row["polygon_geojson"] = None
        return row

    # users
    def get_user(self, user_id: str) -> Optional[dict]:
        return self._one(f"SELECT {_USER_COLS} FROM users WHERE id = %s", (user_id,))

    def get_user_by_email(self, email: str) -> Optional[dict]:
        return self._one(f"SELECT {_USER_COLS} FROM users WHERE email = %s", (email.lower(),))

    def get_user_by_google(self, google_id: str) -> Optional[dict]:
        return self._one(f"SELECT {_USER_COLS} FROM users WHERE google_id = %s", (google_id,))

    def create_user(self, user: dict) -> dict:
        import psycopg
        data = dict(user, profile_data=self._json(user.get("profile_data") or {}))
        cols = ", ".join(data)
        vals = ", ".join(f"%({k})s" for k in data)
        try:
            return self._one(f"INSERT INTO users ({cols}) VALUES ({vals}) RETURNING {_USER_COLS}", data)
        except psycopg.errors.UniqueViolation as exc:
            raise ValueError("email already registered") from exc

    def update_user(self, user_id: str, fields: dict) -> Optional[dict]:
        data = dict(fields)
        if "profile_data" in data:
            data["profile_data"] = self._json(data["profile_data"])
        sets = ", ".join(f"{k} = %({k})s" for k in data)
        data["_id"] = user_id
        return self._one(f"UPDATE users SET {sets}, updated_at = now() WHERE id = %(_id)s RETURNING {_USER_COLS}",
                         data)

    def list_users(self, limit: int = 200) -> list[dict]:
        return self._all(f"SELECT {_USER_COLS} FROM users ORDER BY created_at DESC LIMIT %s", (limit,))

    # volunteers
    def upsert_volunteer_profile(self, user_id: str, fields: dict) -> dict:
        mapping = {"lat": "current_lat", "lng": "current_lng"}
        data = {mapping.get(k, k): v for k, v in fields.items()
                if k in {"skills", "lat", "lng", "location_name", "availability", "equipment", "badge_level"}}
        data.setdefault("current_lat", 20.59)
        data.setdefault("current_lng", 78.96)
        from secrets import token_hex
        insert = dict(data, id=f"vol_{token_hex(8)}", user_id=user_id)
        cols = ", ".join(insert)
        vals = ", ".join(f"%({k})s" for k in insert)
        updates = ", ".join(f"{k} = EXCLUDED.{k}" for k in data)
        self._one(f"INSERT INTO volunteer_profiles ({cols}, updated_at) VALUES ({vals}, now()) "
                  f"ON CONFLICT (user_id) DO UPDATE SET {updates}, updated_at = now() RETURNING id", insert)
        return self.get_volunteer_by_user(user_id)  # type: ignore[return-value]

    def get_volunteer_by_user(self, user_id: str) -> Optional[dict]:
        return self._one(f"{_VOL_SELECT} WHERE vp.user_id = %s", (user_id,))

    def list_volunteers(self, availability: Optional[str] = None) -> list[dict]:
        if availability:
            return self._all(f"{_VOL_SELECT} WHERE vp.availability = %s", (availability,))
        return self._all(_VOL_SELECT)

    def set_availability(self, volunteer_id: str, availability: str) -> Optional[dict]:
        row = self._one("UPDATE volunteer_profiles SET availability = %s, updated_at = now() WHERE id = %s "
                        "RETURNING user_id", (availability, volunteer_id))
        return self.get_volunteer_by_user(row["user_id"]) if row else None

    # disasters & evidence
    def list_disasters(self) -> list[dict]:
        rows = self._all(f"SELECT {_DISASTER_COLS} FROM disasters ORDER BY "
                         "array_position(ARRAY['CRITICAL','HIGH','MODERATE','LOW'], severity::text), title")
        return [self._disaster(r) for r in rows]  # type: ignore[misc]

    def get_disaster(self, disaster_id: str) -> Optional[dict]:
        return self._disaster(self._one(f"SELECT {_DISASTER_COLS} FROM disasters WHERE id = %s OR code = %s",
                                        (disaster_id, disaster_id)))

    def list_evidence(self, disaster_id: str) -> list[dict]:
        return self._all("SELECT id, disaster_id, author_id, source, source_type, claim_text, relation, confidence, "
                         "language, created_at FROM evidence WHERE disaster_id = %s ORDER BY created_at DESC",
                         (disaster_id,))

    def add_evidence(self, evidence: dict) -> dict:
        cols = ", ".join(evidence)
        vals = ", ".join(f"%({k})s" for k in evidence)
        self._one(f"INSERT INTO evidence ({cols}) VALUES ({vals}) RETURNING id", evidence)
        return evidence

    # tasks
    def list_tasks(self, status: Optional[str] = None, disaster_id: Optional[str] = None,
                   assigned_to: Optional[str] = None) -> list[dict]:
        clauses, params = [], []
        for col, val in (("status", status), ("disaster_id", disaster_id), ("assigned_to_id", assigned_to)):
            if val:
                clauses.append(f"{col} = %s")
                params.append(val)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        return self._all(f"SELECT {_TASK_COLS} FROM tasks {where} ORDER BY created_at DESC LIMIT 500", tuple(params))

    def get_task(self, task_id: str) -> Optional[dict]:
        return self._one(f"SELECT {_TASK_COLS} FROM tasks WHERE id = %s", (task_id,))

    def create_task(self, task: dict) -> dict:
        cols = ", ".join(task)
        vals = ", ".join(f"%({k})s" for k in task)
        return self._one(f"INSERT INTO tasks ({cols}) VALUES ({vals}) RETURNING {_TASK_COLS}", task)  # type: ignore

    def update_task(self, task_id: str, fields: dict) -> Optional[dict]:
        sets = ", ".join(f"{k} = %({k})s" for k in fields)
        data = dict(fields, _id=task_id)
        return self._one(f"UPDATE tasks SET {sets}, updated_at = now() WHERE id = %(_id)s RETURNING {_TASK_COLS}", data)

    # alerts & organisations
    def list_alerts(self, limit: int = 100) -> list[dict]:
        return self._all("SELECT id, code, title, category, level, location, state, description, advisory, "
                         "disaster_id, sender_id, created_at FROM alerts ORDER BY created_at DESC LIMIT %s", (limit,))

    def create_alert(self, alert: dict) -> dict:
        cols = ", ".join(alert)
        vals = ", ".join(f"%({k})s" for k in alert)
        self._one(f"INSERT INTO alerts ({cols}) VALUES ({vals}) RETURNING id", alert)
        return alert

    def list_organizations(self) -> list[dict]:
        return self._all("SELECT id, name, category, state, district, contact_email, contact_phone, "
                         "registration_no, verified FROM organizations ORDER BY name")

    # mesh
    def upsert_node(self, node_uuid: str, fields: dict) -> dict:
        from uuid import uuid4
        data = {k: v for k, v in fields.items() if v is not None}
        sets = "".join(f", {k} = EXCLUDED.{k}" for k in data)
        insert = dict(data, id=str(uuid4()), node_uuid=node_uuid)
        cols = ", ".join(insert)
        vals = ", ".join(f"%({k})s" for k in insert)
        return self._one(f"INSERT INTO mesh_nodes ({cols}) VALUES ({vals}) ON CONFLICT (node_uuid) DO UPDATE "
                         f"SET last_seen_at = now(){sets} RETURNING {_NODE_COLS}", insert)  # type: ignore

    def insert_mesh_event(self, event: dict) -> bool:
        data = dict(event, payload=self._json(event["payload"]))
        cols = ", ".join(data)
        vals = ", ".join(f"%({k})s" for k in data)
        row = self._one(f"INSERT INTO mesh_events ({cols}) VALUES ({vals}) "
                        "ON CONFLICT (event_id) DO NOTHING RETURNING id", data)
        return row is not None

    def get_mesh_event(self, event_id: str) -> Optional[dict]:
        return self._one(f"SELECT {_MESH_COLS} FROM mesh_events WHERE event_id = %s", (event_id,))

    def update_mesh_event(self, event_id: str, fields: dict) -> Optional[dict]:
        sets = ", ".join(f"{k} = %({k})s" for k in fields)
        data = dict(fields, _id=event_id)
        return self._one(f"UPDATE mesh_events SET {sets} WHERE event_id = %(_id)s RETURNING {_MESH_COLS}", data)

    def list_mesh_events(self, disaster_id: Optional[str] = None, priority: Optional[str] = None,
                         type_: Optional[str] = None, since: Optional[datetime] = None,
                         limit: int = 50) -> list[dict]:
        clauses, params = [], []
        for col, val in (("disaster_id", disaster_id), ("priority", priority), ("type", type_)):
            if val:
                clauses.append(f"{col} = %s")
                params.append(val)
        if since:
            clauses.append("observed_at >= %s")
            params.append(since)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(limit)
        return self._all(f"SELECT {_MESH_COLS} FROM mesh_events {where} ORDER BY observed_at DESC LIMIT %s",
                         tuple(params))

    def list_mesh_nodes(self) -> list[dict]:
        return self._all(f"SELECT {_NODE_COLS} FROM mesh_nodes ORDER BY last_seen_at DESC LIMIT 500")


# ─── Routing between stores ─────────────────────────────────────────────────

MEMORY = MemoryStore()
_RETRY_AFTER_S = 30.0
_state = {"down_until": 0.0, "last_error": ""}
_pg: Optional[PostgresStore] = None


def _postgres() -> Optional[PostgresStore]:
    global _pg
    url = get_settings().database_url
    if not url or time.monotonic() < _state["down_until"]:
        return None
    if _pg is None:
        store = PostgresStore(url)
        try:
            bootstrap(store)
        except Exception as exc:  # noqa: BLE001
            if not _is_db_error(exc):
                raise
            _mark_down(exc)
            return None
        _pg = store
    return _pg


def bootstrap(store: PostgresStore) -> bool:
    """First connection to an empty database: create the schema and load the starting dataset.

    Guarded by a transaction-scoped advisory lock so concurrent serverless instances don't race. Returns True if it
    initialised the database.
    """
    from ..data import seed as seeding

    with store._conn() as conn:
        if conn.execute("SELECT to_regclass('public.mesh_events') AS t").fetchone()["t"]:
            return False
        # One transaction with a transaction-scoped lock: safe behind PgBouncer/Neon pooling too.
        with conn.transaction():
            conn.execute("SELECT pg_advisory_xact_lock(727274)")
            if conn.execute("SELECT to_regclass('public.mesh_events') AS t").fetchone()["t"]:
                return False
            conn.execute(seeding.SCHEMA_SQL.read_text())
            seeding.seed(conn)
            return True


def _mark_down(exc: Exception) -> None:
    _state["down_until"] = time.monotonic() + _RETRY_AFTER_S
    _state["last_error"] = type(exc).__name__


def _is_db_error(exc: Exception) -> bool:
    try:
        import psycopg
    except ImportError:  # pragma: no cover
        return False
    return isinstance(exc, (psycopg.OperationalError, psycopg.errors.UndefinedTable,
                            psycopg.errors.UndefinedColumn, psycopg.InterfaceError))


def fallback_label() -> str:
    return "fallback" if get_settings().database_url else "memory"


def read(op: Callable[[Any], T]) -> tuple[T, str]:
    """Run a read against PostgreSQL, degrading to the fallback dataset on failure."""
    pg = _postgres()
    if pg is not None:
        try:
            return op(pg), "database"
        except Exception as exc:  # noqa: BLE001
            if not _is_db_error(exc):
                raise
            _mark_down(exc)
    return op(MEMORY), fallback_label()


def write(op: Callable[[Any], T], durable: bool = False) -> tuple[T, str]:
    """Run a write. With durable=True, refuse to fall back when a database is configured."""
    pg = _postgres()
    configured = bool(get_settings().database_url)
    if pg is not None:
        try:
            return op(pg), "database"
        except Exception as exc:  # noqa: BLE001
            if not _is_db_error(exc):
                raise
            _mark_down(exc)
    if durable and configured:
        raise DurabilityUnavailable("database unreachable")
    return op(MEMORY), fallback_label()


def database_status() -> str:
    """ONLINE | DEGRADED (configured but unreachable) | FALLBACK (not configured)."""
    if not get_settings().database_url:
        return "FALLBACK"
    pg = _postgres()
    if pg is None:
        return "DEGRADED"
    try:
        pg.ping()
        return "ONLINE"
    except Exception as exc:  # noqa: BLE001
        _mark_down(exc)
        return "DEGRADED"


def node_is_active(last_seen: datetime) -> bool:
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return utcnow() - last_seen <= NODE_LIVENESS
