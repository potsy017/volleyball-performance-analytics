"""Resolve roster internal_key from Catapult athlete UUID and/or jersey."""
from __future__ import annotations

from typing import Any


def load_identity_lookups(cur: Any) -> tuple[dict[str, tuple[str, str | None]], dict[str, tuple[str, str | None]]]:
    """
    Returns (by_catapult_uuid, by_jersey) maps -> (internal_key, display_name).
    Jersey path: roster_cohort.catapult_jersey -> athlete_identity via gymaware_athlete_reference.
    """
    by_uuid: dict[str, tuple[str, str | None]] = {}
    cur.execute(
        """
        SELECT lower(btrim(catapult_athlete_id)), internal_key, display_name
        FROM public.athlete_identity
        WHERE catapult_athlete_id IS NOT NULL
          AND btrim(catapult_athlete_id) <> ''
        """
    )
    for cat_id, internal_key, display_name in cur.fetchall():
        if cat_id and internal_key:
            by_uuid[cat_id] = (internal_key, display_name)

    by_jersey: dict[str, tuple[str, str | None]] = {}
    cur.execute(
        """
        SELECT lower(btrim(rc.catapult_jersey)), ai.internal_key, ai.display_name
        FROM public.roster_cohort rc
        INNER JOIN public.athlete_identity ai
            ON ai.gymaware_athlete_reference = rc.gymaware_athlete_reference
        WHERE rc.catapult_jersey IS NOT NULL
          AND btrim(rc.catapult_jersey) <> ''
        """
    )
    for jersey, internal_key, display_name in cur.fetchall():
        if jersey and internal_key:
            by_jersey[jersey] = (internal_key, display_name)

    return by_uuid, by_jersey


def resolve_internal_key(
    athlete_id: str | None,
    athlete_jersey: str | None,
    *,
    by_uuid: dict[str, tuple[str, str | None]],
    by_jersey: dict[str, tuple[str, str | None]],
) -> tuple[str | None, str | None]:
    if athlete_id:
        hit = by_uuid.get(str(athlete_id).strip().lower())
        if hit:
            return hit
    jersey = (athlete_jersey or "").strip()
    if jersey:
        hit = by_jersey.get(jersey.lower())
        if hit:
            return hit
    return None, None
