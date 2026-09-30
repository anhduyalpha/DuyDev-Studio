# Dispatch: Worker M1 - Backend & Polyglot Engine Full Support

## Mission
Implement backend and PyMuPDF engine enhancements for PDF Studio Pro in DuyDev Studio (DS):
1. **A4 Portrait Scaling in `cmd_images_to_pdf` (`engines/document/pdf_ops_advanced.py`)**:
   - Create standard A4 portrait pages (595 x 842 pt).
   - Fit image within 595 x 842 pt, preserving aspect ratio, and center it on the page.
   - Optimize image compression stream.
2. **Watermark Enhancements (`engines/document/pdf_ops_advanced.py`)**:
   - Support `watermarkPosition` (`center` [diagonal 45°], `top`, `bottom`).
   - Support `watermarkOpacity` (0.0 to 1.0) using PyMuPDF `Shape` with `fill_opacity` and `stroke_opacity`.
   - Preserve existing page numbering support (`Trang X / N`).
3. **Engine Error Formatting (`engines/document/pdf_engine.py`)**:
   - In the CLI argument parser / subcommands, accept `--position` and `--opacity` for `watermark`.
   - In `pdf_engine.py` exception handler, do not blindly prefix all errors with "Failed to parse PDF document:". Use `sys.stderr.write(f"PDF Engine Error: {err_msg}\n")` or preserve the specific exception type so password errors are clearly identified.
4. **Zod Validation Schema (`server/src/schemas/jobs.schema.ts`)**:
   - Add `watermarkPosition: z.enum(['center', 'top', 'bottom']).optional()`
   - Add `watermarkOpacity: z.number().min(0).max(1).optional()` to `pdfJobOptionsSchema`.
5. **BullMQ Worker (`server/src/workers/pdf.worker.ts`)**:
   - In `handleCompressJob`: pass `--level` (and `--dpi` if applicable) to Python CLI.
   - Size protection fallback: if `resultSizeBytes >= originalSizeBytes`, revert output file to the original file content so compression never enlarges the file.
   - In `handleWatermarkJob`: pass `--position` and `--opacity` to Python CLI.
   - Error classification: check for password/encryption error strings BEFORE checking for generic corrupted error strings.

## Write Ownership
You exclusively own and may edit:
- `engines/document/pdf_engine.py`
- `engines/document/pdf_ops_advanced.py`
- `engines/document/pdf_ops_basic.py`
- `server/src/schemas/jobs.schema.ts`
- `server/src/workers/pdf.worker.ts`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification Requirements
You MUST run:
1. `cd server && npx tsc --noEmit` -> Must pass with 0 errors.
2. `cd server && npx vitest run tests/unit/pdf.test.ts` -> All tests must pass.
3. Verify Python engine commands with test scripts/invocations.
Document all results in your `handoff.md` and notify orchestrator when done.

## 2026-09-24T17:56:48Z
You are Worker M1: Backend & Polyglot Engine Worker.
Task: Implement backend and PyMuPDF engine enhancements for PDF Studio Pro in DuyDev Studio (DS).
1. Standard A4 portrait scaling (595x842 pt), aspect ratio preservation, and centering in `engines/document/pdf_ops_advanced.py` (`cmd_images_to_pdf`).
2. Watermark position (`center`, `top`, `bottom`) and opacity in `engines/document/pdf_ops_advanced.py` and `engines/document/pdf_engine.py`.
3. Error classification fix in `engines/document/pdf_engine.py` and `server/src/workers/pdf.worker.ts` so password errors are not shadowed by generic corrupted errors.
4. Schema updates in `server/src/schemas/jobs.schema.ts`.
5. Worker updates in `server/src/workers/pdf.worker.ts` (pass `--level` to compress, size protection fallback, pass `--position` and `--opacity` to watermark).

