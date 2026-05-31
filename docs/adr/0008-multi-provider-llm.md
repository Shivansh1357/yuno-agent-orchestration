# 0008 — Multi-provider LLM (Anthropic + AWS Bedrock), routed by model id

- Status: Accepted
- Date: 2026-05-31

## Context

Agents should be able to run on different LLM providers — Anthropic's Claude
(best-in-class tool-calling/instruction-following) and AWS Bedrock (cheap, and
the only reachable option in some networks/accounts; Anthropic models on Bedrock
are geo-blocked in our region, but Amazon Nova / Meta Llama are not). The platform
must keep this configurable per agent and justify model choice (a challenge goal),
without a brittle provider/model bookkeeping problem.

## Options considered

- **Single provider (Anthropic only)** — simplest; zero integration risk. But ties
  the platform to one vendor and one set of credentials.
- **Explicit `provider` field the user must keep consistent with `model`** — flexible
  but invites mismatch bugs (provider says anthropic, model is a Nova id).
- **Derive the provider from the model id** — `claude-*` → Anthropic; `us.amazon.*`,
  `us.meta.*`, … → Bedrock. One source of truth; impossible to mismatch.

## Decision

Support **both** providers and **derive the provider from the model id**
(`runtime/llm.py::provider_for_model`). `build_chat_model` returns a `ChatAnthropic`
or a `ChatBedrockConverse` accordingly. Bedrock uses **bearer-token auth**
(`AWS_BEARER_TOKEN_BEDROCK`) — no IAM key. `DEFAULT_MODEL` decides what seeded
agents use, so the same codebase boots on either provider by changing one env var.
A small output cleaner strips `<thinking>`/`<response>` scaffolding that some
Bedrock models (Nova) leak, keeping agent output and routing-keyword matching clean.

## Consequences

- ✅ Agents can mix providers; per-agent model choice in the UI just works.
- ✅ No provider/model drift — the id is authoritative.
- ✅ Verified live: Nova Lite runs the full Content Pipeline (real tools + feedback
  loop) end-to-end for < $0.001; Claude works via the same path.
- ⚠️ Adds `langchain-aws` + `boto3` (pinned to a `langchain-core` 0.3-compatible
  line). Token usage/cost relies on each model id being present in the price table.
- ⚠️ Bearer-token auth is account/region-scoped; rotate via the AWS console if leaked.
