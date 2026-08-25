"""Admin-only room oversight: list every room, delete one outright.

Gated by fastapi-users' superuser flag (see app/scripts/promote_admin.py for
how an account gets that flag) — a regular player never sees this.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.users import current_admin_user
from app.db.models import ChatMessage, Room, RoomMember, User
from app.db.session import get_session
from app.realtime import ai_room, room_lifecycle

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminRoomOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    status: str
    min_players: int
    host_email: str
    member_count: int
    online_count: int
    created_at: str


@router.get("/rooms", response_model=list[AdminRoomOut])
async def list_rooms(
    limit: int = 20,
    offset: int = 0,
    _admin: User = Depends(current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    limit = max(1, min(limit, 100))
    result = await session.execute(
        select(Room).order_by(Room.created_at.desc()).limit(limit).offset(max(0, offset))
    )
    rooms = result.scalars().all()

    out: list[AdminRoomOut] = []
    for room in rooms:
        host = await session.get(User, room.host_user_id)
        count = await session.scalar(
            select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room.id)
        )
        online = await session.scalar(
            select(func.count())
            .select_from(RoomMember)
            .where(RoomMember.room_id == room.id, RoomMember.is_online.is_(True))
        )
        out.append(
            AdminRoomOut(
                id=room.id,
                code=room.code,
                name=room.name,
                status=room.status,
                min_players=room.min_players,
                host_email=host.email if host else "?",
                member_count=count or 0,
                online_count=online or 0,
                created_at=room.created_at.isoformat(),
            )
        )
    return out


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(
    room_id: uuid.UUID,
    _admin: User = Depends(current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    room = await session.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="No such room")

    await session.execute(delete(ChatMessage).where(ChatMessage.room_id == room_id))
    await session.execute(delete(RoomMember).where(RoomMember.room_id == room_id))
    await session.delete(room)
    await session.commit()

    ai_room.discard_room(room_id)
    room_lifecycle.cancel_pending_close(room_id)
