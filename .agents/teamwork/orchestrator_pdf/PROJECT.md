# Project: PDF Studio Pro Overhaul

## Architecture
- Module/package boundaries, data flow, shared interfaces
- Backend Gateway: Fastify (`server/src/api/routes/jobs.route.ts`, `server/src/api/controllers/jobs.controller.ts`, `server/src/schemas/jobs.schema.ts`)
- Queue & Workers: BullMQ (`server/src/queues/task.queue.ts`, `server/src/workers/pdf.worker.ts`)
- Polyglot Engine: PyMuPDF Python scripts (`engines/document/pdf_engine.py`, `pdf_ops_basic.py`, `pdf_ops_advanced.py`)
- Frontend Tools: Vanilla JS Web Components in `src/components/tools/pdf/` (`PdfWorkspace.js`, `ConfigPanel.js`, `PdfMultiFileWorkspace.js`, `PdfSplitWorkspace.js`, `PdfRotateWorkspace.js`, `PdfViewerInline.js`, `ResultCard.js`, `DropzoneQueue.js`, hooks: `pdfApi.js`, `usePdfQueue.js`, `usePdfDom.js`)
- Test Infrastructure: Vitest (`server/tests/unit/pdf.test.ts`, `server/tests/integration/api.test.ts`)
- Deployment: Homeserver (`192.168.2.171`) systemd daemon (`dd-studio.service`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Merge PDF | Visual reordering, file count & size estimation, correct ordering | M1, M2 | R2.1 |
| 2 | Split PDF | Smart thumbnail pagination (8 pages/view, 4x2 grid), Lightbox eye icon, range input with out-of-range validation | M1, M2 | R2.2 |
| 3 | Rotate PDF | Visual rotation grid, individual page rotation (90/180/270) and rotate all, /Rotate property without text blur | M1, M2 | R2.3 |
| 4 | Images to PDF | Auto-fit A4 portrait (595x842 pt), preserve aspect ratio, centered, image stream compression | M1, M2 | R2.4 |
| 5 | Compress PDF | 3 levels (high, medium, low), size protection fallback (revert to original if larger), transparent before/after & % savings | M1, M2 | R2.5 |
| 6 | Extract Images | Extract all embedded images without quality loss, ZIP package with numbered files (image_001.png...) | M1, M2 | R2.6 |
| 7 | View PDF | Inline viewer with complete toolbar (prev/next, page input, zoom, fit width, fullscreen), standard fonts & cMap support | M2 | R2.7 |
| 8 | Watermark | Text watermark, position (diagonal center, top, bottom), opacity slider, optional page numbering (Trang X / N) | M1, M2 | R2.8 |
| 9 | Security | Lock (AES-128/256 password encryption) and Unlock (decrypt with current password, save unencrypted PDF) | M1, M2 | R2.9 |
| 10 | Strict File Filters | PDF-only for 8 tools (rejection toast), images-only for Images to PDF. Single-file vs multi-file enforcement | M2 | R1 |
| 11 | Production Ergonomics & 4-step Flow | Drop with border feedback -> Sidebar visual config / WYSIWYG -> Primary action button with dynamic context label -> Result card (download, copy link, preview, forward to another tool). Esc/Arrow shortcuts, touch targets >= 40px | M2 | R3 |
| 12 | State Sync & Resource Cleanup | In-tab progress bar (0->100%), lock tab switching during isProcessing, URL.revokeObjectURL(), EventSource cleanup, zero fluff minimalism | M2 | R4 |
| 13 | Backend Robustness & Streaming | Stream SHA-256 (StorageManager.computeSha256), FileCorruptedError mapping to HTTP 422, unmasked password decryption error | M1 | R5 |
| 14 | Unit & Integration Test Suite | Full Vitest test coverage for all 9 operations | M3 | AC |
| 15 | Homeserver Deployment & Verification | Sync code to homeserver 192.168.2.171, restart dd-studio.service, verify /api/v1/health | M4 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend & Engine Full Support | Fix A4 portrait scaling in Images to PDF, add watermark position & opacity, implement compress levels & size fallback, fix password error classification | none | DONE |
| M2 | Frontend Tools UI/UX Overhaul | Dynamic action button labels, dropzone multiple flag, split page range validation, watermark controls, result card workflow chaining, touch targets >= 40px | M1 | DONE |
| M3 | Comprehensive Testing & Verification | Unit & integration tests for all 9 operations, typecheck, vitest 100%, node --check | M1, M2 | DONE |
| M4 | Homeserver Deployment & Live Verification | SCP sync to 192.168.2.171, restart dd-studio.service, verify /api/v1/health | M3 | DONE |

## Interface Contracts
### Frontend ↔ Backend (Jobs API)
- `POST /api/v1/jobs/pdf`:
  - `operation`: `'merge' | 'split' | 'rotate' | 'images_to_pdf' | 'compress' | 'extract_images' | 'watermark' | 'lock' | 'unlock'`
  - `fileIds`: string[]
  - `options`:
    - `compressLevel`: `'high' | 'medium' | 'low'` (optional)
    - `rotations`: Record<string, number> (optional)
    - `pages`: string (optional, e.g. `'1-3, 5'`)
    - `watermarkText`: string (optional)
    - `watermarkPosition`: `'center' | 'top' | 'bottom'` (optional, default: `'center'`)
    - `watermarkOpacity`: number (optional, default: 0.3)
    - `watermarkPageNumbers`: boolean (optional)
    - `password`: string (optional)
