import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPdfResult } from '../../../src/components/tools/pdf/hooks/pdfApi.js';
import { storage, STORAGE_KEYS } from '../../../src/utilities/storage.js';
import { renderResultCard } from '../../../src/components/tools/pdf/components/ResultCard.js';
import { soundEngine } from '../../../src/utilities/soundEngine.js';
import { openPdfContinueModal, closePdfContinueModal } from '../../../src/components/tools/pdf/components/PdfContinueModal.js';

describe('PDF Studio History & Result Card Continuation Test Suite', () => {
  let originalFetch: any;
  let originalLocalStorage: any;
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStore[key] || null),
      setItem: vi.fn((key: string, val: string) => { mockStore[key] = String(val); }),
      removeItem: vi.fn((key: string) => { delete mockStore[key]; }),
      clear: vi.fn(() => { mockStore = {}; }),
      length: 0,
      key: vi.fn()
    } as any;

    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [], total: 0 } })
    });
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. PDF Job Result & History Recording', () => {
    it('buildPdfResult constructs metadata and records to storage with mode and toolId', () => {
      const spyRecord = vi.spyOn(storage, 'recordCompletedJob');
      const data = {
        resultFileId: 'res_file_123',
        historyId: 'hist_456',
        originalSizeBytes: 200000,
        resultSizeBytes: 80000,
        savingsPct: 60.0,
        downloadUrl: '/api/v1/files/download/res_file_123'
      };
      const mainFile = { name: 'report.pdf', size: 200000 };

      const result = buildPdfResult(data, mainFile, 'compress', '1.25', 'https://studio.duydev.cloud');

      expect(result.fileName).toBe('report_compress.pdf');
      expect(result.resultFileId).toBe('res_file_123');
      expect(result.mode).toBe('compress');
      expect(result.savedPct).toBe(60.0);

      expect(spyRecord).toHaveBeenCalledTimes(1);
      const recordArg = spyRecord.mock.calls[0][0];
      expect(recordArg.toolId).toBe('pdf-studio');
      expect(recordArg.mode).toBe('compress');
      expect(recordArg.savedPct).toBe(60.0);
      expect(recordArg.resultFileId).toBe('res_file_123');
    });

    it('recordCompletedJob writes to localStorage and triggers background sync to /api/v1/history', () => {
      const record = {
        id: 'job_test_1',
        toolId: 'pdf-studio',
        toolTitle: 'PDF Studio Pro',
        fileName: 'merged_doc.pdf',
        originalSize: 50000,
        resultSize: 45000,
        savedPct: 10,
        mode: 'merge',
        downloadUrl: '/api/v1/files/download/res_test_1',
        resultFileId: 'res_test_1'
      };

      storage.recordCompletedJob(record);

      const storedRaw = mockStore[STORAGE_KEYS.HISTORY];
      expect(storedRaw).toBeTruthy();
      const parsed = JSON.parse(storedRaw);
      expect(parsed.length).toBe(1);
      expect(parsed[0].toolId).toBe('pdf-studio');
      expect(parsed[0].mode).toBe('merge');
      expect(parsed[0].resultFileId).toBe('res_test_1');

      // Verify background POST /api/v1/history was called
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/history', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));
    });

    it('fetchHistory merges server and local history so local items are never wiped out', async () => {
      // Pre-seed local storage with a locally completed PDF job
      const localItem = {
        id: 'local_pdf_1',
        toolId: 'pdf-studio',
        toolTitle: 'PDF Studio Pro',
        fileName: 'compressed.pdf',
        downloadUrl: '/api/v1/files/download/res_local_1',
        resultFileId: 'res_local_1',
        status: 'success'
      };
      mockStore[STORAGE_KEYS.HISTORY] = JSON.stringify([localItem]);

      // Server returns empty array (e.g. guest device with no server history yet)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { items: [], total: 0 }
        })
      });

      const history = await storage.fetchHistory();

      // Local item MUST still be preserved!
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('local_pdf_1');
      expect(history[0].toolId).toBe('pdf-studio');

      const storedInLocalStorage = JSON.parse(mockStore[STORAGE_KEYS.HISTORY]);
      expect(storedInLocalStorage.length).toBe(1);
      expect(storedInLocalStorage[0].id).toBe('local_pdf_1');
    });
  });

  describe('2. Result Card Continuation & Actions', () => {
    it('renderResultCard includes Xử lý tiếp button for PDF results and Tiếp tục button', () => {
      const pdfResult = {
        fileName: 'report_watermark.pdf',
        originalSize: 100000,
        resultSize: 95000,
        savedPct: 5,
        duration: '0.85s',
        downloadUrl: '/api/v1/files/download/abc',
        resultFileId: 'abc',
        mode: 'watermark'
      };

      const html = renderResultCard(pdfResult);

      // Verify Tải về, Xem trước, Xóa
      expect(html).toContain('Tải về');
      expect(html).toContain('id="btnPreviewPdfResult"');
      expect(html).toContain('id="btnTrashPdfResult"');

      // Verify Xử lý tiếp button exists for PDF outputs
      expect(html).toContain('id="btnContinueWithResult"');
      expect(html).toContain('Xử lý tiếp');

      // Verify Tiếp tục button exists
      expect(html).toContain('id="btnResetResult"');
      expect(html).toContain('Tiếp tục');
    });

    it('renderResultCard omits Xử lý tiếp button for non-PDF output (e.g. ZIP or DOCX)', () => {
      const docxResult = {
        fileName: 'document.docx',
        originalSize: 100000,
        resultSize: 40000,
        savedPct: 60,
        duration: '2.1s',
        downloadUrl: '/api/v1/files/download/docx_123',
        resultFileId: 'docx_123',
        mode: 'pdf_to_docx'
      };

      const html = renderResultCard(docxResult);

      expect(html).not.toContain('id="btnContinueWithResult"');
      expect(html).toContain('id="btnResetResult"');
      expect(html).toContain('Tiếp tục');
    });
  });

  describe('3. SoundEngine & PdfContinueModal Resilience', () => {
    it('soundEngine.playAction exists and calls playToggle without throwing', () => {
      const spyToggle = vi.spyOn(soundEngine, 'playToggle').mockImplementation(() => {});
      expect(typeof (soundEngine as any).playAction).toBe('function');
      (soundEngine as any).playAction();
      expect(spyToggle).toHaveBeenCalledTimes(1);
    });

    it('openPdfContinueModal creates modal with z-[99999] and closes cleanly', () => {
      const mockQm = {
        result: { fileName: 'output.pdf', resultSize: 12345 },
        chainResultToMode: vi.fn()
      };

      let insertedHtml = '';
      const mockElements: Record<string, any> = {};

      const originalDoc = (global as any).document;
      const originalWin = (global as any).window;

      const mockModalEl = {
        id: 'pdfContinueModal',
        className: 'fixed inset-0 z-[99999] flex items-center justify-center',
        innerHTML: '',
        remove: vi.fn(() => {
          delete mockElements['pdfContinueModal'];
        }),
        querySelector: vi.fn(() => ({ addEventListener: vi.fn() })),
        querySelectorAll: vi.fn(() => []),
        addEventListener: vi.fn()
      };

      (global as any).window = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      (global as any).document = {
        body: {
          style: { overflow: '' },
          insertAdjacentHTML: vi.fn((pos, html) => {
            insertedHtml = html;
            mockModalEl.innerHTML = html;
            mockElements['pdfContinueModal'] = mockModalEl;
            mockElements['pdfContinueModalCard'] = { contains: vi.fn(() => true), addEventListener: vi.fn() };
          })
        },
        getElementById: vi.fn((id: string) => mockElements[id] || null)
      };

      try {
        openPdfContinueModal({ fileInfo: mockQm.result, qm: mockQm as any });

        const modal = (global as any).document.getElementById('pdfContinueModal');
        expect(modal).not.toBeNull();
        expect(insertedHtml).toContain('z-[99999]');
        expect(insertedHtml).toContain('Chọn công cụ xử lý tiếp');
        expect(insertedHtml).toContain('output.pdf');

        closePdfContinueModal();
        expect(mockModalEl.remove).toHaveBeenCalled();
      } finally {
        (global as any).document = originalDoc;
        (global as any).window = originalWin;
      }
    });
  });
});
