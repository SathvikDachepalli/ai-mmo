"""Seed the Blackwood demo world: locations, NPCs, a starter item.

Idempotent: safe to run repeatedly. Creates the world if missing and only
adds locations/NPCs for worlds that lack them.
"""
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Item, Location, NPC, World
from app.db.session import session_factory

logger = logging.getLogger(__name__)

WORLD_SLUG = "blackwood"
WORLD_NAME = "Blackwood"

LOCATIONS = [
    {"slug": "village", "name": "Blackwood Village", "region": "Blackwood",
     "description": "A muddy crossroads town hugging the treeline.",
     "exits": {"tavern": "tavern", "market": "market", "forest_edge": "forest"}},
    {"slug": "tavern", "name": "The Machined Mare Tavern", "region": "Blackwood",
     "description": "Smoke-warm common room, creaking boards, watchful eyes.",
     "exits": {"door": "village"}},
    {"slug": "market", "name": "The Cobble Market", "region": "Blackwood",
     "description": "Stalls of dried fish, iron tools, and rumor.",
     "exits": {"square": "village"}},
    {"slug": "forest", "name": "Blackwood Forest", "region": "Blackwood",
     "description": "Dense pines and a path that soon vanishes into shadow.",
     "exits": {"trail": "village", "ridge": "cave"}},
    {"slug": "cave", "name": "Howling Cave Mouth", "region": "Blackwood",
     "description": "A black opening in the hillside, faintly exhaling.",
     "exits": {"mouth": "forest"}},
]

NPCS = [
    {"name": "Marek", "role": "Tavern Keeper", "location": "tavern",
     "personality": "Suspicious, sarcastic", "goal": "protect his business",
     "knowledge": {"rumors": ["the forest", "strangers"], "secret": "a loose floorboard in the cellar"}},
    {"name": "Fenn", "role": "Forest Track", "location": "forest",
     "personality": "Wary, terse, honest", "goal": "keep predators from the village",
     "knowledge": {"rumors": ["a wolf coyote at the ridge", "the cave stinks"], "secret": "who buries horses"}},
]


async def _seed(session: AsyncSession) -> World | None:
    world = (await session.execute(select(World).where(World.slug == WORLD_SLUG))).scalar_one_or_none()
    if world is None:
        world = World(slug=WORLD_SLUG, name=WORLD_NAME)
        session.add(world)
        await session.flush()
        logger.info("Created world %s", WORLD_SLUG)

    existing = {loc.slug for loc in (await session.execute(
        select(Location).where(Location.world_id == world.id)
    )).scalars()}

    for spec in LOCATIONS:
        if spec["slug"] in existing:
            continue
        loc = Location(
            world_id=world.id, slug=spec["slug"], name=spec["name"],
            region=spec["region"], description=spec["description"], exits=spec["exits"],
        )
        session.add(loc)
    await session.flush()

    # Map slug -> location id for NPC placement.
    locs = {l.slug: l for l in (await session.execute(
        select(Location).where(Location.world_id == world.id)
    )).scalars()}

    npc_existing = {n.name for n in (await session.execute(
        select(NPC).where(NPC.world_id == world.id)
    )).scalars()}
    for spec in NPCS:
        if spec["name"] in npc_existing:
            continue
        target = locs[spec["location"]]
        session.add(NPC(
            world_id=world.id, location_id=target.id, name=spec["name"],
            role=spec["role"], personality=spec["personality"],
            goals={"goal": spec["goal"]}, knowledge=spec["knowledge"],
        ))

    if not (await session.execute(select(Item).where(Item.world_id == world.id))).scalars().first():
        market = locs["market"]
        session.add(Item(
            world_id=world.id, location_id=market.id, name="Iron horseshoe",
            description="Bent and warm, thrown outside the forge.",
            kind="physical",
        ))

    await session.commit()
    return world


async def main() -> None:
    async with session_factory() as session:
        world = await _seed(session)
    logger.info("Seed complete: %s", world.slug if world else "no-op")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())