import { describe, it, expect, vi } from 'vitest';
import { extractImagesFromClipboard } from '../../../src/components/tools/pdf/hooks/usePdfPaste.js';
import { renderDropzoneQueue } from '../../../src/components/tools/pdf/components/DropzoneQueue.js';
import { renderPdfMultiFileWorkspace } from '../../../src/components/tools/pdf/components/PdfMultiFileWorkspace.js';

describe('PDF Studio Images-to-PDF Clipboard Paste & A4 Cleanup', () => {
  describe('extractImagesFromClipboard', () => {
    it('extracts image files from items and assigns friendly default filenames', async () => {
      const mockBlob = new Blob(['fake image content'], { type: 'image/png' });
      const mockItems = [
        {
          type: 'image/png',
          getAsFile: () => new File([mockBlob], 'image.png', { type: 'image/png' })
        },
        {
          type: 'text/plain',
          getAsFile: () => new File(['text'], 'note.txt', { type: 'text/plain' })
        }
      ];

      const mockClipboardData = {
        items: mockItems,
        files: [],
        getData: vi.fn()
      } as unknown as DataTransfer;

      const extracted = await extractImagesFromClipboard(mockClipboardData);

      expect(extracted).toHaveLength(1);
      expect(extracted[0].type).toBe('image/png');
      expect(extracted[0].name).toMatch(/^anh_dan_\d+_1\.png$/);
    });

    it('preserves real filenames if already provided', async () => {
      const mockBlob = new Blob(['photo content'], { type: 'image/jpeg' });
      const mockItems = [
        {
          type: 'image/jpeg',
          getAsFile: () => new File([mockBlob], 'nature_trip.jpg', { type: 'image/jpeg' })
        }
      ];

      const mockClipboardData = {
        items: mockItems,
        files: [],
        getData: vi.fn()
      } as unknown as DataTransfer;

      const extracted = await extractImagesFromClipboard(mockClipboardData);

      expect(extracted).toHaveLength(1);
      expect(extracted[0].name).toBe('nature_trip.jpg');
      expect(extracted[0].type).toBe('image/jpeg');
    });

    it('extracts files from clipboardData.files fallback when items is empty', async () => {
      const mockFiles = [
        new File(['1'], 'doc.pdf', { type: 'application/pdf' }),
        new File(['2'], 'diagram.webp', { type: 'image/webp' }),
        new File(['3'], 'drawing.png', { type: 'image/png' })
      ];

      const mockClipboardData = {
        items: [],
        files: mockFiles,
        getData: vi.fn()
      } as unknown as DataTransfer;

      const extracted = await extractImagesFromClipboard(mockClipboardData);

      expect(extracted).toHaveLength(2);
      expect(extracted.map((f) => f.name)).toEqual(['diagram.webp', 'drawing.png']);
    });

    it('returns empty array when clipboardData is null or contains only text', async () => {
      expect(await extractImagesFromClipboard(null as any)).toEqual([]);

      const mockTextData = {
        items: [
          {
            type: 'text/plain',
            getAsFile: () => null
          }
        ],
        files: [],
        getData: () => 'some random text'
      } as unknown as DataTransfer;

      expect(await extractImagesFromClipboard(mockTextData)).toEqual([]);
    });
  });

  describe('Dropzone & Workspace UI standards for images_to_pdf', () => {
    it('does NOT contain "A4" or "căn chỉnh vừa khổ A4" in images_to_pdf description', () => {
      const html = renderDropzoneQueue({ mode: 'images_to_pdf', files: [] });

      expect(html).not.toMatch(/khổ\s*A4/i);
      expect(html).not.toMatch(/kích\s*thước\s*A4/i);
      expect(html).not.toMatch(/căn\s*chỉnh\s*vừa/i);
      expect(html).toContain('Chỉ nhận tệp hình ảnh (PNG, JPG, WebP...).');
    });

    it('renders the "Dán ảnh" paste button in initial dropzone when mode is images_to_pdf', () => {
      const html = renderDropzoneQueue({ mode: 'images_to_pdf', files: [] });

      expect(html).toContain('id="btnPastePdfImage"');
      expect(html).toContain('Dán ảnh');
      expect(html).toContain('Ctrl + V');
    });

    it('does NOT render "Dán ảnh" button in other modes (e.g. compress or merge)', () => {
      const htmlCompress = renderDropzoneQueue({ mode: 'compress', files: [] });
      expect(htmlCompress).not.toContain('id="btnPastePdfImage"');

      const htmlMerge = renderDropzoneQueue({ mode: 'merge', files: [] });
      expect(htmlMerge).not.toContain('id="btnPastePdfImage"');
    });

    it('renders "Dán ảnh" button in multi-file workspace header for images_to_pdf', () => {
      const mockFiles = [
        { id: 'f-1', name: 'photo1.jpg', size: 1024, type: 'image/jpeg' },
        { id: 'f-2', name: 'photo2.png', size: 2048, type: 'image/png' }
      ];

      const html = renderPdfMultiFileWorkspace({ mode: 'images_to_pdf', files: mockFiles });

      expect(html).toContain('id="btnPasteMorePdfImages"');
      expect(html).toContain('Dán ảnh');
      expect(html).toContain('Ctrl + V');
    });

    it('does NOT render "Dán ảnh" button in multi-file workspace for merge mode', () => {
      const mockFiles = [
        { id: 'f-1', name: 'doc1.pdf', size: 1024, type: 'application/pdf' },
        { id: 'f-2', name: 'doc2.pdf', size: 2048, type: 'application/pdf' }
      ];

      const html = renderPdfMultiFileWorkspace({ mode: 'merge', files: mockFiles });

      expect(html).not.toContain('id="btnPasteMorePdfImages"');
    });
  });
});
