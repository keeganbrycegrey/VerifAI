# fetches and parses philippine rss feeds
# returns flat list of articles, no limits im pretty sure

import httpx
import feedparser
from dataclasses import dataclass
from config import RSS_FEEDS


@dataclass
class RSSArticle:
    title: str
    url: str
    outlet: str
    summary: str
    published: str


async def fetch_all() -> list[RSSArticle]:
    articles = []
    for outlet, feed_url in RSS_FEEDS.items():
        try:
            articles.extend(await _fetch_feed(outlet, feed_url))
        except Exception as e:
            print(f"rss fetch error [{outlet}]: {e}")
    return articles


async def fetch_relevant(query: str) -> list[RSSArticle]:
    # keyword filter — at least 2 query words match
    all_articles = await fetch_all()
    query_words = set(query.lower().split())

    return [
        a for a in all_articles
        if sum(1 for w in query_words if len(w) > 3 and w in (a.title + " " + a.summary).lower()) >= 2
    ]


async def _fetch_feed(outlet: str, feed_url: str) -> list[RSSArticle]:
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as http:
        resp = await http.get(feed_url, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()

    feed = feedparser.parse(resp.text)

    return [
        RSSArticle(
            title=entry.get("title", ""),
            url=entry.get("link", ""),
            outlet=outlet,
            summary=entry.get("summary", "")[:300],
            published=entry.get("published", ""),
        )
        for entry in feed.entries[:20]
    ]