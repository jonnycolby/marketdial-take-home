import json
import os
import statistics
import sys
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware


def to_decimal(x: Any) -> Optional[Decimal]:
    if x is None:
        return None
    try:
        return Decimal(str(x))
    except Exception:
        return None


def q2(x: Decimal) -> Decimal:
    """Quantize to 2 decimals for currency-safe output."""
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def clamp_nonneg_int(x: Any, default: int = 0) -> int:
    try:
        v = int(x)
    except Exception:
        v = default
    return max(0, v)


# ---- Python version guard (deterministic for reviewers) ----
if not (sys.version_info.major == 3 and sys.version_info.minor == 11):
    raise RuntimeError("Python 3.11.x required (tested with 3.11.14).")

app = FastAPI(title="Store Revenue API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "store_revenue.json")


def _parse_date(s: str) -> date:
    # dataset is YYYY-MM-DD
    return datetime.strptime(s, "%Y-%m-%d").date()


@lru_cache(maxsize=1)
def load_rows() -> List[Dict[str, Any]]:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)
    for r in rows:
        try:
            val = r.get("date")
            r["_date"] = _parse_date(val) if val else None
        except (TypeError, ValueError):
            r["_date"] = None
    rows.sort(key=lambda r: ((r["_date"] or date.min), str(r.get("store_id", ""))))
    return rows


def apply_filters(
    rows: List[Dict[str, Any]],
    region: Optional[str],
    store_id: Optional[str],
    start_date: Optional[date],
    end_date: Optional[date],
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        if region and (r.get("region") or "") != region:
            continue
        if store_id and str(r.get("store_id", "")) != str(store_id):
            continue
        d = r.get("_date")
        if d is None and (start_date or end_date):
            continue
        if start_date and d is not None and d < start_date:
            continue
        if end_date and d is not None and d > end_date:
            continue
        out.append(r)
    return out


def map_row(r: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Map raw row to API shape. Returns None if required numeric fields are missing/unparseable.
    - delta = actual_revenue - baseline_revenue
    - ci_low / ci_high are delta CI (observed CI shifted by baseline); normalized so ci_low <= ci_high
    - uncertain (inconclusive) when ci_low <= 0 <= ci_high
    """
    baseline = to_decimal(r.get("baseline_revenue"))
    actual = to_decimal(r.get("observed_revenue"))
    ci_lo = to_decimal(r.get("ci_lower"))
    ci_hi = to_decimal(r.get("ci_upper"))
    if baseline is None or actual is None or ci_lo is None or ci_hi is None:
        return None

    delta = actual - baseline
    delta_ci_lo = ci_lo - baseline
    delta_ci_hi = ci_hi - baseline
    lo, hi = min(delta_ci_lo, delta_ci_hi), max(delta_ci_lo, delta_ci_hi)
    uncertain = lo <= 0 <= hi

    transactions = clamp_nonneg_int(r.get("transactions"), default=0)
    notes = r.get("notes")
    notes_str: Optional[str] = str(notes) if notes is not None else None

    def f(d: Decimal) -> float:
        return float(q2(d))

    return {
        "store_id": str(r.get("store_id", "")),
        "region": r.get("region") or "",
        "date": r.get("date") or "",
        "baseline_revenue": f(baseline),
        "actual_revenue": f(actual),
        "delta": f(delta),
        "ci_low": f(lo),
        "ci_high": f(hi),
        "transactions": transactions,
        "uncertain": uncertain,
        "notes": notes_str,
    }


def paginate(items: List[Any], page: int, page_size: int) -> Tuple[List[Any], int]:
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return items[start:end], total


@app.get("/health")
def health():
    return {"ok": True}


def _get_mapped_filtered(
    rows: List[Dict[str, Any]],
    region: Optional[str],
    store_id: Optional[str],
    start_date: Optional[date],
    end_date: Optional[date],
) -> List[Dict[str, Any]]:
    """Apply filters and map rows; drop invalid (None) mappings."""
    filtered = apply_filters(rows, region, store_id, start_date, end_date)
    mapped: List[Dict[str, Any]] = []
    for r in filtered:
        m = map_row(r)
        if m is not None:
            mapped.append(m)
    return mapped


_VALID_SORT_KEYS = {"date", "delta", "actual_revenue", "baseline_revenue", "transactions"}


@app.get("/results")
def results(
    region: Optional[str] = None,
    store_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    sort_by: Optional[str] = Query(
        None, description="date, delta, actual_revenue, baseline_revenue, transactions"
    ),
    sort_dir: Optional[str] = Query(None, description="asc or desc"),
    uncertain_only: bool = Query(
        False, description="If true, return only rows where the confidence interval crosses 0"
    ),
):
    rows = load_rows()
    mapped = _get_mapped_filtered(rows, region, store_id, start_date, end_date)
    if uncertain_only:
        mapped = [m for m in mapped if m.get("uncertain")]
    total = len(mapped)

    if sort_by and sort_by in _VALID_SORT_KEYS:
        reverse = (sort_dir or "desc" if sort_by == "delta" else "asc") == "desc"
        mapped = sorted(
            mapped,
            key=lambda m: m.get(sort_by, 0) if sort_by != "date" else m.get("date", ""),
            reverse=reverse,
        )

    page_items, _ = paginate(mapped, page, page_size)
    return {"page": page, "page_size": page_size, "total": total, "results": page_items}


_OUTLIER_MULTIPLIER = 10  # values > this many times the median are treated as outliers


def _detect_outliers(
    mapped: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Split mapped into inliers and outlier records. Outliers are store-days whose actual or baseline revenue is > 10x the median (would distort charts)."""
    if not mapped:
        return [], []
    actuals = [m["actual_revenue"] for m in mapped]
    baselines = [m["baseline_revenue"] for m in mapped]
    med_actual = statistics.median(actuals)
    med_baseline = statistics.median(baselines)
    threshold_actual = med_actual * _OUTLIER_MULTIPLIER if med_actual > 0 else float("inf")
    threshold_baseline = med_baseline * _OUTLIER_MULTIPLIER if med_baseline > 0 else float("inf")
    inliers: List[Dict[str, Any]] = []
    outliers: List[Dict[str, Any]] = []
    for m in mapped:
        a = m.get("actual_revenue", 0)
        b = m.get("baseline_revenue", 0)
        if a > threshold_actual or b > threshold_baseline:
            reason = []
            if a > threshold_actual:
                reason.append(f"actual revenue ${a:,.2f} is >{_OUTLIER_MULTIPLIER}x typical")
            if b > threshold_baseline:
                reason.append(f"expected revenue ${b:,.2f} is >{_OUTLIER_MULTIPLIER}x typical")
            outliers.append(
                {
                    "date": m.get("date", ""),
                    "store_id": m.get("store_id", ""),
                    "region": m.get("region", ""),
                    "reason": "; ".join(reason),
                    "actual_revenue": a,
                    "baseline_revenue": b,
                }
            )
        else:
            inliers.append(m)
    return inliers, outliers


@app.get("/summary")
def summary(
    region: Optional[str] = None,
    store_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    exclude_outliers: bool = Query(
        True,
        description="Exclude outlier store-days from chart and summary stats so scales stay readable; excluded rows are listed in outlier_warnings",
    ),
):
    rows = load_rows()
    mapped = _get_mapped_filtered(rows, region, store_id, start_date, end_date)
    total_full = len(mapped)

    if total_full == 0:
        return {
            "total": 0,
            "delta": {"min": 0, "max": 0, "avg": 0},
            "uncertain_rate": 0,
            "regions": [],
            "delta_over_time": [],
            "outlier_warnings": [],
        }

    inliers, outlier_list = _detect_outliers(mapped)
    if exclude_outliers:
        used = inliers
        outlier_warnings = outlier_list
    else:
        used = mapped
        outlier_warnings = (
            outlier_list  # still report so UI can show "Use full data" / "Exclude outliers"
        )

    total = len(used)
    if total == 0:
        return {
            "total": 0,
            "total_full": total_full,
            "delta": {"min": 0, "max": 0, "avg": 0},
            "uncertain_rate": 0,
            "regions": [],
            "delta_over_time": [],
            "outlier_warnings": [
                {
                    "date": w["date"],
                    "store_id": w["store_id"],
                    "region": w["region"],
                    "reason": w["reason"],
                }
                for w in outlier_warnings
            ],
        }

    deltas = [m["delta"] for m in used]
    uncertain_count = sum(1 for m in used if m["uncertain"])

    by_region: Dict[str, int] = {}
    for m in used:
        reg = m.get("region") or ""
        by_region[reg] = by_region.get(reg, 0) + 1
    regions = [{"region": k, "count": v} for k, v in sorted(by_region.items(), key=lambda x: x[0])]

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for m in used:
        d = m.get("date") or ""
        if d not in by_date:
            by_date[d] = []
        by_date[d].append(m)
    dates_sorted = sorted(by_date.keys())
    delta_over_time = []
    for d in dates_sorted:
        items = by_date[d]
        n = len(items)
        avg_delta = float(q2(sum(Decimal(str(x["delta"])) for x in items) / n))
        avg_actual = float(q2(sum(Decimal(str(x["actual_revenue"])) for x in items) / n))
        avg_expected = float(q2(sum(Decimal(str(x["baseline_revenue"])) for x in items) / n))
        uncertain_count_d = sum(1 for x in items if x.get("uncertain"))
        delta_over_time.append(
            {
                "date": d,
                "avg_delta": avg_delta,
                "avg_actual": avg_actual,
                "avg_expected": avg_expected,
                "count": n,
                "uncertain_rate": round(uncertain_count_d / n, 6),
            }
        )

    payload = {
        "total": total,
        "delta": {
            "min": round(min(deltas), 2),
            "max": round(max(deltas), 2),
            "avg": round(sum(deltas) / total, 2),
        },
        "uncertain_rate": round(uncertain_count / total, 6),
        "regions": regions,
        "delta_over_time": delta_over_time,
        "outlier_warnings": [
            {
                "date": w["date"],
                "store_id": w["store_id"],
                "region": w["region"],
                "reason": w["reason"],
            }
            for w in outlier_warnings
        ],
    }
    if outlier_warnings:
        payload["total_full"] = total_full
    return payload
