-- Per-athlete jump event summaries from BMP /events?event_types=basketball (Beach VB script).
-- Populated by catapult_jump_events.py + upload_catapult_jump_events_to_supabase.py.
-- Joined into silver_catapult_session (stats rows only); full history in silver_catapult_jump_session.

CREATE TABLE IF NOT EXISTS public.catapult_jump_events_session (
    ingest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL,
    athlete_id UUID NOT NULL,
    athlete_jersey TEXT,
    athlete_internal_key TEXT,
    athlete_display_name TEXT,
    activity_name TEXT,
    activity_date DATE,
    jump_event_count INTEGER NOT NULL DEFAULT 0,
    high_jump_event_count INTEGER NOT NULL DEFAULT 0,
    max_jump_attribute_cs INTEGER,
    max_jump_flight_time_s DOUBLE PRECISION,
    max_jump_height_cm DOUBLE PRECISION,
    high_jump_min_cs INTEGER NOT NULL DEFAULT 57,
    etl_ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catapult_jump_events_activity_athlete
    ON public.catapult_jump_events_session (activity_id, athlete_id, etl_ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_catapult_jump_events_ingested
    ON public.catapult_jump_events_session (etl_ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_catapult_jump_events_internal_key
    ON public.catapult_jump_events_session (athlete_internal_key)
    WHERE athlete_internal_key IS NOT NULL;

COMMENT ON TABLE public.catapult_jump_events_session IS
    'Append-only BMP jump summaries per activity+athlete; high_jump uses jump_attribute >= 57 cs (0.57 s).';

COMMENT ON COLUMN public.catapult_jump_events_session.jump_event_count IS
    'Count of basketball BMP events with jump_attribute > 0 (total jumps).';

COMMENT ON COLUMN public.catapult_jump_events_session.high_jump_event_count IS
    'Count with jump_attribute >= high_jump_min_cs (default 57 cs ≈ 40 cm).';

COMMENT ON COLUMN public.catapult_jump_events_session.max_jump_attribute_cs IS
    'Highest jump_attribute (centiseconds) in the session for this athlete.';

COMMENT ON COLUMN public.catapult_jump_events_session.max_jump_height_cm IS
    'Estimated peak jump height from max flight time: g·t²/8.';

COMMENT ON COLUMN public.catapult_jump_events_session.athlete_internal_key IS
    'Stable roster key (e.g. VB-5406785896); populate via upload + athlete_identity / roster_cohort.';

COMMENT ON COLUMN public.catapult_jump_events_session.athlete_display_name IS
    'Roster display name when internal_key is resolved.';
