"""
GymAware exercise_name aliases — same lift, different strings in export/ETL.
"""

from __future__ import annotations

# Canonical label shown in dropdowns and charts
TRAP_BAR_DEADLIFT_CANONICAL = "Deadlift (Trap Bar - Count Jump)"

# Every raw silver_gymaware_* exercise_name that maps to the canonical label
TRAP_BAR_DEADLIFT_RAW_NAMES: tuple[str, ...] = (
    "Deadlift (Trap Bar - Conc Jump)",
    "Deadlift (Trap Bar - CountJump)",
    "Deadlift (Trap Bar - Count Jump)",
)

_RAW_TO_CANONICAL: dict[str, str] = {
    raw: TRAP_BAR_DEADLIFT_CANONICAL for raw in TRAP_BAR_DEADLIFT_RAW_NAMES
}

_CANONICAL_TO_RAW: dict[str, tuple[str, ...]] = {
    TRAP_BAR_DEADLIFT_CANONICAL: TRAP_BAR_DEADLIFT_RAW_NAMES,
}


def normalize_exercise_name(name: str | None) -> str | None:
    if not name:
        return name
    return _RAW_TO_CANONICAL.get(name, name)


def exercise_names_for_query(exercise: str) -> list[str]:
    """All DB exercise_name values to include when the user picks a canonical (or alias) name."""
    canonical = normalize_exercise_name(exercise) or exercise
    variants = _CANONICAL_TO_RAW.get(canonical)
    if variants:
        return list(variants)
    return [exercise]


def list_canonical_exercises(raw_names: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in sorted(raw_names):
        if not raw:
            continue
        canonical = normalize_exercise_name(raw)
        if canonical not in seen:
            seen.add(canonical)
            out.append(canonical)
    return out


def normalize_row_exercise(row: dict) -> dict:
    name = row.get("exercise_name")
    if name:
        row = {**row, "exercise_name": normalize_exercise_name(name)}
    return row
