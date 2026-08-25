"""Reconnect grace for presence: a disconnect doesn't immediately mark
someone offline. A brief network drop or page refresh shouldn't flash
"X left the room" and flip them offline for everyone else -- give them
OFFLINE_GRACE_SECONDS to reconnect first. Only after the grace window
passes with no reconnect do we actually flip is_online and announce it.

Mirrors app/realtime/room_lifecycle.py's grace-timer pattern, but per
(room, user) instead of per room.
"""
import asyncio
import logging
from typing import Awaitable, Callable
from uuid import UUID

from sqlalchemy import select

from app.db.models import RoomMember
from app.db.session import session_factory
from app.realtime import events
from app.realtime.manager import get_manager
from app.realtime.rooms import room_channel

logger = logging.getLogger(__name__)

OFFLINE_GRACE_SECONDS = 60.0

_sio = None
_on_offline: Callable[[UUID], Awaitable[None]] | None = None
_tasks: dict[str, asyncio.Task] = {}


def configure(sio, on_offline: Callable[[UUID], Awaitable[None]]) -> None:
    """`on_offline(room_id)` is called after someone is actually marked
    offline, so the caller can re-broadcast presence (kept in socket_server
    to avoid a circular import / duplicating that query)."""
    global _sio, _on_offline
    _sio = sio
    _on_offline = on_offline


def _key(room_id, user_id) -> str:
    return f"{room_id}:{user_id}"


def cancel_pending_offline(room_id, user_id) -> bool:
    """Returns True if a reconnect happened inside the grace window."""
    task = _tasks.pop(_key(room_id, user_id), None)
    if task and not task.done():
        task.cancel()
        return True
    return False


def schedule_offline_if_disconnected(room_id, user_id, display_name: str) -> None:
    """Call right after a socket disconnects. No-op if this user still has
    another live connection to the room (e.g. a second tab)."""
    if get_manager().has_user(room_id, user_id):
        return
    cancel_pending_offline(room_id, user_id)
    task = asyncio.create_task(_mark_offline_after_grace(room_id, user_id, display_name))
    _tasks[_key(room_id, user_id)] = task


async def _mark_offline_after_grace(room_id, user_id, display_name: str) -> None:
    try:
        await asyncio.sleep(OFFLINE_GRACE_SECONDS)
    except asyncio.CancelledError:
        return
    _tasks.pop(_key(room_id, user_id), None)
    if get_manager().has_user(room_id, user_id):
        return  # reconnected right at the edge of the window

    async with session_factory() as session:
        member = await session.scalar(
            select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
        )
        if member is None or not member.is_online:
            return
        member.is_online = False
        await session.commit()

    if _sio is not None:
        await _sio.emit(
            events.MEMBER_LEFT,
            {"user_id": str(user_id), "display_name": display_name},
            to=room_channel(room_id),
        )
    if _on_offline is not None:
        await _on_offline(room_id)
    logger.info("member %s in room %s marked offline after grace", user_id, room_id)
