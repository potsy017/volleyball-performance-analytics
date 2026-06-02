# VPA — Volleyball Performance Analytics

A full-stack performance dashboard for coaching staff, built on FastAPI + React. Aggregates GPS (Catapult), recovery (WHOOP), strength (GymAware), and force plate (VALD) data from Supabase **silver** tables into a single live interface.

**ETL and silver DDL** live in the capstone toolkit repo: `Capstone-team54-volleyball-toolkit` — see `docs/operations/web_app_handover.md` and `docs/operations/vpa_application_updates.md` there.

---

## Project structure

```
Volleyball_Performance_Analysis/
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py
│   │   ├── db/supabase.py
│   │   ├── gymaware_exercises.py
│   │   ├── gymaware_load_velocity.py
│   │   └── routers/
│   │       ├── athletes.py
│   │       ├── dashboard.py
│   │       ├── catapult.py
│   │       ├── gymaware.py
│   │       ├── whoop.py
│   │       └── vald.py
│   ├── requirements.txt
│   └── .env                  # you create this (not committed)
│
└── frontend/                 # Vite + React
    ├── src/
    │   ├── App.jsx
    │   ├── pages/            MainDashboard, Readiness, Gymaware, Catapult, Whoop, Vald, AthleteReport
    │   ├── components/charts/
    │   ├── components/ui/    StatusBadge, KPICard, …
    │   └── services/api.js
    ├── package.json
    └── vite.config.js        # proxies /api → backend :8000
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
| `/` | Main dashboard — KPIs, team snapshot, 3-axis trends, ACWR, daily jumps |
| `/readiness` | Team readiness table, expandable per-athlete detail, RAG badges |
| `/gymaware` | Strength sessions, PB, multi-session load–velocity profiles |
| `/catapult` | GPS sessions and load trends (`?athlete=`, `?day=`) |
| `/whoop` | Recovery, HRV, sleep, workouts |
| `/vald` | Force plate tests (when data available) |
| `/report` | Athlete report |

---

## Key API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dashboard/team-snapshot` | Team overview |
| `GET /api/gymaware/load-velocity-analysis` | Per-session L–V profiles (25–105 kg) + PB benchmark |
| `GET /api/catapult/acwr-trend` | ACWR time series |

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
