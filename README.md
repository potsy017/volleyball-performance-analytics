# VPA — Volleyball Performance Analytics

A full-stack performance dashboard for coaching staff, built on FastAPI + React. Aggregates GPS (Catapult), recovery (WHOOP), strength (Gymaware), and force plate (VALD) data from Supabase silver tables into a single live interface.

---

## Project Structure

```
vpa/
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── main.py           # App entry point, CORS, router registration
│   │   ├── config.py         # Pydantic settings (reads .env)
│   │   ├── db/
│   │   │   └── supabase.py   # httpx-based Supabase REST client
│   │   └── routers/
│   │       ├── athletes.py
│   │       ├── dashboard.py
│   │       ├── catapult.py
│   │       ├── gymaware.py
│   │       ├── whoop.py
│   │       └── vald.py
│   ├── requirements.txt
│   └── .env                  # ← you create this (not committed)
│
└── frontend/                 # Vite + React app
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── context/
    │   │   └── DashboardContext.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── pages/
    │   │   ├── MainDashboard.jsx
    │   │   ├── Catapult.jsx
    │   │   ├── Gymaware.jsx
    │   │   ├── Whoop.jsx
    │   │   └── Vald.jsx
    │   └── components/
    │       ├── ErrorBoundary.jsx
    │       ├── layout/
    │       │   └── Navbar.jsx
    │       ├── charts/
    │       │   ├── ComboChart.jsx
    │       │   └── TrendLineChart.jsx
    │       └── ui/
    │           ├── DarkVeil.jsx
    │           ├── KPICard.jsx
    │           ├── PageHeader.jsx
    │           └── LoadingSpinner.jsx
    ├── package.json
    └── vite.config.js
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Supabase project with the silver tables populated

---

## Backend Setup

1. **Create the `.env` file** inside `vpa/backend/`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Use the **service role (secret) key** from your Supabase dashboard under Project Settings → API. Do not use the anon/public key.

2. **Install dependencies and run:**

```bash
cd vpa/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/api/docs`

---

## Frontend Setup

```bash
cd vpa/frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

The frontend proxies all `/api` requests to the backend via the Vite config, so both must be running simultaneously.

---

## Supabase Silver Tables

The backend reads directly from these tables via the PostgREST REST API:

| Table | Key columns |
|---|---|
| `silver_catapult_session` | `athlete_internal_key`, `calendar_date`, `total_player_load`, `player_load_per_minute`, `high_jump_count_ima_bands_6_8`, `total_distance`, `field_time` |
| `silver_whoop_recovery` | `athlete_internal_key`, `calendar_date`, `hrv_rmssd_milli`, `resting_heart_rate`, `recovery_score`, `cycle_strain`, `score_state` |
| `silver_whoop_sleep` | `athlete_internal_key`, `calendar_date`, `sleep_performance_percentage`, `sleep_efficiency_percentage`, `total_rem_sleep_time_milli`, `total_slow_wave_sleep_time_milli` |
| `silver_gymaware_summaries` | `athlete_internal_key`, `calendar_date`, `exercise_name`, `bar_weight`, `mean_velocity`, `peak_velocity` |
| `silver_gymaware_bests` | `athlete_internal_key`, `exercise_name`, `bar_weight`, `mean_velocity`, `peak_velocity` |

All tables use `athlete_internal_key` (text, e.g. `VB-5406785896`) as the athlete identifier, and `athlete_display_name` for display.

---

## Pages

| Route | Description |
|---|---|
| `/` | Main dashboard — KPI cards, training load, HRV, high jump & velocity charts. Athlete selector + Latest / Avg toggle |
| `/catapult` | GPS session log, player load combo chart, high jump & distance trends |
| `/gymaware` | Strength session vs PB table, velocity trend, personal best records |
| `/whoop` | Recovery scores, HRV trend, sleep breakdown |
| `/vald` | Force plate test results |

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role secret key (never expose publicly) |

---

## Tech Stack

**Backend:** FastAPI · httpx · Pydantic · Uvicorn

**Frontend:** React 18 · Vite · TanStack Query · Recharts · React Router · OGL (WebGL background)

**Data:** Supabase (PostgreSQL + PostgREST)
