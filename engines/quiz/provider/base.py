"""
Base AI Provider Interface and Configurations
Defines the abstract contract for AI inference engines (Agnes, Mock, etc.).
"""

from abc import ABC, abstractmethod
from typing import TypeVar, Optional, Any
import os
import re
from pydantic import BaseModel, Field

from .metrics import AICallBudgetTracker

T = TypeVar("T", bound=BaseModel)


class ProviderConfig(BaseModel):
    """Configuration for AI Provider network and model parameters."""
    api_key: str = Field(default_factory=lambda: os.getenv("AGNES_API_KEY", ""))
    base_url: str = Field(default="https://apihub.agnes-ai.com/v1")
    model: str = Field(default="agnes-3.0-flash")
    timeout_seconds: int = Field(default=90)
    max_tokens: int = Field(default=4096)
    max_retries: int = Field(default=3)
    temperature: float = Field(default=0.0)


class ProviderError(Exception):
    """Base exception for AI provider operations."""
    pass


class ProviderTimeoutError(ProviderError):
    """Raised when an API request times out."""
    pass


class ProviderAuthError(ProviderError):
    """Raised on authentication/authorization failures (HTTP 401/403)."""
    pass


class ProviderRateLimitError(ProviderError):
    """Raised when hitting rate limits (HTTP 429)."""
    pass


class ProviderSchemaError(ProviderError):
    """Raised when AI response fails Pydantic schema validation."""
    def __init__(self, message: str, raw_payload: str = "", validation_details: Optional[Any] = None):
        super().__init__(message)
        self.raw_payload = raw_payload
        self.validation_details = validation_details


def redact_sensitive_info(message: str, api_key: str = "") -> str:
    """
    Sanitizes log messages and exceptions, masking API keys and sensitive tokens.
    Never exposes secrets in logs or console output.
    """
    if not message:
        return ""

    if api_key and len(api_key) >= 6:
        message = message.replace(api_key, "[REDACTED_API_KEY]")

    # Mask standard bearer tokens, OpenAI/Agnes keys (sk-...)
    message = re.sub(
        r"(?:Bearer\s+|sk-|key-|token=)[a-zA-Z0-9_\-]{16,}",
        "[REDACTED_SECRET]",
        message,
        flags=re.IGNORECASE
    )
    return message


class IAIProvider(ABC):
    """
    Abstract contract for Structured Multimodal AI Providers.
    Decouples quiz pipeline services from concrete API SDKs or network protocols.
    """

    def __init__(self, tracker: Optional[AICallBudgetTracker] = None) -> None:
        self.tracker = tracker or AICallBudgetTracker()

    @abstractmethod
    def generate_structured(
        self,
        task_name: str,
        user_prompt: str,
        system_prompt: str,
        schema: type[T],
        image_bytes: Optional[bytes] = None,
        image_mime: str = "image/png",
        temperature: float = 0.0
    ) -> T:
        """
        Executes a prompt against the AI model and strictly enforces Pydantic schema T.
        Handles bounded retries, timeouts, and JSON error recovery.
        """
        pass
