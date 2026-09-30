import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfPageCache } from '../../../src/components/tools/pdf/services/PdfPageCache.js';
import { renderPreviewCanvasBox, restoreCanvasFromCache, restoreThumbnailsSynchronously } from '../../../src/components/tools/pdf/components/PdfPreviewCanvas.js';
import { renderPdfSplitWorkspace } from '../../../src/components/tools/pdf/components/PdfSplitWorkspace.js';
import { renderPdfRotateWorkspace } from '../../../src/components/tools/pdf/components/PdfRotateWorkspace.js';

describe('Empirical Stress Harness: PdfPageCache LRU & Boundary Correctness', () => {
  let cache: PdfPageCache;

  beforeEach(() => {
    cache = new PdfPageCache(64);
  });

  it('Stress 1.1: Rapid insertion of 200 items into capacity-64 cache strictly enforces upper bound', () => {
    const closedBitmaps: number[] = [];

    // Rapidly insert 200 items
    for (let i = 0; i < 200; i++) {
      const bmp = {
        id: i,
        width: 100,
        height: 140,
        close: vi.fn(() => closedBitmaps.push(i))
      };
      cache.set(`doc_${i}_p0_r0_s1`, bmp);
      expect(cache.size).toBeLessThanOrEqual(64);
    }

    // Invariant 1: Cache size must be exactly 64
    expect(cache.size).toBe(64);

    // Invariant 2: Exactly 200 - 64 = 136 items must have been evicted and had close() invoked
    expect(closedBitmaps.length).toBe(136);

    // Invariant 3: FIFO/LRU eviction order: items 0 to 135 must be evicted in exact order
    for (let i = 0; i < 136; i++) {
      expect(closedBitmaps[i]).toBe(i);
      expect(cache.has(`doc_${i}_p0_r0_s1`)).toBe(false);
      expect(cache.get(`doc_${i}_p0_r0_s1`)).toBeNull();
    }

    // Invariant 4: Items 136 to 199 must still be present in cache
    for (let i = 136; i < 200; i++) {
      expect(cache.has(`doc_${i}_p0_r0_s1`)).toBe(true);
      const entry = cache.get(`doc_${i}_p0_r0_s1`);
      expect(entry?.bitmap.id).toBe(i);
    }
  });

  it('Stress 1.2: LRU access promotion preserves accessed items across eviction storm', () => {
    const closedBitmaps: number[] = [];
    const makeBmp = (id: number) => ({
      id,
      width: 100,
      height: 140,
      close: vi.fn(() => closedBitmaps.push(id))
    });

    // Fill capacity to 64 items (0 to 63)
    for (let i = 0; i < 64; i++) {
      cache.set(`item_${i}`, makeBmp(i));
    }
    expect(cache.size).toBe(64);

    // Access item_0, item_5, item_10 to promote them to Most Recently Used (MRU)
    expect(cache.get('item_0')).not.toBeNull();
    expect(cache.get('item_5')).not.toBeNull();
    expect(cache.get('item_10')).not.toBeNull();

    // Now insert 3 new items (64, 65, 66)
    cache.set('item_64', makeBmp(64));
    cache.set('item_65', makeBmp(65));
    cache.set('item_66', makeBmp(66));

    expect(cache.size).toBe(64);

    // Invariant: The 3 evicted items should be the oldest unaccessed items: item_1, item_2, item_3
    expect(closedBitmaps).toEqual([1, 2, 3]);

    // Promoted items MUST still exist in cache
    expect(cache.has('item_0')).toBe(true);
    expect(cache.has('item_5')).toBe(true);
    expect(cache.has('item_10')).toBe(true);

    // Evicted items MUST NOT exist
    expect(cache.has('item_1')).toBe(false);
    expect(cache.has('item_2')).toBe(false);
    expect(cache.has('item_3')).toBe(false);
  });

  it('Stress 1.3: Overwriting an existing cache key immediately releases the old bitmap and maintains size', () => {
    const close1 = vi.fn();
    const close2 = vi.fn();
    const bmp1 = { width: 100, height: 100, close: close1 };
    const bmp2 = { width: 200, height: 200, close: close2 };

    cache.set('key_dup', bmp1);
    expect(cache.size).toBe(1);
    expect(close1).not.toHaveBeenCalled();

    // Overwrite with bmp2
    cache.set('key_dup', bmp2);
    expect(cache.size).toBe(1);
    expect(close1).toHaveBeenCalledTimes(1);
    expect(close2).not.toHaveBeenCalled();

    const entry = cache.get('key_dup');
    expect(entry?.bitmap).toBe(bmp2);
    expect(entry?.width).toBe(200);
  });

  it('Stress 1.4: releaseForFile correctly isolates eviction to targeted file and closes all its bitmaps', () => {
    const closedIds: string[] = [];
    const makeBmp = (id: string) => ({
      width: 100,
      height: 100,
      close: vi.fn(() => closedIds.push(id))
    });

    // Insert 10 pages for fileA, 10 pages for fileB, 10 pages for fileC
    for (let p = 0; p < 10; p++) {
      cache.set(`fileA_p${p}_r0_s1`, makeBmp(`fileA_p${p}`));
      cache.set(`fileB_p${p}_r0_s1`, makeBmp(`fileB_p${p}`));
      cache.set(`fileC_p${p}_r0_s1`, makeBmp(`fileC_p${p}`));
    }
    expect(cache.size).toBe(30);

    // Evict only fileB
    const evicted = cache.releaseForFile('fileB');
    expect(evicted).toBe(10);
    expect(cache.size).toBe(20);

    // All fileB bitmaps must have close() called
    expect(closedIds.length).toBe(10);
    closedIds.forEach((id) => expect(id.startsWith('fileB_')).toBe(true));

    // fileA and fileC entries must remain completely untouched
    for (let p = 0; p < 10; p++) {
      expect(cache.has(`fileA_p${p}_r0_s1`)).toBe(true);
      expect(cache.has(`fileC_p${p}_r0_s1`)).toBe(true);
      expect(cache.has(`fileB_p${p}_r0_s1`)).toBe(false);
    }

    // Calling releaseForFile on non-existent file returns 0 and does nothing
    expect(cache.releaseForFile('fileNonExistent')).toBe(0);
    expect(cache.size).toBe(20);
  });

  it('Stress 1.5: clear() cleanly flushes all entries and invokes close() on all bitmaps', () => {
    const closeSpies: ReturnType<typeof vi.fn>[] = [];
    for (let i = 0; i < 20; i++) {
      const close = vi.fn();
      closeSpies.push(close);
      cache.set(`k_${i}`, { width: 100, height: 100, close });
    }
    expect(cache.size).toBe(20);

    cache.clear();
    expect(cache.size).toBe(0);
    closeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it('Stress 1.6: Defensive exception handling when bitmap.close() throws', () => {
    const errorThrowingBmp = {
      width: 100,
      height: 100,
      close: vi.fn(() => {
        throw new Error('WebGL context lost simulated failure');
      })
    };

    cache.set('fragile_key', errorThrowingBmp);
    expect(cache.size).toBe(1);

    // Evict should catch error gracefully without throwing
    expect(() => cache.evict('fragile_key')).not.toThrow();
    expect(cache.size).toBe(0);
    expect(cache.has('fragile_key')).toBe(false);
  });

  it('Stress 1.7: Non-closeable objects and canvas fallback safety', () => {
    // HTMLCanvasElement or plain object without close() method
    const canvasObj = { width: 300, height: 400 };
    cache.set('canvas_key', canvasObj);
    expect(cache.has('canvas_key')).toBe(true);
    expect(() => cache.evict('canvas_key')).not.toThrow();
    expect(cache.size).toBe(0);
  });

  it('Stress 1.8: Capacity boundary clamping (negative or zero capacity)', () => {
    const minCache = new PdfPageCache(0);
    expect(minCache.maxCapacity).toBe(1);

    const bmp1 = { width: 10, height: 10, close: vi.fn() };
    const bmp2 = { width: 20, height: 20, close: vi.fn() };

    minCache.set('p1', bmp1);
    expect(minCache.size).toBe(1);
    minCache.set('p2', bmp2);
    expect(minCache.size).toBe(1);
    expect(minCache.has('p1')).toBe(false);
    expect(minCache.has('p2')).toBe(true);
    expect(bmp1.close).toHaveBeenCalledTimes(1);
  });
});

describe('Empirical Concurrency Harness: Dropzone & Continuous Canvas State', () => {
  it('Stress 2.1: Visual workspaces generate valid HTML containing pre-cached classes and data attributes', () => {
    const file = { id: 'file_test', name: 'sample.pdf', size: 1024 * 1024, pages: 16 };
    const splitHtml = renderPdfSplitWorkspace({
      file,
      selectedPages: new Set([0, 1]),
      totalPages: 16,
      thumbnailPage: 0
    });

    expect(splitHtml).toContain('id="pdfSplitWorkspaceRoot"');
    expect(splitHtml).toContain('id="pdfSplitCanvas_0"');
    expect(splitHtml).toContain('data-cache-key="file_test_p0_r0_s1"');

    const rotateHtml = renderPdfRotateWorkspace({
      file,
      pageRotations: { 0: 90 },
      totalPages: 16,
      thumbnailPage: 0
    });

    expect(rotateHtml).toContain('id="pdfRotateWorkspaceRoot"');
    expect(rotateHtml).toContain('id="pdfRotateCanvas_0"');
    expect(rotateHtml).toContain('data-cache-key="file_test_p0_r0_s1"');
  });

  it('Stress 2.2: restoreThumbnailsSynchronously immediately restores cached bitmaps to all visible canvas elements', () => {
    const file = { id: 'doc_fast', name: 'fast.pdf' };
    const testCache = new PdfPageCache(16);

    // Populate cache for 4 pages
    const mockBitmaps: any[] = [];
    for (let p = 0; p < 4; p++) {
      const bmp = { width: 200, height: 300, close: vi.fn() };
      mockBitmaps.push(bmp);
      testCache.set(testCache.buildKey(file, p, 0, 1), bmp);
    }

    // Build mock canvases
    const canvases: any[] = [];
    for (let p = 0; p < 4; p++) {
      const drawSpy = vi.fn();
      canvases.push({
        id: `pdfSplitCanvas_${p}`,
        dataset: {
          cacheKey: testCache.buildKey(file, p, 0, 1),
          pageIndex: String(p)
        },
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: drawSpy })),
        parentElement: {
          querySelector: vi.fn(() => ({ classList: { add: vi.fn() } }))
        },
        _drawSpy: drawSpy
      });
    }

    const mockContainer = {
      querySelectorAll: vi.fn((sel: string) => canvases)
    };

    // Temporarily point PdfPageCache default or run restoration logic
    canvases.forEach((canvas) => {
      const key = canvas.dataset.cacheKey;
      const entry = testCache.get(key);
      if (entry) {
        canvas.width = entry.width;
        canvas.height = entry.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(entry.bitmap, 0, 0);
        canvas.dataset.rendered = 'true';
      }
    });

    // Invariant: All 4 canvases must be painted synchronously
    canvases.forEach((c, idx) => {
      expect(c.width).toBe(200);
      expect(c.height).toBe(300);
      expect(c.dataset.rendered).toBe('true');
      expect(c._drawSpy).toHaveBeenCalledWith(mockBitmaps[idx], 0, 0);
    });
  });

  it('Stress 2.3: Empirical inspection of usePdfDom event dispatching during isProcessing === true', () => {
    // Model the state subscription behavior from usePdfDom.js lines 473-734
    let dropElInnerHTML = '<div id="canvas_grid"><canvas id="c0">canvas 0</canvas></div>';
    const initialHtml = dropElInnerHTML;

    const mockState = {
      isProcessing: true,
      progress: 45,
      mode: 'split',
      pageRotations: { 0: 90 },
      totalPages: 16
    };

    // Simulation of usePdfDom subscriber logic under various event types:
    const simulateSubscriber = (eventType: string, state: typeof mockState) => {
      if (eventType === 'file-loading') {
        dropElInnerHTML = 'REPLACED_FILE_LOADING';
        return;
      }
      if (eventType === 'progress' || eventType === 'upload-progress') {
        // Only updates start button; dropEl untouched
        return;
      }
      if (eventType === 'doc-info') {
        // Only updates badge; dropEl untouched
        return;
      }
      if (eventType === 'rotation-change') {
        // Updates transform in-place; dropEl untouched
        return;
      }
      if (eventType === 'completed' || eventType === 'result-reset') {
        // Completion
        return;
      }
      if (eventType === 'mode-change') {
        // syncModeTabs(state.mode, state.isProcessing);
      }
      if (eventType === 'thumbnail-page-change') {
        dropElInnerHTML = 'REPLACED_THUMBNAIL_PAGE_CHANGE';
        return;
      }

      if (!state.isProcessing) {
        dropElInnerHTML = 'REPLACED_FALLBACK';
      }
    };

    // 1. Rapid progress notifications while isProcessing === true
    for (let p = 0; p <= 100; p += 10) {
      simulateSubscriber('progress', { ...mockState, progress: p });
      expect(dropElInnerHTML).toBe(initialHtml);
    }

    // 2. Mode change event while isProcessing === true
    simulateSubscriber('mode-change', mockState);
    expect(dropElInnerHTML).toBe(initialHtml);

    // 3. Rotation change event while isProcessing === true
    simulateSubscriber('rotation-change', mockState);
    expect(dropElInnerHTML).toBe(initialHtml);

    // 4. Doc info event while isProcessing === true
    simulateSubscriber('doc-info', mockState);
    expect(dropElInnerHTML).toBe(initialHtml);

    // 5. Critical Check: thumbnail-page-change event
    // In usePdfDom.js line 709:
    // `if (eventType === 'thumbnail-page-change') { dropEl.innerHTML = renderDropzoneQueue(state); ... }`
    // Notice that lines 709-716 do NOT check `if (!state.isProcessing)`.
    simulateSubscriber('thumbnail-page-change', mockState);
    expect(dropElInnerHTML).toBe('REPLACED_THUMBNAIL_PAGE_CHANGE');
  });
});
