---
name: agent-runtime-map
description: Use when starting work on this repo or when you need to know where a concept lives (agents, workflows, runtime, channels, persistence, UI, monitoring). Orientation map for the Yuno Agent Orchestration Platform.
---

# Orientation: where everything lives

Three layers, kept strictly separated:

| Concern | Path |
|---|---|
| HTTP API (the UI's only contract) | `backend/app/api/` |
| Agent runtime (LangGraph) | `backend/app/runtime/` |
| Persistence (SQLModel/SQLite) | `backend/app/models.py`, `backend/app/db.py` |
| Messaging channels | `backend/app/channels/` |
| Seed agents + workflow templates | `backend/app/templates/seed.py` |
| Web UI (React + React Flow) | `frontend/src/` |

## Runtime mental model
- `runtime/engine.py`
  - `run_agent(agent, task, …)` — the atomic unit: one agent as a ReAct loop
    (`create_react_agent`) with its tools, memory, guardrails, and token/cost.
  - `run_workflow(workflow, task, run_id)` — compiles the stored graph
    (`{entry, nodes, edges}`) into a LangGraph `StateGraph` and runs it.
    Conditional edges = conditions; back-edges = feedback loops.
  - `_eval_condition` — the edge condition grammar (`always`, `contains:X`,
    `not_contains:X`).
- `runtime/bus.py` — `EventBus` + `record_message`: persist **and** broadcast every
  event (this powers async agent-to-agent comms and the live `/ws/monitor`).
- `runtime/tools.py` — real tools + `TOOL_REGISTRY` + `build_agent_tools`.
- `runtime/memory.py` — durable (`MemoryItem`) + conversation memory.
- `runtime/llm.py` — Anthropic client + cost computation.

## Data model (`models.py`)
`Agent` · `Workflow` · `Run` · `Message` (unified: chat / agent / tool / log /
error) · `MemoryItem`.

## Golden rules
- Agents never call each other directly — they emit via the bus; the engine routes.
- Anything user-visible in monitoring must go through `record_message` so it is both
  persisted and streamed.
- New configurable agent dimensions go on the `Agent` model **and** `schemas.py`
  **and** the agent editor in `frontend/src/pages/AgentsPage.tsx`.
- Run the tests after runtime changes: `cd backend && .venv/bin/python -m pytest -q`.
