"""Structured schemas for AI layers (intent, narration)."""
from typing import Any, Literal

from pydantic import BaseModel, Field


class IntentResult(BaseModel):
    """What the intent interpreter returns. Shape mirrors ActionProposal."""

    kind: Literal["ACTION"] = "ACTION"
    action_type: str
    target_entity_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    rationale: str | None = None


class NarrationRequest(BaseModel):
    events: list[dict[str, Any]]
    context: dict[str, Any] = Field(default_factory=dict)


class NarrationResult(BaseModel):
    text: str