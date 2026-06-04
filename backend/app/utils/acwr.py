"""ACWR from silver Catapult sessions — daily load totals, calendar-day windows."""
from collections import defaultdict
from datetime import date, timedelta
from typing import Any


def date_spine(days: int, *, end: date | None = None) -> list[str]:
    """Inclusive calendar dates, oldest first (for chart X-axes)."""
    end = end or date.today()
    start = end - timedelta(days=days - 1)
    out: list[str] = []
    d = start
    while d <= end:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def daily_load_totals(rows: list[dict]) -> dict[str, float]:
    """Sum total_player_load per calendar_date (multiple sessions same day)."""
    by_date: dict[str, float] = defaultdict(float)
    for r in rows:
        d = r.get("calendar_date")
        load = _num(r.get("total_player_load"))
        if d and load is not None:
            by_date[str(d)] += load
    return dict(by_date)


def compute_acwr(
    rows: list[dict],
    *,
    ref: date | None = None,
    acute_days: int = 7,
    chronic_days: int = 28,
) -> dict[str, Any]:
    """
    Rolling acute/chronic ACWR aligned with /catapult/acwr-trend.
    Returns acwr, acute_load, chronic_load, has_acwr (any session in chronic window).
    """
    ref = ref or date.today()
    by_date = daily_load_totals(rows)
    session_dates = {str(r.get("calendar_date")) for r in rows if r.get("calendar_date")}
    chronic_cutoff = (ref - timedelta(days=chronic_days - 1)).isoformat()
    has_sessions = any(d >= chronic_cutoff for d in session_dates)

    acute_sum = 0.0
    for i in range(acute_days):
        d = (ref - timedelta(days=i)).isoformat()
        acute_sum += by_date.get(d, 0.0)

    chronic_sum = 0.0
    for i in range(chronic_days):
        d = (ref - timedelta(days=i)).isoformat()
        chronic_sum += by_date.get(d, 0.0)

    acute = acute_sum / acute_days
    chronic = chronic_sum / chronic_days
    acwr = round(acute / chronic, 2) if chronic > 0 else None

    return {
        "acwr": acwr,
        "acute_load": round(acute, 1),
        "chronic_load": round(chronic, 1),
        "has_acwr": has_sessions,
    }
