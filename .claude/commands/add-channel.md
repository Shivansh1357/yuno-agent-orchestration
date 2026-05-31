---
description: Guided implementation of a new external messaging channel (Slack/WhatsApp/Discord/…).
argument-hint: [channel name, e.g. "slack"]
allowed-tools: Read, Edit, Write, Grep, Glob
---

Implement a new messaging channel: **$ARGUMENTS**

1. Load the `adding-a-channel` skill and ADR-0002 (prefer a no-public-webhook mode for
   local-first, like Telegram long-polling / Slack Socket Mode).
2. Create `backend/app/channels/<name>.py` implementing the `Channel` ABC
   (`start`/`stop`), translating transport ↔ text and calling
   `dispatch_inbound(text, channel="<name>", session_ref=..., target=...)` for every
   inbound message, then sending the returned reply back (chunk to the platform limit).
3. Add config to `config.py` and `.env.example` (token + default target).
4. Start it in `main.py`'s `lifespan`; add the channel to `GET /api/meta`'s list.
5. Do **not** re-implement routing/persistence — `dispatch_inbound` already creates the
   run, applies memory/history, and records the chat turns.

Confirm the backend still imports (`cd backend && .venv/bin/python -c "import app.main"`)
and note any new env vars I must set.
