"""Per-room AI turn-taking: debounce, typing-interrupt, spam gate, stream lock.

Rules this module implements (see product ask that motivated it):
  1. A qualifying (non-reply) chat message schedules an AI turn after a short
     debounce. Anyone typing resets that debounce so the AI waits for people
     to finish their thought -- but only up to a hard cap, after which typing
     is ignored and the AI answers with whatever it has.
  2. Typing only resets the pre-reply debounce (rule 1). Once the AI has
     actually started streaming a reply, typing no longer interrupts it --
     the reply finishes uninterrupted and the next message starts a fresh
     turn normally.
  3. While a reply is streaming, no one may send a new chat message (checked
     by the caller via `is_streaming`) -- keeps the log from interleaving.
  4. If the room is being spammed (message flood or repeated near-duplicate
     text), the scheduled turn is skipped entirely; the AI stays quiet.

Nothing here touches the game engine or narration pipeline -- this is a
separate, simpler "chat participant" concern for plain chat rooms.
"""
import asyncio
import logging
import re
import time
from collections import Counter, deque
from typing import Optional
from uuid import UUID

from sqlalchemy import select

from app.ai.chat import search as web_search
from app.ai.chat.responder import EMOTIONS, decide_search_query, stream_reply
from app.db.models import ChatMessage, Room
from app.db.session import session_factory
from app.realtime import events
from app.realtime.rooms import room_channel

logger = logging.getLogger(__name__)

DEBOUNCE_SECONDS = 3.0
MAX_WAIT_SECONDS = 12.0
HISTORY_LIMIT = 20

SPAM_WINDOW_SECONDS = 10.0
SPAM_MESSAGE_THRESHOLD = 8
SPAM_DUP_THRESHOLD = 3

_sio = None  # set by configure(); avoids a circular import with socket_server


def configure(sio) -> None:
    global _sio
    _sio = sio


class _RoomAIState:
    __slots__ = ("pending_since", "timer_task", "gen_task", "streaming", "recent")

    def __init__(self) -> None:
        self.pending_since: Optional[float] = None
        self.timer_task: Optional[asyncio.Task] = None
        self.gen_task: Optional[asyncio.Task] = None
        self.streaming: bool = False
        # (timestamp, normalized_text) for every qualifying message, pruned by
        # age so a past burst can't keep suppressing the AI forever.
        self.recent: deque[tuple[float, str]] = deque()


_states: dict[str, _RoomAIState] = {}


def _state(room_id) -> _RoomAIState:
    key = str(room_id)
    st = _states.get(key)
    if st is None:
        st = _RoomAIState()
        _states[key] = st
    return st


def is_streaming(room_id) -> bool:
    return _state(room_id).streaming


def discard_room(room_id) -> None:
    key = str(room_id)
    st = _states.pop(key, None)
    if st is None:
        return
    if st.timer_task and not st.timer_task.done():
        st.timer_task.cancel()
    if st.gen_task and not st.gen_task.done():
        st.gen_task.cancel()


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


def record_message(room_id, text: str) -> None:
    """Track a qualifying (non-reply) message for spam detection."""
    st = _state(room_id)
    st.recent.append((time.monotonic(), _normalize(text)))


def _is_spam(room_id) -> bool:
    st = _state(room_id)
    now = time.monotonic()
    while st.recent and now - st.recent[0][0] > SPAM_WINDOW_SECONDS:
        st.recent.popleft()
    texts = [t for _, t in st.recent]
    if len(texts) >= SPAM_MESSAGE_THRESHOLD:
        return True
    if len(texts) >= SPAM_DUP_THRESHOLD:
        _, top_count = Counter(texts).most_common(1)[0]
        if top_count >= SPAM_DUP_THRESHOLD:
            return True
    return False


def trigger_message(room_id) -> None:
    """Call after persisting a qualifying (non-reply) chat message."""
    st = _state(room_id)
    now = time.monotonic()
    if st.pending_since is None:
        st.pending_since = now
    _reschedule(room_id, now)


def trigger_typing(room_id) -> None:
    """Call on any 'typing: true' signal from a room member."""
    st = _state(room_id)
    if st.streaming:
        return  # already replying -- let it finish, never interrupt mid-stream
    if st.pending_since is None:
        return  # nothing pending to push back
    _reschedule(room_id, time.monotonic())


def _reschedule(room_id, now: float) -> None:
    st = _state(room_id)
    if st.timer_task and not st.timer_task.done():
        st.timer_task.cancel()
    cap = (st.pending_since + MAX_WAIT_SECONDS) if st.pending_since is not None else now + DEBOUNCE_SECONDS
    target = min(now + DEBOUNCE_SECONDS, cap)
    delay = max(0.0, target - now)
    st.timer_task = asyncio.create_task(_fire_after(room_id, delay))


async def _fire_after(room_id, delay: float) -> None:
    try:
        await asyncio.sleep(delay)
    except asyncio.CancelledError:
        return

    st = _state(room_id)
    st.gen_task = asyncio.current_task()
    settled = False
    try:
        settled = await _run_ai_turn(room_id)
    except asyncio.CancelledError:
        pass  # interrupted by typing; pending_since stays put for the next attempt
    except Exception:
        logger.exception("AI turn failed for room %s", room_id)
        settled = True
    finally:
        st.gen_task = None
        if settled:
            st.pending_since = None


STREAM_MAX_ATTEMPTS = 2
STREAM_RETRY_DELAY_SECONDS = 1.5


async def _run_ai_turn(room_id) -> bool:
    if _is_spam(room_id):
        return True

    history = await _fetch_history(room_id)
    if not history:
        return True

    room_system_prompt = await _fetch_system_prompt(room_id)
    search_context = await _maybe_search(history)

    st = _state(room_id)
    st.streaming = True
    channel = room_channel(room_id)
    text = ""
    last_error: Exception | None = None
    try:
        # A transient provider hiccup (rate limit, network blip) used to fail
        # silently -- the stream would start and end with nothing said, and
        # the room had to send the same message again to get an answer. Retry
        # once before giving up, and say something if it still fails.
        emotion = "neutral"
        for attempt in range(1, STREAM_MAX_ATTEMPTS + 1):
            chunks: list[str] = []
            await _sio.emit(events.AI_STREAM_START, {}, to=channel)
            try:
                emotion = await _stream_with_emotion(
                    stream_reply(history, room_system_prompt, search_context), chunks, channel
                )
                text = "".join(chunks).strip()
                last_error = None
                break
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "AI stream attempt %d/%d failed for room %s: %s",
                    attempt, STREAM_MAX_ATTEMPTS, room_id, exc,
                )
                if attempt < STREAM_MAX_ATTEMPTS:
                    await asyncio.sleep(STREAM_RETRY_DELAY_SECONDS)

        if last_error is not None:
            await _sio.emit(
                events.ERROR,
                {"detail": "The AI couldn't respond just now — try sending again in a moment."},
                to=channel,
            )
        elif text:
            await _save_and_broadcast(room_id, text, emotion)
        return True
    except asyncio.CancelledError:
        raise
    finally:
        st.streaming = False
        await _sio.emit(events.AI_STREAM_END, {}, to=channel)


async def _fetch_system_prompt(room_id) -> str:
    async with session_factory() as session:
        room = await session.get(Room, room_id)
        return room.system_prompt if room else ""


async def _maybe_search(history: list[dict]) -> str | None:
    """Best-effort web search for current-events questions. Never blocks the
    reply on failure -- returns None on any error or when search is off."""
    if not web_search.is_configured():
        return None
    try:
        query = await decide_search_query(history)
        if not query:
            return None
        results = await web_search.search(query)
        return web_search.format_results(results) if results else None
    except Exception:
        logger.warning("Web search step failed; answering without it", exc_info=True)
        return None


async def _fetch_history(room_id) -> list[dict]:
    async with session_factory() as session:
        result = await session.execute(
            select(ChatMessage)
            .where(ChatMessage.room_id == room_id, ChatMessage.kind != "system")
            .order_by(ChatMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
        rows = list(reversed(result.scalars().all()))
    return [{"author_name": m.author_name, "body": m.body, "kind": m.kind} for m in rows]


EMOTION_PREFIX_RE = re.compile(r"^\[(?:emotion:\s*)?([a-zA-Z]+)\]\s*\n*", re.IGNORECASE)
EMOTION_PREFIX_MAX_BUFFER = 80  # give up waiting for the tag past this many chars


async def _stream_with_emotion(chunk_iter, chunks: list[str], channel: str) -> str:
    """Consume the reply stream, pulling the leading `[emotion: x]` tag the
    model is asked to lead with out of the visible text. Emits AI_EMOTION
    once (falling back to "neutral" if the model never produced a valid tag,
    e.g. the deterministic provider) and appends only the user-visible text
    to `chunks`. Returns the detected emotion."""
    buffer = ""
    detected = False
    emotion = "neutral"

    async def _flush_prefix_miss():
        nonlocal detected
        detected = True
        await _sio.emit(events.AI_EMOTION, {"emotion": emotion}, to=channel)
        if buffer:
            chunks.append(buffer)
            await _sio.emit(events.AI_STREAM_CHUNK, {"delta": buffer}, to=channel)

    async for chunk in chunk_iter:
        if detected:
            chunks.append(chunk)
            await _sio.emit(events.AI_STREAM_CHUNK, {"delta": chunk}, to=channel)
            continue

        buffer += chunk
        match = EMOTION_PREFIX_RE.match(buffer)
        if match:
            tag = match.group(1).lower()
            emotion = tag if tag in EMOTIONS else "neutral"
            detected = True
            await _sio.emit(events.AI_EMOTION, {"emotion": emotion}, to=channel)
            remainder = buffer[match.end():]
            if remainder:
                chunks.append(remainder)
                await _sio.emit(events.AI_STREAM_CHUNK, {"delta": remainder}, to=channel)
            buffer = ""
        elif len(buffer) > EMOTION_PREFIX_MAX_BUFFER:
            # Model didn't lead with a (valid) tag -- stop waiting and show
            # what's buffered so far as plain text instead of holding the
            # reply hostage to a formatting instruction it ignored.
            await _flush_prefix_miss()
            buffer = ""

    if not detected:
        await _flush_prefix_miss()

    return emotion


async def _save_and_broadcast(room_id, text: str, emotion: str = "neutral") -> None:
    async with session_factory() as session:
        msg = ChatMessage(room_id=room_id, user_id=None, author_name="AI", kind="ai", body=text)
        session.add(msg)
        await session.commit()
        await session.refresh(msg)
        payload = {
            "id": str(msg.id),
            "user_id": None,
            "author_name": "AI",
            "kind": "ai",
            "body": text,
            "reply_to": None,
            "emotion": emotion,
        }
    await _sio.emit(events.CHAT_MESSAGE, payload, to=room_channel(room_id))
