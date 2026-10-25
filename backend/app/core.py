"""Pure decision-support logic: forecast vintage selection, error metrics, error band.

No I/O and no web framework here. Everything the product claims about "what forecast was
available when" lives in `Dataset.select_vintage`, which is the function the tests target.

Conventions
- Times are timezone-aware datetimes; the market clock is Europe/London, storage is UTC.
- error = forecast - actual (MW). Positive = over-forecast = the desk would under-buy.
- Comparison is hourly: WINDFOR is hourly, FUELHH half-hourly, so an hourly actual is the mean of
  the two half-hours that start in that hour. If either half-hour is missing the hour is a gap.
"""

from __future__ import annotations

import bisect
import json
import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc

DEFAULT_CUTOFF = "09:50"  # N2EX GB day-ahead gate closure, UK local time, on D-1
BAND_WINDOW_DAYS = 7
BAND_MIN_DAYS = 3
BAND_LOW_Q, BAND_HIGH_Q = 0.10, 0.90


def parse_cutoff(value: str) -> time:
    try:
        hh, mm = value.split(":")
        return time(int(hh), int(mm))
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"cutoff must be HH:MM, got {value!r}") from exc


def cutoff_instant(delivery_day: date, cutoff: str) -> datetime:
    """The UTC instant at which the decision for `delivery_day` closes: cutoff on D-1, London time."""
    local = datetime.combine(delivery_day - timedelta(days=1), parse_cutoff(cutoff), tzinfo=LONDON)
    return local.astimezone(UTC)


def delivery_hours(delivery_day: date) -> list[datetime]:
    """UTC start instants of every hour in the London delivery day (24 normally, 23/25 on DST days)."""
    start = datetime.combine(delivery_day, time(0), tzinfo=LONDON).astimezone(UTC)
    end = datetime.combine(delivery_day + timedelta(days=1), time(0), tzinfo=LONDON).astimezone(UTC)
    hours, cur = [], start
    while cur < end:
        hours.append(cur)
        cur += timedelta(hours=1)
    return hours


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def quantile(sorted_values: list[float], q: float) -> float:
    """Linear-interpolation quantile (numpy default). Input must be sorted and non-empty."""
    if not sorted_values:
        raise ValueError("quantile of empty sequence")
    pos = (len(sorted_values) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


@dataclass(frozen=True)
class HourRow:
    start: datetime  # UTC hour start
    forecast: float | None
    vintage: datetime | None  # publishTime of the forecast row used
    actual: float | None

    @property
    def error(self) -> float | None:
        if self.forecast is None or self.actual is None:
            return None
        return self.forecast - self.actual


def metrics(errors: list[float]) -> dict | None:
    """MAE, RMSE, bias and error quantiles. None when there is nothing to measure."""
    if not errors:
        return None
    n = len(errors)
    s = sorted(errors)
    abs_sorted = sorted(abs(e) for e in errors)
    return {
        "n": n,
        "mae": sum(abs_sorted) / n,
        "rmse": math.sqrt(sum(e * e for e in errors) / n),
        "bias": sum(errors) / n,
        "p10": quantile(s, 0.10),
        "p50": quantile(s, 0.50),
        "p90": quantile(s, 0.90),
        "p90_abs": quantile(abs_sorted, 0.90),
    }


class Dataset:
    def __init__(self, payload: dict):
        self.built_at: str = payload["built_at"]
        self.first_delivery = date.fromisoformat(payload["first_delivery"])
        self.last_delivery = date.fromisoformat(payload["last_delivery"])
        self._half_hours: dict[datetime, float] = {parse_ts(t): float(g) for t, g in payload["actuals"]}
        # target hour start -> parallel sorted lists of publish times and values
        by_target: dict[datetime, list[tuple[datetime, float]]] = {}
        for start, publish, gen in payload["forecasts"]:
            by_target.setdefault(parse_ts(start), []).append((parse_ts(publish), float(gen)))
        self._pub: dict[datetime, list[datetime]] = {}
        self._val: dict[datetime, list[float]] = {}
        for target, rows in by_target.items():
            rows.sort()
            self._pub[target] = [p for p, _ in rows]
            self._val[target] = [v for _, v in rows]

    # ---- inputs -------------------------------------------------------------------------

    def days(self) -> list[date]:
        out, d = [], self.first_delivery
        while d <= self.last_delivery:
            out.append(d)
            d += timedelta(days=1)
        return out

    def actual_hour(self, hour_start: datetime) -> float | None:
        a = self._half_hours.get(hour_start)
        b = self._half_hours.get(hour_start + timedelta(minutes=30))
        if a is None or b is None:
            return None
        return (a + b) / 2

    def select_vintage(self, target: datetime, cutoff_at: datetime) -> tuple[float, datetime] | None:
        """Latest forecast for `target` published at or before `cutoff_at`.

        Anything published after the cutoff was not knowable when the desk decided and is never
        returned. A forecast published after its own target hour began is also excluded.
        """
        pubs = self._pub.get(target)
        if not pubs:
            return None
        i = bisect.bisect_right(pubs, min(cutoff_at, target)) - 1
        if i < 0:
            return None
        return self._val[target][i], pubs[i]

    # ---- per-day views ------------------------------------------------------------------

    def day_rows(
        self, delivery_day: date, cutoff: str = DEFAULT_CUTOFF, *, cutoff_at: datetime | None = None
    ) -> list[HourRow]:
        at = cutoff_at or cutoff_instant(delivery_day, cutoff)
        rows = []
        for h in delivery_hours(delivery_day):
            v = self.select_vintage(h, at)
            rows.append(HourRow(h, v[0] if v else None, v[1] if v else None, self.actual_hour(h)))
        return rows

    def day_errors(self, delivery_day: date, cutoff: str = DEFAULT_CUTOFF) -> list[float]:
        return [r.error for r in self.day_rows(delivery_day, cutoff) if r.error is not None]

    # ---- error band ---------------------------------------------------------------------

    def band_for(self, delivery_day: date, cutoff: str = DEFAULT_CUTOFF) -> dict:
        """Empirical error quantiles for `delivery_day`, using delivery days <= D-2 only.

        At the cutoff on D-1 the actuals of D-1 are incomplete, so the newest fully-known day is D-2.
        Uses the last BAND_WINDOW_DAYS available days; needs BAND_MIN_DAYS or returns a reason.
        Errors are pooled across hours (one pair of quantiles for the day, not one per hour).
        """
        history: list[date] = []
        d = delivery_day - timedelta(days=2)
        while d >= self.first_delivery and len(history) < BAND_WINDOW_DAYS:
            if self.day_errors(d, cutoff):
                history.append(d)
            d -= timedelta(days=1)
        if len(history) < BAND_MIN_DAYS:
            return {
                "available": False,
                "reason": f"Not enough history for an error band ({len(history)} prior day(s), need {BAND_MIN_DAYS})",
                "history_days": len(history),
            }
        pooled = sorted(e for d in history for e in self.day_errors(d, cutoff))
        return {
            "available": True,
            "history_days": len(history),
            "history_from": min(history).isoformat(),
            "history_to": max(history).isoformat(),
            "err_low": quantile(pooled, BAND_LOW_Q),
            "err_high": quantile(pooled, BAND_HIGH_Q),
        }

    # ---- aggregate views ----------------------------------------------------------------

    def month_rows(self, cutoff: str = DEFAULT_CUTOFF) -> list[HourRow]:
        return [r for d in self.days() for r in self.day_rows(d, cutoff)]

    def vintage_comparison(self, cutoff: str = DEFAULT_CUTOFF) -> list[dict]:
        """Same targets, different information cut-offs, scored on hours every scenario covers.

        WINDFOR's longest horizon is ~60 h, so a D-2 cutoff cannot reach the last hours of the
        delivery day. Scoring each scenario on its own hours would compare different samples, so
        only hours with a forecast AND an actual under every scenario are used.
        """
        scenarios = [
            ("Two days ahead (cutoff on D-2)", "usable", lambda d: cutoff_instant(d, cutoff) - timedelta(days=1)),
            ("Your cutoff (D-1)", "usable", lambda d: cutoff_instant(d, cutoff)),
            (
                "Latest before delivery starts",
                "after cutoff",
                lambda d: datetime.combine(d, time(0), tzinfo=LONDON).astimezone(UTC),
            ),
        ]
        per_scenario: list[dict[datetime, float]] = []
        for _, _, at_fn in scenarios:
            errs = {}
            for d in self.days():
                for r in self.day_rows(d, cutoff, cutoff_at=at_fn(d)):
                    if r.error is not None:
                        errs[r.start] = r.error
            per_scenario.append(errs)
        common = set.intersection(*(set(e) for e in per_scenario))
        return [
            {"label": label, "status": status, "metrics": metrics([errs[h] for h in sorted(common)])}
            for (label, status, _), errs in zip(scenarios, per_scenario, strict=True)
        ]

    def quality(self, rows: list[HourRow]) -> dict:
        bad = [r for r in rows if r.error is None]
        return {
            "expected_hours": len(rows),
            "matched_hours": len(rows) - len(bad),
            "missing": [
                {"hour": r.start, "has_forecast": r.forecast is not None, "has_actual": r.actual is not None}
                for r in bad
            ],
        }


@lru_cache(maxsize=1)
def load_dataset(path: str | None = None) -> Dataset:
    p = Path(path) if path else Path(__file__).resolve().parent.parent / "data" / "wind.json"
    return Dataset(json.loads(p.read_text()))
