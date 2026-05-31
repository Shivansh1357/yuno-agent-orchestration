---
name: adding-a-tool
description: Use when adding a new executable tool that agents can call (e.g. a new API call, calculation, data lookup, or side-effecting action) to the Yuno agent runtime.
---

# Adding a new agent tool

Tools live in `backend/app/runtime/tools.py` and are exposed as LangChain tools so
`create_react_agent` can bind and execute them.

## Steps

1. **Write the function** and wrap it with `@tool`. The docstring is the tool's
   description the model sees — make it crisp and action-oriented. Type-annotate args.

   ```python
   @tool
   def weather(city: str) -> str:
       """Return the current weather for a city."""
       # ...real HTTP call...
       return summary
   ```

2. **Register it** in `TOOL_REGISTRY` (stateless tools):

   ```python
   TOOL_REGISTRY = { ..., "weather": weather }
   ```

   If the tool needs per-agent context (like memory), add it inside
   `_build_memory_tools(agent_id)` and list its name in `AGENT_SCOPED_TOOLS` instead.

3. **Done — no UI change needed.** `AVAILABLE_TOOLS` is derived from the registry and
   surfaced via `GET /api/meta`, so the new tool appears automatically in the agent
   editor's tool picker.

4. **Verify**: assign the tool to an agent and run it; tool calls show up live in the
   Monitor tab (recorded as `tool` messages by the engine).

## Conventions
- Return a **string** (the model reads it as the observation).
- Catch exceptions and return a readable `"<tool> error: …"` string — never raise.
- Keep network calls bounded (timeouts, truncate large responses) as `http_get` does.
- Prefer pure, side-effect-light tools; anything destructive should be obvious by name.
