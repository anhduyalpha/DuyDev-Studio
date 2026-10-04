# PLAN-02 — Atomic Question Pagination

## Includes

- TASK-03

## Goal

Guarantee that a normal multiple-choice question never loses an option or
places a stray option on the next page.

## Implementation order

1. Inspect current HTML question structure.
2. Inspect current CSS page-break rules.
3. Inspect pre-render pagination/height estimation.
4. Create a single atomic QuestionBlock abstraction.
5. Measure full block height where possible.
6. Move full block to next page when remaining space is insufficient.
7. Add post-render option-integrity QA.
8. Add reflow fallback for rich-element questions.
9. Add regression fixture matching the production bug.
10. Run all existing PDF tests.

## Engineering principle

Correctness takes priority over squeezing an extra question into a page.

## Exit criteria

- A/B/C/D always appear;
- no option is silently dropped;
- question + rich elements remain coherent;
- old output remains stable where it already passed.
