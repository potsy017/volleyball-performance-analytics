# VPA local development setup

Condensed from the **Volleyball_Performance_Analysis** repository (`README.md`, `SETUP.md`). Use with the same Supabase project as this toolkit’s ETL.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase silver views applied (`schema/apply_order.txt` in this repo)
- At least one successful ETL run (`python scheduled_etl.py --all`)

## Backend

```powershell
cd Volleyball_Performance_Analysis\backend
copy .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_SERVICE_KEY

python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

$env:PYTHONPATH="."
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: http://127.0.0.1:8000  
- Docs: http://127.0.0.1:8000/api/docs  

## Frontend

```powershell
cd Volleyball_Performance_Analysis\frontend
npm install
npm run dev
# Windows if npm.ps1 blocked:
# & "D:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1
```

- App: http://127.0.0.1:5173  
- Dev proxy: `vite.config.js` forwards `/api` → backend port 8000  
- `api.js` uses `VITE_API_URL` in production, else `/api`

## Docker (optional)

From VPA repo root:

```bash
docker-compose up --build
```

Frontend on port 3000 per `SETUP.md` in VPA repo.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Empty athlete list | ETL + `athlete_identity` / roster sync |
| `ECONNRESET` on `/api/*` | Start backend before frontend |
| CORS errors using full backend URL | Use `/api` proxy in dev, not hardcoded `localhost:8000` |
| Pydantic env errors on startup | Use current `app/core/config.py` (`AUTH_ENABLED`, `DATA_SOURCE` optional) |
| GymAware load–velocity 404 | Deploy `backend/app` with `gymaware_load_velocity.py` + router |

See [`vpa_application_updates.md`](vpa_application_updates.md) for feature list and [`vpa_frontend_integration.md`](vpa_frontend_integration.md) for data contract.
