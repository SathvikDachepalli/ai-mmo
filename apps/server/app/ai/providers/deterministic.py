"""Deterministic fallback provider. No network, no key needed.

Provides rule-based intent + narration so the app runs offline. Set
AI_PROVIDER=openai with valid credentials to use a real model.
"""
import json
from typing import Any, AsyncIterator

from app.ai.providers.base import ChatMessage, ChatProvider

MOVE_HINTS = (
    "walk into", "walk to", "go to", "go into", "enter", "head to",
    "travel to", "step into", "move to", "go explore", "walk toward",
)
INSPECT_HINTS = ("inspect", "examine", "look at", "look around", "look for", "search")
SPEAK_HINTS = ("say ", "ask ", "tell ", "greet", "speak", "talk to", "shout ", "ask about")
PICK_UP_HINTS = ("pick up", "grab ", "take ")
DROP_HINTS = ("drop ",)
USE_HINTS = ("use ",)

ALIASES = {
    "tavern": "tavern",
    "market": "market",
    "forest": "forest",
    "cave": "cave",
    "village": "village",
    "blackwood": "village",
}


class DeterministicProvider(ChatProvider):
    model = "deterministic"

    def __init__(self) -> None:
        self.model = "deterministic"

    @property
    def name(self) -> str:
        return "deterministic/local"

    async def complete_json(self, messages: list[ChatMessage], schema, **kwargs) -> dict[str, Any]:
        user_text = ""
        for m in reversed(messages):
            if m.role == "user":
                user_text = m.content
                break
        return interpret(user_text, kwargs.get("known_locations", []), kwargs.get("known_items", []))

    async def stream_text(self, messages, **kwargs) -> AsyncIterator[str]:
        text = "Deterministic provider has no model narration. Set AI_PROVIDER=openai to enable AI text."
        for chunk in text:
            yield chunk

    async def stream_json(self, messages, schema, **kwargs):
        obj = await self.complete_json(messages, schema, **kwargs)
        yield json.dumps(obj)


def interpret(
    user_text: str, known_locations: list[str], known_items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Rule-based intent parse. Also imported directly by intent service."""
    text = (user_text or "").strip()
    low = text.lower()
    items = known_items or []

    def _match_item(held_only: bool | None = None) -> str | None:
        for it in items:
            if held_only is not None and bool(it.get("held")) != held_only:
                continue
            if str(it["name"]).lower() in low:
                return str(it["id"])
        return None

    for phrase in PICK_UP_HINTS:
        if phrase in low:
            item_id = _match_item(held_only=False)
            if item_id:
                return {
                    "kind": "ACTION", "action_type": "PICK_UP",
                    "target_entity_id": item_id, "parameters": {"item_id": item_id},
                    "confidence": 0.85,
                }

    for phrase in DROP_HINTS:
        if phrase in low:
            item_id = _match_item(held_only=True)
            if item_id:
                return {
                    "kind": "ACTION", "action_type": "DROP",
                    "target_entity_id": item_id, "parameters": {"item_id": item_id},
                    "confidence": 0.85,
                }

    for phrase in USE_HINTS:
        if phrase in low:
            item_id = _match_item()
            if item_id:
                return {
                    "kind": "ACTION", "action_type": "USE",
                    "target_entity_id": item_id, "parameters": {"item_id": item_id},
                    "confidence": 0.85,
                }

    for phrase in INSPECT_HINTS:
        if phrase in low:
            return {
                "kind": "ACTION",
                "action_type": "INSPECT",
                "target_entity_id": None,
                "parameters": {},
                "confidence": 0.9,
            }

    for phrase in MOVE_HINTS:
        if phrase in low:
            for alias, target in ALIASES.items():
                if alias in low:
                    return {
                        "kind": "ACTION",
                        "action_type": "MOVE",
                        "target_entity_id": None,
                        "parameters": {"target_location": target},
                        "confidence": 0.9,
                    }
            # Bare location mention.
            for loc in known_locations:
                if loc in low:
                    return {
                        "kind": "ACTION",
                        "action_type": "MOVE",
                        "target_entity_id": None,
                        "parameters": {"target_location": loc},
                        "confidence": 0.9,
                    }

    for phrase in SPEAK_HINTS:
        if phrase in low:
            return {
                "kind": "ACTION",
                "action_type": "SPEAK",
                "target_entity_id": None,
                "parameters": {"text": text},
                "confidence": 0.85,
            }

    if not text:
        return {
            "kind": "ACTION", "action_type": "GENERIC",
            "target_entity_id": None, "parameters": {"text": ""}, "confidence": 0.5,
        }

    return {
        "kind": "ACTION",
        "action_type": "GENERIC",
        "target_entity_id": None,
        "parameters": {"text": text},
        "confidence": 0.5,
    }