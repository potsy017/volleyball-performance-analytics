# Web application handover (data contract)

The coaching dashboard **VPA** (FastAPI + React, separate `vpa/` repo) reads **silver views** from Supabase via PostgREST. This toolkit repo owns ETL, roster sync, and silver DDL — not the React UI.

**Integration guide:** [`vpa_frontend_integration.md`](vpa_frontend_integration.md)

## Two backends (do not merge)

| App | Location | Purpose |
|-----|----------|---------|
| WHOOP OAuth bridge | This repo: `backend/app.py` | Per-athlete OAuth; writes `whoop_oauth_token` |
| VPA dashboard API | VPA repo: `vpa/backend/app/` | Reads silver tables with `SUPABASE_SERVICE_KEY` |

## Authentication

| System | What |
|--------|------|
| **Coach dashboard (VPA)** | Microsoft Entra ID via Supabase Auth — see VPA repo `docs/AUTH_ENTRA_HANDOVER.md`. Service role stays in `backend/.env` only. |
| **WHOOP athlete data** | Per-athlete OAuth in this toolkit (`backend/app.py`) — separate from coach login. |
| **ETL jobs** | `DATABASE_URL` / service credentials — no browser login. |

Set `AUTH_ENABLED=false` in VPA until the client completes Entra app registration (handover doc Phase A → B).

**Future warehouse:** VPA repo `docs/DATA_WAREHOUSE_MIGRATION.md` — silver table contract + repository swap; ETL toolkit retargets gold tables with the same names.

## Athlete picker (global filter)

Use **`public.athlete_identity`** or silver columns:

| Column | Use |
|--------|-----|
| `internal_key` / `athlete_internal_key` | Stable join key (e.g. `VB-5406785896`) |
| `display_name` / `athlete_display_name` | UI label |

Filter facts by **`athlete_internal_key`** + **`calendar_date`**.

## Tables VPA consumes today

| Table | Pages |
|-------|--------|
| `silver_catapult_session` | `/`, `/catapult` (session log, load, distance, BMP when joined), `/readiness` |
| `silver_catapult_jump_session` | `/catapult` peak jumps, daily jump trends (local VPA backend; see `vpa_application_updates.md`) |
| `silver_whoop_recovery`, `silver_whoop_sleep` | `/`, `/whoop`, `/readiness` |
| `silver_whoop_workout` | `/whoop`, `/readiness` (workout summary) |
| `silver_gymaware_summaries`, `silver_gymaware_bests` | `/gymaware`, `/readiness`, load–velocity API |
| VALD | `/vald` — UI wired when data exists; ETL may load staging before full silver |

**Feature detail (routes, APIs, local June 2026 updates):** [`vpa_application_updates.md`](vpa_application_updates.md)

## Additional silver (available, not all wired in UI)

| View | Use |
|------|-----|
| `silver_whoop_cycle` | Cycle strain / dates |
| `silver_whoop_sleep_longest_per_day` | Main sleep per day |
| `silver_gymaware_rep` | Rep-level detail (`GET /gymaware/reps`) |

## Summary page (one athlete + one date)

| Source | View | Grain |
|--------|------|--------|
| WHOOP recovery KPIs | `silver_whoop_recovery` | One row per WHOOP cycle |
| Catapult session list | `silver_catapult_session` | One row per player × **stats** session (load + distance) |
| Catapult BMP / peak jumps | `silver_catapult_jump_session` | One row per player × activity (latest BMP); use when stats row lacks jumps |
| Optional main sleep | `silver_whoop_sleep_longest_per_day` | One row per player × day |

Row counts **will differ** across sources on the same calendar day — expected. See `docs/volley-etl/cross_source_correlation.md`.

## Do not use for UI metrics

- Raw `*_bi_extract` tables (duplicate ingests).
- Dropped legacy objects: `dashboard_design`, `vw_dashboard_*`, `intermediate_big_table`.

## Schema apply order

New Supabase project: `schema/apply_order.txt` (bronze → BI extract → silver).

## Sample filter (SQL)

```sql
SELECT *
FROM public.silver_whoop_recovery
WHERE athlete_internal_key = 'VB-5406785896'
  AND calendar_date = '2026-05-20';
```

Equivalent in VPA: pass `athlete_internal_key` + date to FastAPI routers that query PostgREST.
