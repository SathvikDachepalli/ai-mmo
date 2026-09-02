"""guest join requests and bans

Revision ID: c1a9f2b7d4e0
Revises: a4563f91e8b6
Create Date: 2026-09-02 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c1a9f2b7d4e0'
down_revision: Union[str, None] = 'a4563f91e8b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_guest', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column('users', 'is_guest', server_default=None)

    op.create_table(
        'room_join_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('room_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_room_join_requests_room_id', 'room_join_requests', ['room_id'])
    op.create_index('ix_join_request_room_status', 'room_join_requests', ['room_id', 'status'])

    op.create_table(
        'room_bans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('room_id', sa.UUID(), nullable=False),
        sa.Column('name_lower', sa.String(length=128), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['room_id'], ['rooms.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_room_ban_room_id', 'room_bans', ['room_id'])
    op.create_index('ix_room_ban_room_name', 'room_bans', ['room_id', 'name_lower'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_room_ban_room_name', table_name='room_bans')
    op.drop_index('ix_room_ban_room_id', table_name='room_bans')
    op.drop_table('room_bans')

    op.drop_index('ix_join_request_room_status', table_name='room_join_requests')
    op.drop_index('ix_room_join_requests_room_id', table_name='room_join_requests')
    op.drop_table('room_join_requests')

    op.drop_column('users', 'is_guest')
