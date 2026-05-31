"""WebSocket endpoint for live monitoring.

Browsers connect to /ws/monitor and receive every runtime event in real time:
log lines, agent-to-agent messages, tool calls, token/cost updates, and run
status changes. Backed by the in-process EventBus.
"""
from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..runtime.bus import bus

router = APIRouter()


@router.websocket("/ws/monitor")
async def monitor(ws: WebSocket) -> None:
    await ws.accept()
    queue = bus.subscribe()
    try:
        await ws.send_json({"kind": "hello", "message": "connected to Yuno monitor"})
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        pass
    finally:
        bus.unsubscribe(queue)
        with contextlib.suppress(Exception):
            await ws.close()
