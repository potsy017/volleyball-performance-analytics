from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client
from app.utils.acwr import compute_acwr, date_spine
from app.utils.jump_metrics import (
    attach_high_jump_counts,
    avg_daily_high_jumps,
    avg_daily_total_jumps,
    daily_high_band_ratio_pct,
    daily_high_jump_totals,
    daily_max_jump_height_cm,
    daily_total_jump_totals,
    fetch_jump_sessions,
    latest_and_peak_high_jumps,
    latest_and_peak_total_jumps,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Silver table identifiers:
#   athlete_internal_key (text)  — used for filtering
#   athlete_display_name (text)  — display field
#   calendar_date (date)         — date column in ALL silver tables
#
# Key column aliases per table:
#   catapult  → total_player_load, player_load_per_minute, total_distance, field_time
#   jumps     → silver_catapult_jump_session.high_jump_event_count (BMP)
#   recovery  → hrv_rmssd_milli, resting_heart_rate, recovery_score,
#               cycle_strain  (NOT workout_strain)
#               score_state = 'SCORED' filter required
#   gymaware  → mean_velocity, peak_velocity


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


def _safe_avg(items, key):
    vals = [r[key] for r in items if r.get(key) is not None]
    return round(sum(vals) / len(vals), 2) if vals else None


@router.get("/kpis")
def get_kpis(
    athlete_key: Optional[str] = Query(None, description="athlete_internal_key"),
    days: int = Query(7, ge=1, le=365),
):
    client = get_client()
    since = _since(days)

    def _q(table, cols, extra_filters=None):
        q = client.table(table).select(cols).gte("calendar_date", since)
        if athlete_key:
            q = q.eq("athlete_internal_key", athlete_key)
        if extra_filters:
            for field, val in extra_filters.items():
                q = q.eq(field, val)
        return q.execute().data

    cat = _q(
        "silver_catapult_session",
        "athlete_internal_key, calendar_date, total_player_load,"
        "player_load_per_minute, field_time",
    )
    jump_rows = fetch_jump_sessions(client, athlete_key=athlete_key, since=since)
    # Try SCORED first; fall back to any available row if none
    rec = _q(
        "silver_whoop_recovery",
        "athlete_internal_key, calendar_date, hrv_rmssd_milli,"
        "resting_heart_rate, recovery_score",
        extra_filters={"score_state": "SCORED"},
    )
    if not rec:
        rec = _q(
            "silver_whoop_recovery",
            "athlete_internal_key, calendar_date, hrv_rmssd_milli,"
            "resting_heart_rate, recovery_score",
        )
        

    # Latest session row (most recent by date)
    cat_sorted = sorted(cat, key=lambda x: x.get("calendar_date") or "", reverse=True)
    rec_sorted = sorted(rec, key=lambda x: x.get("calendar_date") or "", reverse=True)
    latest_cat = cat_sorted[0] if cat_sorted else {}
    latest_rec = rec_sorted[0] if rec_sorted else {}
    latest_high, _, latest_jump_date = latest_and_peak_high_jumps(jump_rows)
    latest_total, _, latest_total_date = latest_and_peak_total_jumps(jump_rows)

    return {
        # Period averages
        "avg_player_load_per_min":  _safe_avg(cat, "player_load_per_minute"),
        "avg_high_jumps":           avg_daily_high_jumps(jump_rows),
        "avg_total_jumps":          avg_daily_total_jumps(jump_rows),
        "total_player_load":        round(
            sum(r["total_player_load"] for r in cat if r.get("total_player_load")), 1
        ),
        "avg_hrv":        _safe_avg(rec, "hrv_rmssd_milli"),
        "avg_recovery":   _safe_avg(rec, "recovery_score"),
        "avg_resting_hr": _safe_avg(rec, "resting_heart_rate"),
        "sessions_count": len(set(
            (r["calendar_date"], r["athlete_internal_key"]) for r in cat
        )),
        # Latest session values (used when a single athlete is selected)
        "latest_player_load":   latest_cat.get("total_player_load"),
        "latest_load_per_min":  latest_cat.get("player_load_per_minute"),
        "latest_high_jumps":    latest_high,
        "latest_total_jumps":   latest_total,
        "latest_session_date":  (
            latest_jump_date or latest_total_date or latest_cat.get("calendar_date")
        ),
        "latest_hrv":           latest_rec.get("hrv_rmssd_milli"),
        "latest_recovery":      latest_rec.get("recovery_score"),
        "latest_recovery_date": latest_rec.get("calendar_date"),
    }


@router.get("/summary")
def get_summary(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=365),
):
    client = get_client()
    since = _since(days)

    def _safe_q(table, source_label, extra_eq=None):
        """Fetch rows and tag with source. Returns [] on any error."""
        try:
            q = (
                client.table(table)
                .select("*")
                .gte("calendar_date", since)
                .order("calendar_date")          # ascending for charts
                .limit(500)
            )
            if athlete_key:
                q = q.eq("athlete_internal_key", athlete_key)
            if extra_eq:
                for col, val in extra_eq.items():
                    q = q.eq(col, val)
            rows = q.execute().data or []
            for r in rows:
                r["source"] = source_label
                r["session_date"] = r.get("calendar_date")
            return rows
        except Exception:
            return []

    gym   = _safe_q("silver_gymaware_summaries", "gymaware")
    whoop = _safe_q("silver_whoop_recovery", "whoop", extra_eq={"score_state": "SCORED"})
    cat = _safe_q("silver_catapult_session", "catapult")

    jump_rows = fetch_jump_sessions(
        client, athlete_key=athlete_key, since=since, limit=2000
    )
    attach_high_jump_counts(cat, jump_rows)

    return cat + gym + whoop


@router.get("/daily-jumps")
def get_daily_jumps(
    athlete_key: Optional[str] = Query(None),
    days: int = Query(28, ge=7, le=365),
):
    """Dense calendar spine with BMP daily total + high jump counts."""
    jump_rows = fetch_jump_sessions(
        get_client(), athlete_key=athlete_key, since=_since(days), limit=5000
    )
    high_by_day = daily_high_jump_totals(jump_rows)
    total_by_day = daily_total_jump_totals(jump_rows)
    return [
        {
            "session_date": d,
            "total_jumps": total_by_day.get(d),
            "high_jump_count": high_by_day.get(d),
        }
        for d in date_spine(days)
    ]


def _acwr_status(acwr) -> str:
    """Traffic light based on Acute:Chronic Workload Ratio.
    Coach's bounds: green 0.8–1.4 | amber 1.4–1.5 or 0.5–0.8 | red >1.5 or <0.5
    """
    if acwr is None:
        return "gray"
    if acwr > 1.5 or acwr < 0.5:
        return "red"
    if acwr > 1.4 or acwr < 0.8:
        return "amber"
    return "green"


@router.get("/team-snapshot")
def get_team_snapshot():
    client = get_client()

    since_28 = _since(28)
    since_7  = _since(7)

    # Fetch 28 days of catapult data for ACWR computation + latest session info
    cat = (
        client.table("silver_catapult_session")
        .select(
            "athlete_internal_key, athlete_display_name, calendar_date,"
            "total_player_load, player_load_per_minute"
        )
        .gte("calendar_date", since_28)
        .order("calendar_date", desc=True)
        .limit(5000)
        .execute().data
    ) or []

    jump_rows = fetch_jump_sessions(client, since=since_28, limit=5000)
    jump_by_athlete: dict[str, list[dict]] = {}
    for j in jump_rows:
        akey = j.get("athlete_internal_key")
        if akey:
            jump_by_athlete.setdefault(akey, []).append(j)

    rec = (
        client.table("silver_whoop_recovery")
        .select(
            "athlete_internal_key, athlete_display_name, calendar_date,"
            "hrv_rmssd_milli, recovery_score"
        )
        .eq("score_state", "SCORED")
        .order("calendar_date", desc=True)
        .execute().data
    ) or []

    # Build athlete registry
    seen = {}
    for r in cat:
        akey = r.get("athlete_internal_key")
        if not akey:
            continue
        if akey not in seen:
            seen[akey] = {
                "athlete_internal_key": akey,
                "athlete_name": r.get("athlete_display_name", ""),
                "jersey": None,
                "last_session": None,
                "player_load": None,
                "load_per_min": None,
                "high_jumps": None,
                "total_jumps": None,
                "hrv": None,
                "recovery": None,
                "acwr": None,
                "acute_load": None,
                "chronic_load": None,
                "acwr_status": "gray",
            }
        row = seen[akey]
        load = r.get("total_player_load")
        cal  = r.get("calendar_date", "")
        # Latest session values (first row per athlete since ordered desc)
        if row["player_load"] is None and load is not None:
            row["last_session"] = cal
            row["player_load"]  = load
            row["load_per_min"] = r.get("player_load_per_minute")

    for akey, row in seen.items():
        athlete_jumps = jump_by_athlete.get(akey, [])
        latest_high, _, _ = latest_and_peak_high_jumps(athlete_jumps)
        latest_total, _, _ = latest_and_peak_total_jumps(athlete_jumps)
        row["high_jumps"] = latest_high
        row["total_jumps"] = latest_total

    # Compute ACWR per athlete (daily totals — same as acwr-trend)
    for akey, row in seen.items():
        row.pop("_loads_28", None)
        row.pop("_loads_7", None)
        athlete_cat = [r for r in cat if r.get("athlete_internal_key") == akey]
        acwr_info = compute_acwr(athlete_cat, chronic_days=28)
        row["acute_load"]   = acwr_info["acute_load"]
        row["chronic_load"] = acwr_info["chronic_load"]
        row["acwr"]         = acwr_info["acwr"]
        row["acwr_status"]  = _acwr_status(acwr_info["acwr"])

    # Latest WHOOP recovery per athlete
    for r in rec:
        akey = r.get("athlete_internal_key")
        if akey in seen and seen[akey]["hrv"] is None:
            seen[akey]["hrv"]      = r.get("hrv_rmssd_milli")
            seen[akey]["recovery"] = r.get("recovery_score")

    return sorted(seen.values(), key=lambda x: x["athlete_name"] or "")


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _session_jump_total(r: dict) -> float | None:
    for key in ("jump_event_count", "total_jumps", "indoor_analytics_total_jump_count"):
        v = _num(r.get(key))
        if v is not None:
            return v
    return None


@router.get("/radar-metrics")
def get_radar_metrics(
    athlete_key: str = Query(..., description="athlete_internal_key"),
    days: int = Query(30, ge=7, le=90),
):
    """
    Raw inputs for AthleteRadarChart: latest session values vs 30d baselines.
    WHOOP axes included when recovery (or sleep efficiency) exists in the window.
    """
    client = get_client()
    since = _since(days)
    since_acwr = _since(max(days, 28))

    cat = (
        client.table("silver_catapult_session")
        .select(
            "calendar_date, total_player_load, player_load_per_minute, total_jumps"
        )
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .limit(500)
        .execute()
        .data
    ) or []

    jump_rows = fetch_jump_sessions(
        client, athlete_key=athlete_key, since=since, limit=500
    )
    latest_high, max_high, latest_jump_date = latest_and_peak_high_jumps(jump_rows)

    gym = (
        client.table("silver_gymaware_summaries")
        .select("calendar_date, peak_velocity")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .not_is_null("peak_velocity")
        .order("calendar_date", desc=True)
        .limit(2000)
        .execute()
        .data
    ) or []

    rec = (
        client.table("silver_whoop_recovery")
        .select("calendar_date, recovery_score, score_state")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .limit(100)
        .execute()
        .data
    ) or []

    sleep = (
        client.table("silver_whoop_sleep_longest_per_day")
        .select("calendar_date, sleep_efficiency_percentage")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date", desc=True)
        .limit(100)
        .execute()
        .data
    ) or []

    cat_acwr = (
        client.table("silver_catapult_session")
        .select("calendar_date, total_player_load")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since_acwr)
        .order("calendar_date", desc=True)
        .limit(500)
        .execute()
        .data
    ) or []
    acwr_info = compute_acwr(cat_acwr, chronic_days=max(days, 28))
    acwr = acwr_info["acwr"]

    latest_cat = cat[0] if cat else {}
    totals_by_day = daily_total_jump_totals(jump_rows)
    jump_totals = list(totals_by_day.values()) if totals_by_day else []
    if not jump_totals:
        jump_totals = [v for v in (_session_jump_total(r) for r in cat) if v is not None]
    latest_total_date = max(totals_by_day.keys()) if totals_by_day else None
    current_total_jumps = (
        totals_by_day.get(latest_total_date) if latest_total_date else None
    )
    if current_total_jumps is None:
        current_total_jumps = _session_jump_total(latest_cat)
    load_per_mins = [
        _num(r.get("player_load_per_minute"))
        for r in cat
        if _num(r.get("player_load_per_minute")) is not None
    ]

    # Per-day max peak velocity (any exercise) for power index
    peak_by_day: dict[str, float] = {}
    for r in gym:
        d = r.get("calendar_date") or ""
        pv = _num(r.get("peak_velocity"))
        if pv is None:
            continue
        peak_by_day[d] = max(peak_by_day.get(d, 0), pv)
    daily_peaks = list(peak_by_day.values())
    latest_gym_date = max(peak_by_day.keys()) if peak_by_day else None
    current_peak = peak_by_day.get(latest_gym_date) if latest_gym_date else None

    latest_rec = next(
        (r for r in rec if r.get("score_state") == "SCORED"),
        rec[0] if rec else None,
    )
    latest_sleep = sleep[0] if sleep else None
    recovery = _num(latest_rec.get("recovery_score")) if latest_rec else None
    sleep_eff = _num(latest_sleep.get("sleep_efficiency_percentage")) if latest_sleep else None

    has_whoop = recovery is not None or sleep_eff is not None

    return {
        "athlete_internal_key": athlete_key,
        "window_days": days,
        "has_whoop": has_whoop,
        "has_acwr": acwr_info["has_acwr"],
        "current": {
            "peak_velocity": current_peak,
            "total_jumps": current_total_jumps,
            "high_jumps": latest_high,
            "load_per_min": _num(latest_cat.get("player_load_per_minute")),
            "acwr": acwr,
            "acute_load": acwr_info["acute_load"],
            "chronic_load": acwr_info["chronic_load"],
            "whoop_recovery": recovery,
            "whoop_sleep_efficiency": sleep_eff,
            "session_date": latest_jump_date or latest_cat.get("calendar_date"),
        },
        "baseline_30d": {
            "avg_peak_velocity": (
                round(sum(daily_peaks) / len(daily_peaks), 3) if daily_peaks else None
            ),
            "max_total_jumps": max(jump_totals) if jump_totals else None,
            "max_high_jumps": max_high,
            "avg_load_per_min": (
                round(sum(load_per_mins) / len(load_per_mins), 3) if load_per_mins else None
            ),
        },
    }


def _milli_to_hours(ms) -> float | None:
    if ms is None:
        return None
    try:
        return round(float(ms) / 3_600_000, 2)
    except (TypeError, ValueError):
        return None


@router.get("/triad-risk")
def get_triad_risk(
    athlete_key: str = Query(..., description="athlete_internal_key"),
    days: int = Query(14, ge=7, le=90),
    baseline_days: int = Query(30, ge=14, le=90),
):
    """
    Triad: ACWR (workload), WHOOP deep sleep (repair), Catapult max jump / high-band ratio (CNS).
    Jump decrement uses 30d max height ceiling; ratio fallback when BMP height is sparse.
    """
    client = get_client()
    since = _since(days)
    since_baseline = _since(baseline_days)
    since_history = _since(max(days, 28) + 28)

    cat_rows = (
        client.table("silver_catapult_session")
        .select("calendar_date, total_player_load")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since_history)
        .order("calendar_date")
        .limit(5000)
        .execute()
        .data
    ) or []

    jump_rows = fetch_jump_sessions(
        client,
        athlete_key=athlete_key,
        since=since_baseline,
        limit=2000,
        cols=(
            "calendar_date, high_jump_event_count, jump_event_count,"
            "max_jump_height_cm"
        ),
    )

    sleep_rows = (
        client.table("silver_whoop_sleep_longest_per_day")
        .select("calendar_date, total_slow_wave_sleep_time_milli")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since_baseline)
        .order("calendar_date")
        .limit(500)
        .execute()
        .data
    ) or []

    max_jump_by_day = daily_max_jump_height_cm(jump_rows)
    ratio_by_day = daily_high_band_ratio_pct(jump_rows)

    jump_ceiling_30 = (
        max(max_jump_by_day.values()) if max_jump_by_day else None
    )
    jump_drop_pct = 10
    jump_floor_cm = (
        round(jump_ceiling_30 * (1 - jump_drop_pct / 100), 1)
        if jump_ceiling_30 is not None
        else None
    )

    ratio_vals_30 = list(ratio_by_day.values())
    ratio_baseline_30 = (
        round(sum(ratio_vals_30) / len(ratio_vals_30), 1) if ratio_vals_30 else None
    )
    ratio_floor_pct = (
        round(ratio_baseline_30 * 0.67, 1) if ratio_baseline_30 is not None else None
    )

    # Prefer max jump height when enough BMP height days in baseline window
    use_ratio_mode = len(max_jump_by_day) < 3 and len(ratio_by_day) >= 3
    if use_ratio_mode:
        neuromuscular_metric = "high_band_ratio"
        neuromuscular_unit = "%"
    elif max_jump_by_day:
        neuromuscular_metric = "max_jump_height"
        neuromuscular_unit = "cm"
    elif ratio_by_day:
        neuromuscular_metric = "high_band_ratio"
        neuromuscular_unit = "%"
        use_ratio_mode = True
    else:
        neuromuscular_metric = None
        neuromuscular_unit = None

    deep_by_day: dict[str, float] = {}
    for r in sleep_rows:
        d = str(r.get("calendar_date") or "")
        h = _milli_to_hours(r.get("total_slow_wave_sleep_time_milli"))
        if d and h is not None:
            deep_by_day[d] = h

    deep_vals_30 = list(deep_by_day.values())
    deep_avg_30 = (
        round(sum(deep_vals_30) / len(deep_vals_30), 2) if deep_vals_30 else None
    )
    deep_min_30 = min(deep_vals_30) if deep_vals_30 else None
    deep_floor = round(deep_min_30, 2) if deep_min_30 is not None else 1.0

    acwr_high = 1.5
    jump_drop_pct_param = jump_drop_pct
    critical_dates: list[str] = []
    series = []

    for d in date_spine(days):
        d_obj = date.fromisoformat(d)
        acwr_info = compute_acwr(cat_rows, ref=d_obj)
        acwr = acwr_info["acwr"]
        deep = deep_by_day.get(d)
        jump_h = max_jump_by_day.get(d)
        ratio_pct = ratio_by_day.get(d)

        if use_ratio_mode:
            neuro_value = ratio_pct
            neuro_risk = (
                neuro_value is not None
                and ratio_floor_pct is not None
                and neuro_value < ratio_floor_pct
            )
        else:
            neuro_value = jump_h
            neuro_risk = (
                neuro_value is not None
                and jump_floor_cm is not None
                and neuro_value < jump_floor_cm
            )

        acwr_risk = acwr is not None and acwr > acwr_high
        sleep_risk = deep is not None and deep < deep_floor
        critical = acwr_risk and sleep_risk and neuro_risk
        if critical:
            critical_dates.append(d)

        series.append({
            "calendar_date": d,
            "acwr": acwr,
            "deep_sleep_hours": deep,
            "max_jump_height_cm": round(jump_h, 1) if jump_h is not None else None,
            "high_band_ratio_pct": ratio_pct,
            "neuromuscular_value": neuro_value,
            "neuromuscular_unit": neuromuscular_unit,
            "acwr_risk": acwr_risk,
            "sleep_risk": sleep_risk,
            "neuromuscular_risk": neuro_risk,
            "power_risk": neuro_risk,
            "critical_risk": critical,
        })

    return {
        "athlete_internal_key": athlete_key,
        "days": days,
        "baseline_days": baseline_days,
        "thresholds": {
            "acwr_high": acwr_high,
            "deep_sleep_min_hours": deep_floor,
            "deep_sleep_avg_hours": deep_avg_30,
            "neuromuscular_metric": neuromuscular_metric,
            "neuromuscular_unit": neuromuscular_unit,
            "jump_ceiling_30d_cm": jump_ceiling_30,
            "jump_floor_cm": jump_floor_cm,
            "jump_drop_pct": jump_drop_pct_param,
            "high_band_ratio_baseline_pct": ratio_baseline_30,
            "high_band_ratio_floor_pct": ratio_floor_pct,
        },
        "critical_dates": critical_dates,
        "series": series,
    }


@router.get("/efficiency-scatter")
def get_efficiency_scatter(
    athlete_key: str = Query(..., description="athlete_internal_key"),
    days: int = Query(30, ge=7, le=90),
    recent_days: int = Query(3, ge=1, le=7),
):
    """
    Internal vs external efficiency: Catapult player load (X) vs WHOOP cycle strain (Y).
    One point per Catapult session with matching daily strain; 30d baseline trendline.
    """
    client = get_client()
    since = _since(days)
    today = date.today()

    cat_sessions = (
        client.table("silver_catapult_session")
        .select("calendar_date, activity_name, total_player_load")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .order("calendar_date")
        .limit(2000)
        .execute()
        .data
    ) or []

    whoop = (
        client.table("silver_whoop_recovery")
        .select("calendar_date, cycle_strain")
        .eq("athlete_internal_key", athlete_key)
        .gte("calendar_date", since)
        .eq("score_state", "SCORED")
        .order("calendar_date")
        .limit(500)
        .execute()
        .data
    ) or []
    if not whoop:
        whoop = (
            client.table("silver_whoop_recovery")
            .select("calendar_date, cycle_strain")
            .eq("athlete_internal_key", athlete_key)
            .gte("calendar_date", since)
            .order("calendar_date")
            .limit(500)
            .execute()
            .data
        ) or []

    strain_by_date: dict[str, float] = {}
    for r in whoop:
        d = str(r.get("calendar_date") or "")
        s = _num(r.get("cycle_strain"))
        if d and s is not None:
            strain_by_date[d] = s

    points: list[dict] = []
    loads: list[float] = []
    strains: list[float] = []

    for r in cat_sessions:
        d = str(r.get("calendar_date") or "")
        load = _num(r.get("total_player_load"))
        strain = strain_by_date.get(d)
        if load is None or strain is None or strain <= 0:
            continue
        try:
            days_ago = (today - date.fromisoformat(d)).days
        except ValueError:
            days_ago = 999
        loads.append(load)
        strains.append(strain)
        eff = load / strain
        points.append({
            "calendar_date": d,
            "activity_name": r.get("activity_name"),
            "player_load": round(load, 1),
            "strain": round(strain, 2),
            "efficiency_index": round(eff, 3),
            "days_ago": days_ago,
            "is_recent": days_ago <= recent_days - 1,
        })

    avg_load = round(sum(loads) / len(loads), 2) if loads else None
    avg_strain = round(sum(strains) / len(strains), 2) if strains else None
    avg_efficiency = (
        round(avg_load / avg_strain, 3) if avg_load and avg_strain and avg_strain > 0 else None
    )
    slope = (
        round(avg_strain / avg_load, 4) if avg_load and avg_load > 0 and avg_strain else None
    )

    for p in points:
        load = p["player_load"]
        strain = p["strain"]
        ei = p.get("efficiency_index") or 0
        expected_strain = (load * slope) if slope else None
        if expected_strain is not None and strain < expected_strain * 0.92:
            p["zone"] = "peaking"
        elif expected_strain is not None and strain > expected_strain * 1.08:
            p["zone"] = "fatigued"
        elif avg_efficiency and ei >= avg_efficiency * 1.1:
            p["zone"] = "peaking"
        elif avg_efficiency and ei <= avg_efficiency * 0.8:
            p["zone"] = "fatigued"
        else:
            p["zone"] = "neutral"

    x_max = max(loads) if loads else 100
    trend_line = []
    if slope is not None and x_max > 0:
        for frac in (0, 0.25, 0.5, 0.75, 1.0):
            x = round(x_max * frac, 1)
            trend_line.append({
                "player_load": x,
                "strain": round(x * slope, 2),
            })

    return {
        "athlete_internal_key": athlete_key,
        "days": days,
        "recent_days": recent_days,
        "baseline": {
            "avg_player_load": avg_load,
            "avg_strain": avg_strain,
            "avg_efficiency_index": avg_efficiency,
            "trendline_slope": slope,
        },
        "trend_line": trend_line,
        "sessions": points,
        "session_count": len(points),
    }
