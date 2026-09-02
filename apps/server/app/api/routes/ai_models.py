"""Model picker API: list OpenRouter's live catalog and switch at runtime.

Admin-only — switching the model affects every room on the shared server.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.ai import catalog
from app.ai.providers.factory import get_provider, rebuild_provider
from app.api.auth.users import current_admin_user
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/models")
async def list_models(refresh: bool = False, _: object = Depends(current_admin_user)) -> dict:
    settings = get_settings()
    provider_name = get_provider().name
    models, stale = await catalog.get_models(force=refresh)
    return {
        "current_model": settings.ai_model,
        "provider": provider_name,
        "live": not provider_name.startswith("deterministic"),
        # True when the catalog could not be refreshed, so the UI can say the
        # list may be out of date rather than silently showing a fallback.
        "stale": stale,
        "models": models,
    }


@router.post("/models/select")
async def select_model(body: dict, _: object = Depends(current_admin_user)) -> dict:
    model_id = (body.get("model_id") or "").strip()
    if not model_id:
        raise HTTPException(status_code=400, detail="A model id is required")
    if not await catalog.is_known_model(model_id):
        raise HTTPException(status_code=400, detail=f"'{model_id}' is not in the OpenRouter catalog")

    provider = rebuild_provider(model_id)
    return {"ok": True, "current_model": model_id, "provider": provider.name}
