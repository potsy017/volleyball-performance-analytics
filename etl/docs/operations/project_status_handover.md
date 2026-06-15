# Project status handover (Volleyball toolkit)

Snapshot for the team and client: what is working, how to run it, silver read models for the website, and what remains. Repository: **Capstone-team54-volleyball-toolkit**.

---

## Completed (working end-to-end)

### Infrastructure

- **Supabase (Postgres):** Schema under `schema/` — apply order in `schema/apply_order.txt`.
- **Medallion raw layer:** Append-only staging/BI with `etl_ingested_at` / `ingest_id` (`schema/medallion_raw_layer_migration.sql`).
- **Environment:** Copy `.env.example` to `.env` (never commit `.env`). Offline check: `python scripts/preflight_config.py`.
- **CI:** `.github/workflows/ci.yml` (compile check); `.github/workflows/daily_etl.yml` (nightly multi-source ETL + roster sync).

### Roster and athlete identity (automated)

- **Coach workbook:** `data/roster/roster_new.xlsx` (committed for GitHub Actions). Instructions: `data/roster/README.md`, `data/roster/ROSTER_FOR_COACHES.md`.
- **Sync scripts:** `scripts/sync_athlete_identity_from_xlsx.py`, `scripts/sync_roster_cohort_from_xlsx.py`.
- **`scheduled_etl.py`:** Runs roster sync before vendor ETL unless `SCHEDULED_SKIP_ROSTER_SYNC=1`.
- **`public.athlete_identity`:** Crosswalk (`internal_key`, Catapult/GymAware/VALD/WHOOP IDs, display names). Populated from workbook sync.

### Catapult

- **Export/load:** `bulk_export.py` → `upload_to_supabase.py` → `catapult_stats_staging` + `catapult_stats_bi_extract`.
  - **`total_distance` repair:** After each upload, `integrations/catapult/repair_bi_extract.py` backfills distance from staging JSON (`CATAPULT_SKIP_DISTANCE_BACKFILL=1` to disable).
- **Silver (stats):** `silver_catapult_session` — one row per **stats** session (activity + athlete id/jersey grain); load, distance, HR; BMP jumps **left-joined** when grain matches. **No jump-only union** (avoids sparse duplicate rows).
- **BMP jumps (Beach VB):** `catapult_jump_events.py` → `upload_catapult_jump_events_to_supabase.py` → `catapult_jump_events_session` (staging) → **`silver_catapult_jump_session`** (deduped, roster `athlete_internal_key`). High jump threshold: `jump_attribute >= 57` cs. Historical backfill: `--match-silver-sessions`. **Full handover:** `docs/volley-etl/catapult_bmp_jumps_handover.md`.
- **Load index:** `load_index.py` → `upload_load_index_to_supabase.py` (optional `--jump-events-json`).
- **Gold daily rollup:** Still deferred per client. See `docs/volley-etl/catapult_medallion_layers.md`.

### GymAware (extended)

- **Export:** `gymaware_export.py` — `/summaries`, `/reps`, `/athletes`, `/bests` (bests chunked; `GYMAWARE_BESTS_CHUNK_DAYS`, default 90).
- **Load:** `upload_gymaware_to_supabase.py` → staging + BI extract tables (`schema/gymaware_extended.sql`).
- **Silver:** `schema/silver_gymaware.sql` — summaries, reps, bests, athletes with `athlete_internal_key` / `athlete_display_name`.

### WHOOP

- **Auth bridge:** `backend/app.py` — OAuth start/callback; tokens in `whoop_oauth_token`.
- **ETL:** `whoop_etl.py` → staging + `whoop_*_bi_extract` (with `whoop_bi_extract.sql`).
- **Silver:** `schema/silver_whoop.sql` — cycle, sleep, workout, recovery, `silver_whoop_sleep_longest_per_day`.

### VALD

- Profiles + optional ForceFrame / ForceDecks staging uploads via `scheduled_etl.py`. See `docs/volley-etl/vald_onboarding.md`.

### Scheduled pipeline

- **`scheduled_etl.py`:** Roster sync → Catapult → GymAware → VALD → WHOOP → load index (+ DB upload). Non-zero exit if any step failed.
- **Windows:** `scripts/run_scheduled_sync.ps1`.
- **GitHub Actions:** `daily_etl.yml` with `ROSTER_ALLOWLIST_XLSX=data/roster/roster_new.xlsx`, `ROSTER_FILTER=1`.

### Analytics read model (VPA website / BI)

- **VPA app (separate repo):** FastAPI + React dashboard reads silver tables via PostgREST (`SUPABASE_SERVICE_KEY`). See `docs/operations/vpa_frontend_integration.md`.
- **Do not report from raw `*_bi_extract`** — duplicate rows from append-only ingests.
- **Use silver views** + `athlete_identity`. Cross-source pattern: `docs/volley-etl/cross_source_correlation.md`.
- **Legacy dashboard tables removed:** `cleanup_legacy_dashboard.sql`.

### VPA application (June 2026 — local / handoff to frontend lead)

Documented in **`docs/operations/vpa_application_updates.md`**. Highlights:

| Feature | Route / API | Notes |
|---------|-------------|--------|
| Readiness coach view | `/readiness` | Team table + expandable detail; RAG badges; deep links `?day=` |
| GymAware load–velocity | `/gymaware` + `GET /gymaware/load-velocity-analysis` | Multi-session profiles 25–105 kg; trap-bar exercise alias merge |
| Main dashboard | `/` | 3-axis chart; team snapshot status badges; ACWR / jumps charts |
| Deep linking | `/catapult`, `/whoop`, `/gymaware` | URL params `athlete`, `day` |
| Athlete report | `/report` | Summary page |

**Not on toolkit `main` by default:** confirm VPA GitHub `main` vs local `frontend/src` + `backend/app` merge. Deploy frontend and backend together for load–velocity and Catapult BMP (`/jump-peaks`, jump silver queries).

### Toolkit-only work (June 2026 — in this repo)

| Deliverable | Location |
|-------------|----------|
| BMP jump export + upload | `catapult_jump_events.py`, `upload_catapult_jump_events_to_supabase.py` |
| Jump staging + silver view | `schema/catapult_jump_events.sql`, `silver_catapult_jump_session.sql` |
| Stats silver (no sparse union) | `schema/silver_catapult_session.sql` |
| Roster keys on jump staging | `athlete_internal_key`, migrations, `athlete_identity_resolve.py` |
| Distance backfill in ETL | `integrations/catapult/repair_bi_extract.py`, `upload_to_supabase.py` |
| Handover doc | `docs/volley-etl/catapult_bmp_jumps_handover.md` |

**VPA repo:** not pushed by toolkit team until requested; see `vpa_application_updates.md` for local API/UI expectations.

### Documentation

| Document | Purpose |
|----------|---------|
| `docs/design/system_design.md` | Architecture, workflows, design decisions |
| `docs/operations/web_app_handover.md` | Silver contract for VPA |
| `docs/operations/vpa_frontend_integration.md` | VPA ↔ ETL two-repo setup |
| `docs/operations/vpa_application_updates.md` | VPA features, APIs, handoff, limitations |
| `docs/operations/vpa_local_dev_setup.md` | Run VPA backend + frontend locally |
| `docs/operations/testing_notes.md` | Smoke tests, ETL + VPA verification |
| `docs/operations/product_review_checklist.md` | Rubric alignment for capstone review |
| `docs/data_dictionary_baseline.md` | Column-level reference |
| `docs/volley-etl/cross_source_correlation.md` | Athlete + date correlation across sources |
| `docs/volley-etl/catapult_bmp_jumps_handover.md` | BMP jumps ETL, two silver tables, distance backfill, verification SQL |

---

## Verified in practice

- `scheduled_etl.py --all` — Catapult, GymAware, VALD profiles, WHOOP ETL, load index (when credentials set).
- Silver views applied in dev Supabase; row counts deduped vs bronze (e.g. Catapult ~3k+ bronze period rows → ~1,900 `silver_catapult_session` stats rows; ~5,756 deduped BMP rows in `silver_catapult_jump_session`; WHOOP recovery deduped to one row per cycle).
- Catapult BMP historical export (2023-10 → 2026-06) + distance backfill applied on dev Supabase; dashboard distance/jumps populated where stats grain + BMP align.
- Roster-linked athletes show `athlete_display_name` on silver WHOOP/Catapult/GymAware where IDs are filled in `roster_new.xlsx`.

---

## Remaining / post-review (optional)

| Area | Notes |
|------|--------|
| **VPA merge to GitHub `main`** | Local Readiness + load–velocity may need PR/merge; see `vpa_application_updates.md`. |
| **Readiness backend API** | Single summary endpoint would replace client-side N+1 calls. |
| **VPA `/vald` silver** | UI exists in VPA; `silver_vald_*` DDL still not in this toolkit. |
| **RLS & API layer** | Tables unrestricted until RLS or backend API with service role. |
| **WHOOP athlete onboarding** | Only roster athletes with `whoop_user_id` + completed OAuth receive data. |
| **Catapult rate limits (429)** | Bulk export may need backoff/tuning under heavy CI runs. |
| **Gold Catapult daily rollup** | Not built — client wants independent sessions. |
| **Teamworks AMS** | Placeholder only. |
| **Power BI** | Deprioritized in favour of custom web; silver schema unchanged for either consumer. |

---

## Quick commands (repo root)

```text
python scripts/preflight_config.py
python verify_integrations.py
python scheduled_etl.py --all
python scripts/sync_athlete_identity_from_xlsx.py
```

---

## Key files

| Path | Role |
|------|------|
| `schema/silver_*.sql` | Reporting views (apply after BI extract DDL) |
| `data/roster/roster_new.xlsx` | Coach-maintained roster |
| `scheduled_etl.py` | Multi-source scheduler |
| `docs/operations/runbook.md` | Install + scheduling |
| `docs/operations/product_review_checklist.md` | Assessment rubric checklist |
