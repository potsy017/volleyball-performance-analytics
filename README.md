# Volleyball Performance Analytics

[![CI](https://github.com/potsy017/volleyball-performance-analytics/actions/workflows/ci-etl.yml/badge.svg)](https://github.com/potsy017/volleyball-performance-analytics/actions/workflows/ci-etl.yml)

**Personal portfolio project** — capstone-built full-stack platform for multi-vendor athlete performance data.

Aggregates GPS (Catapult), recovery (WHOOP), velocity-based strength (GymAware), and force plate (VALD) data through a bronze → silver ETL pipeline into Supabase, surfaced in a React coaching dashboard.

> University capstone (Team 54). Demo uses anonymised/sample data — not a production client deployment.

---

## Live demo

**Deploy your own:** [docs/DEPLOY_DEMO.md](docs/DEPLOY_DEMO.md)

| Platform | Action |
|----------|--------|
| **Render** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/potsy017/volleyball-performance-analytics) |
| **Railway** | Two services from this repo — `backend/` + `frontend/` ([guide](docs/DEPLOY_DEMO.md#option-a-railway-2-services)) |

_Add your hosted URL here after deploy, e.g. **https://your-app.up.railway.app/dashboard**_

---

## Highlights

| Area | What it does |
|------|----------------|
| **Dashboard** | ACWR, readiness RAG, performance radar, injury-risk triad, BMP jump analytics, load–velocity profiling |
| **ETL** | Orchestration (`scheduled_etl.py`), roster identity mapping, medallion schema |
| **WHOOP bridge** | FastAPI OAuth service for per-athlete token linking |
| **Stack** | FastAPI · React 18 · Vite · TanStack Query · Recharts · Supabase Postgres |

---

## Structure

```text
├── backend/          # Dashboard API (FastAPI)
├── frontend/         # React UI
├── etl/              # ETL pipeline + WHOOP OAuth bridge
├── docs/DEPLOY_DEMO.md
└── render.yaml       # Optional one-click Render deploy
```

---

## Run locally

See **[SETUP.md](SETUP.md)**.

```bash
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev
```

Demo without login: `AUTH_ENABLED=false` in `backend/.env`, `VITE_AUTH_DISABLED=true` in `frontend/.env.local`.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/DEPLOY_DEMO.md](docs/DEPLOY_DEMO.md) | **Live demo** — Railway, Render, Docker |
| [SETUP.md](SETUP.md) | Local development |
| [docs/CHARTS.md](docs/CHARTS.md) | Dashboard charts and APIs |
| [etl/docs/design/system_design.md](etl/docs/design/system_design.md) | ETL architecture |

---

## Author

**Sai Ganesh Potukuchi** — [GitHub](https://github.com/potsy017) · integration lead, ETL, silver schema, dashboard analytics.
