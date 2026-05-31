# 0004 — In-process EventBus for async messaging + live monitoring

- Status: Accepted
- Date: 2026-05-31

## Context

Two requirements share a mechanism: **agents must communicate asynchronously**, and
the UI needs **live monitoring** (logs, inter-agent messages, token/cost) in real
time. We want agents decoupled from each other and from the transport that shows
their activity.

## Options considered

- **In-process async EventBus** (asyncio queues) + DB persistence — every runtime
  event is recorded *and* fanned out to subscribers (the `/ws/monitor` WebSocket).
  *Cons:* single-process only.
- **Redis pub/sub** — works across processes/instances. *Cons:* adds an external
  service, breaking the single-command local-first goal.
- **Direct agent-to-agent calls** — simplest to write, but couples agents tightly
  and makes "asynchronous" communication and observability awkward.

## Decision

Use an **in-process EventBus**. Agents never call each other directly; they emit
messages onto the bus and into the DB, and the workflow engine routes the next
agent. `record_message` persists then publishes, so history and the live stream
stay consistent from one code path.

## Consequences

- ✅ Async, decoupled agent communication with one source of truth for events.
- ✅ Live monitor and persisted history are the same data, never out of sync.
- ✅ Slow WebSocket consumers degrade gracefully (oldest event dropped, stays live).
- ⚠️ Single-process scope. The bus is deliberately a thin interface so swapping in
  Redis pub/sub for multi-instance deployment is a contained change.
