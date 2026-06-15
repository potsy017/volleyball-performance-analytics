#!/usr/bin/env python3
"""Re-export BMP jumps for dates where stats exist but silver has no jump join."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from integrations.catapult.repair_jump_events import (  # noqa: E402
    jump_sync_lookback_days,
    sync_jump_gaps,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Detect silver_catapult_session rows missing BMP jumps and re-sync from Catapult."
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=jump_sync_lookback_days(),
        help="Calendar days to scan (default: CATAPULT_JUMP_SYNC_LOOKBACK_DAYS or 14)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print result summary as JSON on stdout",
    )
    args = parser.parse_args(argv)

    result = sync_jump_gaps(args.lookback_days, root=ROOT)
    if args.json:
        print(json.dumps(result, indent=2))

    if result.get("skipped"):
        return 0
    return int(result.get("exit_code") or 0)


if __name__ == "__main__":
    raise SystemExit(main())
