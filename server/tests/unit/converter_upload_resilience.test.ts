import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConverterManager } from '../../../src/components/tools/converter/hooks/useConverter.js';
import { processSingleItem, startBackgroundUpload } from '../../../src/components/tools/converter/hooks/useConverterBatch.js';
import { updateBatchButton } from '../../../src/components/tools/converter/hooks/useConverterDom.js';
import { renderConverterQueueList } from '../../../src/components/tools/converter/components/ConverterQueueList.js';

describe('Converter Upload Resilience & Mobile Layout Suite', () => {
  let manager: any;

  beforeEach(() => {
    manager = new ConverterManager();
    manager.items = [];
    manager.isConverting = false;
    manager.options = {};
  });

  describe('1. Stale Items & Zombie File Prevention', () => {
    it('should block stale items restored from localStorage without fileId from converting', async () => {
      const staleItem = {
        id: 'stale_1',
        file: null,
        fileId: null,
        detectedMeta: { name: 'ghost.png', extension: 'png', size: 1024 },
        targetFormat: 'webp',
        status: 'stale',
        uploadStatus: 'expired',
        progress: 0,
        error: 'Tệp cần được nạp lại (phiên cũ)'
      };
      manager.items = [staleItem];

      // Calling processSingleItem directly on a stale item must reject immediately
      await expect(processSingleItem(manager, staleItem)).resolves.toBeUndefined();
      expect(staleItem.status).toBe('error');
      expect(staleItem.error).toMatch(/chưa được tải lên|hết hạn/i);
    });

    it('should never send { fileId: null } in converter job request', async () => {
      const itemWithoutFileId = {
        id: 'no_file_id',
        file: null,
        fileId: null,
        detectedMeta: { name: 'corrupted.mp4', extension: 'mp4', size: 50000 },
        targetFormat: 'mp3',
        status: 'ready'
      };
      manager.items = [itemWithoutFileId];

      const fetchSpy = vi.spyOn(global, 'fetch');
      await processSingleItem(manager, itemWithoutFileId);
      
      // Ensure fetch('/api/v1/converter/job') was NOT called with null fileId
      const converterJobCalls = fetchSpy.mock.calls.filter(call => String(call[0]).includes('/api/v1/converter/job'));
      expect(converterJobCalls).toHaveLength(0);
      expect(itemWithoutFileId.status).toBe('error');

      fetchSpy.mockRestore();
    });
  });

  describe('2. Background Upload Persistence & Error Recovery', () => {
    it('should persist fileId to storage immediately upon background upload completion', async () => {
      const persistSpy = vi.spyOn(manager, 'persist');
      const fakeFile = new File(['mock content'], 'test-video.mp4', { type: 'video/mp4' });
      const item = {
        id: 'item_upload_test',
        file: fakeFile,
        fileId: null,
        uploadStatus: 'idle',
        uploadProgress: 0,
        detectedMeta: { name: 'test-video.mp4', extension: 'mp4', size: fakeFile.size }
      };

      // Mock successful smartUploadFile
      vi.mock('../../../src/utilities/resumableUploader.js', async () => {
        const actual = await vi.importActual('../../../src/utilities/resumableUploader.js') as any;
        return {
          ...actual,
          smartUploadFile: vi.fn().mockResolvedValue({ fileId: 'fil_mock_success_123', sizeBytes: 1234 })
        };
      });

      const p = startBackgroundUpload(manager, item);
      await p;

      expect(item.fileId).toBe('fil_mock_success_123');
      expect(item.uploadStatus).toBe('uploaded');
      expect(persistSpy).toHaveBeenCalled();

      persistSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('3. Batch Button Live State & Upload Lockout', () => {
    function setupMockDOM() {
      const elements: Record<string, any> = {
        btnStartConversion: { disabled: false, className: '' },
        btnStartConversionIcon: { innerHTML: '' },
        btnStartConversionText: { textContent: '' }
      };

      (global as any).document = {
        getElementById: (id: string) => elements[id] || null,
        querySelectorAll: () => []
      };

      return elements;
    }

    it('should disable batch convert button while items are uploading and show live progress', () => {
      const dom = setupMockDOM();

      manager.items = [
        {
          id: '1',
          file: new File([''], 'file.mp4'),
          fileId: null,
          status: 'ready',
          uploadStatus: 'uploading',
          uploadProgress: 42
        }
      ];

      updateBatchButton(manager);

      expect(dom.btnStartConversion.disabled).toBe(true);
      expect(dom.btnStartConversionText.textContent).toContain('Đang tải lên máy chủ (42%)');
    });

    it('should enable batch convert button when all items have finished uploading', () => {
      const dom = setupMockDOM();

      manager.items = [
        {
          id: '1',
          file: null,
          fileId: 'fil_ready_1',
          status: 'ready',
          uploadStatus: 'uploaded'
        }
      ];

      updateBatchButton(manager);

      expect(dom.btnStartConversion.disabled).toBe(false);
      expect(dom.btnStartConversionText.textContent).toBe('Chuyển đổi 1 tệp tin');
    });
  });

  describe('4. Mobile UI Anti-Overlap & Two-Row Ergonomics', () => {
    it('should render clean responsive 2-row layout without cramped elements', () => {
      const items = [
        {
          id: 'item_mobile_1',
          detectedMeta: { name: 'long-video-recording-from-phone-screen.mp4', extension: 'mp4', category: 'video', categoryLabel: 'Video', size: 628000000 },
          targetFormat: 'mp4',
          status: 'ready',
          uploadStatus: 'uploading',
          uploadProgress: 75
        }
      ];

      const html = renderConverterQueueList({ items, isConverting: false });

      // Verifies row 1 info structure with truncate class
      expect(html).toContain('truncate');
      expect(html).toContain('long-video-recording-from-phone-screen.mp4');
      expect(html).toContain('598.9 MB');

      // Verifies row 2 format selector has fixed width w-28 to prevent overflow
      expect(html).toContain('item-format-select');
      expect(html).toContain('w-28');
      expect(html).toContain('Đang tải lên 75%');
      expect(html).toContain('btn-remove-item');
    });

    it('should render expired badge when item is stale', () => {
      const items = [
        {
          id: 'item_stale',
          detectedMeta: { name: 'old-doc.pdf', extension: 'pdf', category: 'document', size: 1024 },
          targetFormat: 'docx',
          status: 'stale',
          uploadStatus: 'expired'
        }
      ];

      const html = renderConverterQueueList({ items, isConverting: false });
      expect(html).toContain('Cần nạp lại');
    });
  });
});
