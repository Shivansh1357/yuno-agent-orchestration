# 0005 — Store workflows as data; compile to StateGraph at runtime

- Status: Accepted
- Date: 2026-05-31

## Context

The visual builder lets users design workflows with conditions and feedback loops.
We must decide how a designed workflow is represented and how it becomes executable.

## Options considered

- **Graph-as-data** — persist a JSON graph (`{entry, nodes, edges}`, edges carry a
  `condition`) and compile it into a LangGraph `StateGraph` at run time. *Cons:* a
  compile step; conditions need a small, safe grammar.
- **Graph-as-code** — generate/store Python that builds the graph. *Cons:*
  executing stored code is a security and maintenance hazard; hard to edit in a UI.
- **Hard-coded workflows** — fastest, but fails the "visual builder" requirement and
  isn't user-configurable.

## Decision

Use **graph-as-data**. The exact JSON the UI saves is what the runtime compiles, so
the diagram *is* the program. Edge conditions use a tiny safe grammar
(`always`, `contains:X`, `not_contains:X`) evaluated against the previous output;
back-edges form feedback loops, bounded by a per-node visit cap + global recursion
limit.

## Consequences

- ✅ One representation shared by UI, storage, validation, and execution.
- ✅ Workflows are fully user-editable and inspectable; no code execution risk.
- ✅ New condition operators are an additive change in one function (`_eval_condition`).
- ⚠️ The condition grammar is intentionally limited; richer (LLM-judged) routing is a
  future extension behind the same edge interface.
