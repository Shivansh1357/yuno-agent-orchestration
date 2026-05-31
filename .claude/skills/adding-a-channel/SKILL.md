---
name: adding-a-channel
description: Use when integrating a new external messaging channel (Slack, WhatsApp, Discord, SMS, etc.) so a human can reach an agent conversationally in the Yuno platform.
---

# Adding a messaging channel

Channels live in `backend/app/channels/`. The reference implementation is
`telegram.py`; the contract is `base.py`.

## Steps

1. **Create `channels/<name>.py`** implementing the `Channel` ABC:

   ```python
   from .base import Channel, dispatch_inbound

   class SlackChannel(Channel):
       name = "slack"
       async def start(self) -> None: ...   # connect / begin receiving
       async def stop(self) -> None: ...     # clean shutdown
   ```

2. **On each inbound human message**, hand it to the runtime and send the reply back:

   ```python
   reply = await dispatch_inbound(
       text, channel="slack", session_ref=<conversation id>,
       target=settings.slack_default_target,   # an agent OR workflow name
   )
   await self._send(<conversation id>, reply)
   ```

   `dispatch_inbound` already persists the human + agent turns as `chat` messages,
   creates a `Run`, routes to the target agent/workflow, applies memory/history, and
   returns the reply. You do **not** re-implement any of that.

3. **Add config** to `config.py` (e.g. `slack_bot_token`, `slack_default_target`) and
   to `.env.example`.

4. **Start it** in `main.py`'s `lifespan` (mirror `telegram_channel.start()/stop()`).

5. **Surface status** (optional): add the channel to the `channels` list in
   `GET /api/meta` so the UI shows a status pill and the agent editor offers it.

## Conventions
- Prefer a connection mode that needs **no public webhook** for local-first demos
  (e.g. Slack Socket Mode), mirroring Telegram long-polling — see ADR-0002.
- Keep all routing/persistence in `dispatch_inbound`; the channel only translates
  transport ↔ text.
- Respect platform message-size limits (chunk long replies, like Telegram's 4096).
