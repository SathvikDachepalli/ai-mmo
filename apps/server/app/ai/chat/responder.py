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
    "along, but don't force yourself into every exchange.\n\n"
    "You have a face that shows your reaction. Before your reply, output "
    "exactly one line choosing the expression that matches your reaction to "
    "what was just said, in the LITERAL form `[emotion: <name>]` -- square "
    "brackets, the word \"emotion\", nothing else on that line -- then a "
    "blank line, then your reply as normal. Never use parentheses or the "
    "word \"expression\" for this tag; always `[emotion: <name>]` exactly. "
    "Pick <name> from exactly this "
    f"list: {', '.join(EMOTIONS)}. Use \"neutral\" for plain factual replies "
    "-- only pick a stronger expression when the conversation actually "
    "warrants it (a joke -> happy/smirk, being asked something hard -> "
    "thinking, a rude message -> angry/mad, bad news -> sad, unexpected or "
    "shocking news (good or bad) -> surprised, something that makes you "
    "personally excited/eager -> excited, etc.). \"surprised\" and "
    "\"excited\" are different: shock/disbelief at a sudden twist is "
    "surprised, not excited -- don't default to excited just because your "
    "reply is high-energy."
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
