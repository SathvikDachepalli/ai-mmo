"""Intent Interpreter: natural language player input -> structured ActionProposal.

Never mutates state. The engine decides whether the proposal is legal.
"""
import logging
from typing import Any

from app.ai.providers.base import ChatMessage
from app.ai.providers.deterministic import DeterministicProvider, interpret
from app.ai.providers.factory import get_provider
from app.ai.schemas.intent import IntentResult
from app.game_engine.actions.schemas import ActionProposal

logger = logging.getLogger(__name__)

INTENT_SCHEMA_PROMPT = """You are the intent interpreter for a multiplayer text RPG.
Map the player's natural-language action to ONE structured action.

Valid action_type values: MOVE, SPEAK, INSPECT, PICK_UP, DROP, USE, ATTACK, GENERIC.
- For MOVE set parameters.target_location to one of the known location slugs.
- For SPEAK set parameters.text to the spoken words.
- For INSPECT set target_entity_id to an NPC id if named, else null.
- For PICK_UP/DROP/USE set parameters.item_id to the id of a known item (never invent one).
- If it fits no slot, use GENERIC with parameters.text set to a terse description.

Reply with JSON only, matching this shape:
{"kind":"ACTION","action_type":"...","target_entity_id":null,"parameters":{...},"confidence":0.9,"rationale":"one short clause"}
"""


async def interpret_action(
    *,
    player_name: str,
    location_slug: str,
    location_slugs: list[str],
    npc_list: list[dict[str, Any]],
    item_list: list[dict[str, Any]] | None = None,
    recent_events: list[dict[str, Any]],
    player_text: str,
) -> ActionProposal:
    """Produce an ActionProposal from a player's natural-language input."""
    provider = get_provider()
    item_list = item_list or []

    if isinstance(provider, DeterministicProvider):
        raw = interpret(player_text, location_slugs, item_list)
    else:
        system = (
            INTENT_SCHEMA_PROMPT
            + f"\nKnown location slugs: {location_slugs}."
        )
        user = _context_block(player_name, location_slug, npc_list, recent_events, item_list)
        messages = [
            ChatMessage("system", system),
            ChatMessage("user", user),
            ChatMessage("user", player_text),
        ]
        try:
            raw = await provider.complete_json(messages, system)
        except Exception:
            logger.exception("AI intent failed; using rule-based interpretation.")
            raw = interpret(player_text, location_slugs)

    result = IntentResult(**{
        "kind": "ACTION",
        "action_type": raw.get("action_type", "GENERIC"),
        "target_entity_id": raw.get("target_entity_id"),
        "parameters": raw.get("parameters", {}),
        "confidence": raw.get("confidence", 1.0),
    })
    return ActionProposal(
        kind="ACTION",
        action_type=result.action_type,
        target_entity_id=result.target_entity_id,
        parameters=result.parameters,
        confidence=result.confidence,
        rationale=raw.get("rationale"),
    )


def _context_block(player_name: str, location_slug: str,
                   npc_list: list[dict[str, Any]], recent: list[dict[str, Any]],
                   item_list: list[dict[str, Any]] | None = None) -> str:
    lines = [f"You are {player_name}, currently in '{location_slug}'."]
    if npc_list:
        lines.append("NPCs here: " + ", ".join(f"{n['name']} (id {n['id']})" for n in npc_list))
    if item_list:
        lines.append("Items visible: " + ", ".join(
            f"{i['name']} (id {i['id']}, {'carried' if i.get('held') else 'on the ground'})"
            for i in item_list
        ))
    if recent:
        lines.append("Recent world events: " + "; ".join(repr(e) for e in recent[-5:]))
    return "\n".join(lines)