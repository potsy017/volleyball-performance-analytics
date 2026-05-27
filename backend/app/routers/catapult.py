from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/catapult", tags=["catapult"])

# Silver table column reference:
#   calendar_date, athlete_internal_key, athlete_display_name, athlete_jersey,
#   activity_name, total_player_load, player_load_per_minute,
#   high_jump_count_ima_bands_6_8, total_distance, field_time


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


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
