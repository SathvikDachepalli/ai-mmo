"""Turns recent room chat history into an AI reply.

Thin wrapper around the existing provider abstraction (app/ai/providers) — no
game engine involved here, just "read the last few messages, say something
useful". The realtime layer (app/realtime/ai_room.py) owns *when* to call
this; this module only knows *what* to send the model.
"""
import logging
from typing import AsyncIterator

from app.ai.providers.base import ChatMessage as ProviderMessage
from app.ai.providers.deterministic import DeterministicProvider
from app.ai.providers.factory import get_provider

logger = logging.getLogger(__name__)

# Matches the AI-companion sprite sheet's 16 expressions. The realtime layer
# (app/realtime/ai_room.py) strips the tag the model is asked to lead with
# and maps it to a portrait client-side -- see EMOTIONS in the frontend.
EMOTIONS = [
    "neutral", "happy", "thinking", "confused", "angry", "mad", "sad", "crying",
    "surprised", "excited", "worried", "blushing", "shy", "sleepy", "smirk", "pouting",
]

SYSTEM_PROMPT = (
    "You are a helpful, concise participant in a multiplayer group chat room. "
    "Multiple people may be talking to each other, not just to you. Respond "
    "naturally to the most recent messages, addressing people by name when "
    "relevant. Keep replies short (1-4 sentences) unless asked for more. "
    "If the recent messages are just people chatting with each other and "
    "don't need your input, you may respond briefly or move the conversation "
    "along, but don't force yourself into every exchange."
)

# Used by classify_emotion (a separate, structured call -- see graph.py) so
# the reply text itself never has to carry a machine-readable tag. Earlier
# versions asked the model to prefix its own reply with `[emotion: x]`, but
# free-form text generation kept drifting the tag's exact format (different
# brackets, wording, or omitting it), leaking raw tags into chat or losing
# the expression entirely. A dedicated JSON-mode call has no format to drift.
EMOTION_CLASSIFY_PROMPT = (
    "You are picking a facial expression for an AI chat participant, based "
    "on how it is about to react to the conversation below. Pick exactly "
    "one name from this list: "
    f"{', '.join(EMOTIONS)}. Use \"neutral\" for plain factual replies -- "
    "only pick a stronger expression when the conversation actually "
    "warrants it (a joke -> happy/smirk, being asked something hard -> "
    "thinking, a rude message -> angry/mad, bad news -> sad, unexpected or "
    "shocking news (good or bad) -> surprised, something that makes the AI "
    "personally excited/eager -> excited, etc.). \"surprised\" and "
    "\"excited\" are different: shock/disbelief at a sudden twist is "
    "surprised, not excited -- don't default to excited just because the "
    "reply is high-energy.\n\n"
    "Reply with JSON only: {\"emotion\": \"<name>\"}."
)

SEARCH_DECISION_PROMPT = """Decide whether answering the latest message well
requires current/real-time information (news, prices, scores, recent
releases, "today", "this week", anything that could have changed since your
training data) that a web search would help with.

Reply with JSON only: {"query": "<a short web search query>"} if a search
would help, or {"query": null} if the AI can answer fine from general
knowledge or the chat history alone. Do not search for casual chit-chat,
opinions, or anything answerable without current facts.
"""


def _format_history(
    history: list[dict], room_system_prompt: str, search_context: str | None
) -> list[ProviderMessage]:
    messages = [ProviderMessage("system", SYSTEM_PROMPT)]
    if room_system_prompt.strip():
        messages.append(
            ProviderMessage(
                "system",
                "Additional rules set by this room's host — follow them, and let them "
                f"override the general guidance above if they conflict:\n{room_system_prompt.strip()}",
            )
        )
    if search_context:
        messages.append(
            ProviderMessage(
                "system",
                "Live web search results for the current question (cite naturally, "
                f"don't dump raw links):\n{search_context}",
            )
        )
    for m in history:
        if m["kind"] == "ai":
            messages.append(ProviderMessage("assistant", m["body"]))
        else:
            messages.append(ProviderMessage("user", f"{m['author_name']}: {m['body']}"))
    return messages


async def decide_search_query(history: list[dict]) -> str | None:
    """Ask the model whether the latest message needs a web search, and for
    what. Returns None on any failure or when a search isn't warranted --
    this is a best-effort enhancement, never a hard dependency."""
    provider = get_provider()
    if isinstance(provider, DeterministicProvider):
        return None
    recent = history[-6:]
    context = "\n".join(f"{m['author_name']}: {m['body']}" for m in recent if m["kind"] != "ai")
    messages = [
        ProviderMessage("system", SEARCH_DECISION_PROMPT),
        ProviderMessage("user", context),
    ]
    try:
        raw = await provider.complete_json(messages, SEARCH_DECISION_PROMPT)
    except Exception:
        logger.warning("Search-decision call failed; skipping search", exc_info=True)
        return None
    query = raw.get("query") if isinstance(raw, dict) else None
    return query.strip() if isinstance(query, str) and query.strip() else None


async def classify_emotion(history: list[dict], room_system_prompt: str = "") -> str:
    """Ask the model which expression fits its upcoming reaction, as its own
    structured call -- see EMOTION_CLASSIFY_PROMPT for why this replaced the
    old inline `[emotion: x]` tag. Falls back to "neutral" on any failure or
    invalid value; never blocks or fails the actual reply."""
    provider = get_provider()
    if isinstance(provider, DeterministicProvider):
        return "neutral"
    recent = history[-8:]
    context = "\n".join(
        f"{'AI' if m['kind'] == 'ai' else m['author_name']}: {m['body']}" for m in recent
    )
    if room_system_prompt.strip():
        context = f"[Room rules: {room_system_prompt.strip()}]\n{context}"
    messages = [
        ProviderMessage("system", EMOTION_CLASSIFY_PROMPT),
        ProviderMessage("user", context),
    ]
    try:
        raw = await provider.complete_json(messages, EMOTION_CLASSIFY_PROMPT)
    except Exception:
        logger.warning("Emotion-classification call failed; defaulting to neutral", exc_info=True)
        return "neutral"
    emotion = raw.get("emotion") if isinstance(raw, dict) else None
    return emotion.strip().lower() if isinstance(emotion, str) and emotion.strip().lower() in EMOTIONS else "neutral"


async def stream_reply(
    history: list[dict], room_system_prompt: str = "", search_context: str | None = None
) -> AsyncIterator[str]:
    """Stream an AI reply given recent room history (oldest first).

    Each history item: {"author_name": str, "body": str, "kind": "message"|"ai"|"system"}.
    `room_system_prompt` is the host-set per-room rules, appended after the
    base behavior so a room can steer or constrain the AI (e.g. "stay in
    character as a dungeon master", "never reveal the answer to the riddle").
    `search_context` is formatted live web-search results, when a search was
    run for this turn (see app/ai/chat/search.py).
    """
    provider = get_provider()
    async for chunk in provider.stream_text(_format_history(history, room_system_prompt, search_context)):
        yield chunk
