"""Socket.IO server for chat rooms: presence, join/leave, chat, and the AI
participant that reads along and replies (see app/realtime/ai_room.py).

Room membership and message history are canonical in Postgres (see
app/db/models.Room/RoomMember/ChatMessage); this module wires that state to
live connections and to the AI turn-taking / auto-close side modules.
"""
import logging
import uuid

import socketio
from sqlalchemy import select

from app.api.auth.socket_auth import account_from_token
from app.db.models import ChatMessage, Room, RoomMember
from app.db.session import session_factory
from app.realtime import ai_room, chat_history, events, room_lifecycle
from app.realtime.manager import ConnectionInfo, get_manager
from app.realtime.rooms import room_channel

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
ai_room.configure(sio)
room_lifecycle.configure(sio)


@sio.event
async def connect(sid, environ, auth):
    if not auth:
        raise socketio.exceptions.ConnectionRefusedError("missing auth")
    code = (auth.get("code") or "").strip().upper()
    token = auth.get("token")
    if not code or not token:
        raise socketio.exceptions.ConnectionRefusedError("room code and token required")

    account = await account_from_token(token)
    if account is None:
        raise socketio.exceptions.ConnectionRefusedError("invalid or expired token")

    async with session_factory() as session:
        room = await session.scalar(select(Room).where(Room.code == code))
        if room is None:
            raise socketio.exceptions.ConnectionRefusedError("no room with that code")
        if room.status == "closed":
            raise socketio.exceptions.ConnectionRefusedError("this room is closed")

        member = await session.scalar(
            select(RoomMember).where(RoomMember.room_id == room.id, RoomMember.user_id == account.id)
        )
        if member is None:
            member = RoomMember(
                room_id=room.id,
                user_id=account.id,
                display_name=account.display_name or "Player",
            )
            session.add(member)
        member.is_online = True
        await session.commit()

        room_id, display_name = room.id, member.display_name

    room_lifecycle.cancel_pending_close(room_id)
    get_manager().register(ConnectionInfo(sid=sid, room_id=room_id, user_id=account.id, name=display_name))
    await sio.enter_room(sid, room_channel(room_id))

    await _maybe_activate(room_id)
    await _emit_room_joined(sid, room_id, code)
    await sio.emit(
        events.MEMBER_JOINED,
        {"user_id": str(account.id), "display_name": display_name},
        to=room_channel(room_id),
        skip_sid=sid,
    )
    await _broadcast_presence(room_id)
    return True


@sio.event
async def disconnect(sid):
    conn = get_manager().unregister(sid)
    if not conn:
        return
    async with session_factory() as session:
        member = await session.scalar(
            select(RoomMember).where(RoomMember.room_id == conn.room_id, RoomMember.user_id == conn.user_id)
        )
        if member:
            member.is_online = False
            await session.commit()

    await sio.leave_room(sid, room_channel(conn.room_id))
    await sio.emit(
        events.MEMBER_LEFT,
        {"user_id": str(conn.user_id), "display_name": conn.name},
        to=room_channel(conn.room_id),
    )
    await _broadcast_presence(conn.room_id)
    room_lifecycle.schedule_close_if_empty(conn.room_id)


@sio.on("typing")
async def typing(sid, data):
    conn = get_manager().get(sid)
    if not conn:
        return
    is_typing = bool(data.get("typing"))
    await sio.emit(
        events.PLAYER_TYPING,
        {"user_id": str(conn.user_id), "name": conn.name, "typing": is_typing},
        to=room_channel(conn.room_id),
        skip_sid=sid,
    )
    if is_typing:
        # Fresh context incoming -- interrupt any in-flight/pending AI reply.
        ai_room.trigger_typing(conn.room_id)


@sio.on("chat_message")
async def chat_message(sid, data):
    conn = get_manager().get(sid)
    if not conn:
        await sio.emit(events.ERROR, {"detail": "not connected"}, to=sid)
        return
    text = (data.get("text") or "").strip()
    if not text:
        return

    if get_manager().online_count(conn.room_id) < 2:
        await sio.emit(events.ERROR, {"detail": "Need at least 2 people in the room to chat."}, to=sid)
        return

    if ai_room.is_streaming(conn.room_id):
        await sio.emit(events.ERROR, {"detail": "AI is still replying — hang on a moment."}, to=sid)
        return

    reply_to_raw = data.get("reply_to")
    reply_to_id: uuid.UUID | None = None
    reply_preview: dict | None = None
    if reply_to_raw:
        try:
            candidate = uuid.UUID(str(reply_to_raw))
        except ValueError:
            candidate = None
        if candidate is not None:
            async with session_factory() as session:
                target = await session.scalar(
                    select(ChatMessage).where(ChatMessage.id == candidate, ChatMessage.room_id == conn.room_id)
                )
            if target is not None:
                reply_to_id = target.id
                reply_preview = {
                    "id": str(target.id),
                    "author_name": target.author_name,
                    "body": target.body[:140],
                }

    async with session_factory() as session:
        msg = ChatMessage(
            room_id=conn.room_id,
            user_id=conn.user_id,
            author_name=conn.name,
            kind="message",
            body=text,
            reply_to_id=reply_to_id,
        )
        session.add(msg)
        await session.commit()
        await session.refresh(msg)
        payload = {
            "id": str(msg.id),
            "user_id": str(conn.user_id),
            "author_name": conn.name,
            "kind": "message",
            "body": text,
            "reply_to": reply_preview,
        }

    await sio.emit(events.CHAT_MESSAGE, payload, to=room_channel(conn.room_id))

    # A direct reply is player-to-player and never wakes the AI.
    if reply_to_id is None:
        ai_room.record_message(conn.room_id, text)
        ai_room.trigger_message(conn.room_id)


@sio.on("end_room")
async def end_room(sid, data):
    """Host-initiated immediate close ("stop the chat")."""
    conn = get_manager().get(sid)
    if not conn:
        return
    async with session_factory() as session:
        room = await session.get(Room, conn.room_id)
        if room is None or room.host_user_id != conn.user_id:
            await sio.emit(events.ERROR, {"detail": "Only the host can end this room."}, to=sid)
            return
    await room_lifecycle.close_room_now(conn.room_id)


async def _maybe_activate(room_id) -> None:
    """Flip a waiting room to active once it has >=min_players members."""
    async with session_factory() as session:
        room = await session.get(Room, room_id)
        if room is None or room.status != "waiting":
            return
        result = await session.execute(select(RoomMember).where(RoomMember.room_id == room_id))
        count = len(result.scalars().all())
        if count >= room.min_players:
            room.status = "active"
            await session.commit()


async def _emit_room_joined(sid, room_id, code) -> None:
    async with session_factory() as session:
        room = await session.get(Room, room_id)
        members_result = await session.execute(select(RoomMember).where(RoomMember.room_id == room_id))
        members = members_result.scalars().all()
        history_rows, has_more_history = await chat_history.fetch_latest(session, room_id)
        history = await chat_history.serialize(session, history_rows)

    online_ids = {str(c.user_id) for c in get_manager().by_room(room_id)}
    await sio.emit(
        events.ROOM_JOINED,
        {
            "code": code,
            "name": room.name,
            "status": room.status,
            "min_players": room.min_players,
            "max_players": room.max_players,
            "system_prompt": room.system_prompt,
            "host_user_id": str(room.host_user_id),
            "members": [
                {
                    "user_id": str(m.user_id),
                    "display_name": m.display_name,
                    "is_online": str(m.user_id) in online_ids,
                    "is_host": m.user_id == room.host_user_id,
                }
                for m in members
            ],
            "history": history,
            "has_more_history": has_more_history,
        },
        to=sid,
    )


async def _broadcast_presence(room_id) -> None:
    async with session_factory() as session:
        members_result = await session.execute(select(RoomMember).where(RoomMember.room_id == room_id))
        members = members_result.scalars().all()
    online_ids = {str(c.user_id) for c in get_manager().by_room(room_id)}
    await sio.emit(
        events.PRESENCE_UPDATE,
        {
            "members": [
                {
                    "user_id": str(m.user_id),
                    "display_name": m.display_name,
                    "is_online": str(m.user_id) in online_ids,
                }
                for m in members
            ]
        },
        to=room_channel(room_id),
    )


def make_app():
    return socketio.ASGIApp(sio)
