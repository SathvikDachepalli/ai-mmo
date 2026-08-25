"""Web search for the chat-room AI, so it can answer current-events questions
instead of guessing from stale training data.

Uses Tavily (https://tavily.com) — an LLM-oriented search API with a free
tier. Entirely optional: with no TAVILY_API_KEY set, `search` returns an
empty list and the caller just skips the search step.
"""
import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

TAVILY_URL = "https://api.tavily.com/search"


def is_configured() -> bool:
    return bool(get_settings().tavily_api_key)


async def search(query: str, max_results: int = 4) -> list[dict]:
    """Return [{title, url, content}, ...], or [] if unconfigured/failed."""
    settings = get_settings()
    if not settings.tavily_api_key:
        return []

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                TAVILY_URL,
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                },
                timeout=15.0,
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        logger.exception("Tavily search failed for query %r", query)
        return []

    return [
        {
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "content": item.get("content", ""),
        }
        for item in data.get("results", [])
    ]


def format_results(results: list[dict]) -> str:
    lines = []
    for r in results:
        snippet = r["content"][:400].strip()
        lines.append(f"- {r['title']} — {snippet} (source: {r['url']})")
    return "\n".join(lines)
