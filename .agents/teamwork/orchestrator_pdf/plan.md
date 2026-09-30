# Project Plan: PDF Studio Pro Overhaul

## Scope & Objective
Comprehensive review, standardization of processing logic, and UI/UX optimization for all 9 tools in PDF Studio Pro (Merge, Split, Rotate, Images to PDF, Compress, Extract Images, View, Watermark, Security) to top production-grade standards.

## Architecture & Work Breakdown
1. **Survey (Phase 0)**:
   - Map backend Fastify endpoints, Zod validation schemas, BullMQ worker (`pdf.worker.ts`), and PyMuPDF engine (`pdf_engine.py` or equivalent).
   - Map frontend PDF Studio components in `src/components/tools/pdf/`, state management, file validation hooks, and UI flows.
   - Map current test coverage (`tests/unit/pdf.test.ts`), homeserver sync mechanics, and health check scripts.

2. **Milestone M1: Backend & Polyglot Engine Full Coverage**:
   - Verify/Implement all 9 operations in `server/src/api/controllers/pdf.controller.ts`, `server/src/workers/pdf.worker.ts`, and `engines/document/pdf_engine.py`:
     1. Merge
     2. Split
     3. Rotate
     4. Images to PDF
     5. Compress (3 levels: high, medium, low + size protection fallback)
     6. Extract Images (ZIP package with numbered files)
     7. Watermark (diagonal center, top, bottom, opacity slider, optional page numbering)
     8. Lock (AES-128/256 password encryption)
     9. Unlock (decrypt with password)
   - Ensure streaming SHA-256 via `StorageManager.computeSha256`.
   - Proper `FileCorruptedError` handling.
   - Verification: `npx tsc --noEmit` = 0 errors, `npx vitest run` passes.

3. **Milestone M2: Frontend PDF Tools UI/UX & Flow Overhaul**:
   - Strict file filtering & single/multi-file constraints (R1).
   - Specialized logic for all 9 tools (R2):
     - Merge: visual reordering, file count & size estimation.
     - Split: smart thumbnail pagination (8 pages/view, 4x2 grid), Lightbox eye icon, range input with validation, vector resolution preservation.
     - Rotate: visual rotation grid, individual page rotation ($90^\circ, 180^\circ, 270^\circ$) and "Rotate all", update `/Rotate` property.
     - Images to PDF: auto-fit A4 portrait (595x842 pt), preserve aspect ratio, center on page, optimal image compression.
     - Compress: 3 clear levels, size protection fallback, transparent before/after size & % savings card.
     - Extract Images: extract all embedded images, zip package download.
     - View: inline PDF viewer with complete toolbar (prev/next, page input, zoom in/out/fit width, fullscreen), standard fonts & cMap support.
     - Watermark: text watermark, position selection, opacity slider, optional page numbering.
     - Security: Lock & Unlock tabs/forms.
   - Production ergonomics (R3): 4-step flow, touch targets >= 40px, shortcuts (Esc, arrow keys), zero fluff minimalism.
   - State synchronization (R4): Instant progress bar on current tab, tab locking when processing, resource cleanup (`URL.revokeObjectURL()`).

4. **Milestone M3: Verification & Test Suite Expansion**:
   - Run vitest tests and add missing test cases for all 9 operations.
   - Run `node --check` across all frontend files.

5. **Milestone M4: Homeserver Sync & Health Verification**:
   - Sync code to homeserver `192.168.2.171`.
   - Verify `dd-studio.service` restart and `/api/v1/health` status UP.

6. **Phase 5: Handoff**:
   - Write comprehensive `handoff.md` and report to Sentinel.
