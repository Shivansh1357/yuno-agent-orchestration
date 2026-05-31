"""Telegram channel via long-polling (getUpdates).

Long-polling means the bot needs no public URL or webhook — it works behind a
laptop firewall, which is exactly what a local-first demo needs. Chosen over
WhatsApp (Meta Business verification) and Slack (workspace + app config) for the
lowest-friction "talk to your agent from your phone" experience.

The loop pulls updates, hands each text message to `dispatch_inbound` (which
runs the target agent/workflow), and sends the reply back. All turns are
persisted as `chat` messages and visible in the UI.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import settings
from .base import Channel, dispatch_inbound

log = logging.getLogger("yuno.telegram")
API = "https://api.telegram.org/bot{token}/{method}"


class TelegramChannel(Channel):
    name = "telegram"

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._offset = 0

    async def start(self) -> None:
        if not settings.telegram_bot_token:
            log.info("Telegram disabled (TELEGRAM_BOT_TOKEN not set).")
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._poll_loop())
        log.info("Telegram channel started (long-polling).")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            await asyncio.gather(self._task, return_exceptions=True)

    def _url(self, method: str) -> str:
        return API.format(token=settings.telegram_bot_token, method=method)

    async def _poll_loop(self) -> None:
        async with httpx.AsyncClient(timeout=40) as client:
            while not self._stop.is_set():
                try:
                    resp = await client.get(
                        self._url("getUpdates"),
                        params={"offset": self._offset, "timeout": 30},
                    )
                    data = resp.json()
                    for update in data.get("result", []):
                        self._offset = update["update_id"] + 1
                        await self._handle_update(client, update)
                except Exception as exc:  # noqa: BLE001
                    log.warning("telegram poll error: %s", exc)
                    await asyncio.sleep(3)

    async def _handle_update(self, client: httpx.AsyncClient, update: dict) -> None:
        msg = update.get("message") or update.get("edited_message")
        if not msg:
            return
        chat_id = str(msg["chat"]["id"])
        text = msg.get("text", "")
        if not text:
            return
        if text.strip().lower() in {"/start", "/help"}:
            await self._send(client, chat_id,
                             "👋 Hi! I'm a Yuno orchestration agent. Send me a task.")
            return

        await self._send_typing(client, chat_id)
        reply = await dispatch_inbound(
            text, channel="telegram", session_ref=chat_id,
            target=settings.telegram_default_target,
        )
        await self._send(client, chat_id, reply or "(no response)")

    async def _send(self, client: httpx.AsyncClient, chat_id: str, text: str) -> None:
        # Telegram caps messages at 4096 chars.
        for chunk in (text[i:i + 4000] for i in range(0, max(len(text), 1), 4000)):
            await client.post(self._url("sendMessage"), json={"chat_id": chat_id, "text": chunk})

    async def _send_typing(self, client: httpx.AsyncClient, chat_id: str) -> None:
        try:
            await client.post(self._url("sendChatAction"),
                              json={"chat_id": chat_id, "action": "typing"})
        except Exception:  # noqa: BLE001
            pass


telegram_channel = TelegramChannel()
