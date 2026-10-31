"""ML inference, dispatch optimisation and situational-intelligence endpoints (PRD §10.3–10.5)."""

from __future__ import annotations

from fastapi import APIRouter, Response

from ..core import db
from ..engines import briefing, cyclone, dedup, dispatch, intel, surge, triage
from ..schemas import (
    BriefingRequest, DeduplicatedEvent, DispatchRequest, DispatchResult, MatchRequest, NearbyRequest,
    PredictionRequest, PredictionResponse, RankedMatch, RawReport, SituationBriefing, TriageRequest,
    TriageResponse,
)
from .common import tag

router = APIRouter(prefix="/api", tags=["intelligence"])


@router.post("/predict", response_model=PredictionResponse)
def predict(body: PredictionRequest):
    return surge.predict(body.model_dump())


@router.get("/ml/models")
def ml_models():
    """Model cards for the trained models this deployment serves (empty until the pipeline has run)."""
    card = cyclone.model_card()
    return {"cyclone": card, "trained": card is not None}


@router.post("/triage/laya", response_model=TriageResponse)
def laya_triage(body: TriageRequest):
    return triage.triage(body.text, body.location, body.language_hint)


@router.post("/events/ingest", response_model=list[DeduplicatedEvent])
def events_ingest(reports: list[RawReport]):
    return dedup.deduplicate([r.model_dump() for r in reports])


@router.post("/briefing/generate", response_model=SituationBriefing)
def briefing_generate(body: BriefingRequest):
    return briefing.generate(body.event_id, body.event_label, body.location,
                             [e.model_dump() for e in body.evidence])


@router.post("/match", response_model=list[RankedMatch])
def match(body: MatchRequest, response: Response):
    if body.volunteers is not None:
        volunteers, source = [v.model_dump() for v in body.volunteers], "request"
    else:
        volunteers, source = db.read(lambda s: s.list_volunteers())
    tag(response, source)
    return dispatch.rank_volunteers(body.task.model_dump(), volunteers)


@router.post("/match/dispatch-batch", response_model=DispatchResult)
def dispatch_batch(response: Response, body: DispatchRequest | None = None):
    body = body or DispatchRequest()

    def load(store):
        tasks = [t.model_dump() for t in body.tasks] if body.tasks is not None else store.list_tasks(status="OPEN")
        vols = ([v.model_dump() for v in body.volunteers] if body.volunteers is not None
                else store.list_volunteers())
        return tasks, vols

    (tasks, volunteers), source = db.read(load)
    tag(response, source)
    return dispatch.dispatch_batch(tasks, volunteers)


@router.post("/infrastructure/nearby")
async def infrastructure_nearby(body: NearbyRequest):
    return await intel.nearby_infrastructure(body.lat, body.lng, body.radius_km)


@router.get("/bhuvan/layers")
def imagery_layers():
    return intel.imagery_layers()


@router.get("/bhuvan/bulletins")
async def bulletins():
    return await intel.sachet_bulletins()
