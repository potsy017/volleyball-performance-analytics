# VPA — Volleyball Performance Analytics

A full-stack performance dashboard for coaching staff, built on FastAPI + React. Aggregates GPS (Catapult), recovery (WHOOP), strength (GymAware), and force plate (VALD) data from Supabase **silver** tables into a single live interface.

**ETL, silver DDL, WHOOP OAuth bridge, and nightly pipeline** live in **`etl/`** in this repo (client handover monorepo). Legacy repos (`Capstone-team54-volleyball-toolkit`, Beach bundle) can be archived after Railway/GitHub cutover.

**Handover:** [`docs/HANDOVER.md`](docs/HANDOVER.md) · [`docs/COMPLETE_HANDOVER_PLAN.md`](docs/COMPLETE_HANDOVER_PLAN.md)

**Railway:** dashboard service = repo root (`backend/` + `frontend/`); WHOOP bridge = **root directory `etl/`** (repoint from Beach repo).

---

## Project structure

```
Volleyball_Performance_Analysis/
├── backend/                  # Dashboard FastAPI (coach API)
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py
│   │   ├── db/supabase.py
│   │   ├── gymaware_exercises.py
│   │   ├── gymaware_load_velocity.py
│   │   ├── utils/jump_metrics.py   # BMP daily total + high jump aggregates
│   │   └── routers/
│   │       ├── athletes.py
│   │       ├── dashboard.py   # KPIs, radar, triad, efficiency, daily-jumps
│   │       ├── catapult.py
│   │       ├── gymaware.py
│   │       ├── whoop.py
│   │       └── vald.py
│   ├── requirements.txt
│   └── .env                  # you create this (not committed)
│
├── frontend/                 # Vite + React
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/            MainDashboard, Readiness, Gymaware, Catapult, Whoop, Vald, AthleteReport
│   │   ├── components/charts/   # see docs/CHARTS.md
│   │   ├── components/ui/    StatusBadge, KPICard, …
│   │   └── services/api.js
│   ├── package.json
│   └── vite.config.js        # proxies /api → backend :8000
│
└── etl/                      # ETL + WHOOP bridge (separate Railway service, root dir etl/)
    ├── backend/app.py        # WHOOP OAuth only — not the dashboard backend
    ├── scheduled_etl.py
    ├── schema/
    ├── data/roster/
    └── docs/operations/      # runbooks, README_HANDOVER.md
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase project with silver tables populated (toolkit ETL)

---

## Quick start

See **SETUP.md** for full steps. Summary:

**Backend** (`backend/`):

```bash
cp .env.example .env   # SUPABASE_URL, SUPABASE_SERVICE_KEY
pip install -r requirements.txt
# Windows:
$env:PYTHONPATH="."
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend** (`frontend/`):

```bash
npm install
npm run dev
```

- App: http://127.0.0.1:5173  
- API docs: http://127.0.0.1:8000/api/docs  

Both must run for local dev. Frontend uses `/api` (Vite proxy) unless `VITE_API_URL` is set at build time.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main dashboard — KPIs, team snapshot, metric toggles (load, **total jumps**, high jumps, HRV), dual/triple-axis overlay, ACWR; **athlete:** performance radar, injury-risk triad, efficiency scatter |
| `/readiness` | Team readiness table, expandable per-athlete detail, RAG badges |
| `/gymaware` | Strength sessions, PB, multi-session load–velocity profiles |
| `/catapult` | GPS sessions and load trends (`?athlete=`, `?day=`) |
| `/whoop` | Recovery, HRV, sleep, workouts |
| `/vald` | Force plate tests (when data available) |
| `/report` | Athlete report |

---

## Charts

Full reference (data sources, APIs, troubleshooting): **[docs/CHARTS.md](docs/CHARTS.md)**

Planned capabilities (client roadmap, not shipped): **[docs/PLANNED_FEATURES.md](docs/PLANNED_FEATURES.md)**

**Main dashboard (selected athlete):**

- **Performance radar** — 5/7-axis web vs 30d baseline (BMP volume & intensity, GymAware power, ACWR, optional WHOOP).
- **Triad** — synced ACWR, deep sleep, max jump (or high-band ratio fallback).
- **Efficiency scatter** — Catapult load vs WHOOP strain; needs both on the same day.

**Jump metrics:** Total and high jumps are summed from `silver_catapult_jump_session` (BMP), not legacy IMA-only columns.

**Continuity:** All line/area/radar series use `connectNulls` via `chartDefaults.js`.

---

## Key API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dashboard/kpis` | Period + latest KPIs (incl. BMP total/high jumps) |
| `GET /api/dashboard/summary` | Merged catapult / gymaware / whoop rows for charts |
| `GET /api/dashboard/daily-jumps` | Dense spine: daily `total_jumps` + `high_jump_count` |
| `GET /api/dashboard/team-snapshot` | Team table (load, jumps, ACWR, WHOOP) |
| `GET /api/dashboard/radar-metrics` | Athlete radar inputs (requires `athlete_key`) |
| `GET /api/dashboard/triad-risk` | Injury-risk triad series (requires `athlete_key`) |
| `GET /api/dashboard/efficiency-scatter` | Load vs strain sessions (requires `athlete_key`) |
| `GET /api/catapult/acwr-trend` | ACWR time series |
| `GET /api/gymaware/load-velocity-analysis` | Per-session L–V profiles (25–105 kg) + PB benchmark |

Full list: http://localhost:8000/api/docs

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (server only) |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) |
| `AUTH_ENABLED` | Optional; default `false` until Entra SSO |
| `DATA_SOURCE` | Optional; default `supabase` |

---

## Tech stack

**Backend:** FastAPI · httpx · Pydantic · Uvicorn  

**Frontend:** React 18 · Vite · TanStack Query · Recharts · React Router  

**Data:** Supabase (PostgreSQL + PostgREST)
