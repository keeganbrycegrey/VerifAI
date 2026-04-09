import httpx
from config import get_settings

settings = get_settings()


async def query_coverage(query: str, max_results: int = 20) -> list[dict]:
    params = {
        "query":      f"{query} (domain:.ph OR sourcelang:tgl)",
        "mode":       "artlist",
        "maxrecords": max_results,
        "format":     "json",
        "sort":       "datedesc",
    }

    try:
        async with httpx.AsyncClient(timeout=12) as http:
            resp = await http.get(settings.GDELT_BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"gdelt api error: {e}")
        return []

    return [
        {
            "url":      item.get("url", ""),
            "title":    item.get("title", ""),
            "domain":   item.get("domain", ""),
            "date":     item.get("seendate", ""),
            "language": item.get("language", ""),
        }
        for item in data.get("articles", [])
    ]