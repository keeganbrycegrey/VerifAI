# shared pydantic data contracts
# ule, wag gagalawin, chat ako if may tanong dito 

from pydantic import BaseModel
from typing import Optional
 
 
# ── input ──────────────────────────────────────────────────────────────────────
 
class CheckRequest(BaseModel):
    input_type: str            # "text" | "image_base64" | "url"
    content: str               # raw text, base64, or url
    source_surface: str        # "extension" | "messenger" | "dashboard"
    language_hint: str = "auto"  # "tl" | "en" | "auto"
 
 
# ── pipeline intermediates ─────────────────────────────────────────────────────
 
class PreprocessedInput(BaseModel):
    text: str
    language: str              # "tl" | "en" | "mixed"
    source_url: Optional[str] = None
 
 
class ExtractedClaim(BaseModel):
    core_claim: str
    entities: list[str]
    language: str
    original_text: str
 
 
class FactCheckMatch(BaseModel):
    claim_reviewed: str
    verdict: str
    url: str
    source: str
    date: Optional[str] = None
 
 
class FactCheckResults(BaseModel):
    matches: list[FactCheckMatch]
    found: bool
    sources_checked: list[str]
    high_confidence: bool = False  # true if strong direct match found
 
 
class OutletCoverage(BaseModel):
    outlet: str
    bias: str                  # "left" | "center" | "right" | "state" | "aggregator"
    article_count: int
    sample_url: Optional[str] = None
 
 
class CoverageReport(BaseModel):
    covering: list[OutletCoverage]
    not_covering: list[str]
    bias_spread: dict
    total_articles_found: int
 
 
# ── verdict trace ──────────────────────────────────────────────────────────────
 
class VerdictStep(BaseModel):
    step: str      # "Fact Check Lookup" | "Coverage Analysis" | "AI Reasoning"
    finding: str   # what was found in this step
    weight: str    # "high" | "medium" | "low"
    icon: str      # emoji for display
 
 
class VerdictTrace(BaseModel):
    steps: list[VerdictStep]
    summary: str   # one-line human-readable summary
 
 
# ── source credibility ─────────────────────────────────────────────────────────
 
class SourceCredibility(BaseModel):
    outlet: str
    score: float               # 0.0 – 1.0
    classification: str        # "highly_reliable" | "generally_reliable" |
                               # "needs_context" | "state_media" | "unreliable"
    explanation: str
    bias: str
 
 
# ── output ─────────────────────────────────────────────────────────────────────
 
class Verdict(BaseModel):
    claim: str
    rating: str                # "true"|"false"|"misleading"|"unverified"|"needs_context"
    confidence: float          # 0.0 – 1.0
    explanation_en: str
    explanation_tl: str
    sources: list[str]
    fact_checks_found: list[FactCheckMatch]
    coverage: CoverageReport
    trace: Optional[VerdictTrace] = None
    source_credibility: list[SourceCredibility] = []
    input_type: str
    source_surface: str
    timestamp: str
 
 
# ── bot types ──────────────────────────────────────────────────────────────────
 
class MessengerMessage(BaseModel):
    sender_id: str
    message_type: str
    content: str
    timestamp: Optional[str] = None
 
 
# ── dashboard types ────────────────────────────────────────────────────────────
 
class VerdictSummary(BaseModel):
    claim: str
    rating: str
    confidence: float
    timestamp: str
    source_surface: str
 
 
class TrendingClaim(BaseModel):
    claim: str
    check_count: int
    dominant_rating: str
    first_seen: str
    last_seen: str
 
 
class DashboardFeed(BaseModel):
    recent_verdicts: list[VerdictSummary]
    trending: list[TrendingClaim]
    total_checks_today: int
    total_checks_all_time: int
