# 0003 — SQLite + SQLModel for persistence

- Status: Accepted
- Date: 2026-05-31

## Context

We need a persistence layer for agents, workflows, runs, message history, and
memory. Two constraints dominate: **runs fully local with a single command** (no
external DB server to install), and a **clean data layer** separated from UI and
runtime. Message history must survive restarts and be queryable by the UI.

## Options considered

- **SQLite + SQLModel** — file-based, zero-setup, ships with Python; SQLModel gives
  Pydantic-typed models that double as the API's source of truth. *Cons:* single
  writer; not for high concurrency.
- **Postgres** — production-grade, concurrent. *Cons:* requires a running server
  (or a second compose service), heavier for a local demo.
- **In-memory / JSON files** — trivial, but loses the "persisted + queryable"
  guarantee and invites bespoke serialization bugs.

## Decision

Use **SQLite via SQLModel**. The whole stack boots from one image with no DB server.
`DATABASE_URL` is the single switch to move to Postgres with no model changes.

## Consequences

- ✅ True zero-setup local persistence; data file mounted as a Docker volume.
- ✅ One typed model layer (`models.py`) backs both ORM and API schemas.
- ✅ Trivial migration path to Postgres (swap `DATABASE_URL`).
- ⚠️ Single-writer concurrency; DB writes are pushed off the event loop via
  `asyncio.to_thread` to avoid blocking. For multi-instance scale, move to Postgres.
