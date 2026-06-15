# Volleyball Performance Analytics (VPA)

A full-stack performance dashboard for volleyball coaching staff and athletes. Aggregates GPS (Catapult), recovery (WHOOP), velocity-based strength (GymAware), and force plate (VALD) data from Supabase silver tables into a single live, role-gated web interface.

**Deployed on Railway. Built with FastAPI + React 18 + Supabase.**

**ETL, silver DDL, WHOOP OAuth bridge, and nightly pipeline** live in **`etl/`** in this repo (client handover monorepo).

**Handover:** [`docs/HANDOVER.md`](docs/HANDOVER.md) · [`docs/COMPLETE_HANDOVER_PLAN.md`](docs/COMPLETE_HANDOVER_PLAN.md)

**Railway:** dashboard = `backend/` + `frontend/`; WHOOP bridge = separate service, **root directory `etl/`**.

---

## Quick Links

- Full documentation: `docs/APP_DOCUMENTATION.md`
- Setup guide: `SETUP.md`
- Supabase SQL setup: `SUPABASE_SETUP.sql`
- Vulnerability report: `vpa_vulnerability_report.md`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.111, Python 3.12, Uvicorn |
| Frontend | React 18, Vite, TanStack Query v5, Recharts |
| Auth | Supabase Auth (email + OTP two-factor) |
| Database | Supabase (PostgreSQL + PostgREST) |
| Animation | GSAP (navigation), OGL (Aurora background), Three.js (DarkVeil) |
| Deployment | Railway (Docker, two services) |

---

## Project Structure

```
Volleyball_Performance_Analysis/
├── backend/                  # Dashboard FastAPI (coach API)
├── frontend/                 # React + Vite
├── etl/                      # ETL + WHOOP bridge (Railway service root = etl/)
│   ├── backend/app.py        # WHOOP OAuth only
│   ├── scheduled_etl.py
│   ├── schema/
│   └── data/roster/
├── docs/
├── docker-compose.yml
├── SETUP.md
└── SUPABASE_SETUP.sql
```

---

## Features

**For coaches:**
- Main dashboard with KPI cards, configurable date range, athlete selector
- Performance Radar: 5 or 7-axis polygon scoring each athlete 0-100 vs their 30-day baseline
- The Triad: 3-panel predictive injury risk using ACWR, WHOOP deep sleep, and neuromuscular jump data
- Internal vs External Efficiency: scatter plot of GPS load vs WHOOP strain with Peaking/Fatigued/Neutral classification
- Fully configurable dual/triple-axis chart for overlaying any combination of metrics
- Team snapshot table with per-athlete latest values and CSV export
- GymAware load-velocity profiling with linear regression, V0/L0 intercepts, and multi-session comparison
- Catapult session log with spotlight card, ACWR trend, and activity filter
- WHOOP recovery, HRV, and sleep stage breakdown
- VALD force plate test viewer
- Readiness overview with deep-link from Triad charts
- Printable athlete report

**For athletes:**
- Personal performance summary
- Coach access request with admin email notification

**Authentication:**
- Email + password + OTP two-factor flow
- Password requirements: 6+ chars, 1 uppercase, 1 lowercase, 1 number, 2 special characters
- Role-based routing: coach and athlete views fully separated

---

## Running Locally

See `SETUP.md` for full instructions.

```bash
# Backend
cd backend
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

App: http://localhost:5173
API docs: http://localhost:8000/api/docs

---

## Environment Variables

### Backend
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (never expose publicly) |
| `SUPABASE_JWT_SECRET` | From Supabase Auth settings. Required when AUTH_ENABLED=true |
| `AUTH_ENABLED` | `true` to enforce JWT auth. Default `false` (dev mode only) |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins or `*` |
| `GMAIL_USER` | Gmail address for coach request notifications |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not your account password) |
| `ADMIN_EMAIL` | Recipient of coach request notification emails |

### Frontend
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL with `/api` suffix (e.g. `https://backend.up.railway.app/api`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

---

## Silver Tables Required

| Table | Source |
|-------|--------|
| `silver_catapult_session` | Catapult GPS |
| `silver_catapult_jump_session` | Catapult BMP |
| `silver_whoop_recovery` | WHOOP |
| `silver_whoop_sleep_longest_per_day` | WHOOP |
| `silver_gymaware_summaries` | GymAware |
| `silver_gymaware_bests` | GymAware |
| `silver_vald_*` | VALD |
| `profiles` | VPA (auth roles) |
| `coach_requests` | VPA (access requests) |

---

## Brand Colours

- Green: Pantone 348C / `#00843D`
- Yellow/Gold: Pantone 116C / `#FFCD00`
