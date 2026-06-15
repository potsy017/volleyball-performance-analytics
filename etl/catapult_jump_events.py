"""
Export per-athlete BMP jump summaries for Catapult activities in a UTC date range.

Same API logic as `Jump Data - BEACH VB.R` and load_index.py; adds high-jump counts
(jump_attribute >= 57 cs) and per-session max jump height.

Requires: CATAPULT_TOKEN in .env

Run:
  python catapult_jump_events.py --start 2026-03-01 --end 2026-03-28
  python upload_catapult_jump_events_to_supabase.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

from integrations import config
from integrations.catapult.jump_events import HIGH_JUMP_MIN_CS, fetch_jump_summary_for_athlete
from integrations.catapult.stats_row import jersey_from_activity_athlete
from integrations.roster_allowlist import (
    catapult_roster_filters,
    env_roster_filter_enabled,
    load_roster_allowlist,
)

PAUSE_S = float(os.getenv("CATAPULT_API_PAUSE", "0.5"))
DB_URL = os.getenv("DATABASE_URL", "").strip()
DEFAULT_JSON = os.getenv("CATAPULT_JUMP_EVENTS_JSON", "catapult_jump_events_export.json")


def _activity_date(act: dict[str, Any]) -> datetime.date | None:
    st = act.get("start_time")
    if st is None:
        return None
    try:
        return datetime.fromtimestamp(float(st), tz=timezone.utc).date()
    except (TypeError, ValueError, OSError):
        return None


def fetch_activities(headers: dict[str, str], base: str) -> list[dict[str, Any]]:
    r = requests.get(f"{base}/activities", headers=headers, timeout=120)
    r.raise_for_status()
    raw = r.json()
    acts = raw.get("data", raw) if isinstance(raw, dict) else raw
    return acts if isinstance(acts, list) else []


def activities_in_range(
    activities: list[dict[str, Any]], start_d: datetime.date, end_d: datetime.date
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for act in activities:
        d = _activity_date(act)
        if d is not None and start_d <= d <= end_d:
            out.append(act)
    return out


def fetch_activity_athletes(
    headers: dict[str, str], base: str, activity_id: str
) -> list[dict[str, Any]]:
    r = requests.get(
        f"{base}/activities/{activity_id}/athletes",
        headers=headers,
        timeout=120,
    )
    if r.status_code != 200:
        return []
    raw = r.json()
    rows = raw if isinstance(raw, list) else raw.get("data", raw) if isinstance(raw, dict) else []
    return rows if isinstance(rows, list) else []


def default_range() -> tuple[datetime.date, datetime.date]:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=7)
    return start, end


def main() -> int:
    parser = argparse.ArgumentParser(description="Export BMP jump summaries per athlete/session")
    parser.add_argument("--start", help="UTC start date YYYY-MM-DD (inclusive)")
    parser.add_argument("--end", help="UTC end date YYYY-MM-DD (inclusive)")
    parser.add_argument("--json-out", default=DEFAULT_JSON, help="Output JSON path")
    parser.add_argument(
        "--max-activities",
        type=int,
        default=None,
        help="Process only first N activities (smoke test)",
    )
    parser.add_argument(
        "--match-silver-sessions",
        action="store_true",
        help="Only activities present in silver_catapult_session (needs DATABASE_URL)",
    )
    args = parser.parse_args()

    start_s = args.start or os.getenv("CATAPULT_JUMP_EVENTS_START", "").strip()
    end_s = args.end or os.getenv("CATAPULT_JUMP_EVENTS_END", "").strip()
    if start_s and end_s:
        start_d = datetime.strptime(start_s, "%Y-%m-%d").date()
        end_d = datetime.strptime(end_s, "%Y-%m-%d").date()
    else:
        start_d, end_d = default_range()
        print(f"[INFO] Using default UTC window: {start_d} .. {end_d}")

    if end_d < start_d:
        print("[ERROR] end before start")
        return 1

    try:
        token = config.catapult_token()
        base = config.catapult_base_url()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        return 1

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    allow_uuids: set[str] | None = None
    allow_jerseys_fold: set[str] | None = None
    if env_roster_filter_enabled():
        try:
            _, roster = load_roster_allowlist()
        except FileNotFoundError as e:
            print(f"[ERROR] ROSTER_FILTER=1 but roster workbook missing: {e}")
            return 1
        allow_uuids, allow_jerseys_fold = catapult_roster_filters(DB_URL, roster)
        if not allow_uuids and not allow_jerseys_fold:
            print("[ERROR] ROSTER_FILTER=1 but no Catapult filter resolved.")
            return 1

    print("[INFO] Fetching activities...")
    activities = fetch_activities(headers, base)
    time.sleep(PAUSE_S)
    in_range = activities_in_range(activities, start_d, end_d)
    if args.match_silver_sessions:
        if not DB_URL:
            print("[ERROR] --match-silver-sessions requires DATABASE_URL", file=sys.stderr)
            return 1
        import psycopg2

        conn = psycopg2.connect(DB_URL)
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT DISTINCT activity_id::text FROM public.silver_catapult_session"
            )
            silver_ids = {row[0].lower() for row in cur.fetchall() if row[0]}
        finally:
            conn.close()
        before = len(in_range)
        in_range = [
            act for act in in_range if str(act.get("id", "")).lower() in silver_ids
        ]
        print(
            f"[INFO] --match-silver-sessions: {len(in_range)} of {before} "
            f"in-range activit(y/ies) ({len(silver_ids)} in silver)\n"
        )
    if args.max_activities is not None and args.max_activities > 0:
        in_range = in_range[: args.max_activities]
    print(f"[INFO] {len(in_range)} activit(y/ies) in range (of {len(activities)} total)\n")

    sessions: list[dict[str, Any]] = []

    for idx, act in enumerate(in_range):
        aid = act.get("id")
        name = act.get("name", "")
        act_date = _activity_date(act)
        if not aid:
            continue
        print(f"[{idx + 1}/{len(in_range)}] {name} ({aid})")

        athletes = fetch_activity_athletes(headers, base, aid)
        time.sleep(PAUSE_S)

        for j, ath in enumerate(athletes):
            ath_id = ath.get("id")
            if not ath_id:
                continue
            if allow_jerseys_fold is not None:
                jn = jersey_from_activity_athlete(ath)
                if not jn or jn.casefold() not in allow_jerseys_fold:
                    continue
            elif allow_uuids is not None and str(ath_id).strip().lower() not in allow_uuids:
                continue

            summary = fetch_jump_summary_for_athlete(headers, base, aid, ath_id)
            time.sleep(PAUSE_S)

            if summary.jump_event_count == 0 and summary.max_jump_attribute_cs is None:
                continue

            jersey = jersey_from_activity_athlete(ath)
            display_name = None
            for key in ("display_name", "name", "athlete_name", "full_name"):
                v = ath.get(key)
                if v and str(v).strip():
                    display_name = str(v).strip()
                    break

            sessions.append(
                {
                    "activity_id": aid,
                    "activity_name": name,
                    "activity_date": act_date.isoformat() if act_date else None,
                    "athlete_id": ath_id,
                    "athlete_jersey": jersey,
                    "athlete_display_name": display_name,
                    **summary.as_dict(),
                }
            )
            if (j + 1) % 10 == 0:
                print(f"    ... {j + 1}/{len(athletes)} athletes processed")

        print(f"    sessions with jumps: {len(sessions)}\n")

    payload = {
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "high_jump_min_cs": HIGH_JUMP_MIN_CS,
        "sessions": sessions,
    }

    with open(args.json_out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("=" * 50)
    print(f"Wrote {len(sessions)} athlete-session row(s) to {args.json_out}")
    print(f"High jump threshold: jump_attribute >= {HIGH_JUMP_MIN_CS} cs (0.{HIGH_JUMP_MIN_CS}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
