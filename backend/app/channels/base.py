"""Channel abstraction.

A channel bridges an external messaging surface (Telegram today; Slack/WhatsApp
tomorrow) to the agent runtime. To add a channel, implement `start`/`stop`,
turn inbound messages into a Run via `dispatch_inbound`, and send the result
back out. See `telegram.py` for the reference implementation.
"""
from __future__ import annotations

import abc
from typing import Optional

from sqlmodel import select

from ..db import session_scope
from ..models import Agent, MessageType, Run, RunStatus, Workflow
from ..runtime.bus import record_message
from ..runtime.engine import run_agent, run_workflow
from ..runtime.memory import load_channel_history


class Channel(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def start(self) -> None: ...

    @abc.abstractmethod
    async def stop(self) -> None: ...


async def dispatch_inbound(text: str, *, channel: str, session_ref: str, target: str) -> str:
    """Route an inbound human message to a workflow or agent and return the reply.

    `target` is matched first against workflow names, then agent names, then
    falls back to the first agent that lists this channel (or any agent).
    """
    await record_message(
        type=MessageType.chat, sender="human", recipient=target or "agent",
        content=text, channel=channel, meta={"session": session_ref},
    )

    with session_scope() as s:
        workflow = None
        agent = None
        if target:
            workflow = s.exec(select(Workflow).where(Workflow.name == target)).first()
            if not workflow:
                agent = s.exec(select(Agent).where(Agent.name == target)).first()
        if not workflow and not agent:
            agents = s.exec(select(Agent)).all()
            agent = next((a for a in agents if channel in (a.channels or [])), None) or (
                agents[0] if agents else None
            )
        if not workflow and not agent:
            return "No agents are configured yet. Create one in the web UI first."

        run = Run(
            workflow_id=workflow.id if workflow else None,
            agent_id=agent.id if agent else None,
            status=RunStatus.running,
            trigger=channel,
            channel_ref=session_ref,
            input=text,
        )
        s.add(run)
        s.commit()
        s.refresh(run)
        run_id = run.id
        wf_obj = workflow
        agent_obj = agent

    history = load_channel_history(channel, session_ref)
    try:
        if wf_obj:
            reply = await run_workflow(wf_obj, text, run_id)
        else:
            reply, _ = await run_agent(
                agent_obj, text, run_id=run_id, recipient="human",
                channel=channel, history=history,
            )
        _close_run(run_id, RunStatus.completed, reply)
    except Exception as exc:  # noqa: BLE001
        _close_run(run_id, RunStatus.failed, error=str(exc))
        reply = f"Sorry — something went wrong: {exc}"

    await record_message(
        type=MessageType.chat, sender=(wf_obj.name if wf_obj else agent_obj.name),
        recipient="human", content=reply, channel=channel, meta={"session": session_ref},
    )
    return reply


def _close_run(run_id: str, status: RunStatus, output: str = "", error: Optional[str] = None) -> None:
    import datetime as dt

    with session_scope() as s:
        run = s.get(Run, run_id)
        if run:
            run.status = status
            run.output = output
            run.error = error
            run.finished_at = dt.datetime.now(dt.timezone.utc)
            s.add(run)
            s.commit()
