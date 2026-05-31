"""Idempotent seed data: a set of agents + two prebuilt workflow templates.

This makes "time from zero to a working multi-agent workflow" effectively zero —
a fresh database boots with runnable examples that exercise every feature:
tools, memory, conditional routing, and a feedback loop.

Templates:
  1. Content Pipeline  — Researcher → Writer → Editor, with a feedback loop
     (Editor routes back to Writer while it replies "REVISE…", ends on "APPROVED").
  2. Support Triage    — Triage agent conditionally routes to Billing or Tech.
"""
from __future__ import annotations

from sqlmodel import select

from ..config import settings
from ..db import session_scope
from ..models import Agent, Workflow


def seed_if_empty() -> None:
    with session_scope() as s:
        if s.exec(select(Agent)).first():
            return  # already seeded
        _seed(s)


def _seed(s) -> None:
    def make_agent(**kw) -> Agent:
        a = Agent(**kw)
        s.add(a)
        s.commit()
        s.refresh(a)
        return a

    # ----- Concierge: the Telegram-facing, tool-using agent with memory ----- #
    concierge = make_agent(
        name="Concierge",
        role="Friendly front-desk assistant",
        system_prompt=(
            "You are Concierge, a helpful assistant reachable over chat. Answer "
            "concisely. Use tools when they help: search the web for facts, do "
            "math with the calculator, and use remember/recall to keep notes "
            "about the user across the conversation."
        ),
        model=settings.default_model,
        tools=["web_search", "calculator", "current_time", "remember", "recall"],
        channels=["telegram", "web"],
        skills=["research", "memory"],
        memory_enabled=True,
        guardrails={"max_cost_usd": 0.25},
    )

    # ----- Content Pipeline agents ----------------------------------------- #
    researcher = make_agent(
        name="Researcher",
        role="Gathers facts",
        system_prompt=(
            "You are a research analyst. Given a topic, use web_search to gather "
            "3-5 concrete, current facts with sources. Output a tight bulleted brief."
        ),
        model=settings.default_model,
        tools=["web_search", "http_get"],
        skills=["research"],
    )
    writer = make_agent(
        name="Writer",
        role="Drafts content",
        system_prompt=(
            "You are a content writer. Using the research brief provided, write a "
            "clear, engaging ~150-word draft. If the editor asks for revisions, "
            "incorporate them and rewrite the full piece."
        ),
        model=settings.default_model,
        skills=["writing"],
    )
    editor = make_agent(
        name="Editor",
        role="Reviews and approves",
        system_prompt=(
            "You are a strict editor. Review the draft for clarity, accuracy and "
            "tone. If it needs work, reply starting with 'REVISE:' followed by "
            "specific, actionable notes. If it is publishable, reply starting with "
            "'APPROVED:' followed by the final text. Be decisive."
        ),
        model=settings.default_model,
        interaction_rules="Always begin your reply with either 'REVISE:' or 'APPROVED:'.",
        skills=["editing"],
    )

    # ----- Support Triage agents ------------------------------------------- #
    triage = make_agent(
        name="Triage",
        role="Routes support requests",
        system_prompt=(
            "You classify an incoming support request. Reply with exactly one "
            "word on the first line: 'BILLING' for payments/invoices/refunds, or "
            "'TECH' for bugs/errors/how-to. Then one sentence summarizing the issue."
        ),
        model=settings.default_model,
        interaction_rules="First line must be exactly BILLING or TECH.",
    )
    billing = make_agent(
        name="BillingAgent",
        role="Handles billing questions",
        system_prompt=(
            "You are a billing specialist. Resolve the customer's payment/invoice/"
            "refund question politely and concretely."
        ),
        model=settings.default_model,
    )
    tech = make_agent(
        name="TechAgent",
        role="Handles technical questions",
        system_prompt=(
            "You are a technical support engineer. Diagnose the issue and give "
            "clear step-by-step guidance."
        ),
        model=settings.default_model,
        tools=["web_search"],
    )

    # ----- Workflow 1: Content Pipeline (with feedback loop) --------------- #
    s.add(Workflow(
        name="Content Pipeline",
        description="Researcher → Writer → Editor with a revision feedback loop.",
        is_template=True,
        graph={
            "entry": "research",
            "nodes": [
                {"id": "research", "agent_id": researcher.id, "label": "Research"},
                {"id": "write", "agent_id": writer.id, "label": "Write"},
                {"id": "edit", "agent_id": editor.id, "label": "Edit"},
            ],
            "edges": [
                {"source": "research", "target": "write", "condition": "always"},
                {"source": "write", "target": "edit", "condition": "always"},
                # Feedback loop: editor sends it back while it says REVISE.
                {"source": "edit", "target": "write", "condition": "contains:REVISE"},
            ],
        },
    ))

    # ----- Workflow 2: Support Triage (conditional routing) ---------------- #
    s.add(Workflow(
        name="Support Triage",
        description="Triage classifies a request and routes it to Billing or Tech.",
        is_template=True,
        graph={
            "entry": "triage",
            "nodes": [
                {"id": "triage", "agent_id": triage.id, "label": "Triage"},
                {"id": "billing", "agent_id": billing.id, "label": "Billing"},
                {"id": "tech", "agent_id": tech.id, "label": "Tech"},
            ],
            "edges": [
                {"source": "triage", "target": "billing", "condition": "contains:BILLING"},
                {"source": "triage", "target": "tech", "condition": "contains:TECH"},
            ],
        },
    ))
    s.commit()
