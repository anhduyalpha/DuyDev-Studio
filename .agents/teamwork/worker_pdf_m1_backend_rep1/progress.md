# Progress Tracker - Worker M1 (Backend & Polyglot Engine)

Last visited: 2026-09-24T21:42:15Z

## Current Status
Implementation completed:
1. `engines/document/pdf_ops_advanced.py`:
   - Enforced standard A4 portrait scaling (595 x 842 pt), aspect ratio preservation, and centering in `cmd_images_to_pdf`.
   - Optimized image stream with `garbage=4, deflate=True, deflate_images=True`.
   - Watermark position (`center` diagonal 45°, `top`, `bottom`) and opacity (0.0 to 1.0) with PyMuPDF `Shape`, preserving page numbers.
2. `engines/document/pdf_ops_basic.py`:
   - Normalized compression level string in `cmd_compress`.
3. `engines/document/pdf_engine.py`:
   - CLI subcommands accept `--position` and `--opacity` for `watermark`.
   - Error handler formats exceptions cleanly without masking error types.
4. `server/src/schemas/jobs.schema.ts`:
   - Added `watermarkPosition: z.enum(['center', 'top', 'bottom']).optional()`.
   - Added `watermarkOpacity: z.number().min(0).max(1).optional()`.
5. `server/src/workers/pdf.worker.ts`:
   - Error classification prioritizes password/encryption/unlock errors so they are not shadowed by generic corrupted errors. Added Vietnamese keywords (`mật khẩu`, `mã hóa`).
   - Size protection fallback: if compressed file size >= original file size, reverts output to original file content so file is never enlarged.
   - Forwards `--level` to Python compression command.
   - Forwards `--position` and `--opacity` to Python watermark command.
6. `server/tests/unit/pdf.test.ts`:
   - Added comprehensive tests for `images_to_pdf` (A4 595x842 pt verification), `watermark` (position & opacity), `compress` fallback (size protection), and password error classification (lock & unlock lifecycle).

## Verification
- `cd server && npx tsc --noEmit` -> Passed with 0 errors.
- `cd server && npx vitest run tests/unit/pdf.test.ts` -> 7/7 tests passed.
- Full test suite execution initiated.
