"""Persistence for canonical game events and world sequence counter."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import GameEvent
from app.db.models import GameEvent as GameEventRow


async def persist_events(session: AsyncSession, world_id: UUID, events: list[GameEvent]) -> None:
    """Insert events after the engine assigned sequence numbers. Commit handled by caller."""
    for ev in events:
        assert ev.sequence_number is not None
        row = GameEventRow(
            world_id=world_id,
            sequence_number=ev.sequence_number,
            type=ev.type,
            actor_id=ev.actor_id,
            target_id=ev.target_id,
            visibility=ev.visibility,
            payload=ev.payload,
        )
        session.add(row)
        ev.id = row.id


async def latest_sequence(session: AsyncSession, world_id: UUID) -> int:
    row = (await session.execute(select(GameEventRow.sequence_number).where(
        GameEventRow.world_id == world_id
    ).order_by(GameEventRow.sequence_number.desc()).limit(1))).scalar_one_or_none()
    return row or 0


async def recent_events(
    session: AsyncSession, world_id: UUID, limit: int = 20
) -> list[GameEventRow]:
    result = await session.execute(
        select(GameEventRow)
        .where(GameEventRow.world_id == world_id)
        .order_by(GameEventRow.sequence_number.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return list(reversed(rows))