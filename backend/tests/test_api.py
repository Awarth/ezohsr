"""API contract tests against the real built data file (backend/data/wind.json)."""

import pytest
from fastapi.testclient import TestClient

from app.core import parse_ts
from app.main import app

client = TestClient(app)


def test_meta_window_is_january_decisions():
    r = client.get("/api/meta").json()
    assert (r["first_day"], r["last_day"]) == ("2026-01-02", "2026-02-01")
    assert r["default_cutoff"] == "09:50"


def test_decision_vintage_is_never_after_cutoff():
    # Every vintage returned for every day must be <= the cutoff instant (no look-ahead end to end).
    for day in ("2026-01-02", "2026-01-15", "2026-02-01"):
        body = client.get("/api/decision", params={"day": day}).json()
        cutoff_at = parse_ts(body["cutoff_at"])
        assert body["rows"], day
        for row in body["rows"]:
            assert row["vintage"] is None or parse_ts(row["vintage"]) <= cutoff_at


def test_decision_default_cutoff_uses_0930_vintage():
    body = client.get("/api/decision", params={"day": "2026-01-15"}).json()
    assert body["vintage"].startswith("2026-01-14T09:30")
    assert body["vintage_minutes_before_cutoff"] == 20
    assert len(body["rows"]) == 24


def test_earlier_cutoff_selects_earlier_vintage():
    body = client.get("/api/decision", params={"day": "2026-01-15", "cutoff": "08:00"}).json()
    assert body["vintage"].startswith("2026-01-14T07:30")


def test_band_sits_below_forecast_when_history_overforecasts():
    body = client.get("/api/decision", params={"day": "2026-01-15"}).json()
    assert body["band"]["available"]
    assert body["cards"]["plan_for_delta"] < 0
    for row in body["rows"]:
        assert row["band_low"] <= row["band_high"]


def test_band_withheld_on_first_day_without_fabrication():
    body = client.get("/api/decision", params={"day": "2026-01-03"}).json()
    assert body["band"]["available"] is False and body["band"]["reason"]
    assert all(r["band_low"] is None and r["band_high"] is None for r in body["rows"])
    assert body["cards"]["plan_for_avg"] is None


def test_month_accuracy_matches_independent_computation():
    body = client.get("/api/accuracy").json()
    assert body["quality"]["matched_hours"] == body["quality"]["expected_hours"] == 744
    m = body["metrics"]
    assert m["n"] == 744
    assert m["bias"] == pytest.approx(1729.9, abs=0.5)  # independent prototype run on raw Elexon data
    assert m["mae"] == pytest.approx(2013.0, abs=0.5)
    assert len(body["daily"]) == 31


def test_day_scope_requires_day_and_filters_to_it():
    assert client.get("/api/accuracy", params={"scope": "day"}).status_code == 422
    body = client.get("/api/accuracy", params={"scope": "day", "day": "2026-01-28"}).json()
    assert body["metrics"]["n"] == 24
    assert body["metrics"]["mae"] > 4000  # 28 Jan is the worst miss of the month


def test_vintage_comparison_scores_same_hours_and_improves_with_later_info():
    res = client.get("/api/vintages").json()
    assert len({v["metrics"]["n"] for v in res}) == 1
    maes = [v["metrics"]["mae"] for v in res]
    assert maes[0] > maes[1] > maes[2]
    assert res[2]["status"] == "after cutoff"


@pytest.mark.parametrize(
    "path,params,status",
    [
        ("/api/decision", {"day": "2025-12-31"}, 404),
        ("/api/decision", {"day": "2026-02-02"}, 404),
        ("/api/decision", {"day": "2026-01-15", "cutoff": "9am"}, 422),
        ("/api/decision", {"day": "not-a-date"}, 422),
        ("/api/accuracy", {"cutoff": "25:99"}, 422),
    ],
)
def test_bad_input_is_rejected(path, params, status):
    assert client.get(path, params=params).status_code == status
