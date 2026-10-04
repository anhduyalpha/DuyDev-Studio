# TASK-06 — Batched Question Reconstruction & Section Classification

## Goal

Turn page text/geometry/images into question records.

## First principles

Do not use one Agnes call per question.

Use `BatchPlanner`.

Default adaptive batch sizes:
- text/vector: 10–15;
- formula-heavy: 6–10;
- visual-heavy: 3–6;
- scan: 2–4 pages.

## Batch input

A batch may contain:
- OCR/plain text;
- source page IDs;
- relevant text blocks;
- selected page image/crops;
- neighboring page context for boundary cases.

## Agnes responsibilities

- reconstruct one question from multiple blocks/pages;
- determine whether content is:
  - Part I multiple-choice;
  - Part II true/false;
  - Part III short answer;
  - instruction/section/header;
- map A/B/C/D to the correct question;
- identify continuation;
- mark uncertainty.

## Code responsibilities

- stable IDs;
- page/bbox provenance;
- ordering;
- deduplication;
- batch aggregation.

## Output

Each question must include:
- id;
- number;
- type;
- stem;
- options if applicable;
- source pages;
- source block IDs;
- confidence;
- warnings.

## Parallelism

Independent batches may execute concurrently if:
- API rate limit allows;
- CPU/memory allow;
- result order is normalized afterward.

## Acceptance

- no question duplicated;
- no question lost;
- split-page questions reconstructed;
- section type correct;
- output schema validated.
