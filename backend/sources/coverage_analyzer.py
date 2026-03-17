# maps article sources to known ph outlets
# returns bias spread and blind spot report

import asyncio
import json
from pathlib import Path
from models import ExtractedClaim, CoverageReport, OutletCoverage
from sources.gdelt_client import query_coverage
from sources.newsapi_client import search_philippines
from sources.rss_fetcher import fetch_relevant

# load bias registry once at import — pathlib avoids __file__ fragility
_REGISTRY_PATH = Path(__file__).parent.parent / "data" / "bias_registry.json"
with open(_REGISTRY_PATH) as f:
    _BIAS_REGISTRY: dict = json.load(f)["outlets"]

_DOMAIN_TO_OUTLET = {v["domain"]: k for k, v in _BIAS_REGISTRY.items()}
_ALL_OUTLET_NAMES  = set(_BIAS_REGISTRY.keys())


async def analyze_coverage(claim: ExtractedClaim) -> CoverageReport:
    # fetch all three sources concurrently
    gdelt_articles, newsapi_articles, rss_articles = await asyncio.gather(
        query_coverage(claim.core_claim),
        search_philippines(claim.core_claim),
        fetch_relevant(claim.core_claim),
    )

    covering_map: dict[str, OutletCoverage] = {}

    def _register(domain_or_outlet: str, url: str) -> None:
        # direct name match first, then domain lookup, then partial
        outlet_name = None
        if domain_or_outlet in _BIAS_REGISTRY:
            outlet_name = domain_or_outlet
        else:
            outlet_name = _DOMAIN_TO_OUTLET.get(domain_or_outlet)
        if not outlet_name:
            for domain, name in _DOMAIN_TO_OUTLET.items():
                if domain in domain_or_outlet:
                    outlet_name = name
                    break

        if not outlet_name:
            return

        if outlet_name not in covering_map:
            covering_map[outlet_name] = OutletCoverage(
                outlet=outlet_name,
                bias=_BIAS_REGISTRY[outlet_name]["bias"],
                article_count=1,
                sample_url=url,
            )
        else:
            covering_map[outlet_name].article_count += 1

    for a in gdelt_articles:
        _register(a.get("domain", ""), a.get("url", ""))

    for a in newsapi_articles:
        _register(a.get("source", ""), a.get("url", ""))

    for a in rss_articles:
        _register(a.outlet, a.url)

    covering = list(covering_map.values())
    not_covering = sorted(_ALL_OUTLET_NAMES - {o.outlet for o in covering})

    bias_spread = {"left": 0, "center": 0, "right": 0, "state": 0}
    for o in covering:
        if o.bias in bias_spread:
            bias_spread[o.bias] += 1

    return CoverageReport(
        covering=covering,
        not_covering=not_covering,
        bias_spread=bias_spread,
        total_articles_found=sum(o.article_count for o in covering),
    )