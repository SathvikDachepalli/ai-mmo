"""Action schemas produced by the Intent Interpreter and consumed by the engine."""
from typing import Any, Literal

from pydantic import BaseModel, Field


ActionType = Literal[
    "MOVE", "SPEAK", "INSPECT", "PICK_UP", "DROP", "USE", "ATTACK", "GENERIC"
]


class ActionProposal(BaseModel):
    """Structured output from the AI intent interpreter."""

    kind: Literal["ACTION"] = "ACTION"
    action_type: ActionType
    target_entity_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    # Human-readable rationale, used for narration when no deterministic text exists.
    rationale: str | None = None

    # Convenience helpers for engine reducers.
    @property
    def target_location(self) -> str | None:
        return self.parameters.get("target_location")

    @property
    def text(self) -> str | None:
        return self.parameters.get("text")

    @property
    def item_id(self) -> str | None:
        return self.parameters.get("item_id") or self.target_entity_id


class MoveAction(BaseModel):
    target_location: str


class SpeakAction(BaseModel):
    text: str
    target_entity_id: str | None = None


class InspectAction(BaseModel):
    target_entity_id: str | None = None


class PickUpAction(BaseModel):
    item_id: str


class DropAction(BaseModel):
    item_id: str


class UseAction(BaseModel):
    item_id: str


class AttackAction(BaseModel):
    target_entity_id: str


class GenericAction(BaseModel):
    text: str