"""Provider selection from settings. OpenAI-compatible default, deterministic fallback."""
import logging

from app.ai.providers.base import ChatProvider, OpenAIBasedProvider
from app.ai.providers.deterministic import DeterministicProvider
from app.config import get_settings

logger = logging.getLogger(__name__)


def build_provider() -> ChatProvider:
    settings = get_settings()
    if settings.ai_provider.lower() == "deterministic":
        logger.info("Using deterministic provider (no API key).")
        return DeterministicProvider()

    presets = {
        # name -> default base URL when AI_BASE_URL is unset
        "openai": "https://api.openai.com/v1",
        "deepseek": "https://api.deepseek.com/v1",
        "openrouter": "https://openrouter.ai/api/v1",
        "ollama": "http://localhost:11434/v1",
    }
    key = settings.ai_provider.lower()
    if key in presets:
        if not settings.ai_api_key and key != "ollama":
            logger.warning("AI_PROVIDER=%s needs an API key; falling back to deterministic.", key)
            return DeterministicProvider()
        provider_cls = OpenAIBasedProvider
        if key == "openrouter":
            class _OpenRouter(OpenAIBasedProvider):
                EXTRA_HEADERS = {
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "ai-mmo",
                }
            provider_cls = _OpenRouter
        return provider_cls(
            model=settings.ai_model,
            api_key=settings.ai_api_key,
            base_url=settings.ai_base_url or presets[key],
            name=key,
        )
    raise ValueError(f"Unknown AI_PROVIDER: {settings.ai_provider}")


provider: ChatProvider | None = None


def get_provider() -> ChatProvider:
    global provider
    if provider is None:
        provider = build_provider()
    return provider


def rebuild_provider(model: str) -> ChatProvider:
    """Swap the live model at runtime (model picker). Thread-safe enough for
    single-process asyncio: reference assignment is atomic."""
    global provider
    settings = get_settings()
    settings.ai_model = model  # keep env-derived settings coherent
    provider = build_provider()
    logger.info("AI provider switched to %s", provider.name)
    return provider