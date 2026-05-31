"""Database engine + session helpers. SQLite by default for zero-setup local runs."""
from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

from sqlmodel import Session, SQLModel, create_engine

from .config import settings

# Ensure the sqlite data directory exists before the engine opens the file.
if settings.database_url.startswith("sqlite") and "/" in settings.database_url:
    db_path = settings.database_url.split("///")[-1]
    parent = os.path.dirname(db_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    """Import models so they register with metadata, then create tables."""
    from . import models  # noqa: F401  (side-effect: table registration)

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped session."""
    with Session(engine) as session:
        yield session


@contextmanager
def session_scope() -> Iterator[Session]:
    """Context-managed session for use outside the request cycle (runtime, channels)."""
    with Session(engine) as session:
        yield session
