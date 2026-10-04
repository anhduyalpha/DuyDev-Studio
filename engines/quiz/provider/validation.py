"""
JSON Salvage and Schema Validation Module
Provides robust recovery for truncated JSON streams and Pydantic v2 schema enforcement.
"""

import json
import re
from typing import TypeVar, Any
from pydantic import BaseModel, ValidationError
from .base import ProviderSchemaError

T = TypeVar("T", bound=BaseModel)


def extract_json_substring(text: str) -> str:
    """
    Extracts raw JSON content from markdown code fences or finds outermost JSON delimiters.
    Preserves trailing truncated content when JSON is incomplete so salvage can repair it.
    """
    clean_text = text.strip()

    # 1. Match complete code fence ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_text, re.IGNORECASE)
    if match:
        clean_text = match.group(1).strip()
    else:
        # Match unclosed code fence start ```json ...
        fence_start = re.search(r"```(?:json)?\s*([\s\S]*)", clean_text, re.IGNORECASE)
        if fence_start:
            clean_text = fence_start.group(1).strip()

    # 2. Find outermost '{' or '['
    start_brace = clean_text.find("{")
    start_bracket = clean_text.find("[")

    if start_brace == -1 and start_bracket == -1:
        return clean_text

    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        start_idx = start_brace
    else:
        start_idx = start_bracket

    # 3. Check if text from start_idx to the last closing delimiter is already valid JSON
    end_brace = clean_text.rfind("}")
    end_bracket = clean_text.rfind("]")
    end_idx = max(end_brace, end_bracket)

    if end_idx != -1 and end_idx > start_idx:
        candidate = clean_text[start_idx:end_idx + 1]
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    # If not valid JSON when cut at end_idx, retain full stream from start_idx for salvage
    return clean_text[start_idx:]


def _salvage_truncated_json(raw_text: str) -> str:
    """
    Attempts to salvage incomplete/truncated JSON resulting from max_tokens exhaustion.
    Closes unclosed strings, strips trailing incomplete properties, and balances braces/brackets.
    """
    candidate = extract_json_substring(raw_text)

    # If it parses directly, return as is
    try:
        json.loads(candidate)
        return candidate
    except Exception:
        pass

    # Step 1: Detect unclosed string literals
    in_string = False
    escaped = False

    for i, ch in enumerate(candidate):
        if ch == "\\" and not escaped:
            escaped = True
            continue
        if ch == '"' and not escaped:
            in_string = not in_string
        escaped = False

    if in_string:
        # String was cut off. Close the string.
        candidate = candidate + '"'

    # Step 2: Remove trailing hanging keys or dangling comma
    # e.g., '..., "key": ' or '..., "key"' or '..., '
    candidate = re.sub(r",\s*\"[^\"]*\"\s*:\s*$", "", candidate)
    candidate = re.sub(r",\s*\"[^\"]*\"\s*$", "", candidate)
    candidate = re.sub(r",\s*$", "", candidate)

    # Step 3: Stack balance for open delimiters
    stack: list[str] = []
    in_str = False
    esc = False

    for ch in candidate:
        if ch == "\\" and not esc:
            esc = True
            continue
        if ch == '"' and not esc:
            in_str = not in_str
        elif not in_str:
            if ch in ("{", "["):
                stack.append(ch)
            elif ch == "}":
                if stack and stack[-1] == "{":
                    stack.pop()
            elif ch == "]":
                if stack and stack[-1] == "[":
                    stack.pop()
        esc = False

    closing_tokens = []
    while stack:
        open_token = stack.pop()
        closing_tokens.append("}" if open_token == "{" else "]")

    salvaged = candidate + "".join(closing_tokens)

    # Test parse
    try:
        json.loads(salvaged)
        return salvaged
    except Exception:
        pass

    # Step 4: Fallback iterative truncation to last completed object in array
    # If salvaged failed, try trimming back to the last valid '}'
    last_curly = candidate.rfind("}")
    if last_curly != -1:
        trimmed = candidate[:last_curly + 1]
        stack = []
        for ch in trimmed:
            if ch in ("{", "["):
                stack.append(ch)
            elif ch == "}" and stack and stack[-1] == "{":
                stack.pop()
            elif ch == "]" and stack and stack[-1] == "[":
                stack.pop()
        closing = ["}" if op == "{" else "]" for op in reversed(stack)]
        sub_salvaged = trimmed + "".join(closing)
        try:
            json.loads(sub_salvaged)
            return sub_salvaged
        except Exception:
            pass

    return candidate


def validate_structured_json(raw_text: str, schema: type[T]) -> T:
    """
    Parses and validates raw AI text response into a Pydantic model T.
    Employs salvage logic for truncated responses.
    Raises ProviderSchemaError if JSON cannot be parsed or schema fails.
    """
    clean_json = extract_json_substring(raw_text)

    try:
        parsed_dict = json.loads(clean_json)
    except json.JSONDecodeError:
        # Try salvage
        salvaged_str = _salvage_truncated_json(raw_text)
        try:
            parsed_dict = json.loads(salvaged_str)
        except json.JSONDecodeError as err:
            raise ProviderSchemaError(
                f"Failed to parse AI response as JSON: {err}",
                raw_payload=raw_text
            ) from err

    try:
        return schema.model_validate(parsed_dict)
    except ValidationError as val_err:
        raise ProviderSchemaError(
            f"Schema validation failed against {schema.__name__}: {val_err.errors()}",
            raw_payload=raw_text,
            validation_details=val_err.errors()
        ) from val_err
