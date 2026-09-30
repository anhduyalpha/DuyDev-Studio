import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pdfOperationSchema, pdfJobOptionsSchema } from '../../src/schemas/jobs.schema.js';
import { filterFilesForMode, PdfQueueManager } from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';
import { buildPdfResult } from '../../../src/components/tools/pdf/hooks/pdfApi.js';
import { getPdfOperationMeta } from '../../../src/components/tools/pdf/components/PdfHistoryList.js';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] || null,
    length: 0
  } as unknown as Storage;
}

describe('PDF Studio Organize & PDF-to-DOCX Features', () => {
  describe('Zod Schema Validation', () => {
    it('validates organize and pdf_to_docx as valid PdfOperations', () => {
      expect(pdfOperationSchema.parse('organize')).toBe('organize');
      expect(pdfOperationSchema.parse('pdf_to_docx')).toBe('pdf_to_docx');
    });

    it('validates order array and rotations object in pdfJobOptionsSchema', () => {
      const parsed = pdfJobOptionsSchema.parse({
        order: [0, 3, 1, 2],
        rotations: { '0': 90, '1': 180 }
      });
      expect(parsed.order).toEqual([0, 3, 1, 2]);
      expect(parsed.rotations).toEqual({ '0': 90, '1': 180 });
    });
  });

  describe('Input File Filtering', () => {
    it('accepts only PDF files for organize mode', () => {
      const mockFiles = [
        { name: 'document.pdf', type: 'application/pdf', size: 1024 },
        { name: 'image.png', type: 'image/png', size: 2048 },
        { name: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 4096 }
      ];

      const result = filterFilesForMode(mockFiles, 'organize');
      expect(result.validFiles).toHaveLength(1);
      expect(result.validFiles[0].name).toBe('document.pdf');
      expect(result.rejectedCount).toBe(2);
    });

    it('accepts only PDF files for pdf_to_docx mode', () => {
      const mockFiles = [
        { name: 'report.pdf', type: 'application/pdf', size: 1024 },
        { name: 'archive.zip', type: 'application/zip', size: 2048 }
      ];

      const result = filterFilesForMode(mockFiles, 'pdf_to_docx');
      expect(result.validFiles).toHaveLength(1);
      expect(result.validFiles[0].name).toBe('report.pdf');
      expect(result.rejectedCount).toBe(1);
    });
  });

  describe('Organize Queue State Management', () => {
    let qm: InstanceType<typeof PdfQueueManager>;

    beforeEach(() => {
      qm = new PdfQueueManager();
    });

    it('initializes organize pages from totalPages', () => {
      qm.initOrganizePages(5);
      expect(qm.organizeOrder).toEqual([0, 1, 2, 3, 4]);
      expect(qm.organizeDeleted.size).toBe(0);
      expect(qm.organizeRotations).toEqual({});
    });

    it('correctly reorders pages by drag-and-drop slots', () => {
      qm.initOrganizePages(5); // [0, 1, 2, 3, 4]
      // Move slot 0 to slot 3 -> [1, 2, 3, 0, 4]
      qm.reorderOrganizePages(0, 3);
      expect(qm.organizeOrder).toEqual([1, 2, 3, 0, 4]);

      // Move slot 4 to slot 0 -> [4, 1, 2, 3, 0]
      qm.reorderOrganizePages(4, 0);
      expect(qm.organizeOrder).toEqual([4, 1, 2, 3, 0]);
    });

    it('ignores invalid or out-of-bounds reorder requests', () => {
      qm.initOrganizePages(3); // [0, 1, 2]
      qm.reorderOrganizePages(0, 10);
      expect(qm.organizeOrder).toEqual([0, 1, 2]);

      qm.reorderOrganizePages(-1, 2);
      expect(qm.organizeOrder).toEqual([0, 1, 2]);
    });

    it('toggles page deletion and prevents removing all pages', () => {
      qm.initOrganizePages(3);
      qm.toggleDeleteOrganizePage(0);
      expect(qm.organizeDeleted.has(0)).toBe(true);

      qm.toggleDeleteOrganizePage(1);
      expect(qm.organizeDeleted.has(1)).toBe(true);

      // Attempting to delete the last page (page 2) should be rejected
      qm.toggleDeleteOrganizePage(2);
      expect(qm.organizeDeleted.has(2)).toBe(false);
      expect(qm.organizeDeleted.size).toBe(2);

      // Restoring page 0
      qm.toggleDeleteOrganizePage(0);
      expect(qm.organizeDeleted.has(0)).toBe(false);
      expect(qm.organizeDeleted.size).toBe(1);
    });

    it('accumulates rotation per page mod 360 and purges 0 degree entries', () => {
      qm.initOrganizePages(3);
      qm.rotateOrganizePage(1, 90);
      expect(qm.organizeRotations[1]).toBe(90);

      qm.rotateOrganizePage(1, 90);
      expect(qm.organizeRotations[1]).toBe(180);

      qm.rotateOrganizePage(1, 180);
      // 360 % 360 === 0 -> key should be deleted
      expect(qm.organizeRotations[1]).toBeUndefined();
    });

    it('reverses order correctly', () => {
      qm.initOrganizePages(4); // [0, 1, 2, 3]
      qm.reverseOrganizePages();
      expect(qm.organizeOrder).toEqual([3, 2, 1, 0]);
    });

    it('resets organize order, deletions, and rotations', () => {
      qm.initOrganizePages(4);
      qm.reorderOrganizePages(0, 3);
      qm.toggleDeleteOrganizePage(1);
      qm.rotateOrganizePage(2, 90);

      qm.resetOrganizePages();
      expect(qm.organizeOrder).toEqual([0, 1, 2, 3]);
      expect(qm.organizeDeleted.size).toBe(0);
      expect(qm.organizeRotations).toEqual({});
    });
  });

  describe('Result Card & History Metadata', () => {
    it('buildPdfResult generates .docx filename for pdf_to_docx operation', () => {
      const mockResultData = {
        resultFileId: 'res-123',
        downloadUrl: '/api/v1/files/download/res-123',
        originalSizeBytes: 100000,
        resultSizeBytes: 50000,
        processingTimeMs: 1500
      };
      const mainFile = { name: 'annual_report.pdf', size: 100000 };

      const res = buildPdfResult(mockResultData, mainFile, 'pdf_to_docx', 1.5, '');
      expect(res.fileName).toBe('annual_report.docx');
      expect(res.originalSize).toBe(100000);
      expect(res.resultSize).toBe(50000);
    });

    it('buildPdfResult generates .pdf filename for organize operation', () => {
      const mockResultData = {
        resultFileId: 'res-456',
        downloadUrl: '/api/v1/files/download/res-456',
        originalSizeBytes: 90000,
        resultSizeBytes: 80000,
        processingTimeMs: 200
      };
      const mainFile = { name: 'slides.pdf', size: 90000 };

      const res = buildPdfResult(mockResultData, mainFile, 'organize', 0.2, '');
      expect(res.fileName).toBe('slides_organize.pdf');
    });

    it('getPdfOperationMeta identifies organize and pdf_to_docx items', () => {
      const organizeItem = { mode: 'organize', fileName: 'sample_organized.pdf' };
      const docxItem = { mode: 'pdf_to_docx', fileName: 'sample.docx' };

      const organizeMeta = getPdfOperationMeta(organizeItem);
      expect(organizeMeta.type).toBe('organize');
      expect(organizeMeta.label).toBe('Sắp xếp');
      expect(organizeMeta.icon).toBe('layout-grid');

      const docxMeta = getPdfOperationMeta(docxItem);
      expect(docxMeta.type).toBe('pdf_to_docx');
      expect(docxMeta.label).toBe('Word DOCX');
      expect(docxMeta.icon).toBe('file-text');
    });
  });
});
