import { extractGoogleDriveId, extractFileNameFromDisposition } from '../../src/services/drive-download.service.js';
import { importDriveBodySchema } from '../../src/schemas/files.schema.js';

describe('Google Drive Import Service & Schema', () => {
  describe('extractGoogleDriveId', () => {
    it('extracts drive ID from standard /file/d/ URL', () => {
      const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
      expect(extractGoogleDriveId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    });

    it('extracts drive ID from /d/ URL', () => {
      const url = 'https://drive.google.com/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view';
      expect(extractGoogleDriveId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    });

    it('extracts drive ID from ?id= query param', () => {
      const url = 'https://drive.google.com/open?id=1AbC_dEf-1234567890abcdefghijklmnopqrst';
      expect(extractGoogleDriveId(url)).toBe('1AbC_dEf-1234567890abcdefghijklmnopqrst');
    });

    it('extracts drive ID from uc?export=download&id= URL', () => {
      const url = 'https://drive.google.com/uc?export=download&id=1AbC_dEf-1234567890abcdefghijklmnopqrst';
      expect(extractGoogleDriveId(url)).toBe('1AbC_dEf-1234567890abcdefghijklmnopqrst');
    });

    it('recognizes bare drive ID string (25-50 chars)', () => {
      const bareId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      expect(extractGoogleDriveId(bareId)).toBe(bareId);
    });

    it('returns null for non-drive URLs or malformed strings', () => {
      expect(extractGoogleDriveId('https://example.com/file.pdf')).toBeNull();
      expect(extractGoogleDriveId('')).toBeNull();
      expect(extractGoogleDriveId('short')).toBeNull();
    });
  });

  describe('extractFileNameFromDisposition', () => {
    it('decodes UTF-8 filename* format', () => {
      const disp = "attachment; filename*=UTF-8''tailieu%20tieng%20viet.pdf";
      expect(extractFileNameFromDisposition(disp, 'fallback123')).toBe('tailieu tieng viet.pdf');
    });

    it('decodes Latin-1 encoded UTF-8 bytes (mojibake from HTTP headers) back to Vietnamese', () => {
      // Simulate raw UTF-8 bytes parsed as Latin-1 code points: "(Tá»  01-SÃ CH HTCPHHC) CHÆ¯Æ NG 1-ESTER LIPID-Ä Ã .pdf"
      const mojibake = Buffer.from('(Tờ 01-SÁCH HTCPHHC) CHƯƠNG 1-ESTER LIPID-ĐÁ.pdf', 'utf8').toString('latin1');
      const disp = `attachment; filename="${mojibake}"`;
      expect(extractFileNameFromDisposition(disp, 'fallback123')).toBe('(Tờ 01-SÁCH HTCPHHC) CHƯƠNG 1-ESTER LIPID-ĐÁ.pdf');
    });

    it('falls back to default document ID when disposition is missing', () => {
      expect(extractFileNameFromDisposition(null, 'abc12345678')).toBe('document_abc12345.pdf');
    });
  });

  describe('importDriveBodySchema', () => {
    it('accepts valid URL with default purpose', () => {
      const res = importDriveBodySchema.parse({
        url: 'https://drive.google.com/file/d/123/view'
      });
      expect(res.url).toBe('https://drive.google.com/file/d/123/view');
      expect(res.purpose).toBe('pdf-convert');
    });

    it('accepts custom valid purpose', () => {
      const res = importDriveBodySchema.parse({
        url: 'https://drive.google.com/file/d/123/view',
        purpose: 'universal-converter'
      });
      expect(res.purpose).toBe('universal-converter');
    });

    it('rejects invalid or empty URL', () => {
      expect(() => importDriveBodySchema.parse({ url: '' })).toThrow();
    });
  });

  describe('PdfQueueManager.importFromDrive (client-side)', () => {
    let qm: any;

    beforeEach(async () => {
      if (!globalThis.URL.createObjectURL) {
        globalThis.URL.createObjectURL = vi.fn((b) => 'blob:http://localhost/test-uuid');
      }
      if (!globalThis.URL.revokeObjectURL) {
        globalThis.URL.revokeObjectURL = vi.fn();
      }

      const { PdfQueueManager } = await import('../../../src/components/tools/pdf/hooks/usePdfQueue.js');
      qm = new PdfQueueManager();
      qm.files = [];
      qm.mode = 'compress';
      qm.isProcessing = false;
    });

    it('rejects empty or whitespace Google Drive link with false', async () => {
      const res = await qm.importFromDrive('   ');
      expect(res).toBe(false);
      expect(qm.files).toHaveLength(0);
    });

    it('rejects drive import if currently in images_to_pdf mode', async () => {
      qm.setMode('images_to_pdf');
      const res = await qm.importFromDrive('https://drive.google.com/file/d/123/view');
      expect(res).toBe(false);
      expect(qm.files).toHaveLength(0);
    });

    it('successfully imports Drive file, constructs Blob and File without ReferenceError', async () => {
      const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      const originalFetch = globalThis.fetch;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/v1/files/import-drive') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                fileId: 'fil_test_drive_123',
                originalName: 'tailieu_on_thi.pdf',
                mimeType: 'application/pdf',
                sizeBytes: fakePdfBytes.length,
                viewUrl: '/api/v1/files/view/fil_test_drive_123'
              }
            })
          };
        }
        if (url === '/api/v1/files/view/fil_test_drive_123') {
          return {
            ok: true,
            blob: async () => new Blob([fakePdfBytes], { type: 'application/pdf' })
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      try {
        const res = await qm.importFromDrive('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
        expect(res).toBe(true);
        expect(qm.files).toHaveLength(1);

        const imported = qm.files[0];
        expect(imported.name).toBe('tailieu_on_thi.pdf');
        expect(imported.fileId).toBe('fil_test_drive_123');
        expect(imported.uploadStatus).toBe('uploaded');
        expect(imported.uploadProgress).toBe(100);
        expect(imported.localUrl).toBeDefined();
        expect(imported.rawFile).toBeDefined();
        expect(imported.rawFile instanceof Blob || imported.rawFile instanceof File).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns false gracefully when backend import-drive returns error', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: { message: 'Tệp không tồn tại hoặc đã bị khóa chia sẻ' }
        })
      }) as any;

      try {
        const res = await qm.importFromDrive('https://drive.google.com/file/d/invalid/view');
        expect(res).toBe(false);
        expect(qm.files).toHaveLength(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns false gracefully when view preview endpoint returns 404', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/v1/files/import-drive') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                fileId: 'fil_test_missing',
                originalName: 'missing.pdf',
                viewUrl: '/api/v1/files/view/fil_test_missing'
              }
            })
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      try {
        const res = await qm.importFromDrive('https://drive.google.com/file/d/missing/view');
        expect(res).toBe(false);
        expect(qm.files).toHaveLength(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('appends to queue when in multi-file merge mode', async () => {
      qm.setMode('merge');
      qm.files = [{
        id: 'file-1',
        name: 'existing.pdf',
        pages: 2,
        fileId: 'fil_existing'
      }];

      const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const originalFetch = globalThis.fetch;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/v1/files/import-drive') {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                fileId: 'fil_test_2',
                originalName: 'second.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 100,
                viewUrl: '/api/v1/files/view/fil_test_2'
              }
            })
          };
        }
        if (url === '/api/v1/files/view/fil_test_2') {
          return {
            ok: true,
            blob: async () => new Blob([fakePdfBytes], { type: 'application/pdf' })
          };
        }
        return { ok: false, status: 404 };
      }) as any;

      try {
        const res = await qm.importFromDrive('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
        expect(res).toBe(true);
        expect(qm.files).toHaveLength(2);
        expect(qm.files[0].name).toBe('existing.pdf');
        expect(qm.files[1].name).toBe('second.pdf');
        expect(qm.files[1].fileId).toBe('fil_test_2');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
