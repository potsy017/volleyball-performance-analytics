# Volleyball Performance Analytics

[![CI](https://github.com/potsy017/volleyball-performance-analytics/actions/workflows/ci-etl.yml/badge.svg)](https://github.com/potsy017/volleyball-performance-analytics/actions/workflows/ci-etl.yml)

**Public portfolio (source only)** — capstone full-stack platform for multi-vendor athlete performance data.

Bronze → silver ETL (Catapult, GymAware, WHOOP, VALD) into Postgres, with a React coaching dashboard (ACWR, readiness RAG, performance radar, injury-risk triad, BMP jumps, load–velocity).

> No live demo is hosted. Review the code and docs below, or run locally with your own database ([guide](docs/SHOWCASE.md)).

---

## Highlights

| Area | What it does |
|------|----------------|
| **Dashboard** | ACWR, readiness RAG, radar, triad risk, BMP jump analytics, load–velocity |
| **ETL** | `scheduled_etl.py`, roster identity mapping, medallion schema |
| **WHOOP bridge** | FastAPI OAuth app (`etl/backend/app.py`) |
| **Stack** | FastAPI · React 18 · Vite · TanStack Query · Recharts · Postgres (Supabase-compatible) |

---

## Structure

```text
├── backend/          # Dashboard API
├── frontend/         # React UI
├── etl/              # ETL + WHOOP bridge + schema SQL
├── docs/CHARTS.md    # Chart ↔ API reference
└── docs/SHOWCASE.md  # How to present this repo (no hosted demo)
```

---

## For reviewers

| Start here | Why |
|------------|-----|
| [docs/SHOWCASE.md](docs/SHOWCASE.md) | Portfolio intent, what to read, shutdown notes |
| [docs/CHARTS.md](docs/CHARTS.md) | Dashboard features mapped to code |
| [etl/docs/design/system_design.md](etl/docs/design/system_design.md) | Pipeline architecture |
| [SETUP.md](SETUP.md) | Optional local run (Docker or dev servers) |

---

## Optional local run

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

Requires your own `.env` files and a database with silver views — see `backend/.env.example` and [SETUP.md](SETUP.md).

---

## Author

**Sai Ganesh Potukuchi** — [GitHub](https://github.com/potsy017)
