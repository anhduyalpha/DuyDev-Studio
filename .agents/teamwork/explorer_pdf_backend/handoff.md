# Handoff Report: Backend & Polyglot Engine Investigation

**Sender**: Explorer 1 (`explorer_pdf_backend`)  
**Recipient**: Parent Orchestrator (`parent`, id: `fc24d654-ab09-4169-9325-66e8b92df489`)  
**Handoff Type**: Hard (Task Complete)  
**Date**: 2026-09-24  
**Reference Report**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend\report.md`

---

## 1. Observation

1. **Routing Layer**:
   - `server/src/api/routes/jobs.route.ts` lines 4-8:
     ```typescript
     export async function jobsRoute(app: FastifyInstance) {
       app.post('/api/v1/jobs/pdf', enqueuePdfJob);
       app.get('/api/v1/jobs/:jobId/events', getJobEvents);
       app.get('/api/v1/jobs/:jobId', getJobStatus);
     }
     ```
   - No separate `server/src/api/routes/pdf.routes.ts` or `pdf.controller.ts` exists.
   - File upload is handled via `POST /api/v1/files/upload` (`files.route.ts:5`), file view is `GET /api/v1/files/view/:fileId` (`files.route.ts:7`), and file download is `GET /api/v1/files/download/:fileId` (`files.route.ts:6`).

2. **Schema & Validation**:
   - `server/src/schemas/jobs.schema.ts` lines 3-27:
     `pdfOperationSchema` defines 10 operations: `'compress', 'convert', 'merge', 'split', 'lock', 'unlock', 'rotate', 'images_to_pdf', 'watermark', 'extract_images'`.
     `pdfJobOptionsSchema` does NOT define `watermarkPosition` or `watermarkOpacity`.
     `password` is marked `.optional()`, allowing missing passwords on `lock` and `unlock` to bypass schema validation.

3. **BullMQ Queue & Worker**:
   - `server/src/queues/task.queue.ts` lines 22-24: `taskQueue` is registered with name `'ds-tasks'`.
   - `server/src/workers/pdf.worker.ts` lines 224-234: `_workerInstance` processes `'ds-tasks'` with concurrency `limits.workerConcurrency.pdf = 4`.
   - `server/src/workers/pdf.worker.ts` lines 150-169: For `compress`, worker does NOT pass `--level` or `--dpi` to Python.
   - `server/src/workers/pdf.worker.ts` lines 192-195: If `resultSizeBytes >= originalSizeBytes`, it calculates `savingsPct = 0` but retains the larger output file on disk without fallback to the original.
   - `server/src/workers/pdf.worker.ts` lines 76-82:
     ```typescript
     const lowerErr = stderr.toLowerCase();
     if (['corrupted', 'no pdf header found', 'failed to parse pdf document', 'filedataerror', 'cannot open broken'].some((k) => lowerErr.includes(k))) {
       return reject(new FileCorruptedError(`Failed to parse PDF document: ${stderr.trim()}`));
     }
     if (lowerErr.includes('password') || lowerErr.includes('encrypted')) {
       return reject(new FileCorruptedError('The uploaded PDF structure is invalid or password-protected.', [{ field: 'password', issue: 'Document requires password for decrypt' }]));
     }
     ```

4. **Python Engine (`engines/document/`)**:
   - `engines/document/pdf_engine.py` line 117:
     ```python
     except Exception as exc:
         err_msg = str(exc)
         sys.stderr.write(f"Failed to parse PDF document: {err_msg}\n")
         sys.exit(1)
     ```
     Because all errors are prefixed with `"Failed to parse PDF document:"`, the first condition in `pdf.worker.ts` line 77 ALWAYS triggers for all errors, completely shadowing the password error check at line 80.
   - `engines/document/pdf_ops_advanced.py` lines 89-91 (`cmd_images_to_pdf`):
     ```python
     page = pdf_doc.new_page(width=rect.width, height=rect.height)
     page.show_pdf_page(rect, img_pdf, 0)
     ```
     Sets page dimensions directly to raw image pixel dimensions rather than standard A4 portrait ($595 \times 842$ pt), and does not center the image.
   - `engines/document/pdf_ops_advanced.py` lines 115-118 (`cmd_watermark`):
     Watermark only inserts diagonal text at `(rect.width / 4, rect.height / 2)` with fixed `color=(0.7, 0.7, 0.7)`. No position ('center', 'top', 'bottom') or opacity argument is processed.
   - `engines/document/pdf_ops_basic.py` lines 32-38 (`cmd_compress`):
     `args.level` and `args.dpi` are not used. It only runs `doc.save(garbage=4, deflate=True, clean=True, linear=False)` without image downsampling.

5. **Streaming & Integrity**:
   - `server/src/storage/storage.manager.ts` lines 59-67: `StorageManager.computeSha256` uses `createReadStream(filePath)` and pipe chunks to `crypto.createHash('sha256')`. Memory consumption is constant $O(1)$.
   - `server/src/lib/errors.ts` lines 55-59: `FileCorruptedError` maps to HTTP status 422 (`FILE_CORRUPTED`).
   - `npx vitest run tests/unit/pdf.test.ts` ran 3 tests and passed 100% in 1.77s. All 14 server test suites passed (76 tests in 13.38s).

---

## 2. Logic Chain

1. **Routing Logic**:
   - From Observation 1, the frontend PDF workspace (`pdfApi.js`) calls `POST /api/v1/jobs/pdf`, which is routed through `jobs.route.ts` and `jobs.controller.ts`.
   - Therefore, there is no missing routing functionality, but rather a structural difference from the prompt's suggested filenames (`pdf.routes.ts`/`pdf.controller.ts`). The existing architecture keeps all background task enqueuing consolidated in `jobs.*`.

2. **Operation 4 (Images to PDF) Logic**:
   - Requirement R2.4 states: "Tự động căn chỉnh ảnh vừa khổ giấy chuẩn A4 portrait (595x842 pt), giữ nguyên tỷ lệ khung hình (aspect ratio), căn giữa trang và nén stream ảnh tối ưu."
   - From Observation 4, `cmd_images_to_pdf` executes `page = pdf_doc.new_page(width=rect.width, height=rect.height)`.
   - Therefore, images are rendered at their native pixel dimensions as page boundaries. For instance, a $1920 \times 1080$ landscape image creates a $1920 \times 1080$ pt page instead of fitting centered into a $595 \times 842$ pt A4 portrait page. This violates Requirement R2.4.

3. **Operation 5 (Compress) Logic**:
   - Requirement R2.5 states: "3 cấp độ rõ ràng: Nén cao (high), Cân bằng (medium), Nén nhẹ (low)... Nếu tệp đã tối ưu sẵn mà việc nén làm tăng kích thước, tự động giữ nguyên tệp gốc."
   - From Observation 3 & 4, the worker does not forward `--level` or `--dpi`, `cmd_compress` ignores those CLI args, and the worker does not revert to the original file when `resultSizeBytes >= originalSizeBytes`.
   - Therefore, compression does not adapt to the selected preset and lacks size-increase protection.

4. **Operation 8 (Watermark) Logic**:
   - Requirement R2.8 states: "chọn vị trí (Chéo giữa trang, Đầu trang, Chân trang), độ mờ (Opacity) và tùy chọn đánh số trang tự động (Trang X / N)."
   - From Observations 2, 3, and 4, `watermarkPosition` and `watermarkOpacity` are missing from `jobs.schema.ts`, `pdf.worker.ts`, `pdf_engine.py`, and `pdf_ops_advanced.py`.
   - Therefore, users cannot control watermark position or transparency.

5. **Error Masking Logic**:
   - In `pdf_ops_advanced.py:cmd_unlock`, an invalid password raises `ValueError("Mật khẩu không chính xác hoặc không đủ quyền mở khóa")`.
   - `pdf_engine.py` catches this and outputs: `Failed to parse PDF document: Mật khẩu không chính xác...`.
   - `pdf.worker.ts` inspects `stderr`. Because `'failed to parse pdf document'` is evaluated before `'password'`, it triggers the generic corrupted file branch instead of the password validation branch.
   - Therefore, password decrypt failures are returned as generic PDF parse failures rather than promptable password issues.

---

## 3. Caveats

- **Network Mode**: Investigation was conducted locally in read-only mode without external cloud dependencies.
- **Python Environment**: PyMuPDF v1.28.2 is installed locally on Windows and emits a minor deprecation notice regarding `fitz` import (`Use import pymupdf instead`). The homeserver Linux environment uses Python 3 in a venv (`/home/anhduy/dd-studio/engines/document/venv/bin/python3`).
- **Client-Side Rendering**: Operation 7 (View) is purely handled client-side by PDF.js with static asset serving (`/pdfjs/`) and Fastify Range request streaming (`GET /api/v1/files/view/:fileId`). No background worker task is required or invoked for viewing.

---

## 4. Conclusion

The backend pipeline for PDF Studio Pro is structurally solid, performant, and memory-safe with streaming SHA-256 and BullMQ orchestration. However, four specific functional gaps must be addressed to fulfill all requirements in `ORIGINAL_REQUEST.md`:
1. **A4 Portrait Scaling**: Update `pdf_ops_advanced.py:cmd_images_to_pdf` to calculate A4 ($595 \times 842$ pt) aspect-ratio bounds and center images.
2. **Watermark Enhancements**: Add `watermarkPosition` and `watermarkOpacity` to `jobs.schema.ts`, `pdf.worker.ts`, and `pdf_ops_advanced.py` using PyMuPDF `Shape.finish(fill_opacity=..., stroke_opacity=...)`.
3. **Compression Fallback & Presets**: Update `pdf.worker.ts` to pass `--level` and overwrite the output with the original file if compressed size $\ge$ original size.
4. **Error Classification Priority**: In `pdf.worker.ts`, evaluate password/decryption error keywords before checking for generic parse errors.

All detailed technical analysis, code locations, and replacement proposals are documented in `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend\report.md`.

---

## 5. Verification Method

To independently verify the findings in this report:

1. **Verify TypeScript compilation**:
   ```bash
   cd server && npx tsc --noEmit
   ```
   *Expected*: Passes with 0 errors.

2. **Verify vitest test suites**:
   ```bash
   cd server && npx vitest run tests/unit/pdf.test.ts
   ```
   *Expected*: Passes 3/3 tests (compress, corrupted PDF, rotation).

3. **Verify PyMuPDF A4 calculation**:
   ```bash
   python -c "import fitz; r = fitz.paper_rect('a4'); print('A4 rect:', r)"
   ```
   *Expected*: Prints `A4 rect: Rect(0.0, 0.0, 595.0, 842.0)`.

4. **Verify PyMuPDF Shape opacity**:
   ```bash
   python -c "import fitz; doc=fitz.open(); page=doc.new_page(width=595,height=842); shape=page.new_shape(); shape.insert_text(fitz.Point(100,100), 'TEST', fontsize=20); shape.finish(fill_opacity=0.3); shape.commit(); print('OK')"
   ```
   *Expected*: Prints `OK`.

5. **Inspect Files**:
   - `server/src/workers/pdf.worker.ts` lines 76-83 (error check order) and 150-169 (missing compress/watermark args).
   - `engines/document/pdf_ops_advanced.py` lines 89-91 (image size logic) and lines 115-118 (watermark coordinates).
