"""Message history + platform metadata endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import Message
from ..runtime.tools import AVAILABLE_TOOLS
from ..schemas import MessageRead

router = APIRouter(prefix="/api", tags=["messages"])


@router.get("/messages", response_model=list[MessageRead])
def list_messages(
    run_id: str | None = None,
    channel: str | None = None,
    type: str | None = None,
    limit: int = Query(200, le=1000),
    session: Session = Depends(get_session),
):
    q = select(Message)
    if run_id:
        q = q.where(Message.run_id == run_id)
    if channel:
        q = q.where(Message.channel == channel)
    if type:
        q = q.where(Message.type == type)
    q = q.order_by(Message.created_at.desc()).limit(limit)
    rows = session.exec(q).all()
    return list(reversed(rows))


@router.get("/meta")
def meta():
    """Static metadata the UI needs: available tools, models, channel status."""
    return {
        "tools": AVAILABLE_TOOLS,
        "models": list(settings.model_prices.keys()),
        "default_model": settings.default_model,
        "llm_enabled": settings.llm_enabled,
        "telegram_enabled": bool(settings.telegram_bot_token),
        "channels": ["web", "telegram"],
    }
