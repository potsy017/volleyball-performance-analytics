"""
Supabase JWT authentication dependency for FastAPI.

Usage:
    from app.core.auth import require_auth, require_coach

    @router.get("/my-endpoint")
    async def my_endpoint(user=Depends(require_auth)):
        ...

    @router.get("/coach-only")
    async def coach_only(user=Depends(require_coach)):
        ...
"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings
from app.db.supabase import get_supabase_client

bearer_scheme = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> dict:
    """Decode and verify a Supabase JWT using the project's JWT secret."""
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """
    Validate the Bearer JWT. Returns the decoded payload.
    If AUTH_ENABLED is False, returns a mock coach user (dev mode).
    """
    if not settings.AUTH_ENABLED:
        return {"sub": "dev-user", "email": "dev@local", "role": "coach"}

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = _decode_token(credentials.credentials)
    return payload


async def get_user_role(user: dict = Depends(get_current_user)) -> str:
    """Fetch the user's role from the profiles table."""
    if not settings.AUTH_ENABLED:
        return "coach"

    supabase = get_supabase_client()
    result = supabase.table("profiles").select("role").eq("id", user["sub"]).single().execute()
    if result.data:
        return result.data.get("role", "athlete")
    return "athlete"


async def require_auth(user: dict = Depends(get_current_user)) -> dict:
    """Dependency — any authenticated user."""
    return user


async def require_coach(
    user: dict = Depends(get_current_user),
    role: str = Depends(get_user_role),
) -> dict:
    """Dependency — coach role only."""
    if role != "coach":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coach access required")
    return user
