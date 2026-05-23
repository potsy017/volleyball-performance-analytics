from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/vald", tags=["vald"])


def _date_from_days(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


@router.get("/tests")
def get_tests(
    athlete_id: Optional[int] = Query(None),
    days: int = Query(30, ge=1, le=365),
    test_type: Optional[str] = Query(None),
):
    client = get_client()
    since = _date_from_days(days)

    query = (
        client.table("vw_athlete_dashboard")
        .select(
            "id, a_id, athlete_name, jersey, session_date, vald_test_type,"
            "jump_height, peak_force, peak_power_vald, asymmetry_index,"
            "contraction_time, rfd"
        )
        .eq("source", "vald")
        .gte("session_date", since)
        .order("session_date", desc=True)
    )
    if athlete_id:
        query = query.eq("a_id", athlete_id)
    if test_type:
        query = query.eq("vald_test_type", test_type)

    res = query.execute()
    return res.data


@router.get("/test-types")
def get_test_types():
    client = get_client()
    res = (
        client.table("vw_athlete_dashboard")
        .select("vald_test_type")
        .eq("source", "vald")
        .not_.is_("vald_test_type", "null")
        .execute()
    )
    types = sorted(set(r["vald_test_type"] for r in res.data if r.get("vald_test_type")))
    return types


@router.get("/summary")
def get_vald_summary(athlete_id: Optional[int] = Query(None)):
    client = get_client()
    query = (
        client.table("vw_athlete_dashboard")
        .select("a_id, athlete_name, session_date, vald_test_type")
        .eq("source", "vald")
        .not_.is_("vald_test_type", "null")
        .order("session_date", desc=True)
    )
    if athlete_id:
        query = query.eq("a_id", athlete_id)

    rows = query.execute().data

    from collections import Counter
    type_counts = Counter(r["vald_test_type"] for r in rows if r.get("vald_test_type"))
    athlete_counts = Counter(r["a_id"] for r in rows)

    return {
        "total_tests": len(rows),
        "last_test_date": rows[0]["session_date"] if rows else None,
        "last_test_type": rows[0]["vald_test_type"] if rows else None,
        "test_type_breakdown": [
            {"test_type": t, "count": c, "athletes": len(set(
                r["a_id"] for r in rows if r["vald_test_type"] == t
            ))}
            for t, c in type_counts.most_common()
        ],
        "recent_tests": rows[:20],
    }
