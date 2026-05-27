from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from app.db.supabase import get_client

router = APIRouter(prefix="/vald", tags=["vald"])

# Silver table: silver_vald_tests
# Expected columns (add more as ETL is extended):
#   athlete_internal_key, athlete_display_name, calendar_date,
#   test_type, jump_height, peak_force, asymmetry_index, rfd, contraction_time

# Update this once the VALD silver table is created in Supabase
VALD_TABLE = "silver_vald_tests"
VALD_READY = False   # set True once the table exists


def _since(days: int) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


@router.get("/tests")
def get_tests(
    athlete_key: Optional[str] = Query(None, description="athlete_internal_key"),
    days: int = Query(30, ge=1, le=365),
    test_type: Optional[str] = Query(None),
):
    if not VALD_READY:
        return []
    client = get_client()
    since = _since(days)
    try:
        query = (
            client.table(VALD_TABLE)
            .select("*")
            .gte("calendar_date", since)
            .order("calendar_date", desc=True)
        )
        if athlete_key:
            query = query.eq("athlete_internal_key", athlete_key)
        if test_type:
            query = query.eq("test_type", test_type)
        rows = query.execute().data or []
        for r in rows:
            r["session_date"]   = r.get("calendar_date")
            r["vald_test_type"] = r.get("test_type")
            r["athlete_name"]   = r.get("athlete_display_name")
        return rows
    except Exception:
        return []


@router.get("/test-types")
def get_test_types():
    if not VALD_READY:
        return []
    client = get_client()
    try:
        res = (
            client.table(VALD_TABLE)
            .select("test_type")
            .not_is_null("test_type")
            .execute()
        )
        return sorted(set(r["test_type"] for r in res.data if r.get("test_type")))
    except Exception:
        return []


@router.get("/summary")
def get_vald_summary(athlete_key: Optional[str] = Query(None)):
    if not VALD_READY:
        return {
            "total_tests": 0, "last_test_date": None, "last_test_type": None,
            "test_type_breakdown": [], "recent_tests": [],
        }
    client = get_client()
    try:
        query = (
            client.table(VALD_TABLE)
            .select("athlete_internal_key, athlete_display_name, calendar_date, test_type")
            .not_is_null("test_type")
            .order("calendar_date", desc=True)
        )
        if athlete_key:
            query = query.eq("athlete_internal_key", athlete_key)
        rows = query.execute().data or []

        from collections import Counter
        type_counts = Counter(r["test_type"] for r in rows if r.get("test_type"))
        recent = [
            {
                "session_date":   r.get("calendar_date"),
                "athlete_name":   r.get("athlete_display_name"),
                "vald_test_type": r.get("test_type"),
            }
            for r in rows[:20]
        ]
        return {
            "total_tests":    len(rows),
            "last_test_date": rows[0]["calendar_date"] if rows else None,
            "last_test_type": rows[0]["test_type"] if rows else None,
            "test_type_breakdown": [
                {
                    "test_type": t, "count": c,
                    "athletes": len(set(
                        r["athlete_internal_key"] for r in rows if r.get("test_type") == t
                    )),
                }
                for t, c in type_counts.most_common()
            ],
            "recent_tests": recent,
        }
    except Exception:
        return {
            "total_tests": 0, "last_test_date": None, "last_test_type": None,
            "test_type_breakdown": [], "recent_tests": [],
        }
