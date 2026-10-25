"""Build backend/data/wind.json from the Elexon BMRS API.

Usage: python scripts/ingest.py

Pulls national wind actuals (FUELHH, fuelType=WIND) and wind forecasts (WINDFOR) for the
delivery days 2026-01-02 .. 2026-02-01, i.e. the days whose day-ahead decisions were made in
January 2026. Requests are chunked by week and retried; the output is deterministic for a given
API state, so re-running is idempotent.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
OUT = Path(__file__).resolve().parent.parent / "data" / "wind.json"

# Delivery days to evaluate (inclusive). Decisions for these are made 1-31 Jan 2026.
FIRST_DELIVERY = date(2026, 1, 2)
LAST_DELIVERY = date(2026, 2, 1)
# Forecasts can be published up to ~66h before their target and the earliest cutoff we compare is
# D-2 09:50, so fetch publishes from a few days before the first delivery day.
PUBLISH_FROM = datetime(2025, 12, 28, tzinfo=timezone.utc)
CHUNK_DAYS = 7


def get_json(url: str, retries: int = 4) -> list[dict]:
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                return json.load(resp)
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries - 1:
                raise RuntimeError(f"GET failed after {retries} attempts: {url}: {exc}") from exc
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_actuals() -> dict[str, int]:
    """startTime -> MW. If an API revision appears twice, keep the latest publishTime."""
    best: dict[str, tuple[str, int]] = {}
    day = FIRST_DELIVERY
    while day <= LAST_DELIVERY:
        end = min(day + timedelta(days=CHUNK_DAYS - 1), LAST_DELIVERY)
        qs = urllib.parse.urlencode(
            {"settlementDateFrom": day.isoformat(), "settlementDateTo": end.isoformat(), "fuelType": "WIND"}
        )
        for row in get_json(f"{BASE}/FUELHH/stream?{qs}"):
            if row.get("fuelType") != "WIND":
                continue
            cur = best.get(row["startTime"])
            if cur is None or row["publishTime"] > cur[0]:
                best[row["startTime"]] = (row["publishTime"], row["generation"])
        day = end + timedelta(days=1)
    return {k: v[1] for k, v in sorted(best.items())}


def fetch_forecasts() -> list[list]:
    """[startTime, publishTime, MW] rows whose target lies in the delivery window."""
    window_start = datetime.combine(FIRST_DELIVERY, datetime.min.time(), tzinfo=timezone.utc)
    window_end = datetime.combine(LAST_DELIVERY + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    rows: dict[tuple[str, str], int] = {}
    # Last decision is 31 Jan 09:50, so no useful publish exists after the end of 31 Jan.
    publish_end = datetime(2026, 2, 1, tzinfo=timezone.utc)
    cur = PUBLISH_FROM
    while cur < publish_end:
        nxt = min(cur + timedelta(days=CHUNK_DAYS), publish_end)
        qs = urllib.parse.urlencode({"publishDateTimeFrom": iso(cur), "publishDateTimeTo": iso(nxt)})
        for row in get_json(f"{BASE}/WINDFOR/stream?{qs}"):
            if window_start <= datetime.fromisoformat(row["startTime"].replace("Z", "+00:00")) < window_end:
                rows[(row["startTime"], row["publishTime"])] = row["generation"]
        cur = nxt
    return [[s, p, g] for (s, p), g in sorted(rows.items())]


def main() -> int:
    actuals = fetch_actuals()
    forecasts = fetch_forecasts()
    expected = ((LAST_DELIVERY - FIRST_DELIVERY).days + 1) * 48
    print(f"actuals: {len(actuals)} half-hours (expected {expected})")
    print(f"forecasts: {len(forecasts)} rows")
    if len(actuals) != expected:
        print("WARNING: actuals incomplete; app will report the gaps", file=sys.stderr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "built_at": iso(datetime.now(timezone.utc)),
        "first_delivery": FIRST_DELIVERY.isoformat(),
        "last_delivery": LAST_DELIVERY.isoformat(),
        "actuals": [[k, v] for k, v in actuals.items()],
        "forecasts": forecasts,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
