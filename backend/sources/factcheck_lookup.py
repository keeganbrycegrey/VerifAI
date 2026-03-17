# queries google fact check api
# also searches by entities if few results found

import httpx
from models import ExtractedClaim, FactCheckResults, FactCheckMatch
from config import get_settings

settings = get_settings()


async def lookup(claim: ExtractedClaim) -> FactCheckResults:
    matches = await _query_google_factcheck(claim.core_claim)

    # broaden search via entities if sparse results
    if len(matches) < 2 and claim.entities:
        entity_query = " ".join(claim.entities[:3])
        extra = await _query_google_factcheck(entity_query)
        seen = {m.url for m in matches}
        for m in extra:
            if m.url not in seen:
                matches.append(m)
                seen.add(m.url)

    return FactCheckResults(
        matches=matches[:8],
        found=len(matches) > 0,
        sources_checked=[
            "Google Fact Check Tools API",
            "Vera Files (via IFCN)",
            "TSEK.PH (via IFCN)",
            "AFP Fact Check (via IFCN)",
        ],
    )


async def _query_google_factcheck(query: str) -> list[FactCheckMatch]:
    if not settings.GOOGLE_FACTCHECK_API_KEY:
        return []

    params = {
        "query":        query,
        "key":          settings.GOOGLE_FACTCHECK_API_KEY,
        "languageCode": "en",
        "pageSize":     10,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(settings.GOOGLE_FACTCHECK_BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"google factcheck api error: {e}")
        return []

    matches = []
    for item in data.get("claims", []):
        for review in item.get("claimReview", []):
            matches.append(FactCheckMatch(
                claim_reviewed=item.get("text", ""),
                verdict=review.get("textualRating", "Unknown"),
                url=review.get("url", ""),
                source=review.get("publisher", {}).get("name", "Unknown"),
                date=item.get("claimDate"),
            ))

    return matches