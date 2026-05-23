from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/whoop", tags=["whoop"])

# Silver table column reference:
# silver_whoop_recovery:
#   calendar_date, athlete_internal_key, athlete_display_name,
#   hrv_rmssd_milli, resting_heart_rate, recovery_score, spo2_percentage,
#   cycle_strain, score_state  (filter score_state = 'SCORED')
#
# silver_whoop_sleep:
#   calendar_date, athlete_internal_key, athlete_display_name,
#   sleep_performance_percentage, sleep_efficiency_percentage,
#   total_rem_sleep_time_milli, total_slow_wave_sleep_time_milli,
#   nap (boolean — filter nap = false for main sleep records)


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


@router.get("/recovery")
def get_recovery(
    athlete_key: Optional[str] = Query(None, description="athlete_internal_key"),
    days: int = Query(14, ge=1, le=365),
):
    client = get_client()
    since = _since(days)

    # Recovery rows — only SCORED cycles
    rec_q = (
        client.table("silver_whoop_recovery")
        .select("*")
        .gte("calendar_date", since)
        .eq("score_state", "SCORED")
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        rec_q = rec_q.eq("athlete_internal_key", athlete_key)
    recovery = rec_q.execute().data

    # Sleep rows — exclude naps
    sleep_q = (
        client.table("silver_whoop_sleep")
        .select("*")
        .gte("calendar_date", since)
        .eq("nap", False)
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        sleep_q = sleep_q.eq("athlete_internal_key", athlete_key)
    sleep = sleep_q.execute().data

    sleep_map = {
        (r.get("athlete_internal_key"), r.get("calendar_date")): r
        for r in sleep
    }

    result = []
    for r in recovery:
        s = sleep_map.get((r.get("athlete_internal_key"), r.get("calendar_date")), {})
        result.append({
            **r,
            # Normalise sleep columns — pull from sleep table if available
            "sleep_performance_percentage": (
                s.get("sleep_performance_percentage")
                or r.get("sleep_performance_percentage")
            ),
            "sleep_efficiency_percentage": (
                s.get("sleep_efficiency_percentage")
                or r.get("sleep_efficiency_percentage")
            ),
            "total_rem_sleep_time_milli": (
                s.get("total_rem_sleep_time_milli")
                or r.get("total_rem_sleep_time_milli")
            ),
            "total_slow_wave_sleep_time_milli": (
                s.get("total_slow_wave_sleep_time_milli")
                or r.get("total_slow_wave_sleep_time_milli")
            ),
            # Frontend-compat aliases
            "session_date": r.get("calendar_date"),
        })
    return result


@router.get("/hrv-trend")
def get_hrv_trend(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(14, ge=7, le=365),
):
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_whoop_recovery")
        .select(
            "athlete_internal_key, athlete_display_name, calendar_date,"
            "hrv_rmssd_milli, resting_heart_rate, recovery_score"
        )
        .gte("calendar_date", since)
        .eq("score_state", "SCORED")
        .order("calendar_date")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows


@router.get("/sleep")
def get_sleep(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(14, ge=1, le=365),
):
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_whoop_sleep")
        .select("*")
        .gte("calendar_date", since)
        .eq("nap", False)
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows


@router.get("/workout")
def get_workout(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(14, ge=1, le=365),
):
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_whoop_workout")
        .select("*")
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows
