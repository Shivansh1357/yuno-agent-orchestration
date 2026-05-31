"""Tests for the critical paths called out in the challenge:
agent creation, workflow execution (incl. conditional routing + feedback loop),
and message delivery (persistence + live bus fan-out)."""
from __future__ import annotations

import pytest


# --------------------------------------------------------------------------- #
# 1. Agent creation (CRUD)
# --------------------------------------------------------------------------- #
def test_agent_crud(client):
    payload = {
        "name": "TestBot",
        "role": "tester",
        "system_prompt": "You test things.",
        "tools": ["calculator", "remember"],
        "channels": ["web"],
        "guardrails": {"max_cost_usd": 0.1},
    }
    r = client.post("/api/agents", json=payload)
    assert r.status_code == 201, r.text
    agent = r.json()
    assert agent["name"] == "TestBot"
    assert agent["tools"] == ["calculator", "remember"]
    aid = agent["id"]

    assert client.get(f"/api/agents/{aid}").json()["role"] == "tester"

    r = client.patch(f"/api/agents/{aid}", json={"temperature": 0.2})
    assert r.json()["temperature"] == 0.2

    assert any(a["id"] == aid for a in client.get("/api/agents").json())

    assert client.delete(f"/api/agents/{aid}").status_code == 204
    assert client.get(f"/api/agents/{aid}").status_code == 404


def test_meta_lists_tools_and_models(client):
    meta = client.get("/api/meta").json()
    assert "calculator" in meta["tools"]
    assert "remember" in meta["tools"]
    assert meta["default_model"] in meta["models"]
    # multi-provider surface
    assert "anthropic_enabled" in meta and "bedrock_enabled" in meta
    assert any(m.startswith("us.amazon.nova") for m in meta["models"])


def test_provider_routing_by_model_id():
    from app.runtime.llm import provider_for_model

    assert provider_for_model("claude-haiku-4-5-20251001") == "anthropic"
    assert provider_for_model("us.amazon.nova-lite-v1:0") == "bedrock"
    assert provider_for_model("us.meta.llama3-3-70b-instruct-v1:0") == "bedrock"


def test_output_cleaner_strips_model_scaffolding():
    from app.runtime.engine import _clean_output

    assert _clean_output("<response>441 is the answer.</response>") == "441 is the answer."
    assert _clean_output("<thinking>compute…</thinking>APPROVED: ship") == "APPROVED: ship"


# --------------------------------------------------------------------------- #
# 2. Workflow execution — conditions + feedback loop (LLM mocked)
# --------------------------------------------------------------------------- #
def test_edge_condition_evaluation():
    from app.runtime.engine import _eval_condition

    assert _eval_condition("always", "anything") is True
    assert _eval_condition("", "anything") is True
    assert _eval_condition("contains:REVISE", "REVISE: fix the intro") is True
    assert _eval_condition("contains:REVISE", "APPROVED: ship it") is False
    assert _eval_condition("not_contains:REVISE", "APPROVED: ship it") is True


@pytest.mark.asyncio
async def test_workflow_feedback_loop(monkeypatch):
    """Editor returns REVISE once (loop back to Writer), then APPROVED (end).

    Verifies conditional routing AND the feedback-loop edge actually re-enter
    a prior node, without calling any LLM.
    """
    from app.db import session_scope
    from app.models import Agent, Run, RunStatus, Workflow
    from app.runtime import engine

    with session_scope() as s:
        w = Agent(name="W", system_prompt="writer")
        e = Agent(name="E", system_prompt="editor")
        s.add(w); s.add(e); s.commit(); s.refresh(w); s.refresh(e)
        wf = Workflow(
            name="Loop", graph={
                "entry": "write",
                "nodes": [
                    {"id": "write", "agent_id": w.id},
                    {"id": "edit", "agent_id": e.id},
                ],
                "edges": [
                    {"source": "write", "target": "edit", "condition": "always"},
                    {"source": "edit", "target": "write", "condition": "contains:REVISE"},
                ],
            },
        )
        run = Run(workflow_id=wf.id, status=RunStatus.running, input="write a poem")
        s.add(wf); s.add(run); s.commit(); s.refresh(wf); s.refresh(run)
        wf_id, run_id, editor_id = wf.id, run.id, e.id

    calls = {"edit": 0, "write": 0}

    async def fake_run_agent(agent, task, **kw):
        from app.runtime.llm import Usage
        if agent.id == editor_id:
            calls["edit"] += 1
            out = "REVISE: tighten it" if calls["edit"] == 1 else "APPROVED: final poem"
        else:
            calls["write"] += 1
            out = f"draft v{calls['write']}"
        return out, Usage(input_tokens=5, output_tokens=5, cost_usd=0.0001)

    monkeypatch.setattr(engine, "run_agent", fake_run_agent)

    with session_scope() as s:
        wf = s.get(Workflow, wf_id)
    output = await engine.run_workflow(wf, "write a poem", run_id)

    assert calls["write"] == 2, "writer should run twice (initial + after REVISE)"
    assert calls["edit"] == 2, "editor should run twice (REVISE then APPROVED)"
    assert "APPROVED" in output


@pytest.mark.asyncio
async def test_workflow_conditional_branch(monkeypatch):
    """Triage routes to the TECH branch based on its output keyword."""
    from app.db import session_scope
    from app.models import Agent, Workflow
    from app.runtime import engine

    with session_scope() as s:
        t = Agent(name="T", system_prompt="triage")
        b = Agent(name="B", system_prompt="billing")
        k = Agent(name="K", system_prompt="tech")
        for a in (t, b, k):
            s.add(a)
        s.commit()
        for a in (t, b, k):
            s.refresh(a)
        wf = Workflow(name="Route", graph={
            "entry": "triage",
            "nodes": [
                {"id": "triage", "agent_id": t.id},
                {"id": "billing", "agent_id": b.id},
                {"id": "tech", "agent_id": k.id},
            ],
            "edges": [
                {"source": "triage", "target": "billing", "condition": "contains:BILLING"},
                {"source": "triage", "target": "tech", "condition": "contains:TECH"},
            ],
        })
        s.add(wf); s.commit(); s.refresh(wf)
        wf_id, triage_id, tech_id = wf.id, t.id, k.id

    visited = []

    async def fake_run_agent(agent, task, **kw):
        from app.runtime.llm import Usage
        visited.append(agent.id)
        out = "TECH: app crashes" if agent.id == triage_id else "Here is the fix."
        return out, Usage()

    monkeypatch.setattr(engine, "run_agent", fake_run_agent)
    with session_scope() as s:
        wf = s.get(Workflow, wf_id)
    await engine.run_workflow(wf, "my app crashes", wf_id)

    assert triage_id in visited and tech_id in visited
    assert len(visited) == 2  # triage -> tech only, billing skipped


# --------------------------------------------------------------------------- #
# 3. Message delivery — persistence + live bus fan-out
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_dispatch_inbound_survives_commit(monkeypatch):
    """Regression: committing the Run must not detach the agent used afterwards.

    Reproduces the Telegram-path DetachedInstanceError — dispatch_inbound loads an
    agent, commits a Run (which expires ORM objects unless expire_on_commit=False),
    then hands the agent to the runtime, which reads its attributes.
    """
    from app.channels import base
    from app.db import session_scope
    from app.models import Agent
    from app.runtime.llm import Usage

    with session_scope() as s:
        s.add(Agent(name="TgBot", system_prompt="hi", channels=["telegram"]))
        s.commit()

    async def fake_run_agent(agent, task, **kw):
        # Exactly the access pattern that raised DetachedInstanceError.
        _ = (agent.name, agent.system_prompt, agent.tools, agent.model)
        return f"echo:{task}", Usage()

    monkeypatch.setattr(base, "run_agent", fake_run_agent)
    reply = await base.dispatch_inbound(
        "ping", channel="telegram", session_ref="t1", target="TgBot"
    )
    assert reply == "echo:ping"


@pytest.mark.asyncio
async def test_message_delivery_persists_and_broadcasts():
    from app.db import session_scope
    from app.models import Message, MessageType
    from app.runtime.bus import bus, record_message
    from sqlmodel import select

    q = bus.subscribe()
    msg = await record_message(
        type=MessageType.agent_message, sender="A", recipient="B",
        content="hello B", input_tokens=10, output_tokens=20, cost_usd=0.001,
    )
    # broadcast
    event = await q.get()
    assert event["kind"] == "message"
    assert event["content"] == "hello B"
    assert event["sender"] == "A"
    bus.unsubscribe(q)

    # persisted
    with session_scope() as s:
        row = s.get(Message, msg.id)
        assert row is not None
        assert row.recipient == "B"
        assert row.output_tokens == 20
