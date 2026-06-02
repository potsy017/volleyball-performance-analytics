"""Load–velocity profile math (coach Excel style: fixed kg steps + Lmax/Vmax)."""

from __future__ import annotations

STANDARD_LOAD_STEPS_KG: tuple[float, ...] = (25.0, 45.0, 65.0, 85.0, 105.0)


def _linear_regression_xy(points: list[tuple[float, float]]):
    valid = [(x, y) for x, y in points if x is not None and y is not None]
    if len(valid) < 2:
        return None
    n = len(valid)
    sum_x = sum(x for x, _ in valid)
    sum_y = sum(y for _, y in valid)
    sum_xy = sum(x * y for x, y in valid)
    sum_xx = sum(x * x for x, _ in valid)
    denom = n * sum_xx - sum_x * sum_x
    if denom == 0:
        return None
    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n
    return slope, intercept


def lmax_vmax_from_pairs(pairs: list[tuple[float, float]]) -> tuple[float | None, float | None]:
    if len(pairs) < 2:
        return None, None
    lv = _linear_regression_xy([(v, load) for load, v in pairs])
    vl = _linear_regression_xy([(load, v) for load, v in pairs])
    lmax = round(lv[1], 2) if lv else None
    vmax = round(vl[1], 3) if vl else None
    return lmax, vmax


def profile_at_fixed_loads(pairs: list[tuple[float, float]]) -> list[dict]:
    reg = _linear_regression_xy([(load, v) for load, v in pairs])
    if not reg:
        return []
    slope, intercept = reg
    return [
        {"bar_weight": load, "velocity": round(slope * load + intercept, 3)}
        for load in STANDARD_LOAD_STEPS_KG
    ]


def build_session_profiles_from_sets(rows: list[dict]) -> list[dict]:
    """
  Group silver_gymaware_summaries rows by calendar_date and bar_weight;
  mean peak_velocity per load; regression → fixed 25–105 kg profile per session.
    """
    by_session: dict[str, dict[float, list[float]]] = {}
    for r in rows:
        d = str(r.get("calendar_date") or "")
        bw = r.get("bar_weight")
        pv = r.get("peak_velocity")
        if not d or bw is None or pv is None:
            continue
        try:
            load_kg = float(bw)
            vel = float(pv)
        except (TypeError, ValueError):
            continue
        by_session.setdefault(d, {}).setdefault(load_kg, []).append(vel)

    session_profiles = []
    for d in sorted(by_session.keys()):
        load_map = by_session[d]
        pairs: list[tuple[float, float]] = []
        observed = []
        for load_kg in sorted(load_map.keys()):
            vs = load_map[load_kg]
            mean_v = sum(vs) / len(vs)
            pairs.append((load_kg, mean_v))
            observed.append({
                "bar_weight": load_kg,
                "mean_peak_velocity": round(mean_v, 3),
                "rep_count": len(vs),
            })

        lmax, vmax = (None, None)
        fixed_profile: list[dict] = []
        if len(pairs) >= 2:
            lmax, vmax = lmax_vmax_from_pairs(pairs)
            fixed_profile = profile_at_fixed_loads(pairs)

        session_profiles.append({
            "session_date": d,
            "observed": observed,
            "fixed_profile": fixed_profile,
            "has_profile_line": len(fixed_profile) >= 2,
            "lmax": lmax,
            "vmax": vmax,
        })

    return session_profiles


def build_pb_benchmark(pb_rows: list[dict]) -> dict:
    """
    All-time PB peak velocity per load (max across duplicate bests rows),
    plus regression profile and Lmax/Vmax from those PB points.
    """
    by_load: dict[float, float] = {}
    best_peak: float | None = None
    best_load: float | None = None

    for r in pb_rows:
        bw = r.get("bar_weight")
        pv = r.get("peak_velocity")
        if bw is None or pv is None:
            continue
        try:
            load_kg = float(bw)
            vel = float(pv)
        except (TypeError, ValueError):
            continue
        by_load[load_kg] = max(by_load.get(load_kg, 0.0), vel)
        if best_peak is None or vel > best_peak:
            best_peak = vel
            best_load = load_kg

    pairs = sorted(by_load.items())
    pb_by_load = [
        {"bar_weight": load_kg, "pb_peak_velocity": round(vel, 3)}
        for load_kg, vel in pairs
    ]
    fixed_profile = profile_at_fixed_loads(pairs) if len(pairs) >= 2 else []
    lmax, vmax = lmax_vmax_from_pairs(pairs) if len(pairs) >= 2 else (None, None)

    return {
        "by_load": pb_by_load,
        "fixed_profile": fixed_profile,
        "best_peak": (
            {"bar_weight": best_load, "peak_velocity": round(best_peak, 3)}
            if best_peak is not None and best_load is not None
            else None
        ),
        "lmax": lmax,
        "vmax": vmax,
    }
