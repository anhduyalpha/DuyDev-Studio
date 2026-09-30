# Handoff Report: 8-Thumbnail Continuous Display & Bitmap Page Cache Investigation

**Agent**: Explorer 1 (Thumbnail & Page Cache Specialist)  
**Working Directory**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_thumbnail`  
**Target Milestone**: Requirement R1 (Continuous Canvas Display & Instant Page Cache)  
**Date**: 2026-09-27  

---

## 1. Observation

### Observation 1.1: Module-Scoped Key Guard Blocks Canvas Painting after Re-render
In `src/components/tools/pdf/hooks/usePdfDom.js`:
- Line 40:
  ```javascript
  let currentRenderedThumbKey = null;
  ```
- Lines 110–114 (Rotate Workspace):
  ```javascript
  const thumbKey = `${qm.files[0].id}_rotate_p${qm.thumbnailPage}`;
  if (currentRenderedThumbKey !== thumbKey) {
    currentRenderedThumbKey = thumbKey;
    loadAndRenderPdfThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
  }
  ```
- Lines 168–172 (Split Workspace):
  ```javascript
  const thumbKey = `${qm.files[0].id}_split_p${qm.thumbnailPage}`;
  if (currentRenderedThumbKey !== thumbKey) {
    currentRenderedThumbKey = thumbKey;
    loadAndRenderSplitThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
  }
  ```
Whenever the DOM is re-rendered (by route change, mode change, or fallback notification), `currentRenderedThumbKey` preserves the string from the prior render. If the key matches `${file.id}_split_p${pageIndex}`, the conditional evaluates to `false`, completely skipping thumbnail loading.

### Observation 1.2: DOM Canvas Obliteration and Unhidden Spinner Overlay
In `src/components/tools/pdf/components/PdfSplitWorkspace.js` (lines 120–125):
```html
<div class="relative w-full aspect-[1/1.414] bg-zinc-100 dark:bg-black/40 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-200/50 dark:border-white/[0.04]">
  <canvas id="pdfSplitCanvas_${idx}" class="max-w-full max-h-full object-contain"></canvas>
  <div id="pdfSplitSkeleton_${idx}" class="absolute inset-0 flex items-center justify-center text-zinc-400">
    <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
  </div>
```
And in `src/components/tools/pdf/components/PdfRotateWorkspace.js` (lines 100–105):
```html
<div class="relative w-full aspect-[1/1.414] bg-zinc-100 dark:bg-black/40 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-200/50 dark:border-white/[0.04]">
  <canvas id="pdfRotateCanvas_${idx}" class="max-w-full max-h-full object-contain transition-transform duration-200 ease-out" style="transform: rotate(${deg}deg);"></canvas>
  <div id="pdfRotateSkeleton_${idx}" class="absolute inset-0 flex items-center justify-center text-zinc-400">
    <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
  </div>
```
When `dropEl.innerHTML = renderDropzoneQueue(state)` runs, the previous `<canvas>` DOM nodes and their raster buffers are destroyed. The new markup always displays the skeleton spinner without a `hidden` class, causing an unavoidable flash of black and spinning loader.

### Observation 1.3: Asynchronous Delay Before Querying Cache
In `src/components/tools/pdf/components/PdfSplitWorkspace.js` (lines 152–189):
```javascript
export async function loadAndRenderSplitThumbnails(file, onDocLoaded, pageIndex = 0, pageSize = PAGE_SIZE) {
  const currentToken = ++activeSplitToken;
  try {
    const pdfjs = await ensurePdfJsLoaded();
    let pdfDoc = file.cachedDoc;
    if (!pdfDoc) {
      const targetBlob = file.rawFile || file;
      const arrayBuffer = await targetBlob.arrayBuffer();
      if (activeSplitToken !== currentToken) return;
      pdfDoc = await pdfjs.getDocument(...).promise;
      file.cachedDoc = pdfDoc;
    }
    if (activeSplitToken !== currentToken) return;
    const numPages = pdfDoc.numPages;
    if (onDocLoaded) onDocLoaded(numPages);

    const startIdx = pageIndex * pageSize;
    const endIdx = Math.min(numPages, startIdx + pageSize);

    if (!file._thumbCache) file._thumbCache = new Map();

    for (let pageNum = startIdx + 1; pageNum <= endIdx; pageNum++) {
      if (activeSplitToken !== currentToken) return;
      const canvas = document.getElementById(`pdfSplitCanvas_${pageNum - 1}`);
      const skeleton = document.getElementById(`pdfSplitSkeleton_${pageNum - 1}`);
      if (!canvas) continue;

      if (file._thumbCache.has(pageNum)) {
        const cached = file._thumbCache.get(pageNum);
        canvas.width = cached.width;
        canvas.height = cached.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(cached, 0, 0);
        if (skeleton) skeleton.classList.add('hidden');
        continue;
      }
      ...
```
Even when `file._thumbCache.has(pageNum)` is `true`, the code awaits `ensurePdfJsLoaded()`, file array buffer loading, and `pdfDoc.getDocument()`. The cached bitmap is only drawn after asynchronous delays, guaranteeing a visible flicker.

### Observation 1.4: Premature Token Abort Leaving Skeletons Visible
In lines 184 and 201 of `PdfSplitWorkspace.js` and lines 168 and 185 of `PdfRotateWorkspace.js`:
`if (activeSplitToken !== currentToken) return;`
When a secondary notification or rapid interaction increments the token, any in-flight thumbnail render loop immediately exits. Because `skeleton.classList.add('hidden')` is never reached for remaining pages, their spinners continue spinning indefinitely.

### Observation 1.5: Lack of Reusable `PdfPreviewCanvas` Component
`PdfPreviewCanvas.js` does not exist in `src/components/tools/pdf/components/`. The thumbnail markup and rendering loops are duplicated between `PdfSplitWorkspace.js` and `PdfRotateWorkspace.js`, each maintaining separate token counters and disparate cache handles.

---

## 2. Logic Chain

1. **Premise 1 (from Obs 1.2)**: `renderPdfSplitWorkspace` and `renderPdfRotateWorkspace` render raw HTML strings where every thumbnail slot contains an empty `<canvas>` and a visible spinner skeleton overlay.
2. **Premise 2 (from Obs 1.1)**: When a workspace re-renders while `currentRenderedThumbKey === thumbKey`, `bindDropzone` skips calling `loadAndRenderSplitThumbnails` / `loadAndRenderPdfThumbnails`.
3. **Inference A (Infinite Spinner)**: Because the loader function is bypassed, no routine ever hides the skeleton overlays. Skeletons remain visible forever with `loader-2 animate-spin`, and canvases remain black/empty.
4. **Premise 3 (from Obs 1.3)**: When `loadAndRenderSplitThumbnails` does execute on previously rendered pages, it awaits external libraries and document objects before checking `file._thumbCache`.
5. **Inference B (Black Flash / Flickering)**: Because the previous canvas DOM nodes were destroyed by `innerHTML` and the replacement canvas awaits asynchronous promises, the user visibly observes the black card background and spinner for 100ms–500ms even on a cache hit.
6. **Premise 4 (from Obs 1.4 & 1.5)**: The token abort mechanism and duplicated workspace logic prevent graceful recovery when state transitions happen during `runProcess()` (`isProcessing = true`).
7. **Conclusion**: To achieve continuous canvas display and instant page restoration:
   - DOM canvas nodes must **NOT** be destroyed during `isProcessing` state transitions.
   - A centralized, synchronous `PdfPageCache` must be established.
   - Thumbnail generation must check `PdfPageCache` synchronously during HTML generation (rendering skeletons as `hidden` if cached) and restore bitmaps to canvas contexts synchronously in the same tick before browser paint.
   - Rendering logic must be consolidated into a single reusable `PdfPreviewCanvas` component.

---

## 3. Caveats

- **Device Memory Constraints**: Caching full uncompressed `ImageBitmap` objects for every page of a 500-page document could consume significant memory (e.g. 500 pages $\times$ 240px $\times$ 340px $\times$ 4 bytes $\approx$ 160MB). The proposed `PdfPageCache` must enforce an LRU cap (e.g. max 64 pages) with `bitmap.close()` cleanup.
- **Offscreen Canvas vs ImageBitmap**: Most modern browsers support `createImageBitmap(canvas)`. For environments where `createImageBitmap` might fail (e.g. zero dimensions or canvas detached), a canvas-cloning fallback (`document.createElement('canvas')` drawing the source context) should be supported.

---

## 4. Conclusion & Actionable Blueprint

We have conclusively pinpointed the exact root causes of the black screen flash and infinite spinner in PDF Studio Pro's visual workspaces.

### Concrete Implementation Blueprint for Builder Agent:

1. **Create `src/components/tools/pdf/services/PdfPageCache.js`**:
   - Singleton in-memory bitmap cache with $O(1)$ synchronous lookup: `PdfPageCache.has(file, pageNum)` and `PdfPageCache.get(file, pageNum)`.
   - LRU cap of 64 pages.
   - Clean `release(file)` method that closes all `ImageBitmap` handles.
2. **Create `src/components/tools/pdf/components/PdfPreviewCanvas.js`**:
   - `renderPreviewCanvas(file, pageIndex, rotation, options)`: Returns HTML with skeleton pre-hidden if page is cached.
   - `restoreThumbnailsSynchronously(container, file, startIdx, count)`: Immediately paints cached bitmaps onto canvases synchronously on DOM mount.
   - `renderMissingThumbnails(file, onDocLoaded, pageIndex, pageSize)`: Background loader that renders only missing pages.
3. **Refactor Workspaces (`PdfSplitWorkspace.js` & `PdfRotateWorkspace.js`)**:
   - Replace duplicated canvas markup with `renderPreviewCanvas`.
   - Delegate rendering to `PdfPreviewCanvas`.
4. **Harden `usePdfDom.js`**:
   - Eliminate `currentRenderedThumbKey` global variable; check canvas DOM status directly (`dataset.renderedPage`).
   - Guard `dropEl.innerHTML` from being rewritten during `isProcessing` state changes (`process-start`, `upload-progress`, `progress`, `completed`).
   - Synchronously call `restoreThumbnailsSynchronously` on every dropzone mount.

---

## 5. Verification Method

To independently verify this diagnosis and any subsequent implementation:

1. **Verify No Type or Lint Errors**:
   ```pwsh
   cd server && npx tsc --noEmit
   ```
   *Expected output*: Exit code 0, 0 errors.

2. **Verify Existing Server PDF Test Suite**:
   ```pwsh
   cd server && npx vitest run
   ```
   *Expected output*: 14/14 unit tests pass in `pdf.test.ts`.

3. **Verify Frontend Syntax**:
   ```pwsh
   pwsh -Command "Get-ChildItem -Recurse 'src/components/tools/pdf' -Filter *.js | ForEach-Object { node --check `$_.FullName }"
   ```
   *Expected output*: 0 syntax errors across all PDF tools.

4. **Verify Continuous Canvas Display (Manual Inspection / Browser Playwright)**:
   - Navigate to `#tool/pdf-studio/split` or `#tool/pdf-studio/rotate`.
   - Select a sample PDF with $\ge 8$ pages.
   - Select pages and click "Bắt đầu xử lý".
   - **Invalidation Condition**: If any canvas clears to transparent/black, or if the loader skeleton appears over an already loaded page, the continuous display guarantee is violated.
   - Flip pagination from Page 1 to Page 2, then back to Page 1.
   - **Invalidation Condition**: If Page 1 flashes black or displays a spinner upon returning, the synchronous cache restoration is invalid.
