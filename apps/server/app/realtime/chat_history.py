"""Paginated chat history: latest page on join, older pages on scroll-up.

Shared by the socket "room_joined" payload and the REST /rooms/{code}/messages
endpoint so both serialize messages (including resolved reply previews) the
same way.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ChatMessage

PAGE_SIZE = 30


async def fetch_latest(session: AsyncSession, room_id, limit: int = PAGE_SIZE):
    """Newest `limit` messages, returned oldest-first. Also reports whether
    older messages exist beyond this page."""
    result = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit + 1)
    )
    rows = result.scalars().all()
    has_more = len(rows) > limit
    rows = list(reversed(rows[:limit]))
    return rows, has_more


async def fetch_before(session: AsyncSession, room_id, before_id, limit: int = PAGE_SIZE):
    """Messages strictly older than `before_id`, oldest-first, plus has_more."""
    anchor = await session.get(ChatMessage, before_id)
    if anchor is None or anchor.room_id != room_id:
        return [], False
    result = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id, ChatMessage.created_at < anchor.created_at)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit + 1)
    )
    rows = result.scalars().all()
    has_more = len(rows) > limit
    rows = list(reversed(rows[:limit]))
    return rows, has_more


async def serialize(session: AsyncSession, rows: list[ChatMessage]) -> list[dict]:
    """Row -> wire dict, resolving each reply's preview (which may point
    outside the current page, e.g. a much older message)."""
    by_id = {m.id: m for m in rows}
    missing = {m.reply_to_id for m in rows if m.reply_to_id and m.reply_to_id not in by_id}
    if missing:
        result = await session.execute(select(ChatMessage).where(ChatMessage.id.in_(missing)))
        for m in result.scalars().all():
            by_id[m.id] = m

    out = []
    for m in rows:
        target = by_id.get(m.reply_to_id) if m.reply_to_id else None
        out.append(
            {
                "id": str(m.id),
                "user_id": str(m.user_id) if m.user_id else None,
                "author_name": m.author_name,
                "kind": m.kind,
                "body": m.body,
                "reply_to": (
                    {"id": str(target.id), "author_name": target.author_name, "body": target.body[:140]}
                    if target is not None
                    else None
                ),
            }
        )
    return out
