# Architecture Decision Records

Lightweight records of the significant, hard-to-reverse decisions on this project,
in [MADR](https://adr.github.io/madr/)-ish form. Each ADR captures the context, the
options weighed, the decision, and its consequences.

| # | Decision | Status |
|---|---|---|
| [0001](0001-langgraph-runtime.md) | Use LangGraph as the agent runtime | Accepted |
| [0002](0002-telegram-long-polling-channel.md) | Telegram (long-polling) as the messaging channel | Accepted |
| [0003](0003-sqlite-sqlmodel-persistence.md) | SQLite + SQLModel for persistence | Accepted |
| [0004](0004-inprocess-eventbus.md) | In-process EventBus for async messaging + live monitoring | Accepted |
| [0005](0005-graph-as-data.md) | Store workflows as data; compile to StateGraph at runtime | Accepted |
| [0006](0006-fastapi-react-single-origin.md) | FastAPI + React served single-origin | Accepted |
| [0007](0007-guardrails-and-cost-tracking.md) | Guardrails + token/cost tracking in the runtime | Accepted |

## Template

```markdown
# NNNN — Title

- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: YYYY-MM-DD

## Context
What forces are at play? What problem are we solving?

## Options considered
- Option A — pros / cons
- Option B — pros / cons

## Decision
What we chose and why.

## Consequences
Positive, negative, and follow-ups created by this decision.
```
