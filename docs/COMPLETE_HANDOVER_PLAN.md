# VPIT Complete Handover Plan

**Project:** Volleyball Performance Intelligence Toolkit (VPIT) · Team 54  
**Audience:** Client (Volleyball SA), IT, and successor maintainers  
**Status:** Monorepo consolidated — ETL in `etl/`, dashboard unchanged at `backend/` + `frontend/`.  
**Canonical Git target:** `Volleyball_Performance_Analysis` (this repo)  
**Supabase project:** `tvbavuzjtzyqwmycoxzh`  
**Last updated:** June 2026

---

## 1. Executive summary

VPIT is a **data platform + coach dashboard**:

- **ETL** ingests Catapult, GymAware, WHOOP, and VALD into **Supabase** (bronze → silver).
- **React + FastAPI dashboard** reads silver via a server-side BFF.
- **WHOOP OAuth bridge** is a separate small FastAPI app for per-athlete token linking.

**Handover strategy:** Consolidate everything into the **VPA Git repository** as one monorepo. Retire the separate **Beach Volleyball** and **toolkit** remotes after cutover. Keep **three deploy targets** (dashboard, WHOOP bridge, nightly ETL) — not three Git repos.

---

## 2. Current deployment (today)

| Component | Git source today | Hosting | Notes |
|-----------|------------------|---------|--------|
| **Dashboard API** | `vpa/Volleyball_Performance_Analysis` → `backend/` | **Railway** (VPA repo) | FastAPI; `SUPABASE_SERVICE_KEY` server-side |
| **Dashboard UI** | Same → `frontend/` | **Railway** (with API or static build) | Vite + React |
| **WHOOP Auth Bridge** | `Beach-Volleyball-Data-Analysis-Web-Dashboard` → `etl-toolkit/` | **Railway** (Beach repo, root `etl-toolkit/`) | `uvicorn backend.app:app` — **not** dashboard `backend/` |
| **Nightly ETL** | `Capstone-team54-volleyball-toolkit` | **GitHub Actions** (`daily_etl.yml`) | `scheduled_etl.py --all` |
| **Legacy WHOOP** | — | Render (if still registered) | **Decommission** after Railway bridge verified |

**Important:** Beach `web-dashboard/` is a **stale snapshot** — do not use for production. Live dashboard = VPA `main`.

---

## 3. Target state — VPA monorepo

### 3.1 Why VPA as the Git root

- Dashboard **already** deploys from VPA on Railway.
- WHOOP bridge **already** deploys from Beach as a **subfolder** (`etl-toolkit/`).
- Consolidating into VPA matches production wiring and gives the client **one clone, one remote**.

**Do not** merge the two FastAPI apps into one process. **Do not** put ETL scripts inside dashboard `backend/app/`.

### 3.2 Target folder layout

```text
Volleyball_Performance_Analysis/          # Git root (VPA repo)
├── backend/                              # Dashboard FastAPI  → Railway service: dashboard
├── frontend/                             # React (Vite)       → same service
├── etl/                                  # Data platform      → Railway service: whoop-bridge + ETL source
│   ├── backend/app.py                    # WHOOP OAuth bridge ONLY
│   ├── scheduled_etl.py
│   ├── whoop_etl.py
│   ├── schema/
│   ├── data/roster/roster_new.xlsx
│   ├── integrations/
│   ├── requirements.txt
│   ├── railway.toml                      # WHOOP bridge deploy
│   ├── .env.example
│   └── docs/operations/                  # ETL runbooks (from toolkit)
├── docs/
│   ├── HANDOVER.md                       # Pointer to this plan (in-repo copy)
│   ├── CHARTS.md
│   └── PLANNED_FEATURES.md
└── .github/workflows/
    ├── daily-etl.yml                     # working-directory: etl/
    └── ci-dashboard.yml                  # paths: backend/**, frontend/**
```

**Source of `etl/` content:** Copy from `Capstone-team54-volleyball-toolkit` **`main`** (authoritative). Do **not** use Beach `etl-toolkit/` as source — it may lag toolkit.

### 3.3 Repositories to retire after cutover

| Repository | Action |
|------------|--------|
| `Beach-Volleyball-Data-Analysis-Web-Dashboard` | Archive; WHOOP Railway service repointed to VPA `etl/` |
| `Capstone-team54-volleyball-toolkit` | Archive read-only; content lives in VPA `etl/` |

---

## 4. Railway — two services, one repo

| Service name (suggested) | Root directory | Start command | Health |
|--------------------------|----------------|---------------|--------|
| **vpa-dashboard** | `.` or `backend/` (per current setup) | Dashboard FastAPI + frontend build | `/api/health` |
| **whoop-auth-bridge** | **`etl/`** | `uvicorn backend.app:app --host 0.0.0.0 --port $PORT` | `/health` |

`etl/railway.toml` should match:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn backend.app:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
restartPolicyType = "on_failure"
```

**Never** set the WHOOP service start command to `python scheduled_etl.py` — that exits after one run (cron/Actions only).

---

## 5. WHOOP OAuth: Beach / Render → VPA `etl/` on Railway

Detailed steps also in `etl/docs/operations/deploy-railway-whoop-bridge.md` (after `etl/` merge).

### 5.1 Stand up bridge on VPA repo (parallel run)

1. Railway → WHOOP service → **Connect GitHub** → `Volleyball_Performance_Analysis`.
2. **Settings → Root Directory:** `etl`.
3. Copy env from Beach/Render service:

| Variable | Value |
|----------|--------|
| `WHOOP_CLIENT_ID` | WHOOP Developer app |
| `WHOOP_CLIENT_SECRET` | Same app |
| `DATABASE_URL` | Supabase Postgres URI |
| `WHOOP_REDIRECT_URI` | `https://<new-railway-domain>/callback` — **exact** |

4. Deploy; generate public domain if needed.

### 5.2 WHOOP Developer Dashboard

1. **Add** new Railway callback URI.
2. **Keep** old Beach/Render URI until cutover testing passes.
3. After cutover: remove old URI; delete old Railway/Render service.

### 5.3 Smoke tests

```text
GET  https://<whoop-host>/health
GET  https://<whoop-host>/whoop/oauth-check
```

`oauth-check` → `redirect_uri` must match `WHOOP_REDIRECT_URI`.

Athlete test (`state` ≥ 8 characters):

```text
https://<whoop-host>/whoop/start?state=VB-<gymaware_ref>
```

Confirm row in Supabase `whoop_oauth_token`.

### 5.4 Cutover notes

- **Already-linked athletes:** tokens live in Supabase — **no mass re-login** required.
- Update staff link template to the new Railway host.
- Nightly `whoop_etl.py` (GitHub Actions) unchanged — still uses `WHOOP_CLIENT_*` + `DATABASE_URL`.

---

## 6. GitHub Actions — nightly ETL in VPA repo

Move `daily_etl.yml` from toolkit to VPA `.github/workflows/` with:

```yaml
defaults:
  run:
    working-directory: etl

# Optional: only run when ETL paths change
on:
  push:
    paths:
      - 'etl/**'
      - '.github/workflows/daily-etl.yml'
```

**Secrets** (repository → Settings → Secrets):  
`DATABASE_URL`, `CATAPULT_TOKEN`, `GYMAWARE_ACCOUNT_ID`, `GYMAWARE_TOKEN`, `VALD_CLIENT_ID`, `VALD_CLIENT_SECRET`, `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, plus optional vendor URLs.

Roster: committed at `etl/data/roster/roster_new.xlsx`; workflow env `ROSTER_FILTER=1`, `ROSTER_ALLOWLIST_XLSX=data/roster/roster_new.xlsx`.

---

## 7. Environment files (local & production)

| Location | Purpose | Key variables |
|----------|---------|----------------|
| `etl/.env` | ETL + WHOOP bridge local | `DATABASE_URL`, `CATAPULT_*`, `GYMAWARE_*`, `WHOOP_*`, `VALD_*` |
| `backend/.env` | Dashboard API | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGINS`, `AUTH_ENABLED`, `SUPABASE_JWT_SECRET` |
| `frontend/.env.local` | Dashboard UI (gitignored) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; optional `VITE_AUTH_DISABLED` **local only** |

**Production rules:**

- Never commit `.env` files.
- Frontend deploy: **anon key only** — never service role.
- Remove `VITE_AUTH_DISABLED` and set `AUTH_ENABLED=true` at go-live.

---

## 8. Security handover (post-review / go-live)

| Item | Current (dev) | Target (production) |
|------|---------------|---------------------|
| **RLS** | Not enabled | Coach cohort read; athlete self-read; deny `anon` on sensitive tables |
| **`whoop_oauth_token`** | Service/ETL access | Deny `authenticated` / `anon` SELECT |
| **Dashboard API** | `AUTH_ENABLED=false` locally; routes not JWT-guarded | `require_auth` on `/api/dashboard/*`; user JWT to PostgREST |
| **Auth UX** | Supabase MFA (password → OTP) on `AuthPage.jsx` | Keep; remove local bypass flags |
| **Secrets rotation** | — | Rotate any secret shared outside a vault |

Draft SQL and checklist: `docs/FINAL_PITCH_HANDOVER.md` §4 (in workspace `docs/` until merged into VPA).

---

## 9. Data contract (unchanged by monorepo)

Integration is **Supabase silver views**, not Python imports between `etl/` and `backend/`.

| Join keys | `athlete_internal_key` + `calendar_date` |
|-----------|------------------------------------------|
| Roster source | `etl/data/roster/roster_new.xlsx` → `athlete_identity`, `roster_cohort` |
| Dashboard reads | `silver_catapult_session`, `silver_catapult_jump_session`, `silver_whoop_*`, `silver_gymaware_*` |
| Do not query for KPIs | Raw `*_bi_extract` (duplicate ingests) |

Schema apply order: `etl/schema/apply_order.txt`.

---

## 10. Migration checklist (ordered)

### Phase A — Monorepo structure

- [x] Create `etl/` in VPA from **toolkit `main`** (full copy, not Beach snapshot).
- [x] Add `etl/railway.toml`; verify local `cd etl && uvicorn backend.app:app`.
- [x] Move/adapt `daily-etl.yml` with `working-directory: etl`.
- [x] Merge handover docs into VPA `docs/`; update `README.md`.
- [x] Add `docs/HANDOVER.md` in VPA pointing to this plan.

### Phase B — WHOOP Railway cutover

- [ ] Repoint WHOOP Railway service → VPA repo, root `etl/`.
- [ ] Set `WHOOP_REDIRECT_URI` to new domain; redeploy.
- [ ] Add URI in WHOOP Developer Dashboard; smoke OAuth + Supabase token row.
- [ ] Update athlete link template for staff.
- [ ] Decommission Beach WHOOP service; remove old redirect URI.

### Phase C — ETL & secrets

- [ ] Copy GitHub Actions secrets to VPA repository.
- [ ] Run `workflow_dispatch` on `daily_etl.yml`; confirm JSON summary exit 0.
- [ ] Run `python etl/scripts/preflight_config.py` and `python etl/verify_integrations.py`.

### Phase D — Dashboard (already on Railway)

- [ ] Confirm `GET /api/health` and main flows on production URL.
- [ ] Ship frontend + backend together when API routes change.
- [ ] Remove `VITE_AUTH_DISABLED` from production frontend env.

### Phase E — Security & sign-off

- [ ] Apply RLS migration in Supabase SQL Editor.
- [ ] Enable `AUTH_ENABLED=true`; JWT on dashboard routers.
- [ ] Document credential ownership (WHOOP app, Supabase, Catapult, GymAware, VALD, Railway, GitHub).
- [ ] Archive Beach + toolkit repos; update capstone report URLs.

### Phase F — Optional

- [ ] Power BI executive pack (same silver tables; not primary delivery).
- [ ] VALD silver DDL + UI depth.
- [ ] Readiness vs. Reality / CNS matrix (`docs/PLANNED_FEATURES.md`).

---

## 11. Verification matrix

| ID | Command / action | Pass criteria |
|----|------------------|---------------|
| H1 | `GET /api/health` (dashboard) | `{"status":"ok"}` |
| H2 | `GET /health` (WHOOP bridge) | `{"status":"ok"}` |
| H3 | `python etl/verify_integrations.py` | Catapult + GymAware + VALD OK |
| H4 | `GET /api/athletes` | Non-empty when roster + silver populated |
| H5 | WHOOP OAuth test link | Row in `whoop_oauth_token` |
| H6 | `scheduled_etl.py --all` | Exit 0; new `etl_ingested_at` in bronze |
| H7 | `/readiness`, radar, triad on dashboard | Charts load for selected athlete |

Full manual matrix: `etl/docs/operations/testing_notes.md` (V1–V9, T1–T6).

---

## 12. Two `backend/` folders — do not confuse

| Path | App | Deploy |
|------|-----|--------|
| `backend/app/main.py` | **Dashboard API** — reads silver for coaches | Railway dashboard service |
| `etl/backend/app.py` | **WHOOP OAuth bridge** — athlete token linking | Railway WHOOP service |

Different `requirements.txt`, different env vars, different Railway services.

---

## 13. Documentation index (after merge)

| Topic | Path (in VPA monorepo) |
|-------|-------------------------|
| This handover plan | `docs/COMPLETE_HANDOVER_PLAN.md` or `docs/HANDOVER.md` |
| Chart definitions | `docs/CHARTS.md` |
| ETL first run | `etl/README_HANDOVER.md` |
| WHOOP Railway deploy | `etl/docs/operations/deploy-railway-whoop-bridge.md` |
| Silver contract for UI | `etl/docs/operations/web_app_handover.md` |
| BMP jumps | `etl/docs/volley-etl/catapult_bmp_jumps_handover.md` |
| Capstone report | workspace `docs/VPIT_CAPSTONE_FINAL_REPORT.md` (merge or link) |

---

## 14. Ownership at sign-off

| Asset | Hand to |
|-------|---------|
| VPA GitHub repo (monorepo) | Client / Volleyball SA IT |
| Railway project (dashboard + WHOOP) | Client |
| Supabase project | Client |
| WHOOP Developer app | Client |
| Vendor API credentials (Catapult, GymAware, VALD) | Client |
| GitHub Actions secrets | Client repo admins |
| Roster workbook process | Coaching staff (`etl/data/roster/README.md`) |

---

## 15. Related decisions (record)

| Decision | Rationale |
|----------|-----------|
| **VPA = single Git root** | Dashboard + WHOOP already on Railway from VPA / Beach subfolder |
| **`etl/` sibling folder** | Preserves two FastAPI apps; matches Beach `etl-toolkit/` pattern |
| **Toolkit content in `etl/`** | Toolkit is schema/ETL source of truth; Beach copy retired |
| **Power BI optional** | Primary delivery = React dashboard; silver supports both |
| **RLS at go-live** | Documented; not blocking monorepo migration |

---

*End of handover plan.*
