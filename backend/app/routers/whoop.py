from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/whoop", tags=["whoop"])

# View reference (all have athlete_internal_key, athlete_display_name, calendar_date):
#
# silver_whoop_recovery:
#   hrv_rmssd_milli, resting_heart_rate, recovery_score,
#   spo2_percentage, skin_temp_celsius, cycle_strain,
#   score_state  ← filter SCORED; view already prioritises SCORED via rn=1
#
# silver_whoop_sleep_longest_per_day:
#   sleep_performance_percentage, sleep_efficiency_percentage,
#   total_in_bed_time_milli, total_rem_sleep_time_milli,
#   total_slow_wave_sleep_time_milli, total_light_sleep_time_milli
#   (already deduped to 1 row per athlete per day — no nap filter needed)
#
# silver_whoop_workout:
#   sport_name, strain, average_heart_rate, max_heart_rate, kilojoule,
#   zone_zero_milli … zone_five_milli, score_state


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


def _milli_to_hours(ms) -> float | None:
    """Convert milliseconds to hours, rounded to 1 dp."""
    if ms is None:
        return None
    return round(ms / 3_600_000, 1)


@router.get("/recovery")
def get_recovery(
    athlete_key: Optional[str] = Query(None, description="athlete_internal_key"),
    days: int = Query(14, ge=1, le=365),
):
    client = get_client()
    since = _since(days)

    # --- Recovery rows (SCORED first, fallback to any) ---
    rec_q = (
        client.table("silver_whoop_recovery")
        .select("*")
        .gte("calendar_date", since)
        .eq("score_state", "SCORED")
        .order("calendar_date", desc=True)
        .limit(500)
    )
    if athlete_key:
        rec_q = rec_q.eq("athlete_internal_key", athlete_key)
    recovery = rec_q.execute().data or []

    # Fallback: no SCORED rows → fetch without filter
    if not recovery:
        rec_q2 = (
            client.table("silver_whoop_recovery")
            .select("*")
            .gte("calendar_date", since)
            .order("calendar_date", desc=True)
            .limit(500)
        )
        if athlete_key:
            rec_q2 = rec_q2.eq("athlete_internal_key", athlete_key)
        recovery = rec_q2.execute().data or []

    # --- Sleep rows from the pre-deduped daily view ---
    sleep_q = (
        client.table("silver_whoop_sleep_longest_per_day")
        .select(
            "athlete_internal_key, calendar_date,"
            "sleep_performance_percentage, sleep_efficiency_percentage,"
            "total_in_bed_time_milli, total_rem_sleep_time_milli,"
            "total_slow_wave_sleep_time_milli, total_light_sleep_time_milli"
        )
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .limit(500)
    )
    if athlete_key:
        sleep_q = sleep_q.eq("athlete_internal_key", athlete_key)
    sleep = sleep_q.execute().data or []

    sleep_map = {
        (r.get("athlete_internal_key"), r.get("calendar_date")): r
        for r in sleep
    }

    result = []
    for r in recovery:
        s = sleep_map.get((r.get("athlete_internal_key"), r.get("calendar_date")), {})
        result.append({
            **r,
            "session_date": r.get("calendar_date"),
            # Sleep columns — prefer sleep table, fall back to recovery row
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
            "total_light_sleep_time_milli": s.get("total_light_sleep_time_milli"),
            "total_in_bed_time_milli":       s.get("total_in_bed_time_milli"),
            # Hour conversions for the frontend
            "rem_hours":   _milli_to_hours(
                s.get("total_rem_sleep_time_milli") or r.get("total_rem_sleep_time_milli")
            ),
            "deep_hours":  _milli_to_hours(
                s.get("total_slow_wave_sleep_time_milli") or r.get("total_slow_wave_sleep_time_milli")
            ),
            "light_hours": _milli_to_hours(s.get("total_light_sleep_time_milli")),
            "in_bed_hours": _milli_to_hours(s.get("total_in_bed_time_milli")),
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
            "hrv_rmssd_milli, resting_heart_rate, recovery_score, cycle_strain"
        )
        .gte("calendar_date", since)
        .eq("score_state", "SCORED")
        .order("calendar_date")
        .limit(500)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data or []
    for r in rows:
        r["session_date"] = r.get("calendar_date")
    return rows


@router.get("/sleep")
def get_sleep(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(14, ge=1, le=365),
):
    """
    Returns one sleep row per athlete per day using the pre-deduped view.
    Already excludes naps and picks the longest main sleep per day.
    """
    client = get_client()
    since = _since(days)

    query = (
        client.table("silver_whoop_sleep_longest_per_day")
        .select("*")
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .limit(500)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data or []
    for r in rows:
        r["session_date"]  = r.get("calendar_date")
        r["rem_hours"]     = _milli_to_hours(r.get("total_rem_sleep_time_milli"))
        r["deep_hours"]    = _milli_to_hours(r.get("total_slow_wave_sleep_time_milli"))
        r["light_hours"]   = _milli_to_hours(r.get("total_light_sleep_time_milli"))
        r["in_bed_hours"]  = _milli_to_hours(r.get("total_in_bed_time_milli"))
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
        .select(
            "athlete_internal_key, athlete_display_name, calendar_date,"
            "sport_name, strain, average_heart_rate, max_heart_rate, kilojoule,"
            "zone_zero_milli, zone_one_milli, zone_two_milli,"
            "zone_three_milli, zone_four_milli, zone_five_milli,"
            "score_state"
        )
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .limit(500)
    )
    if athlete_key:
        query = query.eq("athlete_internal_key", athlete_key)

    rows = query.execute().data or []
    for r in rows:
        r["session_date"] = r.get("calendar_date")
        # Total time in HR zones (hours)
        total_ms = sum(
            r.get(z) or 0
            for z in ["zone_zero_milli", "zone_one_milli", "zone_two_milli",
                      "zone_three_milli", "zone_four_milli", "zone_five_milli"]
        )
        r["total_workout_hours"] = _milli_to_hours(total_ms) if total_ms else None
        # Calories: 1 kJ ≈ 0.239 kcal
        kj = r.get("kilojoule")
        r["calories_kcal"] = round(kj * 0.239, 0) if kj is not None else None
    return rows
