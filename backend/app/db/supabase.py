"""
Thin Supabase REST client built on httpx.
Replaces supabase-py which has asyncio conflicts with FastAPI 2.5.x.
Calls the PostgREST endpoint directly — no library version issues.
"""
import httpx
from typing import Any
from app.core.config import settings


class QueryBuilder:
    def __init__(self, base_url: str, table: str, headers: dict):
        self._url = f"{base_url}/rest/v1/{table}"
        self._headers = headers
        self._select = "*"
        self._filters: list[tuple[str, str]] = []
        self._order: list[str] = []
        self._limit_val: int | None = None

    def select(self, cols: str) -> "QueryBuilder":
        self._select = cols
        return self

    def eq(self, col: str, val: Any) -> "QueryBuilder":
        if isinstance(val, bool):
            val = "true" if val else "false"
        self._filters.append((col, f"eq.{val}"))
        return self

    def neq(self, col: str, val: Any) -> "QueryBuilder":
        if isinstance(val, bool):
            val = "true" if val else "false"
        self._filters.append((col, f"neq.{val}"))
        return self

    def gte(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append((col, f"gte.{val}"))
        return self

    def lte(self, col: str, val: Any) -> "QueryBuilder":
        self._filters.append((col, f"lte.{val}"))
        return self

    def order(self, col: str, desc: bool = False) -> "QueryBuilder":
        direction = "desc" if desc else "asc"
        self._order.append(f"{col}.{direction}")
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit_val = n
        return self

    def not_is_null(self, col: str) -> "QueryBuilder":
        """Filter: column IS NOT NULL  (PostgREST: col=not.is.null)"""
        self._filters.append((col, "not.is.null"))
        return self

    def execute(self):
        # Build as list of tuples — supports repeated keys (multiple filters)
        params: list[tuple[str, str]] = [("select", self._select)]
        for key, val in self._filters:
            params.append((key, val))
        if self._order:
            params.append(("order", ",".join(self._order)))
        if self._limit_val is not None:
            params.append(("limit", str(self._limit_val)))

        with httpx.Client(timeout=30) as client:
            response = client.get(self._url, headers=self._headers, params=params)
            response.raise_for_status()

        data = response.json()
        # Return an object with .data to match supabase-py interface
        return type("Result", (), {"data": data if isinstance(data, list) else []})()


class SupabaseClient:
    def __init__(self, url: str, key: str):
        self._url = url.rstrip("/")
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(self._url, name, self._headers)


# Singleton — created once at module level, no asyncio involved
_client: SupabaseClient = SupabaseClient(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_KEY,
)


def get_client() -> SupabaseClient:
    return _client
