# Catapult medallion layers (Bronze / Silver / Gold)

## Current product decision

The client reviews **independent Catapult sessions** (each practice or match), not a single rolled-up number for the whole day. **Gold is not required for Catapult at this time.**

**Power BI (Catapult):** use **`public.silver_catapult_session`**, not raw `catapult_stats_bi_extract`.

**Cross-source summary (WHOOP + Catapult on one page):** use Silver (or source BI tables) with day-level measures in the semantic model, or add Gold later if a single daily table is preferred.

---

## Bronze

| Object | Grain | Purpose |
|--------|--------|---------|
| `catapult_stats_staging` | One row per **ETL ingest** (full `stats_payload` JSONB) | Audit, reprocessing, new metric extraction |
| `catapult_stats_bi_extract` | One flat row per **ingest** (same session may appear many times) | Machine-friendly copy of API fields; fed by `upload_to_supabase.py`; includes `total_distance` (auto-backfilled from JSON after upload) |
| `catapult_jump_events_session` | One row per **ingest** per activity+athlete (BMP summary) | Beach VB jump counts; see `catapult_bmp_jumps_handover.md` |
| `catapult_session_metrics` | Legacy narrow insert | Backward compatibility only |

**Use Bronze when you need:** full JSON history, debugging a bad pull, re-running extract logic after schema changes.

**Bronze does not provide:** trustworthy session totals for dashboards (duplicate ingests inflate `SUM`).

---

## Silver (implemented)

| Object | Grain | Purpose |
|--------|--------|---------|
| `silver_catapult_session` (view) | **One row per stats session** (`activity_id` + athlete id or jersey grain) | Load, distance, HR, IMA; BMP jump columns when join matches |
| `silver_catapult_jump_session` (view) | **One row per activity + athlete** (latest BMP ingest) | Peak jumps, daily jump trends; roster `athlete_internal_key` required |

**`silver_catapult_session` logic:**

1. Latest ingest per `(activity_id, session_athlete_grain, period_name)` — prefers rows with `total_distance` when timestamps tie.
2. Sum periods within the same session (load, distance, IMA bands, etc.); MAX for peaks/rates.
3. **Left join** latest BMP row from `catapult_jump_events_session` (by `athlete_id` or jersey).
4. `calendar_date` for filtering by day (does **not** merge different sessions on the same day).
5. `athlete_internal_key` / `athlete_display_name` from `athlete_identity` (and jersey fallback).

**Do not** union jump-only rows into stats silver (removed June 2026 — caused thousands of rows with null load/distance). Use **`silver_catapult_jump_session`** for full BMP coverage.

**Apply:** `schema/silver_catapult_session.sql`, `schema/silver_catapult_jump_session.sql` (after jump staging + identity tables). Details: [`catapult_bmp_jumps_handover.md`](catapult_bmp_jumps_handover.md).

---

## Gold (optional — not implemented)

| Object (future) | Grain | Purpose |
|-----------------|--------|---------|
| e.g. `gold_catapult_athlete_day` | **One row per athlete per calendar day** | Daily summary and cross-source joins at day grain |

### What Gold would add that Silver and Bronze do not

| Need | Bronze | Silver | Gold |
|------|--------|--------|------|
| See each session separately | No (dupes / messy) | **Yes** | No (collapsed) |
| Correct load/jumps **per session** | No | **Yes** | N/A |
| **One row per athlete per day** for a summary table | No | No (2 sessions = 2 rows) | **Yes** |
| **Daily total** load/jumps across 2+ sessions same day | Wrong if summed raw | Requires `SUM` in report or Gold | **Yes** (built-in) |
| **`session_count` per day** (0 / 1 / 2 practices) | Manual | Count rows in PBI | **Yes** |
| Align Catapult with **WHOOP daily recovery** on one key (`internal_key` + date) | Hard | Possible with DAX | **Easier** with one daily fact |
| **“Primary session only”** rule (longest `field_time`, ignore second session) | No | No | **Yes** (policy in SQL) |
| Show **no training day** on a calendar (needs date spine + roster) | No | No | **Yes** (with spine) |

### When to introduce Gold

Consider `gold_catapult_athlete_day` (or a combined `gold_athlete_day_summary` with WHOOP columns) if:

- The summary dashboard must show **one line per athlete per day** without DAX aggregation.
- Stakeholders want **daily totals** across multiple sessions, not session detail.
- You want a **single SQL table** for Power BI home page slicers (athlete + date) across Catapult and WHOOP.

Until then, **Silver remains the Catapult source of truth for analytics.**

---

## Quick reference

```text
API → Bronze (append, history) → Silver (one row per session) → [Gold optional: one row per athlete per day]
```

**DDL order:** see `schema/apply_order.txt` (Silver after `catapult_stats_bi_extract.sql`).
