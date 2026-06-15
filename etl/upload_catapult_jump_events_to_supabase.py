# Insert catapult_jump_events_export.json into public.catapult_jump_events_session.
#   python catapult_jump_events.py --start 2026-04-01 --end 2026-04-14
#   python upload_catapult_jump_events_to_supabase.py [path/to/custom.json]
# Requires DATABASE_URL. Apply schema/catapult_jump_events.sql first.
# After athlete_identity + roster_cohort: schema/migrations/add_catapult_jump_events_internal_key.sql
from __future__ import annotations

import json
import os
import sys
import uuid

import psycopg2
from dotenv import load_dotenv

from integrations.catapult.athlete_identity_resolve import (
    load_identity_lookups,
    resolve_internal_key,
)

load_dotenv()


def main() -> int:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ERROR] DATABASE_URL not set in .env", file=sys.stderr)
        return 1

    path = sys.argv[1] if len(sys.argv) > 1 else os.getenv(
        "CATAPULT_JUMP_EVENTS_JSON", "catapult_jump_events_export.json"
    )
    if not os.path.isfile(path):
        print(f"[ERROR] File not found: {path}", file=sys.stderr)
        return 1

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    sessions = data.get("sessions")
    if not isinstance(sessions, list):
        print("[ERROR] JSON missing 'sessions' array", file=sys.stderr)
        return 1

    high_min = int(data.get("high_jump_min_cs") or 57)
    inserted = 0
    mapped = 0
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        by_uuid, by_jersey = load_identity_lookups(cur)

        for row in sessions:
            if not isinstance(row, dict):
                continue
            aid = row.get("activity_id")
            ath_id = row.get("athlete_id")
            if not aid or not ath_id:
                continue
            try:
                act_uuid = str(uuid.UUID(str(aid)))
                ath_uuid = str(uuid.UUID(str(ath_id)))
            except (ValueError, TypeError):
                continue

            internal_key, display_name = resolve_internal_key(
                ath_uuid,
                row.get("athlete_jersey"),
                by_uuid=by_uuid,
                by_jersey=by_jersey,
            )
            if internal_key:
                mapped += 1

            cur.execute(
                """
                INSERT INTO public.catapult_jump_events_session (
                    activity_id, athlete_id, athlete_jersey,
                    athlete_internal_key, athlete_display_name,
                    activity_name, activity_date,
                    jump_event_count, high_jump_event_count,
                    max_jump_attribute_cs, max_jump_flight_time_s, max_jump_height_cm,
                    high_jump_min_cs, etl_ingested_at
                )
                VALUES (
                    %s::uuid, %s::uuid, %s, %s, %s, %s, %s::date,
                    %s, %s, %s, %s, %s, %s, NOW()
                )
                """,
                (
                    act_uuid,
                    ath_uuid,
                    row.get("athlete_jersey"),
                    internal_key,
                    display_name,
                    row.get("activity_name"),
                    row.get("activity_date"),
                    int(row.get("jump_event_count") or 0),
                    int(row.get("high_jump_event_count") or 0),
                    row.get("max_jump_attribute_cs"),
                    row.get("max_jump_flight_time_s"),
                    row.get("max_jump_height_cm"),
                    high_min,
                ),
            )
            inserted += 1

        print(
            f"[SUCCESS] Inserted {inserted} jump event session row(s) "
            f"({mapped} with athlete_internal_key)."
        )
        return 0
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
