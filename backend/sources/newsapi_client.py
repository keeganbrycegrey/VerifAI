import httpx
from config import get_settings

settings = get_settings()

PH_OUTLETS = [
    "rappler.com",
    "gmanetwork.com",
    "inquirer.net",
    "pna.gov.ph",
    "businessmirror.com.ph",
    "eaglenews.ph",
]

async def search_philippines(query: str, max_results: int = 20) -> list[dict]:
    if not settings.NEWSAPI_KEY:
        return []

    params = {
        "q":        query,
        "language": "en",
        "sortBy":   "relevancy",
        "pageSize": max_results,
        "apiKey":   settings.NEWSAPI_KEY,
        "domains":  ",".join(PH_OUTLETS),
    }

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(f"{settings.NEWSAPI_BASE_URL}/everything", params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"newsapi error: {e}")
        return []

    return [
        {
            "title":       item.get("title", ""),
            "url":         item.get("url", ""),
            "source":      item.get("source", {}).get("name", "Unknown"),
            "publishedAt": item.get("publishedAt", ""),
            "description": item.get("description", ""),
        }
        for item in data.get("articles", [])
    ]