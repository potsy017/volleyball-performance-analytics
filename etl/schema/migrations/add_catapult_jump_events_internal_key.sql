-- Roster join key for VPA / BI filters (same resolution as silver_catapult_session).
ALTER TABLE public.catapult_jump_events_session
    ADD COLUMN IF NOT EXISTS athlete_internal_key TEXT,
    ADD COLUMN IF NOT EXISTS athlete_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_catapult_jump_events_internal_key
    ON public.catapult_jump_events_session (athlete_internal_key)
    WHERE athlete_internal_key IS NOT NULL;

COMMENT ON COLUMN public.catapult_jump_events_session.athlete_internal_key IS
    'Stable roster key (e.g. VB-5406785896) from athlete_identity / roster_cohort; used for dashboard filters.';

COMMENT ON COLUMN public.catapult_jump_events_session.athlete_display_name IS
    'Display name from athlete_identity when internal_key is resolved.';

-- Backfill existing rows (re-run safe).
UPDATE public.catapult_jump_events_session j
SET
    athlete_internal_key = x.internal_key,
    athlete_display_name = x.display_name
FROM (
    SELECT
        j2.ingest_id,
        COALESCE(ai_uuid.internal_key, ai_jersey.internal_key) AS internal_key,
        COALESCE(ai_uuid.display_name, ai_jersey.display_name) AS display_name
    FROM public.catapult_jump_events_session j2
    LEFT JOIN public.athlete_identity ai_uuid
        ON btrim(ai_uuid.catapult_athlete_id) <> ''
       AND lower(btrim(ai_uuid.catapult_athlete_id)) = lower(j2.athlete_id::text)
    LEFT JOIN public.roster_cohort rc
        ON ai_uuid.internal_key IS NULL
       AND j2.athlete_jersey IS NOT NULL
       AND btrim(j2.athlete_jersey) <> ''
       AND btrim(rc.catapult_jersey) <> ''
       AND lower(btrim(rc.catapult_jersey)) = lower(btrim(j2.athlete_jersey))
    LEFT JOIN public.athlete_identity ai_jersey
        ON ai_uuid.internal_key IS NULL
       AND rc.gymaware_athlete_reference IS NOT NULL
       AND ai_jersey.gymaware_athlete_reference = rc.gymaware_athlete_reference
) x
WHERE j.ingest_id = x.ingest_id
  AND x.internal_key IS NOT NULL
  AND (
        j.athlete_internal_key IS DISTINCT FROM x.internal_key
        OR j.athlete_display_name IS DISTINCT FROM x.display_name
  );
