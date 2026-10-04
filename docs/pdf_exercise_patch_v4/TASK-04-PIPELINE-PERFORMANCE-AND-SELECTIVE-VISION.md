# TASK-04 — Pipeline Performance, Adaptive Batching & Selective Vision

## Context

The production module has good output quality but is slower than desired.

## Objective

Reduce latency and AI calls without sacrificing semantic accuracy.

## Scope

Optimize runtime behavior only. Do not reduce quality by blindly lowering
model calls.

## Required architecture

### Stage 1 — Code fast path

Use code for:
- PDF fetch;
- page count;
- text extraction;
- block extraction;
- bbox;
- image/object extraction;
- obvious question numbering;
- obvious section headers;
- obvious option boundaries.

Do not ask Agnes to perform deterministic operations.

### Stage 2 — Adaptive batching

Default target:
- normal vector/text: 10–15 questions;
- formula-heavy: 6–10;
- visual-heavy: 3–6;
- scan: 2–4 pages.

Batch size must be configurable.

### Stage 3 — Parallelism

Independent batches may execute concurrently when safe with:
- provider rate limits;
- server CPU/RAM;
- job concurrency limit.

Preserve deterministic final ordering.

### Stage 4 — Selective vision

Do not send every page/image to Agnes.

Escalate to vision only for:
- ambiguous boundary;
- ambiguous question/asset relationship;
- unreadable/OCR conflict;
- complex diagram/table;
- QA-detected rendering issue.

Cache repeated vision requests by content hash + prompt version.

### Stage 5 — Retry discipline

Retry:
- transient API errors;
- invalid structured response.

Do not retry:
- deterministic validation failures that can be fixed by code;
- the same successful request without a reason.

Use bounded retries.

## Metrics

For every job, record:

```json
{
  "ai_calls": 0,
  "vision_calls": 0,
  "batches": 0,
  "retries": 0,
  "cache_hits": 0,
  "pipeline_ms": 0
}
```

Do not log secret values.

## Acceptance criteria

1. Normal vector PDF uses batching instead of one AI call per question.
2. Deterministic extraction does not call Agnes.
3. Independent batches can run concurrently when enabled.
4. Vision is selective.
5. Repeated identical vision requests are cacheable.
6. Output semantic quality remains unchanged on regression fixtures.
7. Measure before/after latency and AI call count.
8. No new unbounded concurrency or retry loop.
