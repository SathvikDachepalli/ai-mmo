"""Application settings, read from environment variables via pydantic-settings."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ai-mmo-server"
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://rpg:rpg@localhost:5432/rpg"
    database_url_sync: str = "postgresql+psycopg2://rpg:rpg@localhost:5432/rpg"

    # Redis / workers
    redis_url: str = "redis://localhost:6379/0"

    # AI provider. provider: openai | deterministic
    ai_provider: str = "openai"
    ai_model: str = "deepseek-chat"
    ai_api_key: str = ""
    ai_base_url: str = ""
    ai_request_timeout: float = 60.0

    # Web search for the chat-room AI participant (current events, news).
    # Leave empty to disable -- the AI just answers from its own knowledge.
    # Free tier: https://tavily.com (1,000 searches/month).
    tavily_api_key: str = ""

    # CORS / clients
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Auth (fastapi-users JWT). Generate with: openssl rand -hex 32
    auth_secret: str = "dev-only-secret-change-me"


@lru_cache
def get_settings() -> Settings:
    return Settings()