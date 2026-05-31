"""FastAPI application entrypoint.

Wires the three layers the challenge asks to keep separate:
  * API / UI layer        — the routers below + the static React build
  * agent runtime         — app.runtime.* (LangGraph)
  * data / persistence     — app.db + app.models (SQLite)

On startup it initializes the DB, seeds example agents/workflows, and starts the
Telegram channel (if a token is configured).
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import agents, messages, runs, workflows, ws
from .channels.telegram import telegram_channel
from .db import init_db
from .templates.seed import seed_if_empty

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("yuno")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_if_empty()
    await telegram_channel.start()
    log.info("Yuno Agent Orchestration Platform ready.")
    yield
    await telegram_channel.stop()


app = FastAPI(title="Yuno Agent Orchestration Platform", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local-first dev; tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(workflows.router)
app.include_router(runs.router)
app.include_router(messages.router)
app.include_router(ws.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Serve the built React frontend if present (single-origin deploy) ------- #
_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        index = os.path.join(_FRONTEND_DIST, "index.html")
        return FileResponse(index)
