# Handoff Report: Reviewer 2 (Milestone M1 - Backend & Polyglot Engine Full Support)

- **Reviewer**: Reviewer 2 (reviewer, critic)
- **Target Worker**: Worker M1 (`worker_pdf_m1_backend_rep1`)
- **Working Directory**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\reviewer_pdf_m1_2`
- **Timestamp**: 2026-09-25T04:48:40+07:00
- **Explicit Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Integrity Audit
- Scanned all modified files:
  - `engines/document/pdf_ops_advanced.py`
  - `engines/document/pdf_engine.py`
  - `server/src/schemas/jobs.schema.ts`
  - `server/src/workers/pdf.worker.ts`
  - `server/tests/unit/pdf.test.ts`
- **Result**: No hardcoded test IDs, no facade mocks, no fake assertions, no bypassed tasks, no fabricated outputs. All logic uses real PyMuPDF APIs, real SQLite database transactions via Prisma, and real filesystem operations.

### 1.2 Automated Verification Results
1. `npx tsc --noEmit` in `server`:
   - Command: `npx tsc --noEmit`
   - Result: Exit code 0, 0 errors.
2. Unit test suite `tests/unit/pdf.test.ts`:
   - Command: `npx vitest run tests/unit/pdf.test.ts`
   - Result: `7 passed (7 tests)` across all 7 test cases in 5.18s.
3. Backend unit regression suite `tests/unit/`:
   - Command: `npx vitest run tests/unit/`
   - Result: `7 passed test files, 37 passed tests` in 12.07s.

### 1.3 Adversarial Stress-Test Observations

#### A. A4 Scaling & Aspect Ratio Preservation (`cmd_images_to_pdf`)
- In `engines/document/pdf_ops_advanced.py` lines 80-110:
  ```python
  PAGE_W, PAGE_H = 595.0, 842.0
  margin = 20.0
  max_w = PAGE_W - 2.0 * margin  # 555.0 pt
  max_h = PAGE_H - 2.0 * margin  # 802.0 pt
  scale = min(max_w / img_w, max_h / img_h)
  fit_w = img_w * scale
  fit_h = img_h * scale
  x = (PAGE_W - fit_w) / 2.0
  y = (PAGE_H - fit_h) / 2.0
  target_rect = fitz.Rect(x, y, x + fit_w, y + fit_h)
  ```
- Tested 3 extreme aspect ratios via direct Python engine invocation:
  - **Ultra-wide image (800x200, aspect 4.00)**: Page size (595.0, 842.0), image bbox `(20.0, 351.6, 575.0, 490.4)`, width = 555.0, height = 138.8, aspect ratio = 4.00 (exact). Centered with equal vertical margins of 351.6 pt.
  - **Ultra-tall image (200x800, aspect 0.25)**: Page size (595.0, 842.0), image bbox `(197.2, 20.0, 397.8, 822.0)`, width = 200.5, height = 802.0, aspect ratio = 0.25 (exact). Centered with equal horizontal margins of 197.2 pt.
  - **Square image (500x500, aspect 1.00)**: Page size (595.0, 842.0), image bbox `(20.0, 143.5, 575.0, 698.5)`, width = 555.0, height = 555.0, aspect ratio = 1.00 (exact). Centered with equal vertical margins of 143.5 pt.

#### B. Watermark Position & Opacity (`cmd_watermark`)
- In `engines/document/pdf_ops_advanced.py` lines 127-133:
  - Case normalization: `pos = (getattr(args, "position", "center") or "center").strip().lower()`. Handles `"TOP"`, `"bottom "`, etc.
  - Opacity clamping: `opacity = max(0.0, min(1.0, opacity))` handles out-of-range floats (`1.5` -> `1.0`, `-0.5` -> `0.0`) and non-numeric inputs gracefully without exceptions.
  - Verified opacity application through `shape.finish(fill_opacity=opacity, stroke_opacity=opacity)` setting genuine PDF graphics state alpha.

#### C. Compress Level Handling & Size Protection Fallback
- In `engines/document/pdf_ops_basic.py` lines 33-57:
  - Supports `--level high`, `--level medium`, and `--level low`.
- In `server/src/workers/pdf.worker.ts` lines 180-185:
  ```typescript
  if (operation === 'compress' && originalSizeBytes > 0 && resultSizeBytes >= originalSizeBytes) {
    logger.info({ jobId, originalSizeBytes, resultSizeBytes }, 'Compressed size is >= original; retaining original file');
    await fs.copyFile(fileRecord.storagePath, resultPath);
    resultStats = await fs.stat(resultPath);
    resultSizeBytes = resultStats.size;
  }
  ```
  - When re-deflation of an already-compact PDF expands file size, the original source file replaces `resultPath`.
  - Line 187 recomputes SHA-256 hash streamingly from the updated file on disk.
  - Lines 194-200 persist accurate `sizeBytes` and `hashSha256` to the `fileRecord` table.
  - Line 205 calculates `savingsPct = 0` (preventing negative percentages).

#### D. Password / Decryption Error Precedence & Structure
- In `engines/document/pdf_engine.py` lines 123-127: Unhandled exceptions are printed as `PDF Engine Error ({exc_type}): {err_msg}` to `stderr` with exit code 1.
- In `server/src/workers/pdf.worker.ts` lines 76-84:
  - Password keywords (`'password'`, `'encrypted'`, `'mật khẩu'`, `'mã hóa'`, `'decrypt'`, `'authenticate'`) are checked **first**.
  - Generic corruption keywords (`'corrupted'`, `'pdf engine error'`, etc.) are checked **second**.
- Verified behavior:
  - Wrong password unlock: Throws `FileCorruptedError` with status code 422 and structured details `[{ field: 'password', issue: 'Document requires password for decrypt' }]`.
  - Empty password unlock: Throws identical structured error.
  - Correct password unlock: Successfully removes encryption and outputs valid decrypted PDF.

---

## 2. Logic Chain

1. **A4 Geometry and Ratio Invariance**:
   - Because `scale = min(max_w / img_w, max_h / img_h)` uniformly multiplies both axes by the exact same scalar factor, the ratio `(fit_w / fit_h) == (img_w / img_h)` is strictly invariant.
   - The bounding rect offset `x = (595 - fit_w)/2` and `y = (842 - fit_h)/2` places the scaled image symmetrically within the printable bounds `(20, 20, 575, 822)`.
   - Direct PyMuPDF inspection confirmed exact aspect preservation across landscape, portrait, and square geometries.

2. **Defensive Parameter Boundaries in Watermark**:
   - Clamping `opacity` using `max(0.0, min(1.0, opacity))` ensures that even if API clients bypass Zod validation (e.g. through raw CLI runs), PyMuPDF receives valid alpha values in $[0.0, 1.0]$.
   - Morphing via `(center, fitz.Matrix(45))` produces a canonical $45^\circ$ diagonal watermark across the page center.

3. **Database and Storage Integrity under Fallback**:
   - If an already compressed PDF increases in size post-compression, overwriting `resultPath` with `fileRecord.storagePath` ensures the user never receives a larger file.
   - Re-running `StorageManager.computeSha256(resultPath)` after `fs.copyFile` guarantees that the database hash matches the stored file on disk, preventing checksum mismatch errors.

4. **Exception Classification Determinism**:
   - Since `pdf_engine.py` prefixes all error outputs with `PDF Engine Error (...)`, evaluating password keywords prior to `pdf engine error` eliminates the shadowing bug where password errors were previously miscategorized as generic file corruption.

---

## 3. Caveats

- **Vietnamese Diacritics in Watermarks**: PyMuPDF's default font for `shape.insert_text` is Helvetica (`helv`), a standard PDF Base-14 font that does not contain Unicode glyphs for Vietnamese accents (falling back to replacement characters without throwing runtime exceptions). While English/ASCII watermarks render cleanly and without issue, a future enhancement should consider bundling a Unicode TrueType font (e.g., Roboto/Geist) when non-ASCII text is detected. This is non-blocking as it does not crash the service.
- **No other caveats**: The backend implementation meets all acceptance criteria of Milestone M1.

---

## 4. Conclusion

**Verdict: APPROVE**

Worker M1's implementation in `worker_pdf_m1_backend_rep1` fulfills all requirements specified in `ORIGINAL_REQUEST.md` (R1, R2, R4, R5) and passes all adversarial stress tests:
1. `cmd_images_to_pdf` guarantees 595x842 pt A4 dimensions, preserves aspect ratios, and centers images.
2. `cmd_watermark` supports `center`, `top`, `bottom` positions and clamps opacity cleanly in $[0.0, 1.0]$.
3. Compression level arguments (`high`, `medium`, `low`) are forwarded correctly, and size protection fallback accurately updates artifact files, database records, and SHA-256 hashes.
4. Password errors take precedence over generic errors and return structured `[{ field: 'password', issue: '...' }]` payloads.
5. All TypeScript typechecks and unit tests pass with 0 errors.

---

## 5. Verification Method

To independently reproduce and verify this review:

```bash
# 1. Typecheck TypeScript backend
cd "c:\Users\AnhDuy\Code\Project\DD Studio\server"
npx tsc --noEmit
# Expected: Exit code 0, 0 errors.

# 2. Run PDF worker unit tests
npx vitest run tests/unit/pdf.test.ts
# Expected: 7 passed (7 tests).

# 3. Run all unit tests
npx vitest run tests/unit/
# Expected: 7 passed test files, 37 passed tests.

# 4. Verify Python CLI images-to-pdf, watermark, lock/unlock
python ../engines/document/pdf_engine.py --help
python ../engines/document/pdf_engine.py watermark --help
python ../engines/document/pdf_engine.py lock --help
python ../engines/document/pdf_engine.py unlock --help
```
