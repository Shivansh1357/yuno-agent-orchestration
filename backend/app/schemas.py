"""Pydantic request/response schemas for the HTTP API (the contract the UI uses)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from pydantic import BaseModel, Field


# --- Agents ----------------------------------------------------------------- #
class AgentBase(BaseModel):
    name: str
    role: str = ""
    system_prompt: str = ""
    provider: str = "anthropic"
    model: str = "claude-haiku-4-5-20251001"
    temperature: float = 0.7
    max_tokens: int = 1024
    tools: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    memory_enabled: bool = True
    max_iterations: int = 6
    schedule_cron: Optional[str] = None
    interaction_rules: str = ""
    guardrails: dict[str, Any] = Field(default_factory=dict)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    tools: Optional[list[str]] = None
    channels: Optional[list[str]] = None
    skills: Optional[list[str]] = None
    memory_enabled: Optional[bool] = None
    max_iterations: Optional[int] = None
    schedule_cron: Optional[str] = None
    interaction_rules: Optional[str] = None
    guardrails: Optional[dict[str, Any]] = None


class AgentRead(AgentBase):
    id: str
    created_at: dt.datetime
    updated_at: dt.datetime


# --- Workflows -------------------------------------------------------------- #
class WorkflowBase(BaseModel):
    name: str
    description: str = ""
    graph: dict[str, Any] = Field(default_factory=dict)
    is_template: bool = False


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    graph: Optional[dict[str, Any]] = None
    is_template: Optional[bool] = None


class WorkflowRead(WorkflowBase):
    id: str
    created_at: dt.datetime
    updated_at: dt.datetime


# --- Runs ------------------------------------------------------------------- #
class RunCreate(BaseModel):
    workflow_id: Optional[str] = None
    agent_id: Optional[str] = None
    input: str
    trigger: str = "manual"
    channel_ref: Optional[str] = None


class RunRead(BaseModel):
    id: str
    workflow_id: Optional[str]
    agent_id: Optional[str]
    status: str
    trigger: str
    channel_ref: Optional[str]
    input: str
    output: str
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    error: Optional[str]
    started_at: dt.datetime
    finished_at: Optional[dt.datetime]


# --- Messages --------------------------------------------------------------- #
class MessageRead(BaseModel):
    id: str
    run_id: Optional[str]
    type: str
    sender: str
    recipient: str
    channel: Optional[str]
    content: str
    meta: dict[str, Any]
    input_tokens: int
    output_tokens: int
    cost_usd: float
    created_at: dt.datetime


class ChatRequest(BaseModel):
    """Send a message to an agent or workflow from the web chat panel."""

    text: str
    workflow_id: Optional[str] = None
    agent_id: Optional[str] = None
    session_ref: str = "web"
