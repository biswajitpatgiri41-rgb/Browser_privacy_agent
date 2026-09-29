"""Server configuration using environment variables."""
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    # Application
    app_env: str = Field(default="production", alias="APP_ENV")
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # Planner Backend
    planner_backend: str = Field(default="transformers", alias="PLANNER_BACKEND")

    # Transformers Backend
    model_base: str = Field(default="Qwen/Qwen2.5-1.5B-Instruct", alias="MODEL_BASE")
    model_adapter_path: str = Field(default="models/planner-lora/Final_model", alias="MODEL_ADAPTER_PATH")
    model_device: str = Field(default="auto", alias="MODEL_DEVICE")
    model_max_new_tokens: int = Field(default=160, alias="MODEL_MAX_NEW_TOKENS")
    model_temperature: float = Field(default=0.0, alias="MODEL_TEMPERATURE")

    # API Backend
    api_provider: str = Field(default="openai", alias="API_PROVIDER")
    api_model: str = Field(default="gpt-4o-mini", alias="API_MODEL")
    api_key: str = Field(default="", alias="API_KEY")
    api_base_url: str = Field(default="", alias="API_BASE_URL")
    api_timeout_seconds: int = Field(default=30, alias="API_TIMEOUT_SECONDS")

    # Request Limits
    max_context_elements: int = Field(default=200, alias="MAX_CONTEXT_ELEMENTS")
    max_request_bytes: int = Field(default=1048576, alias="MAX_REQUEST_BYTES")
    max_task_length: int = Field(default=2000, alias="MAX_TASK_LENGTH")

    # Security
    rate_limit_requests: int = Field(default=100, alias="RATE_LIMIT_REQUESTS")
    rate_limit_window_seconds: int = Field(default=60, alias="RATE_LIMIT_WINDOW_SECONDS")
    enable_prompt_injection_detection: bool = Field(default=True, alias="ENABLE_PROMPT_INJECTION_DETECTION")
    enable_payload_validation: bool = Field(default=True, alias="ENABLE_PAYLOAD_VALIDATION")

    # Graph Limits
    max_iterations: int = Field(default=10, alias="MAX_ITERATIONS")
    max_graph_steps: int = Field(default=5, alias="MAX_GRAPH_STEPS")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
