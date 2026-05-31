"""SQLModel ORM models — the persistence layer.

The schema is intentionally small but covers every entity the platform needs:
agents and their rich configuration, workflows (a serialized graph of agent
nodes), runs (one execution of a workflow), and a single unified Message table
that doubles as chat history, the inter-agent message log, and the monitoring
event stream. A lightweight key/value MemoryItem table gives each agent durable
memory across runs.
"""
from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import Any, Optional

from sqlalchemy import Column, Text
from sqlalchemy import JSON as SAJSON
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class MessageType(str, enum.Enum):
    """Discriminator for the unified Message stream."""

    chat = "chat"            # human <-> agent over a channel or the web chat
    agent_message = "agent"  # one agent handing off / replying to another
    tool_call = "tool"       # an agent invoked a real tool
    log = "log"              # runtime/system log line
    error = "error"


class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


# --------------------------------------------------------------------------- #
# Agent
# --------------------------------------------------------------------------- #
class Agent(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str = Field(index=True)
    role: str = ""
    system_prompt: str = Field(default="", sa_column=Column(Text))
    provider: str = "anthropic"
    model: str = "claude-haiku-4-5-20251001"
    temperature: float = 0.7
    max_tokens: int = 1024

    # Configurable dimensions ------------------------------------------------
    tools: list[str] = Field(default_factory=list, sa_column=Column(SAJSON))
    channels: list[str] = Field(default_factory=list, sa_column=Column(SAJSON))
    skills: list[str] = Field(default_factory=list, sa_column=Column(SAJSON))
    memory_enabled: bool = True
    max_iterations: int = 6  # ReAct tool-loop ceiling (a "limit")
    schedule_cron: Optional[str] = None  # e.g. "*/5 * * * *"
    interaction_rules: str = Field(default="", sa_column=Column(Text))
    # Guardrails: {"blocked_keywords": [...], "max_cost_usd": 0.50}
    guardrails: dict[str, Any] = Field(default_factory=dict, sa_column=Column(SAJSON))

    created_at: dt.datetime = Field(default_factory=_now)
    updated_at: dt.datetime = Field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Workflow — a serialized graph compiled into a LangGraph StateGraph at runtime
# --------------------------------------------------------------------------- #
class Workflow(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str = Field(index=True)
    description: str = Field(default="", sa_column=Column(Text))
    # graph = {"nodes": [{"id","agent_id","label"}],
    #          "edges": [{"source","target","condition"?}],
    #          "entry": "<node id>"}
    graph: dict[str, Any] = Field(default_factory=dict, sa_column=Column(SAJSON))
    is_template: bool = False
    created_at: dt.datetime = Field(default_factory=_now)
    updated_at: dt.datetime = Field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Run — one execution of a workflow (or a single agent)
# --------------------------------------------------------------------------- #
class Run(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    workflow_id: Optional[str] = Field(default=None, index=True)
    agent_id: Optional[str] = None
    status: RunStatus = RunStatus.pending
    trigger: str = "manual"  # manual | telegram | schedule
    channel_ref: Optional[str] = None  # e.g. telegram chat id
    input: str = Field(default="", sa_column=Column(Text))
    output: str = Field(default="", sa_column=Column(Text))
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    error: Optional[str] = None
    started_at: dt.datetime = Field(default_factory=_now)
    finished_at: Optional[dt.datetime] = None


# --------------------------------------------------------------------------- #
# Message — unified stream: chat history, agent-to-agent, tool calls, logs
# --------------------------------------------------------------------------- #
class Message(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    run_id: Optional[str] = Field(default=None, index=True)
    type: MessageType = Field(default=MessageType.log, index=True)
    sender: str = "system"      # agent name, "human", or "system"
    recipient: str = "system"   # agent name, "human", or "system"
    channel: Optional[str] = None  # "web", "telegram", ...
    content: str = Field(default="", sa_column=Column(Text))
    meta: dict[str, Any] = Field(default_factory=dict, sa_column=Column(SAJSON))
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    created_at: dt.datetime = Field(default_factory=_now)


# --------------------------------------------------------------------------- #
# MemoryItem — durable per-agent key/value memory
# --------------------------------------------------------------------------- #
class MemoryItem(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    agent_id: str = Field(index=True)
    key: str = Field(index=True)
    value: str = Field(default="", sa_column=Column(Text))
    created_at: dt.datetime = Field(default_factory=_now)
