"""
Unit Tests for Agnes Provider & Structured Prompt Engine (TASK-04)
Tests PromptBuilder (6 blocks, CoT ban), Schema Validation, JSON Salvage,
MockAIProvider, and AgnesAIProvider with mock network layer.
"""

import io
import json
import unittest
from unittest.mock import patch, MagicMock
import urllib.error

from pydantic import BaseModel, Field

from engines.quiz.provider.base import (
    ProviderConfig,
    ProviderError,
    ProviderTimeoutError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderSchemaError,
    redact_sensitive_info
)
from engines.quiz.provider.prompt_builder import PromptBuilder
from engines.quiz.provider.validation import (
    extract_json_substring,
    _salvage_truncated_json,
    validate_structured_json
)
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.provider.agnes import AgnesAIProvider


# Test Schemas
class SimpleItem(BaseModel):
    id: int
    stem: str
    answer: str
    confidence: str = "high"


class BatchResult(BaseModel):
    items: list[SimpleItem]


class TestAgnesProvider(unittest.TestCase):
    """Test suite for Agnes Provider and structured output pipeline."""

    def test_prompt_builder_standard_blocks(self):
        """Verifies PromptBuilder creates all 6 mandatory blocks."""
        builder = (
            PromptBuilder()
            .set_role("Senior Vietnamese Exam Layout Engineer")
            .set_task("Extract multiple-choice questions from raw text.")
            .set_input({"raw_text": "Câu 1: Este X..."})
            .add_rule("Do not hallucinate.")
            .add_rule("Keep exact chemical formulas.")
            .set_schema(BatchResult)
            .set_uncertainty_policy("If unsure, mark confidence as low.")
        )
        prompt = builder.build()

        self.assertIn("# 1. ROLE", prompt)
        self.assertIn("Senior Vietnamese Exam Layout Engineer", prompt)
        self.assertIn("# 2. SINGLE TASK", prompt)
        self.assertIn("# 3. INPUT", prompt)
        self.assertIn("# 4. RULES", prompt)
        self.assertIn("- Do not hallucinate.", prompt)
        self.assertIn("# 5. OUTPUT SCHEMA", prompt)
        self.assertIn("BatchResult", prompt)
        self.assertIn("# 6. UNCERTAINTY POLICY", prompt)

    def test_prompt_builder_rejects_chain_of_thought(self):
        """Ensures PromptBuilder rejects Chain-of-Thought requests per Global Rule 12."""
        builder = (
            PromptBuilder()
            .set_role("Tutor")
            .set_task("Think step by step and solve the question.")  # Forbidden phrase
            .set_input("test")
            .add_rule("None")
            .set_schema(SimpleItem)
        )
        with self.assertRaises(ValueError) as ctx:
            builder.build()
        self.assertIn("Chain-of-Thought directive", str(ctx.exception))
        self.assertIn("Global Rule 12", str(ctx.exception))

    def test_prompt_builder_missing_blocks(self):
        """Ensures PromptBuilder fails if required blocks are empty."""
        builder = PromptBuilder().set_role("Expert")
        with self.assertRaises(ValueError):
            builder.build()

    def test_redact_sensitive_info(self):
        """Tests that API keys and token secrets are masked."""
        secret_key = "sk-agnes_secret_123456789abcdef"
        msg = f"Failed to connect using key {secret_key} and Bearer test_auth_token_value_xyz"
        redacted = redact_sensitive_info(msg, api_key=secret_key)

        self.assertNotIn(secret_key, redacted)
        self.assertIn("[REDACTED_API_KEY]", redacted)
        self.assertIn("[REDACTED_SECRET]", redacted)

    def test_json_salvage_truncated_stream(self):
        """Tests that truncated JSON is salvaged and validated."""
        # Simulated truncated JSON response (max_tokens cut off)
        truncated_raw = """
        ```json
        {
            "items": [
                {
                    "id": 1,
                    "stem": "Kim loại kiềm mềm nhất là gì?",
                    "answer": "Cs",
                    "confidence": "high"
                },
                {
                    "id": 2,
                    "stem": "Công thức của metan là gì?",
                    "answer": "CH4",
                    "confidence": "high"
        """
        salvaged = _salvage_truncated_json(truncated_raw)
        data = json.loads(salvaged)
        self.assertIn("items", data)
        self.assertEqual(len(data["items"]), 2)

        # Validate with Pydantic
        res = validate_structured_json(truncated_raw, BatchResult)
        self.assertEqual(len(res.items), 2)
        self.assertEqual(res.items[0].stem, "Kim loại kiềm mềm nhất là gì?")

    def test_validation_schema_mismatch(self):
        """Tests that invalid schema raises ProviderSchemaError."""
        invalid_json = '{"items": [{"id": "not_an_int", "stem": 123}]}'
        with self.assertRaises(ProviderSchemaError) as ctx:
            validate_structured_json(invalid_json, BatchResult)
        self.assertIn("Schema validation failed", str(ctx.exception))

    def test_mock_provider_happy_path(self):
        """Tests MockAIProvider standard output."""
        mock = MockAIProvider(preset_response={"id": 1, "stem": "Sample", "answer": "A", "confidence": "high"})
        res = mock.generate_structured(
            task_name="test_task",
            user_prompt="prompt",
            system_prompt="sys",
            schema=SimpleItem
        )
        self.assertEqual(res.id, 1)
        self.assertEqual(res.stem, "Sample")
        self.assertEqual(len(mock.call_history), 1)

    def test_mock_provider_fault_injections(self):
        """Tests MockAIProvider error simulations."""
        # 1. Timeout simulation
        mock_timeout = MockAIProvider(simulate_timeout=True)
        with self.assertRaises(ProviderTimeoutError):
            mock_timeout.generate_structured("task", "u", "s", SimpleItem)

        # 2. Auth error simulation
        mock_auth = MockAIProvider(simulate_http_401=True)
        with self.assertRaises(ProviderAuthError):
            mock_auth.generate_structured("task", "u", "s", SimpleItem)

        # 3. Rate limit simulation
        mock_rate = MockAIProvider(simulate_http_429=True)
        with self.assertRaises(ProviderRateLimitError):
            mock_rate.generate_structured("task", "u", "s", SimpleItem)

        # 4. 500 Internal error simulation
        mock_500 = MockAIProvider(simulate_http_500=True)
        with self.assertRaises(ProviderError):
            mock_500.generate_structured("task", "u", "s", SimpleItem)

        # 5. Missing fields simulation
        mock_missing = MockAIProvider(simulate_missing_fields=True)
        with self.assertRaises(ProviderSchemaError):
            mock_missing.generate_structured("task", "u", "s", SimpleItem)

        # 6. Transient failure recovered on attempt 3
        mock_transient = MockAIProvider(
            preset_response={"id": 1, "stem": "OK", "answer": "B", "confidence": "high"},
            failure_count_before_success=2
        )
        # First 2 fail
        with self.assertRaises(ProviderError):
            mock_transient.generate_structured("task", "u", "s", SimpleItem)
        with self.assertRaises(ProviderError):
            mock_transient.generate_structured("task", "u", "s", SimpleItem)
        # Third succeeds
        res = mock_transient.generate_structured("task", "u", "s", SimpleItem)
        self.assertEqual(res.answer, "B")

    @patch("urllib.request.urlopen")
    def test_agnes_provider_successful_call(self, mock_urlopen):
        """Tests AgnesAIProvider parsing valid response from mocked API."""
        fake_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({
                            "id": 101,
                            "stem": "Chất nào sau đây là este?",
                            "answer": "CH3COOC2H5",
                            "confidence": "high"
                        })
                    }
                }
            ]
        }
        mock_resp_obj = MagicMock()
        mock_resp_obj.read.return_value = json.dumps(fake_response).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp_obj

        config = ProviderConfig(api_key="test_dummy_key_12345678", max_retries=2)
        provider = AgnesAIProvider(config)

        res = provider.generate_structured(
            task_name="classify",
            user_prompt="Analyze this item",
            system_prompt="System instructions",
            schema=SimpleItem
        )

        self.assertEqual(res.id, 101)
        self.assertEqual(res.answer, "CH3COOC2H5")

    @patch("urllib.request.urlopen")
    def test_agnes_provider_vision_payload(self, mock_urlopen):
        """Tests that multimodal image_bytes are encoded as base64 in request."""
        fake_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({
                            "id": 5,
                            "stem": "Sơ đồ thể hiện quá trình gì?",
                            "answer": "Điện phân",
                            "confidence": "high"
                        })
                    }
                }
            ]
        }
        mock_resp_obj = MagicMock()
        mock_resp_obj.read.return_value = json.dumps(fake_response).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp_obj

        config = ProviderConfig(api_key="test_dummy_key_12345678")
        provider = AgnesAIProvider(config)

        sample_bytes = b"\x89PNG\r\n\x1a\n\x00sample"
        res = provider.generate_structured(
            task_name="vision_task",
            user_prompt="Examine diagram",
            system_prompt="Vision assistant",
            schema=SimpleItem,
            image_bytes=sample_bytes,
            image_mime="image/png"
        )

        self.assertEqual(res.id, 5)
        # Verify request sent to urlopen
        req_arg = mock_urlopen.call_args[0][0]
        req_body = json.loads(req_arg.data.decode("utf-8"))
        user_message_parts = req_body["messages"][1]["content"]
        self.assertIsInstance(user_message_parts, list)
        self.assertEqual(user_message_parts[1]["type"], "image_url")
        self.assertTrue(user_message_parts[1]["image_url"]["url"].startswith("data:image/png;base64,"))

    @patch("urllib.request.urlopen")
    def test_agnes_provider_fail_fast_on_401(self, mock_urlopen):
        """Tests that HTTP 401 raises ProviderAuthError immediately without retrying."""
        http_error = urllib.error.HTTPError(
            url="https://apihub.agnes-ai.com/v1/chat/completions",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=io.BytesIO(b'{"error": "Invalid API key"}')
        )
        mock_urlopen.side_effect = http_error

        config = ProviderConfig(api_key="invalid_test_key_12345", max_retries=3)
        provider = AgnesAIProvider(config)

        with self.assertRaises(ProviderAuthError):
            provider.generate_structured("task", "u", "s", SimpleItem)

        # Must fail immediately on attempt 1
        self.assertEqual(mock_urlopen.call_count, 1)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_agnes_provider_retries_on_500(self, mock_urlopen, mock_sleep):
        """Tests that HTTP 500 triggers retry with backoff and succeeds on retry."""
        http_500 = urllib.error.HTTPError(
            url="https://apihub.agnes-ai.com/v1/chat/completions",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=io.BytesIO(b'{"error": "Server overloaded"}')
        )

        success_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({
                            "id": 99,
                            "stem": "Success after retry",
                            "answer": "D",
                            "confidence": "high"
                        })
                    }
                }
            ]
        }
        mock_success_obj = MagicMock()
        mock_success_obj.read.return_value = json.dumps(success_response).encode("utf-8")

        # Fails first, succeeds second
        mock_urlopen.side_effect = [http_500, MagicMock(__enter__=MagicMock(return_value=mock_success_obj))]

        config = ProviderConfig(api_key="test_dummy_key_12345", max_retries=3)
        provider = AgnesAIProvider(config)

        res = provider.generate_structured("task", "u", "s", SimpleItem)
        self.assertEqual(res.id, 99)
        self.assertEqual(mock_urlopen.call_count, 2)
        mock_sleep.assert_called_once()


if __name__ == "__main__":
    unittest.main()
