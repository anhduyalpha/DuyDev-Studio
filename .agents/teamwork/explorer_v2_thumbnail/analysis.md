# Technical Analysis: 8-Thumbnail Panel Blanking & Infinite Spinner in PDF Studio Pro

**Explorer**: Explorer 1 (Thumbnail & Page Cache Specialist)  
**Date**: 2026-09-27  
**Mission**: Investigate Requirement R1 — Eliminate 8-thumbnail black flash and infinite spinner on "Bắt đầu xử lý" (`isProcessing`) and design a continuous canvas display with instant bitmap Page Cache.

---

## 1. Executive Summary

In DD Studio's PDF Studio Pro, tools with visual page interaction (**Tách trang** / `split` and **Xoay trang** / `rotate`) display an 8-thumbnail interactive grid ($4 \times 2$ pagination). When the user clicks "Bắt đầu xử lý", or when switching pagination pages, or when state transitions occur, users frequently experience two major anomalies:
1. **Black Flash / Void Canvas ("Chớp đen màn hình")**: The 8-thumbnail grid suddenly flashes black/transparent and re-shows spinning loader skeletons.
2. **Infinite Spinner ("Xoay spinner vô tận")**: The 8 thumbnail boxes display an infinite loading spinner (`loader-2 animate-spin`) and never render page contents.

Our investigation identified **four compounding root causes**:
1. **DOM Destruction via Full `innerHTML` Re-render**: Any state change that updates the dropzone container wipes out all `<canvas>` DOM nodes, resetting their painted bitmap buffers and rendering new skeletons in an unhidden state.
2. **Module-Scoped Token Lockout Bug (`currentRenderedThumbKey`)**: `usePdfDom.js` uses a single module-level variable to prevent duplicate renders. When DOM elements are re-created, `currentRenderedThumbKey` retains its stale value matching the current page index. As a result, the rendering pipeline is bypassed completely, leaving the newly mounted canvas empty and the skeleton spinner spinning forever.
3. **Asynchronous Cache Restoration Latency**: Even when `file._thumbCache` contains rendered bitmaps, the rendering functions in `PdfSplitWorkspace.js` and `PdfRotateWorkspace.js` perform an asynchronous `await ensurePdfJsLoaded()` and await document loading *before* checking the cache. This injects noticeable latency where the blank canvas and spinner are painted to the screen.
4. **Duplicated & Uncoordinated Rendering Pipelines**: Split and Rotate workspaces duplicate almost 100 lines of identical thumbnail rendering logic with independent, conflicting tokens (`activeSplitToken` vs `activeRotateToken`), rather than delegating to a unified, reusable `PdfPreviewCanvas` and centralized `PdfPageCache`.

---

## 2. File & Component Architecture Map

| File Path | Role | Key Functions / Responsibilities |
|---|---|---|
| `src/components/tools/pdf/PdfWorkspace.js` | Shell Container | `renderPdfConverter()`, layout columns, mounts dropzone, config, results, history. |
| `src/components/tools/pdf/components/DropzoneQueue.js` | Workspace Orchestrator | `renderDropzoneQueue()`: routes to `PdfSplitWorkspace`, `PdfRotateWorkspace`, multi-file, or single card. |
| `src/components/tools/pdf/components/PdfSplitWorkspace.js` | Split Tool Visuals | `renderPdfSplitWorkspace()`: generates $4 \times 2$ grid HTML; `loadAndRenderSplitThumbnails()`: renders split thumbnails. |
| `src/components/tools/pdf/components/PdfRotateWorkspace.js` | Rotate Tool Visuals | `renderPdfRotateWorkspace()`: generates $4 \times 2$ grid HTML; `loadAndRenderPdfThumbnails()`: renders rotate thumbnails. |
| `src/components/tools/pdf/components/PdfPreviewCanvas.js` | Proposed Component | Unified continuous thumbnail canvas renderer with instant bitmap restoration. |
| `src/components/tools/pdf/hooks/usePdfQueue.js` | Reactive State Machine | `PdfQueueManager`: handles file loading, pagination (`thumbnailPage`), rotations, split ranges, and `runProcess()`. |
| `src/components/tools/pdf/hooks/usePdfDom.js` | DOM Controller | `attachPdfConverterListeners()`: handles DOM event binding, tab synchronization, and reactive DOM updates. |
| `src/utilities/pdfJsHelper.js` | PDF.js Engine Helper | `ensurePdfJsLoaded()`, `renderPageThumbnail()`. |

---

## 3. Deep-Dive: Lifecycle & State Flow on "Bắt đầu xử lý"

### 3.1 Trace of "Bắt đầu xử lý" Execution Flow
1. **User Action**: The user selects or inspects pages in Split or Rotate mode and clicks `#btnStartProcess` (`ConfigPanel.js:199-204`).
2. **Listener Invocation**: In `usePdfDom.js:270-281`, `btnStart.onclick` calls `qm.runProcess()`.
3. **State Transition**:
   ```javascript
   // src/components/tools/pdf/hooks/usePdfQueue.js:588-594
   this.isProcessing = true;
   this.progress = 5;
   this.stage = 'Đang tải tệp lên...';
   this.error = null;
   this.result = null;
   this.notify('process-start');
   taskCoordinator.syncTasks(true);
   ```
4. **Subscription Event Handling (`process-start`)**:
   In `usePdfDom.js:592-615`:
   - `syncModeTabs(state.mode, true)`: disables tab switching (`opacity-40 pointer-events-none`).
   - `resEl.innerHTML = renderResultCard(...)`
   - `cfgEl.innerHTML = renderConfigPanel(state)`: swaps `#btnStartProcess` to the spinner disabled state (`Đang xử lý (5%)...`).
   - `dropEl.classList.add('pointer-events-none', 'opacity-85')`: dims the workspace container and disables pointer events.
   - `return;` exits early.

### 3.2 Where and Why the Anomalies Occur

#### Anomaly A: Black Flash (Canvas Obliteration)
- When the user changes pagination (`setThumbnailPage`), switches modes (`setMode`), or when any event without early return triggers the fallback update at lines 685-697 of `usePdfDom.js`:
  ```javascript
  dropEl.innerHTML = renderDropzoneQueue(state);
  bindDropzone(queueManager);
  ```
- Setting `dropEl.innerHTML` removes the existing `<canvas>` elements from the DOM.
- The browser drops the GPU raster buffers of the existing canvases.
- New `<canvas>` elements with zero dimensions and transparent/dark background are created, alongside visible skeleton overlays:
  ```html
  <canvas id="pdfSplitCanvas_${idx}" class="max-w-full max-h-full object-contain"></canvas>
  <div id="pdfSplitSkeleton_${idx}" class="absolute inset-0 flex items-center justify-center text-zinc-400">
    <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
  </div>
  ```
- Because Dark Theme utilizes `#121215` and `bg-black/40`, the user perceives a sudden black void with spinning icons ("chớp đen").

#### Anomaly B: Infinite Spinner (Token Desynchronization Deadlock)
- Look at `usePdfDom.js`:
  ```javascript
  // Line 40:
  let currentRenderedThumbKey = null;

  // Lines 110-114 (Rotate):
  const thumbKey = `${qm.files[0].id}_rotate_p${qm.thumbnailPage}`;
  if (currentRenderedThumbKey !== thumbKey) {
    currentRenderedThumbKey = thumbKey;
    loadAndRenderPdfThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
  }

  // Lines 168-172 (Split):
  const thumbKey = `${qm.files[0].id}_split_p${qm.thumbnailPage}`;
  if (currentRenderedThumbKey !== thumbKey) {
    currentRenderedThumbKey = thumbKey;
    loadAndRenderSplitThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
  }
  ```
- **The Deadlock Scenario**:
  1. File is loaded on page 0 (`thumbnailPage = 0`). `currentRenderedThumbKey` becomes `'file-1_split_p0'`.
  2. If the workspace DOM is re-rendered (via route soft refresh, mode re-entry, or any fallback event where `currentRenderedThumbKey` is not explicitly set to `null`):
     - The DOM nodes are fresh, empty, and contain visible `<i data-lucide="loader-2" class="animate-spin">`.
     - `bindDropzone(queueManager)` runs.
     - `thumbKey` is computed as `'file-1_split_p0'`.
     - `if (currentRenderedThumbKey !== thumbKey)` evaluates to **`false`**!
     - `loadAndRenderSplitThumbnails` is **NEVER CALLED**!
  3. Because `loadAndRenderSplitThumbnails` never runs, no canvas is drawn, and `skeleton.classList.add('hidden')` is never executed.
  4. The skeleton spinner spins **infinitely**.

#### Anomaly C: Sequential PDF.js Rendering Delay
- In both `PdfSplitWorkspace.js` and `PdfRotateWorkspace.js`:
  ```javascript
  for (let pageNum = startIdx + 1; pageNum <= endIdx; pageNum++) {
    if (activeSplitToken !== currentToken) return;
    ...
    const page = await pdfDoc.getPage(pageNum);
    await renderPageThumbnail(page, canvas, 240);
    if (skeleton) skeleton.classList.add('hidden');
    ...
  }
  ```
- Each page is rendered sequentially. Rendering an 8-page batch can take 600ms–1500ms on complex PDF documents.
- If any event causes `activeSplitToken` to increment during this window, the loop aborts, leaving unrendered pages with permanent spinners.

---

## 4. Analysis of the Current Page Cache Mechanism

### Current Implementation:
- In `PdfSplitWorkspace.js` and `PdfRotateWorkspace.js`:
  - Cache is stored directly on the file object: `file._thumbCache = new Map()`.
  - Keys are 1-based page numbers (`pageNum`: 1 to $N$).
  - Values are `ImageBitmap` instances created from the rendered canvas via `await createImageBitmap(canvas)`.
  - Cache release is handled in `releasePdfFileResources(file)` by iterating and calling `bmp.close()`.

### Critical Vulnerabilities of the Current Cache:
1. **Asynchronous Blocking**: Even on a cache hit, `loadAndRenderSplitThumbnails` awaits `ensurePdfJsLoaded()` and `pdfDoc` before checking `file._thumbCache.has(pageNum)`. The cache cannot restore immediately on render.
2. **No Synchronous HTML Pre-configuration**: The HTML generator has no access to the cache state. It always emits `<div id="...skeleton..." class="... flex ...">` without `hidden`, forcing the browser to paint the spinner first.
3. **No Cross-Tool / Cross-Workspace Sharing**: Although Split and Rotate render the identical PDF pages (Rotate only applies CSS transform `rotate(deg)`), they maintain separate rendering loops and module tokens.
4. **No Graceful Fallback**: If `createImageBitmap(canvas)` fails (e.g. detached canvas), `file._thumbCache` remains empty and the page will be re-rendered via PDF.js on every visit.

---

## 5. Architectural Solution: Continuous Canvas & Instant Bitmap Cache

To satisfy Requirement R1 fully, the system requires a clean, three-tier architecture:

```
┌────────────────────────────────────────────────────────┐
│                   PdfWorkspace Shell                   │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   ┌───────────────────────┐   ┌──────────────────────┐
   │  PdfSplitWorkspace    │   │  PdfRotateWorkspace  │
   └──────────┬────────────┘   └──────────┬───────────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
              ┌───────────────────────────┐
              │    PdfPreviewCanvas.js    │ ◄── Unified Thumbnail Component
              └─────────────┬─────────────┘
                            ▼
              ┌───────────────────────────┐
              │     PdfPageCache.js       │ ◄── Centralized In-Memory Bitmap Cache
              └───────────────────────────┘
```

### 5.1 Component 1: Centralized `PdfPageCache`
Create `src/components/tools/pdf/services/PdfPageCache.js`:
- **Cache Key Format**: `${file.id || file.name}_p${pageNumber}`.
- **Entry Type**:
  ```typescript
  interface PageCacheEntry {
    bitmap: ImageBitmap | HTMLCanvasElement;
    width: number;
    height: number;
    timestamp: number;
  }
  ```
- **Key Methods**:
  - `has(file, pageNum): boolean` (synchronous)
  - `get(file, pageNum): PageCacheEntry | null` (synchronous)
  - `put(file, pageNum, canvas: HTMLCanvasElement): Promise<void>`
  - `release(file): void` (safely closes all `ImageBitmap` instances)
  - `clear(): void`
- **LRU Eviction**: Caps cached pages at 64 pages to prevent memory leaks while keeping all recent pages instant.

### 5.2 Component 2: Unified `PdfPreviewCanvas`
Create `src/components/tools/pdf/components/PdfPreviewCanvas.js`:
1. **Markup Generator (`renderPreviewCanvasBox`)**:
   - Synchronously checks `PdfPageCache.has(file, pageNum)`.
   - If cached: renders skeleton with `class="hidden"` and sets canvas data attributes `data-cached="true"`.
   - If uncached: renders skeleton with spinner.
   - Supports CSS rotation inline: `style="transform: rotate(${rotation}deg)"`.
2. **Synchronous Immediate Paint (`restoreThumbnailsSynchronously`)**:
   - Executed **synchronously** immediately after DOM insertion (in `bindDropzone`), *before* any `await` or PDF.js calls.
   - For all canvases matching `.pdf-thumb-canvas`:
     ```javascript
     const cached = PdfPageCache.get(file, pageNum);
     if (cached) {
       canvas.width = cached.width;
       canvas.height = cached.height;
       const ctx = canvas.getContext('2d');
       if (ctx) ctx.drawImage(cached.bitmap, 0, 0);
       skeleton.classList.add('hidden');
       canvas.dataset.renderedPage = String(pageNum);
     }
     ```
   - **Visual Result**: 0ms paint. When switching pagination back and forth or switching modes, the thumbnails are restored instantaneously with zero blanking.
3. **Sequential Background Renderer (`renderMissingThumbnails`)**:
   - Filters visible pages for those not yet rendered (`!PdfPageCache.has(file, pageNum)`).
   - Only invokes PDF.js for the missing pages.
   - As each page renders, stores in `PdfPageCache` and hides its skeleton.

### 5.3 Component 3: DOM Continuous Canvas Preservation in `usePdfDom.js`
1. **Eliminate Fragile String Token**:
   - Discard the global `currentRenderedThumbKey` string.
   - Instead, let `bindDropzone` inspect the DOM: if a canvas already has `dataset.renderedPage === String(pageNum)` and has content, it is skipped.
2. **Guaranteed Canvas Immobility during `isProcessing`**:
   - On `process-start`, `upload-progress`, `progress`, `completed`, `failed`:
     - **NEVER** re-render `dropEl.innerHTML`.
     - Only manipulate `#btnStartProcess`, mode selector tabs, and result cards.
     - The 8 thumbnail cards and canvases stay permanently mounted in the DOM.
3. **Pagination & Interaction Disabling**:
   - During `isProcessing === true`:
     - Keep `#pdfDropzoneContainer` with `pointer-events-none opacity-85`.
     - Explicitly set `disabled` on `#btnPrevSplitPage`, `#btnNextSplitPage`, `#btnPrevRotatePage`, `#btnNextRotatePage` to prevent state drift.

---

## 6. Verification Plan & Test Matrix

1. **Test Case 1: Start Process Continuous Display (Tách trang & Xoay trang)**:
   - Load a multi-page PDF in Split mode or Rotate mode.
   - Select 2 pages.
   - Click "Bắt đầu xử lý" / "Tách 2 trang đã chọn".
   - **Verification**: The 8 thumbnails remain 100% visible, no canvas flash, no black void, no infinite spinner. Button updates to `Đang xử lý (X%)...`.
2. **Test Case 2: Instant Pagination Flip**:
   - Load an 16-page PDF. Page 1 displays thumbnails 1-8.
   - Click "Trang sau" -> Page 2 renders thumbnails 9-16.
   - Click "Trang trước" -> Page 1 thumbnails 1-8 restore **instantly** without any skeleton spinner or flicker.
3. **Test Case 3: Mode Switching Persistence**:
   - Load PDF in Split mode (thumbnails 1-8 render and cache).
   - Switch to Rotate mode.
   - **Verification**: Thumbnails 1-8 render from cache instantly without re-rendering PDF.js.
4. **Test Case 4: Resource Cleanup & Zero Memory Leaks**:
   - Remove file or click "Đổi tệp".
   - Verify `PdfPageCache.release(file)` closes all bitmaps.
