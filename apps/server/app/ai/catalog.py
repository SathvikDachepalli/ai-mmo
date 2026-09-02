"""OpenRouter model catalog, fetched live and cached in-process.

The picker used to be a hand-written list of five model ids. Three of the five
did not exist on OpenRouter at all, so selecting them produced a room whose AI
failed on the first request. The catalog is the source of truth now; nothing
here is hardcoded except the offline fallback.
"""
import asyncio
import logging
import time

import httpx

logger = logging.getLogger(__name__)

CATALOG_URL = "https://openrouter.ai/api/v1/models"
CACHE_TTL_SECONDS = 30 * 60
FETCH_TIMEOUT_SECONDS = 10.0

# Used only when OpenRouter is unreachable and nothing is cached yet, so the
# picker is never empty. Every id here was verified against the live catalog.
FALLBACK_MODELS: list[dict] = [
    {"id": "deepseek/deepseek-chat", "name": "DeepSeek: DeepSeek V3", "context_length": 0,
     "prompt_price": None, "completion_price": None, "is_free": False},
    {"id": "google/gemini-2.5-flash", "name": "Google: Gemini 2.5 Flash", "context_length": 0,
     "prompt_price": None, "completion_price": None, "is_free": False},
    {"id": "anthropic/claude-sonnet-4.5", "name": "Anthropic: Claude Sonnet 4.5", "context_length": 0,
     "prompt_price": None, "completion_price": None, "is_free": False},
    {"id": "openai/gpt-4o-mini", "name": "OpenAI: GPT-4o-mini", "context_length": 0,
     "prompt_price": None, "completion_price": None, "is_free": False},
]

_cache: list[dict] | None = None
_cached_at: float = 0.0
_stale: bool = False
_lock = asyncio.Lock()


def _price(raw: dict, key: str) -> float | None:
    try:
        return float(raw.get(key))
    except (TypeError, ValueError):
        return None


def _slim(model: dict) -> dict:
    """Keep only what the picker renders. The raw catalog is ~421 entries with
    long descriptions; sending all of it to the browser is pointless."""
    pricing = model.get("pricing") or {}
    prompt_price = _price(pricing, "prompt")
    return {
        "id": model.get("id", ""),
        "name": model.get("name") or model.get("id", ""),
        "context_length": model.get("context_length") or 0,
        "prompt_price": prompt_price,
        "completion_price": _price(pricing, "completion"),
        # OpenRouter marks free tiers with a ":free" suffix and zero prompt cost.
        "is_free": prompt_price == 0.0,
    }


async def _fetch() -> list[dict]:
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
        response = await client.get(CATALOG_URL)
        response.raise_for_status()
        data = response.json().get("data") or []

    models = [_slim(m) for m in data if m.get("id")]
    # Free tiers first, then alphabetical -- the free ones are what a host
    # experimenting with a room actually wants to find.
    models.sort(key=lambda m: (not m["is_free"], m["name"].lower()))
    return models


async def get_models(force: bool = False) -> tuple[list[dict], bool]:
    """Return (models, stale). `stale` means the list is a fallback or an
    expired cache we could not refresh, so the UI can say so."""
    global _cache, _cached_at, _stale

    fresh_enough = _cache is not None and (time.monotonic() - _cached_at) < CACHE_TTL_SECONDS
    if fresh_enough and not force:
        return _cache, _stale

    async with _lock:
        # Another request may have refreshed it while we waited for the lock.
        if _cache is not None and (time.monotonic() - _cached_at) < CACHE_TTL_SECONDS and not force:
            return _cache, _stale
        try:
            _cache = await _fetch()
            _cached_at = time.monotonic()
            _stale = False
            logger.info("Fetched %d models from OpenRouter.", len(_cache))
        except Exception as exc:
            logger.warning("Could not reach the OpenRouter catalog (%s).", exc)
            if _cache is None:
                _cache = list(FALLBACK_MODELS)
            _stale = True
        return _cache, _stale


async def is_known_model(model_id: str) -> bool:
    models, _ = await get_models()
    return any(m["id"] == model_id for m in models)
