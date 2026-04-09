# separate file for complex logic
# reasons over fact-checks + coverage data,
# wag ito i-ooverwrite sa pipeline.py, dapat separate file siya since medyo complex na logic niya

import json
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict
from typing import List, Tuple
from groq import Groq
from models import (
    ExtractedClaim, FactCheckResults, CoverageReport, Verdict,
    VerdictTrace, VerdictStep, SourceCredibility,
)
from config import get_settings

settings = get_settings()

VALID_RATINGS = {"true", "false", "misleading", "unverified", "needs_context"}

_REGISTRY_PATH = Path(__file__).parent.parent / "data" / "bias_registry.json"
with open(_REGISTRY_PATH) as f:
    _REGISTRY: dict = json.load(f)["outlets"]

_groq_client = None

def _groq():
    global _groq_client
    if _groq_client is None:
        if not settings.GROQ_API_KEY:
            raise ValueError(
                "GROQ_API_KEY is not configured in .env. "
                "Get your key from: https://console.groq.com/keys"
            )
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
    return _groq_client

_TRUTH_VALUE = {
    "true": 1.0,
    "false": 0.0,
    "misleading": 0.6,
    "needs_context": 0.5,
    "unverified": 0.5,
}

def _aggregate_fact_check_verdicts(fact_checks: FactCheckResults) -> Tuple[float, str]:
    if not fact_checks.found or not fact_checks.matches:
        return None
    scores = []
    rating_counts = defaultdict(int)
    for fc in fact_checks.matches:
        score = _TRUTH_VALUE.get(fc.verdict.lower(), 0.5)
        scores.append(score)
        rating_counts[fc.verdict.lower()] += 1

    avg_score = sum(scores) / len(scores)
    rating = max(rating_counts.items(), key=lambda x: x[1])[0] if rating_counts else "unverified"
    return avg_score, rating

def _cluster_sources_by_content(sources: List[str]) -> List[List[str]]:
    clusters = defaultdict(list)
    for s in sources:
        clusters[s].append(s)
    return list(clusters.values())

def _compute_cross_reference_score(
    coverage: CoverageReport,
) -> float:
    outlet_info = {
        o.outlet: _REGISTRY.get(o.outlet, {
            "credibility_score": 0.5,
            "bias": "center",
        })
        for o in coverage.covering
    }

    outlets = [o.outlet for o in coverage.covering]
    clusters = _cluster_sources_by_content(outlets)

    weighted_scores = []
    weights = []

    for cluster in clusters:
        cred_scores = [outlet_info.get(outlet, {}).get("credibility_score", 0.5) for outlet in cluster]
        avg_cred = sum(cred_scores) / max(len(cred_scores), 1)
        truth_score = 0.5
        echo_weight = 1 / len(cluster)

        weighted_scores.append(truth_score * avg_cred * echo_weight)
        weights.append(avg_cred * echo_weight)

    if not weights:
        return 0.5

    cross_ref_score = sum(weighted_scores) / sum(weights)
    return cross_ref_score

def _calculate_polarization_penalty(bias_spread: dict) -> float:
    left = bias_spread.get("left", 0)
    center = bias_spread.get("center", 0)
    right = bias_spread.get("right", 0)
    total = left + center + right
    if total == 0:
        return 0.0

    left_norm = left / total
    center_norm = center / total
    right_norm = right / total

    polarization = max(left_norm, right_norm)
    penalty = polarization * 0.3
    return penalty

def _map_score_to_rating(score: float) -> str:
    if score >= 0.85:
        return "true"
    elif score >= 0.6:
        return "misleading"
    elif score >= 0.4:
        return "needs_context"
    elif score >= 0.2:
        return "unverified"
    else:
        return "false"

async def generate_verdict(
    claim: ExtractedClaim,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
    input_type: str,
    source_surface: str,
) -> Verdict:

    fc_agg = _aggregate_fact_check_verdicts(fact_checks)
    if fc_agg is not None:
        verdict_score, rating = fc_agg
        confidence = 0.95
    else:
        cross_ref_score = _compute_cross_reference_score(coverage)
        polarization_penalty = _calculate_polarization_penalty(coverage.bias_spread)
        adjusted_score = max(0.0, cross_ref_score - polarization_penalty)
        rating = _map_score_to_rating(adjusted_score)
        confidence = min(0.85, max(0.1, adjusted_score))

    prompt = _build_verdict_prompt(claim, fact_checks, coverage)

    response = _groq().chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Ikaw ay isang dalubhasang fact-checker ng mga balita at impormasyon sa Pilipinas. "
                    "Sinusuri mo ang mga claim gamit ang mga ebidensya at nagbibigay ng malinaw na hatol. "
                    "Lagi kang sumasagot ng valid JSON lamang — walang markdown, walang paliwanag sa labas ng JSON.\n\n"
                    "You are an expert fact-checker for Philippine news and information. "
                    "You analyze claims using evidence and give clear verdicts. "
                    "Always respond with valid JSON only."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=1024
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {}

    explanation_en = parsed.get("explanation_en", "placeholder: bading si dion")
    explanation_tl = parsed.get("explanation_tl", "placeholder: bading si dion")
    reasoning_summary = parsed.get("reasoning_summary", "placeholder: bading si dion")
    trace_summary = parsed.get("trace_summary", "placeholder: bading si dion")
    sources = parsed.get("sources", ["placeholder: bading si dion"])

    return Verdict(
        claim=claim.core_claim,
        rating=rating,
        confidence=confidence,
        explanation_en=explanation_en,
        explanation_tl=explanation_tl,
        sources=sources,
        fact_checks_found=fact_checks.matches,
        coverage=coverage,
        trace=_build_trace(parsed, fact_checks, coverage),
        source_credibility=_build_source_credibility(coverage),
        input_type=input_type,
        source_surface=source_surface,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

def _build_trace(parsed: dict, fact_checks: FactCheckResults, coverage: CoverageReport) -> VerdictTrace:
    steps = []

    if fact_checks.found:
        fc_sources = list({m.source for m in fact_checks.matches[:3]})
        steps.append(VerdictStep(
            step="Fact Check Lookup",
            finding=f"Found {len(fact_checks.matches)} existing fact-check(s) from {', '.join(fc_sources)}",
            weight="high", icon="🔍",
        ))
    else:
        steps.append(VerdictStep(
            step="Fact Check Lookup",
            finding="No existing fact-checks found in IFCN-certified sources",
            weight="medium", icon="🔍",
        ))

    covering_count = len(coverage.covering)
    bias = coverage.bias_spread
    if covering_count > 0:
        spread = [f"{v} {k}" for k, v in bias.items() if v > 0]
        steps.append(VerdictStep(
            step="Coverage Analysis",
            finding=f"{covering_count} outlet(s) found - bias spread: {', '.join(spread) or 'none detected'}",
            weight="medium", icon="📰",
        ))
    else:
        steps.append(VerdictStep(
            step="Coverage Analysis",
            finding="No Philippine news outlets found covering this story",
            weight="low", icon="📰",
        ))

    ai_finding = reasoning_summary = parsed.get("reasoning_summary", "") or (parsed.get("explanation_en", "") or "")[:120]
    steps.append(VerdictStep(
        step="AI Reasoning",
        finding=ai_finding or "Verdict derived from available evidence",
        weight="high", icon="🤖",
    ))

    summary = parsed.get(
        "trace_summary",
        f"Verdict reached based on {len(fact_checks.matches)} fact-check(s) and {covering_count} outlet(s)."
    )
    return VerdictTrace(steps=steps, summary=summary)

def _build_source_credibility(coverage: CoverageReport) -> List[SourceCredibility]:
    result = []
    for outlet_cov in coverage.covering:
        entry = _REGISTRY.get(outlet_cov.outlet)
        if not entry:
            continue
        result.append(SourceCredibility(
            outlet=outlet_cov.outlet,
            score=entry.get("credibility_score", 0.5),
            classification=entry.get("credibility_class", "needs_context"),
            explanation=entry.get("credibility_explanation", "placeholder: bading si dion"),
            bias=entry.get("bias", "center"),
        ))
    result.sort(key=lambda x: x.score, reverse=True)
    return result

def _build_verdict_prompt(
    claim: ExtractedClaim,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
) -> str:
    fc_text = "None found."
    if fact_checks.found and fact_checks.matches:
        fc_text = "\n".join(
            f"- [{m.source}] Verdict: {m.verdict} | Claim: {m.claim_reviewed} | URL: {m.url}"
            for m in fact_checks.matches[:5]
        )

    covering_names = [o.outlet for o in coverage.covering]
    bias = coverage.bias_spread

    return f"""Evaluate the following claim and return a fact-check verdict explanation.

CLAIM TO EVALUATE:
"{claim.core_claim}"

NAMED ENTITIES: {', '.join(claim.entities) or 'None identified'}

EXISTING FACT-CHECKS FOUND:
{fc_text}

NEWS COVERAGE:
- Outlets covering this story: {', '.join(covering_names) or 'None'}
- Outlets NOT covering this story: {', '.join(coverage.not_covering) or 'None'}
- Bias spread: Left={bias.get('left', 0)}, Center={bias.get('center', 0)}, Right={bias.get('right', 0)}, State={bias.get('state', 0)}

INSTRUCTIONS:
1. Use the verdict provided by authoritative fact-checks if available.
2. If not, rely on cross-referenced source credibility and coverage.
3. Assign a clear explanation in English and Tagalog.
4. Provide a concise reasoning summary.
5. Provide a trace summary summarizing the analysis process.
6. List all source URLs used.

Respond ONLY with this JSON:
{{
  "rating": "true|false|misleading|unverified|needs_context",
  "confidence": 0.0,
  "explanation_en": "English explanation here.",
  "explanation_tl": "Paliwanag sa Filipino dito.",
  "reasoning_summary": "One sentence: the key reason for this verdict.",
  "trace_summary": "One sentence: summary of the analysis process.",
  "sources": ["url1", "url2"]
}}"""

##kuya dwane/razo pa-update ng no. 4 after implementing credibility/confidence calculation, reference na lang here