"""Application configuration, loaded from environment variables / .env."""
from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object. Values come from env vars or a local .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- LLM provider -------------------------------------------------------
    anthropic_api_key: str = ""
    default_model: str = "claude-haiku-4-5-20251001"
    # Per-1M-token USD prices used for cost tracking. Keep this in sync with the
    # provider's public pricing. Values are (input_per_mtok, output_per_mtok).
    model_prices: dict[str, tuple[float, float]] = {
        "claude-haiku-4-5-20251001": (1.0, 5.0),
        "claude-sonnet-4-6": (3.0, 15.0),
        "claude-opus-4-8": (15.0, 75.0),
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
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
