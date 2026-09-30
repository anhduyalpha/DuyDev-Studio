/**
 * Unit Test Suite: Milestone M3 - 9-Tools Premium Consistency & Concurrency Hardening
 *
 * Verifies:
 * 1. Single Image Support in `images_to_pdf` (ConfigPanel & usePdfQueue)
 * 2. Concurrency Defense & Guard Statements across all queue mutations when isProcessing === true
 * 3. AbortController / AbortSignal Support in pdfApi.js & usePdfQueue.cancelTask
 * 4. DOM Locking & Listener Hygiene in usePdfDom.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PdfQueueManager } from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';
import { renderConfigPanel } from '../../../src/components/tools/pdf/components/ConfigPanel.js';
import {
  uploadPdfFiles,
  dispatchPdfJob,
  uploadPdfJob,
  buildPdfResult
} from '../../../src/components/tools/pdf/hooks/pdfApi.js';
import * as toastModule from '../../../src/utilities/toast.js';

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    location: { origin: 'http://localhost:3000' },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    navigator: {}
  };
}
if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
}
if (typeof (globalThis as any).document === 'undefined' || !(globalThis as any).document.createElement) {
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({
      id: '',
      className: '',
      style: {},
      innerHTML: '',
      appendChild: () => {},
      remove: () => {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      }
    }),
    body: {
      appendChild: () => {}
    }
  };
}

let syncModeTabs: any;
let cleanupChainMenuListener: any;

describe('Milestone M3: 9-Tools Premium Consistency & Concurrency Hardening', () => {

  describe('1. Single Image Support in images_to_pdf vs Multi-File in merge', () => {
    it('should enable action button for images_to_pdf with exactly 1 image', () => {
      const html = renderConfigPanel({
        mode: 'images_to_pdf',
        files: [{ id: 'img-1', name: 'photo.jpg', size: 1024 * 500 }],
        isProcessing: false
      });

      // Must NOT be disabled when exactly 1 image is loaded
      expect(html).not.toMatch(/id="btnStartProcess"\s+disabled/);
      // Button label should dynamically indicate 1 image
      expect(html).toContain('Tạo PDF từ 1 ảnh');
    });

    it('should enable action button for images_to_pdf with multiple images', () => {
      const html = renderConfigPanel({
        mode: 'images_to_pdf',
        files: [
          { id: 'img-1', name: 'photo1.jpg', size: 1024 * 500 },
          { id: 'img-2', name: 'photo2.png', size: 1024 * 600 },
          { id: 'img-3', name: 'photo3.webp', size: 1024 * 700 }
        ],
        isProcessing: false
      });

      expect(html).not.toMatch(/id="btnStartProcess"\s+disabled/);
      expect(html).toContain('Tạo PDF từ 3 ảnh');
    });

    it('should disable action button for images_to_pdf when files list is empty', () => {
      const html = renderConfigPanel({
        mode: 'images_to_pdf',
        files: [],
        isProcessing: false
      });

      expect(html).toBe('');
    });

    it('should require at least 2 files for merge mode', () => {
      // 1 file in merge mode must be disabled
      const singlePdfHtml = renderConfigPanel({
        mode: 'merge',
        files: [{ id: 'pdf-1', name: 'doc1.pdf', size: 1024 * 100 }],
        isProcessing: false
      });
      expect(singlePdfHtml).toMatch(/id="btnStartProcess"\s+disabled/);
      expect(singlePdfHtml).toContain('Ghép 1 tệp PDF');

      // 2 files in merge mode must be enabled
      const twoPdfHtml = renderConfigPanel({
        mode: 'merge',
        files: [
          { id: 'pdf-1', name: 'doc1.pdf', size: 1024 * 100 },
          { id: 'pdf-2', name: 'doc2.pdf', size: 1024 * 200 }
        ],
        isProcessing: false
      });
      expect(twoPdfHtml).not.toMatch(/id="btnStartProcess"\s+disabled/);
      expect(twoPdfHtml).toContain('Ghép 2 tệp PDF');
    });

    it('should allow runProcess to proceed with 1 file in images_to_pdf mode', async () => {
      const qm = new PdfQueueManager();
      qm.mode = 'images_to_pdf';
      qm.files = [{ id: 'img-1', name: 'scan.png', size: 2000, rawFile: new Blob([]) } as any];

      const toastSpy = vi.spyOn(toastModule, 'showToast').mockImplementation(() => {});

      // Mock uploadPdfFiles & dispatchPdfJob
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { eventsUrl: '/events', pollUrl: '/poll' } })
      } as any);

      // Start processing - should not be blocked by the < 2 check
      const runPromise = qm.runProcess();
      expect(qm.isProcessing).toBe(true);
      expect(toastSpy).not.toHaveBeenCalledWith('Vui lòng chọn ít nhất 2 tệp để ghép', 'warning');

      // Cancel to clean up
      qm.cancelTask('pdf-studio-job');
      await runPromise.catch(() => {});
      globalThis.fetch = originalFetch;
      toastSpy.mockRestore();
    });

    it('should block runProcess with 1 file in merge mode', async () => {
      const qm = new PdfQueueManager();
      qm.mode = 'merge';
      qm.files = [{ id: 'pdf-1', name: 'only_one.pdf', size: 2000 } as any];

      const toastSpy = vi.spyOn(toastModule, 'showToast').mockImplementation(() => {});

      await qm.runProcess();
      expect(qm.isProcessing).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith('Vui lòng chọn ít nhất 2 tệp để ghép', 'warning');
      toastSpy.mockRestore();
    });
  });

  describe('2. Concurrency Defense & State Mutation Guarding (isProcessing === true)', () => {
    let qm: InstanceType<typeof PdfQueueManager>;

    beforeEach(() => {
      qm = new PdfQueueManager();
      qm.mode = 'split';
      qm.totalPages = 10;
      qm.thumbnailPage = 1;
      qm.pageRotations = { 0: 90 };
      qm.selectedSplitPages = new Set([0, 1]);
      qm.pages = '1-2';
      qm.files = [
        { id: 'f1', name: 'doc1.pdf', size: 1000 },
        { id: 'f2', name: 'doc2.pdf', size: 2000 },
        { id: 'f3', name: 'doc3.pdf', size: 3000 }
      ] as any;
    });

    it('should block addFiles when isProcessing is true', async () => {
      qm.isProcessing = true;
      const initialCount = qm.files.length;

      await qm.addFiles([new File(['test'], 'new.pdf', { type: 'application/pdf' })]);
      expect(qm.files.length).toBe(initialCount);
    });

    it('should block removeFile when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.removeFile('f1');
      expect(qm.files.map((f: any) => f.id)).toContain('f1');
      expect(qm.files.length).toBe(3);
    });

    it('should block clearFiles when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.clearFiles();
      expect(qm.files.length).toBe(3);
      expect(qm.selectedSplitPages.size).toBe(2);
    });

    it('should block reorderFiles when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.reorderFiles(0, 2);
      expect(qm.files.map((f: any) => f.id)).toEqual(['f1', 'f2', 'f3']);
    });

    it('should block moveFileUp and moveFileDown when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.moveFileUp(1);
      expect(qm.files[0].id).toBe('f1');
      qm.moveFileDown(0);
      expect(qm.files[0].id).toBe('f1');
    });

    it('should block setThumbnailPage when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.setThumbnailPage(0);
      expect(qm.thumbnailPage).toBe(1);
    });

    it('should block setRotation and rotatePage when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.setRotation(1, 180);
      expect(qm.pageRotations[1]).toBeUndefined();

      qm.rotatePage(0, 90);
      expect(qm.pageRotations[0]).toBe(90); // Preserves original 90, not 180
    });

    it('should block rotateAll and resetRotations when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.rotateAll(90);
      expect(qm.pageRotations[1]).toBeUndefined();

      qm.resetRotations();
      expect(qm.pageRotations[0]).toBe(90); // Was not cleared
    });

    it('should block setSplitRange and setPages when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.setSplitRange('5-8');
      expect(qm.pages).toBe('1-2');

      qm.setPages('3,4');
      expect(qm.pages).toBe('1-2');
    });

    it('should block split page toggling and select all/none when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.toggleSplitPage(5);
      expect(qm.selectedSplitPages.has(5)).toBe(false);

      qm.selectAllSplitPages();
      expect(qm.selectedSplitPages.size).toBe(2);

      qm.deselectAllSplitPages();
      expect(qm.selectedSplitPages.size).toBe(2);

      qm.selectOddSplitPages();
      expect(qm.selectedSplitPages.size).toBe(2);

      qm.selectEvenSplitPages();
      expect(qm.selectedSplitPages.size).toBe(2);
    });

    it('should block configuration setters when isProcessing is true', () => {
      qm.isProcessing = true;
      qm.setSecurityAction('unlock');
      expect(qm.securityAction).toBe('lock');

      qm.setCompressionPreset('high');
      expect(qm.compressionPreset).toBe('medium');

      qm.setAngle(180);
      expect(qm.angle).toBe(90);

      qm.setWatermarkText('CONFIDENTIAL');
      expect(qm.watermarkText).toBe('');

      qm.setWatermarkPosition('bottom');
      expect(qm.watermarkPosition).toBe('center');

      qm.setWatermarkOpacity(0.8);
      expect(qm.watermarkOpacity).toBe(0.3);

      qm.setPageNumbers(true);
      expect(qm.pageNumbers).toBe(false);

      qm.setPassword('secret123');
      expect(qm.password).toBe('');
    });

    it('should block addFileFromHistory when isProcessing is true', async () => {
      qm.isProcessing = true;
      const res = await qm.addFileFromHistory({ id: 'hist-1', fileName: 'sample.pdf' });
      expect(res).toBe(false);
    });

    it('should allow all operations when isProcessing is false', () => {
      qm.isProcessing = false;
      qm.setThumbnailPage(0);
      expect(qm.thumbnailPage).toBe(0);

      qm.reorderFiles(0, 1);
      expect(qm.files.map((f: any) => f.id)).toEqual(['f2', 'f1', 'f3']);

      qm.setRotation(1, 90);
      expect(qm.pageRotations[1]).toBe(90);

      qm.removeFile('f3');
      expect(qm.files.length).toBe(2);

      qm.clearFiles();
      expect(qm.files.length).toBe(0);
    });
  });

  describe('3. AbortController / AbortSignal Support in pdfApi.js & usePdfQueue', () => {
    let originalXHR: any;
    let originalFetch: any;

    class MockXHR {
      public method = '';
      public url = '';
      public status = 200;
      public responseText = JSON.stringify({ success: true, data: { fileId: 'fil_mock_test_123' } });
      public upload = {
        addEventListener: (event: string, cb: any) => {
          this.uploadListeners[event] = cb;
        }
      };
      public uploadListeners: Record<string, any> = {};
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public onabort: (() => void) | null = null;
      public aborted = false;

      open(method: string, url: string) {
        this.method = method;
        this.url = url;
      }

      send(_body?: any) {
        if (this.uploadListeners['progress']) {
          this.uploadListeners['progress']({ lengthComputable: true, loaded: 100, total: 100 });
        }
        setTimeout(() => {
          if (this.aborted) {
            if (this.onabort) this.onabort();
          } else if (this.status >= 200 && this.status < 300) {
            if (this.onload) this.onload();
          } else {
            if (this.onerror) this.onerror();
          }
        }, 10);
      }

      abort() {
        this.aborted = true;
        if (this.onabort) this.onabort();
      }
    }

    beforeEach(() => {
      originalXHR = (globalThis as any).XMLHttpRequest;
      originalFetch = globalThis.fetch;
      (globalThis as any).XMLHttpRequest = MockXHR;
    });

    afterEach(() => {
      (globalThis as any).XMLHttpRequest = originalXHR;
      globalThis.fetch = originalFetch;
    });

    it('should immediately reject uploadPdfFiles if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const fakeFiles = [{ name: 'test.pdf', rawFile: new Blob([]) }];
      await expect(uploadPdfFiles(fakeFiles as any, undefined, controller.signal)).rejects.toThrow(
        /Tác vụ tải tệp đã bị hủy/
      );
    });

    it('should abort in-flight XHR when signal is triggered', async () => {
      const controller = new AbortController();
      const fakeFiles = [{ name: 'heavy.pdf', rawFile: new Blob([]) }];

      const uploadPromise = uploadPdfFiles(fakeFiles as any, undefined, controller.signal);
      // Abort midway
      controller.abort();

      await expect(uploadPromise).rejects.toThrow(/Tác vụ tải tệp đã bị hủy/);
    });

    it('should successfully upload files when signal is not aborted', async () => {
      const controller = new AbortController();
      const fakeFiles = [{ name: 'doc.pdf', rawFile: new Blob([]) }];

      const fileIds = await uploadPdfFiles(fakeFiles as any, undefined, controller.signal);
      expect(fileIds).toEqual(['fil_mock_test_123']);
    });

    it('should pass signal to fetch in dispatchPdfJob', async () => {
      const controller = new AbortController();
      let passedSignal: any = null;

      globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
        passedSignal = opts?.signal;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { jobId: 'job_123' } })
        });
      });

      const res = await dispatchPdfJob(['fil_123'], 'compress', { compressionLevel: 'medium' }, controller.signal);
      expect(res).toEqual({ jobId: 'job_123' });
      expect(passedSignal).toBe(controller.signal);
    });

    it('should support uploadPdfJob combined helper with abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        uploadPdfJob({
          files: [{ name: 'test.pdf', rawFile: new Blob([]) }] as any,
          operation: 'split',
          options: { pages: '1-3' },
          signal: controller.signal
        })
      ).rejects.toThrow(/Tác vụ tải tệp đã bị hủy/);
    });

    it('should abort activeUploadAbortController upon cancelTask in usePdfQueue', () => {
      const qm = new PdfQueueManager();
      qm.isProcessing = true;
      const controller = new AbortController();
      qm.activeUploadAbortController = controller;

      let notified = false;
      qm.subscribe((_state: any, evt: string) => {
        if (evt === 'failed') notified = true;
      });

      qm.cancelTask('pdf-studio-job');

      expect(controller.signal.aborted).toBe(true);
      expect(qm.activeUploadAbortController).toBeNull();
      expect(qm.isProcessing).toBe(false);
      expect(notified).toBe(true);
    });
  });

  describe('4. DOM Tab Locking & Cleanup Hygiene', () => {
    beforeAll(async () => {
      const domModule = await import('../../../src/components/tools/pdf/hooks/usePdfDom.js');
      syncModeTabs = domModule.syncModeTabs;
      cleanupChainMenuListener = domModule.cleanupChainMenuListener;
    });

    it('should disable tab buttons when syncModeTabs is called with isProcessing = true', () => {
      // Mock DOM buttons
      const btn1 = { dataset: { mode: 'merge' }, disabled: false, className: '' };
      const btn2 = { dataset: { mode: 'split' }, disabled: false, className: '' };
      (globalThis as any).document = {
        querySelectorAll: (_sel: string) => [btn1, btn2]
      };

      syncModeTabs('merge', true);

      expect(btn1.disabled).toBe(true);
      expect(btn1.className).toContain('pointer-events-none');
      expect(btn1.className).toContain('cursor-not-allowed');

      expect(btn2.disabled).toBe(true);
      expect(btn2.className).toContain('pointer-events-none');

      // Sync back with isProcessing = false
      syncModeTabs('merge', false);
      expect(btn1.disabled).toBe(false);
      expect(btn1.className).toContain('bg-zinc-900');
      expect(btn2.disabled).toBe(false);
    });

    it('should safely execute cleanupChainMenuListener without errors', () => {
      (globalThis as any).document = {
        removeEventListener: vi.fn()
      };
      expect(() => cleanupChainMenuListener()).not.toThrow();
    });
  });
});
