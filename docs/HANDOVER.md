# VPIT Handover — VPA monorepo (single Git repo)

This repository is the **client handover root**: coach dashboard + ETL + WHOOP OAuth bridge + documentation.

**Full checklist:** [`COMPLETE_HANDOVER_PLAN.md`](COMPLETE_HANDOVER_PLAN.md)

---

## Repository layout

```text
Volleyball_Performance_Analysis/
├── backend/          # Dashboard FastAPI  → Railway: dashboard service (unchanged)
├── frontend/         # React UI           → same Railway service as dashboard
├── etl/              # Data platform      → Railway: WHOOP bridge (root dir = etl)
│   ├── backend/app.py    # WHOOP OAuth ONLY (not dashboard backend)
│   ├── scheduled_etl.py
│   ├── schema/
│   └── railway.toml
├── docs/             # Handover + chart docs
└── .github/workflows/
    ├── daily-etl.yml     # nightly ETL (working-directory: etl)
    └── ci-etl.yml
```

**Do not confuse** `backend/` (dashboard) with `etl/backend/` (WHOOP bridge).

---

## After consolidation — what you need to do

### 1. Local env files

| File | Copy from |
|------|-----------|
| `etl/.env` | Toolkit or Beach `etl-toolkit/.env` (or Volley root `.env` ETL vars) |
| `backend/.env` | Unchanged — dashboard Supabase service key |
| `frontend/.env.local` | Unchanged |

`etl/.env` is gitignored. Template: `etl/.env.example`.

### 2. GitHub Actions (nightly ETL)

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions → Repository secrets** — add (copy from **toolkit** repo or `etl/.env`):

| Secret | Required |
|--------|----------|
| `DATABASE_URL` | Yes — use **Session pooler** URI for GitHub Actions (not direct `db.*.supabase.co`; see below) |
| `CATAPULT_TOKEN` | Yes |
| `GYMAWARE_ACCOUNT_ID` | Yes |
| `GYMAWARE_TOKEN` | Yes |
| `VALD_CLIENT_ID` | Yes (skip nightly job with repo variable `SCHEDULED_SKIP_VALD=1` until creds renewed) |
| `VALD_CLIENT_SECRET` | Yes (same) |
| `WHOOP_CLIENT_ID` | Yes |
| `WHOOP_CLIENT_SECRET` | Yes |
| `CATAPULT_BASE_URL` | Optional |

3. **Actions → Daily ETL → Run workflow** (manual) to verify.
4. Disable or archive `daily_etl.yml` on the old toolkit repo to avoid double runs.

**If workflow fails immediately with "Missing repository secret"** — secrets are not set on **Volleyball_Performance_Analysis** yet (moving repo does not copy secrets).

**If workflow fails with `Network is unreachable` on `db.*.supabase.co` (IPv6)** — use Supabase **Session pooler** URI for `DATABASE_URL` in GitHub secrets (not direct `db.*.supabase.co`).

**If workflow fails with VALD `401 Unauthorized`** — GitHub secrets cannot be read back after saving; request new API client credentials from VALD (see below). Until then set repository variable **`SCHEDULED_SKIP_VALD`** to `1` (default in workflow) so Catapult/GymAware/WHOOP still run nightly.

**When VALD credentials arrive:** add `VALD_CLIENT_ID` and `VALD_CLIENT_SECRET` secrets, set **`SCHEDULED_SKIP_VALD`** to `0` (or delete the variable), re-run Daily ETL.

**Check ETL locally:**

```bash
cd etl
python scripts/preflight_config.py
python verify_integrations.py
python scheduled_etl.py --all --continue-on-error
```

### 3. WHOOP bridge — repoint Railway from Beach to VPA

**Dashboard Railway service: no change** (still repo root / `backend` + `frontend`).

**WHOOP service only:**

1. Railway → **whoop-auth-bridge** (or equivalent) → **Settings → Source**.
2. Change connected repo to **`Volleyball_Performance_Analysis`** (this repo).
3. Set **Root Directory** to **`etl`**.
4. Confirm start command: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`.
5. Env vars (same values as before): `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `DATABASE_URL`, `WHOOP_REDIRECT_URI`.
6. Deploy.

**If Railway keeps the same public URL** → no WHOOP Developer Dashboard change.  
**If the URL changes** → update WHOOP app Redirect URI and `WHOOP_REDIRECT_URI` to `https://<host>/callback`.

**Smoke tests:**

```text
GET https://<whoop-host>/health
GET https://<whoop-host>/whoop/oauth-check
```

Test link: `https://<whoop-host>/whoop/start?state=VB-test12345`

7. After success → delete Beach repo WHOOP Railway service (optional archive repo).

### 4. WHOOP redirect URIs (reference)

| Stage | Callback URI |
|-------|----------------|
| Legacy Render | `https://volley-54.onrender.com/callback` — remove after cutover |
| Railway (toolkit hostname) | `https://capstone-team54-volleyball-toolkit-production.up.railway.app/callback` |
| Railway after VPA repoint | **Same hostname if service unchanged**, or new `*.up.railway.app` — check Networking tab |

### 5. Supabase, Catapult, GymAware, VALD

**No change** — same project, same silver views. Dashboard still uses `backend/.env` `SUPABASE_SERVICE_KEY`.

### 6. Power BI, client docs

See `COMPLETE_HANDOVER_PLAN.md` § assets transfer.

---

## Should daily operations change?

| Area | Changes? |
|------|----------|
| Coach dashboard URL | **No** — same Railway dashboard service |
| Login / Supabase MFA | **No** |
| Silver data / charts | **No** |
| Nightly ETL | **Where it runs** moves to this repo’s GitHub Action; **what it does** is identical |
| WHOOP athlete links | **Only if** WHOOP Railway hostname changes — update link template |
| Already-linked WHOOP athletes | **No** re-login — tokens in Supabase |
| Local dev dashboard | **No** — still `backend/` + `frontend/` per `SETUP.md` |
| Local dev ETL | Run from **`etl/`** instead of separate toolkit clone |

---

## Documentation map

| Topic | Path |
|-------|------|
| ETL first run | `etl/README_HANDOVER.md` |
| WHOOP Railway deploy | `etl/docs/operations/deploy-railway-whoop-bridge.md` |
| Silver contract | `etl/docs/operations/web_app_handover.md` |
| Charts | `docs/CHARTS.md` |
| Capstone report | `docs/VPIT_CAPSTONE_FINAL_REPORT.md` |

---

*Consolidated June 2026 — archive `Capstone-team54-volleyball-toolkit` and `Beach-Volleyball-Data-Analysis-Web-Dashboard` after cutover.*
