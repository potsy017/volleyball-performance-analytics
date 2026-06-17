# Roster workbook (local only)

Roster `.xlsx` files are **gitignored** — they contain real athlete names and vendor IDs.

## Portfolio / local dev

1. Create `roster_new.xlsx` locally (copy structure from your capstone export or build a minimal sheet).
2. Set in `etl/.env`:
   ```env
   ROSTER_FILTER=1
   ROSTER_ALLOWLIST_XLSX=data/roster/roster_new.xlsx
   ```
3. Run `python scheduled_etl.py --sources roster` or full `--all` to sync into `roster_cohort` and `athlete_identity`.

Required columns are documented in `etl/schema/roster_cohort.sql` and `etl/integrations/roster_allowlist.py`.

## Without a roster file

Set `ROSTER_FILTER=0` in `.env` to ingest all athletes returned by vendor APIs (demo only).
