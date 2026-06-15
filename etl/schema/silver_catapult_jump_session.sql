-- Silver BMP jumps: one latest row per activity + athlete (roster-mapped).
-- Use for peak jumps, daily jump trends, and sessions without a matching /stats grain.
-- Load / ACWR remain on silver_catapult_session.

DROP VIEW IF EXISTS public.silver_catapult_jump_session CASCADE;

CREATE VIEW public.silver_catapult_jump_session
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (j.activity_id, j.athlete_id)
    j.ingest_id,
    j.activity_id,
    j.athlete_id,
    j.athlete_jersey,
    j.athlete_internal_key,
    j.athlete_display_name,
    j.activity_name,
    j.activity_date AS calendar_date,
    j.jump_event_count,
    j.high_jump_event_count,
    j.max_jump_attribute_cs,
    j.max_jump_flight_time_s,
    j.max_jump_height_cm,
    j.high_jump_min_cs,
    j.etl_ingested_at
FROM public.catapult_jump_events_session j
WHERE j.athlete_internal_key IS NOT NULL
  AND btrim(j.athlete_internal_key) <> ''
ORDER BY
    j.activity_id,
    j.athlete_id,
    j.etl_ingested_at DESC,
    j.ingest_id DESC;

COMMENT ON VIEW public.silver_catapult_jump_session IS
    'Latest BMP jump summary per activity+athlete; roster internal_key required. Pair with silver_catapult_session for load.';
