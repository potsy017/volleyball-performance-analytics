-- One-off / manual repair (also runs automatically at end of upload_to_supabase.py).
-- Same logic as integrations/catapult/repair_bi_extract.py

UPDATE public.catapult_stats_bi_extract b
SET total_distance = (s.stats_payload->>'total_distance')::double precision
FROM public.catapult_stats_staging s
WHERE b.source_staging_ingest_id = s.ingest_id
  AND b.total_distance IS NULL
  AND s.stats_payload->>'total_distance' IS NOT NULL
  AND btrim(s.stats_payload->>'total_distance') <> '';
