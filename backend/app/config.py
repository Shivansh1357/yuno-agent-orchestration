"""Application configuration, loaded from environment variables / .env."""
from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object. Values come from env vars or a local .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- LLM provider -------------------------------------------------------
    # The active provider is derived per-agent from the model id (see
    # runtime/llm.py::provider_for_model), so a single platform can mix Anthropic
    # and Bedrock agents. `default_model` decides what newly-seeded agents use.
    default_provider: str = "anthropic"
    default_model: str = "claude-haiku-4-5-20251001"

    # Anthropic (direct API)
    anthropic_api_key: str = ""

    # AWS Bedrock (bearer-token / "Bedrock API key" auth — no IAM key needed)
    aws_bearer_token_bedrock: str = ""
    aws_bedrock_region: str = "us-west-2"

    # Per-1M-token USD prices used for cost tracking. Keep this in sync with each
    # provider's public pricing. Values are (input_per_mtok, output_per_mtok).
    model_prices: dict[str, tuple[float, float]] = {
        # Anthropic
        "claude-haiku-4-5-20251001": (1.0, 5.0),
        "claude-sonnet-4-6": (3.0, 15.0),
        "claude-opus-4-8": (15.0, 75.0),
        # AWS Bedrock — Amazon Nova
        "us.amazon.nova-micro-v1:0": (0.035, 0.14),
        "us.amazon.nova-lite-v1:0": (0.06, 0.24),
        "us.amazon.nova-pro-v1:0": (0.80, 3.20),
        # AWS Bedrock — Meta Llama (open-weight)
        "us.meta.llama3-3-70b-instruct-v1:0": (0.72, 0.72),
        "us.meta.llama4-scout-17b-instruct-v1:0": (0.17, 0.66),
    }

    # --- Persistence --------------------------------------------------------
    database_url: str = "sqlite:///./data/yuno.db"

    # --- Telegram channel ---------------------------------------------------
    telegram_bot_token: str = ""
    # Agent name that should answer inbound Telegram messages. If a workflow is
    # named the same it is preferred (so the human triggers a whole workflow).
    telegram_default_target: str = ""

    # --- Runtime safety nets ------------------------------------------------
    global_max_steps: int = 25
    request_timeout_seconds: int = 120

    @property
    def anthropic_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def bedrock_enabled(self) -> bool:
        return bool(self.aws_bearer_token_bedrock)

    @property
    def llm_enabled(self) -> bool:
        return self.anthropic_enabled or self.bedrock_enabled


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
