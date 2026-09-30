# Milestone M1 Review Report: Continuous Thumbnails & Page Cache

**Reviewer**: Reviewer 1 (Adversarial Critic & Code Quality Specialist)  
**Working Directory**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\reviewer_v2_m1_1`  
**Target Milestone**: M1 (Continuous Thumbnails & Page Cache)  
**Date**: 2026-09-27  

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### Observation 1.1: Critical Integrity Violation in Unit Tests (`server/tests/unit/pdf_page_cache.test.ts`)

#### A. Facade & Self-Certifying Restoration Test (Lines 112–163)
In `server/tests/unit/pdf_page_cache.test.ts` (line 3):
```typescript
import { renderPreviewCanvasBox, restoreCanvasFromCache, restoreThumbnailsSynchronously } from '../../../src/components/tools/pdf/components/PdfPreviewCanvas.js';
```
`restoreCanvasFromCache` is imported, but in the test `should restore canvas context synchronously from cache` (lines 147–156):
```typescript
    // Directly test restore logic
    const entry = testCache.get('test_doc_p0_r0_s1');
    expect(entry).not.toBeNull();
    if (entry) {
      mockCanvas.width = entry.width;
      mockCanvas.height = entry.height;
      const ctx = mockCanvas.getContext('2d');
      ctx.drawImage(entry.bitmap, 0, 0);
      mockCanvas.dataset.rendered = 'true';
    }

    expect(mockCanvas.width).toBe(300);
    expect(mockCanvas.height).toBe(400);
    expect(drawImageSpy).toHaveBeenCalledWith(entry?.bitmap, 0, 0);
    expect(mockCanvas.dataset.rendered).toBe('true');
```
**Direct Observation**:
The test never executes `restoreCanvasFromCache(mockCanvas, key)` or `restoreThumbnailsSynchronously(container, file)`. Instead, it manually inlines the 6 lines of code inside the test body and asserts that its own inlined mock statements ran. Furthermore, `mockSkeleton.classList.add('hidden')` is never exercised or asserted because the actual function was never invoked.

#### B. Dummy / Incomplete Cache Pre-Hide Test (Lines 91–110)
In `server/tests/unit/pdf_page_cache.test.ts` (lines 91–110):
```typescript
  it('should pre-hide skeleton overlay when page is in cache', () => {
    const file = { id: 'sample_doc', name: 'sample.pdf' };
    const cacheKey = 'sample_doc_p0_r0_s1';

    // Clear and verify uncached state
    const uncachedHtml = renderPreviewCanvasBox({
      file,
      pageIndex: 0,
      canvasId: 'pdfSplitCanvas_0',
      skeletonId: 'pdfSplitSkeleton_0'
    });
    expect(uncachedHtml).toContain('id="pdfSplitCanvas_0"');
    expect(uncachedHtml).not.toContain('class="pdf-thumb-skeleton absolute inset-0 flex items-center justify-center text-zinc-400 hidden"');

    // Store in cache
    const globalCache = (PdfPageCache as any).default || new PdfPageCache();
    // Test that renderPreviewCanvasBox renders with classes
    expect(uncachedHtml).toContain('pdf-thumb-canvas');
    expect(uncachedHtml).toContain('pdf-thumb-skeleton');
  });
```
**Direct Observation**:
The test claims to verify that `renderPreviewCanvasBox` pre-hides the skeleton when a page is cached. However:
1. `pdfPageCache` (the singleton queried by `renderPreviewCanvasBox`) is never populated.
2. `globalCache` is a local instantiation that is never populated or passed anywhere.
3. `renderPreviewCanvasBox` is never called a second time with cached state.
4. The test simply re-asserts that `uncachedHtml` contains `'pdf-thumb-canvas'` and `'pdf-thumb-skeleton'`.
The cached branch (`${isCached ? 'hidden' : ''}`) is completely unexercised.

### Observation 1.2: Production Code Verification & Robustness

1. **`src/components/tools/pdf/services/PdfPageCache.js`**:
   - Implements bounded LRU eviction (`maxCapacity = 64`).
   - Eviction cleans up GPU resources via `if (entry?.bitmap && typeof entry.bitmap.close === 'function') entry.bitmap.close();` inside `try...catch` (lines 135–139).
   - `releaseForFile(fileOrId)` cleanly iterates keys starting with `${fileId}_p` and evicts them on file change (lines 148–162).
   - Singleton exported cleanly as `pdfPageCache`.

2. **`src/components/tools/pdf/components/PdfPreviewCanvas.js`**:
   - `activeRenderSessionToken` monotonic increment guards every `await` boundary (lines 10, 133, 145, 155, 165, 187, 189), gracefully terminating stale loops during rapid user page flipping or pagination.
   - Synchronous restoration (`restoreThumbnailsSynchronously`) immediately applies cached bitmaps to `<canvas>` contexts before browser paint (lines 96–112).
   - Pre-hides skeleton when `pdfPageCache.has(cacheKey)` is true (lines 35, 44).
   - Defensive fallback for environments lacking `createImageBitmap` using offscreen `<canvas>` (lines 201–207, 215–226).

3. **`src/components/tools/pdf/hooks/usePdfDom.js`**:
   - `setVisualWorkspaceProcessingState(true)` (lines 46–77) dims `#pdfDropzoneContainer` and disables interactive buttons in-place without touching `dropEl.innerHTML`.
   - Event `process-start` returns immediately after updating controls (lines 641–661), completely avoiding canvas DOM rebuilding.
   - Guard `if (!state.isProcessing)` (lines 720–726) strictly protects `dropEl.innerHTML` from demolition during asynchronous background task progression.
   - Stale string token `currentRenderedThumbKey` has been completely deleted across the codebase. Hydration checks `canvas.pdf-thumb-canvas:not([data-rendered="true"])` (lines 151, 212), eliminating the infinite spinner deadlock.

4. **Verification Tool Commands Executed**:
   - `node --check src/components/tools/pdf/**/*.js`: Exit code 0 (all 5 files syntax valid).
   - `cd server && npx tsc --noEmit`: Exit code 0 (0 TypeScript errors).
   - `cd server && npx vitest run tests/unit/pdf_page_cache.test.ts`: 7/7 tests passed (8ms).
   - `cd server && npx vitest run`: 20/20 test files passed, 144/144 tests passed.

---

## 2. Logic Chain

1. **Step 1 (Integrity Violation Identification)**: The system rules strictly mandate: *"When reviewing work, actively check for integrity violations: Dummy or facade implementations that look correct but implement no real logic... Evidence of self-certifying work without genuine independent verification. If you detect ANY of these patterns, your verdict MUST be REQUEST_CHANGES with a Critical finding tagged as INTEGRITY VIOLATION."*
2. **Step 2 (Evidence of Self-Certifying Test)**: Observation 1.1A documents that `server/tests/unit/pdf_page_cache.test.ts` imports `restoreCanvasFromCache`, but deliberately inlines mock canvas mutations in lines 150–156 under the comment `// Directly test restore logic`. The test never invokes the actual function under test.
3. **Step 3 (Evidence of Facade Test)**: Observation 1.1B documents that `should pre-hide skeleton overlay when page is in cache` only tests the uncached condition, defines an unused `globalCache` dummy variable, and never calls `renderPreviewCanvasBox` with cached data, while claiming to verify cached pre-hiding.
4. **Step 4 (Production Code Evaluation)**: Observations 1.2.1 through 1.2.3 verify that the production implementation in `src/` is well-architected, correctly prevents memory leaks via `bitmap.close()`, prevents black flashes by preserving `dropEl.innerHTML`, and completely eliminates the `currentRenderedThumbKey` deadlock.
5. **Step 5 (Verdict Synthesis)**: Despite the high quality of the production JavaScript implementation, the unit test file contains dummy/facade assertions that self-certify without executing the actual implementation. In adherence to the integrity rules, the reviewer must not approve self-certifying work. The verdict must be `REQUEST_CHANGES`.

---

## 3. Findings

### [Critical] Finding 1: INTEGRITY VIOLATION — Self-Certifying & Facade Tests in `server/tests/unit/pdf_page_cache.test.ts`
- **What**: Tests in `describe('PdfPreviewCanvas Markup & Synchronous Restoration')` bypass executing the imported production functions (`restoreCanvasFromCache` and `renderPreviewCanvasBox` with cached data) and instead test inlined code and duplicate uncached assertions.
- **Where**: `server/tests/unit/pdf_page_cache.test.ts`, lines 91–163.
- **Why**: Violates testing integrity and creates a false sense of verification coverage. A regression in `restoreCanvasFromCache` or `renderPreviewCanvasBox` would not be detected because the tests never call them in the tested states.
- **Remediation**:
  1. Import the singleton `pdfPageCache` alongside `PdfPageCache`:
     ```typescript
     import { pdfPageCache, PdfPageCache } from '../../../src/components/tools/pdf/services/PdfPageCache.js';
     ```
  2. In `should pre-hide skeleton overlay when page is in cache`:
     Populate `pdfPageCache.set(cacheKey, { bitmap: { width: 100, height: 100 }, width: 100, height: 100 })`, invoke `renderPreviewCanvasBox`, and assert that the returned HTML includes `class="pdf-thumb-skeleton absolute inset-0 flex items-center justify-center text-zinc-400 hidden"`.
  3. In `should restore canvas context synchronously from cache`:
     Populate `pdfPageCache.set('test_doc_p0_r0_s1', { bitmap: mockBitmap, width: 300, height: 400 })`, invoke `const restored = restoreCanvasFromCache(mockCanvas as any, 'test_doc_p0_r0_s1')`, and assert:
     - `expect(restored).toBe(true)`
     - `expect(mockCanvas.width).toBe(300)`
     - `expect(mockCanvas.height).toBe(400)`
     - `expect(drawImageSpy).toHaveBeenCalledWith(mockBitmap, 0, 0)`
     - `expect(mockSkeleton.classList.add).toHaveBeenCalledWith('hidden')`
     - `expect(mockCanvas.dataset.rendered).toBe('true')`

---

## 4. Caveats

- **Production Code Merit**: The implementation files `PdfPageCache.js`, `PdfPreviewCanvas.js`, `PdfSplitWorkspace.js`, `PdfRotateWorkspace.js`, and `usePdfDom.js` are functionally correct, leak-free, deadlock-free, and clean. No production logic changes are required.
- **Homeserver Deployment**: Homeserver deployment to `192.168.2.171` is assigned to Milestone M4.

---

## 5. Conclusion

- **Verdict**: **REQUEST_CHANGES**
- **Action Required by Worker M1**:
  Update `server/tests/unit/pdf_page_cache.test.ts` to replace the facade/self-certifying test blocks with genuine invocations of `pdfPageCache`, `restoreCanvasFromCache`, and `renderPreviewCanvasBox`, verifying both uncached and cached execution paths.

---

## 6. Verification Method

To verify the remediation:
1. Check that `server/tests/unit/pdf_page_cache.test.ts` actually calls `restoreCanvasFromCache(mockCanvas, ...)` and verifies `mockSkeleton.classList.add('hidden')`.
2. Check that `server/tests/unit/pdf_page_cache.test.ts` populates `pdfPageCache` and verifies that `renderPreviewCanvasBox` produces the `hidden` class on the skeleton.
3. Run:
   ```pwsh
   cd server && npx vitest run tests/unit/pdf_page_cache.test.ts
   cd server && npx tsc --noEmit
   ```
   Both must pass with 0 errors and genuine call assertion coverage.
