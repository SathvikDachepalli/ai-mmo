"""Unit tests for the pure game engine (validation + reduction logic)."""
import uuid

import pytest

from app.game_engine.actions.schemas import ActionProposal
from app.game_engine.actions.validators import (
    ActionValidationError,
    validate_and_apply,
)
from app.game_engine.state_snapshot import (
    CharacterState,
    ItemState,
    LocationState,
    WorldState,
)


def _world() -> WorldState:
    w = WorldState(world_id=uuid.uuid4())
    w.locations["village"] = LocationState(
        id=uuid.uuid4(), slug="village", name="Village", region="Blackwood",
        exits={"tavern": "tavern", "forest": "forest"},
    )
    w.locations["tavern"] = LocationState(
        id=uuid.uuid4(), slug="tavern", name="Tavern", region="Blackwood",
        exits={"door": "village"},
    )
    w.locations["forest"] = LocationState(
        id=uuid.uuid4(), slug="forest", name="Forest", region="Blackwood",
        exits={"trail": "village", "ridge": "cave"},
    )
    w.locations["cave"] = LocationState(
        id=uuid.uuid4(), slug="cave", name="Cave", region="Blackwood",
        exits={"mouth": "forest"},
    )
    actor = CharacterState(id=uuid.uuid4(), name="PlayerA", location_id=w.locations["village"].id)
    w.characters[str(actor.id)] = actor
    w.inventories[str(actor.id)] = set()
    return w, actor


def test_move_success():
    world, actor = _world()
    prop = ActionProposal(action_type="MOVE", parameters={"target_location": "forest"})
    outcome = validate_and_apply(world, actor, prop)
    assert len(outcome.events) == 1
    ev = outcome.events[0]
    assert ev.type == "PLAYER_MOVED"
    assert ev.payload == {"from": "village", "to": "forest"}
    # Actor location mutated to the canonical forest location.
    assert actor.location_id == world.locations["forest"].id


def test_move_rejects_unreachable():
    world, actor = _world()
    prop = ActionProposal(action_type="MOVE", parameters={"target_location": "cave"})
    with pytest.raises(ActionValidationError):
        validate_and_apply(world, actor, prop)


def test_move_rejects_unknown():
    world, actor = _world()
    prop = ActionProposal(action_type="MOVE", parameters={"target_location": "narnia"})
    with pytest.raises(ActionValidationError):
        validate_and_apply(world, actor, prop)


def test_inspect_room_private():
    world, actor = _world()
    outcome = validate_and_apply(world, actor, ActionProposal(action_type="INSPECT"))
    assert outcome.events[0].visibility == "PRIVATE"
    assert "Village" in outcome.events[0].payload["text"]


def test_speak_broadcast():
    world, actor = _world()
    prop = ActionProposal(action_type="SPEAK", parameters={"text": "hello everyone"})
    outcome = validate_and_apply(world, actor, prop)
    assert outcome.events[0].type == "SPEAK"
    assert outcome.events[0].payload["text"] == "hello everyone"


def test_pick_up_moves_item_to_inventory():
    world, actor = _world()
    item = ItemState(id=uuid.uuid4(), name="Lantern", location_id=actor.location_id)
    world.items[str(item.id)] = item
    prop = ActionProposal(action_type="PICK_UP", parameters={"item_id": str(item.id)})
    outcome = validate_and_apply(world, actor, prop)
    assert outcome.events[0].type == "ITEM_PICKED_UP"
    assert item.location_id is None
    assert str(item.id) in world.inventories[str(actor.id)]
    assert outcome.inventory_ops == [("add", str(actor.id), str(item.id))]


def test_pick_up_rejects_item_not_here():
    world, actor = _world()
    other_loc = world.locations["forest"].id
    item = ItemState(id=uuid.uuid4(), name="Lantern", location_id=other_loc)
    world.items[str(item.id)] = item
    prop = ActionProposal(action_type="PICK_UP", parameters={"item_id": str(item.id)})
    with pytest.raises(ActionValidationError):
        validate_and_apply(world, actor, prop)


def test_drop_returns_item_to_room():
    world, actor = _world()
    item = ItemState(id=uuid.uuid4(), name="Lantern", location_id=None)
    world.items[str(item.id)] = item
    world.inventories[str(actor.id)].add(str(item.id))
    prop = ActionProposal(action_type="DROP", parameters={"item_id": str(item.id)})
    outcome = validate_and_apply(world, actor, prop)
    assert outcome.events[0].type == "ITEM_DROPPED"
    assert item.location_id == actor.location_id
    assert str(item.id) not in world.inventories[str(actor.id)]
    assert outcome.inventory_ops == [("remove", str(actor.id), str(item.id))]


def test_drop_rejects_item_not_held():
    world, actor = _world()
    item = ItemState(id=uuid.uuid4(), name="Lantern", location_id=actor.location_id)
    world.items[str(item.id)] = item
    prop = ActionProposal(action_type="DROP", parameters={"item_id": str(item.id)})
    with pytest.raises(ActionValidationError):
        validate_and_apply(world, actor, prop)


def test_use_item_in_room_or_held():
    world, actor = _world()
    item = ItemState(id=uuid.uuid4(), name="Lantern", location_id=actor.location_id)
    world.items[str(item.id)] = item
    prop = ActionProposal(action_type="USE", parameters={"item_id": str(item.id)})
    outcome = validate_and_apply(world, actor, prop)
    assert outcome.events[0].type == "ITEM_USED"


def test_use_rejects_item_out_of_reach():
    world, actor = _world()
    other_loc = world.locations["forest"].id
    item = ItemState(id=uuid.uuid4(), name="Lantern", location_id=other_loc)
    world.items[str(item.id)] = item
    prop = ActionProposal(action_type="USE", parameters={"item_id": str(item.id)})
    with pytest.raises(ActionValidationError):
        validate_and_apply(world, actor, prop)