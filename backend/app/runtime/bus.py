"""In-process async event bus + message recorder.

This is the backbone of two requirements at once:

* **Live monitoring** — every runtime event (logs, agent hand-offs, tool calls,
  token usage) is published here, and the `/ws/monitor` WebSocket fans them out
  to connected browsers in real time.
* **Async agent-to-agent communication** — agents do not call each other
  directly; they emit messages onto this bus and into the database, and the
  workflow engine routes the next agent. That decoupling is what "agents
  communicate asynchronously" means in practice.

Everything published is also persisted via `record_message`, so message history
survives restarts and is queryable by the UI.
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

from ..db import session_scope
from ..models import Message, MessageType


class EventBus:
    """Tiny fan-out pub/sub. Each subscriber gets its own bounded queue."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    async def publish(self, event: dict[str, Any]) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Slow consumer: drop the oldest event to stay live.
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except Exception:
                    pass


bus = EventBus()


async def record_message(
    *,
    type: MessageType,
    sender: str,
    recipient: str,
    content: str,
    run_id: Optional[str] = None,
    channel: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float = 0.0,
) -> Message:
    """Persist a Message and broadcast it to live monitors."""
    msg = Message(
        run_id=run_id,
        type=type,
        sender=sender,
        recipient=recipient,
        channel=channel,
        content=content,
        meta=meta or {},
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )
    # DB writes are sync (SQLite); push them off the event loop.
    await asyncio.to_thread(_persist, msg)
    await bus.publish(
        {
            "kind": "message",
            "id": msg.id,
            "run_id": msg.run_id,
            "type": msg.type.value if hasattr(msg.type, "value") else msg.type,
            "sender": msg.sender,
            "recipient": msg.recipient,
            "channel": msg.channel,
            "content": msg.content,
            "meta": msg.meta,
            "input_tokens": msg.input_tokens,
            "output_tokens": msg.output_tokens,
            "cost_usd": msg.cost_usd,
            "created_at": msg.created_at.isoformat(),
        }
    )
    return msg


def _persist(msg: Message) -> None:
    with session_scope() as s:
        s.add(msg)
        s.commit()
        s.refresh(msg)
