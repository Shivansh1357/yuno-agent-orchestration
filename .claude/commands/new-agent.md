---
description: Scaffold a new agent (config + optional seed) following platform conventions.
argument-hint: [agent purpose, e.g. "a SQL analyst that answers data questions"]
allowed-tools: Read, Edit, Grep, Glob
---

Create a new agent for: **$ARGUMENTS**

1. Read `.claude/skills/agent-runtime-map` and `backend/app/models.py` for the full
   `Agent` config surface.
2. Propose a complete agent config: `name`, `role`, a sharp `system_prompt`,
   `model` (default `claude-haiku-4-5-20251001`), suitable `tools` (from
   `runtime/tools.py` `AVAILABLE_TOOLS`), `channels`, `memory_enabled`,
   `interaction_rules`, and `guardrails` (`blocked_keywords`, `max_cost_usd`).
3. Offer two ways to create it:
   - **Via the UI/API** (preferred for a live system): `POST /api/agents` with the
     JSON body — print the exact body.
   - **As a seed** (so it exists on a fresh DB): add a `make_agent(...)` call in
     `backend/app/templates/seed.py`.
4. If any tool the agent needs doesn't exist yet, point me to the `adding-a-tool` skill.

Keep tools minimal and the system prompt specific. If the agent is meant to route
within a workflow, give it `interaction_rules` whose output matches an edge condition.
