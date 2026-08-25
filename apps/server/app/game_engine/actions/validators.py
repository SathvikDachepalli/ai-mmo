"""Pure action validation and reduction logic.

Given a WorldState snapshot and an ActionProposal, validate the proposal and
produce canonical GameEvents plus the applied mutations. No persistence or IO
happens here; the engine driver applies results to the DB.
"""
from dataclasses import dataclass, field

from app.events.models import GameEvent
from app.game_engine.actions.schemas import ActionProposal
from app.game_engine.state_snapshot import CharacterState, ItemState, WorldState


class ActionValidationError(Exception):
    """Action failed validation. `.reason` is a player-safe message."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class ActionOutcome:
    events: list[GameEvent] = field(default_factory=list)
    updated_characters: dict[str, CharacterState] = field(default_factory=dict)
    updated_items: dict[str, ItemState] = field(default_factory=dict)
    # (op, character_id, item_id) where op is "add" or "remove"
    inventory_ops: list[tuple[str, str, str]] = field(default_factory=list)


def _location_slug(state: WorldState, actor: CharacterState) -> str | None:
    for slug, loc in state.locations.items():
        if loc.id == actor.location_id:
            return slug
    return None


def validate_and_apply(
    state: WorldState, actor: CharacterState, proposal: ActionProposal
) -> ActionOutcome:
    """Dispatch a proposal to the matching reducer. Returns events + mutations."""
    outcome = ActionOutcome()
    t = proposal.action_type

    if t == "MOVE":
        _move(state, actor, proposal, outcome)
    elif t == "INSPECT":
        _inspect(state, actor, proposal, outcome)
    elif t in ("SPEAK", "GENERIC"):
        _speak_or_generic(state, actor, proposal, outcome)
    elif t == "PICK_UP":
        _pick_up(state, actor, proposal, outcome)
    elif t == "DROP":
        _drop(state, actor, proposal, outcome)
    elif t == "USE":
        _use(state, actor, proposal, outcome)
    else:
        raise ActionValidationError(f"Action '{t}' is not implemented yet.")

    return outcome


def _move(state, actor: CharacterState, action: ActionProposal, out: ActionOutcome) -> None:
    target = action.target_location
    if not target:
        raise ActionValidationError("Move requires a destination.")
    orig_slug = _location_slug(state, actor)
    if orig_slug is None:
        raise ActionValidationError("You are not in a known place.")

    target_loc = state.locations.get(target)
    if target_loc is None:
        raise ActionValidationError(
            f"The world does not know a place called '{target}'. Known places: "
            + ", ".join(state.locations.keys())
        )
    if target == orig_slug:
        raise ActionValidationError("You are already there.")

    exits = state.locations[orig_slug].exits
    if target not in exits.values():
        raise ActionValidationError(f"There is no direct way from '{orig_slug}' to '{target}'.")

    actor.location_id = target_loc.id
    out.updated_characters[str(actor.id)] = actor
    out.events.append(
        GameEvent(
            world_id=state.world_id,
            type="PLAYER_MOVED",
            actor_id=actor.id,
            target_id=target_loc.id,
            visibility="LOCATION",
            payload={"from": orig_slug, "to": target},
        )
    )


def _inspect(state, actor: CharacterState, action: ActionProposal, out: ActionOutcome) -> None:
    entity_id = action.target_entity_id
    if entity_id:
        npc = state.npcs.get(entity_id)
        item = state.items.get(entity_id)
        if npc and npc.location_id == actor.location_id:
            body = f"That is {npc.name}, here in the room."
        elif item and item.location_id == actor.location_id:
            body = f"{item.name}: it lies here in the room."
        elif item and entity_id in state.inventories.get(str(actor.id), set()):
            body = f"You glance at {item.name} in your possession."
        else:
            raise ActionValidationError("That is not here, or you cannot see it.")
    else:
        loc = next((l for l in state.locations.values() if l.id == actor.location_id), None)
        if loc is None:
            raise ActionValidationError("You are in an unknown location.")
        present = [c.name for c in state.characters.values()
                   if c.id != actor.id and c.location_id == actor.location_id]
        npcs = [n.name for n in state.npcs.values() if n.location_id == actor.location_id]
        parts = [f"You are in {loc.name}."]
        if npcs:
            parts.append("Here you see " + "; ".join(npcs) + ".")
        if present:
            parts.append("Also present: " + ", ".join(present) + ".")
        else:
            parts.append("You are alone here.")
        body = " ".join(parts)

    out.events.append(
        GameEvent(
            world_id=state.world_id,
            type="INSPECT",
            actor_id=actor.id,
            visibility="PRIVATE",
            payload={"text": body},
        )
    )


def _speak_or_generic(state, actor: CharacterState, action: ActionProposal, out: ActionOutcome) -> None:
    text = action.text or action.parameters.get("text") or action.rationale or ""
    if action.action_type == "GENERIC":
        etype, vis = "GENERIC_ACTION", "REGION"
    else:
        etype, vis = "SPEAK", "REGION"
    out.events.append(
        GameEvent(
            world_id=state.world_id,
            type=etype,
            actor_id=actor.id,
            visibility=vis,
            payload={"text": text},
        )
    )


def _pick_up(state: WorldState, actor: CharacterState, action: ActionProposal, out: ActionOutcome) -> None:
    item_id = action.item_id
    if not item_id:
        raise ActionValidationError("Pick up what?")
    item = state.items.get(item_id)
    if item is None:
        raise ActionValidationError("There is no such item in this world.")
    if item.location_id != actor.location_id:
        raise ActionValidationError(f"{item.name} is not here.")

    item.location_id = None
    state.inventories.setdefault(str(actor.id), set()).add(item_id)
    out.updated_items[item_id] = item
    out.inventory_ops.append(("add", str(actor.id), item_id))
    out.events.append(
        GameEvent(
            world_id=state.world_id,
            type="ITEM_PICKED_UP",
            actor_id=actor.id,
            target_id=item.id,
            visibility="LOCATION",
            payload={"item": item.name},
        )
    )


def _drop(state: WorldState, actor: CharacterState, action: ActionProposal, out: ActionOutcome) -> None:
    item_id = action.item_id
    if not item_id:
        raise ActionValidationError("Drop what?")
    held = state.inventories.get(str(actor.id), set())
    if item_id not in held:
        raise ActionValidationError("You are not carrying that.")
    item = state.items.get(item_id)
    if item is None:
        raise ActionValidationError("Unknown item.")

    item.location_id = actor.location_id
    held.discard(item_id)
    out.updated_items[item_id] = item
    out.inventory_ops.append(("remove", str(actor.id), item_id))
    out.events.append(
        GameEvent(
            world_id=state.world_id,
            type="ITEM_DROPPED",
            actor_id=actor.id,
            target_id=item.id,
            visibility="LOCATION",
            payload={"item": item.name},
        )
    )


def _use(state: WorldState, actor: CharacterState, action: ActionProposal, out: ActionOutcome) -> None:
    item_id = action.item_id
    if not item_id:
        raise ActionValidationError("Use what?")
    item = state.items.get(item_id)
    if item is None:
        raise ActionValidationError("Unknown item.")
    held = state.inventories.get(str(actor.id), set())
    in_room = item.location_id == actor.location_id
    if item_id not in held and not in_room:
        raise ActionValidationError("That item is not here, or in your possession.")

    out.events.append(
        GameEvent(
            world_id=state.world_id,
            type="ITEM_USED",
            actor_id=actor.id,
            target_id=item.id,
            visibility="LOCATION",
            payload={"item": item.name},
        )
    )