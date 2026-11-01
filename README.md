# Volentify

Disaster intelligence, offline mesh coordination and volunteer dispatch for India.

Volentify gives incident commanders, NGOs, volunteers and citizens one shared picture of an
emergency: a 2D/3D tactical map, field reports that survive network collapse through the
Volentify Mesh companion app, multilingual triage, storm-surge forecasting and a dispatch engine
that matches the right responder to the right mission without wasting scarce specialists.

The full product specification is in [`docs/PRD.md`](docs/PRD.md); the design system is in
[`docs/DESIGN.md`](docs/DESIGN.md).

## Repository layout

```
Volentify/
├── README.md
├── docs/
│   ├── PRD.md                    Product requirements (v3.5)
│   ├── DESIGN.md                 Design system: tokens, type, map language, components
│   └── design/references/        Earlier Stitch design explorations (reference only)
├── .github/workflows/            CI, APK build & release, weekly model training
├── ml/                           Cyclone model pipeline (IBTrACS → features → XGBoost → API)
├── mesh-android/                 Volentify Mesh: Android BLE store-and-forward relay app
└── frontend/                     The deployable web app (Vercel root directory)
    ├── app/                      Next.js 15 App Router
    │   ├── layout.tsx            Fonts, session, toasts, navigation
    │   ├── map/                  Full-screen tactical map (no footer)
    │   └── (site)/               Every other route, grouped by purpose:
    │       ├── page.tsx          Home
    │       ├── (operations)/     disasters, disasters/[id], alerts, volunteer, resources, predictions
    │       ├── (intelligence)/   disaster-intelligence, analytics
    │       ├── (account)/        login, register, onboarding, auth/callback
    │       ├── (console)/        dashboard, agency, admin
    │       └── (about)/          about, research, faqs, news, ngo-partners, government,
    │                             contact, knowledge, privacy, terms
    ├── components/
    │   ├── ui/                   Design-system primitives
    │   ├── layout/               Navbar, footer
    │   ├── map/                  Tactical map, detail drawer, God's Eye HUD
    │   └── …                     Feature components (auth, globe, operations, home)
    ├── lib/                      API client, session, types, constants, utilities
    ├── middleware.ts             Role-based route protection (SEC-03)
    ├── prisma/schema.prisma      Database schema (PostgreSQL / Supabase)
    ├── api/                      FastAPI backend (Vercel Python function)
    │   ├── index.py              App entry point and /api/health
    │   └── _lib/
    │       ├── core/             config, database (Postgres + fallback), security
    │       ├── engines/          dispatch, triage, surge, dedup, briefing, intel, gemini, geo
    │       ├── routers/          auth, entities, mesh, intelligence
    │       ├── data/             fallback dataset and seed script
    │       ├── models/           trained models + model card, written by the ML workflow
    │       └── schemas.py        Request/response contracts
    └── tests/                    API acceptance tests (PRD §14)
```

## Running locally

Requirements: Node 20+, Python 3.12+.

```bash
cd frontend
npm install
pip install -r requirements.txt      # add pytest to run the tests
cp .env.example .env                 # optional — everything works without it
npm run dev                          # Next.js on :3000 and FastAPI on :8000 together
```

Open http://localhost:3000. API docs are at http://localhost:3000/api/docs.

Without `DATABASE_URL` the API serves its built-in tactical dataset and keeps new writes in memory;
every screen shows a "Demo dataset" marker so this is never mistaken for live data. In local
development, NGO and command roles are verified automatically so every console can be explored.

### Connecting a database

Any PostgreSQL 15+ works — Neon (from Vercel → Storage), Supabase, or local Postgres.

1. Set `DATABASE_URL` (the pooled connection string). `DB_URL`, `POSTGRES_URL` and `DB_POSTGRES_URL` are read
   too, so Vercel's Neon integration works whatever prefix it was connected with.
2. That's it: on first connection to an empty database the API creates the schema
   (`api/_lib/data/schema.sql`, equivalent to `prisma/schema.prisma`) and loads the starting dataset.
   `npm run db:seed` does the same from your machine; `npm run db:push` is the Prisma route.
3. Set `NEXTAUTH_SECRET` and, for your own account, `VOLENTIFY_ADMIN_EMAILS`.

### Google sign-in

Create an OAuth client (Web) in Google Cloud Console, add `{NEXTAUTH_URL}/auth/callback` as an
authorised redirect URI and set `GOOGLE_CLIENT_ID`. The ID token is verified server-side against
Google's signing keys, audience, issuer and a one-time nonce.

## Deploying to Vercel

1. Import the repository and set **Root Directory** to `frontend`.
2. Storage → Create Database → Neon (Postgres), connected to the project. This adds `DATABASE_URL`
   (or `DB_URL`, depending on the prefix chosen).
3. Add `NEXTAUTH_SECRET` (any long random string), `NEXTAUTH_URL` (your site address) and
   `VOLENTIFY_ADMIN_EMAILS`. Optional: `GOOGLE_CLIENT_ID`, `GEMINI_API_KEY` (an AI Studio key `AIza…` or a
   Vertex AI express key `AQ.…` — both are supported).
   `/api/health` reports which variables the deployment picked up, and `/api/health?deep=1` makes a live Gemini
   call to confirm the key works.
4. Deploy. Next.js pages and the Python API (`api/index.py`, routed by `vercel.json`) deploy together,
   and the first API request initialises the database.

## What is implemented

| Area | Status |
| :-- | :-- |
| Mesh ingest & read APIs (FR-05…FR-16) | Bearer-token gateways, 100-event / 4 KB validation, idempotent upsert, node liveness, redaction of sensitive reports for unverified readers, review & promotion to missions. Ingest returns **503** instead of a volatile acknowledgement when the database is down, so phones keep their outbox. |
| Sperling dispatch | Lexicographic greedy allocation with urgency weights, skill scarcity, adjacency, the 0.12 squander penalty, distance decay and fatigue; specialist missions never fall back to untrained responders. |
| Laya triage | Three tiers: local `laya` package → hosted Impossibl endpoint → deterministic multilingual lexicon (English, Hindi, Marathi, Bengali, Assamese, Odia, Tamil, Telugu, Malayalam). |
| Cyclone forecasting | XGBoost models trained on NOAA IBTrACS North Indian Ocean best tracks (1980 onward, IMD winds preferred): 24-hour intensity change and the probability of reaching severe cyclonic storm strength. Evaluated on held-out storms against persistence and climatology; metrics shown on `/predictions`. Served with a dependency-free tree evaluator, so the API stays small. |
| Storm surge | Calibrated physical estimator (inverse barometer, saturating wind set-up, coastline distance decay) driven by the forecast peak wind — there is no open surge-observation archive for India to train on. |
| Dedup & briefing | Spatio-temporal clustering (15 km / 2 h) and corroboration analysis; Gemini merges facts and writes the 150-word briefing when `GEMINI_API_KEY` is set. |
| Auth | Credentials (scrypt) and Google OAuth, signed HTTP-only session, compulsory 5-step onboarding, signed digital muster passes, verification for NGO/command roles. |
| Map | MapLibre with CARTO Dark Matter, imagery base maps (Esri, NASA GIBS daily), live precipitation radar, 3D terrain with hillshade, God's Eye orbital HUD, filters, measuring, PNG export. |

## Volentify Mesh (Android)

`mesh-android/` is the offline companion app: Kotlin, Jetpack Compose, Room and WorkManager.

- Every phone advertises and scans for the Volentify BLE service and acts as both GATT server and
  client. Envelopes are framed to fit any MTU, validated, deduplicated by `eventId`, stored with
  `hopCount + 1` / `ttl − 1` and relayed onward while `ttl > 0`.
- Reports live in SQLite, so they survive the app closing and the phone restarting. Each shows
  Saved locally → Relayed → Syncing → Server-confirmed (or Failed).
- Any phone with internet uploads its outbox to `/api/mesh/ingest` in batches of 100 using a
  gateway token from the web dashboard, retrying with exponential backoff until acknowledged.
- Node IDs are random UUIDs, never hardware addresses; locations can be masked by ±500 m.

The **Volentify Mesh APK** workflow builds and tests the app and publishes `volentify-mesh.apk`
as a GitHub release. The website's `/mesh` page offers it for download from the site's own domain
(`/download/android` streams the latest release with the Android package MIME type). To build locally, open
`mesh-android/` in Android Studio.

## ML pipeline

```bash
cd ml
pip install -r requirements.txt
python -m volentify_ml.train --download     # fetch IBTrACS, evaluate, export to frontend/api/_lib/models
```

The **Train cyclone models** workflow runs this weekly and commits the refreshed models.

## Research archive

Live observations and model outputs are archived to the `research_log` table (created automatically) so results
can be reproduced and analysed:

| Kind | What is recorded | When |
| :-- | :-- | :-- |
| `cap_alert` | Each NDMA SACHET CAP alert (title, text, severity, issuer, time), stored once | Every feed pull, plus every 3 h |
| `forecast` | Input and full output of every `/api/predict` call, with model version | On every forecast |
| `dispatch_run` | Tier counts, completeness, latency, scarcity weights, score distribution | On every dispatch cycle |
| `model_version` | The model card (data span, features, held-out metrics) of each trained model | Once per version |
| `platform_snapshot` | Active incidents, task and volunteer status counts, mesh node and hop counts | Every 3 h |

No personal data is archived (no report text, names, phone numbers or exact volunteer locations).
The **Collect research archive** workflow triggers `/api/research/collect` every 3 hours.
`GET /api/research/summary` shows what has been collected; `GET /api/research/export?kind=…&format=csv|jsonl`
downloads it (incident administrators and researchers).

Model training history is also kept in git: each weekly retrain commits the refreshed model and model card.

## Tests

```bash
cd frontend
npm test          # API acceptance tests
cd ../ml && python -m pytest tests -q   # pipeline tests, incl. tree-evaluator parity with XGBoost
npm run typecheck
```

## Licence

MIT
