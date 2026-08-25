"""Auto-close rooms that have gone quiet.

A room flips from active/waiting to closed once it has had zero online
members for GRACE_SECONDS straight. A reconnect within the grace window
cancels the pending close. The host can also close a room immediately.
Closed rooms keep their history (nothing is deleted) -- see the admin panel
for actual deletion.
"""
import asyncio
import logging

from sqlalchemy import select

from app.db.models import Room
from app.db.session import session_factory
from app.realtime import ai_room, events
from app.realtime.manager import get_manager
from app.realtime.rooms import room_channel

logger = logging.getLogger(__name__)

GRACE_SECONDS = 300.0

_sio = None
_close_tasks: dict[str, asyncio.Task] = {}


def configure(sio) -> None:
    global _sio
    _sio = sio


def cancel_pending_close(room_id) -> None:
    task = _close_tasks.pop(str(room_id), None)
    if task and not task.done():
        task.cancel()


def schedule_close_if_empty(room_id) -> None:
    """Call after a disconnect; no-op if the room still has someone online."""
    if get_manager().online_count(room_id) > 0:
        return
    cancel_pending_close(room_id)
    task = asyncio.create_task(_close_after_grace(room_id))
    _close_tasks[str(room_id)] = task


async def _close_after_grace(room_id) -> None:
    try:
        await asyncio.sleep(GRACE_SECONDS)
    except asyncio.CancelledError:
        return
    if get_manager().online_count(room_id) > 0:
        return
    await _close(room_id)


async def close_room_now(room_id) -> None:
    cancel_pending_close(room_id)
    await _close(room_id)


async def _close(room_id) -> None:
    async with session_factory() as session:
        room = await session.scalar(select(Room).where(Room.id == room_id))
        if room is None or room.status == "closed":
            return
        room.status = "closed"
        await session.commit()
    ai_room.discard_room(room_id)
    _close_tasks.pop(str(room_id), None)
    if _sio is not None:
        await _sio.emit(events.ROOM_CLOSED, {}, to=room_channel(room_id))
    logger.info("room %s auto-closed (empty)", room_id)
