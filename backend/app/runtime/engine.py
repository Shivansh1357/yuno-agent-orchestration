"""The agent runtime — built on LangGraph.

Why LangGraph: the challenge asks for a *visual workflow builder with conditions
and feedback loops* running on a *real runtime*. LangGraph's `StateGraph` maps
1:1 onto that — nodes are agents, conditional edges are the "conditions", and
cycles are the "feedback loops" (e.g. a reviewer routing work back to a writer).
Each agent node is a real ReAct agent (`create_react_agent`) that executes real
tools in a loop. Nothing here is mocked: agents call the Anthropic API, run
tools, and hand structured state to the next node.

Execution model:
* `run_agent`  — the atomic unit: one agent answers a task, with memory, tools,
  guardrails, and token/cost accounting. Used by single-agent runs, every
  workflow node, and the Telegram channel.
* `run_workflow` — compiles a stored graph into a `StateGraph` and streams it,
  persisting every hand-off and emitting live monitor events.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import re
from collections import defaultdict
from typing import Any, Optional, TypedDict

from sqlmodel import select

from ..config import settings
from ..db import session_scope
from ..models import Agent, Message, MessageType, Run, RunStatus, Workflow
from .bus import bus, record_message
from .llm import Usage, build_chat_model, usage_from_response
from .memory import load_channel_history, memory_summary
from .tools import build_agent_tools


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _compose_system_prompt(agent: Agent) -> str:
    parts = [agent.system_prompt or f"You are {agent.name}, a helpful agent."]
    if agent.role:
        parts.append(f"Your role: {agent.role}.")
    if agent.interaction_rules:
        parts.append(f"Interaction rules you must follow:\n{agent.interaction_rules}")
    guard = agent.guardrails or {}
    if guard.get("blocked_keywords"):
        parts.append(
            "Never produce content containing: " + ", ".join(guard["blocked_keywords"]) + "."
        )
    if agent.memory_enabled:
        mem = memory_summary(agent.id)
        if mem:
            parts.append(mem)
    return "\n\n".join(parts)


def _check_guardrails(agent: Agent, output: str, usage: Usage) -> Optional[str]:
    """Return a violation string if a guardrail tripped, else None."""
    guard = agent.guardrails or {}
    for kw in guard.get("blocked_keywords", []):
        if kw.lower() in output.lower():
            return f"blocked keyword '{kw}' in output"
    max_cost = guard.get("max_cost_usd")
    if max_cost is not None and usage.cost_usd > float(max_cost):
        return f"cost ${usage.cost_usd:.4f} exceeded guardrail ${float(max_cost):.4f}"
    return None


_THINKING_RE = re.compile(r"<thinking>.*?</thinking>", re.DOTALL | re.IGNORECASE)
# Unwrap <response>…</response> (keep the inner text) and drop any stray tags —
# some Bedrock models (e.g. Nova) wrap their final answer in these.
_RESPONSE_RE = re.compile(r"</?response>", re.IGNORECASE)


def _clean_output(text: str) -> str:
    """Strip reasoning/answer scaffolding some models leak into final output."""
    if not isinstance(text, str):
        return text
    text = _THINKING_RE.sub("", text)
    text = _RESPONSE_RE.sub("", text)
    return text.strip()


def _get_agent(session, agent_id: str) -> Agent:
    agent = session.get(Agent, agent_id)
    if not agent:
        raise ValueError(f"agent {agent_id} not found")
    return agent


def _sum_usage_from_messages(model: str, messages: list) -> Usage:
    total = Usage()
    for m in messages:
        um = getattr(m, "usage_metadata", None)
        if um:
            total.add(usage_from_response(model, um))
    return total


# --------------------------------------------------------------------------- #
# Atomic unit: run a single agent on a task
# --------------------------------------------------------------------------- #
async def run_agent(
    agent: Agent,
    task: str,
    *,
    run_id: Optional[str] = None,
    recipient: str = "human",
    channel: Optional[str] = None,
    history: Optional[list[tuple[str, str]]] = None,
) -> tuple[str, Usage]:
    """Execute one agent and return (output_text, usage). Records all activity."""
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

    await record_message(
        type=MessageType.log,
        sender="runtime",
        recipient=agent.name,
        content=f"▶ {agent.name} starting (model={agent.model}, tools={agent.tools or '—'})",
        run_id=run_id,
        meta={"agent_id": agent.id},
    )

    system_prompt = _compose_system_prompt(agent)
    tools = build_agent_tools(agent.id, agent.tools or [])
    model = build_chat_model(agent.model, agent.temperature, agent.max_tokens)

    # Build the message list (history gives channel conversations continuity).
    msgs: list = [SystemMessage(content=system_prompt)]
    for role, content in history or []:
        msgs.append(HumanMessage(content=content) if role == "human" else AIMessage(content=content))
    msgs.append(HumanMessage(content=task))

    if tools:
        from langgraph.prebuilt import create_react_agent

        react = create_react_agent(model, tools)
        result = await react.ainvoke(
            {"messages": msgs},
            config={"recursion_limit": max(4, agent.max_iterations * 2)},
        )
        out_messages = result["messages"]
        output = out_messages[-1].content if out_messages else ""
        usage = _sum_usage_from_messages(agent.model, out_messages)

        # Surface real tool calls to the monitor + history.
        for m in out_messages:
            for tc in getattr(m, "tool_calls", []) or []:
                await record_message(
                    type=MessageType.tool_call,
                    sender=agent.name,
                    recipient="tool",
                    content=f"{tc.get('name')}({tc.get('args')})",
                    run_id=run_id,
                    meta={"tool": tc.get("name"), "args": tc.get("args")},
                )
            if isinstance(m, ToolMessage):
                await record_message(
                    type=MessageType.tool_call,
                    sender="tool",
                    recipient=agent.name,
                    content=str(m.content)[:1500],
                    run_id=run_id,
                    meta={"tool": getattr(m, "name", None), "result": True},
                )
    else:
        resp = await model.ainvoke(msgs)
        output = resp.content if isinstance(resp.content, str) else str(resp.content)
        usage = usage_from_response(agent.model, getattr(resp, "usage_metadata", None))

    if isinstance(output, list):  # some providers return content blocks
        output = "".join(b.get("text", "") for b in output if isinstance(b, dict))
    output = _clean_output(output)

    violation = _check_guardrails(agent, output, usage)
    if violation:
        output = f"[guardrail] Response withheld: {violation}."
        await record_message(
            type=MessageType.error,
            sender="runtime",
            recipient=agent.name,
            content=f"Guardrail tripped for {agent.name}: {violation}",
            run_id=run_id,
        )

    await record_message(
        type=MessageType.agent_message,
        sender=agent.name,
        recipient=recipient,
        content=output,
        run_id=run_id,
        channel=channel,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cost_usd=usage.cost_usd,
        meta={"agent_id": agent.id},
    )
    if run_id:
        await asyncio.to_thread(_accumulate_run_usage, run_id, usage)
    return output, usage


def _accumulate_run_usage(run_id: str, usage: Usage) -> None:
    with session_scope() as s:
        run = s.get(Run, run_id)
        if not run:
            return
        run.total_input_tokens += usage.input_tokens
        run.total_output_tokens += usage.output_tokens
        run.total_cost_usd += usage.cost_usd
        s.add(run)
        s.commit()


# --------------------------------------------------------------------------- #
# Workflow execution — compile the stored graph into a LangGraph StateGraph
# --------------------------------------------------------------------------- #
class WFState(TypedDict, total=False):
    task: str
    last_output: str
    outputs: dict[str, str]
    run_id: str
    visits: dict[str, int]


def _eval_condition(condition: str | None, last_output: str) -> bool:
    """Evaluate a simple, safe edge condition against the previous output.

    Supported forms (case-insensitive):
      ""/"always"          -> always true
      "contains:TEXT"      -> TEXT appears in last_output
      "not_contains:TEXT"  -> TEXT does not appear in last_output
    """
    if not condition or condition.strip().lower() == "always":
        return True
    low = last_output.lower()
    if condition.startswith("contains:"):
        return condition[len("contains:"):].strip().lower() in low
    if condition.startswith("not_contains:"):
        return condition[len("not_contains:"):].strip().lower() not in low
    # Unknown condition syntax: treat as a literal substring match.
    return condition.strip().lower() in low


def _make_node_runner(node: dict[str, Any]):
    agent_id = node["agent_id"]
    node_id = node["id"]

    async def _runner(state: WFState) -> dict[str, Any]:
        with session_scope() as s:
            agent = _get_agent(s, agent_id)
        # Compose the task: original task + the most recent hand-off output.
        upstream = state.get("last_output", "")
        task = state["task"] if not upstream else (
            f"Original task: {state['task']}\n\nPrevious agent output:\n{upstream}\n\n"
            "Continue the workflow based on the above."
        )
        output, _ = await run_agent(
            agent, task, run_id=state.get("run_id"), recipient="next-agent"
        )
        outputs = dict(state.get("outputs", {}))
        outputs[node_id] = output
        visits = dict(state.get("visits", {}))
        visits[node_id] = visits.get(node_id, 0) + 1
        return {"last_output": output, "outputs": outputs, "visits": visits}

    return _runner


def _make_router(out_edges: list[dict[str, Any]], node_id: str, max_visits: int = 4):
    def _router(state: WFState) -> str:
        # Feedback-loop safety: stop revisiting a node past max_visits.
        visits = state.get("visits", {})
        last = state.get("last_output", "")
        for e in out_edges:
            target = e["target"]
            if visits.get(target, 0) >= max_visits:
                continue
            if _eval_condition(e.get("condition"), last):
                return target
        return "__end__"

    return _router


def build_workflow_graph(workflow: Workflow):
    from langgraph.graph import END, StateGraph

    graph = workflow.graph or {}
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    if not nodes:
        raise ValueError("workflow has no nodes")
    entry = graph.get("entry") or nodes[0]["id"]

    sg = StateGraph(WFState)
    for node in nodes:
        sg.add_node(node["id"], _make_node_runner(node))
    sg.set_entry_point(entry)

    by_source: dict[str, list] = defaultdict(list)
    for e in edges:
        by_source[e["source"]].append(e)

    for node in nodes:
        nid = node["id"]
        outs = by_source.get(nid, [])
        if not outs:
            sg.add_edge(nid, END)
        else:
            mapping = {e["target"]: e["target"] for e in outs}
            mapping["__end__"] = END
            sg.add_conditional_edges(nid, _make_router(outs, nid), mapping)

    return sg.compile()


async def run_workflow(workflow: Workflow, task: str, run_id: str) -> str:
    compiled = build_workflow_graph(workflow)
    await record_message(
        type=MessageType.log,
        sender="runtime",
        recipient="system",
        content=f"▶ Workflow '{workflow.name}' started",
        run_id=run_id,
        meta={"workflow_id": workflow.id},
    )
    final_state = await compiled.ainvoke(
        {"task": task, "last_output": "", "outputs": {}, "run_id": run_id, "visits": {}},
        config={"recursion_limit": settings.global_max_steps},
    )
    output = final_state.get("last_output", "")
    await record_message(
        type=MessageType.log,
        sender="runtime",
        recipient="system",
        content=f"✔ Workflow '{workflow.name}' completed",
        run_id=run_id,
        meta={"workflow_id": workflow.id},
    )
    return output


# --------------------------------------------------------------------------- #
# Orchestration entrypoints used by the API + channels
# --------------------------------------------------------------------------- #
async def execute_run(run_id: str) -> None:
    """Drive a Run row to completion (workflow or single agent)."""
    with session_scope() as s:
        run = s.get(Run, run_id)
        if not run:
            return
        run.status = RunStatus.running
        s.add(run)
        s.commit()
        workflow = s.get(Workflow, run.workflow_id) if run.workflow_id else None
        agent = s.get(Agent, run.agent_id) if run.agent_id else None
        task = run.input

    await bus.publish({"kind": "run_status", "run_id": run_id, "status": "running"})
    try:
        if workflow:
            output = await run_workflow(workflow, task, run_id)
        elif agent:
            output, _ = await run_agent(agent, task, run_id=run_id)
        else:
            raise ValueError("run has neither workflow_id nor agent_id")
        _finish_run(run_id, RunStatus.completed, output=output)
        await bus.publish({"kind": "run_status", "run_id": run_id, "status": "completed"})
    except Exception as exc:  # noqa: BLE001
        _finish_run(run_id, RunStatus.failed, error=str(exc))
        await record_message(
            type=MessageType.error, sender="runtime", recipient="system",
            content=f"Run failed: {exc}", run_id=run_id,
        )
        await bus.publish({"kind": "run_status", "run_id": run_id, "status": "failed"})


def _finish_run(run_id: str, status: RunStatus, output: str = "", error: str | None = None) -> None:
    with session_scope() as s:
        run = s.get(Run, run_id)
        if not run:
            return
        run.status = status
        run.output = output
        run.error = error
        run.finished_at = dt.datetime.now(dt.timezone.utc)
        s.add(run)
        s.commit()
