"""Detect stats sessions missing BMP jumps and re-export/upload from Catapult."""
from __future__ import annotations

import os
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Sequence

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]

JUMP_GAP_DATES_SQL = """
SELECT DISTINCT s.calendar_date::date AS gap_date
FROM public.silver_catapult_session s
WHERE s.calendar_date >= %(since)s
  AND s.athlete_internal_key IS NOT NULL
  AND btrim(s.athlete_internal_key) <> ''
  AND COALESCE(s.total_player_load, 0) > 0
  AND s.jump_event_count IS NULL
  AND s.high_jump_event_count IS NULL
ORDER BY 1;
"""


def skip_jump_sync() -> bool:
    return os.getenv("CATAPULT_SKIP_JUMP_SYNC", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def jump_sync_lookback_days(default: int = 14) -> int:
    for name in ("CATAPULT_JUMP_SYNC_LOOKBACK_DAYS", "SCHEDULED_LOAD_INDEX_LOOKBACK_DAYS"):
        raw = os.getenv(name, "").strip()
        if raw:
            try:
                return max(1, int(raw))
            except ValueError:
                pass
    return max(1, default)


def find_gap_dates(cur: Any, since: date) -> list[date]:
    cur.execute(JUMP_GAP_DATES_SQL, {"since": since})
    return [row[0] for row in cur.fetchall()]


def _jump_json_path() -> str:
    return os.getenv("CATAPULT_JUMP_EVENTS_JSON", "catapult_jump_events_export.json")


def run_jump_export_upload(start: str, end: str, root: Path | None = None) -> int:
    """Export BMP jumps for [start, end] inclusive and upload to Supabase."""
    base = root or ROOT
    py = sys.executable
    jump_json = _jump_json_path()
    export_cmd = [
        py,
        str(base / "catapult_jump_events.py"),
        "--start",
        start,
        "--end",
        end,
        "--json-out",
        jump_json,
    ]
    upload_cmd = [
        py,
        str(base / "upload_catapult_jump_events_to_supabase.py"),
        jump_json,
    ]
    for cmd in (export_cmd, upload_cmd):
        proc = subprocess.run(cmd, cwd=str(base))
        if proc.returncode != 0:
            return int(proc.returncode)
    return 0


def sync_jump_gaps(
    lookback_days: int | None = None,
    *,
    db_url: str | None = None,
    root: Path | None = None,
) -> dict[str, Any]:
    """
    Find roster stats sessions without BMP joins in the lookback window.
    When gaps exist, re-export and upload jumps for the min..max gap date range.
    """
    load_dotenv()
    if skip_jump_sync():
        return {"skipped": True, "reason": "CATAPULT_SKIP_JUMP_SYNC", "gap_dates": []}

    days = lookback_days if lookback_days is not None else jump_sync_lookback_days()
    since = datetime.now(timezone.utc).date() - timedelta(days=days - 1)
    url = db_url or os.getenv("DATABASE_URL")
    if not url:
        return {"skipped": True, "reason": "missing DATABASE_URL", "gap_dates": []}

    result: dict[str, Any] = {
        "skipped": False,
        "lookback_days": days,
        "since": since.isoformat(),
        "gap_dates": [],
        "synced": False,
        "window": None,
        "exit_code": 0,
        "remaining_gap_dates": [],
    }

    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        gap_dates = find_gap_dates(cur, since)
        cur.close()
        conn.close()
    except psycopg2.Error as exc:
        msg = str(exc).lower()
        if "silver_catapult_session" in msg or "does not exist" in msg:
            result["skipped"] = True
            result["reason"] = "silver views not applied"
            return result
        result["exit_code"] = 1
        result["error"] = str(exc)
        return result

    result["gap_dates"] = [d.isoformat() for d in gap_dates]
    if not gap_dates:
        print("[INFO] Catapult BMP jump sync: no stats/jump gaps in lookback window.")
        return result

    start = min(gap_dates).isoformat()
    end = max(gap_dates).isoformat()
    result["window"] = [start, end]
    print(
        f"[INFO] Catapult BMP jump sync: {len(gap_dates)} date(s) with stats but no BMP "
        f"({start} .. {end}). Re-exporting jumps..."
    )

    rc = run_jump_export_upload(start, end, root=root)
    result["exit_code"] = rc
    result["synced"] = rc == 0
    if rc != 0:
        print(f"[ERROR] Catapult BMP jump sync failed (exit {rc}).", file=sys.stderr)
        return result

    try:
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        remaining = find_gap_dates(cur, since)
        cur.close()
        conn.close()
        result["remaining_gap_dates"] = [d.isoformat() for d in remaining]
        if remaining:
            preview = ", ".join(result["remaining_gap_dates"][:8])
            extra = "" if len(remaining) <= 8 else f" (+{len(remaining) - 8} more)"
            print(
                f"[WARN] Catapult BMP jump sync: {len(remaining)} date(s) still missing BMP "
                f"after re-export: {preview}{extra}. "
                "Check Catapult API data or roster mapping.",
                file=sys.stderr,
            )
        else:
            print("[INFO] Catapult BMP jump sync: gaps cleared.")
    except psycopg2.Error as exc:
        result["warning"] = f"post-sync gap check failed: {exc}"

    return result
