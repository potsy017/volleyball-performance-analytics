"""
Thin Supabase REST client built on httpx.
Replaces supabase-py which has asyncio conflicts with FastAPI 2.5.x.
Calls the PostgREST endpoint directly.
"""
import json
import httpx
from typing import Any
from app.core.config import settings


class InsertBuilder:
    def __init__(self, url: str, headers: dict, data: dict):
        self._url = url
        self._headers = {**headers, "Prefer": "return=representation"}
        self._data = data

    def execute(self):
        with httpx.Client(timeout=30) as client:
            response = client.post(self._url, headers=self._headers, content=json.dumps(self._data))
            response.raise_for_status()
        return type("Result", (), {"data": response.json()})()


class QueryBuilder:
    def __init__(self, base_url: str, table: str, headers: dict):
        self._url = f"{base_url}/rest/v1/{table}"
        self._headers = headers
        self._select = "*"
        self._filters: list[tuple[str, str]] = []
        self._order: list[str] = []
        self._limit_val: int | None = None
        self._single = False

    def select(self, cols: str) -> "QueryBuilder":
        self._select = cols
        return self

    def single(self) -> "QueryBuilder":
        self._single = True
        self._limit_val = 1
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
        self._filters.append((col, "not.is.null"))
        return self

    def in_(self, col: str, vals: list[Any]) -> "QueryBuilder":
        if not vals:
            return self

        def _quote(v: Any) -> str:
            s = str(v)
            if any(c in s for c in ',()"\\'):
                return '"' + s.replace('"', '\\"') + '"'
            return s

        self._filters.append((col, f"in.({','.join(_quote(v) for v in vals)})"))
        return self

    def insert(self, data: dict) -> InsertBuilder:
        return InsertBuilder(self._url, self._headers, data)

    def execute(self):
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

        rows = response.json()
        if not isinstance(rows, list):
            rows = []
        result = rows[0] if (self._single and rows) else (None if self._single else rows)
        return type("Result", (), {"data": result})()


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


_client: SupabaseClient = SupabaseClient(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_KEY,
)


def get_client() -> SupabaseClient:
    return _client


# Alias used by auth.py and access_requests.py
get_supabase_client = get_client
