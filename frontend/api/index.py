from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Volentify Disaster Intelligence API",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

class HazardNodeSchema(BaseModel):
    id: str
    name: str
    category: str
    subType: str
    severity: str
    lat: float
    lng: float
    details: str
    status: str
    updatedAt: str

class PredictionRequestSchema(BaseModel):
    lat: float
    lng: float
    district: str
    state: str
    wind_speed: float
    rainfall_mm: float

class PredictionResponseSchema(BaseModel):
    hazard_probability: float
    risk_level: str
    predicted_surge_m: float
    confidence_score: float

MOCK_DISASTERS = [
    {
        "id": "node-1",
        "name": "Cyclone Remal Center",
        "category": "hazard",
        "subType": "Cyclone",
        "severity": "CRITICAL",
        "lat": 19.8135,
        "lng": 85.8312,
        "details": "Category 3 Hurricane force winds (140 km/h) approaching Puri & Paradip coast.",
        "status": "Active Warning",
        "updatedAt": "10 mins ago"
    },
    {
        "id": "node-2",
        "name": "Guwahati Brahmaputra Inundation Zone",
        "category": "hazard",
        "subType": "Flood",
        "severity": "CRITICAL",
        "lat": 26.1445,
        "lng": 91.7362,
        "details": "River level 1.8m above danger mark. Evacuation order in 12 villages.",
        "status": "Evacuation in Progress",
        "updatedAt": "5 mins ago"
    }
]

@app.get("/api/health")
def read_health():
    return {
        "status": "ONLINE",
        "system": "VOLENTIFY DISASTER INTELLIGENCE PLATFORM",
        "version": "2.0.0",
        "platform": "VERCEL SERVERLESS PYTHON"
    }

@app.get("/api/disasters", response_model=list[HazardNodeSchema])
def get_disasters():
    return MOCK_DISASTERS

@app.post("/api/predict", response_model=PredictionResponseSchema)
def predict_hazard(data: PredictionRequestSchema):
    prob = min(0.98, (data.wind_speed * 0.004) + (data.rainfall_mm * 0.002))
    surge = round(prob * 3.8, 2)
    risk = "CRITICAL" if prob > 0.8 else "HIGH" if prob > 0.5 else "MODERATE"
    return {
        "hazard_probability": round(prob, 3),
        "risk_level": risk,
        "predicted_surge_m": surge,
        "confidence_score": 0.948
    }
