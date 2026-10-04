# TASK-13 — Golden Tests, Regression & Performance

## Goal

Know whether a failure is AI, parsing, layout or rendering.

## Golden cases

Use supplied Ester source/output as a reference fixture where licensing/project policy allows.

Add fixtures for:
- vector text;
- scan;
- mixed PDF;
- split-page question;
- formula-heavy;
- long options;
- images;
- tables;
- Part I/II/III.

## Metrics

Semantic:
- question recall;
- option completeness;
- numbering accuracy;
- section classification;
- answer coverage.

Rendering:
- page count;
- overflow;
- overlap;
- split question count;
- image crop correctness.

Performance:
- end-to-end latency;
- AI call count;
- batch count;
- per-batch latency;
- render time;
- PDF size.

## AI call budget

Record:
```json
{
  "ai_calls": 0,
  "vision_calls": 0,
  "batches": 0,
  "retries": 0
}
```

Regression should fail if calls unexpectedly explode for a normal 20–30 question vector PDF.

## Acceptance

A pipeline change must not silently increase AI calls without justification.
Tests produce machine-readable report.
