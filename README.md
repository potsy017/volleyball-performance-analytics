# Volleyball Performance Analytics

**Personal portfolio project** — capstone-built full-stack platform for multi-vendor athlete performance data.

Aggregates GPS (Catapult), recovery (WHOOP), velocity-based strength (GymAware), and force plate (VALD) data through a bronze → silver ETL pipeline into Supabase, surfaced in a React coaching dashboard.

> University capstone (Team 54). Not affiliated with any commercial client deployment.

---

## Highlights

| Area | What it does |
|------|----------------|
| **Dashboard** | ACWR, readiness RAG, performance radar, injury-risk triad, BMP jump analytics, load–velocity profiling |
| **ETL** | Nightly-style orchestration (`scheduled_etl.py`), roster identity mapping, medallion schema |
| **WHOOP bridge** | FastAPI OAuth service for per-athlete token linking |
| **Stack** | FastAPI · React 18 · Vite · TanStack Query · Recharts · Supabase Postgres |

---

## Structure

```text
├── backend/          # Dashboard API (FastAPI)
├── frontend/         # React UI
├── etl/              # ETL pipeline + WHOOP OAuth bridge
│   ├── scheduled_etl.py
│   ├── schema/
│   └── integrations/
├── docs/CHARTS.md    # Chart ↔ API reference
└── SETUP.md          # Local development
```

---

## Screenshots

UI: main dashboard, readiness squad view, GymAware load–velocity, Catapult ACWR.  
Architecture: vendor APIs → bronze staging → silver views → FastAPI → React.

---

## Run locally

See **[SETUP.md](SETUP.md)**.

```bash
# Backend (port 8000)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

For quick UI dev without login: `AUTH_ENABLED=false` in `backend/.env` and `VITE_AUTH_DISABLED=true` in `frontend/.env.local`.

ETL: copy `etl/.env.example` → `etl/.env`, fill vendor credentials, then `python scheduled_etl.py --all` from `etl/`.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [SETUP.md](SETUP.md) | Local dev and deploy notes |
| [docs/CHARTS.md](docs/CHARTS.md) | Dashboard charts and API endpoints |
| [etl/docs/design/system_design.md](etl/docs/design/system_design.md) | ETL architecture |
| [PORTFOLIO.md](PORTFOLIO.md) | Private repo setup and cleanup notes |

---

## Author

**Sai Ganesh Potukuchi** — integration lead, ETL, silver schema, dashboard analytics.
