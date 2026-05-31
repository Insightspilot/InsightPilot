"""
Statistical analysis engine for visualization data.

Given query results (columns + rows) and visualization context (chart type, config),
produces a structured data summary that can be:
  1. Used directly to generate templated natural-language insights, or
  2. Fed to an LLM (Gemini) for polished natural-language insights.

Uses only Python stdlib — no pandas/numpy — to keep the backend lightweight.
"""

from __future__ import annotations

import math
import re
import statistics
from datetime import date, datetime
from typing import Any

# ──────────────────────────────────────────────────────────────────────────────
# Column type classification
# ──────────────────────────────────────────────────────────────────────────────

ColumnType = str  # "numeric" | "datetime" | "categorical" | "boolean" | "empty"

_DATE_PATTERNS = [
    re.compile(r"^\d{4}-\d{2}-\d{2}$"),  # 2024-01-15
    re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}"),  # 2024-01-15T10:30
    re.compile(r"^\d{4}-\d{2}$"),  # 2024-01
    re.compile(r"^\d{4}$"),  # 2024 (year)
    re.compile(r"^\d{2}/\d{2}/\d{4}$"),  # 01/15/2024
]


def _is_numeric(v: Any) -> bool:
    if isinstance(v, bool):
        return False
    return isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v))


def _is_datetime(v: Any) -> bool:
    if isinstance(v, (datetime, date)):
        return True
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return False
        return any(p.match(s) for p in _DATE_PATTERNS)
    return False


def _to_float(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        if isinstance(v, float) and math.isnan(v):
            return None
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except (ValueError, AttributeError):
            return None
    return None


def _to_datetime(v: Any) -> datetime | None:
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    if isinstance(v, str):
        s = v.strip()
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d",
            "%Y-%m",
            "%Y",
            "%m/%d/%Y",
        ):
            try:
                return datetime.strptime(s[:19] if "T" in s else s, fmt)
            except ValueError:
                continue
    return None


def classify_column(values: list[Any]) -> ColumnType:
    """Classify a column based on its values."""
    non_null = [v for v in values if v is not None and v != ""]
    if not non_null:
        return "empty"

    sample = non_null[:100]  # Sample for speed

    # Boolean check
    if all(isinstance(v, bool) for v in sample):
        return "boolean"

    # Numeric check (>80% are numeric)
    numeric_count = sum(1 for v in sample if _is_numeric(v) or (isinstance(v, str) and _to_float(v) is not None))
    if numeric_count / len(sample) >= 0.8:
        return "numeric"

    # Datetime check (>80% look like dates)
    dt_count = sum(1 for v in sample if _is_datetime(v))
    if dt_count / len(sample) >= 0.8:
        return "datetime"

    return "categorical"


# ──────────────────────────────────────────────────────────────────────────────
# Per-column summaries
# ──────────────────────────────────────────────────────────────────────────────


def summarize_numeric(values: list[Any]) -> dict:
    """Compute stats for a numeric column."""
    nums = [_to_float(v) for v in values]
    nums = [n for n in nums if n is not None]
    if not nums:
        return {"count": 0}

    total = sum(nums)
    mean = total / len(nums)
    sorted_nums = sorted(nums)
    median = statistics.median(sorted_nums)
    stdev = statistics.stdev(nums) if len(nums) > 1 else 0.0
    min_v = sorted_nums[0]
    max_v = sorted_nums[-1]

    # Outliers (z-score > 2)
    outliers: list[float] = []
    if stdev > 0:
        for n in nums:
            if abs((n - mean) / stdev) > 2:
                outliers.append(n)

    zero_count = sum(1 for n in nums if n == 0)
    negative_count = sum(1 for n in nums if n < 0)

    return {
        "count": len(nums),
        "min": round(min_v, 4),
        "max": round(max_v, 4),
        "mean": round(mean, 4),
        "median": round(median, 4),
        "stdev": round(stdev, 4),
        "sum": round(total, 4),
        "zero_count": zero_count,
        "negative_count": negative_count,
        "outlier_count": len(outliers),
        "outlier_examples": [round(o, 4) for o in outliers[:3]],
    }


def summarize_categorical(values: list[Any]) -> dict:
    """Compute stats for a categorical column."""
    non_null = [str(v) for v in values if v is not None and v != ""]
    if not non_null:
        return {"count": 0, "unique": 0}

    counts: dict[str, int] = {}
    for v in non_null:
        counts[v] = counts.get(v, 0) + 1

    sorted_items = sorted(counts.items(), key=lambda x: -x[1])
    total = len(non_null)
    top_values = [
        {"value": v, "count": c, "pct": round(c * 100.0 / total, 2)}
        for v, c in sorted_items[:5]
    ]

    # Concentration: does the top value dominate?
    top_pct = top_values[0]["pct"] if top_values else 0
    top_two_pct = sum(t["pct"] for t in top_values[:2])

    return {
        "count": total,
        "unique": len(counts),
        "top_values": top_values,
        "top_pct": top_pct,
        "top_two_pct": round(top_two_pct, 2),
    }


def summarize_datetime(values: list[Any]) -> dict:
    """Compute stats for a datetime column."""
    dts = [_to_datetime(v) for v in values]
    dts = [d for d in dts if d is not None]
    if not dts:
        return {"count": 0}

    dts.sort()
    earliest = dts[0]
    latest = dts[-1]
    span_days = (latest - earliest).days

    return {
        "count": len(dts),
        "earliest": earliest.isoformat(),
        "latest": latest.isoformat(),
        "span_days": span_days,
    }


def summarize_boolean(values: list[Any]) -> dict:
    """Compute stats for a boolean column."""
    bools = [v for v in values if isinstance(v, bool)]
    if not bools:
        return {"count": 0}
    true_count = sum(1 for v in bools if v)
    false_count = len(bools) - true_count
    return {
        "count": len(bools),
        "true_count": true_count,
        "false_count": false_count,
        "true_pct": round(true_count * 100.0 / len(bools), 2),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Cross-column analysis
# ──────────────────────────────────────────────────────────────────────────────


def compute_trend(date_vals: list[Any], num_vals: list[Any]) -> dict | None:
    """Detect if a numeric series shows an increasing/decreasing/flat trend over time."""
    pairs: list[tuple[datetime, float]] = []
    for d, n in zip(date_vals, num_vals):
        dt = _to_datetime(d)
        f = _to_float(n)
        if dt is not None and f is not None:
            pairs.append((dt, f))
    if len(pairs) < 3:
        return None

    pairs.sort(key=lambda x: x[0])
    values = [p[1] for p in pairs]

    # Simple linear regression slope (least squares)
    n = len(values)
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    num = sum((xs[i] - mean_x) * (values[i] - mean_y) for i in range(n))
    den = sum((xs[i] - mean_x) ** 2 for i in range(n))
    slope = num / den if den != 0 else 0.0

    first_val = values[0]
    last_val = values[-1]
    if first_val != 0:
        change_pct = ((last_val - first_val) / abs(first_val)) * 100.0
    else:
        change_pct = 0.0

    # Direction classification
    if abs(change_pct) < 5:
        direction = "flat"
    elif change_pct > 0:
        direction = "increasing"
    else:
        direction = "decreasing"

    # Volatility (coefficient of variation)
    mean_v = sum(values) / n
    stdev_v = statistics.stdev(values) if n > 1 else 0.0
    cv = (stdev_v / abs(mean_v)) if mean_v != 0 else 0.0

    return {
        "direction": direction,
        "change_pct": round(change_pct, 2),
        "slope": round(slope, 4),
        "first_value": round(first_val, 4),
        "last_value": round(last_val, 4),
        "peak_value": round(max(values), 4),
        "trough_value": round(min(values), 4),
        "volatility": round(cv, 4),
        "n_points": n,
    }


def compute_group_stats(cat_vals: list[Any], num_vals: list[Any]) -> dict | None:
    """For each category, compute aggregate of numeric values. Returns top/bottom groups."""
    groups: dict[str, list[float]] = {}
    for c, n in zip(cat_vals, num_vals):
        if c is None or c == "":
            continue
        f = _to_float(n)
        if f is None:
            continue
        groups.setdefault(str(c), []).append(f)
    if len(groups) < 2:
        return None

    summary = [
        {
            "value": k,
            "sum": round(sum(v), 4),
            "mean": round(sum(v) / len(v), 4),
            "count": len(v),
        }
        for k, v in groups.items()
    ]
    summary.sort(key=lambda x: -x["sum"])
    total = sum(g["sum"] for g in summary)

    for g in summary:
        g["pct_of_total"] = round((g["sum"] * 100.0 / total) if total != 0 else 0.0, 2)

    top = summary[0]
    bottom = summary[-1]
    leader_gap_pct = 0.0
    if len(summary) >= 2 and summary[1]["sum"] != 0:
        leader_gap_pct = (
            (top["sum"] - summary[1]["sum"]) / abs(summary[1]["sum"]) * 100.0
        )

    return {
        "group_count": len(summary),
        "top": top,
        "bottom": bottom,
        "leader_gap_pct": round(leader_gap_pct, 2),
        "top_3": summary[:3],
        "bottom_3": summary[-3:][::-1] if len(summary) >= 3 else [],
    }


def compute_correlation(a: list[Any], b: list[Any]) -> float | None:
    """Pearson correlation between two numeric columns."""
    pairs: list[tuple[float, float]] = []
    for x, y in zip(a, b):
        fx, fy = _to_float(x), _to_float(y)
        if fx is not None and fy is not None:
            pairs.append((fx, fy))
    if len(pairs) < 3:
        return None
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    try:
        return round(statistics.correlation(xs, ys), 4)  # type: ignore[attr-defined]
    except (statistics.StatisticsError, AttributeError):
        # Manual Pearson if not available
        n = len(xs)
        mx = sum(xs) / n
        my = sum(ys) / n
        num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
        denx = math.sqrt(sum((x - mx) ** 2 for x in xs))
        deny = math.sqrt(sum((y - my) ** 2 for y in ys))
        if denx == 0 or deny == 0:
            return None
        return round(num / (denx * deny), 4)


# ──────────────────────────────────────────────────────────────────────────────
# Main entry: build full data summary
# ──────────────────────────────────────────────────────────────────────────────


def build_data_summary(
    *,
    title: str,
    description: str | None,
    chart_type: str,
    chart_config: dict | None,
    columns: list[str],
    rows: list[list[Any]],
    truncated: bool = False,
) -> dict:
    """
    Build a structured data summary suitable for templated insights or LLM prompts.

    The summary includes:
      - meta: title, chart type, row counts
      - columns: per-column type + stats
      - cross: trend, group comparison, correlation (where applicable)
    """
    row_count = len(rows)

    if row_count == 0:
        return {
            "meta": {
                "title": title,
                "description": description,
                "chart_type": chart_type,
                "row_count": 0,
                "truncated": truncated,
            },
            "columns": [],
            "cross": {},
            "empty": True,
        }

    # Build per-column value arrays
    col_values: dict[str, list[Any]] = {c: [] for c in columns}
    for row in rows:
        for i, c in enumerate(columns):
            col_values[c].append(row[i] if i < len(row) else None)

    # Classify and summarize each column
    col_summaries: list[dict] = []
    col_types: dict[str, str] = {}
    for c in columns:
        vals = col_values[c]
        ctype = classify_column(vals)
        col_types[c] = ctype
        entry: dict[str, Any] = {"name": c, "type": ctype}
        if ctype == "numeric":
            entry["stats"] = summarize_numeric(vals)
        elif ctype == "categorical":
            entry["stats"] = summarize_categorical(vals)
        elif ctype == "datetime":
            entry["stats"] = summarize_datetime(vals)
        elif ctype == "boolean":
            entry["stats"] = summarize_boolean(vals)
        else:
            entry["stats"] = {"count": 0}
        col_summaries.append(entry)

    # Cross-column analysis driven by chart_config (x/y axis) when available
    cross: dict[str, Any] = {}
    config = chart_config or {}
    x_axis_raw = config.get("xAxis") or config.get("x_axis") or config.get("xField")
    y_axis_raw = config.get("yAxis") or config.get("y_axis") or config.get("yField")

    # Normalize: xAxis can be string; yAxis can be string or list of strings
    x_axis = x_axis_raw if isinstance(x_axis_raw, str) else None
    if isinstance(y_axis_raw, list):
        # Pick the first numeric column from the y-axis list
        y_axis = None
        for candidate in y_axis_raw:
            if isinstance(candidate, str) and col_types.get(candidate) == "numeric":
                y_axis = candidate
                break
        if y_axis is None and y_axis_raw:
            # Fall back to first y-axis entry that is a string
            for candidate in y_axis_raw:
                if isinstance(candidate, str):
                    y_axis = candidate
                    break
    elif isinstance(y_axis_raw, str):
        y_axis = y_axis_raw
    else:
        y_axis = None

    # Pick x/y if not in config: first datetime/categorical for x, first numeric for y
    if not x_axis:
        for c in columns:
            if col_types[c] in ("datetime", "categorical"):
                x_axis = c
                break
    if not y_axis:
        for c in columns:
            if col_types[c] == "numeric":
                y_axis = c
                break

    if x_axis and y_axis and x_axis in col_values and y_axis in col_values:
        x_type = col_types.get(x_axis)
        if x_type == "datetime":
            trend = compute_trend(col_values[x_axis], col_values[y_axis])
            if trend:
                cross["trend"] = {"x": x_axis, "y": y_axis, **trend}
        elif x_type == "categorical":
            grp = compute_group_stats(col_values[x_axis], col_values[y_axis])
            if grp:
                cross["groups"] = {"by": x_axis, "metric": y_axis, **grp}

    # Correlation between first two numeric columns (if any)
    numeric_cols = [c for c in columns if col_types[c] == "numeric"]
    if len(numeric_cols) >= 2 and numeric_cols[0] != numeric_cols[1]:
        corr = compute_correlation(
            col_values[numeric_cols[0]], col_values[numeric_cols[1]]
        )
        if corr is not None:
            cross["correlation"] = {
                "a": numeric_cols[0],
                "b": numeric_cols[1],
                "coefficient": corr,
                "strength": _correlation_strength(corr),
            }

    return {
        "meta": {
            "title": title,
            "description": description,
            "chart_type": chart_type,
            "row_count": row_count,
            "truncated": truncated,
            "x_axis": x_axis,
            "y_axis": y_axis,
        },
        "columns": col_summaries,
        "cross": cross,
        "empty": False,
    }


def _correlation_strength(c: float) -> str:
    a = abs(c)
    if a >= 0.7:
        return "strong"
    if a >= 0.4:
        return "moderate"
    if a >= 0.2:
        return "weak"
    return "none"


# ──────────────────────────────────────────────────────────────────────────────
# Fallback: templated insights (no LLM)
# ──────────────────────────────────────────────────────────────────────────────


_ID_LIKE_PATTERN = re.compile(r"(^|_)(id|uuid|key|guid|sid|pk)($|_)", re.IGNORECASE)
_ID_SUFFIX_PATTERN = re.compile(r"(id|uuid|key|guid)$", re.IGNORECASE)


def _looks_like_id_column(name: str) -> bool:
    """Heuristic: column names that look like identifiers, not measures."""
    if not name:
        return False
    n = name.strip().lower()
    if n in {"id", "uuid", "key", "guid", "sid", "pk"}:
        return True
    if _ID_LIKE_PATTERN.search(n):
        return True
    # Also catch trailing "id"/"uuid"/"key"/"guid" without underscore separator
    # (e.g. "trackwiseid", "userid", "orderkey")
    return bool(_ID_SUFFIX_PATTERN.search(n))


def _fmt_num(n: float) -> str:
    """Format a number compactly: 1234567 -> 1.23M, 4500 -> 4.5K, 12.3 -> 12.3."""
    if n is None:
        return "N/A"
    try:
        n = float(n)
    except (TypeError, ValueError):
        return str(n)
    abs_n = abs(n)
    if abs_n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B"
    if abs_n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    if abs_n >= 1_000:
        return f"{n / 1_000:.2f}K"
    if abs_n >= 10 or n == int(n):
        return f"{n:,.0f}" if n == int(n) else f"{n:,.2f}"
    return f"{n:.2f}"


def generate_templated_insights(summary: dict) -> list[str]:
    """Generate plain-English insights without an LLM, from the data summary.

    Focus on what a business user cares about: what stands out, what's the biggest
    thing, what's the trend. Avoid statistics jargon (correlation, z-score, etc.)
    unless the relationship is strong enough to be actionable.
    """
    if summary.get("empty"):
        return ["No data was returned by this visualization."]

    insights: list[str] = []
    meta = summary["meta"]
    cross = summary.get("cross", {})
    cols = summary.get("columns", [])
    rc = meta["row_count"]

    # 1. Trend insight (datetime + numeric) — most useful for time series
    if "trend" in cross:
        t = cross["trend"]
        direction = t["direction"]
        change = t.get("change_pct", 0)
        y = t["y"]
        if direction == "flat":
            insights.append(
                f"{y} stayed relatively stable over the period, with only a {change:+.1f}% change overall."
            )
        else:
            verb = "grew" if direction == "increasing" else "declined"
            insights.append(
                f"{y} {verb} by {abs(change):.1f}% from the start to the end of the period."
            )
        if t.get("volatility", 0) > 0.5:
            insights.append(
                f"Values fluctuated noticeably day-to-day, suggesting irregular activity rather than a smooth trend."
            )

    # 2. Group comparison (categorical + numeric) — leaders and laggards
    if "groups" in cross:
        g = cross["groups"]
        top = g["top"]
        bottom = g["bottom"]
        metric = g["metric"]
        top_share = top.get("pct_of_total", 0)
        if top_share >= 50:
            insights.append(
                f'"{top["value"]}" dominates {metric}, accounting for {top_share:.0f}% of the total ({_fmt_num(top.get("value_sum") or top.get("sum") or 0)}).'
            )
        elif top_share >= 25:
            insights.append(
                f'"{top["value"]}" is the top performer in {metric} with {top_share:.0f}% of the total.'
            )
        else:
            insights.append(
                f'"{top["value"]}" leads {metric} at {_fmt_num(top.get("value_sum") or top.get("sum") or 0)}, though contribution is spread across many groups.'
            )
        gap = g.get("leader_gap_pct", 0)
        if gap > 50:
            insights.append(
                f'The leader is more than {gap:.0f}% ahead of the next group — a sizable gap worth investigating.'
            )
        if bottom and top["value"] != bottom["value"] and bottom.get("pct_of_total", 0) < 5:
            insights.append(
                f'"{bottom["value"]}" contributes only {bottom["pct_of_total"]:.1f}% — consider whether it deserves continued focus.'
            )

    # 3. Per-numeric-column summary — totals, ranges, highs and lows
    #    Only when no trend/groups already covered the key story.
    if "trend" not in cross and "groups" not in cross:
        for col in cols:
            if col["type"] == "numeric" and not _looks_like_id_column(col["name"]):
                s = col["stats"]
                if s.get("count", 0) > 0:
                    insights.append(
                        f"{col['name']} ranges from {_fmt_num(s.get('min'))} to {_fmt_num(s.get('max'))}, averaging {_fmt_num(s.get('mean'))} across {s.get('count')} records."
                    )
                    total = s.get("sum")
                    if total is not None and s.get("count", 0) > 1:
                        insights.append(
                            f"Total {col['name']} across all records is {_fmt_num(total)}."
                        )
                break  # one numeric column is enough at this level

    # 4. Categorical diversity — how many distinct values
    for col in cols:
        if col["type"] == "categorical":
            s = col["stats"]
            distinct = s.get("distinct_count", 0)
            if distinct > 0 and rc > 0:
                if distinct == 1:
                    insights.append(
                        f"All records share the same {col['name']}: \"{s.get('top_value', '')}\"."
                    )
                elif distinct >= rc * 0.9:
                    insights.append(
                        f"{col['name']} is highly varied — nearly every record has a unique value ({distinct} distinct out of {rc})."
                    )
            break

    # 5. Correlation — only mention if strong AND not between ID-like columns
    if "correlation" in cross:
        c = cross["correlation"]
        strength = c.get("strength", "none")
        coef = c.get("coefficient", 0)
        a, b = c.get("a", ""), c.get("b", "")
        if strength in {"strong", "moderate"} and not (
            _looks_like_id_column(a) or _looks_like_id_column(b)
        ):
            direction = "rise together" if coef > 0 else "move in opposite directions"
            insights.append(
                f"{a} and {b} {direction} — when one changes, the other tends to follow ({strength} relationship)."
            )

    # 6. Outliers — only when meaningful (at least 5 data points) and not on ID columns
    if rc >= 5:
        for col in cols:
            if col["type"] == "numeric" and not _looks_like_id_column(col["name"]):
                s = col["stats"]
                oc = s.get("outlier_count", 0)
                examples = s.get("outlier_examples", [])
                if oc > 0 and examples:
                    ex_str = ", ".join(_fmt_num(e) for e in examples[:2])
                    insights.append(
                        f"{col['name']} has {oc} unusually high or low value(s) ({ex_str}) that stand apart from the typical range — worth a closer look."
                    )
                    break

    # Row count / truncation context (only if relevant)
    if meta.get("truncated"):
        insights.append(
            f"This analysis is based on the first {rc} rows; the full result set was larger."
        )

    if not insights:
        insights.append(
            f"This {meta['chart_type']} chart shows {rc} record(s). No standout patterns were detected automatically — try grouping or filtering for sharper insights."
        )

    return insights[:5]
