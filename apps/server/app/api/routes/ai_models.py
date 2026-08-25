"""Model picker API: list selectable models and switch at runtime.

JWT-protected so only signed-in players can change the shared world's brain.
"""
import logging

from fastapi import APIRouter, Depends

from app.ai.providers.factory import get_provider, rebuild_provider
from app.api.auth.users import current_active_user
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

# Curated OpenRouter catalog (free tiers first). Kept server-side so the
# client never needs to know provider details.
MODELS: list[dict] = [
    {"id": "deepseek/deepseek-chat-v3.1:free", "label": "DeepSeek V3.1 (free)"},
    {"id": "meta-llama/llama-3.3-70b-instruct:free", "label": "Llama 3.3 70B (free)"},
    {"id": "google/gemini-2.0-flash-exp:free", "label": "Gemini 2.0 Flash (free)"},
    {"id": "anthropic/claude-sonnet-4.5", "label": "Claude Sonnet 4.5"},
    {"id": "openai/gpt-4o-mini", "label": "GPT-4o mini"},
]


@router.get("/models")
async def list_models(_: object = Depends(current_active_user)) -> dict:
    settings = get_settings()
    current = get_provider().name
    return {
        "current_model": settings.ai_model,
        "provider": current,
        "live": not current.startswith("deterministic"),
        "models": MODELS,
    }


@router.post("/models/select")
async def select_model(body: dict, _: object = Depends(current_active_user)) -> dict:
    model_id = (body.get("model_id") or "").strip()
    if not any(m["id"] == model_id for m in MODELS):
        return {"ok": False, "error": f"Unknown model '{model_id}'"}
    p = rebuild_provider(model_id)
    return {"ok": True, "current_model": model_id, "provider": p.name}