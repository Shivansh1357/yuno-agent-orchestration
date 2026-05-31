"""Test fixtures: isolated temp SQLite DB per session, no API key required."""
from __future__ import annotations

import os
import tempfile

import pytest

# Point the app at a throwaway DB *before* importing anything that opens it.
_TMP = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["ANTHROPIC_API_KEY"] = ""  # ensure no real calls
os.environ["TELEGRAM_BOT_TOKEN"] = ""


@pytest.fixture(scope="session", autouse=True)
def _init_db():
    from app.db import init_db

    init_db()
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
