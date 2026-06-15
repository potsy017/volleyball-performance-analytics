"""Repair catapult_stats_bi_extract columns from staging JSON after upload."""
from __future__ import annotations

import os
from typing import Any

BACKFILL_TOTAL_DISTANCE_SQL = """
UPDATE public.catapult_stats_bi_extract b
SET total_distance = (s.stats_payload->>'total_distance')::double precision
FROM public.catapult_stats_staging s
WHERE b.source_staging_ingest_id = s.ingest_id
  AND b.total_distance IS NULL
  AND s.stats_payload->>'total_distance' IS NOT NULL
  AND btrim(s.stats_payload->>'total_distance') <> '';
"""

REPAIR_INGEST_DISTANCE_SQL = """
UPDATE public.catapult_stats_bi_extract b
SET total_distance = (s.stats_payload->>'total_distance')::double precision
FROM public.catapult_stats_staging s
WHERE b.source_staging_ingest_id = s.ingest_id
  AND s.ingest_id = %(ingest_id)s
  AND b.total_distance IS NULL
  AND s.stats_payload->>'total_distance' IS NOT NULL
  AND btrim(s.stats_payload->>'total_distance') <> '';
"""


def skip_distance_backfill() -> bool:
    return os.getenv("CATAPULT_SKIP_DISTANCE_BACKFILL", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def repair_ingest_total_distance(cur: Any, ingest_id: int) -> int:
    cur.execute(REPAIR_INGEST_DISTANCE_SQL, {"ingest_id": ingest_id})
    return int(cur.rowcount or 0)


def backfill_total_distance(cur: Any) -> int:
    cur.execute(BACKFILL_TOTAL_DISTANCE_SQL)
    return int(cur.rowcount or 0)
