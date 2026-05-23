from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/gymaware", tags=["gymaware"])

# Silver table column reference:
# silver_gymaware_summaries:
#   calendar_date, athlete_internal_key, athlete_display_name,
#   exercise_name, bar_weight, rep_count, mean_velocity, peak_velocity
#
# silver_gymaware_bests:
#   athlete_internal_key, exercise_name, bar_weight,
#   mean_velocity, peak_velocity   ← these ARE the PB values (no pb_ prefix)
#   NOTE: no pb_date column exists
#
# silver_gymaware_rep:
#   calendar_date, athlete_internal_key, exercise_name, bar_weight,
#   rep_number, mean_velocity, peak_velocity


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


@router.get("/sessions")
def get_sessions(
    athlete_key: Optional[str] = Query(None, description="athlete_internal_key"),
    from_date: Optional[str] = Query(None),
    exercise: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
):
    client = get_client()
    since = from_date if from_date else _since(days)

    query = (
        client.table("silver_gymaware_summaries")
        .select("*")
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .order("exercise_name")
        .order("bar_weight")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    if exercise:
        query = query.eq("exercise_name", exercise)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows


@router.get("/reps")
def get_reps(
    athlete_key: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    exercise: Optional[str] = Query(None),
    days: int = Query(14, ge=1, le=365),
):
    client = get_client()
    since = from_date if from_date else _since(days)

    query = (
        client.table("silver_gymaware_rep")
        .select("*")
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    if exercise:
        query = query.eq("exercise_name", exercise)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows


@router.get("/exercises")
def get_exercises(athlete_key: Optional[str] = Query(None)):
    client = get_client()
    query = (
        client.table("silver_gymaware_summaries")
        .select("exercise_name")
        .not_.is_("exercise_name", "null")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    res = query.execute()
    return sorted(set(r["exercise_name"] for r in res.data if r.get("exercise_name")))


@router.get("/pb")
def get_personal_bests(
    athlete_key: Optional[str] = Query(None),
    exercise: Optional[str] = Query(None),
):
    """
    Returns personal-best rows from silver_gymaware_bests.
    The mean_velocity and peak_velocity columns in this table ARE the PBs.
    """
    client = get_client()
    query = (
        client.table("silver_gymaware_bests")
        .select("*")
        .order("exercise_name")
        .order("bar_weight")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    if exercise:
        query = query.eq("exercise_name", exercise)

    rows = query.execute().data
    # Expose pb_ aliases so frontend doesn't need to change field names
    for r in rows:
        r["pb_mean_velocity"] = r.get("mean_velocity")
        r["pb_peak_velocity"] = r.get("peak_velocity")
    return rows


@router.get("/session-vs-pb")
def get_session_vs_pb(
    athlete_key: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    exercise: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
):
    client = get_client()
    since = from_date if from_date else _since(days)

    s_query = (
        client.table("silver_gymaware_summaries")
        .select(
            "athlete_internal_key, athlete_display_name, calendar_date,"
            "exercise_name, bar_weight, rep_count, mean_velocity, peak_velocity"
        )
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .order("exercise_name")
        .order("bar_weight")
    )
    if athlete_key:
        s_query = s_query.eq("athlete_internal_key", athlete_key)
    if exercise:
        s_query = s_query.eq("exercise_name", exercise)
    sessions = s_query.execute().data

    pb_query = client.table("silver_gymaware_bests").select("*")
    if athlete_key:
        pb_query = pb_query.eq("athlete_internal_key", athlete_key)
    pbs = pb_query.execute().data

    # Key: (athlete_internal_key, exercise_name, bar_weight)
    pb_map = {
        (p["athlete_internal_key"], p.get("exercise_name"), p.get("bar_weight")): p
        for p in pbs
    }

    result = []
    for s in sessions:
        key = (s["athlete_internal_key"], s.get("exercise_name"), s.get("bar_weight"))
        pb = pb_map.get(key, {})
        # In bests table, mean_velocity / peak_velocity are the PB values
        pb_mean = pb.get("mean_velocity")
        pb_peak = pb.get("peak_velocity")
        today_mean = s.get("mean_velocity")
        today_peak = s.get("peak_velocity")
        result.append({
            **s,
            "session_date": s.get("calendar_date"),
            "todays_mean_velocity": today_mean,
            "todays_peak_velocity": today_peak,
            "pb_mean_velocity": pb_mean,
            "pb_peak_velocity": pb_peak,
            "pb_date": None,  # not available in silver table
            "pct_of_pb_mean": (
                round((today_mean / pb_mean) * 100, 1)
                if today_mean and pb_mean else None
            ),
            "pct_of_pb_peak": (
                round((today_peak / pb_peak) * 100, 1)
                if today_peak and pb_peak else None
            ),
        })
    return result


@router.get("/velocity-trend")
def get_velocity_trend(
    athlete_key: str = Query(..., description="athlete_internal_key (required)"),
    exercise: str = Query(...),
    days: int = Query(90, ge=7, le=365),
):
    client = get_client()
    since = _since(days)

    sessions = (
        client.table("silver_gymaware_summaries")
        .select("calendar_date, bar_weight, mean_velocity, peak_velocity")
        .eq("athlete_internal_key", athlete_key)
        .eq("exercise_name", exercise)
        .gte("calendar_date", since)
        .order("calendar_date")
        .order("bar_weight")
        .execute().data
    )
    pbs = (
        client.table("silver_gymaware_bests")
        .select("bar_weight, mean_velocity, peak_velocity")
        .eq("athlete_internal_key", athlete_key)
        .eq("exercise_name", exercise)
        .execute().data
    )
    pb_map = {p["bar_weight"]: p for p in pbs}

    result = []
    for s in sessions:
        pb = pb_map.get(s["bar_weight"], {})
        pb_peak = pb.get("peak_velocity")
        today_peak = s.get("peak_velocity")
        result.append({
            **s,
            "session_date": s.get("calendar_date"),
            "todays_peak_velocity": today_peak,
            "pb_peak_velocity": pb_peak,
            "pct_of_pb_peak": (
                round((today_peak / pb_peak) * 100, 1)
                if today_peak and pb_peak else None
            ),
        })
    return result
