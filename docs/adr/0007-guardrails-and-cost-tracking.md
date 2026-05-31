# 0007 — Guardrails + token/cost tracking in the runtime

- Status: Accepted
- Date: 2026-05-31

## Context

The brief asks for agent **guardrails** and **limits**, and for **token/cost
tracking** in live monitoring. Agentic loops can run away (cost) or produce
disallowed content (safety), so these must be enforced where execution happens —
in the runtime, not the UI.

## Options considered

- **Enforce in the runtime** — check guardrails right after each agent output and
  compute cost from the provider's `usage_metadata` per call, accumulating onto the
  `Run`. *Cons:* couples policy to the engine (acceptable; it's the right boundary).
- **Enforce in the UI / API only** — easy to bypass; the actual model calls already
  happened, so cost ceilings can't prevent spend.
- **External policy service** — flexible but overkill for this scope and breaks
  local-first.

## Decision

Enforce in the **runtime**. Limits: per-agent `max_iterations` (ReAct loop ceiling)
and a `global_max_steps` recursion limit for workflows. Guardrails: `blocked_keywords`
(output withheld if matched) and `max_cost_usd` (per-run ceiling). Cost: derived from
Anthropic `usage_metadata` against a configurable price table, summed per run and
streamed to the monitor.

## Consequences

- ✅ Safety/limits enforced at the only place that can actually stop execution.
- ✅ Real, per-run token + cost visibility, live in the UI.
- ✅ The price table is config — update it without code changes.
- ⚠️ Cost guardrails are post-call (the triggering call still incurred cost); a
  pre-flight estimate is a possible enhancement. Keyword guardrails are a starting
  point; a richer policy layer (PII, tool allow-lists) can build on the same hook.
