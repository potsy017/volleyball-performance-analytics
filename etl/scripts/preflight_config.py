"""
Offline check: which integration env vars are set (yes/no only — never prints secrets).

Run from repo root: python scripts/preflight_config.py
CI: python scripts/preflight_config.py --check-db
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def _has(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _line(label: str, ok: bool) -> None:
    status = "yes" if ok else "no"
    print(f"  {label}: {status}")


def _warn_direct_supabase_host(url: str) -> None:
    host = (urlparse(url).hostname or "").lower()
    if host.startswith("db.") and host.endswith(".supabase.co"):
        print(
            "\n[WARN] DATABASE_URL uses Supabase direct host (db.*.supabase.co).\n"
            "       GitHub Actions runners often fail with 'Network is unreachable' (IPv6).\n"
            "       Use the Session pooler URI from Supabase → Project Settings → Database → Connect:\n"
            "         • Mode: Session pooler\n"
            "         • Host: aws-0-<region>.pooler.supabase.com:5432\n"
            "         • User: postgres.<project-ref> (not postgres@db...)\n"
        )


def check_database_url() -> int:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print("[ERROR] DATABASE_URL not set.")
        return 1

    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    port = parsed.port or 5432
    user = (parsed.username or "").split("@")[-1]
    print(f"[INFO] DATABASE_URL host: {host}:{port} (user: {user or '(none)'})")

    _warn_direct_supabase_host(url)

    try:
        import psycopg2
    except ImportError:
        print("[ERROR] psycopg2 not installed; cannot test database connection.")
        return 1

    try:
        conn = psycopg2.connect(url, connect_timeout=20)
        conn.close()
        print("[OK] Database connection successful.")
        return 0
    except Exception as exc:
        err = str(exc)
        print(f"[ERROR] Database connection failed: {err}")
        if "Network is unreachable" in err or ":2406:" in err:
            print(
                "\nFix: set GitHub secret DATABASE_URL to the Supabase **Session pooler** URI,\n"
                "     not the direct db.<ref>.supabase.co:5432 string from local .env."
            )
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Check ETL environment configuration.")
    parser.add_argument(
        "--check-db",
        action="store_true",
        help="Test DATABASE_URL connectivity (for CI; fails fast on pooler/IPv6 issues).",
    )
    args = parser.parse_args()

    print(f"Preflight (repo root: {ROOT})\n")
    print("Core:")
    _line("DATABASE_URL", _has("DATABASE_URL"))

    print("\nCatapult:")
    _line("CATAPULT_TOKEN", _has("CATAPULT_TOKEN"))

    print("\nGymAware:")
    _line("GYMAWARE_ACCOUNT_ID", _has("GYMAWARE_ACCOUNT_ID"))
    _line("GYMAWARE_TOKEN", _has("GYMAWARE_TOKEN"))

    print("\nVALD (optional for scheduled_etl vald step):")
    _line("VALD_CLIENT_ID", _has("VALD_CLIENT_ID"))
    _line("VALD_CLIENT_SECRET", _has("VALD_CLIENT_SECRET"))

    print("\nWHOOP Auth Bridge + ETL:")
    _line("WHOOP_CLIENT_ID", _has("WHOOP_CLIENT_ID"))
    _line("WHOOP_CLIENT_SECRET", _has("WHOOP_CLIENT_SECRET"))
    _line("WHOOP_REDIRECT_URI", _has("WHOOP_REDIRECT_URI"))

    if args.check_db:
        print()
        rc = check_database_url()
        if rc != 0:
            return rc

    print("\nCopy .env.example to .env and fill values; apply schema/apply_order.txt in Supabase.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
