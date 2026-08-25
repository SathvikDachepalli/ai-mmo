"""Tests for the deterministic intent interpreter."""
import asyncio

import pytest

from app.ai.providers.deterministic import interpret


def test_move_hint():
    raw = interpret("I walk into the forest", ["village", "tavern", "forest", "cave"])
    assert raw["action_type"] == "MOVE"
    assert raw["parameters"]["target_location"] == "forest"


def test_inspect_hint():
    assert interpret("inspect the trees", []).get("action_type") == "INSPECT"


def test_speak_hint():
    raw = interpret("ask Marek about the stranger", [])
    assert raw["action_type"] == "SPEAK"


def test_generic_fallback():
    raw = interpret("I sharpen my blade against a stone", [])
    assert raw["action_type"] == "GENERIC"