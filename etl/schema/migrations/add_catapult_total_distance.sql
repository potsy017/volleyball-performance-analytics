-- Add total_distance to Catapult bronze extract + silver session view.
-- Safe for existing data: new column is NULL until backfill; no truncate.

ALTER TABLE public.catapult_stats_bi_extract
    ADD COLUMN IF NOT EXISTS total_distance DOUBLE PRECISION;

COMMENT ON COLUMN public.catapult_stats_bi_extract.total_distance IS
    'Maps stats_payload key total_distance (metres).';

-- Backfill from staging JSON for rows already in extract
UPDATE public.catapult_stats_bi_extract b
SET total_distance = (s.stats_payload->>'total_distance')::double precision
FROM public.catapult_stats_staging s
WHERE b.source_staging_ingest_id = s.ingest_id
  AND b.total_distance IS NULL
  AND s.stats_payload->>'total_distance' IS NOT NULL;

-- Recreate silver view (includes SUM(total_distance) across periods)
\i ../silver_catapult_session.sql
