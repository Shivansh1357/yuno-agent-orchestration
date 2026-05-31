"""Agent memory helpers.

Two layers of memory:

* **Durable key/value memory** (MemoryItem) — written via the `remember`/`recall`
  tools, summarized into the system prompt so an agent recalls facts across runs.
* **Conversation memory** — recent persisted Messages for a channel session,
  replayed so a Telegram/web conversation has continuity.
"""
from __future__ import annotations

from sqlmodel import select

from ..db import session_scope
from ..models import MemoryItem, Message, MessageType


def memory_summary(agent_id: str, limit: int = 20) -> str:
    """Render an agent's durable memory as a compact block for the system prompt."""
    with session_scope() as s:
        rows = s.exec(
            select(MemoryItem)
            .where(MemoryItem.agent_id == agent_id)
            .order_by(MemoryItem.created_at.desc())
            .limit(limit)
        ).all()
    if not rows:
        return ""
    # De-dup by key keeping the most recent.
    seen: dict[str, str] = {}
    for r in rows:
        seen.setdefault(r.key, r.value)
    lines = "\n".join(f"- {k}: {v}" for k, v in seen.items())
    return f"\n\n# What you remember\n{lines}\n"


def load_channel_history(channel: str, session_ref: str, limit: int = 12) -> list[tuple[str, str]]:
    """Return recent (role, content) chat turns for a channel session.

    role is 'human' or 'assistant' so it can map onto LLM message roles.
    """
    # JSON-path filtering is brittle across SQLite versions, so we fetch the
    # channel's recent chat rows and filter the session in Python.
    with session_scope() as s:
        rows = s.exec(
            select(Message)
            .where(Message.type == MessageType.chat, Message.channel == channel)
            .order_by(Message.created_at.desc())
            .limit(limit * 3)
        ).all()
    turns: list[tuple[str, str]] = []
    for m in reversed(rows):
        if m.meta.get("session") and m.meta.get("session") != session_ref:
            continue
        role = "human" if m.sender == "human" else "assistant"
        turns.append((role, m.content))
    return turns[-limit:]
