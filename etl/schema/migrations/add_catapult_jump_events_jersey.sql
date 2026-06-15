-- Join jump events to silver when Catapult /stats rows lack athlete UUID (jersey-only).
ALTER TABLE public.catapult_jump_events_session
    ADD COLUMN IF NOT EXISTS athlete_jersey TEXT;

CREATE INDEX IF NOT EXISTS idx_catapult_jump_events_activity_jersey
    ON public.catapult_jump_events_session (activity_id, lower(btrim(athlete_jersey)));
