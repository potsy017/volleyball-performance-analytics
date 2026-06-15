# VPA application updates (Volleyball Performance Analysis)

Snapshot of the **VPA** web app (`Volleyball_Performance_Analysis` / `vpa/` on GitHub) as implemented locally. This toolkit repo owns **ETL + silver DDL**; VPA owns **FastAPI + React**. Silver tables remain the integration contract.

**Last synced from local workspace:** June 2026  
**Merge status:** Features below were developed locally; confirm what is on `main` before viva/demo.  
**VPA repo push policy:** Toolkit team updates **this toolkit repo only** unless explicitly asked to push `vpa/` — coordinate with frontend lead for VPA GitHub merges.

---

## Repository layout (VPA)

```
Volleyball_Performance_Analysis/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py
│   │   ├── db/supabase.py
│   │   ├── routers/          athletes, dashboard, gymaware, catapult, vald, whoop
│   │   ├── gymaware_exercises.py      # exercise alias merge (trap bar variants)
│   │   └── gymaware_load_velocity.py  # Lmax/Vmax, standard loads 25–105 kg
│   ├── requirements.txt
│   └── .env                    # not committed — see Environment
├── frontend/
│   ├── src/
│   ├── vite.config.js          # proxies /api → localhost:8000
│   └── package.json
├── README.md
└── SETUP.md
```

---

## Routes and pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Main dashboard | KPIs (incl. BMP **total** + high jumps), team snapshot, metric toggles, daily jump charts, dual/triple-axis overlay; **athlete:** performance radar, injury-risk triad, efficiency scatter; date presets (28d / 1m / 3m / 6m) |
| `/readiness` | **Readiness** (new) | One row per athlete; expandable accordion; lazy-loaded detail (GymAware / Catapult / WHOOP); 7-day activity blocks |
| `/gymaware` | GymAware | Sessions vs PB, velocity trend, **multi-session load–velocity profiles** + Lmax/Vmax progress |
| `/catapult` | Catapult | Session log, load combo chart, trends; supports `?athlete=` and `?day=YYYY-MM-DD` |
| `/whoop` | WHOOP | Recovery, HRV, sleep, workouts; `?day=` filter; recovery badges |
| `/vald` | VALD | Force plate tests (when silver/staging data exists) |
| `/report` | Athlete report | Printable/summary style report |

---

## New / updated features (June 2026 local work)

### Readiness tab (`/readiness`)

- Master columns: Player, Status (RAG), Readiness score, ACWR, 7-day session count, recent jumps/load, WHOOP summary, GymAware core metric.
- Badges: `StatusBadge` — Red / Yellow / Green; neutral **Insufficient Data**, **Awaiting Sync**, **No Device**.
- RAG rules: with WHOOP → ACWR + recovery thresholds; without WHOOP → ACWR-only; insufficient inputs → neutral (not colored RAG).
- Session count = distinct dates in last 7 days across Catapult + GymAware (union).
- Expand row → lazy fetch per-athlete detail; links **Open GymAware / Catapult / WHOOP** with `?athlete=…&day=YYYY-MM-DD`.
- Freshness labels on stale data: `Today`, `Yesterday`, `Latest (Xd ago)` (uses last available session, not only yesterday).
- **No dedicated backend readiness endpoint** — aggregates existing APIs client-side (future: single `GET /readiness/summary`).

### GymAware load–velocity

- **API:** `GET /api/gymaware/load-velocity-analysis?athlete_key=&exercise=&days=`
  - Returns `session_profiles`, `pb_benchmark`, `lmax_vmax_trend`, `standard_loads_kg` (25–105).
  - Requires ≥2 distinct loads per session; uses `silver_gymaware_summaries` + `silver_gymaware_bests`.
- **Exercise aliases:** `Deadlift (Trap Bar - Conc Jump)` and `Deadlift (Trap Bar - CountJump)` → canonical `Deadlift (Trap Bar - Count Jump)`.
- **UI:** `LoadVelocityMultiProfileChart` (dashed line per session, observed dots, PB stars), `LoadVelocityProgressChart`, toggles for session limit, extrapolate 25–105 kg, show PB benchmark.

### Catapult BMP jump events (Beach VB script)

**Toolkit ETL (documented in [`catapult_bmp_jumps_handover.md`](../volley-etl/catapult_bmp_jumps_handover.md)):**

- **ETL:** `catapult_jump_events.py` → `upload_catapult_jump_events_to_supabase.py` (inside `scheduled_etl.py --sources catapult`).
- **API:** `GET .../events?event_types=basketball`; `jump_attribute` in **centiseconds**.
- **High jumps:** `jump_attribute >= 57` (0.57 s ≈ 40 cm).
- **Silver (two tables):**
  - `silver_catapult_session` — stats + **left-joined** BMP when grain matches (load, distance, jumps on one row).
  - `silver_catapult_jump_session` — full deduped BMP history for peaks / daily jump charts.
- **Distance:** `total_distance` on stats silver; auto-backfill from staging JSON on each `upload_to_supabase.py` run.

**VPA (local workspace — verify on GitHub `main` before demo):**

| Feature | API / table |
|---------|-------------|
| Session log BMP columns | `silver_catapult_session` |
| Peak jump KPI / team board | `GET /api/catapult/jump-peaks` → **`silver_catapult_jump_session`** |
| Daily high jumps on load chart | `GET /catapult/load-trend` merges jump silver (local backend) |
| **Daily total jumps** (dashboard + KPIs) | `GET /dashboard/daily-jumps`, `jump_metrics.py` → `jump_event_count` on `silver_catapult_jump_session` |
| `total_distance` in session table | `silver_catapult_session` |

**Schema (Supabase):** `catapult_jump_events.sql` → jersey/internal_key migrations → `silver_catapult_jump_session.sql` → `silver_catapult_session.sql`.

### Main dashboard (June 2026 — athlete analytics charts)

**Docs:** VPA repo `docs/CHARTS.md` (full chart/API reference).

| Chart | Endpoint | Silver / logic |
|-------|----------|----------------|
| **Performance radar** | `GET /dashboard/radar-metrics` | 5- or 7-axis; Volume = BMP daily total jumps vs 30d max; Intensity = high jumps; Power = GymAware; ACWR safety band; optional WHOOP recovery/sleep |
| **Triad (injury risk)** | `GET /dashboard/triad-risk` | ACWR (Catapult load); deep sleep hours (`silver_whoop_sleep_longest_per_day`); max jump height vs 30d ceiling or high-band ratio fallback (`silver_catapult_jump_session`) |
| **Efficiency scatter** | `GET /dashboard/efficiency-scatter` | Catapult `total_player_load` vs WHOOP `cycle_strain` per session; 30d trendline; highlights last 3 days — **needs WHOOP + Catapult same day** |
| **Daily total / high jumps** | `GET /dashboard/daily-jumps` | Dense date spine from BMP aggregates |
| **Dual/triple-axis overlay** | summary + `acwr-trend` + whoop sleep | Includes **Total Jumps** metric; `connectNulls` on all line/area series (`chartDefaults.js`) |

- Third Y-axis on `DualAxisChart` (Left / Right A / Right B metric selectors).
- Shared `StatusBadge` / `acwrBadge` / `recoveryBadge` on team snapshot table (incl. `total_jumps` column).
- KPIs: `latest_total_jumps`, `avg_total_jumps`, BMP-backed high jump fields.

### Deep linking

- Catapult, GymAware, Whoop read URL params `athlete` (internal key) and `day` (ISO date) to filter tables.

### Local dev fixes

- `frontend/src/services/api.js`: `baseURL` = `VITE_API_URL` or `/api` (Vite proxy).
- `backend/app/core/config.py`: accepts `AUTH_ENABLED`, `DATA_SOURCE`, optional warehouse settings (`extra="ignore"` on other vars).
- Windows: use `npm.cmd run dev` if PowerShell blocks `npm.ps1`.

---

## API surface (VPA FastAPI, prefix `/api`)

| Router | Endpoints (representative) |
|--------|----------------------------|
| `athletes` | `GET /athletes/`, `GET /athletes/sources/{athlete_key}` |
| `dashboard` | `GET /dashboard/kpis`, `/summary`, `/team-snapshot`, **`/daily-jumps`**, **`/radar-metrics`**, **`/triad-risk`**, **`/efficiency-scatter`** |
| `catapult` | `GET /catapult/sessions`, `/activities`, `/load-trend`, `/workload-chart`, **`/jump-peaks`** |
| `gymaware` | `GET /gymaware/sessions`, `/reps`, `/exercises`, `/pb`, `/session-vs-pb`, `/vl-profile`, **`/load-velocity-analysis`**, `/velocity-trend` |
| `whoop` | `GET /whoop/recovery`, `/hrv-trend`, `/sleep`, `/workout` |
| `vald` | `GET /vald/tests`, `/test-types`, `/summary` |

Interactive docs: `http://localhost:8000/api/docs`

---

## Silver tables consumed

Same contract as [`web_app_handover.md`](web_app_handover.md). Readiness additionally calls:

| Table / endpoint | Readiness usage |
|------------------|-----------------|
| `GET /dashboard/team-snapshot` | Master table ACWR / load hints |
| `GET /catapult/sessions`, `GET /gymaware/sessions` | 7-day activity, recent load/jumps |
| `GET /whoop/recovery`, `GET /whoop/workout` | Recovery summary |

Do **not** query raw `*_bi_extract` from the UI.

---

## Environment (VPA `backend/.env`)

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` | Yes | Same project as ETL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role — server only |
| `SECRET_KEY` | Optional | Default placeholder |
| `ALLOWED_ORIGINS` | Optional | CORS for frontend origins |
| `AUTH_ENABLED` | Optional | Default `false` until Entra handover |
| `DATA_SOURCE` | Optional | Default `supabase` |

---

## Run locally (full stack)

1. Apply toolkit `schema/apply_order.txt` + run ETL (`python scheduled_etl.py --all`).
2. Backend (from `Volleyball_Performance_Analysis/backend`):

   ```powershell
   $env:PYTHONPATH="."
   .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. Frontend (from `frontend/`):

   ```powershell
   & "D:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1
   ```

4. Open `http://127.0.0.1:5173` — API health: `http://127.0.0.1:8000/api/health`

**Deploy note:** Frontend and backend for load–velocity must ship together (new route + UI).

---

## Handoff to frontend lead (folder drop)

If merging folders instead of a PR:

| Send | Notes |
|------|--------|
| `frontend/src/` | Full tree includes Readiness, charts, `StatusBadge`, page updates |
| `backend/app/` | Includes `gymaware_load_velocity.py`, `gymaware_exercises.py`, router changes |
| Keep from repo `main` | `vite.config.js`, `package.json`, `requirements.txt`, `.env` |

---

## Planned VPA features (documented, not implemented)

Full write-up lives in the VPA repo: `docs/PLANNED_FEATURES.md` (local workspace — confirm path after VPA merge).

| Feature | Summary | Main dependency |
|---------|---------|-----------------|
| **Readiness vs. Reality Matrix** | 4-quadrant scatter: WHOOP recovery % (X, threshold 67%) vs GymAware peak velocity % of 30d avg (Y, threshold 90%). Flags **CNS masking** (high recovery + low velocity); comet trail for last 14 gym days; `[ CNS Warning ]` on squad table. Exercise priority: trap-bar / CMJ-like jumps → highest-volume lift → coach dropdown. | Same-day WHOOP + GymAware; WHOOP still sparse on roster |

**Feasibility:** Technically aligned with existing efficiency scatter and radar baselines; roster-wide charts need broader WHOOP linkage. Trap-bar jump names exist in silver; literal “CMJ” label not required for MVP.

---

## Known limitations

- Catapult / WHOOP coverage is sparse per athlete-day — Readiness shows **Awaiting Sync** / neutral states correctly.
- Readiness performance: N+1 client calls on expand; dedicated backend summary recommended.
- `/vald` depends on staging/silver VALD data — ETL may load profiles/tests before UI is complete.
- No RLS — service role in backend only; enable Entra + RLS for production.

---

## Related toolkit docs

- [`vpa_frontend_integration.md`](vpa_frontend_integration.md) — two-repo architecture
- [`web_app_handover.md`](web_app_handover.md) — silver data contract
- [`catapult_bmp_jumps_handover.md`](../volley-etl/catapult_bmp_jumps_handover.md) — BMP ETL + two silver tables (toolkit handover)
- [`project_status_handover.md`](project_status_handover.md) — overall project snapshot
- [`testing_notes.md`](testing_notes.md) — VPA smoke tests
