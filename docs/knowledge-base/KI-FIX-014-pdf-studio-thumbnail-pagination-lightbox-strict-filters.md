---
id: KI-FIX-014
title: PDF Studio Thumbnail Pagination (4x2), Fullscreen Lightbox & Strict Tab File Filters
category: fix
module: pdf-studio
tags: [pdf, pagination, thumbnail, lightbox, memory-leak, mime-filter, validation]
status: active
last_updated: 2026-09-24
---

# KI-FIX-014: PDF Studio Thumbnail Pagination (4x2), Fullscreen Lightbox & Strict Tab File Filters

## 1. Problem Statement & Root Cause
1. **OOM & Lag on Large PDF Files**:
   - In PDF Studio Pro workspaces (`PdfRotateWorkspace.js` and `PdfSplitWorkspace.js`), the rendering engine previously rendered all pages in a single loop (`pagesList.map(...)`). When a user uploaded large documents (50 - 200+ pages), the browser spawned hundreds of `<canvas>` elements, consuming excessive GPU/CPU memory and causing severe stutter or browser tabs freezing.
2. **Detail Inspection Limitations**:
   - Small thumbnail aspect cards made it difficult to inspect small tables, signatures, text orientation, or subtle watermarks prior to rotating or splitting pages.
3. **Missing Strict File Filtering**:
   - File inputs in the PDF module lacked strict runtime validation in `addFiles(fileList)`. Users could drop non-image files into "Ảnh sang PDF" or non-PDF files into PDF manipulation tabs, leading to runtime decoding failures.

## 2. Technical Solution & Architecture
1. **4x2 Fixed Thumbnail Pagination (`PAGE_SIZE = 8`)**:
   - Both `PdfRotateWorkspace.js` and `PdfSplitWorkspace.js` now enforce `PAGE_SIZE = 8` with a responsive 4x2 grid (`grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4`). On desktop viewports, cards are displayed in exactly 4 columns across 2 rows.
   - Slices visible pages: `visiblePages = pagesList.slice(thumbnailPage * 8, (thumbnailPage + 1) * 8)`.
   - Renders a clean navigation bar if `totalCount > 8`: `[< Trang trước]` `Trang X / Y` `[Trang sau >]`.
   - `loadAndRenderPdfThumbnails` and `loadAndRenderSplitThumbnails` sequentially render only the 8 visible pages (`startIdx + 1` to `endIdx`), aborting previous rendering tokens via cancel tokens (`activeRotateToken`, `activeSplitToken`).
2. **Fullscreen Inspection Lightbox Modal (`PdfPageLightboxModal.js`)**:
   - Added an eye button (`<button class="btn-preview-page ..."><i data-lucide="eye"></i></button>`) to each thumbnail card.
   - Clicking opens `openPdfPageLightbox(...)`:
     - Displays the page in high resolution (High-DPI / scale ratio up to 2.5) centered on screen.
     - Preserves and synchronizes live page rotation.
     - Supports keyboard shortcuts: `Escape` (close), `ArrowLeft` (previous page), `ArrowRight` (next page).
     - Allows direct in-modal page rotation with instant thumbnail synchronization.
3. **Strict Runtime File Type Filtering (`filterFilesForMode`)**:
   - Implemented `filterFilesForMode(fileList, mode)` in `usePdfQueue.js`:
     - Mode `images_to_pdf`: Strictly accepts `image/*` and extensions (`jpg, jpeg, png, webp, avif, gif, bmp, tiff, svg`).
     - All other PDF modes: Strictly accepts `application/pdf` and extension `.pdf`.
     - Invalid files trigger an immediate non-intrusive warning Toast notification without polluting the queue.
   - Updated file inputs with strict `accept` attributes in `DropzoneQueue.js` and `PdfMultiFileWorkspace.js`.

## 3. Verification & Guardrails
- **Compilation**: `node --check` passed across 100% of frontend JS files.
- **Server Verification**: `cd server && npx tsc --noEmit` passed with 0 errors; `npx vitest run` passed 14/14 test suites (76 tests).
- **Homeserver Status**: Deployed and active on `192.168.2.171` (service `dd-studio.service` running healthy).
