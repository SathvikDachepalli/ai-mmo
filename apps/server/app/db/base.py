"""Declarative base, split out from session.py so importing models (e.g. from
Alembic, which only needs Base.metadata) doesn't require a working async
engine -- Alembic runs against database_url_sync and never touches this."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
