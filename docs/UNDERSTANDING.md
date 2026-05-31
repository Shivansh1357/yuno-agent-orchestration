# Documentation of Understanding
### AI Agent Orchestration Platform — Yuno AI Engineer Assessment

**Author:** Shivansh Tripathi · **Date:** 31 May 2026
**Repository:** *(GitHub link in submission)* · **Live demo:** *(Hosted link in submission)*

---

## 1. How I read the problem

The brief asks for a **platform to create, configure, and orchestrate AI agents** — not a
single chatbot. Stripping it to its essence, a strong submission has to prove four things
are *real*, not mocked:

1. **Configurability** — a user can define an agent's whole behavior (personality, model,
   tools, memory, schedule, guardrails, limits) and compose agents into workflows from a UI.
2. **A real runtime** — those agents actually execute: they call an LLM, run real tools in a
   loop, and hand work to each other to finish a task autonomously.
3. **Reachability** — at least one agent is reachable by a human over an external messaging
   channel, conversationally.
4. **Observability** — you can watch it happen (logs, inter-agent messages, token/cost) and
   the history is persisted and visible.

Everything else (templates, tests, docs, single-command local run) is in service of making
those four things credible and demonstrable. I treated the **grading weights** as the spec:
*working end-to-end demo (40%)* and *architecture/code quality (30%)* dominate, so I optimized
for a demo that genuinely runs and a codebase whose layering an engineer can defend in review.

### The core insight that shaped the design
A "visual workflow builder with conditions and feedback loops" and "a real runtime" are the
*same object* if you pick the runtime well. So I made the diagram the program: the graph a
user draws in the UI **is** the executable graph the runtime runs — no translation layer,
nothing to drift. That single decision (ADR-0005) is what keeps the system honest.

---

## 2. Requirement → how it's satisfied

| Requirement | Approach |
|---|---|
| Agent CRUD + rich config | `Agent` model with 12+ configurable dimensions; full editor in the UI |
| Real runtime executing agent logic | **LangGraph**: each node is a real ReAct agent (`create_react_agent`) running real tools |
| Visual builder w/ conditions + feedback loops | React Flow canvas → compiled 1:1 into a LangGraph `StateGraph`; conditional edges = conditions, back-edges = loops |
| ≥2 workflow templates | *Content Pipeline* (Researcher→Writer→Editor with a `REVISE` feedback loop) and *Support Triage* (conditional routing to Billing/Tech) |
| Async agent-to-agent comms | An in-process **EventBus**: agents emit messages; the engine routes — never direct calls |
| External channel | **Telegram** (long-polling, so no public webhook needed for local-first) |
| Persisted, visible history | One unified `Message` stream (chat / agent / tool / log / error), shown in Monitor + Chat |
| Live monitoring (logs, msgs, token/cost) | WebSocket `/ws/monitor`; cost derived from each model's real `usage_metadata` |
| Runs fully local, one command | `docker compose up --build` (multi-stage image serves UI from the backend) |

---

## 3. Architecture (and why it's shaped this way)

Three layers with a single contract between them — the separation the brief explicitly grades:

- **UI layer** — React SPA + FastAPI routers. The HTTP/WebSocket API is the *only* thing the
  UI knows about the system.
- **Agent runtime** — `app/runtime/` (LangGraph). Knows nothing about HTTP. Compiles stored
  workflow graphs into `StateGraph`s and executes ReAct agents with tools, memory, guardrails,
  and token/cost accounting.
- **Persistence** — SQLModel over SQLite. `DATABASE_URL` is the single switch to Postgres.

```
React UI ──HTTP/WS──> FastAPI ──> Agent Runtime (LangGraph) ──> LLM provider(s)
                          │              │  EventBus (async msgs + live monitor)
                          └──────────────┴──> Persistence (SQLModel / SQLite)
                 Telegram (long-poll) ──> dispatch_inbound ──> same runtime
```

**How a multi-agent task runs:** the workflow's stored graph `{entry, nodes, edges}` compiles
into a LangGraph `StateGraph`. Each node runs an agent as a genuine ReAct loop; each edge
carries a condition (`always` / `contains:X` / `not_contains:X`). A back-edge (e.g. Editor →
Writer while the reply contains `REVISE`) is a real feedback loop, bounded by a per-node visit
cap + a global recursion limit so it always terminates. Every hand-off is persisted *and*
streamed to the monitor through one code path, which is exactly what makes the agent-to-agent
communication both **asynchronous** and **observable**.

---

## 4. Key decisions and trade-offs (full set in `docs/adr/`)

- **Runtime — LangGraph (ADR-0001).** Its node/conditional-edge/cycle model maps 1:1 onto
  "visual builder with conditions and feedback loops," and `create_react_agent` gives a real
  tool-executing loop. CrewAI/AutoGen were weaker on first-class conditional branching; a
  custom runtime meant reinventing routing + recursion safety.
- **Multi-provider LLM, routed by model id (ADR-0008).** Agents can run on **Anthropic Claude**
  *or* **AWS Bedrock** (Amazon Nova / Llama); the provider is derived from the model id so
  there's no provider/model drift. Verified live on both. This directly serves
  "configurability" and lets each agent use the right model for its job.
- **Telegram via long-polling (ADR-0002).** Lowest-friction path to "talk to your agent from
  your phone" with **no public webhook**, so it satisfies the local-first requirement. The
  `Channel` abstraction keeps Slack/WhatsApp a small, isolated addition. (Webhooks are the
  right move once hosted — a documented config switch.)
- **SQLite + SQLModel (ADR-0003).** Zero-setup local persistence; one env var to move to
  Postgres. Single-writer is fine for a single-node demo.
- **In-process EventBus (ADR-0004).** One mechanism serves async agent comms *and* live
  monitoring; history and the live stream are the same data, never out of sync. For multi-node
  scale this becomes Redis pub/sub — a contained change behind the same interface.
- **Guardrails + cost in the runtime (ADR-0007).** Limits (`max_iterations`, recursion cap) and
  guardrails (blocked keywords, per-run cost ceiling) are enforced where execution actually
  happens — the only place that can truly stop a runaway loop or spend.

---

## 5. What I would do next (honest scope boundaries)

- **Scheduler**: agents already store a `schedule_cron`; wiring APScheduler to auto-trigger
  scheduled agents is the natural next step.
- **Horizontal scale**: move the EventBus to Redis pub/sub and runs to a task queue so the API
  and workers scale independently; switch Telegram to webhooks behind a load balancer.
- **Auth & multi-tenancy**: OIDC + per-user scoping for a hosted product (omitted by design for
  a local-first single-user demo).
- **Richer guardrails**: PII filters and per-workflow tool allow-lists on the same hook.

---

## 6. How to evaluate this submission

1. **Run it:** `cp .env.example .env` (add an LLM key — Bedrock or Anthropic), then
   `docker compose up --build` → http://localhost:8000. Seeded with 7 agents + 2 workflows.
2. **See the multi-agent demo:** Workflows → *Content Pipeline* → Run; watch the Monitor as
   Researcher → Writer → Editor loops on `REVISE` then `APPROVED`, with live token/cost.
3. **Talk to an agent:** message the Telegram bot; the conversation appears in the UI.
4. **Read the reasoning:** `README.md` (architecture + setup), `docs/adr/` (decisions),
   `docs/PRD.md` (scope). Critical paths are covered by tests (`backend/tests/`).

The code is structured so a reviewer can open `app/runtime/engine.py` and see the whole
execution model in one file, and `.claude/` skills document exactly how to add a tool, a
channel, or a workflow template.
