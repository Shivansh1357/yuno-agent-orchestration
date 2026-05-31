"""Workflow CRUD + validation endpoints."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..models import Agent, Workflow
from ..schemas import WorkflowCreate, WorkflowRead, WorkflowUpdate

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _validate_graph(graph: dict, session: Session) -> None:
    nodes = graph.get("nodes", [])
    if not nodes:
        raise HTTPException(400, "workflow must have at least one node")
    node_ids = {n["id"] for n in nodes}
    for n in nodes:
        if not session.get(Agent, n.get("agent_id")):
            raise HTTPException(400, f"node {n['id']} references unknown agent {n.get('agent_id')}")
    for e in graph.get("edges", []):
        if e["source"] not in node_ids or e["target"] not in node_ids:
            raise HTTPException(400, f"edge {e} references an unknown node")
    entry = graph.get("entry")
    if entry and entry not in node_ids:
        raise HTTPException(400, "entry references an unknown node")


@router.get("", response_model=list[WorkflowRead])
def list_workflows(session: Session = Depends(get_session)):
    return session.exec(select(Workflow).order_by(Workflow.created_at)).all()


@router.post("", response_model=WorkflowRead, status_code=201)
def create_workflow(payload: WorkflowCreate, session: Session = Depends(get_session)):
    if payload.graph:
        _validate_graph(payload.graph, session)
    wf = Workflow(**payload.model_dump())
    session.add(wf)
    session.commit()
    session.refresh(wf)
    return wf


@router.get("/{workflow_id}", response_model=WorkflowRead)
def get_workflow(workflow_id: str, session: Session = Depends(get_session)):
    wf = session.get(Workflow, workflow_id)
    if not wf:
        raise HTTPException(404, "workflow not found")
    return wf


@router.patch("/{workflow_id}", response_model=WorkflowRead)
def update_workflow(workflow_id: str, payload: WorkflowUpdate, session: Session = Depends(get_session)):
    wf = session.get(Workflow, workflow_id)
    if not wf:
        raise HTTPException(404, "workflow not found")
    data = payload.model_dump(exclude_unset=True)
    if "graph" in data and data["graph"]:
        _validate_graph(data["graph"], session)
    for key, value in data.items():
        setattr(wf, key, value)
    wf.updated_at = dt.datetime.now(dt.timezone.utc)
    session.add(wf)
    session.commit()
    session.refresh(wf)
    return wf


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str, session: Session = Depends(get_session)):
    wf = session.get(Workflow, workflow_id)
    if not wf:
        raise HTTPException(404, "workflow not found")
    session.delete(wf)
    session.commit()
