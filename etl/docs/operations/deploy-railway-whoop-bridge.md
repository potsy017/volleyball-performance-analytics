# Deploy WHOOP Auth Bridge on Railway

Deploy **`etl/backend/app.py`** from this repository (**VPA monorepo**).  
The coach dashboard (`backend/` + `frontend/` at repo root) is a **separate** Railway service.

## Prerequisites

- Railway collaborator access (or project admin)
- WHOOP Developer app access (Client ID + secret)
- Supabase `DATABASE_URL` (same project as ETL)
- `etl/schema/whoop_oauth_tokens.sql` applied in Supabase

## 1. Create the service

1. Open the Railway project (or **New Project** → **Deploy from GitHub**).
2. **+ New** → **GitHub Repo** → select **`Volleyball_Performance_Analysis`** (this repo).
3. Service name: `whoop-auth-bridge` (or keep existing service when repointing from Beach).
4. **Root directory:** **`etl`** (required — contains `requirements.txt`, `backend/app.py`, `railway.toml`).
5. Railway reads `etl/railway.toml` for start command and `/health` check.

First deploy may fail until env vars are set — that is normal.

**Do not** use Railway’s suggestion to run `python scheduled_etl.py --all` on this service. That is the **batch ETL** entrypoint (runs once and exits). This service must run the **WHOOP OAuth web app**:

```text
uvicorn backend.app:app --host 0.0.0.0 --port $PORT
```

If root directory is **`etl`** (this monorepo), `etl/railway.toml` sets the start command automatically after push.

**Do not** point this service at the repo root — that deploys the **dashboard** `backend/`, not the WHOOP bridge.

## 2. Generate a public URL

1. Service → **Settings** → **Networking** → **Generate Domain** (or use a custom domain).
2. Note the hostname, e.g. `whoop-auth-bridge-production.up.railway.app`.

## 3. Environment variables

Service → **Variables**:

| Variable | Value |
|----------|--------|
| `WHOOP_CLIENT_ID` | From WHOOP Developer Dashboard |
| `WHOOP_CLIENT_SECRET` | Same app |
| `DATABASE_URL` | Supabase Postgres URI (pooler + SSL if you use that on Render today) |
| `WHOOP_REDIRECT_URI` | `https://<your-railway-domain>/callback` — **exact** |

Optional: `WHOOP_SCOPES` — only if overriding defaults (must include `offline`).

**Do not** commit these to git. Copy from Render env or local `.env` in the toolkit folder.

Redeploy after changing `WHOOP_REDIRECT_URI`.

## 4. WHOOP Developer Dashboard

1. Open your WHOOP app → **Redirect URIs**.
2. **Add:** `https://<your-railway-domain>/callback`
3. Keep the old Render URI until cutover testing is done, then remove it.

## 5. Smoke tests

Replace `<host>` with your Railway domain:

```text
GET  https://<host>/health
GET  https://<host>/whoop/oauth-check
```

`oauth-check` → `redirect_uri` must match `WHOOP_REDIRECT_URI`.

Athlete test (state ≥ 8 characters):

```text
https://<host>/whoop/start?state=VB-test12345
```

Confirm a row in Supabase `whoop_oauth_token`.

## 6. Cutover from Render

1. Run Railway in parallel with Render for a few days.
2. Update staff athlete link template:
   ```text
   https://<host>/whoop/start?state=<athlete_internal_key>
   ```
3. Already-linked athletes: **no re-login** required (tokens in Supabase).
4. Remove Render redirect URI from WHOOP app → delete Render service.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `redirect_uri_mismatch` | `WHOOP_REDIRECT_URI` and WHOOP dashboard URI must match exactly (`https`, no trailing slash unless registered). |
| `invalid_client` | Wrong secret or Client ID for this WHOOP app; re-copy from dashboard. |
| 502 on `/callback` | `DATABASE_URL` wrong or `whoop_oauth_token` table missing. |
| Build uses wrong app | Service **root directory** must be **`etl`**, not repo root (dashboard). |

## Related

- Render equivalent: [deploy-render-whoop-bridge.md](./deploy-render-whoop-bridge.md)
- Related: [`../PORTFOLIO.md`](../PORTFOLIO.md)
