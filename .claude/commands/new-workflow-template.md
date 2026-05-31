---
description: Design and seed a new multi-agent workflow template (with conditions/feedback loops).
argument-hint: [workflow goal, e.g. "lead qualification: classify → enrich → draft reply"]
allowed-tools: Read, Edit, Grep, Glob
---

Design a new workflow template for: **$ARGUMENTS**

1. Load the `adding-a-workflow-template` skill and ADR-0005 for the graph shape and
   condition grammar (`always`, `contains:X`, `not_contains:X`; back-edges = feedback
   loops, bounded by visit cap + recursion limit).
2. Sketch the agent nodes and the edges (including any conditional routing or feedback
   loop). For routing nodes, define `interaction_rules` so the agent's output reliably
   contains the keyword your edge condition checks.
3. Implement it in `backend/app/templates/seed.py`: add the needed `make_agent(...)`
   calls, then a `Workflow(name, description, is_template=True, graph={...})`.
4. Remind me that templates seed only into an empty DB — to see it locally, either
   `rm backend/data/*.db` and restart, or rebuild the equivalent graph in the UI.
5. Suggest a one-line demo input that exercises every branch/loop.

Show the final `graph` JSON and explain the path the demo input will take.
