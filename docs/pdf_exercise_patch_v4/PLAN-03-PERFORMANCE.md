# PLAN-03 — Performance, Adaptive Batching & Selective Vision

## Includes

- TASK-04

## Goal

Reduce end-to-end latency and Agnes calls while preserving current quality.

## Implementation order

1. Instrument current pipeline.
2. Measure baseline:
   - total latency;
   - AI calls;
   - vision calls;
   - batches;
   - retries.
3. Identify sequential AI calls.
4. Add deterministic fast-path where safe.
5. Add adaptive BatchPlanner.
6. Add bounded parallel execution.
7. Add selective vision escalation.
8. Add response/cache key.
9. Add retry/backoff limits.
10. Compare before/after on regression PDFs.
11. Ensure final semantic output is unchanged.

## Important

Do not optimize only by reducing the number of AI calls.
A lower call count that causes more reconstruction errors is a regression.

## Suggested target

For an ordinary vector PDF with 20–30 text-dominant questions, AI calls should
scale with batches/ambiguities rather than one call per question.

Do not hard-code a universal target that conflicts with real API rate limits;
measure and tune using the provider behavior available in production.

## Exit criteria

- benchmark report exists;
- latency improves measurably;
- AI call count does not grow linearly with question count on normal vector PDFs;
- no quality regression;
- bounded concurrency/retry.
