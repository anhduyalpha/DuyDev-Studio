# Review & Adversarial Audit Report: PDF Studio Pro Backend & Polyglot Engine (M1)

**Reviewer**: Reviewer 1 (Reviewer & Adversarial Critic)  
**Date**: 2026-09-24T21:46:50Z  
**Working Directory**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\reviewer_pdf_m1_1`  
**Target Milestone**: M1 (PDF Studio Pro Backend & Polyglot Engine Full Support)  
**Verdict**: **APPROVE**

---

## 1. Observation

Direct code inspections, command executions, and static analyses yielded the following concrete observations:

1. **TypeScript Typecheck (`npx tsc --noEmit`)**:
   - Command executed: `cd "c:\Users\AnhDuy\Code\Project\DD Studio\server" && npx tsc --noEmit`
   - Exit code: `0`. Exactly 0 type errors across the entire codebase.

2. **Target Vitest Suite (`tests/unit/pdf.test.ts`)**:
   - Command executed: `cd "c:\Users\AnhDuy\Code\Project\DD Studio\server" && npx vitest run tests/unit/pdf.test.ts`
   - Result: `Test Files 1 passed (1)`, `Tests 7 passed (7)`, duration 7.59s.
   - All 7 tests passed:
     - `should process PDF compression and create artifact record`
     - `should fail gracefully and record FAILED status on corrupted PDF`
     - `should process per-page rotation with custom rotations mapping`
     - `should convert images to standard A4 portrait PDF with aspect ratio preservation and centering`
     - `should apply watermark with position and opacity`
     - `should protect file size and fallback to original if compression results in equal or larger size`
     - `should correctly classify password error and not shadow it with generic corrupted error`

3. **Full Server Unit Test Suite (`tests/unit/`)**:
   - Command executed: `cd "c:\Users\AnhDuy\Code\Project\DD Studio\server" && npx vitest run tests/unit/`
   - Result: `Test Files 7 passed (7)`, `Tests 37 passed (37)`, duration 13.27s. Zero regressions introduced.

4. **Engine Implementation (`engines/document/pdf_ops_advanced.py`)**:
   - **`cmd_images_to_pdf`** (lines 80-111):
     - Uses standard A4 portrait dimensions: `PAGE_W, PAGE_H = 595.0, 842.0` with `margin = 20.0`.
     - Aspect ratio preservation: `scale = min(max_w / img_w, max_h / img_h)` with defensive zero/negative boundary check (`if img_w <= 0 or img_h <= 0`).
     - Centering calculation: `x = (PAGE_W - fit_w) / 2.0`, `y = (PAGE_H - fit_h) / 2.0`.
     - Stream deflating: `pdf_doc.save(args.output, garbage=4, deflate=True, deflate_images=True)`.
   - **`cmd_watermark`** (lines 127-160):
     - Positions supported: `"center"`, `"top"`, `"bottom"`.
     - For `"center"`: applies diagonal rotation via `morph=(center, fitz.Matrix(45))`.
     - Opacity control: parsed and clamped via `max(0.0, min(1.0, opacity))` applied through `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)`.
     - Page numbering: renders `Trang {idx + 1} / {total}` horizontally centered at bottom (`rect.height - 20.0`).
   - **`cmd_rotate`** (lines 41-64):
     - Modifies page `/Rotate` dictionary attribute directly: `page.set_rotation((page.rotation + deg) % 360)`.
     - Supports both batch single-angle rotation and per-page dictionary mapping via `--rotations-json`.
   - **`cmd_lock` / `cmd_unlock`** (lines 210-244):
     - Lock: `doc.save(..., encryption=fitz.PDF_ENCRYPT_AES_256, user_pw=pw, owner_pw=pw, permissions=fitz.PDF_PERM_PRINT | fitz.PDF_PERM_ACCESSIBILITY)`.
     - Unlock: authenticates with `doc.authenticate(pw)`; raises structured `ValueError("Password required: ...")` or `ValueError("Password incorrect: ...")` on failure.

5. **Engine CLI Interface (`engines/document/pdf_engine.py`)**:
   - Verified CLI help commands:
     - `python engines/document/pdf_engine.py --help` (exited 0, exposes 11 subcommands).
     - `python engines/document/pdf_engine.py watermark --help` (exited 0, shows `--position {center,top,bottom}`, `--opacity OPACITY`, `--page-numbers`).
     - `python engines/document/pdf_engine.py images-to-pdf --help` (exited 0, shows `--inputs INPUTS [INPUTS ...]`).
     - `python engines/document/pdf_engine.py rotate --help` (exited 0, shows `--angle`, `--pages`, `--rotations-json`).
   - Exception handling (lines 123-128): prints `PDF Engine Error ({exc_type}): {err_msg}` to stderr without swallowing error types.

6. **Worker Implementation (`server/src/workers/pdf.worker.ts`)**:
   - **Error classification precedence** (lines 76-84):
     ```typescript
     const lowerErr = stderr.toLowerCase();
     if (['password', 'encrypted', 'mật khẩu', 'mã hóa', 'decrypt', 'authenticate'].some((k) => lowerErr.includes(k))) {
       return reject(new FileCorruptedError('The uploaded PDF structure is invalid or password-protected.', [{ field: 'password', issue: 'Document requires password for decrypt' }]));
     }
     if (['corrupted', 'no pdf header found', 'failed to parse pdf document', 'filedataerror', 'cannot open broken', 'failed to open file', 'pdf engine error'].some((k) => lowerErr.includes(k))) {
       return reject(new FileCorruptedError(`Failed to parse PDF document: ${stderr.trim()}`));
     }
     ```
     Password error matching occurs strictly *before* generic `pdf engine error` matching, ensuring password exceptions are not masked.
   - **Compression size fallback protection** (lines 180-186):
     ```typescript
     if (operation === 'compress' && originalSizeBytes > 0 && resultSizeBytes >= originalSizeBytes) {
       logger.info({ jobId, originalSizeBytes, resultSizeBytes }, 'Compressed size is >= original; retaining original file');
       await fs.copyFile(fileRecord.storagePath, resultPath);
       resultStats = await fs.stat(resultPath);
       resultSizeBytes = resultStats.size;
     }
     ```
     Guarantees that an already optimized document will not be replaced with an expanded artifact.
   - **Checksum and resource safety** (lines 187-200):
     Uses stream-based `StorageManager.computeSha256(resultPath)` to prevent heap buffer spikes on large documents.

7. **Schema Validation (`server/src/schemas/jobs.schema.ts`)**:
   - `pdfOperationSchema` defines all 10 operations.
   - `pdfJobOptionsSchema` validates `watermarkPosition: z.enum(['center', 'top', 'bottom'])`, `watermarkOpacity: z.number().min(0).max(1)`, `rotations: z.record(z.string(), z.number())`, `compressionLevel`, `targetDpi`, and `fileIds`.

---

## 2. Logic Chain

1. **Integrity Audit**:
   - Checked source files and test suites against all 5 integrity violation patterns:
     - No hardcoded test outputs or mock bypasses in engine or worker.
     - Real PyMuPDF methods are invoked for page rotation, text insertion, matrix transformation, deflation, and encryption.
     - Test suite generates dynamic PDF documents and images, writes them to disk, invokes the real worker and Python subprocess, and validates the output using `pdf-lib` and `fs.stat`.
   - **Finding**: Zero integrity violations detected.

2. **Correctness & Compliance with Requirements**:
   - **R2.1 (Merge Order)**: `pdf.worker.ts` lines 133-137 resolves `fileIds` with `options.fileIds.map((id) => map.get(id)).filter(Boolean)`, strictly guaranteeing that user-specified file order is preserved (bypassing unordered SQL returns).
   - **R2.3 (Rotation)**: Uses PyMuPDF native page rotation attribute without re-rendering vector data, preventing font blurriness.
   - **R2.4 (Images to PDF)**: Page dimension 595x842 pt strictly matches A4 portrait; aspect ratio scaling prevents image distortion; centering offsets ensure balanced margins.
   - **R2.5 (Compress Protection)**: Fallback logic replaces output with source file if `resultSizeBytes >= originalSizeBytes`, and re-computes the SHA-256 hash.
   - **R2.8 (Watermark)**: Supports 45° diagonal center, top, bottom, opacity slider, and dynamic page numbers.
   - **R2.9 (Security)**: AES-256 encryption via standard PyMuPDF flags. Decryption errors correctly mapped to HTTP 422 with `{ field: 'password', issue: 'Document requires password for decrypt' }`.

3. **Adversarial Stress-Testing**:
   - **Process Spawn Safety**: Worker uses `spawn(pythonBin, [scriptPath, ...args])` with an argument array rather than shell string interpolation (`exec`), preventing command injection even if watermark text contains special characters.
   - **Zero Division Bounds**: `cmd_images_to_pdf` explicitly guards against zero or negative dimensions (`img_w <= 0 or img_h <= 0`).
   - **Resource Disposal**: All PyMuPDF documents (`doc.close()`, `pdf_doc.close()`) are closed before returning.

---

## 3. Findings Matrix

| Severity | Category | File & Line | Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| `[SUGGESTION]` | Resource Cleanup | `server/src/workers/pdf.worker.ts:143-150` | In `extract_images`, temporary directory cleanup `fs.rm(tmpDir)` is not enclosed in a `try...finally` block. If `ArchiveService.compressFiles` throws, cleanup would rely on the scheduled background Janitor service rather than immediate unlinking. | Non-blocking (Mitigated by Janitor) |

### Concrete Patch Recommendation for Future Polish:
```diff
--- a/server/src/workers/pdf.worker.ts
+++ b/server/src/workers/pdf.worker.ts
@@ -143,7 +143,10 @@ export async function processPdfJob(payload: PdfJobPayload): Promise<string> {
       const tmpDir = StorageManager.getTempPath(`ext_${resultFileId}`, '');
-      await executePythonEngine(pythonBin, scriptPath, ['extract-images', '--input', fileRecord.storagePath, '--output-dir', tmpDir], emitProgress);
-      const files = await fs.readdir(tmpDir).catch(() => []);
-      const items = files.map((f) => ({ filePath: path.join(tmpDir, f), originalName: f }));
-      const { ArchiveService } = await import('../services/archive.service.js');
-      await ArchiveService.compressFiles(items, resultPath, 'zip', 'normal');
-      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
+      try {
+        await executePythonEngine(pythonBin, scriptPath, ['extract-images', '--input', fileRecord.storagePath, '--output-dir', tmpDir], emitProgress);
+        const files = await fs.readdir(tmpDir).catch(() => []);
+        const items = files.map((f) => ({ filePath: path.join(tmpDir, f), originalName: f }));
+        const { ArchiveService } = await import('../services/archive.service.js');
+        await ArchiveService.compressFiles(items, resultPath, 'zip', 'normal');
+      } finally {
+        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
+      }
```

---

## 4. Caveats

- **No Caveats**: All 5 files within the M1 review scope were thoroughly examined.
- Redis offline warnings in Vitest logs (`connect ECONNREFUSED 127.0.0.1:6379`) are expected in mock/unit test environments; `publishJobEvent` catches and logs them safely without failing jobs or test assertions.

---

## 5. Conclusion

**Verdict: APPROVE**

The implementation delivered by Worker M1 is robust, well-architected, and fully compliant with project standards (`AGENTS.md`, `BACKEND_SPEC.md`, and `ORIGINAL_REQUEST.md`). All 9 PDF operations are backed by authentic PyMuPDF logic, strict Zod schema validation, resilient error classification, and comprehensive automated test coverage.

---

## 6. Verification Method

To independently reproduce this verification:

```bash
# Step 1: Verify TypeScript compilation
cd "c:\Users\AnhDuy\Code\Project\DD Studio\server"
npx tsc --noEmit
# Expected output: Exit code 0, 0 errors

# Step 2: Run PDF worker unit tests
npx vitest run tests/unit/pdf.test.ts
# Expected output: 7 passed (7 tests)

# Step 3: Run all unit tests
npx vitest run tests/unit/
# Expected output: 7 test files passed, 37 passed tests

# Step 4: Verify Python CLI help and argument parsing
python ../engines/document/pdf_engine.py --help
python ../engines/document/pdf_engine.py watermark --help
python ../engines/document/pdf_engine.py images-to-pdf --help
# Expected output: Exit code 0 for all CLI invocations
```
