# supabase db operations
# non-fatal errors — pipeline continues if db is down
# add cache, - run through supabas

from collections import defaultdict, Counter
from datetime import datetime, timezone
from supabase import create_client, Client
from models import Verdict, VerdictSummary, TrendingClaim, FactCheckMatch, CoverageReport, VerdictTrace, VerdictStep, SourceCredibility
from config import get_settings

settings = get_settings()

_supabase: Client | None = None


def _get_client() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
            raise RuntimeError("supabase credentials not set in .env")
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _supabase


async def save_verdict(verdict: Verdict) -> None:
    """Insert a new verdict or update the existing row for the same claim (upsert).    """
    try:
        db = _get_client()
        row = {
            "claim":              verdict.claim,
            "rating":             verdict.rating,
            "confidence":         verdict.confidence,
            "explanation_en":     verdict.explanation_en,
            "explanation_tl":     verdict.explanation_tl,
            "sources":            verdict.sources,
            "input_type":         verdict.input_type,
            "source_surface":     verdict.source_surface,
            "timestamp":          verdict.timestamp,
            "coverage":           verdict.coverage.model_dump(),
            "fact_checks":        [fc.model_dump() for fc in verdict.fact_checks_found],
            "trace":              verdict.trace.model_dump() if verdict.trace else None,
            "source_credibility": [sc.model_dump() for sc in verdict.source_credibility],
        }
        # Try native upsert (requires unique constraint on 'claim' in Supabase)
        db.table("verdicts").upsert(row, on_conflict="claim").execute()
    except Exception as e:
        print(f"supabase upsert error (falling back to insert): {e}")
        try:
            # Fallback: manual check-then-update so a failed upsert never silently drops data
            existing = (
                _get_client().table("verdicts")
                .select("id")
                .ilike("claim", verdict.claim.strip())
                .limit(1)
                .execute()
            )
            if existing.data:
                row_id = existing.data[0]["id"]
                _get_client().table("verdicts").update(row).eq("id", row_id).execute()
                print(f"supabase fallback: updated existing row id={row_id}")
            else:
                _get_client().table("verdicts").insert(row).execute()
        except Exception as e2:
            print(f"supabase save error: {e2}")


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
    try:
        res = (
            _get_client().table("verdicts")
            .select("*")
            .ilike("claim", claim_text.strip())
            .order("timestamp", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None

        row = res.data[0]

        # trace and source_credibility may not exist in older DB rows
        # Verdict model has Optional defaults so this is safe
        return Verdict(
            claim=row["claim"],
            rating=row["rating"],
            confidence=row["confidence"],
            explanation_en=row["explanation_en"],
            explanation_tl=row["explanation_tl"],
            sources=row["sources"] or [],
            fact_checks_found=[FactCheckMatch(**fc) for fc in (row.get("fact_checks") or [])],
            coverage=CoverageReport(**row["coverage"]),
            trace=_build_trace_from_row(row),
            source_credibility=_build_credibility_from_row(row),
            input_type=row["input_type"],
            source_surface=row["source_surface"],
            timestamp=row["timestamp"],
        )
    except Exception as e:
        print(f"cache lookup error: {e}")
        return None



def _build_trace_from_row(row: dict) -> "VerdictTrace | None":
    # rebuild trace from stored data if available, else build a minimal one
    stored = row.get("trace")
    if stored and stored.get("steps"):
        try:
            steps = [VerdictStep(**s) for s in stored["steps"]]
            return VerdictTrace(steps=steps, summary=stored.get("summary", ""))
        except Exception:
            pass
    # build minimal trace from what we have
    steps = []
    fact_checks = row.get("fact_checks") or []
    coverage = row.get("coverage") or {}
    if fact_checks:
        sources = list({fc.get("source","") for fc in fact_checks[:3]})
        steps.append(VerdictStep(
            step="Fact Check Lookup",
            finding=f"Found {len(fact_checks)} fact-check(s) from {', '.join(s for s in sources if s)}",
            weight="high", icon="🔍",
        ))
    else:
        steps.append(VerdictStep(
            step="Fact Check Lookup",
            finding="No existing fact-checks found in IFCN-certified sources",
            weight="medium", icon="🔍",
        ))
    covering = coverage.get("covering", [])
    if covering:
        steps.append(VerdictStep(
            step="Coverage Analysis",
            finding=f"{len(covering)} outlet(s) found covering this story",
            weight="medium", icon="📰",
        ))
    else:
        steps.append(VerdictStep(
            step="Coverage Analysis",
            finding="No Philippine news outlets found covering this story",
            weight="low", icon="📰",
        ))
    steps.append(VerdictStep(
        step="AI Reasoning",
        finding="Verdict derived from available evidence",
        weight="high", icon="🤖",
    ))
    return VerdictTrace(
        steps=steps,
        summary=f"Verdict reached from {len(fact_checks)} fact-check(s) and {len(covering)} outlet(s).",
    )


def _build_credibility_from_row(row: dict) -> list:
    stored = row.get("source_credibility")
    if stored:
        try:
            return [SourceCredibility(**sc) for sc in stored]
        except Exception:
            pass
    return []


async def get_daily_usage() -> dict:
    # check counts grouped by day of week (0=Sun, 6=Sat)
    try:
        res = (
            _get_client().table("verdicts")
            .select("timestamp")
            .order("timestamp", desc=True)
            .limit(500)
            .execute()
        )
        daily: dict = defaultdict(int)
        for row in res.data:
            dt  = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
            day = (dt.weekday() + 1) % 7   # python mon=0 → sun=0
            daily[str(day)] += 1
        return {"daily": dict(daily)}
    except Exception as e:
        print(f"supabase daily error: {e}")
        return {"daily": {}}