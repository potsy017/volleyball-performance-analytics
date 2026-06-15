# Catapult BMP jumps & silver model (handover)

**Team 54 toolkit work — June 2026.** Documents ETL, schema, and how the VPA app should consume jump vs load data. **Do not assume VPA `main` has all UI/API changes** until the frontend lead merges local work (see [`vpa_application_updates.md`](../operations/vpa_application_updates.md)).

---

## Business rules (client-approved)

| Metric | Rule |
|--------|------|
| **Total jumps** | BMP `/events?event_types=basketball`: count events with `jump_attribute > 0` |
| **High jumps** | `jump_attribute >= 57` **centiseconds** (0.57 s flight ≈ 40 cm) |
| **Peak jump height** | From max `jump_attribute` in session: \(h = g \cdot t^2 / 8\) with \(t\) in seconds |

Same logic as Beach VB R script and `load_index.py` jump denominator.

---

## Data model (two silver surfaces)

```text
Catapult /stats API  →  bronze (catapult_stats_bi_extract)
                              ↓
                    silver_catapult_session  ← load, distance, HR, IMA jumps
                              ↑
                    LEFT JOIN (activity + athlete_id OR jersey)

BMP /events API      →  catapult_jump_events_session (staging, append-only)
                              ↓
                    silver_catapult_jump_session  ← deduped BMP per activity+athlete
```

| Object | Grain | Use for |
|--------|--------|---------|
| **`silver_catapult_session`** | One row per **stats** session (`activity_id` + athlete id/jersey grain) | Player load, distance, field time, ACWR, session log when stats exist |
| **`silver_catapult_jump_session`** | One row per **activity + Catapult athlete UUID** (latest BMP ingest) | Peak jumps, daily jump totals when stats grain missing, full jump history |
| **`catapult_jump_events_session`** | Append-only staging (re-ingests create extra rows) | Debugging; silver dedupes |

**Important:** Silver **does not** `UNION` jump-only rows into `silver_catapult_session` (removed after June 2026 — avoided ~3,900 sparse rows with null load/distance).

---

## ETL commands

### Scheduled (recommended)

```text
python scheduled_etl.py --sources catapult
```

Order inside `run_catapult()`:

1. `bulk_export.py`
2. `upload_to_supabase.py` (includes **automatic `total_distance` backfill** from staging JSON and **BMP jump gap sync** when stats lack jumps)
3. `catapult_jump_events.py` (date window = load-index lookback by default)
4. `upload_catapult_jump_events_to_supabase.py`
5. `scripts/sync_catapult_jump_gaps.py` (final check; no-op when silver is aligned)

Opt out of auto jump repair: `CATAPULT_SKIP_JUMP_SYNC=1`. Lookback: `CATAPULT_JUMP_SYNC_LOOKBACK_DAYS` (default 14).

### Historical BMP backfill (match existing stats sessions)

```text
python catapult_jump_events.py --start 2023-10-12 --end 2026-06-02 --match-silver-sessions
python upload_catapult_jump_events_to_supabase.py
```

`--match-silver-sessions` limits API calls to `activity_id` values already in `silver_catapult_session` (needs `DATABASE_URL`).

### Roster filter

When `ROSTER_FILTER=1`, jump export only processes athletes on the workbook jersey/UUID allowlist (same as stats upload).

---

## Schema apply order (Supabase SQL Editor)

After `athlete_identity.sql` + `roster_cohort.sql`:

1. `schema/catapult_jump_events.sql`
2. `schema/migrations/add_catapult_jump_events_jersey.sql` (if table existed without jersey)
3. `schema/migrations/add_catapult_jump_events_internal_key.sql`
4. `schema/silver_catapult_jump_session.sql`
5. `schema/silver_catapult_session.sql` (re-apply after any silver logic change)

Optional one-off: `schema/migrations/backfill_catapult_total_distance.sql` (also runs at end of every `upload_to_supabase.py`).

`total_distance` column: `schema/migrations/add_catapult_total_distance.sql` on older projects.

---

## Staging table: `catapult_jump_events_session`

| Column | Notes |
|--------|--------|
| `activity_id`, `athlete_id` | Join keys to stats |
| `athlete_jersey` | Fallback when stats rows lack UUID |
| `athlete_internal_key`, `athlete_display_name` | Set on upload from `athlete_identity` / `roster_cohort` |
| `jump_event_count`, `high_jump_event_count` | BMP totals |
| `max_jump_attribute_cs`, `max_jump_flight_time_s`, `max_jump_height_cm` | Peak jump |
| `high_jump_min_cs` | Default 57 |

Filter roster analytics: `WHERE athlete_internal_key IS NOT NULL`.

---

## Stats silver: jump + distance behaviour

### BMP columns on `silver_catapult_session`

Left-joined from latest staging row per `(activity_id, athlete_id)` (prefer row with jersey populated):

- `jump_event_count`, `high_jump_event_count`, `max_jump_attribute_cs`, `max_jump_flight_time_s`, `max_jump_height_cm`

**NULL jumps** on a stats row means either: no BMP export for that session, or no matching athlete grain (common on team blocks with one collapsed `/stats` row per activity).

### `total_distance`

- Source: `stats_payload.total_distance` (metres).
- **Backfill:** `integrations/catapult/repair_bi_extract.py` runs after each stats upload (disable with `CATAPULT_SKIP_DISTANCE_BACKFILL=1`).
- **Silver dedupe:** When multiple ingests exist for the same period, prefer the row that already has `total_distance` set (`ORDER BY etl_ingested_at DESC, (total_distance IS NULL) ASC`).

---

## Verification SQL

```sql
-- Stats-shaped silver (expect ~1,900 rows with load, not ~5,800)
SELECT COUNT(*) FROM silver_catapult_session;
SELECT COUNT(*) FROM silver_catapult_session WHERE jump_event_count IS NOT NULL;
SELECT COUNT(*) FROM silver_catapult_session WHERE total_distance IS NULL AND total_player_load > 0;

-- Jump silver (deduped BMP, roster-mapped)
SELECT COUNT(*) FROM silver_catapult_jump_session;

-- Sample athlete
SELECT calendar_date, activity_name, total_player_load, total_distance,
       jump_event_count, high_jump_event_count, max_jump_height_cm
FROM silver_catapult_session
WHERE athlete_internal_key = 'VB-xxxxxxxxxx'
ORDER BY calendar_date DESC
LIMIT 20;
```

---

## VPA integration (local — not pushed to VPA repo by toolkit team)

Documented for handoff; confirm merge status before demo.

| Area | Intended behaviour |
|------|---------------------|
| `/catapult` session log | `total_distance`, BMP jump columns from `silver_catapult_session` |
| Load / ACWR charts | Stats silver only |
| Daily high jumps / total jumps | Merged from `silver_catapult_jump_session` in `GET /catapult/load-trend` (local backend) |
| Peak jump board | `GET /catapult/jump-peaks` → `silver_catapult_jump_session` |

**Toolkit repo only** — no VPA pushes unless explicitly requested.

---

## Files touched (toolkit)

| Path | Role |
|------|------|
| `catapult_jump_events.py` | BMP export; `--match-silver-sessions` |
| `upload_catapult_jump_events_to_supabase.py` | Staging insert + `athlete_internal_key` |
| `integrations/catapult/jump_events.py` | Summarize BMP events |
| `integrations/catapult/athlete_identity_resolve.py` | Roster key lookup |
| `integrations/catapult/repair_bi_extract.py` | `total_distance` backfill |
| `integrations/catapult/repair_jump_events.py` | BMP jump gap detect + re-export |
| `scripts/sync_catapult_jump_gaps.py` | CLI for jump gap repair |
| `upload_to_supabase.py` | Calls distance + jump repair after stats upload |
| `schema/catapult_jump_events.sql` | Staging DDL |
| `schema/silver_catapult_session.sql` | Stats + left join jumps |
| `schema/silver_catapult_jump_session.sql` | Jump-only silver |
| `schema/migrations/add_catapult_jump_events_*.sql` | Jersey + internal key |
| `schema/migrations/backfill_catapult_total_distance.sql` | Manual / documented backfill |

---

## Known limitations

| Topic | Detail |
|-------|--------|
| Stats grain | Many team sessions still have **one** `/stats` row per activity (placeholder `athlete_key`); per-athlete load/jumps on silver only where jersey grain exists |
| Jump without stats | Full BMP history in `silver_catapult_jump_session`; load charts may show jumps but not load on same day until stats ETL improves |
| Staging duplicates | Re-running jump upload **appends** rows; silver views use `DISTINCT ON` latest ingest |
| IMA band jumps | Legacy proxy on stats silver; prefer BMP `high_jump_event_count` in VPA |

---

## Related docs

- [`catapult_medallion_layers.md`](catapult_medallion_layers.md) — bronze/silver/gold overview
- [`project_status_handover.md`](../operations/project_status_handover.md) — project snapshot
- [`runbook.md`](../operations/runbook.md) — scheduling
- [`data_dictionary_baseline.md`](../data_dictionary_baseline.md) — column reference
