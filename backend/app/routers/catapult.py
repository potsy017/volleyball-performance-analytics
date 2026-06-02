from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from collections import defaultdict
from app.db.supabase import get_client

router = APIRouter(prefix="/catapult", tags=["catapult"])

# Silver table column reference:
#   calendar_date, athlete_internal_key, athlete_display_name, athlete_jersey,
#   activity_name, total_player_load, player_load_per_minute,
#   high_jump_count_ima_bands_6_8, total_distance, field_time


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
    # Normalise jump column name for frontend consistency
    for r in rows:
        r["high_jump_count"] = r.get("high_jump_count_ima_bands_6_8")
    return rows


@router.get("/activities")
def get_activities(athlete_key: Optional[str] = Query(None)):
    client = get_client()
    query = (
        client.table("silver_catapult_session")
        .select("activity_name")
        .not_is_null("activity_name")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    res = query.execute()
    return sorted(set(r["activity_name"] for r in res.data if r.get("activity_name")))


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
            "total_player_load, player_load_per_minute,"
            "high_jump_count_ima_bands_6_8, total_distance, field_time"
        )
        .gte("calendar_date", since)
        .order("calendar_date")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data
    for r in rows:
        # Expose consistent alias for charts
        r["high_jump_count"] = r.get("high_jump_count_ima_bands_6_8")
        # session_date alias so frontend charts that used session_date still work
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

    # Build daily load totals per athlete
    # daily_load[date][athlete_key] = total_load_that_day
    daily_load = defaultdict(lambda: defaultdict(float))
    athletes   = set()
    for r in rows:
        akey = r.get("athlete_internal_key")
        cal  = r.get("calendar_date")
        load = r.get("total_player_load") or 0.0
        if akey and cal:
            daily_load[cal][akey] += load
            athletes.add(akey)

    # One row per calendar day in the display window (rest days included) so line
    # charts stay continuous like the hosted dashboard.
    target_athletes = [athlete_key] if athlete_key else sorted(athletes)
    if not target_athletes:
        return []

    result = []
    for d in _date_spine(days):
        d_obj = date.fromisoformat(d)
        all_acute: list[float] = []
        all_chronic: list[float] = []
        acwr_vals: list[float] = []

        for akey in target_athletes:
            acute_sum = sum(
                daily_load.get((d_obj - timedelta(days=i)).isoformat(), {}).get(akey, 0.0)
                for i in range(7)
            )
            chronic_sum = sum(
                daily_load.get((d_obj - timedelta(days=i)).isoformat(), {}).get(akey, 0.0)
                for i in range(28)
            )
            acute = acute_sum / 7
            chronic = chronic_sum / 28
            all_acute.append(acute)
            all_chronic.append(chronic)
            if chronic > 0:
                acwr_vals.append(acute / chronic)

        result.append({
            "session_date": d,
            "acute_load": round(sum(all_acute) / len(all_acute), 1) if all_acute else None,
            "chronic_load": round(sum(all_chronic) / len(all_chronic), 1) if all_chronic else None,
            "acwr": round(sum(acwr_vals) / len(acwr_vals), 2) if acwr_vals else None,
        })

    return result
