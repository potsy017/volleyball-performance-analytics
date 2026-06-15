# VPA Setup Guide

This guide covers local development, Docker, and Railway deployment.

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Python | 3.12 |
| Node.js | 18 |
| npm | 9 |
| Docker | 24 (optional, for containerised run) |
| Supabase project | With silver tables populated |

---

## Option A: Local Development

### 1. Clone and navigate

```bash
git clone <your-repo-url>
cd vpa
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
```

Edit `backend/.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
AUTH_ENABLED=false
SUPABASE_JWT_SECRET=
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
GMAIL_USER=
GMAIL_APP_PASSWORD=
ADMIN_EMAIL=
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

API available at: http://localhost:8000
Interactive docs: http://localhost:8000/api/docs

### 3. Frontend

```bash
cd frontend

# Install dependencies (including gsap)
npm install

# Create environment file
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Start the frontend:

```bash
npm run dev
```

App available at: http://localhost:5173

The Vite dev server proxies all `/api/*` requests to the backend automatically.

---

## Option B: Docker Compose

```bash
cd vpa

# Set up backend env
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Build and start both containers
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/api/docs

Stop:
```bash
docker-compose down
```

---

## Option C: Railway Deployment

### Backend service (dashboard)

1. Create a Railway service pointing to this git repo.
2. Set the root directory to `backend` (or configure the Dockerfile path).
3. Add these environment variables in Railway:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
AUTH_ENABLED=true
ALLOWED_ORIGINS=https://your-frontend.up.railway.app,http://localhost:3000,http://localhost:5173
PORT=8080
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

4. Deploy. The service listens on port 8080.

### Frontend service

1. Create a second Railway service from the same repo.
2. Set the root directory to `vpa/frontend`.
3. Add these environment variables:

```
VITE_API_URL=https://your-backend.up.railway.app/api
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
PORT=80
```

4. Deploy. The service serves the built React app via nginx on port 80.

### WHOOP Auth Bridge service (third Railway service)

1. Create a third Railway service from the same repo (or repoint the existing Beach WHOOP service).
2. Set the **root directory** to **`etl`**.
3. Start command: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
4. Environment variables: `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `DATABASE_URL`, `WHOOP_REDIRECT_URI` (`https://<whoop-host>/callback`).
5. See `etl/docs/operations/deploy-railway-whoop-bridge.md` and `docs/HANDOVER.md`.

Nightly ETL runs via **GitHub Actions** (`.github/workflows/daily-etl.yml`), not on Railway.

### Important: Supabase URL configuration

After deploying to Railway, update these settings in Supabase:

Go to Supabase dashboard: Authentication > URL Configuration

- **Site URL:** `https://your-frontend.up.railway.app`
- **Redirect URLs:** Add `https://your-frontend.up.railway.app/**`

This ensures OTP emails and magic links redirect to your hosted app.

---

## Supabase Setup

### Required tables

Run `SUPABASE_SETUP.sql` in the Supabase SQL editor to create the required tables.

The following silver tables must be populated by your data pipeline before the app returns data:

| Table | Purpose |
|-------|---------|
| `silver_catapult_session` | GPS session metrics |
| `silver_catapult_jump_session` | BMP jump event data |
| `silver_whoop_recovery` | Daily recovery and HRV |
| `silver_whoop_sleep_longest_per_day` | Daily sleep breakdown |
| `silver_gymaware_summaries` | Per-set velocity data |
| `silver_gymaware_bests` | Personal bests per exercise/load |
| `profiles` | User roles (coach / athlete) |
| `coach_requests` | Coach access request queue |

### Auth setup

1. In Supabase: Authentication > Providers > Email, enable "Email OTP".
2. Disable "Confirm email" if using the two-factor OTP-after-password flow.
3. Copy the JWT secret from Supabase: Project Settings > API > JWT Settings > JWT Secret. Add it as `SUPABASE_JWT_SECRET` in Railway backend vars.

### Adding a coach user manually

After a user signs up (they will be `athlete` by default):

1. Go to Supabase: Table Editor > `profiles`
2. Find the row for the user's email
3. Set `role = 'coach'`
4. The user will have full coach access on their next sign-in

---

## Verifying the Deployment

```bash
# Health check
curl https://your-backend.up.railway.app/api/health
# Expected: {"status":"ok","service":"VPA API"}

# Data check (should return athlete list if data exists)
curl https://your-backend.up.railway.app/api/athletes/
```

---

## Local Development Tips

- The Vite dev server auto-reloads on file changes in `frontend/src/`
- The FastAPI backend auto-reloads on file changes when started with `--reload`
- TanStack Query caches API responses for 2 minutes. Hard-reload (Ctrl+Shift+R) or clear cache via browser DevTools if you need fresh data immediately
- API docs at http://localhost:8000/api/docs provide a live sandbox for testing all endpoints
