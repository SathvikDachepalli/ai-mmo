"""Load canonical WorldState snapshot from the DB for the engine."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Character, Inventory, Item, Location, NPC, World
from app.game_engine.state_snapshot import (
    CharacterState,
    ItemState,
    LocationState,
    NPCState,
    WorldState,
)


async def load_world(session: AsyncSession, world_id: UUID) -> WorldState:
    st = WorldState(world_id=world_id)

    world = await session.get(World, world_id)
    if world is None:
        raise ValueError(f"World {world_id} not found")

    st.global_state = dict(world.state or {})

    locations = (await session.execute(
        select(Location).where(Location.world_id == world_id)
    )).scalars().all()
    for loc in locations:
        st.locations[loc.slug] = LocationState(
            id=loc.id, slug=loc.slug, name=loc.name, region=loc.region,
            exits=dict(loc.exits or {}),
        )

    characters = (await session.execute(
        select(Character).where(Character.world_id == world_id)
    )).scalars().all()
    for c in characters:
        st.characters[str(c.id)] = CharacterState(id=c.id, name=c.name, location_id=c.location_id)

    npcs = (await session.execute(
        select(NPC).where(NPC.world_id == world_id)
    )).scalars().all()
    for n in npcs:
        st.npcs[str(n.id)] = NPCState(id=n.id, name=n.name, location_id=n.location_id)

    items = (await session.execute(
        select(Item).where(Item.world_id == world_id)
    )).scalars().all()
    for it in items:
        st.items[str(it.id)] = ItemState(id=it.id, name=it.name, location_id=it.location_id)

    inv = (await session.execute(
        select(Inventory).join(Character, Character.id == Inventory.character_id)
        .where(Character.world_id == world_id)
    )).scalars().all()
    for row in inv:
        st.inventories.setdefault(str(row.character_id), set()).add(str(row.item_id))

    for c in st.characters.values():
        st.inventories.setdefault(str(c.id), set())

    return st