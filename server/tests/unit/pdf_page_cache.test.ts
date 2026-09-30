import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pdfPageCache, PdfPageCache } from '../../../src/components/tools/pdf/services/PdfPageCache.js';
import { renderPreviewCanvasBox, restoreCanvasFromCache, restoreThumbnailsSynchronously } from '../../../src/components/tools/pdf/components/PdfPreviewCanvas.js';

describe('PdfPageCache (Milestone M1: Continuous Display & Page Cache)', () => {
  let cache: PdfPageCache;

  beforeEach(() => {
    cache = new PdfPageCache(4);
  });

  it('should generate consistent standard cache keys', () => {
    const key = cache.buildKey('doc_123', 0, 90, 1);
    expect(key).toBe('doc_123_p0_r90_s1');

    const keyFromFile = cache.buildKey({ id: 'file_abc', name: 'demo.pdf' }, 2, 0, 1);
    expect(keyFromFile).toBe('file_abc_p2_r0_s1');
  });

  it('should store and synchronously retrieve rendered bitmaps with dimensions', () => {
    const mockBitmap = { close: vi.fn(), width: 240, height: 340 };
    cache.set('doc_1_p0_r0_s1', mockBitmap);

    expect(cache.has('doc_1_p0_r0_s1')).toBe(true);
    const entry = cache.get('doc_1_p0_r0_s1');
    expect(entry).not.toBeNull();
    expect(entry?.bitmap).toBe(mockBitmap);
    expect(entry?.width).toBe(240);
    expect(entry?.height).toBe(340);
  });

  it('should perform LRU eviction and call bitmap.close() when capacity is reached', () => {
    const closed: string[] = [];
    const makeBmp = (id: string) => ({
      width: 200,
      height: 300,
      close: vi.fn(() => closed.push(id))
    });

    cache.set('f_p0_r0_s1', makeBmp('b0'));
    cache.set('f_p1_r0_s1', makeBmp('b1'));
    cache.set('f_p2_r0_s1', makeBmp('b2'));
    cache.set('f_p3_r0_s1', makeBmp('b3'));
    expect(cache.size).toBe(4);

    // Access p0 to mark it as most recently used (order now: b1, b2, b3, b0)
    cache.get('f_p0_r0_s1');

    // Add 5th element: should evict b1 (oldest in LRU order)
    cache.set('f_p4_r0_s1', makeBmp('b4'));
    expect(cache.size).toBe(4);
    expect(cache.has('f_p1_r0_s1')).toBe(false);
    expect(cache.has('f_p0_r0_s1')).toBe(true);
    expect(closed).toContain('b1');
  });

  it('should release all entries for a specific file when file is cleared', () => {
    const b0 = { close: vi.fn(), width: 100, height: 100 };
    const b1 = { close: vi.fn(), width: 100, height: 100 };
    const bOther = { close: vi.fn(), width: 100, height: 100 };

    cache.set('fileA_p0_r0_s1', b0);
    cache.set('fileA_p1_r0_s1', b1);
    cache.set('fileB_p0_r0_s1', bOther);

    expect(cache.size).toBe(3);
    const evicted = cache.releaseForFile('fileA');
    expect(evicted).toBe(2);
    expect(cache.has('fileA_p0_r0_s1')).toBe(false);
    expect(cache.has('fileA_p1_r0_s1')).toBe(false);
    expect(cache.has('fileB_p0_r0_s1')).toBe(true);
    expect(b0.close).toHaveBeenCalledTimes(1);
    expect(b1.close).toHaveBeenCalledTimes(1);
  });

  it('should clear all entries cleanly and close all underlying bitmaps', () => {
    const b0 = { close: vi.fn(), width: 100, height: 100 };
    const b1 = { close: vi.fn(), width: 100, height: 100 };

    cache.set('f_p0_r0_s1', b0);
    cache.set('f_p1_r0_s1', b1);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(b0.close).toHaveBeenCalledTimes(1);
    expect(b1.close).toHaveBeenCalledTimes(1);
  });
});

describe('PdfPreviewCanvas Markup & Synchronous Restoration', () => {
  it('should pre-hide skeleton overlay when page is in cache', () => {
    pdfPageCache.clear();
    const file = { id: 'sample_doc', name: 'sample.pdf' };
    const cacheKey = 'sample_doc_p0_r0_s1';

    // Verify uncached state
    const uncachedHtml = renderPreviewCanvasBox({
      file,
      pageIndex: 0,
      canvasId: 'pdfSplitCanvas_0',
      skeletonId: 'pdfSplitSkeleton_0'
    });
    expect(uncachedHtml).toContain('id="pdfSplitCanvas_0"');
    expect(uncachedHtml).not.toContain('class="pdf-thumb-skeleton absolute inset-0 flex items-center justify-center text-zinc-400 hidden"');

    // Store entry in pdfPageCache
    pdfPageCache.set(cacheKey, { bitmap: { width: 100, height: 100 }, width: 100, height: 100 });

    // Call renderPreviewCanvasBox again with the cached page
    const cachedHtml = renderPreviewCanvasBox({
      file,
      pageIndex: 0,
      canvasId: 'pdfSplitCanvas_0',
      skeletonId: 'pdfSplitSkeleton_0'
    });
    expect(cachedHtml).toContain('class="pdf-thumb-skeleton absolute inset-0 flex items-center justify-center text-zinc-400 hidden"');

    // Clean up
    pdfPageCache.clear();
  });

  it('should restore canvas context synchronously from cache', () => {
    pdfPageCache.clear();
    const drawImageSpy = vi.fn();
    const mockContext = { drawImage: drawImageSpy };
    const mockCanvas = {
      id: 'pdfSplitCanvas_0',
      width: 0,
      height: 0,
      dataset: { cacheKey: 'test_doc_p0_r0_s1' } as Record<string, string>,
      getContext: vi.fn(() => mockContext)
    };

    const mockSkeleton = {
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      }
    };

    // Mock document.getElementById
    const origDocument = (globalThis as any).document;
    (globalThis as any).document = {
      getElementById: (id: string) => {
        if (id === 'pdfSplitSkeleton_0') return mockSkeleton;
        return null;
      },
      querySelectorAll: () => []
    };

    try {
      const mockBitmap = { width: 300, height: 400 };
      pdfPageCache.set('test_doc_p0_r0_s1', {
        bitmap: mockBitmap,
        width: 300,
        height: 400
      });

      const restored = restoreCanvasFromCache(mockCanvas as any, 'test_doc_p0_r0_s1');

      expect(restored).toBe(true);
      expect(mockCanvas.width).toBe(300);
      expect(mockCanvas.height).toBe(400);
      expect(drawImageSpy).toHaveBeenCalledWith(mockBitmap, 0, 0);
      expect(mockSkeleton.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockCanvas.dataset.rendered).toBe('true');
    } finally {
      pdfPageCache.clear();
      (globalThis as any).document = origDocument;
    }
  });
});
