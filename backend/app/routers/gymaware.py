from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client
from app.gymaware_exercises import (
    exercise_names_for_query,
    list_canonical_exercises,
    normalize_exercise_name,
    normalize_row_exercise,
)
from app.gymaware_load_velocity import (
    STANDARD_LOAD_STEPS_KG,
    build_pb_benchmark,
    build_session_profiles_from_sets,
)

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


def _apply_exercise_filter(query, exercise: str | None):
    if not exercise:
        return query
    names = exercise_names_for_query(exercise)
    if len(names) == 1:
        return query.eq("exercise_name", names[0])
    return query.in_("exercise_name", names)


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
    query = _apply_exercise_filter(query, exercise)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return [normalize_row_exercise(r) for r in rows]


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
    query = _apply_exercise_filter(query, exercise)

    rows = query.execute().data
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return [normalize_row_exercise(r) for r in rows]


@router.get("/exercises")
def get_exercises(athlete_key: Optional[str] = Query(None)):
    client = get_client()
    query = (
        client.table("silver_gymaware_summaries")
        .select("exercise_name")
        .not_is_null("exercise_name")
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)
    res = query.execute()
    raw = [r["exercise_name"] for r in res.data if r.get("exercise_name")]
    return list_canonical_exercises(raw)


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
    query = _apply_exercise_filter(query, exercise)

    rows = query.execute().data
    out = []
    for r in rows:
        r = normalize_row_exercise(r)
        r["pb_mean_velocity"] = r.get("mean_velocity")
        r["pb_peak_velocity"] = r.get("peak_velocity")
        out.append(r)
    return out


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
    s_query = _apply_exercise_filter(s_query, exercise)
    sessions = s_query.execute().data

    pb_query = client.table("silver_gymaware_bests").select("*")
    if athlete_key:
        pb_query = pb_query.eq("athlete_internal_key", athlete_key)
    pb_query = _apply_exercise_filter(pb_query, exercise)
    pbs = pb_query.execute().data

    # Key: (athlete_internal_key, canonical exercise_name, bar_weight)
    pb_map = {
        (
            p["athlete_internal_key"],
            normalize_exercise_name(p.get("exercise_name")),
            p.get("bar_weight"),
        ): p
        for p in pbs
    }

    result = []
    for s in sessions:
        s = normalize_row_exercise(s)
        key = (
            s["athlete_internal_key"],
            s.get("exercise_name"),
            s.get("bar_weight"),
        )
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


@router.get("/vl-profile")
def get_vl_profile(
    athlete_key: str = Query(..., description="athlete_internal_key (required)"),
    exercise: str = Query(..., description="exercise_name (required)"),
    days: int = Query(90, ge=14, le=365),
):
    """
    Load-velocity profile per session date using linear regression.
    For each date with ≥2 load-velocity pairs, returns:
      v0  — velocity at load=0  (Y-intercept)
      l0  — load at velocity=0  (X-intercept)
      r²  — goodness of fit
    """
    from collections import defaultdict

    client = get_client()
    since = _since(days)

    q = (
        client.table("silver_gymaware_summaries")
        .select("calendar_date, bar_weight, mean_velocity, peak_velocity")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date")
        .order("bar_weight")
    )
    q = _apply_exercise_filter(q, exercise)
    rows = q.execute().data or []

    # Group by date → list of (load, velocity) pairs using peak velocity
    by_date = defaultdict(list)
    for r in rows:
        d    = r.get("calendar_date")
        load = r.get("bar_weight")
        vel  = r.get("peak_velocity")
        if d and load is not None and vel is not None:
            by_date[d].append((float(load), float(vel)))

    result = []
    for session_date in sorted(by_date.keys()):
        pairs = by_date[session_date]
        if len(pairs) < 2:
            continue

        # Least-squares linear regression: velocity = slope * load + intercept
        n      = len(pairs)
        sum_x  = sum(p[0] for p in pairs)
        sum_y  = sum(p[1] for p in pairs)
        sum_xy = sum(p[0] * p[1] for p in pairs)
        sum_xx = sum(p[0] ** 2 for p in pairs)

        denom = n * sum_xx - sum_x ** 2
        if denom == 0:
            continue

        slope     = (n * sum_xy - sum_x * sum_y) / denom
        intercept = (sum_y - slope * sum_x) / n

        v0 = round(intercept, 3)                               # velocity at load=0
        l0 = round(-intercept / slope, 1) if slope != 0 else None  # load at vel=0

        # R²
        mean_y = sum_y / n
        ss_tot = sum((p[1] - mean_y) ** 2 for p in pairs)
        ss_res = sum((p[1] - (slope * p[0] + intercept)) ** 2 for p in pairs)
        r2 = round(1 - ss_res / ss_tot, 3) if ss_tot > 0 else None

        result.append({
            "session_date": session_date,
            "v0":         v0,
            "l0":         l0,
            "slope":      round(slope, 5),
            "r_squared":  r2,
            "n_sets":     n,
            "points": [{"load": p[0], "velocity": p[1]} for p in pairs],
        })

    return result


@router.get("/load-velocity-analysis")
def get_load_velocity_analysis(
    athlete_key: str = Query(..., description="athlete_internal_key (required)"),
    exercise: str = Query(...),
    days: int = Query(365, ge=30, le=730),
):
    """
    Per-session load–velocity lines on standard kg steps (25–105), from set summaries.
    Each session needs ≥2 distinct loads; velocities are mean peak per load within the session.
    """
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_gymaware_summaries")
        .select("calendar_date, bar_weight, peak_velocity, rep_count")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date", desc=False)
    )
    query = _apply_exercise_filter(query, exercise)
    rows = query.execute().data or []

    session_profiles = build_session_profiles_from_sets(rows)

    pb_query = (
        client.table("silver_gymaware_bests")
        .select("bar_weight, peak_velocity, mean_velocity")
        .eq("athlete_internal_key", athlete_key)
    )
    pb_query = _apply_exercise_filter(pb_query, exercise)
    pb_rows = pb_query.execute().data or []
    pb_benchmark = build_pb_benchmark(pb_rows)

    lmax_vmax_trend = [
        {"session_date": s["session_date"], "lmax": s["lmax"], "vmax": s["vmax"]}
        for s in session_profiles
        if s.get("lmax") is not None or s.get("vmax") is not None
    ]

    return {
        "exercise": exercise,
        "standard_loads_kg": list(STANDARD_LOAD_STEPS_KG),
        "session_profiles": session_profiles,
        "pb_benchmark": pb_benchmark,
        "lmax_vmax_trend": lmax_vmax_trend,
    }


@router.get("/velocity-trend")
def get_velocity_trend(
    athlete_key: str = Query(..., description="athlete_internal_key (required)"),
    exercise: str = Query(...),
    days: int = Query(90, ge=7, le=365),
):
    client = get_client()
    since = _since(days)

    sq = (
        client.table("silver_gymaware_summaries")
        .select("calendar_date, bar_weight, mean_velocity, peak_velocity")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date")
        .order("bar_weight")
    )
    sessions = _apply_exercise_filter(sq, exercise).execute().data

    pq = (
        client.table("silver_gymaware_bests")
        .select("bar_weight, mean_velocity, peak_velocity")
        .eq("athlete_internal_key", athlete_key)
    )
    pbs = _apply_exercise_filter(pq, exercise).execute().data
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
