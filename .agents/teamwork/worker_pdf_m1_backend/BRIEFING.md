# BRIEFING — 2026-09-24T17:57:00Z

## Mission
Implement backend and PyMuPDF engine enhancements for PDF Studio Pro in DuyDev Studio (DS).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1_backend
- Original parent: fc24d654-ab09-4169-9325-66e8b92df489
- Milestone: PDF Studio Pro Audit & Optimization (M1 Backend)

## 🔒 Key Constraints
- Exclusively own and edit:
  - engines/document/pdf_engine.py
  - engines/document/pdf_ops_advanced.py
  - engines/document/pdf_ops_basic.py
  - server/src/schemas/jobs.schema.ts
  - server/src/workers/pdf.worker.ts
- Verification must pass:
  - cd server && npx tsc --noEmit (0 errors)
  - cd server && npx vitest run tests/unit/pdf.test.ts
- Polyglot reuse: PyMuPDF for document manipulation
- Strict error classification for password vs corrupted files
- Fallback protection for compression when output >= input

## Current Parent
- Conversation ID: fc24d654-ab09-4169-9325-66e8b92df489
- Updated: 2026-09-24T17:57:00Z

## Task Summary
- **What to build**:
  1. A4 portrait scaling (595x842 pt), aspect ratio preservation, and centering in `engines/document/pdf_ops_advanced.py` (`cmd_images_to_pdf`).
  2. Watermark position (`center`, `top`, `bottom`) and opacity in `engines/document/pdf_ops_advanced.py` and `engines/document/pdf_engine.py`.
  3. Error classification fix in `engines/document/pdf_engine.py` and `server/src/workers/pdf.worker.ts`.
  4. Schema updates in `server/src/schemas/jobs.schema.ts`.
  5. Worker updates in `server/src/workers/pdf.worker.ts` (`--level` forward, size fallback, `--position` and `--opacity` forward).
- **Success criteria**: All 5 tasks implemented, `tsc --noEmit` 0 errors, `vitest run tests/unit/pdf.test.ts` all pass, Python CLI tested.
- **Interface contracts**: `server/src/schemas/jobs.schema.ts`
- **Code layout**: `engines/document/` and `server/src/`

## Key Decisions Made
- [TBD]

## Artifact Index
- [TBD]

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Clean
- **Tests added/modified**: Pending

## Loaded Skills
None loaded
