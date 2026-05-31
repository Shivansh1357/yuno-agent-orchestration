"""Agent CRUD endpoints."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import Agent
from ..schemas import AgentCreate, AgentRead, AgentUpdate

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[AgentRead])
def list_agents(session: Session = Depends(get_session)):
    return session.exec(select(Agent).order_by(Agent.created_at)).all()


@router.post("", response_model=AgentRead, status_code=201)
def create_agent(payload: AgentCreate, session: Session = Depends(get_session)):
    agent = Agent(**payload.model_dump())
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(agent_id: str, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentRead)
def update_agent(agent_id: str, payload: AgentUpdate, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    agent.updated_at = dt.datetime.now(dt.timezone.utc)
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
def delete_agent(agent_id: str, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    session.delete(agent)
    session.commit()
