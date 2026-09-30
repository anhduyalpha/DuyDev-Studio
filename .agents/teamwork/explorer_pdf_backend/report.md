# Technical Investigation Report: PDF Studio Pro Backend & Polyglot Engine

**Explorer**: Explorer 1 (Backend & Polyglot Engine Explorer)  
**Date**: 2026-09-24  
**Target Milestone**: PDF Studio Pro Audit & Optimization  
**Working Directory**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend`

---

## 1. Executive Summary

A comprehensive investigation of the backend Fastify routing layer, BullMQ asynchronous worker pipeline, and Python PyMuPDF (`fitz`) engine in DuyDev Studio (DS) was conducted against the requirements of PDF Studio Pro (9 operations: Merge, Split, Rotate, Images to PDF, Compress, Extract Images, View, Watermark, and Security).

### Core Findings:
1. **Routing Architecture**: There are currently **no** standalone `pdf.routes.ts` or `pdf.controller.ts` files. PDF job requests are handled through `server/src/api/routes/jobs.route.ts` (`POST /api/v1/jobs/pdf`) and `server/src/api/controllers/jobs.controller.ts` (`enqueuePdfJob`). File uploads and inline view/stream downloads are handled by `server/src/api/routes/files.route.ts` and `server/src/api/controllers/files.controller.ts`.
2. **Worker Execution**: BullMQ worker `pdf.worker.ts` processes jobs from queue `'ds-tasks'`, delegating to `engines/document/pdf_engine.py` via child process spawning with real-time stdout JSON progress streaming and SSE event publication over Redis.
3. **Operational Gaps in Engine & Worker**:
   - **Images to PDF**: Does **not** auto-fit images into standard A4 portrait (`595 x 842 pt`) or center them; it creates arbitrary page sizes based on raw image pixel dimensions (`width=rect.width, height=rect.height`).
   - **Compress**: The worker does not forward `--level` or `--dpi` arguments to the python engine, and `pdf_ops_basic.py:cmd_compress` completely ignores compression level/DPI without downsampling images. Furthermore, the worker lacks the required fallback mechanism when compressed file size exceeds original file size.
   - **Watermark**: Missing support for position (`center`, `top`, `bottom`) and opacity control. The schema, worker, and python script only support a single hardcoded diagonal text at `(width/4, height/2)` with fixed opacity `(0.7, 0.7, 0.7)`.
   - **Security & Error Classification**: `engines/document/pdf_engine.py` wraps all exceptions with `Failed to parse PDF document: ${err_msg}`. Because `pdf.worker.ts` checks `'failed to parse pdf document'` before checking `'password'`, incorrect password errors during decryption are shadowed and misreported as corrupted file errors instead of password validation issues.
4. **Data Integrity & Streaming**:
   - `StorageManager.computeSha256` operates via `createReadStream(filePath)` chunk piping, ensuring constant memory ($O(1)$ RAM) without Out-Of-Memory (OOM) risk on large multi-hundred-megabyte documents.
   - `FileCorruptedError` is implemented in `server/src/lib/errors.ts`, mapped to HTTP status 422 (`FILE_CORRUPTED`), and correctly handled in `error.middleware.ts`.

---

## 2. Fastify Routing & Controller Architecture

### 2.1 File Map & Endpoints
| Route Path | Method | Controller Handler | Purpose |
|---|---|---|---|
| `/api/v1/jobs/pdf` | `POST` | `jobs.controller.ts:enqueuePdfJob` | Validate payload, verify source file, create Prisma job record, enqueue to BullMQ |
| `/api/v1/jobs/:jobId/events` | `GET` | `jobs.controller.ts:getJobEvents` | Server-Sent Events (SSE) stream for live job progress & completion |
| `/api/v1/jobs/:jobId` | `GET` | `jobs.controller.ts:getJobStatus` | Polling endpoint for job state and output artifact metadata |
| `/api/v1/files/upload` | `POST` | `files.controller.ts:uploadFile` | Streaming multipart upload with real-time SHA-256 calculation |
| `/api/v1/files/view/:fileId` | `GET` | `files.controller.ts:viewFile` | Inline PDF view with HTTP 206 Partial Content (Range requests) |
| `/api/v1/files/download/:fileId` | `GET` | `files.controller.ts:downloadFile` | Attachment file download |

### 2.2 Schema Definitions (`server/src/schemas/jobs.schema.ts`)
```typescript
export const pdfOperationSchema = z.enum([
  'compress', 'convert', 'merge', 'split', 'lock', 'unlock',
  'rotate', 'images_to_pdf', 'watermark', 'extract_images'
]);

export const pdfJobOptionsSchema = z.object({
  compressionLevel: pdfCompressionLevelSchema.optional(),
  targetDpi: z.number().int().positive().optional(),
  stripMetadata: z.boolean().optional(),
  password: z.string().optional(),
  targetFormat: z.string().optional(),
  angle: z.number().optional(),
  pages: z.string().optional(),
  watermarkText: z.string().optional(),
  pageNumbers: z.boolean().optional(),
  rotations: z.record(z.string(), z.number()).optional(),
  fileIds: z.array(z.string()).optional()
}).optional().default({});
```

### 2.3 Identified Schema Gaps
1. **Missing Watermark Fields**: `watermarkPosition: z.enum(['center', 'top', 'bottom']).optional()` and `watermarkOpacity: z.number().min(0.05).max(1).optional()` are missing.
2. **Missing Conditional Validation**: `password` is marked optional across all operations. For `lock` and `unlock`, if omitted, no schema validation error is triggered, causing silent fallbacks (e.g., locking with `"123456"`).

---

## 3. BullMQ Queue & Worker Architecture

### 3.1 Queue Registration
- **Queue**: `taskQueue` (`server/src/queues/task.queue.ts`) named `'ds-tasks'`.
- **Worker**: `_workerInstance` in `server/src/workers/pdf.worker.ts` initialized with concurrency `limits.workerConcurrency.pdf = 4`.
- **Redis Connection**: Lazy connection with `maxRetriesPerRequest: null`, suppressing connection drops gracefully in unit testing.

### 3.2 Job Lifecycle & SSE Progress Flow
1. `enqueuePdfJob` creates Prisma `Job` with status `QUEUED` and enqueues to `taskQueue.add('pdf_process', ...)`.
2. Worker `processPdfJob` sets status to `PROCESSING` (`startedAt = new Date()`).
3. Worker spawns Python process (`engines/document/pdf_engine.py`) and consumes `stdout` line-by-line via `readline`.
4. Progress lines containing `{"progress": number, "stage": string}` trigger `emitProgress`:
   - Updates Prisma DB with throttling (at least 500ms between updates or $\ge 5\%$ delta, or $100\%$).
   - Publishes to Redis pub/sub channel `job:events:${jobId}`.
5. On completion, worker:
   - Calculates streaming SHA-256 of result file (`StorageManager.computeSha256`).
   - Inserts `FileRecord` (purpose: `PROCESSED_ARTIFACT`).
   - Inserts `HistoryRecord` (toolId: `pdf-studio`).
   - Sets job status to `COMPLETED` and publishes SSE `completed` event.

---

## 4. Comprehensive Audit of all 9 PDF Studio Pro Operations

### Operation 1: Merge (Ghép PDF)
- **Status**: **Fully Supported**
- **Flow**:
  - `pdf.worker.ts` (lines 130-141) resolves `options.fileIds` into ordered input file paths.
  - Passes `--inputs <path1> <path2> ... --output <resultPath>` to `pdf_engine.py merge`.
  - `pdf_ops_basic.py:cmd_merge` opens a new `fitz.open()` document and iterates through inputs calling `merged_doc.insert_pdf(sub_doc)`.
  - Saves with `garbage=3, deflate=True`.
- **Quality**: Preserves vector quality and text streams without rasterization. Page sequence directly matches user order.

### Operation 2: Split (Tách trang)
- **Status**: **Supported with Edge Case**
- **Flow**:
  - Accepts `options.pages` (e.g., `"1-3, 5, 8-10"`).
  - `pdf_ops_advanced.py:parse_page_range` parses 1-based page specs into 0-based indices clamped to `[0, total_pages - 1]`.
  - `pdf_ops_basic.py:cmd_split` inserts only selected pages into `split_doc` and saves.
- **Edge Case**: If the user provides a range containing no valid pages (e.g. `"20-25"` on a 10-page document), `page_indices` is empty. `split_doc` contains 0 pages, causing PyMuPDF to throw an unhandled error upon save.
- **Recommendation**: Add a check: if `len(page_indices) == 0`, raise `ValueError("Không có trang hợp lệ trong dải trang đã chọn")`.

### Operation 3: Rotate (Xoay trang)
- **Status**: **Fully Supported & Verified**
- **Flow**:
  - Supports both uniform rotation (`options.angle` + `options.pages`) and per-page rotation maps (`options.rotations: Record<string, number>`).
  - `pdf_ops_advanced.py:cmd_rotate` calls `page.set_rotation((page.rotation + deg) % 360)`.
- **Quality**: Modifies the native `/Rotate` dictionary key on pages without re-rendering or vector degradation.
- **Unit Test**: Verified by `server/tests/unit/pdf.test.ts` (tested `{ '0': 90, '1': 180 }`).

### Operation 4: Images to PDF (Ảnh sang PDF)
- **Status**: **Needs Remediation (Violation of Spec R2.4)**
- **Requirement**: "Tự động căn chỉnh ảnh vừa khổ giấy chuẩn A4 portrait (595x842 pt), giữ nguyên tỷ lệ khung hình (aspect ratio), căn giữa trang và nén stream ảnh tối ưu."
- **Current Behavior (`pdf_ops_advanced.py:cmd_images_to_pdf`)**:
  ```python
  img = fitz.open(img_path)
  rect = img[0].rect
  pdf_bytes = img.convert_to_pdf()
  img.close()
  img_pdf = fitz.open("pdf", pdf_bytes)
  page = pdf_doc.new_page(width=rect.width, height=rect.height)
  page.show_pdf_page(rect, img_pdf, 0)
  ```
- **Flaws**:
  1. Sets page dimensions to raw image pixel bounds (`width=rect.width, height=rect.height`), resulting in non-standard page sizes (e.g. 1920x1080 pt or 4000x3000 pt) rather than A4 portrait.
  2. Does not scale image to fit within standard A4 bounds ($595 \times 842$ pt).
  3. Does not center the image on the page.
- **Remediation**:
  Define A4 dimensions: `PAGE_W, PAGE_H = 595.0, 842.0` (with optional margin, e.g. 20 pt). Compute scale factor:
  ```python
  scale = min((PAGE_W - 2 * margin) / img_w, (PAGE_H - 2 * margin) / img_h)
  fit_w = img_w * scale
  fit_h = img_h * scale
  x = (PAGE_W - fit_w) / 2
  y = (PAGE_H - fit_h) / 2
  target_rect = fitz.Rect(x, y, x + fit_w, y + fit_h)
  page = pdf_doc.new_page(width=PAGE_W, height=PAGE_H)
  page.insert_image(target_rect, filename=img_path)
  ```

### Operation 5: Compress (Nén PDF)
- **Status**: **Needs Remediation (Violation of Spec R2.5)**
- **Requirements**:
  1. 3 compression levels: high, medium, low.
  2. Fallback protection: if compression results in a larger file, retain original file.
  3. Display transparent before/after size and savings percentage.
- **Current Behavior**:
  1. `pdf.worker.ts` lines 150-169 do **not** forward `--level` or `--dpi` from `options.compressionLevel`.
  2. `pdf_ops_basic.py:cmd_compress` completely ignores `args.level` and `args.dpi`; it only applies standard PyMuPDF deflate options: `doc.save(args.output, garbage=4, deflate=True, clean=True, linear=False)`.
  3. `pdf.worker.ts` lines 171-195 calculate `savingsPct`, but if `resultSizeBytes >= originalSizeBytes`, it keeps the larger file instead of replacing it with the original.
- **Remediation**:
  1. Worker: Pass `--level ${options.compressionLevel || 'medium'}` to python.
  2. Worker or Python: If `resultSizeBytes >= originalSizeBytes`, copy original file to `resultPath`.
  3. Python: Implement level-specific optimization (deflate stream cleanup for low; image downsampling/recompression for medium/high).

### Operation 6: Extract Images (Trích ảnh)
- **Status**: **Fully Supported**
- **Flow**:
  - `pdf_ops_advanced.py:cmd_extract_images` extracts all embedded images using `page.get_images(full=True)` and `doc.extract_image(xref)`.
  - Saves images formatted as `image_001.png`, `image_002.jpg`, etc. into a temporary directory.
  - `pdf.worker.ts` invokes `ArchiveService.compressFiles` to package the directory into a standard `.zip` file.
  - Cleans up temporary extraction scratch directory.
- **Quality**: Original image streams are extracted verbatim without lossy re-encoding.

### Operation 7: View (Xem PDF)
- **Status**: **Fully Supported**
- **Backend Flow**:
  - Backend does not require heavy worker computation for view.
  - Fastify serves document streams via `GET /api/v1/files/view/:fileId` with `Content-Disposition: inline` and HTTP 206 Partial Content (byte-range seeking).
  - Fastify serves standard PDF.js assets (`/pdfjs/web/standard_fonts/` and `/pdfjs/web/cmaps/`) through static file allowlist in `server/src/app.ts`.
- **Frontend Flow**:
  - `src/components/common/viewer/renderers/PdfRenderer.js` loads PDF.js with configured `cMapUrl` and `standardFontDataUrl`.
  - Full navigation toolbar, zoom in/out/fit, night mode, table of contents outline drawer, and fullscreen support.

### Operation 8: Watermark (Đóng dấu)
- **Status**: **Needs Remediation (Violation of Spec R2.8)**
- **Requirements**:
  1. Custom text.
  2. Positioning: Diagonal center (Chéo giữa trang), Top (Đầu trang), Bottom (Chân trang).
  3. Opacity control.
  4. Automatic page numbering (`Trang X / N`).
- **Current Behavior**:
  - `pdfJobOptionsSchema` only accepts `watermarkText` and `pageNumbers`.
  - `pdf.worker.ts` only passes `--text` and `--page-numbers`.
  - `pdf_ops_advanced.py:cmd_watermark` uses fixed coordinates `(rect.width / 4, rect.height / 2)` rotated $45^\circ$ with hardcoded color `(0.7, 0.7, 0.7)` and no opacity support.
- **Remediation**:
  - Add `watermarkPosition` (`'center' | 'top' | 'bottom'`) and `watermarkOpacity` (`number`) to schema, worker, and CLI parser.
  - Implement PyMuPDF `page.new_shape()`:
    ```python
    shape = page.new_shape()
    shape.insert_text(point, text, fontsize=..., color=..., morph=morph)
    shape.finish(fill_opacity=opacity, stroke_opacity=opacity)
    shape.commit()
    ```

### Operation 9: Security (Lock & Unlock - Bảo mật)
- **Status**: **Supported with Error Handling Masking Bug**
- **Lock Flow**:
  - Uses `fitz.PDF_ENCRYPT_AES_256`, setting user and owner password.
  - Permits printing and accessibility.
- **Unlock Flow**:
  - Authenticates with provided password via `doc.authenticate(pw)`.
  - If invalid, raises `ValueError("Mật khẩu không chính xác hoặc không đủ quyền mở khóa")`.
- **Masking Bug in Worker**:
  - `pdf_engine.py` line 117 catches all exceptions and writes:
    `Failed to parse PDF document: Mật khẩu không chính xác hoặc không đủ quyền mở khóa`
  - In `pdf.worker.ts` lines 76-83:
    ```typescript
    const lowerErr = stderr.toLowerCase();
    if (['corrupted', 'no pdf header found', 'failed to parse pdf document', 'filedataerror', 'cannot open broken'].some((k) => lowerErr.includes(k))) {
      return reject(new FileCorruptedError(`Failed to parse PDF document: ${stderr.trim()}`));
    }
    if (lowerErr.includes('password') || lowerErr.includes('encrypted')) {
      return reject(new FileCorruptedError('The uploaded PDF structure is invalid or password-protected.', [{ field: 'password', issue: 'Document requires password for decrypt' }]));
    }
    ```
  - Because `lowerErr` starts with `'failed to parse pdf document'`, the first condition always triggers! The password-specific block is unreachable.
- **Remediation**: Check password/decryption errors before generic parse error, and include Vietnamese keywords (`mật khẩu`, `không chính xác`).

---

## 5. Streaming SHA-256 & Memory Safety

### 5.1 StorageManager Stream Calculation
`server/src/storage/storage.manager.ts:computeSha256`:
```typescript
static async computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
```
- **Evaluation**: Fully streaming implementation. Only standard 64KB read stream buffers are in memory at any point. No full-file buffering occurs.

### 5.2 Upload Hashing Stream
`server/src/api/controllers/files.controller.ts:uploadFile`:
```typescript
const hashingStream = new Transform({
  transform(chunk: Buffer, _encoding, callback) {
    byteCount += chunk.length;
    hash.update(chunk);
    callback(null, chunk);
  }
});
await pipeline(data.file, hashingStream, writeStream);
```
- **Evaluation**: The upload endpoint computes SHA-256 concurrently as incoming multipart chunks arrive from the network and pipe to disk. High throughput, zero OOM risk.

---

## 6. Corrupted File & Error Classification

### 6.1 Exception Model
`server/src/lib/errors.ts`:
- `FileCorruptedError` extends `AppError`:
  - `statusCode`: 422 (Unprocessable Entity).
  - `code`: `'FILE_CORRUPTED'`.
  - `details`: Structured array of issues (e.g. `[{ field: 'password', issue: '...' }]`).

### 6.2 Fastify Error Middleware
`server/src/api/middleware/error.middleware.ts`:
- Translates `FileCorruptedError` into uniform response:
  ```json
  {
    "success": false,
    "error": {
      "code": "FILE_CORRUPTED",
      "message": "Failed to parse PDF document...",
      "details": null,
      "requestId": "req_...",
      "timestamp": "2026-09-24T..."
    }
  }
  ```

---

## 7. Concrete Actionable Recommendations for Implementation

### Proposal 1: Fix Image to A4 Portrait Fitting (`engines/document/pdf_ops_advanced.py`)
Replace lines 88-92 with standard A4 calculation and direct image insertion:
```python
PAGE_W, PAGE_H = 595.0, 842.0  # Standard A4 in points
margin = 20.0
max_w, max_h = PAGE_W - 2 * margin, PAGE_H - 2 * margin

img = fitz.open(img_path)
img_rect = img[0].rect
img_w, img_h = img_rect.width, img_rect.height
img.close()

scale = min(max_w / img_w, max_h / img_h)
fit_w, fit_h = img_w * scale, img_h * scale
x = (PAGE_W - fit_w) / 2
y = (PAGE_H - fit_h) / 2
target_rect = fitz.Rect(x, y, x + fit_w, y + fit_h)

page = pdf_doc.new_page(width=PAGE_W, height=PAGE_H)
page.insert_image(target_rect, filename=img_path)
```

### Proposal 2: Implement Watermark Position & Opacity (`engines/document/pdf_ops_advanced.py`)
```python
def cmd_watermark(args):
    doc = fitz.open(args.input)
    total = len(doc)
    text = args.text or ""
    pos = getattr(args, "position", "center") or "center"
    opacity = float(getattr(args, "opacity", 0.3) or 0.3)
    add_numbers = getattr(args, "page_numbers", False)

    for idx, page in enumerate(doc):
        rect = page.rect
        if text:
            shape = page.new_shape()
            font_size = 36 if pos == "center" else 18
            if pos == "top":
                pt = fitz.Point(rect.width / 4, 50)
                shape.insert_text(pt, text, fontsize=font_size, color=(0.5, 0.5, 0.5))
            elif pos == "bottom":
                pt = fitz.Point(rect.width / 4, rect.height - 40)
                shape.insert_text(pt, text, fontsize=font_size, color=(0.5, 0.5, 0.5))
            else:  # diagonal center
                pt = fitz.Point(rect.width / 4, rect.height / 2)
                shape.insert_text(pt, text, fontsize=font_size, color=(0.5, 0.5, 0.5), morph=(pt, fitz.Matrix(45)))
            shape.finish(fill_opacity=opacity, stroke_opacity=opacity)
            shape.commit()

        if add_numbers:
            shape_num = page.new_shape()
            num_str = f"Trang {idx + 1} / {total}"
            num_pt = fitz.Point(rect.width / 2 - 40, rect.height - 20)
            shape_num.insert_text(num_pt, num_str, fontsize=10, color=(0.4, 0.4, 0.4))
            shape_num.finish(fill_opacity=0.8, stroke_opacity=0.8)
            shape_num.commit()
```

### Proposal 3: Add Fallback Protection for PDF Compression (`server/src/workers/pdf.worker.ts`)
After line 174:
```typescript
if (operation === 'compress' && resultSizeBytes >= originalSizeBytes) {
  logger.info({ jobId, originalSizeBytes, resultSizeBytes }, 'Compressed size is >= original; retaining original file');
  await fs.copyFile(fileRecord.storagePath, resultPath);
  const updatedStats = await fs.stat(resultPath);
  resultSizeBytes = updatedStats.size;
}
```

### Proposal 4: Correct Error Pattern Precedence (`server/src/workers/pdf.worker.ts`)
Swap the error checks around lines 76-83:
```typescript
const lowerErr = stderr.toLowerCase();
if (lowerErr.includes('password') || lowerErr.includes('encrypted') || lowerErr.includes('mật khẩu')) {
  return reject(new FileCorruptedError(
    'The uploaded PDF is password-protected or password incorrect.',
    [{ field: 'password', issue: 'Document requires password for decrypt' }]
  ));
}
if (['corrupted', 'no pdf header found', 'failed to parse pdf document', 'filedataerror', 'cannot open broken'].some((k) => lowerErr.includes(k))) {
  return reject(new FileCorruptedError(`Failed to parse PDF document: ${stderr.trim()}`));
}
```

### Proposal 5: Update Zod Options Schema (`server/src/schemas/jobs.schema.ts`)
```typescript
export const pdfJobOptionsSchema = z.object({
  compressionLevel: pdfCompressionLevelSchema.optional(),
  targetDpi: z.number().int().positive().optional(),
  stripMetadata: z.boolean().optional(),
  password: z.string().optional(),
  targetFormat: z.string().optional(),
  angle: z.number().optional(),
  pages: z.string().optional(),
  watermarkText: z.string().optional(),
  watermarkPosition: z.enum(['center', 'top', 'bottom']).optional(),
  watermarkOpacity: z.number().min(0.05).max(1).optional(),
  pageNumbers: z.boolean().optional(),
  rotations: z.record(z.string(), z.number()).optional(),
  fileIds: z.array(z.string()).optional()
}).optional().default({});
```

---
*Report compiled by Explorer 1. Ready for handoff.*
