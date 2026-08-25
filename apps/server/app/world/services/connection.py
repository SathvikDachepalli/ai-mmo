"""Connection-time user/character resolution, presence, and context loading."""
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Character,
    GameEvent,
    Inventory,
    Item,
    Location,
    NPC,
    User,
    World,
    WorldMember,
)
from app.db.session import session_factory

_REGIONS = {"village": "Blackwood", "tavern": "Blackwood", "market": "Blackwood",
            "forest": "Blackwood", "cave": "Blackwood"}


def region_of_slug(slug: str | None) -> str | None:
    return _REGIONS.get(slug) if slug else None


async def resolve_connection(world_slug: str, account) -> dict[str, Any]:
    """Ensure the authenticated account has membership + a character in the world.

    Idempotent: same account + same world always resolves to the same character.
    """
    async with session_factory() as session:
        world = (await session.execute(select(World).where(World.slug == world_slug))).scalar_one_or_none()
        if world is None:
            raise ValueError(f"Unknown world slug '{world_slug}'")

        user = account

        member = (await session.execute(
            select(WorldMember).where(WorldMember.world_id == world.id, WorldMember.user_id == user.id)
        )).scalar_one_or_none()
        if member is None:
            session.add(WorldMember(world_id=world.id, user_id=user.id, role="player"))

        character = (await session.execute(
            select(Character).where(Character.world_id == world.id, Character.user_id == user.id)
        )).scalar_one_or_none()
        if character is None:
            start = (await session.execute(
                select(Location).where(Location.world_id == world.id, Location.slug == "village")
            )).scalar_one()
            character = Character(
                user_id=user.id,
                world_id=world.id,
                name=account.display_name or account.email.split("@")[0],
                location_id=start.id,
            )
            session.add(character)
            await session.flush()

        await session.commit()

    loc = (await session.execute(
        select(Location).where(Location.id == character.location_id)
    )).scalar_one()
    return {
        "world_id": world.id,
        "user_id": user.id,
        "character_id": character.id,
        "character_name": character.name,
        "location_id": character.location_id,
        "location_id": character.location_id,
        "location": loc.slug,
        "region": loc.region,
    }


async def mark_online(character_id, online: bool) -> None:
    async with session_factory() as session:
        character = await session.get(Character, character_id)
        if character:
            character.is_online = online
            await session.commit()


async def get_character_state(session: AsyncSession, character_id):
    from app.game_engine.state_snapshot import CharacterState
    c = await session.get(Character, character_id)
    return CharacterState(id=c.id, name=c.name, location_id=c.location_id)


async def location_slug_of(session: AsyncSession, world_id, location_id) -> str:
    loc = await session.get(Location, location_id)
    return loc.slug if loc else "?"


async def all_location_slugs(session: AsyncSession, world_id) -> list[str]:
    rows = (await session.execute(select(Location).where(Location.world_id == world_id))).scalars().all()
    return [r.slug for r in rows]


async def room_npcs(session: AsyncSession, world_id, location_id) -> list[dict]:
    rows = (await session.execute(
        select(NPC).where(NPC.world_id == world_id, NPC.location_id == location_id)
    )).scalars().all()
    return [{"id": r.id, "name": r.name, "role": r.role} for r in rows]


async def room_items(session: AsyncSession, world_id, location_id, character_id) -> list[dict]:
    """Items visible on the ground here plus items the character is carrying."""
    ground = (await session.execute(
        select(Item).where(Item.world_id == world_id, Item.location_id == location_id)
    )).scalars().all()
    held = (await session.execute(
        select(Item).join(Inventory, Inventory.item_id == Item.id)
        .where(Inventory.character_id == character_id)
    )).scalars().all()
    return (
        [{"id": r.id, "name": r.name, "held": False} for r in ground]
        + [{"id": r.id, "name": r.name, "held": True} for r in held]
    )


async def brief_recent(session: AsyncSession, world_id, limit: int = 5) -> list[dict]:
    rows = (await session.execute(
        select(GameEvent).where(GameEvent.world_id == world_id)
        .order_by(GameEvent.sequence_number.desc()).limit(limit)
    )).scalars().all()
    return [{"sequence_number": r.sequence_number, "type": r.type, "payload": r.payload} for r in reversed(rows)]