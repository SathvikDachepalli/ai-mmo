"""Name+code guest entry: request to join, host approves/blocks, host bans.

A guest never registers an account by hand. Requesting a join creates a
`RoomJoinRequest`; once the host approves it we mint a throwaway `User` (see
`app/api/auth/users.mint_token`) so the guest's browser ends up with the same
bearer JWT a real login would produce, and every downstream code path
(sockets, room REST, presence) treats them like any other account.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi_users.password import PasswordHelper
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.users import current_active_user, mint_token
from app.db.models import Room, RoomBan, RoomJoinRequest, RoomMember, User
from app.db.session import get_session
from app.realtime.rooms import room_channel
from app.realtime.socket_server import sio

router = APIRouter(prefix="/rooms", tags=["room-access"])

_password_helper = PasswordHelper()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_room(session: AsyncSession, code: str) -> Room:
    room = await session.scalar(select(Room).where(Room.code == code.strip().upper()))
    if room is None:
        raise HTTPException(status_code=404, detail="No room with that code")
    return room


def _require_host(room: Room, user: User) -> None:
    if room.host_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can do that")


class RequestJoinIn(BaseModel):
    name: str


class RequestJoinOut(BaseModel):
    request_id: uuid.UUID
    status: str


@router.post("/{code}/request-join", response_model=RequestJoinOut)
async def request_join(code: str, body: RequestJoinIn, session: AsyncSession = Depends(get_session)):
    name = body.name.strip()[:128]
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    room = await _get_room(session, code)

    banned = await session.scalar(
        select(RoomBan).where(RoomBan.room_id == room.id, RoomBan.name_lower == name.lower())
    )
    if banned is not None:
        raise HTTPException(status_code=403, detail="You've been blocked from this room")

    req = RoomJoinRequest(room_id=room.id, name=name, status="pending")
    session.add(req)
    await session.commit()

    await sio.emit(
        "join_request",
        {"request_id": str(req.id), "name": name, "created_at": req.created_at.isoformat()},
        to=room_channel(room.id),
    )
    return RequestJoinOut(request_id=req.id, status=req.status)


class JoinStatusOut(BaseModel):
    status: str
    token: str | None = None
    display_name: str | None = None


@router.get("/{code}/request-join/{request_id}", response_model=JoinStatusOut)
async def join_status(code: str, request_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    room = await _get_room(session, code)
    req = await session.get(RoomJoinRequest, request_id)
    if req is None or req.room_id != room.id:
        raise HTTPException(status_code=404, detail="No such join request")

    if req.status != "approved" or req.user_id is None:
        return JoinStatusOut(status=req.status)

    guest = await session.get(User, req.user_id)
    if guest is None:
        raise HTTPException(status_code=410, detail="Guest account no longer exists")
    token = await mint_token(guest)
    return JoinStatusOut(status="approved", token=token, display_name=guest.display_name)


class PendingRequestOut(BaseModel):
    request_id: uuid.UUID
    name: str
    created_at: str


@router.get("/{code}/pending", response_model=list[PendingRequestOut])
async def list_pending(
    code: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    room = await _get_room(session, code)
    _require_host(room, user)
    result = await session.execute(
        select(RoomJoinRequest)
        .where(RoomJoinRequest.room_id == room.id, RoomJoinRequest.status == "pending")
        .order_by(RoomJoinRequest.created_at)
    )
    return [
        PendingRequestOut(request_id=r.id, name=r.name, created_at=r.created_at.isoformat())
        for r in result.scalars().all()
    ]


@router.post("/{code}/request-join/{request_id}/approve", status_code=204)
async def approve_request(
    code: str,
    request_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    room = await _get_room(session, code)
    _require_host(room, user)
    req = await session.get(RoomJoinRequest, request_id)
    if req is None or req.room_id != room.id:
        raise HTTPException(status_code=404, detail="No such join request")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already resolved")

    guest = User(
        email=f"guest-{uuid.uuid4().hex}@guest.internal",
        hashed_password=_password_helper.hash(uuid.uuid4().hex),
        display_name=req.name,
        is_active=True,
        is_superuser=False,
        is_verified=True,
        is_guest=True,
    )
    session.add(guest)
    await session.flush()
    req.status = "approved"
    req.user_id = guest.id
    await session.commit()


@router.post("/{code}/request-join/{request_id}/deny", status_code=204)
async def deny_request(
    code: str,
    request_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """Host "block": denies the pending request and stops that name from
    requesting again."""
    room = await _get_room(session, code)
    _require_host(room, user)
    req = await session.get(RoomJoinRequest, request_id)
    if req is None or req.room_id != room.id:
        raise HTTPException(status_code=404, detail="No such join request")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already resolved")

    req.status = "denied"
    existing_ban = await session.scalar(
        select(RoomBan).where(RoomBan.room_id == room.id, RoomBan.name_lower == req.name.lower())
    )
    if existing_ban is None:
        session.add(RoomBan(room_id=room.id, name_lower=req.name.lower()))
    await session.commit()


@router.post("/{code}/members/{target_user_id}/ban", status_code=204)
async def ban_member(
    code: str,
    target_user_id: uuid.UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """Host "ban": removes a current member and blocks their name/account
    from rejoining."""
    room = await _get_room(session, code)
    _require_host(room, user)
    member = await session.scalar(
        select(RoomMember).where(RoomMember.room_id == room.id, RoomMember.user_id == target_user_id)
    )
    if member is None:
        raise HTTPException(status_code=404, detail="No such member")
    if member.user_id == room.host_user_id:
        raise HTTPException(status_code=400, detail="Can't ban the host")

    name_lower = member.display_name.lower()
    existing_ban = await session.scalar(
        select(RoomBan).where(RoomBan.room_id == room.id, RoomBan.name_lower == name_lower)
    )
    if existing_ban is None:
        session.add(RoomBan(room_id=room.id, name_lower=name_lower, user_id=member.user_id))
    else:
        existing_ban.user_id = member.user_id
    banned_user_id = member.user_id
    await session.delete(member)
    await session.commit()

    for sid in _sids_for_user(room.id, banned_user_id):
        await sio.emit("banned", {"detail": "You were banned from this room"}, to=sid)
        await sio.disconnect(sid)


def _sids_for_user(room_id: uuid.UUID, user_id: uuid.UUID) -> list[str]:
    from app.realtime.manager import get_manager

    return [c.sid for c in get_manager().by_room(room_id) if c.user_id == user_id]
