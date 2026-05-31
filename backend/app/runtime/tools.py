"""Real, executable tools agents can call.

These are genuine side-effecting tools (network fetches, a real search, a math
evaluator, durable memory) — not stubs. They are exposed as LangChain tools so
`create_react_agent` can bind and invoke them inside the runtime's tool loop.

To add a new tool: write the function, wrap it with `@tool`, and register it in
`TOOL_REGISTRY` (or, for agent-scoped tools, in `build_agent_tools`).
"""
from __future__ import annotations

import ast
import datetime as dt
import operator
from typing import Callable

import httpx
from langchain_core.tools import tool

from ..db import session_scope
from ..models import MemoryItem

# --------------------------------------------------------------------------- #
# Stateless tools
# --------------------------------------------------------------------------- #

# A deliberately small, safe arithmetic evaluator (no eval()).
_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
}


def _safe_eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp):
        return _OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp):
        return _OPS[type(node.op)](_safe_eval(node.operand))
    raise ValueError("unsupported expression")


@tool
def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression, e.g. '3 * (4 + 5) / 2'."""
    try:
        return str(_safe_eval(ast.parse(expression, mode="eval").body))
    except Exception as exc:  # noqa: BLE001
        return f"calculator error: {exc}"


@tool
def current_time() -> str:
    """Return the current UTC date and time in ISO-8601 format."""
    return dt.datetime.now(dt.timezone.utc).isoformat()


@tool
def http_get(url: str) -> str:
    """Fetch a URL with an HTTP GET and return up to 4000 chars of the body."""
    try:
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            r = client.get(url, headers={"User-Agent": "yuno-agent/1.0"})
            return f"HTTP {r.status_code}\n{r.text[:4000]}"
    except Exception as exc:  # noqa: BLE001
        return f"http_get error: {exc}"


@tool
def web_search(query: str) -> str:
    """Search the web (DuckDuckGo) and return the top result titles + snippets."""
    try:
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            r = client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
                headers={"User-Agent": "Mozilla/5.0 yuno-agent/1.0"},
            )
        import re

        results = re.findall(r'result__a[^>]*>(.*?)</a>', r.text)[:5]
        snippets = re.findall(r'result__snippet[^>]*>(.*?)</a>', r.text)[:5]
        clean = lambda s: re.sub(r"<[^>]+>", "", s).strip()  # noqa: E731
        if not results:
            return "No results found."
        return "\n".join(
            f"{i+1}. {clean(t)} — {clean(s) if i < len(snippets) else ''}"
            for i, (t, s) in enumerate(zip(results, snippets + [""] * len(results)))
        )
    except Exception as exc:  # noqa: BLE001
        return f"web_search error: {exc}"


# --------------------------------------------------------------------------- #
# Agent-scoped tools (durable memory) — built per agent so they know whose
# memory they touch.
# --------------------------------------------------------------------------- #
def _build_memory_tools(agent_id: str) -> list:
    @tool
    def remember(key: str, value: str) -> str:
        """Persist a fact to long-term memory under a key for later recall."""
        with session_scope() as s:
            s.add(MemoryItem(agent_id=agent_id, key=key, value=value))
            s.commit()
        return f"remembered '{key}'"

    @tool
    def recall(key: str) -> str:
        """Look up a previously remembered fact by key. Use '*' to list keys."""
        from sqlmodel import select

        with session_scope() as s:
            if key == "*":
                rows = s.exec(select(MemoryItem).where(MemoryItem.agent_id == agent_id)).all()
                return ", ".join(sorted({r.key for r in rows})) or "(empty)"
            rows = s.exec(
                select(MemoryItem)
                .where(MemoryItem.agent_id == agent_id, MemoryItem.key == key)
                .order_by(MemoryItem.created_at.desc())
            ).all()
            return rows[0].value if rows else f"no memory for '{key}'"

    return [remember, recall]


# name -> stateless tool
TOOL_REGISTRY: dict[str, Callable] = {
    "calculator": calculator,
    "current_time": current_time,
    "http_get": http_get,
    "web_search": web_search,
}

# Tools that must be built per-agent.
AGENT_SCOPED_TOOLS = {"remember", "recall"}

# Surfaced to the UI so the agent editor can show a tool picker.
AVAILABLE_TOOLS = list(TOOL_REGISTRY.keys()) + sorted(AGENT_SCOPED_TOOLS)


def build_agent_tools(agent_id: str, names: list[str]) -> list:
    """Resolve a list of tool names into bound LangChain tool objects."""
    selected: list = []
    wants_memory = any(n in AGENT_SCOPED_TOOLS for n in names)
    for n in names:
        if n in TOOL_REGISTRY:
            selected.append(TOOL_REGISTRY[n])
    if wants_memory:
        mem = {t.name: t for t in _build_memory_tools(agent_id)}
        for n in names:
            if n in mem:
                selected.append(mem[n])
    return selected
