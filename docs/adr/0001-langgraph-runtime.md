# 0001 — Use LangGraph as the agent runtime

- Status: Accepted
- Date: 2026-05-31

## Context

The brief requires a **real runtime** that executes agent logic (not a UI mockup),
plus a **visual workflow builder with conditions and feedback loops**, plus
**multi-agent collaboration**. We need a runtime whose execution model matches the
thing the user draws on screen, and whose agent nodes can run real tool-using
loops.

## Options considered

- **LangGraph** — graph of nodes with conditional edges and cycles; prebuilt
  `create_react_agent` for tool-executing ReAct agents; built-in recursion limits.
  *Cons:* extra dependency; some API churn across versions.
- **CrewAI** — fast to assemble multi-agent "crews"; great ergonomics for linear
  or hierarchical collaboration. *Cons:* conditional branching and explicit
  feedback loops are less first-class than a graph model.
- **AutoGen** — strong conversational multi-agent patterns. *Cons:* the
  conversation-centric model maps less cleanly onto a node/edge visual builder.
- **Custom runtime** — total control, no dependency. *Cons:* we'd reimplement
  routing, cycle handling, recursion safety, and tool loops — time we don't have.

## Decision

Use **LangGraph**. The UI graph (`{nodes, edges, entry}`) compiles **1:1** into a
`StateGraph`: nodes → agents, edges → conditional edges, back-edges → feedback
loops. Agent nodes use `create_react_agent`, a genuine tool-executing loop, so the
runtime *actually* runs agent logic. This gives the smallest gap between "what the
user designed" and "what executes."

## Consequences

- ✅ The workflow picture is the executable program — no translation layer.
- ✅ Conditional routing + cycles + recursion bounding come for free.
- ✅ ReAct agents execute real tools per node.
- ⚠️ We pin LangGraph/LangChain versions to insulate against API churn.
- ⚠️ A node failure drops that item; we wrap runs and surface errors to the monitor.
