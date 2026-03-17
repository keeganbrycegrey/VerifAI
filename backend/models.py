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
    text: str                        # normalized plain text
    language: str                    # "tl" | "en" | "mixed"
    source_url: Optional[str] = None  # set if input was url


class ExtractedClaim(BaseModel):
    core_claim: str       # single verifiable assertion
    entities: list[str]   # people, places, orgs
    language: str         # "tl" | "en" | "mixed"
    original_text: str    # full preprocessed text


class FactCheckMatch(BaseModel):
    claim_reviewed: str
    verdict: str             # as given by fact-checker
    url: str
    source: str              # e.g. "Vera Files"
    date: Optional[str] = None


class FactCheckResults(BaseModel):
    matches: list[FactCheckMatch]
    found: bool              # true if at least one match
    sources_checked: list[str]


class OutletCoverage(BaseModel):
    outlet: str
    bias: str                # "left" | "center" | "right" | "state"
    article_count: int
    sample_url: Optional[str] = None


class CoverageReport(BaseModel):
    covering: list[OutletCoverage]
    not_covering: list[str]
    bias_spread: dict        # {"left": int, "center": int, "right": int, "state": int}
    total_articles_found: int


# ── output ─────────────────────────────────────────────────────────────────────

class Verdict(BaseModel):
    claim: str
    rating: str              # "true"|"false"|"misleading"|"unverified"|"needs_context"
    confidence: float        # 0.0 – 1.0
    explanation_en: str
    explanation_tl: str
    sources: list[str]
    fact_checks_found: list[FactCheckMatch]
    coverage: CoverageReport
    input_type: str
    source_surface: str
    timestamp: str


# ── bot types ──────────────────────────────────────────────────────────────────

class MessengerMessage(BaseModel):
    sender_id: str
    message_type: str        # "text" | "image" | "url"
    content: str
    timestamp: Optional[str] = None


# ── dashboard types ────────────────────────────────────────────────────────────

class VerdictSummary(BaseModel):
    # lightweight verdict for feed
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