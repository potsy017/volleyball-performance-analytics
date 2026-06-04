"""
Router: /api/request-coach-access
- Saves a request to the coach_requests table in Supabase
- Sends an email notification to the admin via Gmail SMTP
- No auth required — email is supplied in the request body by the frontend
"""
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.db.supabase import get_supabase_client

router = APIRouter()


class CoachRequestPayload(BaseModel):
    email: EmailStr
    reason: str = ""


@router.post("/request-coach-access", status_code=200)
async def request_coach_access(payload: CoachRequestPayload):
    supabase = get_supabase_client()

    # Prevent duplicate pending requests
    existing = (
        supabase.table("coach_requests")
        .select("id")
        .eq("email", payload.email)
        .eq("status", "pending")
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending coach access request.",
        )

    # Save to DB
    supabase.table("coach_requests").insert({
        "email": payload.email,
        "reason": payload.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    # Send Gmail notification
    _send_admin_email(payload.email, payload.reason)

    return {"message": "Request submitted. The admin will review your request."}


def _send_admin_email(requester_email: str, reason: str):
    if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
        return

    body = f"""
A user has requested Coach access on VPA.

Email:  {requester_email}
Reason: {reason or '(none provided)'}

To approve, go to Supabase → Table Editor → profiles → find this user → set role = 'coach'.
    """.strip()

    msg = MIMEText(body)
    msg["Subject"] = f"[VPA] Coach Access Request from {requester_email}"
    msg["From"] = settings.GMAIL_USER
    msg["To"] = settings.ADMIN_EMAIL

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            smtp.send_message(msg)
    except Exception as e:
        print(f"[WARN] Failed to send admin email: {e}")
