# 0002 — Telegram (long-polling) as the messaging channel

- Status: Accepted
- Date: 2026-05-31

## Context

At least one agent must be reachable through an external messaging channel
(WhatsApp, Telegram, or Slack) so a human can chat with it. The project must also
run **fully local with a single command** — ideally with no public URL or cloud
dependency.

## Options considered

- **WhatsApp (Cloud API)** — ubiquitous, but requires Meta Business verification,
  a registered phone number, and an inbound **webhook** (public HTTPS URL). Not
  feasible to demo locally in a short window.
- **Slack** — solid API; Socket Mode avoids a public webhook, but still needs a
  workspace, an app manifest, and multiple tokens/scopes.
- **Telegram (long-polling via `getUpdates`)** — a bot token from @BotFather in
  ~2 minutes; **long-polling needs no public URL/webhook** (outbound calls only),
  so it works behind a laptop firewall.

## Decision

Use **Telegram with long-polling**. Lowest-friction path to a real "talk to your
agent from your phone" demo that still runs entirely locally.

## Consequences

- ✅ Zero hosting/webhook needed; ideal for the local-first requirement.
- ✅ Setup is a single env var (`TELEGRAM_BOT_TOKEN`).
- ✅ A `Channel` base class keeps Slack/WhatsApp a small, isolated addition later.
- ⚠️ Long-polling is single-consumer; fine for a demo, not for horizontal scale.
  A hosted multi-instance deployment would switch to webhooks behind a load balancer.
