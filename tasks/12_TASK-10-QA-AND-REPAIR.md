# TASK-10 — Geometry QA, Semantic QA, Visual QA, Safe Repair

## Goal

Do not trust a successful render. Verify both PDFs.

## QA 1 — Geometry

Code checks:
- page size;
- content bounds;
- overflow;
- clipping;
- overlap;
- image crop;
- bottom overflow;
- question split;
- orphan headings;
- suspicious whitespace.

## QA 2 — Semantic

Check:
- source question count vs IR;
- IR count vs answer count;
- question numbering;
- options completeness;
- output answer mapping;
- required files exist.

## QA 3 — Vision

Do NOT send every page to Agnes.

Run visual inspection only:
- on pages flagged by geometry QA;
- representative pages;
- rich-element-heavy pages.

Agnes output:
```json
{
  "status": "PASS|FAIL",
  "issues": [
    {
      "type": "overflow|overlap|bad_spacing|broken_formula|bad_crop|other",
      "page": 2,
      "severity": "low|medium|high",
      "description": "..."
    }
  ]
}
```

## Repair

AI produces safe repair instructions, not CSS.

Examples:
- reduce section margin;
- move image;
- select alternate option layout;
- reduce spacing;
- switch rich element fallback.

Code maps instruction → predefined renderer parameters.

## Limits

Maximum repair iterations: 2–3 configurable.

After limit:
`QA_FAILED` with diagnostic report.

## Acceptance

Known broken fixtures are detected.
Repair does not modify semantic content.
Both final PDFs must pass the final QA gate.
