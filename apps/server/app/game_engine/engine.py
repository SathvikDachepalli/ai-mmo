"""Game Engine driver.

Owns the invariant: the engine is the only component that mutates canonical
state. AI proposes actions; the engine validates, applies, assigns canonical
sequence numbers, and persists both the mutations and the resulting events in
a single transaction.

Concurrency: per-world processing is serialized by an asyncio lock (modular
monolith, single process). Designed so it can later move to distributed
event-processing over Redis/ARQ without changing the caller API.
"""
import asyncio
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Character, Inventory, Item, World
from app.events.models import GameEvent
from app.events.store import persist_events
from app.game_engine.actions.schemas import ActionProposal
from app.game_engine.actions.validators import (
    ActionOutcome,
    ActionValidationError,
    validate_and_apply,
)
from app.world.state.loader import load_world

logger = logging.getLogger(__name__)

__all__ = [
    "ActionValidationError",
    "GameEvent",
    "process_action",
    "world_locks",
]


class _UnknownActor(Exception):
    pass


class _Unknown(Exception):
    pass


class WorldQueue:
    """Per-world asyncio lock to serialize action processing in this process."""

    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}

    def get(self, world_id: UUID) -> asyncio.Lock:
        key = str(world_id)
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]


world_locks = WorldQueue()


async def process_action(
    session: AsyncSession, world_id: UUID, actor_id: UUID, proposal: ActionProposal
) -> list[GameEvent]:
    """Validate + apply one action. Returns canonical events.

    Raises ActionValidationError for rejects and _UnknownActor when the actor
    does not belong to the world.
    """
    async with world_locks.get(world_id):
        state = await load_world(session, world_id)
        actor = state.characters.get(str(actor_id))
        if actor is None:
            raise _UnknownActor(f"Actor {actor_id} is not in world {world_id}.")

        outcome = validate_and_apply(state, actor, proposal)
        if not outcome.events:
            raise ActionValidationError("That action produced no effect.")

        events = outcome.events
        await _apply_events(session, world_id, events, outcome)
        await session.commit()
        return events


async def _apply_events(
    session: AsyncSession, world_id: UUID, events: list[GameEvent],
    outcome: ActionOutcome,
) -> None:
    world = await session.get(World, world_id)
    if world is None:
        raise _Unknown(f"World {world_id} gone.")
    base = world.sequence
    for i, ev in enumerate(events, start=1):
        ev.sequence_number = base + i
    world.sequence = base + len(events)

    if outcome.updated_characters:
        char_ids = list(outcome.updated_characters)
        rows = (await session.execute(
            select(Character).where(Character.id.in_(char_ids))
        )).scalars().all()
        for row in rows:
            updated = outcome.updated_characters.get(str(row.id))
            if updated:
                row.location_id = updated.location_id

    if outcome.updated_items:
        item_ids = list(outcome.updated_items)
        rows = (await session.execute(
            select(Item).where(Item.id.in_(item_ids))
        )).scalars().all()
        for row in rows:
            updated = outcome.updated_items.get(str(row.id))
            if updated:
                row.location_id = updated.location_id

    for op, character_id, item_id in outcome.inventory_ops:
        existing = (await session.execute(
            select(Inventory).where(
                Inventory.character_id == character_id, Inventory.item_id == item_id
            )
        )).scalar_one_or_none()
        if op == "add":
            if existing:
                existing.quantity += 1
            else:
                session.add(Inventory(character_id=character_id, item_id=item_id))
        elif op == "remove" and existing:
            if existing.quantity > 1:
                existing.quantity -= 1
            else:
                await session.delete(existing)

    await persist_events(session, world_id, events)


# Re-export for stable import path used by callers.
GameAction = process_action