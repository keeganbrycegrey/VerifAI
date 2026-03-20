# generates bilingual verdict from all evidence
# reasons over fact-checks + coverage data,
# wag ito i-ooverwrite sa pipeline.py, dapat separate file siya since medyo complex na logic niya

import json
from datetime import datetime, timezone
from pathlib import Path
from groq import AsyncGroq
from models import (
    ExtractedClaim, FactCheckResults, CoverageReport, Verdict,
    VerdictTrace, VerdictStep, SourceCredibility,
)
from config import get_settings

settings = get_settings()

VALID_RATINGS = {"true", "false", "misleading", "unverified", "needs_context"}

# load registry once at import
_REGISTRY_PATH = Path(__file__).parent.parent / "data" / "bias_registry.json"
with open(_REGISTRY_PATH) as f:
    _REGISTRY: dict = json.load(f)["outlets"]

# lazy init
_client: AsyncGroq | None = None

def _groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


async def generate_verdict(
    claim: ExtractedClaim,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
    input_type: str,
    source_surface: str,
) -> Verdict:

    prompt = _build_verdict_prompt(claim, fact_checks, coverage)

    response = await _groq().chat.completions.create(
        model=settings.GROQ_TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Ikaw ay isang dalubhasang fact-checker ng mga balita at impormasyon sa Pilipinas. "
                    "Sinusuri mo ang mga claim gamit ang mga ebidensya at nagbibigay ng malinaw na hatol. "
                    "Lagi kang sumasagot ng valid JSON lamang — walang markdown, walang paliwanag sa labas ng JSON."
                    "\n\n"
                    "You are an expert fact-checker for Philippine news and information. "
                    "You analyze claims using evidence and give clear verdicts. "
                    "Always respond with valid JSON only."
                )
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=1500,
        temperature=0.2,
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
        return _fallback_verdict(claim, fact_checks, coverage, input_type, source_surface)

    rating = parsed.get("rating", "unverified").lower().replace(" ", "_")
    if rating not in VALID_RATINGS:
        rating = "unverified"

    confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.5))))

    return Verdict(
        claim=claim.core_claim,
        rating=rating,
        confidence=confidence,
        explanation_en=parsed.get("explanation_en", ""),
        explanation_tl=parsed.get("explanation_tl", ""),
        sources=parsed.get("sources", []),
        fact_checks_found=fact_checks.matches,
        coverage=coverage,
        trace=_build_trace(parsed, fact_checks, coverage),
        source_credibility=_build_source_credibility(coverage),
        input_type=input_type,
        source_surface=source_surface,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def _build_trace(
    parsed: dict,
    fact_checks: FactCheckResults,
    coverage: CoverageReport,
) -> VerdictTrace:
    steps = []

    # step 1 — fact check lookup
    if fact_checks.found:
        fc_sources = list({m.source for m in fact_checks.matches[:3]})
        steps.append(VerdictStep(
            step="Fact Check Lookup",
            finding=f"Found {len(fact_checks.matches)} existing fact-check(s) from {', '.join(fc_sources)}",
            weight="high",
            icon="🔍",
        ))
    else:
        steps.append(VerdictStep(
            step="Fact Check Lookup",
            finding="No existing fact-checks found in IFCN-certified sources",
            weight="medium",
            icon="🔍",
        ))

    # step 2 — coverage analysis
    covering_count = len(coverage.covering)
    bias = coverage.bias_spread
    if covering_count > 0:
        spread = [f"{v} {k}" for k, v in bias.items() if v > 0]
        steps.append(VerdictStep(
            step="Coverage Analysis",
            finding=f"{covering_count} outlet(s) found — bias spread: {', '.join(spread) or 'none detected'}",
            weight="medium",
            icon="📰",
        ))
    else:
        steps.append(VerdictStep(
            step="Coverage Analysis",
            finding="No Philippine news outlets found covering this story",
            weight="low",
            icon="📰",
        ))

    # step 3 — AI reasoning
    ai_finding = parsed.get("reasoning_summary", "") or (parsed.get("explanation_en", "") or "")[:120]
    steps.append(VerdictStep(
        step="AI Reasoning",
        finding=ai_finding or "Verdict derived from available evidence",
        weight="high",
        icon="🤖",
    ))

    summary = parsed.get(
        "trace_summary",
        f"Verdict reached based on {len(fact_checks.matches)} fact-check(s) and {covering_count} outlet(s)."
    )

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
                weight="high",
                icon="🤖",
            )],
            summary="Analysis incomplete. Please try again.",
        ),
        source_credibility=_build_source_credibility(coverage),
        input_type=input_type,
        source_surface=source_surface,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


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

    return f"""Evaluate the following claim and return a fact-check verdict.

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
1. Weigh the existing fact-checks heavily — they are from verified IFCN fact-checkers
2. Consider the coverage spread — if only one political side covers a story, flag this
3. Assign one rating: "true" | "false" | "misleading" | "unverified" | "needs_context"
4. Assign a confidence score 0.0–1.0 (higher if backed by direct fact-checks)
5. Write explanation_en in clear English (2-3 sentences)
6. Write explanation_tl in natural Filipino/Tagalog (2-3 sentences), conversational tone
7. Write reasoning_summary: one sentence — the KEY reason for your verdict
8. Write trace_summary: one sentence — summarizing the overall analysis process
9. List source URLs used

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