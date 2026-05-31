---
name: adding-a-workflow-template
description: Use when creating a new prebuilt multi-agent workflow template (a seeded graph of agents with conditions and/or feedback loops) for the Yuno platform.
---

# Adding a workflow template

Templates are seeded in `backend/app/templates/seed.py`. A workflow is stored as a
graph that the runtime compiles into a LangGraph `StateGraph` (see ADR-0005).

## Graph shape

```python
graph = {
    "entry": "<node id>",                       # where execution starts
    "nodes": [
        {"id": "research", "agent_id": <id>, "label": "Research"},
        {"id": "write",    "agent_id": <id>, "label": "Write"},
        {"id": "edit",     "agent_id": <id>, "label": "Edit"},
    ],
    "edges": [
        {"source": "research", "target": "write", "condition": "always"},
        {"source": "write",    "target": "edit",  "condition": "always"},
        # Feedback loop: back-edge taken while the condition matches.
        {"source": "edit",     "target": "write", "condition": "contains:REVISE"},
    ],
}
```

## Condition grammar (`_eval_condition` in engine.py)
- `always` / empty — unconditional.
- `contains:WORD` — previous agent output contains WORD (case-insensitive).
- `not_contains:WORD` — previous output does not contain WORD.

A node with **no matching outgoing edge** ends that branch. A **back-edge** is a
feedback loop; it's bounded by a per-node visit cap (default 4) and the global
recursion limit, so it always terminates.

## Steps
1. Create (or reuse) the agents the workflow needs via `make_agent(...)` in `_seed`.
   Give routing agents clear `interaction_rules` so their output matches your edge
   conditions (e.g. "begin your reply with REVISE: or APPROVED:").
2. Add a `Workflow(name=..., description=..., is_template=True, graph=...)`.
3. (Templates only seed into an **empty** DB.) To re-seed during dev:
   `rm backend/data/*.db` then restart, or build the workflow live in the UI.

## Tip
Design the routing agent's output and the edge conditions **together** — the
condition keyword must reliably appear in that agent's output. Then verify the path
in the Monitor tab.
