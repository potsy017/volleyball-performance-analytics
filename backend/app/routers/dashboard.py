from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Silver table identifiers:
#   athlete_internal_key (text)  — used for filtering
#   athlete_display_name (text)  — display field
#   calendar_date (date)         — date column in ALL silver tables
#
# Key column aliases per table:
#   catapult  → total_player_load, player_load_per_minute,
#               high_jump_count_ima_bands_6_8, total_distance, field_time
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
        "player_load_per_minute, field_time, high_jump_count_ima_bands_6_8",
    )
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

    return {
        # Period averages
        "avg_player_load_per_min":  _safe_avg(cat, "player_load_per_minute"),
        "avg_high_jumps":           _safe_avg(cat, "high_jump_count_ima_bands_6_8"),
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
        "latest_high_jumps":    latest_cat.get("high_jump_count_ima_bands_6_8"),
        "latest_session_date":  latest_cat.get("calendar_date"),
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

    cat   = _safe_q("silver_catapult_session", "catapult")
    gym   = _safe_q("silver_gymaware_summaries", "gymaware")
    whoop = _safe_q("silver_whoop_recovery", "whoop", extra_eq={"score_state": "SCORED"})

    # Normalise jump column alias for frontend charts
    for r in cat:
        r["high_jump_count"] = r.get("high_jump_count_ima_bands_6_8")

    return cat + gym + whoop


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
            "total_player_load, player_load_per_minute,"
            "high_jump_count_ima_bands_6_8"
        )
        .gte("calendar_date", since_28)
        .order("calendar_date", desc=True)
        .limit(5000)
        .execute().data
    ) or []

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
                "hrv": None,
                "recovery": None,
                "acwr": None,
                "acute_load": None,
                "chronic_load": None,
                "acwr_status": "gray",
                "_loads_28": [],
                "_loads_7": [],
            }
        row = seen[akey]
        load = r.get("total_player_load")
        cal  = r.get("calendar_date", "")
        if load is not None:
            row["_loads_28"].append(load)
            if cal >= since_7:
                row["_loads_7"].append(load)
        # Latest session values (first row per athlete since ordered desc)
        if row["player_load"] is None and load is not None:
            row["last_session"] = cal
            row["player_load"]  = load
            row["load_per_min"] = r.get("player_load_per_minute")
            row["high_jumps"]   = r.get("high_jump_count_ima_bands_6_8")

    # Compute ACWR for each athlete
    for akey, row in seen.items():
        loads_28 = row.pop("_loads_28")
        loads_7  = row.pop("_loads_7")
        if loads_28:
            # Divide by days (not session count) — standard ACWR definition
            acute   = sum(loads_7)  / 7
            chronic = sum(loads_28) / 28
            acwr    = round(acute / chronic, 2) if chronic > 0 else None
            row["acute_load"]   = round(acute, 1)
            row["chronic_load"] = round(chronic, 1)
            row["acwr"]         = acwr
            row["acwr_status"]  = _acwr_status(acwr)

    # Latest WHOOP recovery per athlete
    for r in rec:
        akey = r.get("athlete_internal_key")
        if akey in seen and seen[akey]["hrv"] is None:
            seen[akey]["hrv"]      = r.get("hrv_rmssd_milli")
            seen[akey]["recovery"] = r.get("recovery_score")

    return sorted(seen.values(), key=lambda x: x["athlete_name"] or "")
