"""
Mock AI Provider Module
Deterministic offline simulation of AI responses and edge-case error injections.
"""

from typing import Optional, Any
import json
from pydantic import BaseModel
from .base import (
    IAIProvider,
    T,
    ProviderTimeoutError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderError
)
from .validation import validate_structured_json


class MockAIProvider(IAIProvider):
    """
    Mock AI Provider for automated testing and offline development.
    Can return deterministic fixtures, simulate HTTP failure codes, timeouts, and malformed outputs.
    """

    def __init__(
        self,
        preset_response: Optional[Any] = None,
        simulate_timeout: bool = False,
        simulate_http_500: bool = False,
        simulate_http_401: bool = False,
        simulate_http_429: bool = False,
        simulate_malformed_json: bool = False,
        simulate_missing_fields: bool = False,
        failure_count_before_success: int = 0,
        enable_cache: bool = False
    ):
        super().__init__()
        self.preset_response = preset_response
        self.simulate_timeout = simulate_timeout
        self.simulate_http_500 = simulate_http_500
        self.simulate_http_401 = simulate_http_401
        self.simulate_http_429 = simulate_http_429
        self.simulate_malformed_json = simulate_malformed_json
        self.simulate_missing_fields = simulate_missing_fields
        self.failure_count_before_success = failure_count_before_success
        self.enable_cache = enable_cache
        self._current_attempt_count = 0
        self.call_history: list[dict] = []

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
        Simulates structured response generation with error injection support.
        """
        self._current_attempt_count += 1
        task_key = (task_name, user_prompt)
        if not hasattr(self, "_task_attempts"):
            self._task_attempts = {}
        curr_attempts = self._task_attempts.get(task_key, 0) + 1
        self._task_attempts[task_key] = curr_attempts
        is_retry_call = (curr_attempts > 1)

        self.tracker.record_call(
            task_name=task_name,
            latency_ms=15.0,
            is_vision=bool(image_bytes),
            is_retry=is_retry_call
        )
        self.call_history.append({
            "task_name": task_name,
            "user_prompt": user_prompt,
            "system_prompt": system_prompt,
            "schema_name": schema.__name__,
            "has_image": image_bytes is not None,
            "image_len": len(image_bytes) if image_bytes else 0,
            "temperature": temperature,
            "attempt": self._current_attempt_count
        })

        # Check temporary failure count
        if self._current_attempt_count <= self.failure_count_before_success:
            raise ProviderError(f"Simulated transient 503 Service Unavailable (attempt {self._current_attempt_count})")

        # Injected static errors
        if self.simulate_timeout:
            raise ProviderTimeoutError("Simulated request timeout after 90 seconds")

        if self.simulate_http_401:
            raise ProviderAuthError("Simulated HTTP 401 Unauthorized: Invalid API key")

        if self.simulate_http_429:
            raise ProviderRateLimitError("Simulated HTTP 429 Too Many Requests")

        if self.simulate_http_500:
            raise ProviderError("Simulated HTTP 500 Internal Server Error")

        if self.simulate_malformed_json:
            raw_text = '{"items": [{"id": 1, "stem": "Incomplete string'
            return validate_structured_json(raw_text, schema)

        if self.simulate_missing_fields:
            raw_text = '{"random_key": "unexpected_data"}'
            return validate_structured_json(raw_text, schema)

        # If preset response is callable
        if callable(self.preset_response):
            res = self.preset_response(task_name, schema)
            if isinstance(res, schema):
                return res
            return schema.model_validate(res)

        # If preset response is a list of candidate responses
        if isinstance(self.preset_response, list):
            for item in self.preset_response:
                if isinstance(item, schema):
                    return item

        # If preset response is a mapping of schema -> response
        if isinstance(self.preset_response, dict):
            if schema in self.preset_response:
                val = self.preset_response[schema]
                if isinstance(val, schema):
                    return val
                return schema.model_validate(val)
            try:
                return schema.model_validate(self.preset_response)
            except Exception:
                pass

        # If preset response is already an instance of schema
        if isinstance(self.preset_response, schema):
            return self.preset_response

        if isinstance(self.preset_response, str):
            return validate_structured_json(self.preset_response, schema)

        # Fallback: create mock instance from schema fields
        mock_data: dict[str, Any] = {}
        for field_name, field_info in schema.model_fields.items():
            field_type = field_info.annotation
            if field_type is str or getattr(field_type, "__origin__", None) is str:
                mock_data[field_name] = f"mock_{field_name}"
            elif field_type is int:
                mock_data[field_name] = 1
            elif field_type is float:
                mock_data[field_name] = 1.0
            elif field_type is bool:
                mock_data[field_name] = True
            elif getattr(field_type, "__origin__", None) is list:
                mock_data[field_name] = []
            elif getattr(field_type, "__origin__", None) is dict:
                mock_data[field_name] = {}
            else:
                mock_data[field_name] = None

        return schema.model_validate(mock_data)
