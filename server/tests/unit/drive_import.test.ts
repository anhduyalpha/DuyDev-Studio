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
});
