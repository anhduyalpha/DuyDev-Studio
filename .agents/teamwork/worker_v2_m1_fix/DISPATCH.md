## 2026-09-27T12:54:21Z

You are Worker M1 Fix: Test Remediation Specialist.
Your working directory is: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m1_fix`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context to read first:
1. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## 2026-09-27T12:14:56Z`)
2. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_pdf_v2\PROJECT.md`
3. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\reviewer_v2_m1_1\handoff.md` (Specifically Finding 1 and Remediation instructions)

File to modify:
- `server/tests/unit/pdf_page_cache.test.ts`

Mission:
Remediate the test facade in `server/tests/unit/pdf_page_cache.test.ts` (lines 91–163):
1. Import `pdfPageCache` (singleton) alongside `PdfPageCache`:
   ```typescript
   import { pdfPageCache, PdfPageCache } from '../../../src/components/tools/pdf/services/PdfPageCache.js';
   ```
2. In `should pre-hide skeleton overlay when page is in cache`:
   - Set up uncached call: `renderPreviewCanvasBox({ file, pageIndex: 0, ... })` and verify skeleton does NOT have `hidden`.
   - Store entry in `pdfPageCache`: `pdfPageCache.set(cacheKey, { bitmap: { width: 100, height: 100 }, width: 100, height: 100 })`.
   - Call `renderPreviewCanvasBox` again with the cached page and verify the returned HTML includes `class="pdf-thumb-skeleton absolute inset-0 flex items-center justify-center text-zinc-400 hidden"`.
   - Clean up: `pdfPageCache.clear()`.
3. In `should restore canvas context synchronously from cache`:
   - Set up mockCanvas and mockSkeleton in DOM.
   - Populate `pdfPageCache.set('test_doc_p0_r0_s1', { bitmap: mockBitmap, width: 300, height: 400 })`.
   - Actually execute the production function: `const restored = restoreCanvasFromCache(mockCanvas as any, 'test_doc_p0_r0_s1')`.
   - Assert:
     - `expect(restored).toBe(true)`
     - `expect(mockCanvas.width).toBe(300)`
     - `expect(mockCanvas.height).toBe(400)`
     - `expect(drawImageSpy).toHaveBeenCalledWith(mockBitmap, 0, 0)`
     - `expect(mockSkeleton.classList.add).toHaveBeenCalledWith('hidden')`
     - `expect(mockCanvas.dataset.rendered).toBe('true')`
   - Clean up: `pdfPageCache.clear()`.
4. Run verification commands:
   - `cd server && npx vitest run tests/unit/pdf_page_cache.test.ts`
   - `cd server && npx tsc --noEmit`
   - `cd server && npx vitest run`
5. Write your handoff to `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m1_fix\handoff.md` and send a message back.
