# Project: PDF Studio Pro v2 (Continuous Thumbnails, Gestures & Premium 9-Tools)

## Architecture
- **Presentation Layer**: `src/components/tools/pdf/`
  - Root: `PdfStudioPro.js` (Tab switching, SSE listener, isProcessing lock, layout mount)
  - Workspaces: `src/components/tools/pdf/workspaces/` (Split, Rotate, Merge, Images, Compress, Extract, View, Watermark, Security)
  - Components: `src/components/tools/pdf/components/` (`PdfPreviewCanvas.js`, `PdfPageLightboxModal.js`, `PdfMultiFileWorkspace.js`, `ConfigPanel.js`, `ResultCard.js`, `Dropzone.js`)
- **State & Logic Layer**:
  - `src/components/tools/pdf/hooks/usePdfQueue.js`: Central queue, status machine, multi/single-file management, reordering
  - `src/components/tools/pdf/hooks/usePdfDom.js`: DOM binding, canvas hydration, lightbox event listeners
  - `src/components/tools/pdf/services/PdfPageCache.js`: Singleton in-memory bitmap cache with instant synchronous restoration and LRU eviction
- **Gestures & Ergonomics Layer**:
  - `src/utilities/swipeGesture.js`: Zero-dependency pointer/touch swipe gesture engine with dual-axis touch slop, destructive underlay, haptic feedback
  - `src/utilities/dragReorder.js`: Pointer-based list reordering with touch handle (`grip-vertical`) and GPU transforms
- **Backend & Polyglot Engines**:
  - `server/src/api/controllers/pdf.controller.ts`, `server/src/workers/pdf.worker.ts`
  - `engines/document/pdf_engine.py`, `engines/document/pdf_ops_advanced.py`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | In-Memory Bitmap Cache (`PdfPageCache.js`) | Singleton LRU bitmap cache for PDF.js rendered canvases with synchronous retrieval and pre-render checks | M1 | Survey E1 |
| 2 | Continuous Canvas Display & Zero-Flash Hydration | Avoid dropping canvases on DOM updates, pre-hide spinners if cached, instant 0ms bitmap paint in `PdfPreviewCanvas.js` | M1 | Survey E1 |
| 3 | `usePdfDom.js` State Guard & Stale Key Fix | Prevent `dropEl.innerHTML` destruction on `isProcessing`, fix `currentRenderedThumbKey` deadlock | M1 | Survey E1 |
| 4 | Pointer & Touch Swipe Gesture Engine (`swipeGesture.js`) | Zero-dependency swipe handler with 8px touch slop, 35%/100px threshold, red trash reveal, haptic vibration | M2 | Survey E2 |
| 5 | Queue-Level Slide-to-Clear Toolbar | Ergonomic slide track replacing instant unguarded "Xóa tất cả" button | M2 | Survey E2 |
| 6 | Fluid Pointer Drag-and-Drop Reordering | Reorder files via `grip-vertical` handle with 60fps GPU transforms on touch and mouse | M2 | Survey E2 |
| 7 | Queue Reorder Method (`reorderFiles`) | Arbitrary index reordering in `usePdfQueue.js` | M2 | Survey E2 |
| 8 | Lightbox Ergonomics & Bug Fixes | Fix rotation reset bug on arrow navigation, touch swipe page flip, backdrop click dismiss, body scroll lock | M2 | Survey E2 |
| 9 | Single Image Support in `images_to_pdf` | Fix validation requiring `>= 2` files instead of `>= 1` in `ConfigPanel.js` and `usePdfQueue.js` | M3 | Survey E3 |
| 10 | Concurrency Defense & Tab Locking | Add `if (this.isProcessing) return;` to all queue mutations; disable action buttons during processing | M3 | Survey E3 |
| 11 | Resource Revocation & Listener Hygiene | Clean up click listeners in `usePdfDom.js`, auto-close lightbox on route change, abortable uploads | M3 | Survey E3 |
| 12 | Production Minimalism & Typography | Zero fluff verification, Geist / JetBrains Mono typography standards | M3 | Survey E3 |
| 13 | Comprehensive System Verification | `tsc --noEmit` 0 errors, Vitest 100% pass, `node --check` 100% pass on all JS files | M4 | Survey E3 |
| 14 | Homeserver Live Sync & Deployment | Sync code to `192.168.2.171`, remote build, restart `dd-studio.service`, verify `/api/v1/health` UP | M4 | Survey E3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Continuous Thumbnails & Bitmap Cache | Features 1, 2, 3: `PdfPageCache.js`, `PdfPreviewCanvas.js`, `PdfSplitWorkspace.js`, `PdfRotateWorkspace.js`, `usePdfDom.js` | none | DONE |
| M2 | Touch & Mouse Gestures, Lightbox & Drag-and-Drop | Features 4, 5, 6, 7, 8: `swipeGesture.js`, `dragReorder.js`, `usePdfQueue.js`, `PdfMultiFileWorkspace.js`, `PdfPageLightboxModal.js` | M1 | DONE |
| M3 | 9-Tools Premium Consistency & Concurrency Hardening | Features 9, 10, 11, 12: `ConfigPanel.js`, `usePdfQueue.js`, `usePdfDom.js`, `pdfApi.js`, typography & fluff audit | M2 | DONE |
| M4 | System Verification & Homeserver Deployment | Features 13, 14: Automated test suites, typechecks, syntax checks, homeserver sync to 192.168.2.171 | M3 | DONE |

## Code Layout
- `src/components/tools/pdf/services/PdfPageCache.js`: Singleton LRU bitmap cache
- `src/components/tools/pdf/components/PdfPreviewCanvas.js`: Thumbnail rendering & continuous canvas component
- `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`: Multi-file queue with swipe & grip handles
- `src/components/tools/pdf/components/PdfPageLightboxModal.js`: Lightbox with rotation retention & gestures
- `src/components/tools/pdf/hooks/usePdfQueue.js`: Queue logic & concurrency guards
- `src/components/tools/pdf/hooks/usePdfDom.js`: DOM binding & event management
- `src/utilities/swipeGesture.js`: Swipe gesture utility
- `src/utilities/dragReorder.js`: Pointer list reorder utility
