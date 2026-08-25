"""World state snapshot passed through the pure action pipeline.

Reducers return a new snapshot rather than mutating directly; the applied
result is written back to the DB by the engine driver.
"""
from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class LocationState:
    id: UUID
    slug: str
    name: str
    region: str
    exits: dict[str, str] = field(default_factory=dict)  # exit_slug -> target location slug


@dataclass
class CharacterState:
    id: UUID
    name: str
    location_id: UUID


@dataclass
class NPCState:
    id: UUID
    name: str
    location_id: UUID


@dataclass
class ItemState:
    id: UUID
    name: str
    location_id: UUID | None  # None == held by someone; see inventory elsewhere


@dataclass
class WorldState:
    """In-memory representation of everything the engine needs to validate/shape actions."""

    world_id: UUID
    # slug -> LocationState
    locations: dict[str, LocationState] = field(default_factory=dict)
    # character_id -> CharacterState
    characters: dict[str, CharacterState] = field(default_factory=dict)
    # npc_id -> NPCState
    npcs: dict[str, NPCState] = field(default_factory=dict)
    # item_id -> ItemState
    items: dict[str, ItemState] = field(default_factory=dict)
    # character_id -> set of item ids they carry
    inventories: dict[str, set[str]] = field(default_factory=dict)
    # shared world metadata (e.g. weather, global flags)
    global_state: dict = field(default_factory=dict)