"""Domain SQLAlchemy models. Canonical state lives here; the game engine mutates it."""
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UUID,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID

from app.db.session import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class User(SQLAlchemyBaseUserTableUUID, Base, TimestampMixin):
    """Account. fastapi-users supplies id/email/hashed_password/is_active/
    is_superuser/is_verified; display_name is our game-facing name."""

    __tablename__ = "users"

    display_name: Mapped[str] = mapped_column(String(128), nullable=False)

    characters: Mapped[list["Character"]] = relationship(back_populates="user")
    memberships: Mapped[list["WorldMember"]] = relationship(back_populates="user")
    room_memberships: Mapped[list["RoomMember"]] = relationship(back_populates="user")


class World(Base, TimestampMixin):
    __tablename__ = "worlds"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    # Canonical per-world event sequence counter.
    sequence: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    members: Mapped[list["WorldMember"]] = relationship(back_populates="world")
    locations: Mapped[list["Location"]] = relationship(back_populates="world")
    characters: Mapped[list["Character"]] = relationship(back_populates="world")


class WorldMember(Base, TimestampMixin):
    __tablename__ = "world_members"
    __table_args__ = (Index("ix_world_member_world_user", "world_id", "user_id", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="player", nullable=False)

    world: Mapped[World] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Location(Base, TimestampMixin):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Region for REGION visibility. e.g. "Blackwood"
    region: Mapped[str] = mapped_column(String(128), nullable=False)
    exits: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    world: Mapped[World] = relationship(back_populates="locations")


class Character(Base, TimestampMixin):
    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), nullable=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="characters")
    world: Mapped[World] = relationship(back_populates="characters")
    knowledge: Mapped[list["PlayerKnowledge"]] = relationship(back_populates="character")


class NPC(Base, TimestampMixin):
    __tablename__ = "npcs"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), index=True, nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    personality: Mapped[str] = mapped_column(Text, default="", nullable=False)
    goals: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    knowledge: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Item(Base, TimestampMixin):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), index=True, nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # physical | quest | currency
    kind: Mapped[str] = mapped_column(String(32), default="physical", nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Inventory(Base, TimestampMixin):
    __tablename__ = "inventories"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    character_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("characters.id"), index=True, nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), index=True, nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("characters.id"), index=True, nullable=True
    )
    kind: Mapped[str] = mapped_column(String(32), default="player", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)


class GameEvent(Base, TimestampMixin):
    __tablename__ = "game_events"
    __table_args__ = (
        Index("ix_events_world_seq", "world_id", "sequence_number"),
        Index("ix_events_world_created", "world_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("worlds.id"), index=True, nullable=False)
    sequence_number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID, nullable=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID, nullable=True)
    # PUBLIC | REGION | LOCATION | PARTY | PRIVATE
    visibility: Mapped[str] = mapped_column(String(16), default="LOCATION", nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class Room(Base, TimestampMixin):
    """A chat room: a short-code-joinable space with a host and members."""

    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    host_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    min_players: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    # waiting | active | closed
    status: Mapped[str] = mapped_column(String(16), default="waiting", nullable=False)
    # Host-set rules the AI participant follows in this room, on top of its base behavior.
    system_prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)

    members: Mapped[list["RoomMember"]] = relationship(back_populates="room")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="room")


class RoomMember(Base, TimestampMixin):
    __tablename__ = "room_members"
    __table_args__ = (Index("ix_room_member_room_user", "room_id", "user_id", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"), index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    room: Mapped[Room] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="room_memberships")


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_message_room_created", "room_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"), index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    author_name: Mapped[str] = mapped_column(String(128), nullable=False)
    # message | system | ai
    kind: Mapped[str] = mapped_column(String(16), default="message", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # A direct reply to another message is player-to-player and never wakes the AI.
    reply_to_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_messages.id"), nullable=True)

    room: Mapped[Room] = relationship(back_populates="messages")
    reply_to: Mapped["ChatMessage"] = relationship(remote_side=[id])


class PlayerKnowledge(Base, TimestampMixin):
    __tablename__ = "player_knowledge"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=_uuid)
    character_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("characters.id"), index=True, nullable=False
    )
    topic: Mapped[str] = mapped_column(String(128), nullable=False)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    # REGION visibility trick: same-location players must see events.
    # We also use a scope hint for broadcast decisions.
    character: Mapped[Character] = relationship(back_populates="knowledge")