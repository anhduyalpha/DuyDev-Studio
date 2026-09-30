/**
 * Unit Test Suite: Client PDF Hybrid Architecture
 * Tests mode routing, OOM safety thresholds, fallback delegation, and eager upload.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CLIENT_PDF_MAX_BYTES,
  CLIENT_PDF_MAX_PAGES,
  CLIENT_SUPPORTED_MODES,
  canHandleClientPdf
} from '../../../src/components/tools/pdf/services/clientPdfEngine.js';
import {
  filterFilesForMode,
  parseAndValidatePageRange,
  releasePdfFileResources
} from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';

describe('Client PDF Hybrid Architecture', () => {
  describe('Safety Thresholds & Constraints', () => {
    it('should define correct safety limits', () => {
      expect(CLIENT_PDF_MAX_BYTES).toBe(100 * 1024 * 1024);
      expect(CLIENT_PDF_MAX_PAGES).toBe(300);
      expect(CLIENT_SUPPORTED_MODES.has('rotate')).toBe(true);
      expect(CLIENT_SUPPORTED_MODES.has('organize')).toBe(true);
      expect(CLIENT_SUPPORTED_MODES.has('split')).toBe(true);
      expect(CLIENT_SUPPORTED_MODES.has('merge')).toBe(true);
      expect(CLIENT_SUPPORTED_MODES.has('images_to_pdf')).toBe(true);
      expect(CLIENT_SUPPORTED_MODES.has('watermark')).toBe(true);
      expect(CLIENT_SUPPORTED_MODES.has('compress')).toBe(false);
      expect(CLIENT_SUPPORTED_MODES.has('pdf_to_docx')).toBe(false);
      expect(CLIENT_SUPPORTED_MODES.has('security')).toBe(false);
    });
  });

  describe('canHandleClientPdf Routing Logic', () => {
    const mockFile = { name: 'sample.pdf', size: 10 * 1024 * 1024, type: 'application/pdf' };

    it('should allow supported client operations within limits', () => {
      expect(canHandleClientPdf('rotate', [mockFile], 20)).toBe(true);
      expect(canHandleClientPdf('organize', [mockFile], 50)).toBe(true);
      expect(canHandleClientPdf('split', [mockFile], 10)).toBe(true);
      expect(canHandleClientPdf('merge', [mockFile, mockFile], 30)).toBe(true);
      expect(canHandleClientPdf('images_to_pdf', [{ name: 'img.png', size: 2 * 1024 * 1024, type: 'image/png' }], 1)).toBe(true);
    });

    it('should reject heavy operations and route to server', () => {
      expect(canHandleClientPdf('compress', [mockFile], 10)).toBe(false);
      expect(canHandleClientPdf('pdf_to_docx', [mockFile], 10)).toBe(false);
      expect(canHandleClientPdf('security', [mockFile], 10)).toBe(false);
      expect(canHandleClientPdf('extract_images', [mockFile], 10)).toBe(false);
    });

    it('should reject files exceeding 100MB RAM cap', () => {
      const hugeFile = { name: 'huge.pdf', size: 101 * 1024 * 1024, type: 'application/pdf' };
      expect(canHandleClientPdf('rotate', [hugeFile], 10)).toBe(false);
      expect(canHandleClientPdf('split', [hugeFile], 10)).toBe(false);
    });

    it('should reject documents exceeding 300 pages', () => {
      expect(canHandleClientPdf('rotate', [mockFile], 301)).toBe(false);
      expect(canHandleClientPdf('organize', [mockFile], 450)).toBe(false);
    });

    it('should route non-ASCII watermark text to server engine', () => {
      const asciiOptions = { watermarkText: 'CONFIDENTIAL' };
      const vnOptions = { watermarkText: 'BẢN QUYỀN DUYDEV' };

      expect(canHandleClientPdf('watermark', [mockFile], 10, asciiOptions)).toBe(true);
      expect(canHandleClientPdf('watermark', [mockFile], 10, vnOptions)).toBe(false);
    });

    it('should return false if files list is empty', () => {
      expect(canHandleClientPdf('rotate', [], 0)).toBe(false);
    });
  });

  describe('filterFilesForMode', () => {
    it('should filter images for images_to_pdf mode and reject pdf', () => {
      const files = [
        { name: 'photo.jpg', type: 'image/jpeg' },
        { name: 'doc.pdf', type: 'application/pdf' },
        { name: 'vector.png', type: 'image/png' }
      ];
      const result = filterFilesForMode(files, 'images_to_pdf');
      expect(result.validFiles.length).toBe(2);
      expect(result.hasPdfRejectedInImageMode).toBe(true);
      expect(result.rejectedCount).toBe(1);
    });

    it('should filter pdfs for standard pdf mode and reject images', () => {
      const files = [
        { name: 'doc.pdf', type: 'application/pdf' },
        { name: 'photo.jpg', type: 'image/jpeg' }
      ];
      const result = filterFilesForMode(files, 'rotate');
      expect(result.validFiles.length).toBe(1);
      expect(result.validFiles[0].name).toBe('doc.pdf');
      expect(result.rejectedCount).toBe(1);
    });
  });

  describe('parseAndValidatePageRange', () => {
    it('should parse valid ranges and single pages', () => {
      const res = parseAndValidatePageRange('1-3, 5, 8-10', 10);
      expect(res.valid).toBe(true);
      expect(res.pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
    });

    it('should reject out of bound pages', () => {
      const res = parseAndValidatePageRange('1-5, 12', 10);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('vượt quá tổng số 10 trang');
    });

    it('should reject invalid syntax', () => {
      const res = parseAndValidatePageRange('1-abc', 10);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('không hợp lệ');
    });
  });

  describe('releasePdfFileResources', () => {
    it('should abort ongoing background upload and revoke URLs safely', () => {
      const abortFn = vi.fn();
      const mockFileItem = {
        name: 'test.pdf',
        abortController: { abort: abortFn },
        localUrl: 'blob:http://localhost/mock-uuid',
        cachedDoc: { destroy: vi.fn() },
        _thumbCache: new Map([
          [0, { close: vi.fn() }]
        ])
      };

      expect(() => releasePdfFileResources(mockFileItem)).not.toThrow();
      expect(abortFn).toHaveBeenCalled();
      expect(mockFileItem.cachedDoc.destroy).toHaveBeenCalled();
      expect(mockFileItem._thumbCache.size).toBe(0);
    });
  });
});
