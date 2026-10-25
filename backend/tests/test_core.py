from datetime import date, datetime, timedelta, timezone

import pytest

from app.core import (
    Dataset,
    cutoff_instant,
    delivery_hours,
    metrics,
    quantile,
)

UTC = timezone.utc


def ts(s: str) -> str:
    return s


def make(forecasts, actuals=(), first="2026-01-02", last="2026-02-01") -> Dataset:
    return Dataset(
        {
            "built_at": "2026-01-01T00:00:00Z",
            "first_delivery": first,
            "last_delivery": last,
            "actuals": [list(a) for a in actuals],
            "forecasts": [list(f) for f in forecasts],
        }
    )


def half_hours(hour: str, value: float):
    """Two half-hour actuals that average to `value` for the hour starting at `hour`."""
    h = datetime.fromisoformat(hour.replace("Z", "+00:00"))
    m = (h + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return [(hour, value - 100), (m, value + 100)]


TARGET = "2026-01-15T12:00:00Z"
T = datetime(2026, 1, 15, 12, tzinfo=UTC)


# ---- vintage rule ---------------------------------------------------------------------


def test_picks_latest_publish_not_after_cutoff():
    ds = make(
        [
            (TARGET, "2026-01-14T07:30:00Z", 100),
            (TARGET, "2026-01-14T09:30:00Z", 200),  # latest before 09:50
            (TARGET, "2026-01-14T11:30:00Z", 300),  # after cutoff: must never be used
        ]
    )
    value, vintage = ds.select_vintage(T, cutoff_instant(date(2026, 1, 15), "09:50"))
    assert value == 200
    assert vintage == datetime(2026, 1, 14, 9, 30, tzinfo=UTC)


def test_no_look_ahead_when_only_later_forecasts_exist():
    ds = make([(TARGET, "2026-01-14T11:30:00Z", 300)])
    assert ds.select_vintage(T, cutoff_instant(date(2026, 1, 15), "09:50")) is None


def test_publish_exactly_at_cutoff_is_included():
    ds = make([(TARGET, "2026-01-14T09:50:00Z", 111)])
    assert ds.select_vintage(T, cutoff_instant(date(2026, 1, 15), "09:50"))[0] == 111


def test_forecast_published_after_target_starts_is_excluded():
    # With a cutoff later than the target hour, a forecast made during/after the hour is hindsight.
    ds = make([(TARGET, "2026-01-15T13:30:00Z", 999), (TARGET, "2026-01-15T11:30:00Z", 50)])
    late = datetime(2026, 1, 16, tzinfo=UTC)
    assert ds.select_vintage(T, late)[0] == 50


def test_cutoff_uses_london_clock_in_summer():
    # 09:50 BST on 9 Jun is 08:50 UTC, so a 09:30 UTC publish is after the cutoff.
    d = date(2026, 6, 10)
    assert cutoff_instant(d, "09:50") == datetime(2026, 6, 9, 8, 50, tzinfo=UTC)
    # In January the offset is zero.
    assert cutoff_instant(date(2026, 1, 10), "09:50") == datetime(2026, 1, 9, 9, 50, tzinfo=UTC)


def test_delivery_day_length_follows_dst():
    assert len(delivery_hours(date(2026, 1, 15))) == 24
    assert len(delivery_hours(date(2026, 3, 29))) == 23  # spring forward
    assert len(delivery_hours(date(2026, 10, 25))) == 25  # fall back


# ---- actuals and error sign -----------------------------------------------------------


def test_hourly_actual_is_mean_of_two_half_hours_and_error_sign():
    ds = make([(TARGET, "2026-01-14T09:30:00Z", 1000)], half_hours(TARGET, 800))
    row = next(r for r in ds.day_rows(date(2026, 1, 15)) if r.start == T)
    assert row.actual == 800
    assert row.error == 200  # forecast - actual: positive means over-forecast


def test_hour_with_one_missing_half_hour_is_a_gap_not_interpolated():
    ds = make([(TARGET, "2026-01-14T09:30:00Z", 1000)], [(TARGET, 800)])
    row = next(r for r in ds.day_rows(date(2026, 1, 15)) if r.start == T)
    assert row.actual is None and row.error is None
    q = ds.quality(ds.day_rows(date(2026, 1, 15)))
    assert q["matched_hours"] == 0
    assert any(m["hour"] == T and m["has_forecast"] and not m["has_actual"] for m in q["missing"])


# ---- error band: history window and look-ahead ----------------------------------------


def history_dataset(days_with_error: dict[date, float], publish="09:30"):
    """Each listed day has a constant forecast-actual error across its hours."""
    forecasts, actuals = [], []
    for d, err in days_with_error.items():
        for h in delivery_hours(d):
            iso = h.strftime("%Y-%m-%dT%H:%M:%SZ")
            pub = datetime.combine(d - timedelta(days=1), datetime.min.time(), tzinfo=UTC) + timedelta(
                hours=9, minutes=30
            )
            forecasts.append((iso, pub.strftime("%Y-%m-%dT%H:%M:%SZ"), 5000 + err))
            actuals.extend(half_hours(iso, 5000))
    return make(forecasts, actuals)


def test_band_uses_only_days_up_to_d_minus_2():
    errs = {date(2026, 1, d): 100.0 for d in range(2, 13)}
    errs[date(2026, 1, 13)] = 9999.0  # D-1 for the 14th: must not influence the band
    errs[date(2026, 1, 14)] = 9999.0  # the day itself
    ds = history_dataset(errs)
    band = ds.band_for(date(2026, 1, 14))
    assert band["available"]
    assert band["history_to"] == "2026-01-12"
    assert band["err_low"] == pytest.approx(100.0) and band["err_high"] == pytest.approx(100.0)


def test_band_window_is_capped_at_seven_days():
    ds = history_dataset({date(2026, 1, d): float(d) for d in range(2, 20)})
    band = ds.band_for(date(2026, 1, 19))
    assert band["history_days"] == 7
    assert band["history_from"] == "2026-01-11" and band["history_to"] == "2026-01-17"


def test_band_withheld_with_reason_when_history_too_short():
    ds = history_dataset({date(2026, 1, 2): 50.0, date(2026, 1, 3): 50.0})
    band = ds.band_for(date(2026, 1, 5))  # only 2 Jan and 3 Jan are <= D-2
    assert band["available"] is False
    assert band["history_days"] == 2
    assert "Not enough history" in band["reason"]


def test_first_days_have_no_history_at_all():
    ds = history_dataset({date(2026, 1, 2): 50.0})
    assert ds.band_for(date(2026, 1, 2))["history_days"] == 0


# ---- metrics ---------------------------------------------------------------------------


def test_metrics_known_values():
    m = metrics([100.0, -100.0, 300.0, -300.0])
    assert m["n"] == 4
    assert m["mae"] == 200.0
    assert m["bias"] == 0.0
    assert m["rmse"] == pytest.approx((50000) ** 0.5)  # sqrt((1e4+1e4+9e4+9e4)/4)


def test_metrics_bias_is_signed_and_empty_is_none():
    assert metrics([200.0, 400.0])["bias"] == 300.0
    assert metrics([]) is None


def test_quantile_interpolates():
    assert quantile([0.0, 10.0], 0.5) == 5.0
    assert quantile([1.0, 2.0, 3.0, 4.0, 5.0], 0.1) == pytest.approx(1.4)
    assert quantile([7.0], 0.9) == 7.0
