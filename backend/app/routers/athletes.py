from fastapi import APIRouter
from app.db.supabase import get_client

router = APIRouter(prefix="/athletes", tags=["athletes"])


@router.get("/")
def list_athletes():
    """
    Returns distinct athletes from silver_catapult_session.
    """
    try:
        client = get_client()
        res = (
            client.table("silver_catapult_session")
            .select("athlete_internal_key, athlete_display_name")
            .limit(5000)
            .execute()
        )

        seen = {}
        for r in res.data or []:
            key = r.get("athlete_internal_key")
            name = r.get("athlete_display_name", "")
            if key and key not in seen:
                seen[key] = {
                    "athlete_internal_key": key,
                    "athlete_display_name": name,
                }

        return sorted(seen.values(), key=lambda x: x.get("athlete_display_name") or "")

    except Exception as e:
        # Return the real error as JSON so we can debug
        return {"error": True, "detail": str(e), "type": type(e).__name__}


@router.get("/sources/{athlete_key}")
def get_athlete_sources(athlete_key: str):
    """
    Returns the most recent calendar_date per silver table for a given athlete_internal_key.
    """
    try:
        client = get_client()
    except Exception as e:
        return {"error": True, "detail": str(e), "type": type(e).__name__}

    sources = {}
    for table in [
        "silver_catapult_session",
        "silver_gymaware_summaries",
        "silver_whoop_recovery",
        "silver_gymaware_bests",
    ]:
        try:
            res = (
                client.table(table)
                .select("calendar_date")
                .eq("athlete_internal_key", athlete_key)
                .order("calendar_date", desc=True)
                .limit(1)
                .execute()
            )
            sources[table] = res.data[0]["calendar_date"] if res.data else None
        except Exception as e:
            sources[table] = f"ERROR: {str(e)}"

    return sources
