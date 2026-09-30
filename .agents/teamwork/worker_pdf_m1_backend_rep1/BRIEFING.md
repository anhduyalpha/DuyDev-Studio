# BRIEFING — 2026-09-24T21:43:00Z

## Mission
Implement backend Fastify schema/worker updates and PyMuPDF polyglot engine enhancements for PDF Studio Pro (A4 portrait image scaling, watermark position/opacity, error classification, compression level & size protection fallback).

## 🔒 My Identity
- Archetype: implementer, qa
- Roles: implementer, qa
- Working directory: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1_backend_rep1
- Original parent: fc24d654-ab09-4169-9325-66e8b92df489
- Milestone: PDF Studio Pro Backend & Polyglot Engine Full Support

## 🔒 Key Constraints
- DO NOT CHEAT. All implementations must be genuine.
- Exclusive write ownership:
  - engines/document/pdf_engine.py
  - engines/document/pdf_ops_advanced.py
  - engines/document/pdf_ops_basic.py
  - server/src/schemas/jobs.schema.ts
  - server/src/workers/pdf.worker.ts
- Verification must pass:
  - `cd server && npx tsc --noEmit` -> 0 errors
  - `cd server && npx vitest run tests/unit/pdf.test.ts` -> 100% pass

## Current Parent
- Conversation ID: fc24d654-ab09-4169-9325-66e8b92df489
- Updated: 2026-09-24T21:43:00Z

## Task Summary
- **What to build**:
  1. Standard A4 portrait scaling (595x842 pt), aspect ratio preservation, and centering in `engines/document/pdf_ops_advanced.py` (`cmd_images_to_pdf`).
  2. Watermark position (`center`, `top`, `bottom`) and opacity in `engines/document/pdf_ops_advanced.py` and `engines/document/pdf_engine.py`.
  3. Error classification fix in `engines/document/pdf_engine.py` and `server/src/workers/pdf.worker.ts`.
  4. Schema updates in `server/src/schemas/jobs.schema.ts` (`watermarkPosition`, `watermarkOpacity`).
  5. Worker updates in `server/src/workers/pdf.worker.ts` (`--level`, size protection fallback, `--position`, `--opacity`).
- **Success criteria**:
  - `npx tsc --noEmit` clean (0 errors)
  - `vitest run tests/unit/pdf.test.ts` passes (7/7 tests pass)
  - Real PyMuPDF tests pass
- **Interface contracts**: `docs/BACKEND_SPEC.md`
- **Code layout**: `AGENTS.md`

## Key Decisions Made
- `cmd_images_to_pdf`: Set page dimensions to standard A4 (595.0 x 842.0 pt), computed scaling with 20pt margin preserving aspect ratio, centered image at `((PAGE_W - fit_w) / 2, (PAGE_H - fit_h) / 2)`, and optimized save streams using `garbage=4, deflate=True, deflate_images=True`.
- `cmd_watermark`: Handled `position` (`center`, `top`, `bottom`), clamped `opacity` in `[0.0, 1.0]`, used PyMuPDF `Shape` with `fill_opacity` and `stroke_opacity`, preserved automatic page numbering.
- Error classification: Prioritized password/decryption/unlock checks before generic parse error checks so password issues are accurately returned as `FileCorruptedError` with `{ field: 'password', issue: 'Document requires password for decrypt' }`.
- Compression: Forwarded `--level` and `--dpi` to Python CLI, added size protection fallback reverting to original file when compressed size >= original size.

## Artifact Index
- `.agents/teamwork/worker_pdf_m1_backend_rep1/BRIEFING.md`
- `.agents/teamwork/worker_pdf_m1_backend_rep1/progress.md`
- `.agents/teamwork/worker_pdf_m1_backend_rep1/handoff.md`

## Change Tracker
- **Files modified**:
  - `engines/document/pdf_ops_advanced.py`: A4 portrait scaling, stream optimization, watermark positioning and opacity normalization.
  - `engines/document/pdf_ops_basic.py`: Normalized compression level argument.
  - `server/src/workers/pdf.worker.ts`: Forward `--level` in compress, add size protection fallback, forward watermark options, classify password errors before generic parsing errors.
  - `server/tests/unit/pdf.test.ts`: Added tests for images_to_pdf A4 scaling, watermark, compression size fallback, password error classification.
- **Build status**: TypeScript clean (`npx tsc --noEmit` exit code 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: `tests/unit/pdf.test.ts` 7/7 passed.
- **Lint status**: 0 TypeScript errors.
- **Tests added/modified**: 4 new tests added in `server/tests/unit/pdf.test.ts`.

## Loaded Skills
- None
