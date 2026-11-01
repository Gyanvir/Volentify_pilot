"""External situational feeds: OSM infrastructure (Overpass), NDMA SACHET CAP bulletins, imagery catalogue."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from ..data import fallback as fb
from .geo import haversine_km

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
SACHET_RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"

_OVERPASS_QUERY = """
[out:json][timeout:10];
(
  nwr["amenity"="hospital"](around:{r},{lat},{lng});
  nwr["amenity"="fire_station"](around:{r},{lat},{lng});
  nwr["amenity"="police"](around:{r},{lat},{lng});
  nwr["amenity"="shelter"](around:{r},{lat},{lng});
  nwr["emergency"="assembly_point"](around:{r},{lat},{lng});
  way["bridge"="yes"]["highway"~"trunk|primary"](around:{r},{lat},{lng});
);
out center 80;
"""
_KIND = {"hospital": "Hospital", "fire_station": "Fire station", "police": "Police station",
         "shelter": "Shelter", "assembly_point": "Assembly point"}


def _impact(distance_km: float) -> str:
    if distance_km < 2:
        return "Potentially affected"
    if distance_km < 5:
        return "In proximity"
    return "Outside impact zone"


async def nearby_infrastructure(lat: float, lng: float, radius_km: float) -> dict[str, Any]:
    facilities: list[dict] = []
    mode = "LIVE"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(OVERPASS_URL, data={
                "data": _OVERPASS_QUERY.format(r=int(radius_km * 1000), lat=lat, lng=lng)})
            resp.raise_for_status()
            for el in resp.json().get("elements", []):
                el_lat = el.get("lat") or el.get("center", {}).get("lat")
                el_lng = el.get("lon") or el.get("center", {}).get("lon")
                if el_lat is None or el_lng is None:
                    continue
                tags = el.get("tags", {})
                kind = (_KIND.get(tags.get("amenity", "")) or _KIND.get(tags.get("emergency", ""))
                        or ("Bridge" if tags.get("bridge") == "yes" else "Facility"))
                dist = haversine_km(lat, lng, el_lat, el_lng)
                facilities.append({"name": tags.get("name") or tags.get("name:en") or f"Unnamed {kind.lower()}",
                                   "type": kind, "lat": el_lat, "lng": el_lng, "distance_km": round(dist, 2),
                                   "status": _impact(dist), "osm_id": el.get("id")})
    except (httpx.HTTPError, ValueError):
        facilities = []
    if not facilities:
        mode = "DEMO"
        for h in fb.MOCK_HOSPITALS:
            dist = haversine_km(lat, lng, h["lat"], h["lng"])
            if dist <= radius_km * 3:
                facilities.append({"name": h["name"], "type": "Hospital", "lat": h["lat"], "lng": h["lng"],
                                   "distance_km": round(dist, 2), "status": _impact(dist), "osm_id": None})
    facilities.sort(key=lambda f: f["distance_km"])
    return {"facilities": facilities[:60], "data_mode": mode}


def _severity_from_text(text: str) -> str:
    t = text.lower()
    if "red" in t or "extreme" in t or "severe" in t:
        return "CRITICAL"
    if "orange" in t or "warning" in t:
        return "HIGH"
    if "yellow" in t or "watch" in t:
        return "MODERATE"
    return "LOW"


async def sachet_bulletins(limit: int = 40) -> dict[str, Any]:
    """Public CAP feed from NDMA SACHET; falls back to Volentify's own alerts."""
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(SACHET_RSS_URL)
            resp.raise_for_status()
        root = ET.fromstring(resp.content)
        items = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            desc = (item.findtext("description") or "").strip()
            pub = item.findtext("pubDate")
            try:
                published = parsedate_to_datetime(pub) if pub else datetime.now(timezone.utc)
            except (TypeError, ValueError):
                published = datetime.now(timezone.utc)
            items.append({"title": title, "description": desc, "link": item.findtext("link"),
                          "source": (item.findtext("author") or "NDMA SACHET").strip(),
                          "severity": _severity_from_text(f"{title} {desc}"), "published_at": published})
            if len(items) >= limit:
                break
        if items:
            from ..core import research
            research.record_many("cap_alert", "NDMA SACHET", [
                (research.fingerprint(i["title"], i["published_at"], i["link"]), i) for i in items])
            return {"source": "NDMA SACHET CAP feed", "mode": "LIVE", "items": items}
    except (httpx.HTTPError, ET.ParseError):
        pass
    return {"source": "Volentify alert register", "mode": "DEMO", "items": [
        {"title": a["title"], "description": a["description"], "link": None, "source": a["state"],
         "severity": a["level"], "published_at": a["created_at"]} for a in fb.MOCK_ALERTS]}


def imagery_layers() -> list[dict[str, Any]]:
    """Raster overlays the map can render. Daily imagery uses yesterday (UTC) for complete coverage."""
    day = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    gibs = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{day}/GoogleMapsCompatible_Level9/{{z}}/{{y}}/{{x}}.jpg"
    return [
        {"id": "esri-imagery", "label": "High-resolution imagery", "provider": "Esri World Imagery",
         "tiles": ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
         "max_zoom": 19, "cadence": "Static mosaic"},
        {"id": "modis-terra", "label": "MODIS Terra true colour", "provider": "NASA GIBS",
         "tiles": [gibs.format(layer="MODIS_Terra_CorrectedReflectance_TrueColor", day=day)],
         "max_zoom": 9, "cadence": f"Daily · {day}"},
        {"id": "viirs-snpp", "label": "VIIRS SNPP true colour", "provider": "NASA GIBS",
         "tiles": [gibs.format(layer="VIIRS_SNPP_CorrectedReflectance_TrueColor", day=day)],
         "max_zoom": 9, "cadence": f"Daily · {day}"},
        {"id": "rainviewer", "label": "Precipitation radar composite", "provider": "RainViewer",
         "tiles": [], "dynamic": "https://api.rainviewer.com/public/weather-maps.json", "max_zoom": 7,
         "cadence": "Every 10 minutes"},
    ]
