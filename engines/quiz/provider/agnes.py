"""
Agnes AI Provider Implementation
Production-ready multimodal client for Agnes API with bounded retries, schema validation, and security sanitization.
"""

import base64
import json
import logging
import socket
import time
import urllib.error
import urllib.request
from typing import Optional

from .base import (
    IAIProvider,
    ProviderConfig,
    ProviderError,
    ProviderTimeoutError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderSchemaError,
    redact_sensitive_info,
    T
)
from .validation import validate_structured_json

logger = logging.getLogger("engines.quiz.provider.agnes")


class AgnesAIProvider(IAIProvider):
    """
    Multimodal AI Provider connecting to Agnes AI API.
    Supports structured extraction, Vision payloads, exponential backoff, and secret masking.
    """

    def __init__(self, config: Optional[ProviderConfig] = None):
        super().__init__()
        self.config = config or ProviderConfig()

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
        Submits request to Agnes API and parses the response into validated Pydantic model T.
        Retries up to config.max_retries on transient network errors or server failures.
        """
        api_key = self.config.api_key.strip()
        if not api_key:
            raise ProviderAuthError("Missing AGNES_API_KEY. Configure it in environment or ProviderConfig.")

        endpoint = f"{self.config.base_url.rstrip('/')}/chat/completions"

        # Prepare user message content (text or multimodal)
        if image_bytes:
            b64_img = base64.b64encode(image_bytes).decode("ascii")
            user_content: list[dict] = [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_mime};base64,{b64_img}"
                    }
                }
            ]
        else:
            user_content = user_prompt

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": self.config.max_tokens
        }

        json_bytes = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "DDStudio-QuizEngine/2.0"
        }

        last_exception: Optional[Exception] = None
        max_attempts = max(1, self.config.max_retries)

        for attempt in range(1, max_attempts + 1):
            attempt_start = time.perf_counter()
            try:
                req = urllib.request.Request(endpoint, data=json_bytes, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=self.config.timeout_seconds) as response:
                    res_body = response.read().decode("utf-8")
                    res_data = json.loads(res_body)

                choices = res_data.get("choices", [])
                if not choices:
                    raise ProviderError("Agnes API returned empty choices array in response")

                message_obj = choices[0].get("message", {})
                raw_text = message_obj.get("content", "")
                if not raw_text:
                    raise ProviderError("Agnes API returned empty message content")

                # Validate and parse into schema
                try:
                    result_obj = validate_structured_json(raw_text, schema)
                    lat = (time.perf_counter() - attempt_start) * 1000
                    self.tracker.record_call(
                        task_name=task_name,
                        latency_ms=lat,
                        is_vision=bool(image_bytes),
                        is_retry=(attempt > 1)
                    )
                    return result_obj
                except ProviderSchemaError as schema_err:
                    lat = (time.perf_counter() - attempt_start) * 1000
                    self.tracker.record_call(
                        task_name=task_name,
                        latency_ms=lat,
                        is_vision=bool(image_bytes),
                        is_retry=(attempt > 1)
                    )
                    # If this is not the final attempt, retry with schema correction feedback
                    if attempt < max_attempts:
                        logger.warning(
                            f"Schema validation failed on attempt {attempt}/{max_attempts}. Retrying with feedback."
                        )
                        # Append feedback to messages for subsequent attempt
                        correction_user_msg = (
                            f"Previous response was invalid according to schema:\n{schema_err.validation_details}\n"
                            "Please fix and output ONLY valid JSON matching the schema."
                        )
                        messages.append({"role": "assistant", "content": raw_text})
                        messages.append({"role": "user", "content": correction_user_msg})
                        payload["messages"] = messages
                        payload["temperature"] = 0.0
                        json_bytes = json.dumps(payload).encode("utf-8")
                        time.sleep(1.0)
                        continue
                    raise schema_err

            except urllib.error.HTTPError as http_err:
                code = http_err.code
                error_body = ""
                try:
                    error_body = http_err.read().decode("utf-8", errors="replace")
                except Exception:
                    pass
                finally:
                    try:
                        http_err.close()
                    except Exception:
                        pass

                redacted_msg = redact_sensitive_info(
                    f"HTTP {code}: {http_err.reason} - {error_body}",
                    api_key=api_key
                )

                # Fail-fast on authentication or bad request errors
                if code in (401, 403):
                    raise ProviderAuthError(redacted_msg) from http_err
                if code == 400:
                    raise ProviderError(redacted_msg) from http_err

                # Retry on 429 Rate Limit or 5xx Server Errors
                if code in (429, 500, 502, 503, 504):
                    last_exception = (
                        ProviderRateLimitError(redacted_msg) if code == 429
                        else ProviderError(redacted_msg)
                    )
                    if attempt < max_attempts:
                        sleep_time = min(10.0, 1.5 * (2 ** (attempt - 1)))
                        time.sleep(sleep_time)
                        continue
                    raise last_exception from http_err

                # Non-retryable HTTP error
                raise ProviderError(redacted_msg) from http_err

            except (urllib.error.URLError, socket.timeout, TimeoutError) as net_err:
                redacted_msg = redact_sensitive_info(f"Network error: {net_err}", api_key=api_key)
                is_timeout = isinstance(net_err, (socket.timeout, TimeoutError)) or "timed out" in str(net_err).lower()

                last_exception = (
                    ProviderTimeoutError(f"Request timed out after {self.config.timeout_seconds}s")
                    if is_timeout else ProviderError(redacted_msg)
                )

                if attempt < max_attempts:
                    sleep_time = min(8.0, 1.5 * (2 ** (attempt - 1)))
                    time.sleep(sleep_time)
                    continue

                raise last_exception from net_err

            except Exception as ex:
                redacted_msg = redact_sensitive_info(f"Unexpected provider error: {ex}", api_key=api_key)
                raise ProviderError(redacted_msg) from ex

        if last_exception:
            raise last_exception
        raise ProviderError("Agnes provider failed after all attempts.")
