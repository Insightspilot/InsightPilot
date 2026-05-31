"""
Gemini AI integration for generating natural-language insights from data summaries.

Uses the Gemini REST API directly via httpx — no extra SDK dependency required.
Falls back to templated insights when GEMINI_API_KEY is not set or the API call fails.

Free tier (as of writing): 15 req/min, 1500 req/day, 1M tokens/day with Gemini Flash.
Sign up at https://aistudio.google.com/ to get a free API key.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services import insight_service

logger = logging.getLogger(__name__)


GEMINI_ENDPOINT_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)
GEMINI_TIMEOUT_SECONDS = 15.0
MAX_INSIGHTS = 5


SYSTEM_PROMPT = """You are a senior data analyst writing concise, actionable insights about a single visualization for a business user.

You will receive:
  - The visualization's title, description, and chart type
  - A statistical summary of the data (column types, distributions, trends, group comparisons)

Your job: write 3-5 short insights (one or two sentences each). Each insight must:
  - State a specific observation grounded in the numbers (cite figures from the summary)
  - Use plain business language — avoid statistical jargon (no "z-score", "stdev", "Pearson", etc.)
  - Be useful — point out trends, anomalies, dominant segments, or notable comparisons
  - NOT repeat the chart title or restate obvious facts

Format your response strictly as a JSON array of strings, like:
["insight 1", "insight 2", "insight 3"]

Do not include any text outside the JSON array. Do not use markdown code fences.
"""


def _build_user_prompt(summary: dict) -> str:
    """Compact textual representation of the data summary for the LLM."""
    meta = summary["meta"]
    lines: list[str] = []
    lines.append(f"Title: {meta['title']}")
    if meta.get("description"):
        lines.append(f"Description: {meta['description']}")
    lines.append(f"Chart type: {meta['chart_type']}")
    lines.append(f"Row count: {meta['row_count']}")
    if meta.get("truncated"):
        lines.append("Note: results were truncated at 1000 rows.")
    if meta.get("x_axis"):
        lines.append(f"X axis: {meta['x_axis']}")
    if meta.get("y_axis"):
        lines.append(f"Y axis: {meta['y_axis']}")

    lines.append("")
    lines.append("Columns:")
    for col in summary.get("columns", []):
        stats = col.get("stats", {})
        if col["type"] == "numeric":
            lines.append(
                f"  - {col['name']} (numeric): "
                f"min={stats.get('min')}, max={stats.get('max')}, "
                f"mean={stats.get('mean')}, median={stats.get('median')}, "
                f"sum={stats.get('sum')}, outliers={stats.get('outlier_count', 0)}"
            )
        elif col["type"] == "categorical":
            top = stats.get("top_values", [])
            top_str = ", ".join(
                f"{t['value']} ({t['pct']}%)" for t in top[:3]
            )
            lines.append(
                f"  - {col['name']} (categorical): "
                f"{stats.get('unique')} unique values; top: {top_str}"
            )
        elif col["type"] == "datetime":
            lines.append(
                f"  - {col['name']} (datetime): "
                f"{stats.get('earliest')} to {stats.get('latest')} "
                f"({stats.get('span_days')} days)"
            )
        elif col["type"] == "boolean":
            lines.append(
                f"  - {col['name']} (boolean): "
                f"{stats.get('true_pct')}% true"
            )

    cross = summary.get("cross", {})
    if cross:
        lines.append("")
        lines.append("Analysis:")
    if "trend" in cross:
        t = cross["trend"]
        lines.append(
            f"  - Trend: {t['y']} over {t['x']} is {t['direction']} "
            f"({t['change_pct']:+.1f}% change). "
            f"First: {t['first_value']}, last: {t['last_value']}, "
            f"peak: {t['peak_value']}, trough: {t['trough_value']}."
        )
    if "groups" in cross:
        g = cross["groups"]
        top = g["top"]
        bottom = g["bottom"]
        top3 = ", ".join(f"{x['value']} ({x['pct_of_total']}%)" for x in g.get("top_3", []))
        lines.append(
            f"  - Group comparison of {g['metric']} by {g['by']} "
            f"across {g['group_count']} groups. Top 3: {top3}. "
            f"Leader gap: {g.get('leader_gap_pct', 0):.1f}%. "
            f"Lowest: {bottom['value']} ({bottom['pct_of_total']}%)."
        )
    if "correlation" in cross:
        c = cross["correlation"]
        lines.append(
            f"  - Correlation between {c['a']} and {c['b']}: "
            f"{c['coefficient']} ({c['strength']})."
        )

    return "\n".join(lines)


async def _call_gemini(prompt: str, api_key: str) -> str | None:
    """Call Gemini Flash REST API. Returns response text or None on failure."""
    model = getattr(settings, "GEMINI_MODEL", "") or "gemini-2.0-flash-lite"
    url = f"{GEMINI_ENDPOINT_TEMPLATE.format(model=model)}?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 512,
            "responseMimeType": "application/json",
        },
    }
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                logger.warning(
                    "Gemini API returned %s: %s", r.status_code, r.text[:200]
                )
                return None
            data = r.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                return None
            return parts[0].get("text")
    except (httpx.HTTPError, json.JSONDecodeError) as e:
        logger.warning("Gemini API call failed: %s", e)
        return None


def _parse_insights(text: str) -> list[str] | None:
    """Parse Gemini's response into a list of insight strings."""
    if not text:
        return None
    cleaned = text.strip()
    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            insights = [str(x).strip() for x in parsed if isinstance(x, str) and x.strip()]
            return insights[:MAX_INSIGHTS] if insights else None
    except json.JSONDecodeError:
        # Fall through — Gemini may have returned plain lines
        pass
    # Fallback: split by newlines and strip bullets/numbers
    lines = [
        ln.strip().lstrip("-*0123456789.) ").strip()
        for ln in cleaned.split("\n")
        if ln.strip()
    ]
    lines = [ln for ln in lines if ln]
    return lines[:MAX_INSIGHTS] if lines else None


async def generate_insights(
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
    Top-level entry: compute statistical summary, then generate natural-language insights.

    Returns:
      {
        "insights": list[str],          # Natural language insights
        "source": "gemini" | "templated", # Which generator produced them
        "summary": dict,                # Full statistical summary (for debugging/UI)
      }
    """
    summary = insight_service.build_data_summary(
        title=title,
        description=description,
        chart_type=chart_type,
        chart_config=chart_config,
        columns=columns,
        rows=rows,
        truncated=truncated,
    )

    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    used_gemini = False
    gemini_insights: list[str] | None = None

    if api_key and not summary.get("empty"):
        prompt = _build_user_prompt(summary)
        text = await _call_gemini(prompt, api_key)
        if text:
            gemini_insights = _parse_insights(text)
            if gemini_insights:
                used_gemini = True

    if used_gemini and gemini_insights:
        return {
            "insights": gemini_insights,
            "source": "gemini",
            "summary": summary,
        }

    # Fallback: templated insights from the statistical summary
    return {
        "insights": insight_service.generate_templated_insights(summary),
        "source": "templated",
        "summary": summary,
    }
