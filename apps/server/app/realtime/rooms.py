"""Socket.IO room addressing for chat rooms."""
from uuid import UUID


def room_channel(room_id: UUID | str) -> str:
    """The Socket.IO room every connected member of a chat room joins."""
    return f"room:{room_id}"
