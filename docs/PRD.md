# PRD — AI Agent Orchestration Platform

**Status:** Implemented (hiring-challenge scope) · **Owner:** Candidate · **Last updated:** 2026-05-31

---

## 1. Summary

A platform where a user can **create AI agents**, configure how they behave and
operate (personality, tools, schedules, memory, limits, guardrails), and connect
them into **collaborative multi-agent workflows** that run on a **real runtime**.
Agents execute real tools, communicate asynchronously, and at least one agent is
reachable from an **external messaging channel** (Telegram) for conversational
human interaction. A web UI manages everything and shows **live monitoring**.

## 2. Problem & motivation

Teams increasingly need more than a single chatbot — they need *fleets* of
specialized agents that collaborate (research → draft → review; triage → route →
resolve), with humans able to reach them where they already are (chat apps), and
operators able to see what's happening (logs, hand-offs, cost). Building this
ad-hoc per use case is slow and unobservable. This platform makes agent creation,
orchestration, and observability **configurable and visual**.

## 3. Goals / Non-goals

**Goals**
- G1. Create and richly configure agents (CRUD + behavioral dimensions).
- G2. Compose agents into workflows with **conditions** and **feedback loops**.
- G3. Execute on a **real runtime** (real tool calls, real LLM, real routing).
- G4. **Asynchronous** agent-to-agent communication with persisted history.
- G5. At least one agent reachable via **Telegram**; conversation persisted + visible.
- G6. **Live monitoring**: logs, inter-agent messages, token/cost.
- G7. Run **fully local** with a **single setup command**.

**Non-goals (this iteration)**
- Multi-tenant auth / RBAC.
- Horizontal scale-out (distributed workers / queue).
- A marketplace of community tools/agents.
- Fine-tuning or model hosting.

## 4. Users & primary use cases

| Persona | Need | Flow |
|---|---|---|
| **Builder** (AI engineer) | Stand up a multi-agent workflow fast | Create agents → draw workflow → run → watch monitor |
| **Operator** | See what agents are doing + what it costs | Monitor tab: live feed + run list + token/cost |
| **End user** | Talk to an agent naturally | Message the Telegram bot → get a tool-using reply |

## 5. Functional requirements

- **FR1 — Agent CRUD**: name, role, system prompt, provider, model, tools, channels.
- **FR2 — Agent configuration**: temperature, max_tokens, **schedules** (cron),
  **memory** (durable + conversational), **skills**, **interaction rules**,
  **guardrails** (blocked keywords, per-run cost ceiling), **limits** (max tool
  iterations, global step cap).
- **FR3 — Visual workflow builder**: nodes = agents, edges = conditions
  (`always` / `contains:` / `not_contains:`), back-edges = **feedback loops**;
  set entry node; validate references; persist as graph JSON.
- **FR4 — Real runtime**: compile graph → LangGraph `StateGraph`; each node is a
  ReAct agent executing real tools; routing via conditional edges; recursion
  bounded.
- **FR5 — ≥ 2 workflow templates**: *Content Pipeline* (feedback loop),
  *Support Triage* (conditional routing), seeded on first boot.
- **FR6 — External channel**: Telegram (long-polling) wired to an agent or workflow.
- **FR7 — Persistence + history**: unified message stream visible in UI.
- **FR8 — Live monitoring**: WebSocket stream of logs / agent messages / tool
  calls / token + cost; run list with status.
- **FR9 — Single-command local run**: `docker compose up --build`.

## 6. Success metrics (from the brief)

- **Configurable dimensions per agent** — ≥ 12 (see `Agent` model).
- **Time from zero to a working multi-agent workflow** — ~0 (seeded templates run
  immediately after `docker compose up` + an API key).
- **End-to-end task completion rate** — Content Pipeline + Support Triage complete
  reliably in the demo.
- **Agent-to-agent message reliability** — every hand-off persisted and shown live.

## 7. System design (high level)

Three layers with a single API contract between UI and core:
1. **UI** — React SPA + FastAPI routers.
2. **Runtime** — LangGraph engine (`run_agent`, `run_workflow`), tools, memory,
   LLM/cost, EventBus.
3. **Persistence** — SQLModel/SQLite.

See `README.md` §2 for the diagram and the ADRs in `docs/adr/` for the rationale
behind each major decision.

## 8. Milestones

- M1 Data model + persistence + CRUD APIs ✅
- M2 LangGraph runtime: single agent + tools + memory + cost ✅
- M3 Workflow compile/execute with conditions + feedback loop ✅
- M4 EventBus + live monitoring WebSocket ✅
- M5 Telegram channel ✅
- M6 Web UI (Agents / Workflows builder / Monitor / Chat) ✅
- M7 Seed templates + tests + Docker one-command run + docs ✅

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Runaway feedback loops | Per-node visit cap + global recursion limit |
| Unbounded LLM cost | Per-agent `max_cost_usd` guardrail + live cost tally |
| Channel needs public hosting | Telegram **long-polling** (no webhook) |
| Heavy local setup | Docker multi-stage, single origin, SQLite (no DB server) |
| Python 3.14 wheel gaps | Pinned `python:3.12-slim` base image |

## 10. Open questions / future work

- Scheduler to auto-trigger agents on their cron (`schedule_cron` already stored).
- Distributed runtime (Redis pub/sub + task queue) for multi-instance scale.
- Slack/WhatsApp channels (the `Channel` abstraction is ready).
- AuthN/Z + per-user data scoping for hosted multi-tenant use.
