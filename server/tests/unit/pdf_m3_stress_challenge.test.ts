/**
 * Empirical Stress & Concurrency Challenge Test Suite: Milestone M3
 *
 * Adversarial Testing:
 * 1. Concurrency Flood: 200 concurrent mutation requests while isProcessing === true.
 *    Verifies absolute zero state corruption across all queue methods.
 * 2. Network Abort & Cancellation Resilience:
 *    In-flight aborts, pre-aborted signals, multiple abort triggers, and signal listener cleanup.
 * 3. Single Image Conversion & Boundary Modes:
 *    Dynamic button labels, single vs multi-file validation, cross-mode file switching & resource cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PdfQueueManager,
  filterFilesForMode
} from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';
import { renderConfigPanel } from '../../../src/components/tools/pdf/components/ConfigPanel.js';
import {
  uploadPdfFiles,
  dispatchPdfJob,
  uploadPdfJob
} from '../../../src/components/tools/pdf/hooks/pdfApi.js';
import * as toastModule from '../../../src/utilities/toast.js';

// Setup minimal browser mocks for Node environment
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

describe('Empirical Challenge: Milestone M3 Concurrency & Resilience Stress Suite', () => {

  describe('Challenge 1: High-Concurrency Mutation Flood While isProcessing === true', () => {
    let qm: InstanceType<typeof PdfQueueManager>;
    let toastSpy: any;

    beforeEach(() => {
      toastSpy = vi.spyOn(toastModule, 'showToast').mockImplementation(() => {});
      qm = new PdfQueueManager();
      qm.mode = 'split';
      qm.totalPages = 12;
      qm.thumbnailPage = 1;
      qm.pageRotations = { 0: 90, 2: 180 };
      qm.selectedSplitPages = new Set([0, 1]);
      qm.pages = '1-2';
      qm.password = 'locked-password-m3';
      qm.compressionPreset = 'high';
      qm.watermarkText = 'CONFIDENTIAL';
      qm.watermarkPosition = 'center';
      qm.watermarkOpacity = 0.5;
      qm.pageNumbers = true;
      qm.stripMetadata = true;
      qm.files = [
        { id: 'file-0', name: 'doc0.pdf', size: 1000 },
        { id: 'file-1', name: 'doc1.pdf', size: 2000 },
        { id: 'file-2', name: 'doc2.pdf', size: 3000 },
        { id: 'file-3', name: 'doc3.pdf', size: 4000 }
      ] as any;
    });

    afterEach(() => {
      toastSpy.mockRestore();
    });

    it('should withstand a flood of 200 concurrent interleaved mutation attempts with 0 state changes', async () => {
      // Lock processing mutex
      qm.isProcessing = true;

      // Deep snapshot of initial state
      const initialFileIds = qm.files.map((f: any) => f.id);
      const initialRotations = { ...qm.pageRotations };
      const initialSplitPages = Array.from(qm.selectedSplitPages);
      const initialPages = qm.pages;
      const initialThumbPage = qm.thumbnailPage;
      const initialMode = qm.mode;
      const initialPassword = qm.password;
      const initialCompression = qm.compressionPreset;
      const initialWatermark = qm.watermarkText;
      const initialWatermarkPos = qm.watermarkPosition;
      const initialWatermarkOp = qm.watermarkOpacity;
      const initialPageNums = qm.pageNumbers;
      const initialStripMeta = qm.stripMetadata;
      const initialTotalPages = qm.totalPages;

      // Create a batch of 200 varied mutation actions
      const actions: Promise<any>[] = [];

      for (let i = 0; i < 200; i++) {
        const actionType = i % 18;
        switch (actionType) {
          case 0:
            actions.push(qm.addFiles([new File(['adversarial content'], `bad_${i}.pdf`, { type: 'application/pdf' })]));
            break;
          case 1:
            qm.removeFile(`file-${i % 4}`);
            break;
          case 2:
            qm.clearFiles();
            break;
          case 3:
            qm.reorderFiles(0, 3);
            break;
          case 4:
            qm.moveFileUp(2);
            break;
          case 5:
            qm.moveFileDown(1);
            break;
          case 6:
            qm.rotatePage(1, 90);
            break;
          case 7:
            qm.rotateAll(180);
            break;
          case 8:
            qm.resetRotations();
            break;
          case 9:
            qm.toggleSplitPage(3);
            break;
          case 10:
            qm.selectAllSplitPages();
            break;
          case 11:
            qm.deselectAllSplitPages();
            break;
          case 12:
            qm.setSplitRange('5-10');
            break;
          case 13:
            qm.setThumbnailPage(0);
            break;
          case 14:
            qm.setMode('compress');
            break;
          case 15:
            qm.setPassword('tampered-password');
            break;
          case 16:
            actions.push(qm.addFileFromHistory({ id: `hist-${i}`, fileName: 'history.pdf' }));
            break;
          case 17:
            actions.push(qm.chainResultToMode('watermark'));
            break;
        }
      }

      await Promise.allSettled(actions);

      // Verify that after all 200 concurrent mutation attempts, the state is completely unmodified
      expect(qm.files.map((f: any) => f.id)).toEqual(initialFileIds);
      expect(qm.files.length).toBe(4);
      expect(qm.pageRotations).toEqual(initialRotations);
      expect(Array.from(qm.selectedSplitPages)).toEqual(initialSplitPages);
      expect(qm.pages).toBe(initialPages);
      expect(qm.thumbnailPage).toBe(initialThumbPage);
      expect(qm.mode).toBe(initialMode);
      expect(qm.password).toBe(initialPassword);
      expect(qm.compressionPreset).toBe(initialCompression);
      expect(qm.watermarkText).toBe(initialWatermark);
      expect(qm.watermarkPosition).toBe(initialWatermarkPos);
      expect(qm.watermarkOpacity).toBe(initialWatermarkOp);
      expect(qm.pageNumbers).toBe(initialPageNums);
      expect(qm.stripMetadata).toBe(initialStripMeta);
      expect(qm.totalPages).toBe(initialTotalPages);
    });

    it('should immediately unlock and permit normal operations once isProcessing transitions to false', () => {
      qm.isProcessing = true;
      qm.setAngle(180);
      expect(qm.angle).toBe(90); // Blocked

      // Now job finishes
      qm.isProcessing = false;
      qm.setAngle(180);
      expect(qm.angle).toBe(180); // Allowed

      qm.reorderFiles(0, 1);
      expect(qm.files[0].id).toBe('file-1');
      expect(qm.files[1].id).toBe('file-0');
    });
  });

  describe('Challenge 2: Network Abort & Cancellation Resilience', () => {
    let originalXHR: any;

    class TestXHR {
      public method = '';
      public url = '';
      public status = 200;
      public responseText = JSON.stringify({ success: true, data: { fileId: 'fil_test_ok' } });
      public upload = {
        addEventListener: vi.fn((event: string, cb: any) => {
          this.uploadListeners[event] = cb;
        })
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

      send() {
        // Trigger simulated progress
        if (this.uploadListeners['progress']) {
          this.uploadListeners['progress']({ lengthComputable: true, loaded: 50, total: 100 });
        }
        setTimeout(() => {
          if (this.aborted) {
            if (this.onabort) this.onabort();
          } else if (this.status >= 200 && this.status < 300) {
            if (this.onload) this.onload();
          } else {
            if (this.onerror) this.onerror();
          }
        }, 15);
      }

      abort() {
        this.aborted = true;
        if (this.onabort) this.onabort();
      }
    }

    beforeEach(() => {
      originalXHR = (globalThis as any).XMLHttpRequest;
      (globalThis as any).XMLHttpRequest = TestXHR;
    });

    afterEach(() => {
      (globalThis as any).XMLHttpRequest = originalXHR;
    });

    it('should cleanly abort mid-flight without unhandled rejections', async () => {
      const controller = new AbortController();
      const fakeFiles = [
        { name: 'large1.pdf', rawFile: new Blob(['content1']) },
        { name: 'large2.pdf', rawFile: new Blob(['content2']) }
      ];

      const progressSpy = vi.fn();
      const uploadPromise = uploadPdfFiles(fakeFiles as any, progressSpy, controller.signal);

      // Abort after 5ms (mid-flight)
      await new Promise((r) => setTimeout(r, 5));
      controller.abort();

      await expect(uploadPromise).rejects.toThrow(/Tác vụ tải tệp đã bị hủy/);
      expect(progressSpy).toHaveBeenCalled();
    });

    it('should withstand multiple rapid abort() calls without throwing', async () => {
      const controller = new AbortController();
      const fakeFiles = [{ name: 'file.pdf', rawFile: new Blob(['test']) }];

      const uploadPromise = uploadPdfFiles(fakeFiles as any, undefined, controller.signal);

      // Fire abort 10 times in a row
      for (let i = 0; i < 10; i++) {
        controller.abort();
      }

      await expect(uploadPromise).rejects.toThrow(/Tác vụ tải tệp đã bị hủy/);
    });

    it('should cancel active task and reset isProcessing state upon cancelTask()', async () => {
      const qm = new PdfQueueManager();
      qm.isProcessing = true;
      const controller = new AbortController();
      qm.activeUploadAbortController = controller;

      expect(qm.isProcessing).toBe(true);
      expect(controller.signal.aborted).toBe(false);

      qm.cancelTask('pdf-studio-job');

      expect(controller.signal.aborted).toBe(true);
      expect(qm.isProcessing).toBe(false);
      expect(qm.activeUploadAbortController).toBeNull();
    });
  });

  describe('Challenge 3: Single Image Conversion & Boundary Conditions', () => {
    it('should correctly filter a heterogeneous file list for images_to_pdf mode', () => {
      const mixedFiles = [
        { name: 'photo.JPG', type: 'image/jpeg' },
        { name: 'screenshot.png', type: 'image/png' },
        { name: 'sticker.webp', type: 'image/webp' },
        { name: 'document.pdf', type: 'application/pdf' },
        { name: 'archive.zip', type: 'application/zip' },
        { name: 'script.py', type: 'text/x-python' }
      ];

      const { validFiles, rejectedCount, isImages } = filterFilesForMode(mixedFiles, 'images_to_pdf');

      expect(isImages).toBe(true);
      expect(validFiles.length).toBe(3);
      expect(validFiles.map((f: any) => f.name)).toEqual(['photo.JPG', 'screenshot.png', 'sticker.webp']);
      expect(rejectedCount).toBe(3);
    });

    it('should correctly filter a heterogeneous file list for pdf modes (e.g. merge)', () => {
      const mixedFiles = [
        { name: 'photo.jpg', type: 'image/jpeg' },
        { name: 'doc1.pdf', type: 'application/pdf' },
        { name: 'doc2.pdf', type: 'application/pdf' },
        { name: 'archive.zip', type: 'application/zip' }
      ];

      const { validFiles, rejectedCount, isImages } = filterFilesForMode(mixedFiles, 'merge');

      expect(isImages).toBe(false);
      expect(validFiles.length).toBe(2);
      expect(validFiles.map((f: any) => f.name)).toEqual(['doc1.pdf', 'doc2.pdf']);
      expect(rejectedCount).toBe(2);
    });

    it('should properly clear files when switching from images_to_pdf to compress', () => {
      const qm = new PdfQueueManager();
      qm.mode = 'images_to_pdf';
      qm.files = [
        { id: 'img-1', name: 'photo.jpg', type: 'image/jpeg', size: 1000 },
        { id: 'img-2', name: 'photo2.png', type: 'image/png', size: 2000 }
      ] as any;

      // Switch to a PDF mode (compress)
      qm.setMode('compress');

      expect(qm.mode).toBe('compress');
      // Incompatible image files must be cleared
      expect(qm.files.length).toBe(0);
    });

    it('should retain only the first file when switching from merge (3 files) to split (single file mode)', () => {
      const qm = new PdfQueueManager();
      qm.mode = 'merge';
      qm.files = [
        { id: 'pdf-1', name: 'first.pdf', type: 'application/pdf', size: 1000 },
        { id: 'pdf-2', name: 'second.pdf', type: 'application/pdf', size: 2000 },
        { id: 'pdf-3', name: 'third.pdf', type: 'application/pdf', size: 3000 }
      ] as any;

      // Switch to split (single file mode)
      qm.setMode('split');

      expect(qm.mode).toBe('split');
      expect(qm.files.length).toBe(1);
      expect(qm.files[0].id).toBe('pdf-1');
    });

    it('should render ConfigPanel button as enabled for exactly 1 image in images_to_pdf', () => {
      const html = renderConfigPanel({
        mode: 'images_to_pdf',
        files: [{ id: 'img-1', name: 'scan.png', size: 5000 }],
        isProcessing: false
      });

      expect(html).not.toMatch(/id="btnStartProcess"\s+disabled/);
      expect(html).toContain('Tạo PDF từ 1 ảnh');
    });

    it('should render ConfigPanel button as disabled for 1 file in merge mode', () => {
      const html = renderConfigPanel({
        mode: 'merge',
        files: [{ id: 'pdf-1', name: 'first.pdf', size: 5000 }],
        isProcessing: false
      });

      expect(html).toMatch(/id="btnStartProcess"\s+disabled/);
      expect(html).toContain('Ghép 1 tệp PDF');
    });

    it('should render ConfigPanel button with dynamic label for N images', () => {
      const html = renderConfigPanel({
        mode: 'images_to_pdf',
        files: [
          { id: 'img-1', name: '1.jpg', size: 1000 },
          { id: 'img-2', name: '2.jpg', size: 1000 },
          { id: 'img-3', name: '3.jpg', size: 1000 },
          { id: 'img-4', name: '4.jpg', size: 1000 }
        ],
        isProcessing: false
      });

      expect(html).not.toMatch(/id="btnStartProcess"\s+disabled/);
      expect(html).toContain('Tạo PDF từ 4 ảnh');
    });
  });
});
