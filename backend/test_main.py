"""Tests for Store Revenue API: filters, pagination, map_row, summary, and endpoints."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from main import apply_filters, map_row, paginate


@pytest.fixture
def sample_rows():
    """Rows with _date for filter tests."""
    base = {
        "store_id": "store_01",
        "date": "2026-01-15",
        "baseline_revenue": 1000,
        "observed_revenue": 1100,
        "ci_lower": 1050,
        "ci_upper": 1150,
        "transactions": 50,
        "region": "West",
        "notes": None,
    }
    rows = []
    for i, d in enumerate(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-01-20"]):
        r = dict(base)
        r["date"] = d
        r["_date"] = date(2026, 1, int(d.split("-")[2]))
        rows.append(r)
    rows[2]["region"] = "East"
    rows[3]["store_id"] = "store_02"
    return rows


def test_apply_filters_no_filters(sample_rows):
    """No filters returns all rows."""
    got = apply_filters(sample_rows, None, None, None, None)
    assert len(got) == 5


def test_apply_filters_region(sample_rows):
    """Filter by region."""
    got = apply_filters(sample_rows, "West", None, None, None)
    assert len(got) == 4
    assert all(r["region"] == "West" for r in got)


def test_apply_filters_store_id(sample_rows):
    """Filter by store_id."""
    got = apply_filters(sample_rows, None, "store_02", None, None)
    assert len(got) == 1
    assert got[0]["store_id"] == "store_02"


def test_apply_filters_date_range(sample_rows):
    """Filter by start_date and end_date (inclusive)."""
    start = date(2026, 1, 2)
    end = date(2026, 1, 10)
    got = apply_filters(sample_rows, None, None, start, end)
    assert len(got) == 3
    dates = [r["_date"] for r in got]
    assert date(2026, 1, 2) in dates
    assert date(2026, 1, 10) in dates
    assert date(2026, 1, 1) not in dates
    assert date(2026, 1, 20) not in dates


def test_paginate():
    """Pagination returns correct slice and total."""
    items = list(range(100))
    page1, total = paginate(items, page=1, page_size=25)
    assert total == 100
    assert len(page1) == 25
    assert page1[0] == 0

    page4, total = paginate(items, page=4, page_size=25)
    assert len(page4) == 25
    assert page4[0] == 75

    last, total = paginate(items, page=4, page_size=30)
    assert len(last) == 10
    assert total == 100


def test_map_row_normal():
    """map_row: normal row yields delta CI and uncertain=False when CI does not cross 0."""
    r = {
        "store_id": "store_01",
        "region": "West",
        "date": "2026-01-01",
        "baseline_revenue": 1000,
        "observed_revenue": 1100,
        "ci_lower": 1050,
        "ci_upper": 1150,
        "transactions": 50,
    }
    out = map_row(r)
    assert out["store_id"] == "store_01"
    assert out["actual_revenue"] == 1100
    assert out["delta"] == 100
    assert out["ci_low"] == 50  # 1050 - 1000
    assert out["ci_high"] == 150  # 1150 - 1000
    assert out["uncertain"] is False
    assert out["transactions"] == 50
    assert "notes" in out


def test_map_row_zero_baseline_uncertain():
    """map_row: baseline=0, CI (-50, 50) -> delta CI crosses 0 -> uncertain."""
    r = {
        "store_id": "store_edge_01",
        "region": "Edge",
        "date": "2026-01-05",
        "baseline_revenue": 0,
        "observed_revenue": 0,
        "ci_lower": -50,
        "ci_upper": 50,
        "transactions": 0,
        "notes": "baseline=0, CI crosses 0",
    }
    out = map_row(r)
    assert out["delta"] == 0
    assert out["ci_low"] == -50
    assert out["ci_high"] == 50
    assert out["uncertain"] is True
    assert out["notes"] == "baseline=0, CI crosses 0"


def test_map_row_reversed_ci():
    """map_row: ci_lower > ci_upper is normalized; uncertain from normalized bounds."""
    r = {
        "store_id": "store_edge_04",
        "region": "Edge",
        "date": "2026-01-08",
        "baseline_revenue": 3200,
        "observed_revenue": 3500,
        "ci_lower": 4000,
        "ci_upper": 3000,
        "transactions": 10,
        "notes": "ci_lower > ci_upper (invalid)",
    }
    out = map_row(r)
    # Raw delta CI would be 800, -200; normalized to ci_low <= ci_high
    assert out["ci_low"] == -200
    assert out["ci_high"] == 800
    assert out["uncertain"] is True  # -200 < 0 < 800
    assert out["delta"] == 300


def test_map_row_null_transactions():
    """map_row: null transactions -> 0."""
    r = {
        "store_id": "s",
        "region": "R",
        "date": "2026-01-01",
        "baseline_revenue": 100,
        "observed_revenue": 100,
        "ci_lower": 90,
        "ci_upper": 110,
        "transactions": None,
    }
    out = map_row(r)
    assert out["transactions"] == 0


def test_map_row_missing_numerics_returns_none():
    """map_row: missing or null required numerics -> None (row dropped)."""
    r = {
        "store_id": "s",
        "region": "R",
        "date": "2026-01-01",
    }
    out = map_row(r)
    assert out is None


@pytest.fixture
def client():
    return TestClient(__import__("main").app)


def test_health(client):
    """GET /health returns ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_results_pagination(client):
    """GET /results returns paginated results."""
    resp = client.get("/results?page=1&page_size=2")
    assert resp.status_code == 200
    data = resp.json()
    assert "page" in data
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert len(data["results"]) == 2
    assert data["total"] >= 2


def test_results_date_params(client):
    """GET /results accepts start_date and end_date query params."""
    resp = client.get(
        "/results",
        params={"start_date": "2026-01-01", "end_date": "2026-01-31", "page": 1, "page_size": 5},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data


def test_results_filter_region(client):
    """GET /results filters by region."""
    resp = client.get("/results?region=West&page=1&page_size=20")
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["region"] == "West" for r in data["results"])
    assert data["total"] >= 1


def test_summary_empty(client):
    """GET /summary with no matches returns total=0, delta zeros, empty regions, empty delta_over_time."""
    resp = client.get(
        "/summary",
        params={"start_date": "2030-01-01", "end_date": "2030-01-02"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["delta"] == {"min": 0, "max": 0, "avg": 0}
    assert data["uncertain_rate"] == 0
    assert data["regions"] == []
    assert data["delta_over_time"] == []


def test_summary_has_structure(client):
    """GET /summary returns total, delta, uncertain_rate, regions, delta_over_time."""
    resp = client.get("/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "delta" in data
    assert "min" in data["delta"]
    assert "max" in data["delta"]
    assert "avg" in data["delta"]
    assert "uncertain_rate" in data
    assert "regions" in data
    assert "delta_over_time" in data
    series = data["delta_over_time"]
    assert isinstance(series, list)
    if series:
        assert "date" in series[0]
        assert "avg_delta" in series[0]
        assert "count" in series[0]
        assert series == sorted(series, key=lambda x: x["date"])
