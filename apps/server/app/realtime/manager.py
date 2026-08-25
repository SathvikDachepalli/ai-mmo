"""In-process Socket.IO connection registry for chat rooms.

Keeps per-room active connections so presence and "enough players to start"
gating don't require a DB round trip on every event. Single-process
assumption (modular monolith) — same as the rest of the realtime layer.
"""
import logging
from collections import defaultdict
from uuid import UUID

logger = logging.getLogger(__name__)


class ConnectionInfo:
    __slots__ = ("sid", "room_id", "user_id", "name", "min_players")

    def __init__(self, sid: str, room_id: UUID, user_id: UUID, name: str, min_players: int = 1):
        self.sid = sid
        self.room_id = room_id
        self.user_id = user_id
        self.name = name
        self.min_players = min_players


class ConnectionManager:
    """In-memory map from room_id -> connections."""

    def __init__(self) -> None:
        self._by_room: dict[str, dict[str, ConnectionInfo]] = defaultdict(dict)

    def register(self, conn: ConnectionInfo) -> None:
        self._by_room[str(conn.room_id)][conn.sid] = conn

    def unregister(self, sid: str) -> ConnectionInfo | None:
        for room_map in self._by_room.values():
            if sid in room_map:
                return room_map.pop(sid)
        return None

    def by_room(self, room_id: UUID) -> list[ConnectionInfo]:
        return list(self._by_room.get(str(room_id), {}).values())

    def get(self, sid: str) -> ConnectionInfo | None:
        for room_map in self._by_room.values():
            if sid in room_map:
                return room_map[sid]
        return None

    def online_count(self, room_id: UUID) -> int:
        return len(self._by_room.get(str(room_id), {}))

    def has_user(self, room_id: UUID, user_id: UUID) -> bool:
        """True if this user has any live connection in the room (possibly a
        different tab/sid than the one that just disconnected)."""
        return any(c.user_id == user_id for c in self._by_room.get(str(room_id), {}).values())


# Singleton manager shared across the app.
manager: ConnectionManager | None = None


def init_manager() -> None:
    global manager
    manager = ConnectionManager()


def get_manager() -> ConnectionManager:
    assert manager is not None, "ConnectionManager not initialized"
    return manager
