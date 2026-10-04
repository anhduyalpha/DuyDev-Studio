# TASK-03 — Atomic Question Pagination

## Context

Production output still has an edge case where a multiple-choice question
has four options and the last short option can move to the next page or
disappear. This is a renderer/pagination integrity bug, not an Agnes content
bug.

## Objective

Make the entire question block atomic for normal pagination.

## Atomic block

For a normal multiple-choice question:

```text
QuestionBlock
 ├── stem
 ├── rich elements belonging to stem
 └── options A/B/C/D
```

The renderer must treat the complete block as the unit that is moved across
pages.

## Required behavior

Before placing a question:

1. Estimate/render required height for the entire question block.
2. Calculate remaining page height.
3. If the full block does not fit:
   - move the complete block to the next page.
4. Do not place A/B/C on one page and D on the next for a normal question.
5. Do not drop a detached option.
6. Do not rely solely on CSS `break-inside: avoid`; ensure the HTML structure,
   pagination strategy and renderer measurements all support atomic placement.

## Option integrity

Before compilation:
- expected options must be present in IR;
- renderer must render every option record;
- rendered output must be checked for each option label.

If one option is outside the visible page bounds after rendering:
- QA must flag it;
- renderer should reflow/move the question;
- never silently discard it.

## Large-question exception

If one question genuinely cannot fit on a single A4 page:
- use an explicit oversized-question policy;
- preserve all content;
- never silently lose options or rich elements.

## Acceptance criteria

1. A/B/C/D remain together for standard multiple-choice questions.
2. No option can disappear because of a page break.
3. Questions with images still paginate atomically.
4. Questions close to the bottom margin are reflowed safely.
5. Automated regression fixture reproduces the old failure and now passes.
6. Page count may increase if required for correctness; readability and
   completeness have priority over squeezing content.
