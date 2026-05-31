# 0006 — FastAPI + React served single-origin

- Status: Accepted
- Date: 2026-05-31

## Context

We need a web UI, an HTTP API, a WebSocket for live monitoring, background run
execution, and async LLM + channel I/O — all runnable with one command. We also
want clean separation between the UI layer and the runtime.

## Options considered

- **FastAPI (backend) + React/Vite (frontend), served single-origin** — FastAPI is
  async-native (WebSockets, background tasks, async LLM calls in one model); React +
  React Flow is the natural fit for the visual builder. In production the built SPA
  is served by FastAPI as static files, so there's one origin and no CORS/port juggling.
- **Next.js full-stack (TS everywhere)** — one language; but the agent runtime
  (LangGraph) and its ecosystem are strongest in Python, which is the heart of this app.
- **Two always-separate servers** — fine in dev, but a clunkier "single command" and
  CORS overhead in production.

## Decision

**FastAPI + React, single-origin in production.** A multi-stage Dockerfile builds the
React app and copies `dist/` into `backend/static`, which FastAPI serves; the API and
WebSocket live under the same origin. In dev, Vite runs on `:5173` and proxies
`/api` + `/ws` to `:8000` for hot reload.

## Consequences

- ✅ Python where the agent runtime is strongest; React where the UI is strongest.
- ✅ One container, one port, one command in production; no CORS in prod.
- ✅ Dev keeps fast hot-reload via the Vite proxy.
- ⚠️ Two toolchains (pip + npm). The Dockerfile and Makefile encapsulate both.
