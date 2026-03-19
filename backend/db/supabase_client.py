# supabase db operations
# non-fatal errors — pipeline continues if db is down
# add cache, - run through supabas

from collections import defaultdict, Counter
from datetime import datetime, timezone
from supabase import create_client, Client
from models import Verdict, VerdictSummary, TrendingClaim, FactCheckMatch, CoverageReport
from config import get_settings

settings = get_settings()

# lazy init — avoids crash if credentials not yet set
_supabase: Client | None = None


def _get_client() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
            raise RuntimeError("supabase credentials not set in .env")
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _supabase


async def save_verdict(verdict: Verdict) -> None:
    try:
        _get_client().table("verdicts").insert({
            "claim":          verdict.claim,
            "rating":         verdict.rating,
            "confidence":     verdict.confidence,
            "explanation_en": verdict.explanation_en,
            "explanation_tl": verdict.explanation_tl,
            "sources":        verdict.sources,
            "input_type":     verdict.input_type,
            "source_surface": verdict.source_surface,
            "timestamp":      verdict.timestamp,
            "coverage":       verdict.coverage.model_dump(),
            "fact_checks":    [fc.model_dump() for fc in verdict.fact_checks_found],
        }).execute()
    except Exception as e:
        print(f"supabase save error: {e}")


async def get_recent_verdicts(limit: int = 20) -> list[VerdictSummary]:
    try:
        res = (
            _get_client().table("verdicts")
            .select("claim, rating, confidence, timestamp, source_surface")
            .order("timestamp", desc=True)
            .limit(limit)
            .execute()
        )
        return [VerdictSummary(**row) for row in res.data]
    except Exception as e:
        print(f"supabase fetch error: {e}")
        return []


async def get_trending_claims(limit: int = 10) -> list[TrendingClaim]:
    try:
        res = (
            _get_client().table("verdicts")
            .select("claim, rating, timestamp")
            .order("timestamp", desc=True)
            .limit(200)
            .execute()
        )

        claim_counts: dict = defaultdict(lambda: {"count": 0, "ratings": [], "timestamps": []})
        for row in res.data:
            claim_counts[row["claim"]]["count"] += 1
            claim_counts[row["claim"]]["ratings"].append(row["rating"])
            claim_counts[row["claim"]]["timestamps"].append(row["timestamp"])

        trending = []
        for claim_text, data in sorted(claim_counts.items(), key=lambda x: -x[1]["count"])[:limit]:
            dominant = Counter(data["ratings"]).most_common(1)[0][0]
            trending.append(TrendingClaim(
                claim=claim_text,
                check_count=data["count"],
                dominant_rating=dominant,
                first_seen=min(data["timestamps"]),
                last_seen=max(data["timestamps"]),
            ))
        return trending
    except Exception as e:
        print(f"supabase trending error: {e}")
        return []


async def get_verdict_counts() -> dict:
    try:
        db = _get_client()
        today = datetime.now(timezone.utc).date().isoformat()
        all_time  = db.table("verdicts").select("*", count="exact").execute()
        today_res = db.table("verdicts").select("*", count="exact").gte("timestamp", today).execute()
        return {"all_time": all_time.count or 0, "today": today_res.count or 0}
    except Exception as e:
        print(f"supabase count error: {e}")
        return {"all_time": 0, "today": 0}


async def get_coverage_heatmap() -> dict:
    try:
        res = (
            _get_client().table("verdicts")
            .select("coverage")
            .order("timestamp", desc=True)
            .limit(100)
            .execute()
        )

        outlet_counts: dict = defaultdict(int)
        for row in res.data:
            for outlet in row.get("coverage", {}).get("covering", []):
                outlet_counts[outlet.get("outlet", "")] += 1

        return {"outlet_frequency": dict(outlet_counts)}
    except Exception as e:
        print(f"supabase heatmap error: {e}")
        return {"outlet_frequency": {}}

async def get_cached_verdict(claim_text: str) -> Verdict | None:
    # normalize claim for matching
    try:
        res = (
            _get_client().table("verdicts")
            .select("*")
            .ilike("claim", claim_text.strip())
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            row = res.data[0]
            return Verdict(
                claim=row["claim"],
                rating=row["rating"],
                confidence=row["confidence"],
                explanation_en=row["explanation_en"],
                explanation_tl=row["explanation_tl"],
                sources=row["sources"],
                fact_checks_found=[FactCheckMatch(**fc) for fc in row["fact_checks"]],
                coverage=CoverageReport(**row["coverage"]),
                input_type=row["input_type"],
                source_surface=row["source_surface"],
                timestamp=row["timestamp"],
            )
        return None
    except Exception as e:
        print(f"cache lookup error: {e}")
        return None