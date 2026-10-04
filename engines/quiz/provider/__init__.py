"""
Structured AI Provider Package
Exposes abstract provider interface, prompt builder, schema validator, and Agnes/Mock providers.
"""

from .base import (
    IAIProvider,
    ProviderConfig,
    ProviderError,
    ProviderTimeoutError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderSchemaError,
    redact_sensitive_info
)
from .prompt_builder import PromptBuilder
from .validation import extract_json_substring, _salvage_truncated_json, validate_structured_json
from .mock import MockAIProvider
from .agnes import AgnesAIProvider

__all__ = [
    "IAIProvider",
    "ProviderConfig",
    "ProviderError",
    "ProviderTimeoutError",
    "ProviderAuthError",
    "ProviderRateLimitError",
    "ProviderSchemaError",
    "redact_sensitive_info",
    "PromptBuilder",
    "extract_json_substring",
    "_salvage_truncated_json",
    "validate_structured_json",
    "MockAIProvider",
    "AgnesAIProvider"
]
