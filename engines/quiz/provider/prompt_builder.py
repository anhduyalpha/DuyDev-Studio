"""
Structured Prompt Builder Module
Enforces the mandatory 6-block prompt architecture for all AI interactions:
1. ROLE
2. SINGLE TASK
3. INPUT
4. RULES
5. OUTPUT SCHEMA
6. UNCERTAINTY POLICY
"""

import json
from typing import Any, Optional, Type
from pydantic import BaseModel


FORBIDDEN_COT_PHRASES = [
    "think step by step",
    "let's think",
    "suy nghĩ từng bước",
    "giải thích từng bước",
    "chain of thought"
]


class PromptBuilder:
    """
    Fluent builder for structured, deterministic prompts.
    Guarantees compliance with Global Rules 12 (No CoT) and 14 (Batching support).
    """

    def __init__(self):
        self._role: str = ""
        self._task: str = ""
        self._input_data: str = ""
        self._rules: list[str] = []
        self._output_schema: str = ""
        self._uncertainty_policy: str = (
            "- If any item is ambiguous or truncated, record evidence and set confidence='low'.\n"
            "- Never hallucinate content that is not present in the input."
        )

    def set_role(self, role: str) -> "PromptBuilder":
        """Defines the specialized agent persona and domain context."""
        self._role = role.strip()
        return self

    def set_task(self, task: str) -> "PromptBuilder":
        """Defines the single, focused objective."""
        self._task = task.strip()
        return self

    def set_input(self, data: Any) -> "PromptBuilder":
        """Sets the cleaned input payload (dict, list, or string)."""
        if isinstance(data, (dict, list)):
            self._input_data = json.dumps(data, ensure_ascii=False, indent=2)
        else:
            self._input_data = str(data).strip()
        return self

    def add_rule(self, rule: str) -> "PromptBuilder":
        """Appends a negative or positive constraint rule."""
        rule_clean = rule.strip()
        if rule_clean:
            self._rules.append(rule_clean)
        return self

    def set_rules(self, rules: list[str]) -> "PromptBuilder":
        """Sets the complete list of rules."""
        self._rules = [r.strip() for r in rules if r.strip()]
        return self

    def set_schema(self, schema_or_model: Any) -> "PromptBuilder":
        """Sets the required JSON schema from a Pydantic model, dict, or JSON string."""
        if isinstance(schema_or_model, type) and issubclass(schema_or_model, BaseModel):
            schema_dict = schema_or_model.model_json_schema()
            self._output_schema = json.dumps(schema_dict, ensure_ascii=False, indent=2)
        elif isinstance(schema_or_model, dict):
            self._output_schema = json.dumps(schema_or_model, ensure_ascii=False, indent=2)
        else:
            self._output_schema = str(schema_or_model).strip()
        return self

    def set_uncertainty_policy(self, policy: str) -> "PromptBuilder":
        """Defines how the model should behave under ambiguity or partial data."""
        self._uncertainty_policy = policy.strip()
        return self

    def build(self) -> str:
        """
        Validates all blocks and compiles into the standardized 6-block markdown prompt.
        Raises ValueError if required blocks are missing or if forbidden CoT phrases are detected.
        """
        if not self._role:
            raise ValueError("PromptBuilder error: ROLE block is missing or empty.")
        if not self._task:
            raise ValueError("PromptBuilder error: SINGLE TASK block is missing or empty.")
        if not self._input_data:
            raise ValueError("PromptBuilder error: INPUT block is missing or empty.")
        if not self._rules:
            raise ValueError("PromptBuilder error: RULES block is missing or empty.")
        if not self._output_schema:
            raise ValueError("PromptBuilder error: OUTPUT SCHEMA block is missing or empty.")
        if not self._uncertainty_policy:
            raise ValueError("PromptBuilder error: UNCERTAINTY POLICY block is missing or empty.")

        # Enforce Rule 12: No Chain-of-Thought
        full_text_lower = f"{self._role} {self._task} {' '.join(self._rules)}".lower()
        for phrase in FORBIDDEN_COT_PHRASES:
            if phrase in full_text_lower:
                raise ValueError(
                    f"PromptBuilder error: Forbidden Chain-of-Thought directive '{phrase}' detected. "
                    "Global Rule 12 strictly forbids requesting CoT. Use structured fields {answer, evidence, confidence} instead."
                )

        formatted_rules = "\n".join(f"- {r}" for r in self._rules)

        blocks = [
            f"# 1. ROLE\n{self._role}",
            f"# 2. SINGLE TASK\n{self._task}",
            f"# 3. INPUT\n```json\n{self._input_data}\n```" if self._input_data.startswith(("{", "[")) else f"# 3. INPUT\n{self._input_data}",
            f"# 4. RULES\n{formatted_rules}",
            f"# 5. OUTPUT SCHEMA\nStrictly respond with a single valid JSON object matching this schema:\n```json\n{self._output_schema}\n```",
            f"# 6. UNCERTAINTY POLICY\n{self._uncertainty_policy}"
        ]

        return "\n\n".join(blocks)
