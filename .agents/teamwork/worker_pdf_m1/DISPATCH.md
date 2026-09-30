## 2026-09-27T12:25:41Z

You are Worker M1: Thumbnail Continuous Display & Page Cache Specialist.
Your working directory is: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Specifications to read first:
1. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (header `## 2026-09-27T12:14:56Z`)
2. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_pdf_v2\PROJECT.md`
3. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_thumbnail\handoff.md`
4. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_thumbnail\analysis.md`

Files you own exclusively for Milestone M1:
- `src/components/tools/pdf/services/PdfPageCache.js` (NEW)
- `src/components/tools/pdf/components/PdfPreviewCanvas.js`
- `src/components/tools/pdf/components/PdfSplitWorkspace.js`
- `src/components/tools/pdf/components/PdfRotateWorkspace.js`
- `src/components/tools/pdf/hooks/usePdfDom.js`

Objectives:
Resolve Requirement R1:
"Khắc phục triệt để hiện tượng đen màn hình và xoay spinner vô tận ở Panel Thumbnail 8 trang:
- Khi người dùng bấm 'Bắt đầu xử lý' hoặc khi tiến trình xử lý đang diễn ra trong các công cụ có chế độ trực quan (Tách trang, Xoay trang), lưới 8 thumbnail trang phải giữ nguyên hiển thị liên tục (continuous canvas display), không bị chớp đen, không bị reset canvas và không quay vòng spinner vô hạn.
- Cơ chế lưu đệm trang (Page Cache) phải đảm bảo khôi phục tức thời hình ảnh trang đã kết xuất từ bộ nhớ đệm bitmap khi chuyển trang hoặc cập nhật trạng thái tác vụ."

Detailed Implementation Steps:
1. Create `src/components/tools/pdf/services/PdfPageCache.js`:
   - Singleton LRU cache class storing rendered bitmaps (either `HTMLCanvasElement`, `ImageBitmap`, or `ImageData`).
   - Synchronous methods: `get(key)`, `has(key)`, `set(key, data)`, `evict(key)`, `clear()`.
   - Key format: `${fileId || fileName}_p${pageIndex}_r${rotation}_s${scale}`.
   - Max capacity (e.g., 64 items) with LRU eviction to prevent memory leaks.
2. Update/refactor `src/components/tools/pdf/components/PdfPreviewCanvas.js`:
   - Provide clean markup rendering for thumbnails that pre-hides skeleton spinners if already in `PdfPageCache`.
   - Provide an instant synchronous restore function (`restoreCanvasFromCache(canvas, cacheKey)`) that paints cached bitmaps immediately with 0ms latency upon mounting into the DOM.
   - Keep asynchronous PDF.js rendering for uncached pages, which stores the result into `PdfPageCache` upon completion and smoothly cross-fades skeleton to canvas.
3. Update `src/components/tools/pdf/components/PdfSplitWorkspace.js` and `PdfRotateWorkspace.js`:
   - Check `PdfPageCache.has(key)` when generating HTML so skeleton overlays are marked `hidden` if cached.
   - Ensure the 8-thumbnail 4x2 grid has stable DOM element IDs and classes.
4. Update `src/components/tools/pdf/hooks/usePdfDom.js`:
   - Eliminate the black flash during processing: In `renderDropzoneContent`, do NOT replace `dropEl.innerHTML` when `isProcessing` changes if the active mode and selected file have not changed. Instead, update the progress bar and button disabled states in-place.
   - Fix the infinite spinner deadlock: Remove stale `currentRenderedThumbKey` lockouts or properly reset/inspect canvas `data-rendered` attributes so newly mounted canvases are never ignored by `loadAndRenderSplitThumbnails` / `loadAndRenderPdfThumbnails`.
   - Synchronously restore cached page bitmaps during DOM hydration before triggering any async PDF.js calls.
5. Verification Requirements:
   - Check JS syntax on all modified files: `node --check <file>`
   - Check TypeScript: `cd server && npx tsc --noEmit` -> 0 errors.
   - Run Vitest tests: `cd server && npx vitest run` -> 100% pass.
   - Ensure Zero-Build Native ES Module conventions and Single Responsibility are strictly preserved.
6. Write your comprehensive report to `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_pdf_m1\handoff.md`.
7. Send a message to parent reporting completion and verification results.
