# Volleyball Performance Analytics — Setup Guide

## Project structure

```
vpa/
├── backend/          FastAPI (Python)
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py
│   │   ├── db/supabase.py
│   │   ├── routers/   (athletes, dashboard, gymaware, catapult, vald, whoop)
│   │   └── models/schemas.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/         React + Vite + Tailwind + MUI
│   ├── src/
│   │   ├── pages/    (MainDashboard, Gymaware, Catapult, Vald, Whoop)
│   │   ├── components/
│   │   ├── services/api.js
│   │   └── context/DashboardContext.jsx
│   ├── package.json
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml
```

---

## Option A — Run locally (development)

### 1. Backend setup

```bash
cd backend

# Copy env file and fill in your credentials
cp .env.example .env
# Edit .env with your Supabase URL and service key

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start the API
uvicorn app.main:app --reload --port 8000
```

API will be running at: http://localhost:8000
API docs: http://localhost:8000/api/docs

### 2. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

App will be running at: http://localhost:5173

> The Vite dev server proxies /api/* to the FastAPI backend automatically.

---

## Option B — Run with Docker (recommended for demo/deployment)

### 1. Set up environment

```bash
cd backend
cp .env.example .env
# Edit .env — add your Supabase URL and service key
```

### 2. Build and start both containers

```bash
# From the vpa/ root directory
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/api/docs

### 3. Stop containers

```bash
docker-compose down
```

---

## Environment variables (backend/.env)

| Variable | Description |
|---|---|
| SUPABASE_URL | Your Supabase project URL (from Project Settings > API) |
| SUPABASE_SERVICE_KEY | Service role key (not anon key — gives full DB access) |
| SECRET_KEY | Any random string (used for future auth) |
| ALLOWED_ORIGINS | Comma-separated list of allowed frontend origins |

---

## Required Supabase views

These views must exist before the app will return data.
Run the following in Supabase SQL editor in order:

1. `step1_create_tables.sql`
2. `step2_populate_raw_datas.sql`
3. `step3_populate_dashboard_design.sql`
4. `step4_create_dashboard_view.sql` (creates `vw_athlete_dashboard`)
5. `step6_create_gymaware_views.sql` (creates `vw_gymaware_pb` and `vw_session_vs_pb`)
6. `step7_add_calculated_columns.sql` (adds `player_load_per_minute` and `high_jump_count`)

---

## Adding your logo

Place your logo file at `frontend/public/vpa-logo.svg`
It will appear as the browser tab favicon automatically.

To use it in the navbar, update `frontend/src/components/layout/Navbar.jsx`
and replace the `VA` text box with an `<img src="/vpa-logo.svg" />` tag.
