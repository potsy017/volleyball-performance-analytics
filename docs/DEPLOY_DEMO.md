# Live demo deployment

Host the **dashboard only** (FastAPI + React). The ETL pipeline (`etl/`) is optional and not required for visitors to explore charts.

**Recommended:** [Railway](#option-a-railway-2-services) or [Render](#option-b-render-blueprint) free tier.

---

## Before you deploy

1. **Supabase** — use a project with silver views populated (your capstone DB or a copy with **synthetic / anonymised** athlete names).
2. **Rotate keys** if this project ever held client/production data.
3. **Demo mode** (no login wall):
   - Backend: `AUTH_ENABLED=false`
   - Frontend: `VITE_AUTH_DISABLED=true`
4. Never commit `.env` files.

---

## Option A: Railway (2 services)

### 1. API service

1. [Railway](https://railway.com) → **New Project** → **Deploy from GitHub** → `potsy017/volleyball-performance-analytics`
2. Service settings → **Root Directory:** `backend`
3. **Variables:**

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service role key (server only) |
| `AUTH_ENABLED` | `false` |
| `ALLOWED_ORIGINS` | `*` (demo) or your frontend URL |

4. **Networking** → Generate domain → note `https://<api-host>`
5. Confirm: `GET https://<api-host>/api/health` → `{"status":"ok"}`

`backend/railway.toml` sets Docker build + `/api/health` check.

### 2. Web service

1. Same project → **+ New** → **GitHub Repo** → same repository
2. **Root Directory:** `frontend`
3. **Variables** (required **before** first build — Vite bakes these in):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://<api-host>/api` |
| `VITE_SUPABASE_URL` | same as backend |
| `VITE_SUPABASE_ANON_KEY` | anon/public key |
| `VITE_AUTH_DISABLED` | `true` |

4. Generate public domain → open in browser → `/dashboard`

### 3. Update README demo link

After deploy, add your frontend URL to the **Live demo** line in `README.md`.

---

## Option B: Render blueprint

1. Open:  
   **https://render.com/deploy?repo=https://github.com/potsy017/volleyball-performance-analytics**
2. Connect GitHub and create **Blueprint** from root `render.yaml`
3. When prompted, set:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` on **vpa-api**
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` on **vpa-web**
4. After **vpa-api** is live, set on **vpa-web**:  
   `VITE_API_URL=https://<vpa-api-host>.onrender.com/api`  
   then **Manual Deploy** (rebuild) on vpa-web.

`VITE_AUTH_DISABLED=true` is preset in `render.yaml`.

---

## Option C: Local Docker

```bash
cp backend/.env.example backend/.env   # fill Supabase keys
docker compose up --build
```

- Frontend: http://localhost:3000  
- API: http://localhost:8000/api/docs  

For local UI without login, also add `frontend/.env.local` with `VITE_AUTH_DISABLED=true`.

---

## Security notes (public demo)

| Setting | Why |
|---------|-----|
| `AUTH_ENABLED=false` | API is open to anyone who has the URL — OK only for demo/sanitised data |
| Service role on backend | Stays server-side; never put it in `VITE_*` vars |
| `ALLOWED_ORIGINS=*` | Simplest CORS for demo; tighten for production |
| Athlete PII | Use blurred names or synthetic roster in Supabase |

For a production-style demo, enable Supabase Auth + `AUTH_ENABLED=true` and remove `VITE_AUTH_DISABLED`.

---

## What not to deploy publicly

- `etl/.env` vendor tokens (Catapult, VALD, WHOOP, …)
- Nightly ETL against live vendor APIs unless you own the credentials
- Roster `.xlsx` files (gitignored — keep local)

ETL docs remain in-repo for code review; visitors only need the dashboard services above.
