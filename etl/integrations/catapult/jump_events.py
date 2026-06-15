"""
Catapult BMP jump events (Beach VB / Jump Data - BEACH VB.R logic).

GET .../activities/{id}/athletes/{aid}/events?event_types=basketball
Unnest data → basketball; count rows with jump_attribute > 0.

jump_attribute is in centiseconds (Catapult BMP docs); divide by 100 for seconds.
High jump threshold: >= 57 cs (0.57 s ≈ 40 cm vertical, client-approved).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import requests

GRAVITY_M_S2 = 9.81
HIGH_JUMP_MIN_CS = int(os.getenv("CATAPULT_HIGH_JUMP_MIN_CS", "57"))


def jump_flight_time_s(jump_attribute_cs: float) -> float:
    return float(jump_attribute_cs) / 100.0


def jump_height_cm_from_cs(jump_attribute_cs: float) -> float:
    """Ballistic estimate h = g·t²/8 (m → cm)."""
    t = jump_flight_time_s(jump_attribute_cs)
    return round(GRAVITY_M_S2 * t * t / 8.0 * 100.0, 1)


def iter_jump_records(payload: Any):
    """Mirror R unnest(data) then unnest(basketball); yield leaf dicts."""
    if payload is None:
        return
    if isinstance(payload, dict):
        if payload.get("data") is not None:
            d = payload["data"]
            if isinstance(d, list):
                for item in d:
                    yield from iter_jump_records(item)
            else:
                yield from iter_jump_records(d)
            return
        if payload.get("basketball") is not None:
            b = payload["basketball"]
            if isinstance(b, list):
                for item in b:
                    yield from iter_jump_records(item)
            else:
                yield from iter_jump_records(b)
            return
        yield payload
    elif isinstance(payload, list):
        for item in payload:
            yield from iter_jump_records(item)


def _parse_jump_attribute_cs(rec: dict) -> float | None:
    if "jump_attribute" not in rec:
        return None
    try:
        v = float(rec.get("jump_attribute") or 0)
    except (TypeError, ValueError):
        return None
    return v if v > 0 else None


@dataclass(frozen=True)
class JumpEventSummary:
    jump_event_count: int
    high_jump_event_count: int
    max_jump_attribute_cs: int | None
    max_jump_flight_time_s: float | None
    max_jump_height_cm: float | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "jump_event_count": self.jump_event_count,
            "high_jump_event_count": self.high_jump_event_count,
            "max_jump_attribute_cs": self.max_jump_attribute_cs,
            "max_jump_flight_time_s": self.max_jump_flight_time_s,
            "max_jump_height_cm": self.max_jump_height_cm,
        }


def summarize_jump_events(
    payload: Any,
    *,
    high_jump_min_cs: int = HIGH_JUMP_MIN_CS,
) -> JumpEventSummary:
    total = 0
    high = 0
    max_cs: float | None = None
    for rec in iter_jump_records(payload):
        if not isinstance(rec, dict):
            continue
        cs = _parse_jump_attribute_cs(rec)
        if cs is None:
            continue
        total += 1
        if cs >= high_jump_min_cs:
            high += 1
        max_cs = cs if max_cs is None else max(max_cs, cs)

    if max_cs is None:
        return JumpEventSummary(0, 0, None, None, None)

    max_cs_int = int(round(max_cs))
    flight_s = round(jump_flight_time_s(max_cs), 3)
    height_cm = jump_height_cm_from_cs(max_cs)
    return JumpEventSummary(total, high, max_cs_int, flight_s, height_cm)


def count_jumps_in_events_payload(payload: Any) -> int:
    return summarize_jump_events(payload).jump_event_count


def fetch_jump_events_payload(
    headers: dict[str, str],
    base: str,
    activity_id: str,
    athlete_id: str,
    *,
    timeout: int = 120,
) -> Any | None:
    url = f"{base.rstrip('/')}/activities/{activity_id}/athletes/{athlete_id}/events"
    r = requests.get(
        url,
        headers=headers,
        params={"event_types": "basketball"},
        timeout=timeout,
    )
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except ValueError:
        return None


def fetch_jump_summary_for_athlete(
    headers: dict[str, str],
    base: str,
    activity_id: str,
    athlete_id: str,
    *,
    high_jump_min_cs: int = HIGH_JUMP_MIN_CS,
) -> JumpEventSummary:
    body = fetch_jump_events_payload(headers, base, activity_id, athlete_id)
    if body is None:
        return JumpEventSummary(0, 0, None, None, None)
    return summarize_jump_events(body, high_jump_min_cs=high_jump_min_cs)
