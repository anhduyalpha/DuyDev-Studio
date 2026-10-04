# TASK-04 — Agnes Provider & Structured Prompt Engine

## Goal

Make Agnes a replaceable provider and enforce structured tasks.

## Provider contract

Create interface conceptually equivalent to:

```python
generate_structured(
    task,
    payload,
    image=None,
    schema=None,
    temperature=0
)
```

## Configuration

- AGNES_API_KEY from server env;
- AGNES_BASE_URL;
- AGNES_MODEL;
- timeout;
- max tokens;
- retry config.

Never log API key.

## Prompt engine

Every task prompt must have:
- ROLE;
- SINGLE TASK;
- INPUT;
- RULES;
- OUTPUT SCHEMA;
- UNCERTAINTY POLICY.

## Important

Do not ask Agnes for chain-of-thought.

Use:
- answer;
- evidence;
- confidence.

## Parsing

- JSON parse;
- schema validation;
- retry invalid output;
- bounded retries;
- structured error.

## Provider abstraction

Later provider can be replaced without changing pipeline services.

## Acceptance

Unit tests with mocked Agnes:
- valid;
- malformed;
- missing fields;
- timeout;
- 5xx;
- empty response.
