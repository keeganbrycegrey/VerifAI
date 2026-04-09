import json
import math
from datetime import datetime, timezone
from pathlib import Path
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

_client = None

def _groq():
    global _client
    if _client is None:
        if not settings.GROQ_API_KEY:
            raise ValueError(
                "GROQ_API_KEY is not configured in .env. "
                "Get your key from: https://console.groq.com/keys"
            )
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def _normalize_fact_check_rating(verdict: str) -> str:
    text = (verdict or "").lower()
    if any(keyword in text for keyword in ["misleading", "mostly false", "pants on fire", "half true", "partly false"]):
        return "misleading"
    if any(keyword in text for keyword in ["false", "mali", "not true", "fabricated", "wrong"]):
        return "false"
    if any(keyword in text for keyword in ["true", "totoo", "correct", "accurate", "mostly true"]):
        return "true"
    if "needs context" in text:
        return "needs_context"
    if any(keyword in text for keyword in ["unverified", "not verified", "unclear", "not enough evidence"]):
        return "unverified"
    return "unverified"


def _calculate_fact_check_score(fact_checks: FactCheckResults) -> tuple[float, str]:
    if not fact_checks.found or not fact_checks.matches:
        return 0.0, "unverified"

    normalized = [_normalize_fact_check_rating(m.verdict) for m in fact_checks.matches if m.verdict]
    if not normalized:
        return 0.0, "unverified"

    top_rating = normalized[0]
    agreement = sum(1 for rating in normalized if rating == top_rating) / len(normalized)
    match_count = len(normalized)
    score = 0.50 + 0.20 * agreement + 0.05 * min(2, match_count - 1)
    if fact_checks.high_confidence:
        score += 0.10
    return min(score, 0.95), top_rating


def _score_coverage_support(coverage: CoverageReport) -> tuple[float, float, int]:
    if not coverage.covering:
        return 0.0, 0.0, 0

    total_articles = 0
    weighted_scores: list[tuple[float, float]] = []
    for outlet_cov in coverage.covering:
        entry = _REGISTRY.get(outlet_cov.outlet)
        if not entry:
            continue
        credibility = float(entry.get("credibility_score", 0.5))
        weight = math.sqrt(max(1, outlet_cov.article_count))
        weighted_scores.append((credibility, weight))
        total_articles += outlet_cov.article_count

    if not weighted_scores:
        return 0.0, 0.0, total_articles

    numerator = sum(score * weight for score, weight in weighted_scores)
    denominator = sum(weight for _, weight in weighted_scores)
    coverage_score = numerator / denominator
    depth_factor = min(1.0, total_articles / 6.0)

    bias_distribution = coverage.bias_spread
    total_span = sum(bias_distribution.values())
    bias_balance = 0.0
    if total_span > 0:
        max_share = max(value / total_span for value in bias_distribution.values())
        bias_balance = 1.0 - max_share

    return coverage_score * depth_factor, bias_balance, total_articles


def _build_verdict_sources(
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
) -> list[str]:
    sources: list[str] = []
    for match in fact_checks.matches[:5]:
        if match.url and match.url not in sources:
            sources.append(match.url)
    for outlet_cov in coverage.covering:
        if outlet_cov.sample_url and outlet_cov.sample_url not in sources:
            sources.append(outlet_cov.sample_url)
    return sources


def _decide_rating_and_confidence(
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
) -> tuple[str, float, list[str], dict]:
    fact_score, fact_rating = _calculate_fact_check_score(fact_checks)
    coverage_score, bias_balance, total_articles = _score_coverage_support(coverage)
    evidence_sources = _build_verdict_sources(fact_checks, coverage)

    if fact_checks.found:
        confidence = min(1.0, 0.65 + 0.25 * fact_score + 0.10 * min(1.0, coverage_score))
        if fact_rating == "unverified" and coverage_score >= 0.60:
            fact_rating = "needs_context"
        return fact_rating, confidence, evidence_sources, {
            "mode": "fact-check",
            "fact_score": fact_score,
            "coverage_score": coverage_score,
            "bias_balance": bias_balance,
            "total_articles": total_articles,
        }

    if coverage_score >= 0.60 and bias_balance >= 0.30:
        return "needs_context", min(0.75, 0.35 + 0.40 * coverage_score + 0.10 * bias_balance), evidence_sources, {
            "mode": "coverage_support",
            "coverage_score": coverage_score,
            "bias_balance": bias_balance,
            "total_articles": total_articles,
        }

    if coverage_score >= 0.35:
        return "unverified", min(0.55, 0.20 + 0.35 * coverage_score), evidence_sources, {
            "mode": "coverage_weak",
            "coverage_score": coverage_score,
            "bias_balance": bias_balance,
            "total_articles": total_articles,
        }

    return "unverified", 0.10, evidence_sources, {
        "mode": "no_evidence",
        "coverage_score": 0.0,
        "bias_balance": 0.0,
        "total_articles": 0,
    }


async def generate_verdict(
    claim: ExtractedClaim,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
    input_type: str,
    source_surface: str,
) -> Verdict:

    rating, confidence, evidence_sources, decision_context = _decide_rating_and_confidence(fact_checks, coverage)
    prompt = _build_explanation_prompt(
        claim,
        fact_checks,
        coverage,
        rating,
        confidence,
        evidence_sources,
        decision_context,
    )

    response = _groq().chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Ikaw ay isang dalubhasang fact-checker ng mga balita at impormasyon sa Pilipinas. "
                    "Ipaliwanag ang hatol na ibinigay mula sa umiiral na ebidensya. "
                    "Huwag baguhin ang rating o confidence na ibinigay ng system. "
                    "Lagi kang sumasagot ng valid JSON lamang — walang markdown, walang paliwanag sa labas ng JSON.\n\n"
                    "You are an expert fact-checker for Philippine news and information. "
                    "Explain the verdict that the system has already determined based on evidence. "
                    "Do not change the rating or confidence values. "
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

    explanation_en = ""
    explanation_tl = ""
    reasoning_summary = ""
    trace_summary = ""
    parsed_sources: list[str] = []

    try:
        parsed = json.loads(raw)
        explanation_en = parsed.get("explanation_en", "")
        explanation_tl = parsed.get("explanation_tl", "")
        reasoning_summary = parsed.get("reasoning_summary", "")
        trace_summary = parsed.get("trace_summary", "")
        parsed_sources = parsed.get("sources", []) or []
    except json.JSONDecodeError:
        explanation_en = "No explanation could be generated from the language model."
        explanation_tl = "Hindi makabuo ng paliwanag mula sa modelong pangwika."
        reasoning_summary = "The system was unable to generate a natural-language explanation."
        trace_summary = "Explanation generation failed; verdict is based on deterministic evidence rules."

    sources = parsed_sources or evidence_sources

    return Verdict(
        claim=claim.core_claim,
        rating=rating,
        confidence=confidence,
        explanation_en=explanation_en,
        explanation_tl=explanation_tl,
        sources=sources,
        fact_checks_found=fact_checks.matches,
        coverage=coverage,
        trace=_build_trace(
            fact_checks=fact_checks,
            coverage=coverage,
            rating=rating,
            confidence=confidence,
            reasoning_summary=reasoning_summary,
            trace_summary=trace_summary,
        ),
        source_credibility=_build_source_credibility(coverage),
        input_type=input_type,
        source_surface=source_surface,
        timestamp=datetime.now(timezone.utc).isoformat(),
        decision_context=decision_context,
    )


def _build_trace(
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
    rating: str,
    confidence: float,
    reasoning_summary: str,
    trace_summary: str,
) -> VerdictTrace:
    steps: list[VerdictStep] = []

    if fact_checks.found:
        fc_sources = list({m.source for m in fact_checks.matches[:3]})
        steps.append(VerdictStep(
            step="Fact Check Evidence",
            finding=f"Found {len(fact_checks.matches)} fact-check match(es) from {', '.join(fc_sources)}",
            weight="high",
            icon="🔍",
        ))
    else:
        steps.append(VerdictStep(
            step="Fact Check Evidence",
            finding="No existing fact-check matches were found",
            weight="medium",
            icon="🔍",
        ))

    covering_count = len(coverage.covering)
    bias = coverage.bias_spread
    if covering_count > 0:
        spread = [f"{v} {k}" for k, v in bias.items() if v > 0]
        steps.append(VerdictStep(
            step="Coverage Evidence",
            finding=f"{covering_count} outlet(s) cover the claim - bias spread: {', '.join(spread) or 'none detected'}",
            weight="medium",
            icon="📰",
        ))
    else:
        steps.append(VerdictStep(
            step="Coverage Evidence",
            finding="No Philippine news outlets reported on the claim",
            weight="low",
            icon="📰",
        ))

    steps.append(VerdictStep(
        step="Verdict Rule",
        finding=f"Deterministic verdict selected: {rating} with confidence {confidence:.2f}",
        weight="high",
        icon="⚖️",
    ))

    if reasoning_summary:
        steps.append(VerdictStep(
            step="AI Explanation",
            finding=reasoning_summary,
            weight="medium",
            icon="🤖",
        ))

    summary = trace_summary or f"Final verdict based on evidence scoring and the selected rating '{rating}'."
    return VerdictTrace(steps=steps, summary=summary)


def _build_source_credibility(coverage: CoverageReport) -> list[SourceCredibility]:
    result = []
    for outlet_cov in coverage.covering:
        entry = _REGISTRY.get(outlet_cov.outlet)
        if not entry:
            continue
        result.append(SourceCredibility(
            outlet=outlet_cov.outlet,
            score=entry.get("credibility_score", 0.5),
            classification=entry.get("credibility_class", "needs_context"),
            explanation=entry.get("credibility_explanation", ""),
            bias=entry.get("bias", "center"),
        ))
    result.sort(key=lambda x: x.score, reverse=True)
    return result


def _fallback_verdict(
    claim: ExtractedClaim,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
    input_type: str,
    source_surface: str,
) -> Verdict:
    return Verdict(
        claim=claim.core_claim,
        rating="unverified",
        confidence=0.0,
        explanation_en="Could not generate verdict — please try again.",
        explanation_tl="Hindi makabuo ng hatol — subukan muli.",
        sources=[],
        fact_checks_found=fact_checks.matches,
        coverage=coverage,
        trace=VerdictTrace(
            steps=[VerdictStep(
                step="AI Reasoning",
                finding="Verdict generation failed — model returned unexpected output",
                weight="high", icon="🤖",
            )],
            summary="Analysis incomplete. Please try again.",
        ),
        source_credibility=_build_source_credibility(coverage),
        input_type=input_type,
        source_surface=source_surface,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def _build_explanation_prompt(
    claim: ExtractedClaim,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
    rating: str,
    confidence: float,
    sources: list[str],
    decision_context: dict,
) -> str:
    fc_text = "None found."
    if fact_checks.found and fact_checks.matches:
        fc_text = "\n".join(
            f"- [{m.source}] Verdict: {m.verdict} | Claim: {m.claim_reviewed} | URL: {m.url}"
            for m in fact_checks.matches[:5]
        )

    covering_names = [o.outlet for o in coverage.covering]
    bias = coverage.bias_spread
    coverage_score = float(decision_context.get("coverage_score", 0.0))
    bias_balance = float(decision_context.get("bias_balance", 0.0))
    total_articles = int(decision_context.get("total_articles", 0))

    return f"""Generate a bilingual explanation for a pre-determined verdict.

CLAIM:
"{claim.core_claim}"

DETERMINED VERDICT:
- Rating: {rating}
- Confidence: {confidence:.2f}
- Sources: {', '.join(sources) or 'None'}

FACT-CHECK EVIDENCE:
{fc_text}

COVERAGE EVIDENCE:
- Outlets covering this story: {', '.join(covering_names) or 'None'}
- Bias spread: Left={bias.get('left', 0)}, Center={bias.get('center', 0)}, Right={bias.get('right', 0)}, State={bias.get('state', 0)}
- Estimated coverage strength: {coverage_score:.2f}
- Bias balance: {bias_balance:.2f}
- Article count: {total_articles}

INSTRUCTIONS:
1. Do not change the rating or confidence above.
2. Explain why this verdict was reached using the evidence provided.
3. Mention any uncertainty or coverage gaps.
4. Output only valid JSON, no markdown or extra text.
5. Provide both an English and a Filipino explanation.

Respond ONLY with this JSON:
{
  "explanation_en": "English explanation here.",
  "explanation_tl": "Paliwanag sa Filipino dito.",
  "reasoning_summary": "One sentence: the key reason for this verdict.",
  "trace_summary": "One sentence: summary of the analysis process.",
  "sources": ["url1", "url2"]
}"""
