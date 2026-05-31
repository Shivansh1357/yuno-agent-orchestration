"""Run + chat endpoints — trigger executions of agents/workflows."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import Agent, Run, RunStatus, Workflow
from ..runtime.engine import execute_run, run_agent
from ..runtime.memory import load_channel_history
from ..runtime.bus import record_message
from ..models import MessageType
from ..schemas import ChatRequest, RunRead

router = APIRouter(prefix="/api", tags=["runs"])


@router.get("/runs", response_model=list[RunRead])
def list_runs(session: Session = Depends(get_session)):
    return session.exec(select(Run).order_by(Run.started_at.desc())).all()


@router.get("/runs/{run_id}", response_model=RunRead)
def get_run(run_id: str, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    return run


@router.post("/runs", response_model=RunRead, status_code=201)
async def create_run(payload: dict, session: Session = Depends(get_session)):
    """Start a workflow or single-agent run. Executes asynchronously."""
    workflow_id = payload.get("workflow_id")
    agent_id = payload.get("agent_id")
    text = payload.get("input", "")
    if not text or not text.strip():
        raise HTTPException(400, "input must not be empty")
    if not workflow_id and not agent_id:
        raise HTTPException(400, "provide workflow_id or agent_id")
    if workflow_id and not session.get(Workflow, workflow_id):
        raise HTTPException(404, "workflow not found")
    if agent_id and not session.get(Agent, agent_id):
        raise HTTPException(404, "agent not found")

    run = Run(
        workflow_id=workflow_id, agent_id=agent_id, input=text,
        trigger=payload.get("trigger", "manual"), status=RunStatus.pending,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    asyncio.create_task(execute_run(run.id))  # fire-and-forget; watch via /ws/monitor
    return run


@router.post("/chat")
async def chat(payload: ChatRequest, session: Session = Depends(get_session)):
    """Synchronous web chat with a single agent (returns the reply directly)."""
    if not payload.agent_id:
        raise HTTPException(400, "agent_id is required for web chat")
    if not payload.text or not payload.text.strip():
        raise HTTPException(400, "message text must not be empty")
    agent = session.get(Agent, payload.agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")

    await record_message(
        type=MessageType.chat, sender="human", recipient=agent.name,
        content=payload.text, channel="web", meta={"session": payload.session_ref},
    )
    history = load_channel_history("web", payload.session_ref)
    reply, usage = await run_agent(
        agent, payload.text, recipient="human", channel="web", history=history,
    )
    await record_message(
        type=MessageType.chat, sender=agent.name, recipient="human",
        content=reply, channel="web", meta={"session": payload.session_ref},
        input_tokens=usage.input_tokens, output_tokens=usage.output_tokens,
        cost_usd=usage.cost_usd,
    )
    return {"reply": reply, "cost_usd": usage.cost_usd,
            "input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens}
