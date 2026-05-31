---
description: Run the backend test suite (critical paths) and summarize results.
allowed-tools: Bash(cd:*), Bash(.venv/bin/python:*), Bash(.venv/bin/pytest:*)
---

Run the backend tests and summarize:

1. `cd backend && .venv/bin/python -m pytest -q` (create the venv + install
   `requirements.txt` first if `.venv` is missing).
2. Report pass/fail counts. If anything fails, show the failing test names and the
   key assertion/error, and propose a minimal fix — do not change tests just to make
   them pass.

The suite covers agent CRUD, workflow execution (conditional routing + feedback
loop), and message delivery, and runs offline (the LLM is mocked).
