from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from collections import defaultdict
from app.db.supabase import get_client
from app.utils.acwr import compute_acwr
from app.utils.jump_metrics import attach_high_jump_counts, fetch_jump_sessions

router = APIRouter(prefix="/catapult", tags=["catapult"])

# Silver table column reference:
#   calendar_date, athlete_internal_key, athlete_display_name, athlete_jersey,
#   activity_name, total_player_load, player_load_per_minute,
#   high jumps → silver_catapult_jump_session.high_jump_event_count
#   total_distance, field_time


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


def _date_spine(days: int) -> list[str]:
    """Every calendar day in the window (inclusive), oldest first."""
    end = date.today()
    start = end - timedelta(days=days - 1)
    out: list[str] = []
    d = start
    while d <= end:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


@router.get("/sessions")
def get_sessions(
    athlete_key: Optional[str] = Query(None, description="athlete_internal_key e.g. VB-5406785896"),
    days: int = Query(14, ge=1, le=365),
    activity: Optional[str] = Query(None),
):
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_catapult_session")
        .select("*")
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    if activity:
        query = query.eq("activity_name", activity)

    
    rows = query.execute().data
    jump_rows = fetch_jump_sessions(client, athlete_key=athlete_key, since=since)
    attach_high_jump_counts(rows, jump_rows)
    return rows
    


@router.get("/activities")
def get_activities(athlete_key: Optional[str] = Query(None)):
    """Returns distinct activity names ordered by most recent first."""
    client = get_client()
    query = (
        client.table("silver_catapult_session")
        .select("activity_name, calendar_date")
        .not_is_null("activity_name")
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    res = query.execute()
    # Deduplicate preserving most-recent-first order
    seen: set[str] = set()
    out: list[str] = []
    for r in res.data:
        name = r.get("activity_name")
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


@router.get("/load-trend")
def get_load_trend(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(28, ge=7, le=365),
):
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_catapult_session")
        .select(
            "athlete_internal_key, athlete_display_name, calendar_date,"
            "total_player_load, player_load_per_minute, total_distance, field_time"
        )
        .gte("calendar_date", since)
        .order("calendar_date")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    rows = query.execute().data
    jump_rows = fetch_jump_sessions(client, athlete_key=athlete_key, since=since)
    attach_high_jump_counts(rows, jump_rows)
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows


@router.get("/acwr-trend")
def get_acwr_trend(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(28, ge=7, le=180),
):
    """
    Daily acute/chronic load and ACWR for every calendar day in the window.
    Fetches extra history so rolling 28d chronic is correct at the start of the range.
    """
    client = get_client()
    since_history = _since(days + 28)   # extra 28 for chronic load baseline

    query = (
        client.table("silver_catapult_session")
        .select("athlete_internal_key, calendar_date, total_player_load")
        .gte("calendar_date", since_history)
        .order("calendar_date")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data or []

    athletes = {
        r.get("athlete_internal_key")
        for r in rows
        if r.get("athlete_internal_key")
    }
    target_athletes = [athlete_key] if athlete_key else sorted(athletes)
    if not target_athletes:
        return []

    by_athlete: dict[str, list] = defaultdict(list)
    for r in rows:
        akey = r.get("athlete_internal_key")
        if akey:
            by_athlete[akey].append(r)

    result = []
    for d in _date_spine(days):
        d_obj = date.fromisoformat(d)
        acute_vals: list[float] = []
        chronic_vals: list[float] = []
        acwr_vals: list[float] = []

        for akey in target_athletes:
            info = compute_acwr(by_athlete[akey], ref=d_obj)
            acute_vals.append(info["acute_load"])
            chronic_vals.append(info["chronic_load"])
            if info["acwr"] is not None:
                acwr_vals.append(info["acwr"])

        result.append({
            "session_date": d,
            "acute_load": (
                round(sum(acute_vals) / len(acute_vals), 1) if acute_vals else None
            ),
            "chronic_load": (
                round(sum(chronic_vals) / len(chronic_vals), 1) if chronic_vals else None
            ),
            "acwr": round(sum(acwr_vals) / len(acwr_vals), 2) if acwr_vals else None,
        })

    return result
