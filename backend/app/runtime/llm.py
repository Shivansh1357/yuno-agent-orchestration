"""LLM client factory + token/cost accounting.

Wraps `langchain_anthropic.ChatAnthropic` so the rest of the runtime is provider
agnostic. `usage_metadata` from each response feeds `compute_cost`, which the
engine accumulates onto the Run and emits to the live monitor.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..config import settings


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0

    def add(self, other: "Usage") -> None:
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens
        self.cost_usd += other.cost_usd


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_price, out_price = settings.model_prices.get(
        model, settings.model_prices.get(settings.default_model, (1.0, 5.0))
    )
    return (input_tokens / 1_000_000) * in_price + (output_tokens / 1_000_000) * out_price


def usage_from_response(model: str, usage_metadata: dict | None) -> Usage:
    if not usage_metadata:
        return Usage()
    it = int(usage_metadata.get("input_tokens", 0) or 0)
    ot = int(usage_metadata.get("output_tokens", 0) or 0)
    return Usage(input_tokens=it, output_tokens=ot, cost_usd=compute_cost(model, it, ot))


def build_chat_model(model: str, temperature: float, max_tokens: int):
    """Return a configured ChatAnthropic instance.

    Imported lazily so the module (and the test suite, which mocks the LLM)
    does not require the heavy langchain stack or an API key just to import.
    """
    from langchain_anthropic import ChatAnthropic

    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env before running agents."
        )
    return ChatAnthropic(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        api_key=settings.anthropic_api_key,
        timeout=settings.request_timeout_seconds,
    )
