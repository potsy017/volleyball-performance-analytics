"""
Router: /api/init-profile
Called after signup OTP verification to create/update the user's profile.
Uses the service role key — bypasses RLS entirely.
"""
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.config import settings

router = APIRouter()


class InitProfilePayload(BaseModel):
    email: EmailStr
    name: str = ""


@router.post("/init-profile", status_code=200)
async def init_profile(payload: InitProfilePayload):
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    base = settings.SUPABASE_URL.rstrip("/")

    # 1. Look up the user by email via the admin API
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{base}/auth/v1/admin/users",
            headers=headers,
            params={"email": payload.email},
        )

    if r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not look up user")

    data = r.json()
    users = data.get("users", [])
    if not users:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_id = users[0]["id"]

    # 2. Upsert the profile using the service role (bypasses RLS)
    upsert_headers = {**headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
    async with httpx.AsyncClient(timeout=10) as client:
        r2 = await client.post(
            f"{base}/rest/v1/profiles",
            headers=upsert_headers,
            json={"id": user_id, "role": "athlete", "name": payload.name or payload.email},
        )

    if r2.status_code not in (200, 201, 204):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Profile upsert failed: {r2.text}")

    return {"message": "Profile initialized"}
