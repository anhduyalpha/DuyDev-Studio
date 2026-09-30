# Dispatch: Worker M1 Fix (Remediation of Watermark Opacity Facade)

## Mission
Apply the exact remediation diffs specified by Explorer M1 Remediation:
Source Report: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_m1_remediation\report.md`

### 1. `engines/document/pdf_ops_advanced.py`
In `cmd_watermark`:
- When inserting watermark text:
  Pass `fill_opacity=opacity, stroke_opacity=opacity` directly to `shape.insert_text(..., fill_opacity=opacity, stroke_opacity=opacity)`.
  Remove the `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)` call (keep only `shape.commit()`).
- When inserting page numbers:
  Pass `fill_opacity=0.8, stroke_opacity=0.8` directly to `shape_num.insert_text(..., fill_opacity=0.8, stroke_opacity=0.8)`.
  Remove the `shape_num.finish(fill_opacity=0.8, stroke_opacity=0.8)` call (keep only `shape_num.commit()`).

### 2. `server/tests/unit/pdf.test.ts`
- In the watermark test (`should apply watermark with position and opacity`):
  Import `PDFName` from `'pdf-lib'`.
  Add robust assertions verifying that `/ExtGState` exists on page resources or within the PDF document context, and that opacity parameters (`/ca 0.5` and `/ca 0.8`) are genuinely present in the generated PDF stream.

## Write Ownership
You exclusively own and may edit:
- `engines/document/pdf_ops_advanced.py`
- `server/tests/unit/pdf.test.ts`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification Requirements
Run:
- `cd server && npx tsc --noEmit` -> 0 errors.
- `cd server && npx vitest run tests/unit/pdf.test.ts` -> 7/7 tests pass.
- Verify with python command that `/ExtGState` and `/ca` are present.
Deliver handoff.md and notify orchestrator when done.

## 2026-09-24T21:55:06Z
You are Worker M1 Fix.
Your working directory is: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1_fix
Read the original request at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md.
Read your detailed task at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1_fix\DISPATCH.md.
Read Explorer M1 Remediation's exact diff recommendations at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_m1_remediation\report.md.

Apply the changes:
1. `engines/document/pdf_ops_advanced.py`: pass `fill_opacity=opacity, stroke_opacity=opacity` directly to `shape.insert_text`, pass `fill_opacity=0.8, stroke_opacity=0.8` to `shape_num.insert_text`, and delete `.finish()` calls.
2. `server/tests/unit/pdf.test.ts`: add robust assertions verifying `/ExtGState` and `/ca 0.5` / `/ca 0.8`.

Run verifications:
- `cd server && npx tsc --noEmit`
- `cd server && npx vitest run tests/unit/pdf.test.ts`
Write handoff.md and notify orchestrator when done.

