# Claude Code configuration for this repo

This project ships with first-class [Claude Code](https://claude.com/claude-code)
support so the codebase is AI-native: a new contributor (human or agent) can
extend it correctly without reverse-engineering conventions.

```
.claude/
├── settings.json          # shared, safe-by-default permissions
├── skills/                # how-to playbooks Claude auto-loads when relevant
│   ├── agent-runtime-map/         — orientation: where everything lives
│   ├── adding-a-tool/             — add a new executable agent tool
│   ├── adding-a-channel/          — add a messaging channel (Slack/WhatsApp/…)
│   └── adding-a-workflow-template/— add a seeded multi-agent workflow
├── agents/                # specialized subagents
│   ├── runtime-engineer.md        — backend / LangGraph runtime work
│   ├── frontend-engineer.md       — React + React Flow UI work
│   └── code-reviewer.md           — pre-merge review (read-only)
└── commands/              # slash commands
    ├── run-demo.md        — boot the full stack locally
    ├── test.md            — run the backend test suite
    ├── new-agent.md       — scaffold/seed a new agent
    ├── new-workflow-template.md — scaffold a new seeded workflow
    └── add-channel.md     — guided new-channel implementation
```

- **Skills** trigger automatically when a task matches their description; they
  encode the project's extension points (tools, channels, templates) so changes
  land in the right files with the right shape.
- **Agents** are role-scoped subagents you can dispatch for focused work.
- **Commands** are quick entry points (`/run-demo`, `/test`, …).

These mirror the README's "Extending the platform" section, but as executable,
discoverable Claude Code primitives.
