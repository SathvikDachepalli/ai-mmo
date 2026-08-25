"""Canonical event shaping for outbound broadcasts (independent of the DB row model)."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID


class Visibility:
    PUBLIC = "PUBLIC"
    REGION = "REGION"
    LOCATION = "LOCATION"
    PARTY = "PARTY"
    PRIVATE = "PRIVATE"

    ALL = (PUBLIC, REGION, LOCATION, PARTY, PRIVATE)


@dataclass
class GameEvent:
    """Canonical world event as produced by the game engine.

    Sequence number is assigned by the engine immediately before persist + broadcast.
    """

    world_id: UUID
    type: str
    actor_id: UUID | None = None
    target_id: UUID | None = None
    visibility: str = Visibility.LOCATION
    payload: dict[str, Any] = field(default_factory=dict)
    sequence_number: int | None = None
    id: UUID | None = None
    created_at: datetime | None = None

    def public(self) -> dict[str, Any]:
        """Wire representation sent to clients."""
        return {
            "id": str(self.id),
            "world_id": str(self.world_id),
            "sequence_number": self.sequence_number,
            "type": self.type,
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "target_id": str(self.target_id) if self.target_id else None,
            "visibility": self.visibility,
            "payload": self.payload,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }