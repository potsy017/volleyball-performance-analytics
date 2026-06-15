"""Apply total_distance column + silver view refresh to Supabase. Run from toolkit root."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL not set in Capstone-team54-volleyball-toolkit/.env")

SILVER_SQL = (ROOT / "schema" / "silver_catapult_session.sql").read_text(encoding="utf-8")


def main() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Adding total_distance to catapult_stats_bi_extract...")
    cur.execute(
        """
        ALTER TABLE public.catapult_stats_bi_extract
        ADD COLUMN IF NOT EXISTS total_distance DOUBLE PRECISION;
        """
    )

    print("Backfilling total_distance from staging stats_payload...")
    cur.execute(
        """
        UPDATE public.catapult_stats_bi_extract b
        SET total_distance = (s.stats_payload->>'total_distance')::double precision
        FROM public.catapult_stats_staging s
        WHERE b.source_staging_ingest_id = s.ingest_id
          AND b.total_distance IS NULL
          AND s.stats_payload->>'total_distance' IS NOT NULL;
        """
    )
    print(f"  rows updated: {cur.rowcount}")

    print("Recreating silver_catapult_session view...")
    cur.execute(SILVER_SQL)

    cur.execute(
        """
        SELECT COUNT(*) FROM public.catapult_stats_bi_extract
        WHERE total_distance IS NOT NULL;
        """
    )
    bronze_n = cur.fetchone()[0]
    cur.execute(
        """
        SELECT COUNT(*) FROM public.silver_catapult_session
        WHERE total_distance IS NOT NULL;
        """
    )
    silver_n = cur.fetchone()[0]
    cur.execute(
        """
        SELECT ROUND(AVG(total_distance)::numeric, 0)
        FROM public.silver_catapult_session
        WHERE total_distance IS NOT NULL;
        """
    )
    avg_d = cur.fetchone()[0]

    cur.close()
    conn.close()
    print(f"Done. Bronze rows with distance: {bronze_n}")
    print(f"Silver sessions with distance: {silver_n}")
    print(f"Avg session distance (m): {avg_d}")


if __name__ == "__main__":
    main()
