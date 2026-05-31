---
description: Boot the full Yuno platform locally (single command) and report the URL + status.
allowed-tools: Bash(test:*), Bash(cp:*), Bash(docker compose:*), Read
---

Boot the platform for a demo:

1. Ensure `.env` exists: if not, `cp .env.example .env` and tell me to add my
   `ANTHROPIC_API_KEY` (and optionally `TELEGRAM_BOT_TOKEN`).
2. Run `docker compose up --build -d`.
3. Wait for health, then curl `http://localhost:8000/api/health` and
   `http://localhost:8000/api/meta` and report `llm_enabled` / `telegram_enabled`.
4. Print the URL **http://localhost:8000** and a one-line reminder of the demo script
   (Agents → Workflows → run Content Pipeline → watch Monitor → Telegram).

If `ANTHROPIC_API_KEY` is unset, warn that agents can be configured but not executed
until it's added.
