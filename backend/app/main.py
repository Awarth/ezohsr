"""HTTP layer. Thin: validates input, calls app.core, shapes JSON. No decision logic lives here."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import core
from .core import LONDON, Dataset, HourRow

app = FastAPI(title="Wind Forecast Decision Support", version="1.0.0")


def dataset() -> Dataset:
    return core.load_dataset()


def check_day(day: date) -> date:
    ds = dataset()
    if not ds.first_delivery <= day <= ds.last_delivery:
        raise HTTPException(404, f"day must be between {ds.first_delivery} and {ds.last_delivery}")
    return day


def check_cutoff(cutoff: str) -> str:
    try:
        core.parse_cutoff(cutoff)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return cutoff


# ---- models --------------------------------------------------------------------------------


class Metrics(BaseModel):
    n: int
    mae: float
    rmse: float
    bias: float
    p10: float
    p50: float
    p90: float
    p90_abs: float


class Band(BaseModel):
    available: bool
    reason: str | None = None
    history_days: int
    history_from: str | None = None
    history_to: str | None = None
    err_low: float | None = None
    err_high: float | None = None


class DecisionRow(BaseModel):
    hour_utc: datetime
    hour_local: str
    forecast: float | None
    vintage: datetime | None
    band_low: float | None
    band_high: float | None
    actual: float | None
    error: float | None


class DecisionCards(BaseModel):
    expected_avg: float | None
    plan_for_avg: float | None
    plan_for_delta: float | None
    peak_hour: str | None
    peak_value: float | None
    lowest_hour: str | None
    lowest_value: float | None
    lowest_band_low: float | None
    lowest_band_high: float | None


class DecisionResponse(BaseModel):
    day: date
    cutoff: str
    cutoff_at: datetime
    vintage: datetime | None
    vintage_minutes_before_cutoff: int | None
    band: Band
    cards: DecisionCards
    rows: list[DecisionRow]


class MissingHour(BaseModel):
    hour: datetime
    has_forecast: bool
    has_actual: bool


class Quality(BaseModel):
    expected_hours: int
    matched_hours: int
    missing: list[MissingHour]


class DailyPoint(BaseModel):
    day: date
    mae: float | None
    bias: float | None
    n: int


class HourOfDayPoint(BaseModel):
    hour: int
    n: int
    bias: float
    p10: float
    p90: float
    mae: float


class AccuracyResponse(BaseModel):
    scope: Literal["month", "day"]
    day: date | None
    cutoff: str
    metrics: Metrics | None
    quality: Quality
    daily: list[DailyPoint]
    by_hour: list[HourOfDayPoint]
    sample_note: str


class VintageResult(BaseModel):
    label: str
    status: Literal["usable", "after cutoff"]
    metrics: Metrics | None


class Meta(BaseModel):
    first_day: date
    last_day: date
    default_cutoff: str
    built_at: str
    band_window_days: int
    band_min_days: int


# ---- helpers -------------------------------------------------------------------------------


def local_label(t: datetime) -> str:
    return t.astimezone(LONDON).strftime("%H:%M")


def hod_series(rows: list[HourRow]) -> list[HourOfDayPoint]:
    buckets: dict[int, list[float]] = defaultdict(list)
    for r in rows:
        if r.error is not None:
            buckets[r.start.astimezone(LONDON).hour].append(r.error)
    out = []
    for h in sorted(buckets):
        m = core.metrics(buckets[h])
        out.append(HourOfDayPoint(hour=h, n=m["n"], bias=m["bias"], p10=m["p10"], p90=m["p90"], mae=m["mae"]))
    return out


# ---- endpoints -----------------------------------------------------------------------------


@app.get("/api/meta", response_model=Meta)
def meta() -> Meta:
    ds = dataset()
    return Meta(
        first_day=ds.first_delivery,
        last_day=ds.last_delivery,
        default_cutoff=core.DEFAULT_CUTOFF,
        built_at=ds.built_at,
        band_window_days=core.BAND_WINDOW_DAYS,
        band_min_days=core.BAND_MIN_DAYS,
    )


@app.get("/api/decision", response_model=DecisionResponse)
def decision(day: date, cutoff: str = core.DEFAULT_CUTOFF) -> DecisionResponse:
    check_day(day)
    check_cutoff(cutoff)
    ds = dataset()
    cutoff_at = core.cutoff_instant(day, cutoff)
    hours = ds.day_rows(day, cutoff)
    band = ds.band_for(day, cutoff)

    rows: list[DecisionRow] = []
    for r in hours:
        lo = hi = None
        if band["available"] and r.forecast is not None:
            # error = forecast - actual, so actual = forecast - error: high error means low wind.
            lo, hi = r.forecast - band["err_high"], r.forecast - band["err_low"]
        rows.append(
            DecisionRow(
                hour_utc=r.start,
                hour_local=local_label(r.start),
                forecast=r.forecast,
                vintage=r.vintage,
                band_low=lo,
                band_high=hi,
                actual=r.actual,
                error=r.error,
            )
        )

    have = [r for r in rows if r.forecast is not None]
    vintages = [r.vintage for r in have if r.vintage]
    # Present the most common vintage; with the 09:50 default it is a single publish for all hours.
    vintage = max(set(vintages), key=vintages.count) if vintages else None
    cards = DecisionCards(
        expected_avg=sum(r.forecast for r in have) / len(have) if have else None,
        plan_for_avg=None,
        plan_for_delta=None,
        peak_hour=None,
        peak_value=None,
        lowest_hour=None,
        lowest_value=None,
        lowest_band_low=None,
        lowest_band_high=None,
    )
    if have:
        peak = max(have, key=lambda r: r.forecast)
        low = min(have, key=lambda r: r.forecast)
        cards.peak_hour, cards.peak_value = peak.hour_local, peak.forecast
        cards.lowest_hour, cards.lowest_value = low.hour_local, low.forecast
        cards.lowest_band_low, cards.lowest_band_high = low.band_low, low.band_high
        if band["available"]:
            cards.plan_for_avg = sum(r.band_low for r in have) / len(have)
            cards.plan_for_delta = cards.plan_for_avg - cards.expected_avg

    return DecisionResponse(
        day=day,
        cutoff=cutoff,
        cutoff_at=cutoff_at,
        vintage=vintage,
        vintage_minutes_before_cutoff=int((cutoff_at - vintage).total_seconds() // 60) if vintage else None,
        band=Band(**band),
        cards=cards,
        rows=rows,
    )


@app.get("/api/accuracy", response_model=AccuracyResponse)
def accuracy(
    scope: Literal["month", "day"] = "month", day: date | None = None, cutoff: str = core.DEFAULT_CUTOFF
) -> AccuracyResponse:
    check_cutoff(cutoff)
    ds = dataset()
    if scope == "day":
        if day is None:
            raise HTTPException(422, "day is required when scope=day")
        check_day(day)
        rows = ds.day_rows(day, cutoff)
    else:
        rows = ds.month_rows(cutoff)

    daily = []
    for d in ds.days():
        errs = ds.day_errors(d, cutoff)
        m = core.metrics(errs)
        daily.append(DailyPoint(day=d, mae=m["mae"] if m else None, bias=m["bias"] if m else None, n=len(errs)))

    m = core.metrics([r.error for r in rows if r.error is not None])
    n_days = len([d for d in daily if d.n])
    return AccuracyResponse(
        scope=scope,
        day=day if scope == "day" else None,
        cutoff=cutoff,
        metrics=Metrics(**m) if m else None,
        quality=Quality(**ds.quality(rows)),
        daily=daily,
        by_hour=hod_series(rows),
        sample_note=f"{n_days} delivery days of data; quantiles are indicative, not a stable estimate.",
    )


@app.get("/api/vintages", response_model=list[VintageResult])
def vintages(cutoff: str = core.DEFAULT_CUTOFF) -> list[VintageResult]:
    check_cutoff(cutoff)
    return [
        VintageResult(label=v["label"], status=v["status"], metrics=Metrics(**v["metrics"]) if v["metrics"] else None)
        for v in dataset().vintage_comparison(cutoff)
    ]


# ---- static frontend (Docker image only) ---------------------------------------------------
# In the container the built React app is served from the same origin as /api. On Vercel the
# platform serves the static files and this block is inactive (STATIC_DIR unset).
_static = os.environ.get("STATIC_DIR")
if _static and Path(_static).is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=_static, html=True), name="frontend")
