"""High jump metrics from silver BMP tables only (no IMA band columns)."""
from collections import defaultdict
from typing import Any


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def high_jump_from_row(row: dict) -> float | None:
    return _num(row.get("high_jump_event_count"))


def total_jump_from_row(row: dict) -> float | None:
    for key in ("jump_event_count", "total_jumps", "indoor_analytics_total_jump_count"):
        v = _num(row.get(key))
        if v is not None:
            return v
    return None


def daily_high_jump_totals(rows: list[dict]) -> dict[str, float]:
    """Sum high_jump_event_count per calendar_date (multiple activities same day)."""
    by_date: dict[str, float] = defaultdict(float)
    for r in rows:
        d = r.get("calendar_date")
        v = high_jump_from_row(r)
        if d and v is not None:
            by_date[str(d)] += v
    return dict(by_date)


def daily_total_jump_totals(rows: list[dict]) -> dict[str, float]:
    """Sum jump_event_count (BMP total jumps) per calendar_date."""
    by_date: dict[str, float] = defaultdict(float)
    for r in rows:
        d = r.get("calendar_date")
        v = total_jump_from_row(r)
        if d and v is not None:
            by_date[str(d)] += v
    return dict(by_date)


def fetch_jump_sessions(
    client,
    *,
    athlete_key: str | None = None,
    since: str | None = None,
    limit: int = 2000,
    cols: str = (
        "calendar_date, athlete_internal_key, high_jump_event_count,"
        "jump_event_count, max_jump_height_cm"
    ),
) -> list[dict]:
    q = (
        client.table("silver_catapult_jump_session")
        .select(cols)
        .order("calendar_date", desc=True)
        .limit(limit)
    )
    if athlete_key:
        q = q.eq("athlete_internal_key", athlete_key)
    if since:
        q = q.gte("calendar_date", since)
    return q.execute().data or []


def latest_and_peak_high_jumps(rows: list[dict]) -> tuple[float | None, float | None, str | None]:
    """Returns (latest_day_total, max_daily_total, latest_date)."""
    by_date = daily_high_jump_totals(rows)
    if not by_date:
        return None, None, None
    latest_date = max(by_date.keys())
    return by_date[latest_date], max(by_date.values()), latest_date


def avg_daily_high_jumps(rows: list[dict]) -> float | None:
    by_date = daily_high_jump_totals(rows)
    if not by_date:
        return None
    return round(sum(by_date.values()) / len(by_date), 2)


def latest_and_peak_total_jumps(rows: list[dict]) -> tuple[float | None, float | None, str | None]:
    """Returns (latest_day_total, max_daily_total, latest_date)."""
    by_date = daily_total_jump_totals(rows)
    if not by_date:
        return None, None, None
    latest_date = max(by_date.keys())
    return by_date[latest_date], max(by_date.values()), latest_date


def avg_daily_total_jumps(rows: list[dict]) -> float | None:
    by_date = daily_total_jump_totals(rows)
    if not by_date:
        return None
    return round(sum(by_date.values()) / len(by_date), 2)


def daily_max_jump_height_cm(rows: list[dict]) -> dict[str, float]:
    """Highest BMP max_jump_height_cm per calendar_date."""
    by_date: dict[str, float] = {}
    for r in rows:
        d = r.get("calendar_date")
        h = _num(r.get("max_jump_height_cm"))
        if d and h is not None and h > 0:
            by_date[str(d)] = max(by_date.get(str(d), 0.0), h)
    return by_date


def daily_high_band_ratio_pct(rows: list[dict]) -> dict[str, float]:
    """(high_jump_event_count / jump_event_count) * 100 per day (summed across activities)."""
    hi: dict[str, float] = defaultdict(float)
    tot: dict[str, float] = defaultdict(float)
    for r in rows:
        d = r.get("calendar_date")
        if not d:
            continue
        key = str(d)
        h = _num(r.get("high_jump_event_count")) or 0.0
        t = _num(r.get("jump_event_count")) or 0.0
        hi[key] += h
        tot[key] += t
    out: dict[str, float] = {}
    for key, total in tot.items():
        if total > 0:
            out[key] = round((hi[key] / total) * 100, 1)
    return out


def attach_high_jump_counts(cat_rows: list[dict], jump_rows: list[dict]) -> None:
    """Set BMP jump metrics on catapult session rows (by athlete + calendar_date)."""
    high_index: dict[tuple[str, str], float] = {}
    total_index: dict[tuple[str, str], float] = {}
    for r in jump_rows:
        akey = r.get("athlete_internal_key")
        d = r.get("calendar_date")
        if not akey or not d:
            continue
        key = (str(akey), str(d))
        hv = high_jump_from_row(r)
        if hv is not None:
            high_index[key] = high_index.get(key, 0.0) + hv
        tv = total_jump_from_row(r)
        if tv is not None:
            total_index[key] = total_index.get(key, 0.0) + tv

    for r in cat_rows:
        akey = r.get("athlete_internal_key")
        d = r.get("calendar_date")
        pair = (str(akey), str(d)) if akey and d else None
        bmp_high = high_index.get(pair) if pair else None
        if bmp_high is not None:
            r["high_jump_count"] = bmp_high
        else:
            r["high_jump_count"] = high_jump_from_row(r)

        bmp_total = total_index.get(pair) if pair else None
        if bmp_total is not None:
            r["total_jumps"] = bmp_total
            r["session_jump_count"] = int(round(bmp_total))
        else:
            fallback = total_jump_from_row(r)
            if fallback is not None:
                r["total_jumps"] = fallback
                r["session_jump_count"] = int(round(fallback))
