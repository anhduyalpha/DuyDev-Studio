# Dispatch: Explorer M1 Remediation (Forensic Audit Failure)

## Mission
Analyze and devise the exact technical remediation plan for the Forensic Audit Failure in Milestone M1 (Backend & Polyglot Engine):

### FULL AUDITOR EVIDENCE REPORT (UNFILTERED):
Source: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\auditor_pdf_m1_1\handoff.md`

1. **Watermark Opacity Facade**:
   - In `engines/document/pdf_ops_advanced.py` lines 142–169:
     Worker called `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)` on text.
     In PyMuPDF, `Shape.finish()` applies ONLY to drawing paths (lines, rectangles), and has NO EFFECT on text inserted via `shape.insert_text()`.
     The decompressed PDF content stream contained 0 `/ExtGState` dictionaries and 0 `/ca` / `/CA` operators. Text was rendered at 100% solid opacity.
   - Solution required: In `engines/document/pdf_ops_advanced.py`, pass `fill_opacity=opacity, stroke_opacity=opacity` directly as keyword arguments to `shape.insert_text(..., fill_opacity=opacity, stroke_opacity=opacity)` and `shape_num.insert_text(..., fill_opacity=0.8, stroke_opacity=0.8)`.
2. **Superficial Test Assertion**:
   - In `server/tests/unit/pdf.test.ts` lines 251–299, the watermark test only asserted `expect(pdfDoc.getPageCount()).toBe(2)`.
   - Solution required: Update the unit test in `server/tests/unit/pdf.test.ts` to inspect the generated PDF's contents stream or xref objects to verify that `/ExtGState` or `/ca` is actually present in the generated PDF.

## Instructions
- Provide exact line-by-line diff recommendations for `engines/document/pdf_ops_advanced.py` and `server/tests/unit/pdf.test.ts`.
- Output your report to `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_m1_remediation\report.md` and write `handoff.md`.

## 2026-09-24T21:50:01Z
You are Explorer M1 Remediation.
Working directory: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_m1_remediation
Read the original request at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md.
Read your task assignment and the UNFILTERED AUDITOR EVIDENCE REPORT at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_m1_remediation\DISPATCH.md.
Read the full auditor handoff at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\auditor_pdf_m1_1\handoff.md.

Investigate:
1. Exact changes needed in `engines/document/pdf_ops_advanced.py` so `shape.insert_text` receives `fill_opacity=opacity, stroke_opacity=opacity` directly and emits true `/ExtGState` graphics state alpha in PyMuPDF.
2. Exact test assertions to add in `server/tests/unit/pdf.test.ts` to independently verify `/ExtGState` or `/ca` in the generated PDF stream.

Deliver your report and handoff.md, then notify orchestrator.
