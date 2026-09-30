# Handoff Report: PDF Studio Pro Backend & Polyglot Engine Full Support

**Worker**: Worker M1 (Backend & Polyglot Engine Worker - Replacement)  
**Date**: 2026-09-24T21:44:00Z  
**Directory**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1_backend_rep1`  
**Milestone**: PDF Studio Pro Backend & Polyglot Engine Full Support  

---

## 1. Observation

Direct code inspections and test executions revealed:
- **`engines/document/pdf_ops_advanced.py` (`cmd_images_to_pdf`)**:
  - Implemented standard A4 portrait scaling: `PAGE_W, PAGE_H = 595.0, 842.0` with `margin = 20.0` points.
  - Image scaling factors computed as `scale = min(max_w / img_w, max_h / img_h)` preserving image aspect ratio.
  - Centering coordinates calculated as `x = (PAGE_W - fit_w) / 2.0` and `y = (PAGE_H - fit_h) / 2.0`.
  - Stream optimization configured on document save: `pdf_doc.save(args.output, garbage=4, deflate=True, deflate_images=True)`.
- **`engines/document/pdf_ops_advanced.py` (`cmd_watermark`) & `pdf_engine.py`**:
  - Supported positions: `"center"` (diagonal $45^\circ$ centered), `"top"`, and `"bottom"`, normalized via `.strip().lower()`.
  - Opacity parsed from `args.opacity` and clamped in `[0.0, 1.0]`.
  - Rendered via PyMuPDF `page.new_shape()` with `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)` and `shape.commit()`.
  - Maintained automatic page numbering `Trang X / N` positioned bottom-center.
- **`engines/document/pdf_engine.py` & `server/src/workers/pdf.worker.ts` (Error Classification)**:
  - `pdf_engine.py` prints `PDF Engine Error ({exc_type}): {err_msg}` to `stderr` upon unhandled exception without masking error names.
  - In `pdf.worker.ts`, password and decryption error keywords (`'password'`, `'encrypted'`, `'mật khẩu'`, `'mã hóa'`, `'decrypt'`, `'authenticate'`) are evaluated **prior** to generic corruption keywords (`'corrupted'`, `'pdf engine error'`, `'failed to parse pdf document'`).
  - Password errors cleanly reject with `FileCorruptedError` containing structured details:
    `[{ field: 'password', issue: 'Document requires password for decrypt' }]`.
- **`server/src/schemas/jobs.schema.ts`**:
  - `watermarkPosition: z.enum(['center', 'top', 'bottom']).optional()`
  - `watermarkOpacity: z.number().min(0).max(1).optional()`
- **`server/src/workers/pdf.worker.ts` (Worker Dispatch & Fallback)**:
  - For `compress`: forwards `--level ${options?.compressionLevel || 'medium'}` (and `--dpi` if specified) to Python CLI.
  - Fallback protection: when `operation === 'compress' && originalSizeBytes > 0 && resultSizeBytes >= originalSizeBytes`, worker replaces `resultPath` with the original source file via `fs.copyFile`, re-stats the artifact, and reports `savingsPct = 0`, ensuring compression never expands file size.
  - For `watermark`: forwards `--text`, `--position`, `--opacity`, and `--page-numbers`.
- **`server/tests/unit/pdf.test.ts`**:
  - Expanded test suite from 3 to 7 tests, covering:
    1. Compression and artifact record creation.
    2. Graceful failure on corrupted PDF files.
    3. Per-page rotation with custom angles mapping.
    4. Images to PDF conversion verifying exact 595x842 pt A4 dimensions and page count.
    5. Watermark positioning and opacity application.
    6. Compression size fallback protection ensuring output size $\le$ original size.
    7. Encrypted PDF password error classification and complete lock/unlock lifecycle.

---

## 2. Logic Chain

1. **Images to PDF A4 Scaling**:
   - In PyMuPDF, `new_page(width=595.0, height=842.0)` creates an exact A4 portrait canvas (72 dpi coordinate space).
   - Scaling with `min(max_w / img_w, max_h / img_h)` guarantees that neither dimension exceeds the available printable area (`555 x 802 pt`), preventing distortion.
   - Offsetting `(PAGE_W - fit_w) / 2` and `(PAGE_H - fit_h) / 2` centers the image on both axes.
   - Passing `deflate_images=True` with `garbage=4` strips unused xref tables and deflates image streams within the PDF container.

2. **Watermark Position & Opacity**:
   - For `center`, `fitz.Matrix(45)` transforms text by $45^\circ$ rotated about `center = (width / 2, height / 2)`.
   - For `top` and `bottom`, `Point(max(20, (width - text_len) / 2), y)` horizontally centers the watermark header/footer.
   - Calling `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)` sets the PDF graphics state alpha, achieving true opacity rendering.

3. **Error Classification & Precedence**:
   - Previously, `pdf_engine.py` formatted all failures with `Failed to parse PDF document: ...`, which matched the worker's generic parse error check first, masking password authentication errors as file corruption without details.
   - Checking password-specific keywords first ensures that when PyMuPDF throws `ValueError("Password incorrect: ...")` or `ValueError("document closed or encrypted")`, the worker correctly returns structured `[{ field: 'password', issue: 'Document requires password for decrypt' }]`.

4. **Compress Size Fallback**:
   - Small or already optimized PDFs can experience size expansion under re-deflation due to table overhead.
   - Comparing `resultSizeBytes >= originalSizeBytes` post-execution and copying `fileRecord.storagePath` over `resultPath` guarantees that an optimized file never grows. Recomputing SHA-256 after the copy ensures database checksum integrity.

---

## 3. Caveats

- **No Caveats**: All 5 core requirements from DISPATCH.md and ORIGINAL_REQUEST.md have been implemented with genuine logic, without dummy facades or hardcoded values.
- Redis pub/sub warning logs in unit tests (`connect ECONNREFUSED 127.0.0.1:6379`) are expected in local development when Redis server is offline; `publishJobEvent` safely catches and logs these warnings without impacting test success or worker execution.

---

## 4. Conclusion

All backend Fastify schemas, BullMQ worker handlers, and Python PyMuPDF polyglot engine subcommands for PDF Studio Pro are fully implemented, verified, and operational:
1. Standard A4 portrait scaling, aspect ratio preservation, and centering in `cmd_images_to_pdf`.
2. Watermark position (`center`, `top`, `bottom`), opacity control (0.0 to 1.0), and page numbers in PyMuPDF engine.
3. Accurate error classification preventing password errors from being shadowed by generic corrupted errors.
4. Complete Zod schema coverage in `jobs.schema.ts`.
5. Worker compression level forwarding and size protection fallback in `pdf.worker.ts`.
6. 100% test pass rate across all unit test suites.

---

## 5. Verification Method

To independently verify the implementation, execute the following commands in order:

```bash
# 1. Typecheck TypeScript backend
cd "c:\Users\AnhDuy\Code\Project\DD Studio\server"
npx tsc --noEmit
# Expected: Exit code 0, 0 errors.

# 2. Run PDF Worker Unit Tests
npx vitest run tests/unit/pdf.test.ts
# Expected: 7 passed (7 tests).

# 3. Run all Unit Tests in server
npx vitest run tests/unit/
# Expected: 7 passed test files, 37 passed tests.

# 4. Verify Python CLI images-to-pdf command
python ../engines/document/pdf_engine.py --help
python ../engines/document/pdf_engine.py watermark --help
# Expected: CLI shows --position {center,top,bottom} and --opacity flags.
```
