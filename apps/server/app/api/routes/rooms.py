"""Room lifecycle: create, join by code, and fetch room state over REST.

Chat itself happens over Socket.IO (see app/realtime/socket_server.py); these
endpoints only manage the Postgres-backed room/membership records so a code
can be shared and joined before a socket ever connects.
"""
import random
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.users import current_active_user
from app.db.models import ChatMessage, Room, RoomMember, User
from app.db.session import get_session
from app.realtime import ai_room, chat_history, room_lifecycle

router = APIRouter(prefix="/rooms", tags=["rooms"])

CODE_ALPHABET = string.ascii_uppercase + string.digits
CODE_LENGTH = 6
MIN_PLAYERS_FLOOR = 1
MAX_PLAYERS_CEILING = 10
SYSTEM_PROMPT_MAX_LEN = 2000


def _clamp_capacity(min_players: int, max_players: int) -> tuple[int, int]:
    lo = max(MIN_PLAYERS_FLOOR, min(min_players, MAX_PLAYERS_CEILING))
    hi = max(lo, min(max_players, MAX_PLAYERS_CEILING))
    return lo, hi


async def _generate_unique_code(session: AsyncSession) -> str:
    for _ in range(20):
        code = "".join(random.choices(CODE_ALPHABET, k=CODE_LENGTH))
        existing = await session.scalar(select(Room).where(Room.code == code))
        if existing is None:
            return code
    raise HTTPException(status_code=500, detail="Could not generate a room code, try again")


class RoomCreate(BaseModel):
    name: str
    display_name: str | None = None
    min_players: int = 1
    max_players: int = 10
    system_prompt: str | None = None


class RoomJoin(BaseModel):
    code: str
    display_name: str | None = None


class RoomUpdate(BaseModel):
    system_prompt: str


class MemberOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    is_online: bool
    is_host: bool


class RoomOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    status: str
    min_players: int
    max_players: int
    system_prompt: str
    host_user_id: uuid.UUID
    members: list[MemberOut]


async def _room_out(session: AsyncSession, room: Room) -> RoomOut:
    result = await session.execute(select(RoomMember).where(RoomMember.room_id == room.id))
    members = result.scalars().all()
    return RoomOut(
        id=room.id,
        code=room.code,
        name=room.name,
        status=room.status,
        min_players=room.min_players,
        max_players=room.max_players,
        system_prompt=room.system_prompt,
        host_user_id=room.host_user_id,
        members=[
            MemberOut(
                user_id=m.user_id,
                display_name=m.display_name,
                is_online=m.is_online,
                is_host=m.user_id == room.host_user_id,
            )
            for m in members
        ],
    )


class MyRoomOut(BaseModel):
    code: str
    name: str
    status: str
    member_count: int
    is_host: bool
    last_activity_at: str


@router.get("/mine", response_model=list[MyRoomOut])
async def my_rooms(
    limit: int = 10,
    offset: int = 0,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """Rooms this account belongs to, most recently active first. Paginated
    for lazy-loading in the dashboard rather than dumping the whole history."""
    limit = max(1, min(limit, 50))
    result = await session.execute(
        select(Room, RoomMember)
        .join(RoomMember, RoomMember.room_id == Room.id)
        .where(RoomMember.user_id == user.id)
        .order_by(Room.updated_at.desc())
        .limit(limit)
        .offset(max(0, offset))
    )
    rows = result.all()

    out: list[MyRoomOut] = []
    for room, _membership in rows:
        count = await session.scalar(
            select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room.id)
        )
        out.append(
            MyRoomOut(
                code=room.code,
                name=room.name,
                status=room.status,
                member_count=count or 0,
                is_host=room.host_user_id == user.id,
                last_activity_at=room.updated_at.isoformat(),
            )
        )
    return out


@router.post("", response_model=RoomOut)
async def create_room(
    body: RoomCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    code = await _generate_unique_code(session)
    min_players, max_players = _clamp_capacity(body.min_players, body.max_players)
    room = Room(
        code=code,
        name=body.name.strip() or "Untitled Room",
        host_user_id=user.id,
        min_players=min_players,
        max_players=max_players,
        system_prompt=(body.system_prompt or "").strip()[:SYSTEM_PROMPT_MAX_LEN],
    )
    session.add(room)
    await session.flush()

    member = RoomMember(
        room_id=room.id,
        user_id=user.id,
        display_name=(body.display_name or user.display_name or "Host").strip(),
    )
    session.add(member)
    await session.commit()
    await session.refresh(room)
    return await _room_out(session, room)


@router.post("/join", response_model=RoomOut)
async def join_room(
    body: RoomJoin,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    code = body.code.strip().upper()
    room = await session.scalar(select(Room).where(Room.code == code))
    if room is None:
        raise HTTPException(status_code=404, detail="No room with that code")
    if room.status == "closed":
        # Anyone who still has the code can bring a closed room back --
        # closing just means "empty/ended", not "gone forever".
        room.status = "waiting"

    existing = await session.scalar(
        select(RoomMember).where(RoomMember.room_id == room.id, RoomMember.user_id == user.id)
    )
    if existing is None:
        count = await session.scalar(
            select(func.count()).select_from(RoomMember).where(RoomMember.room_id == room.id)
        )
        if (count or 0) >= room.max_players:
            raise HTTPException(status_code=400, detail=f"Room is full ({room.max_players} max)")
        member = RoomMember(
            room_id=room.id,
            user_id=user.id,
            display_name=(body.display_name or user.display_name or "Player").strip(),
        )
        session.add(member)
        await session.commit()
    elif session.is_modified(room):
        await session.commit()
    return await _room_out(session, room)


@router.get("/{code}", response_model=RoomOut)
async def get_room(
    code: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    room = await session.scalar(select(Room).where(Room.code == code.strip().upper()))
    if room is None:
        raise HTTPException(status_code=404, detail="No room with that code")
    return await _room_out(session, room)


@router.patch("/{code}", response_model=RoomOut)
async def update_room(
    code: str,
    body: RoomUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """Host-only: set the room's rules for the AI participant."""
    room = await session.scalar(select(Room).where(Room.code == code.strip().upper()))
    if room is None:
        raise HTTPException(status_code=404, detail="No room with that code")
    if room.host_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can edit this room")

    room.system_prompt = body.system_prompt.strip()[:SYSTEM_PROMPT_MAX_LEN]
    await session.commit()
    await session.refresh(room)

    from app.realtime import events
    from app.realtime.rooms import room_channel
    from app.realtime.socket_server import sio

    await sio.emit(events.ROOM_SETTINGS_UPDATED, {"system_prompt": room.system_prompt}, to=room_channel(room.id))
    return await _room_out(session, room)


class ReplyPreviewOut(BaseModel):
    id: str
    author_name: str
    body: str


class MessageOut(BaseModel):
    id: str
    author_name: str
    user_id: str | None
    kind: str
    body: str
    reply_to: ReplyPreviewOut | None
    emotion: str | None = None


class MessagesPage(BaseModel):
    messages: list[MessageOut]
    has_more: bool


@router.get("/{code}/messages", response_model=MessagesPage)
async def get_messages(
    code: str,
    before: uuid.UUID | None = None,
    limit: int = 30,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """Scroll-up pagination: omit `before` for the latest page, pass the id
    of the oldest message currently shown to fetch the page before it."""
    room = await session.scalar(select(Room).where(Room.code == code.strip().upper()))
    if room is None:
        raise HTTPException(status_code=404, detail="No room with that code")

    limit = max(1, min(limit, 100))
    if before is not None:
        rows, has_more = await chat_history.fetch_before(session, room.id, before, limit)
    else:
        rows, has_more = await chat_history.fetch_latest(session, room.id, limit)

    return MessagesPage(messages=await chat_history.serialize(session, rows), has_more=has_more)


@router.delete("/{code}", status_code=204)
async def delete_room(
    code: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """The host can permanently delete their own room (history included)."""
    room = await session.scalar(select(Room).where(Room.code == code.strip().upper()))
    if room is None:
        raise HTTPException(status_code=404, detail="No room with that code")
    if room.host_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can delete this room")

    await session.execute(delete(ChatMessage).where(ChatMessage.room_id == room.id))
    await session.execute(delete(RoomMember).where(RoomMember.room_id == room.id))
    await session.delete(room)
    await session.commit()

    ai_room.discard_room(room.id)
    room_lifecycle.cancel_pending_close(room.id)
