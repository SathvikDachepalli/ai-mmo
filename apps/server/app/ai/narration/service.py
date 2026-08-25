"""Narrator: canonical events -> descriptive text, optionally streamed.

The narrator must not invent entities, items, damage, or state changes that
were not present in the events it is given. It only renders what the engine
emitted.
"""
import logging
from typing import Any, AsyncIterator

from app.ai.providers.base import ChatMessage
from app.ai.providers.deterministic import DeterministicProvider
from app.ai.providers.factory import get_provider

logger = logging.getLogger(__name__)

NARRATION_PROMPT = """You are the narrator of a multiplayer text RPG.
Below are CANONICAL world events emitted by the game engine. Describe them
vividly but DO NOT invent entities, items, numbers, or state changes that are
not present in the events. Second person, present tense. One or two sentences.

Events:
{events_payload}
"""

# Deterministic templates keyed by event type.
_TEMPLATES: dict[str, str] = {
    "PLAYER_MOVED": "{name} heads from {from_slug} to {to_slug}.",
    "INSPECT": "{text}",
    "SPEAK": '{name} says: "{text}"',
    "GENERIC_ACTION": "{name} {text}",
    "ITEM_PICKED_UP": "{name} picks up {item}.",
    "ITEM_DROPPED": "{name} drops {item}.",
    "ITEM_USED": "{name} uses {item}.",
}

_NAMES: dict[str, str] = {}


def _render_deterministic(ev: dict[str, Any]) -> str | None:
    etype = ev.get("type")
    tpl = _TEMPLATES.get(etype)
    if not tpl:
        return None
    payload = ev.get("payload", {})
    try:
        return tpl.format(name=ev.get("actor_name", "somebody"), **payload)
    except (KeyError, IndexError):
        return None


async def narrate(events: list[dict[str, Any]]) -> str:
    """One-shot narration for the given canonical events."""
    provider = get_provider()
    if isinstance(provider, DeterministicProvider):
        parts = []
        for ev in events:
            text = _render_deterministic(ev)
            if text:
                parts.append(text)
        # Fall back to raw assignment when a template produced nothing.
        for ev in events:
            if _render_deterministic(ev) is None:
                parts.append(_fallback_line(ev))
        return " ".join(parts) if parts else "The world shifts."

    payload = _events_payload(events)
    messages = [
        ChatMessage("system", NARRATION_PROMPT.format(events_payload=payload)),
        ChatMessage("user", "Narrate these events."),
    ]
    try:
        obj = await provider.complete_json(messages, None)
        return obj.get("text", "") if isinstance(obj, dict) else str(obj)
    except Exception:
        logger.exception("AI narration failed; using deterministic.")
        return await _deterministic_text(events)


async def stream_narration(events: list[dict[str, Any]]) -> AsyncIterator[str]:
    """Stream narration if provider supports it; else yield the whole block once."""
    provider = get_provider()
    if isinstance(provider, DeterministicProvider):
        text = await narrate(events)
        yield text
        return

    payload = _events_payload(events)
    messages = [
        ChatMessage("system", NARRATION_PROMPT.format(events_payload=payload)),
        ChatMessage("user", "Narrate, streaming naturally."),
    ]
    async for chunk in provider.stream_text(messages):
        yield chunk


def _events_payload(events: list[dict[str, Any]]) -> str:
    out = []
    for ev in events:
        actor = ev.get("actor_name", "someone")
        t = ev.get("type")
        p = ev.get("payload", {})
        out.append(f"- {actor} caused {t}: {p}")
    return "\n".join(out)


async def _deterministic_text(events: list[dict[str, Any]]) -> str:
    parts = []
    for ev in events:
        text = _render_deterministic(ev)
        parts.append(text if text else _fallback_line(ev))
    return " ".join(parts) if parts else "The world shifts."


def _fallback_line(ev: dict[str, Any]) -> str:
    t = ev.get("type")
    p = ev.get("payload", {})
    text = p.get("text")
    if text:
        return f"{ev.get('actor_name','Someone')} {t.replace('_',' ').lower()}: {text}"
    return f"{ev.get('actor_name','Someone')} performed {t}."