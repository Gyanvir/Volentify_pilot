"""Create the schema (if missing) and seed the tactical dataset.

    cd frontend && npm run db:seed

The API also does this automatically the first time it reaches an empty database.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from api._lib.core.config import get_settings  # noqa: E402
from api._lib.core.db import PostgresStore  # noqa: E402
from api._lib.data import fallback as fb  # noqa: E402

SCHEMA_SQL = Path(__file__).with_name("schema.sql")


def _insert(conn, table: str, row: dict, conflict: str = "id") -> int:
    cols = ", ".join(row)
    vals = ", ".join(f"%({k})s" for k in row)
    cur = conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({vals}) ON CONFLICT ({conflict}) DO NOTHING", row)
    return cur.rowcount


def seed(conn) -> dict[str, int]:
    """Insert the starting dataset; idempotent (ON CONFLICT DO NOTHING)."""
    from psycopg.types.json import Jsonb

    counts: dict[str, int] = {}

    def put(table: str, row: dict, conflict: str = "id") -> None:
        counts[table] = counts.get(table, 0) + _insert(conn, table, row, conflict)

    for org in fb.MOCK_ORGANIZATIONS:
        put("organizations", org)
    put("users", {"id": fb.SYSTEM_USER_ID, "name": "Volentify Command", "email": "command@volentify.org",
                  "phone": "", "role": "INCIDENT_ADMIN", "provider": "system", "is_verified": True,
                  "onboarded": True, "org_id": "org_ndrf", "profile_data": Jsonb({})})
    for d in fb.MOCK_HAZARDS:
        put("disasters", {**d, "polygon_geojson": json.dumps(d["polygon_geojson"]) if d["polygon_geojson"] else None})
    for e in fb.MOCK_EVIDENCE:
        put("evidence", e)
    for a in fb.MOCK_ALERTS:
        put("alerts", a)
    for v in fb.MOCK_VOLUNTEERS:
        user_id = f"usr_{v['id']}"
        put("users", {"id": user_id, "name": v["name"], "email": f"{v['id']}@volunteers.volentify.org",
                      "phone": "", "role": "VOLUNTEER", "provider": "seed", "is_verified": v["verified"],
                      "onboarded": True, "profile_data": Jsonb({})})
        put("volunteer_profiles", {
            "id": v["id"], "user_id": user_id, "skills": v["skills"], "current_lat": v["lat"],
            "current_lng": v["lng"], "location_name": v["location_name"], "availability": v["availability"],
            "missions_done": v["missions_done"], "total_hours": v["total_hours"], "equipment": v["equipment"],
            "badge_level": v["badge_level"], "response_rate": v["response_rate"]})
    for t in fb.MOCK_TASKS:
        put("tasks", t)
    for n in fb.MOCK_MESH_NODES:
        put("mesh_nodes", n)
    for m in fb.MOCK_MESH_EVENTS:
        put("mesh_events", {**m, "payload": Jsonb(m["payload"])}, conflict="event_id")
    return counts


def main() -> None:
    url = os.environ.get("DIRECT_URL") or get_settings().database_url
    if not url:
        sys.exit("DATABASE_URL is not set (use the direct connection on port 5432 for seeding).")
    store = PostgresStore(url)
    with store._conn() as conn:
        conn.execute(SCHEMA_SQL.read_text())
        counts = seed(conn)
    print("Seeded:", ", ".join(f"{t} +{n}" for t, n in counts.items()))


if __name__ == "__main__":
    main()
