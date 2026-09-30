import { describe, it, expect, beforeEach, vi } from 'vitest';
import { filterFilesForMode, parseAndValidatePageRange } from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';
import { storage, STORAGE_KEYS } from '../../../src/utilities/storage.js';

describe('PDF Studio Input Filtering & File Validation (Bug 2)', () => {
  it('strictly rejects PDF files in images_to_pdf mode', () => {
    const mockFiles = [
      { name: 'document.pdf', type: 'application/pdf', size: 1024 },
      { name: 'scan.PDF', type: 'application/pdf', size: 2048 },
      { name: 'photo.jpg', type: 'image/jpeg', size: 4096 },
      { name: 'graphic.png', type: 'image/png', size: 8192 }
    ];

    const result = filterFilesForMode(mockFiles, 'images_to_pdf');

    expect(result.isImages).toBe(true);
    expect(result.hasPdfRejectedInImageMode).toBe(true);
    expect(result.rejectedCount).toBe(2);
    expect(result.validFiles).toHaveLength(2);
    expect(result.validFiles.map((f: any) => f.name)).toEqual(['photo.jpg', 'graphic.png']);
  });

  it('rejects PDF files even if mime type is missing or generic octet-stream in images_to_pdf', () => {
    const mockFiles = [
      { name: 'contract.pdf', type: 'application/octet-stream', size: 1024 },
      { name: 'sheet.pdf', type: '', size: 2048 }
    ];

    const result = filterFilesForMode(mockFiles, 'images_to_pdf');

    expect(result.isImages).toBe(true);
    expect(result.hasPdfRejectedInImageMode).toBe(true);
    expect(result.rejectedCount).toBe(2);
    expect(result.validFiles).toHaveLength(0);
  });

  it('accepts all supported image formats in images_to_pdf mode', () => {
    const mockImages = [
      { name: 'a.png', type: 'image/png' },
      { name: 'b.jpg', type: 'image/jpeg' },
      { name: 'c.jpeg', type: 'image/jpeg' },
      { name: 'd.webp', type: 'image/webp' },
      { name: 'e.avif', type: 'image/avif' },
      { name: 'f.gif', type: 'image/gif' },
      { name: 'g.bmp', type: 'image/bmp' },
      { name: 'h.tiff', type: 'image/tiff' },
      { name: 'i.svg', type: 'image/svg+xml' }
    ];

    const result = filterFilesForMode(mockImages, 'images_to_pdf');

    expect(result.isImages).toBe(true);
    expect(result.hasPdfRejectedInImageMode).toBe(false);
    expect(result.rejectedCount).toBe(0);
    expect(result.validFiles).toHaveLength(9);
  });

  it('strictly rejects non-image files (.docx, .zip, .exe) in images_to_pdf mode', () => {
    const mockFiles = [
      { name: 'word.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'archive.zip', type: 'application/zip' },
      { name: 'app.exe', type: 'application/x-msdownload' }
    ];

    const result = filterFilesForMode(mockFiles, 'images_to_pdf');

    expect(result.isImages).toBe(true);
    expect(result.hasPdfRejectedInImageMode).toBe(false);
    expect(result.rejectedCount).toBe(3);
    expect(result.validFiles).toHaveLength(0);
  });

  it('rejects image files and accepts PDF files in PDF modes (merge, split, compress, extract_images)', () => {
    const mockFiles = [
      { name: 'invoice.pdf', type: 'application/pdf', size: 1024 },
      { name: 'photo.png', type: 'image/png', size: 2048 },
      { name: 'report.pdf', type: 'application/pdf', size: 3072 }
    ];

    const mergeResult = filterFilesForMode(mockFiles, 'merge');
    expect(mergeResult.isImages).toBe(false);
    expect(mergeResult.validFiles).toHaveLength(2);
    expect(mergeResult.rejectedCount).toBe(1);

    const extractResult = filterFilesForMode(mockFiles, 'extract_images');
    expect(extractResult.isImages).toBe(false);
    expect(extractResult.validFiles).toHaveLength(2);
    expect(extractResult.rejectedCount).toBe(1);
  });

  it('parses and validates split page ranges accurately', () => {
    const valid = parseAndValidatePageRange('1-3, 5, 7-8', 10);
    expect(valid.valid).toBe(true);
    expect(valid.pages).toEqual([1, 2, 3, 5, 7, 8]);

    const outOfBounds = parseAndValidatePageRange('1-5, 12', 10);
    expect(outOfBounds.valid).toBe(false);
    expect(outOfBounds.error).toContain('vượt quá');

    const invertedRange = parseAndValidatePageRange('5-2', 10);
    expect(invertedRange.valid).toBe(false);
    expect(invertedRange.error).toContain('không hợp lệ');
  });
});

describe('PDF Trash Instant Synchronous Operations (Bug 1)', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        store[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      })
    });
  });

  it('moveToTrashSync updates localStorage immediately with 0ms delay', () => {
    const initialHistory = [
      { id: 'pdf_1', fileName: 'doc1.pdf', toolId: 'pdf-studio' },
      { id: 'pdf_2', fileName: 'doc2.pdf', toolId: 'pdf-studio' }
    ];
    store[STORAGE_KEYS.HISTORY] = JSON.stringify(initialHistory);
    store[STORAGE_KEYS.TRASH] = JSON.stringify([]);

    const trashed = storage.moveToTrashSync('pdf_1');

    expect(trashed).not.toBeNull();
    expect(trashed?.id).toBe('pdf_1');
    expect(trashed?.deletedAt).toBeDefined();

    const updatedHistory = JSON.parse(store[STORAGE_KEYS.HISTORY] || '[]');
    const updatedTrash = JSON.parse(store[STORAGE_KEYS.TRASH] || '[]');

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].id).toBe('pdf_2');
    expect(updatedTrash).toHaveLength(1);
    expect(updatedTrash[0].id).toBe('pdf_1');
  });

  it('moveItemsToTrashSync moves multiple items to trash optimistically in bulk', () => {
    const initialHistory = [
      { id: 'pdf_1', fileName: 'doc1.pdf' },
      { id: 'pdf_2', fileName: 'doc2.pdf' },
      { id: 'pdf_3', fileName: 'doc3.pdf' }
    ];
    store[STORAGE_KEYS.HISTORY] = JSON.stringify(initialHistory);
    store[STORAGE_KEYS.TRASH] = JSON.stringify([]);

    storage.moveItemsToTrashSync(['pdf_1', 'pdf_3']);

    const updatedHistory = JSON.parse(store[STORAGE_KEYS.HISTORY] || '[]');
    const updatedTrash = JSON.parse(store[STORAGE_KEYS.TRASH] || '[]');

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].id).toBe('pdf_2');
    expect(updatedTrash).toHaveLength(2);
    expect(updatedTrash.map((it: any) => it.id)).toContain('pdf_1');
    expect(updatedTrash.map((it: any) => it.id)).toContain('pdf_3');
  });

  it('restoreTrashItemSync restores item immediately from trash to history', () => {
    const initialTrash = [
      { id: 'pdf_trash_1', fileName: 'restorable.pdf', toolId: 'pdf-studio', deletedAt: '2026-09-28T00:00:00.000Z' }
    ];
    store[STORAGE_KEYS.HISTORY] = JSON.stringify([]);
    store[STORAGE_KEYS.TRASH] = JSON.stringify(initialTrash);

    const restored = storage.restoreTrashItemSync('pdf_trash_1');

    expect(restored).not.toBeNull();
    expect(restored?.id).toBe('pdf_trash_1');
    expect(restored?.deletedAt).toBeUndefined();

    const updatedTrash = JSON.parse(store[STORAGE_KEYS.TRASH] || '[]');
    const updatedHistory = JSON.parse(store[STORAGE_KEYS.HISTORY] || '[]');

    expect(updatedTrash).toHaveLength(0);
    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].id).toBe('pdf_trash_1');
  });

  it('restoreItemsFromTrashSync restores multiple items in bulk instantly', () => {
    const initialTrash = [
      { id: 'trash_1', fileName: 'f1.pdf', deletedAt: '2026-09-28T00:00:00.000Z' },
      { id: 'trash_2', fileName: 'f2.pdf', deletedAt: '2026-09-28T00:00:00.000Z' },
      { id: 'trash_3', fileName: 'f3.pdf', deletedAt: '2026-09-28T00:00:00.000Z' }
    ];
    store[STORAGE_KEYS.HISTORY] = JSON.stringify([]);
    store[STORAGE_KEYS.TRASH] = JSON.stringify(initialTrash);

    storage.restoreItemsFromTrashSync(['trash_1', 'trash_2']);

    const updatedTrash = JSON.parse(store[STORAGE_KEYS.TRASH] || '[]');
    const updatedHistory = JSON.parse(store[STORAGE_KEYS.HISTORY] || '[]');

    expect(updatedTrash).toHaveLength(1);
    expect(updatedTrash[0].id).toBe('trash_3');
    expect(updatedHistory).toHaveLength(2);
  });

  it('permanentlyDeleteTrashItemSync deletes item from trash instantly', () => {
    const initialTrash = [
      { id: 'pdf_trash_1', fileName: 'file1.pdf' },
      { id: 'pdf_trash_2', fileName: 'file2.pdf' }
    ];
    store[STORAGE_KEYS.TRASH] = JSON.stringify(initialTrash);

    storage.permanentlyDeleteTrashItemSync('pdf_trash_1');

    const updatedTrash = JSON.parse(store[STORAGE_KEYS.TRASH] || '[]');
    expect(updatedTrash).toHaveLength(1);
    expect(updatedTrash[0].id).toBe('pdf_trash_2');
  });

  it('permanentlyDeleteItemsSync purges multiple items from trash instantly in bulk', () => {
    const initialTrash = [
      { id: 'pdf_trash_1', fileName: 'file1.pdf' },
      { id: 'pdf_trash_2', fileName: 'file2.pdf' },
      { id: 'pdf_trash_3', fileName: 'file3.pdf' }
    ];
    store[STORAGE_KEYS.TRASH] = JSON.stringify(initialTrash);

    storage.permanentlyDeleteItemsSync(['pdf_trash_1', 'pdf_trash_2']);

    const updatedTrash = JSON.parse(store[STORAGE_KEYS.TRASH] || '[]');
    expect(updatedTrash).toHaveLength(1);
    expect(updatedTrash[0].id).toBe('pdf_trash_3');
  });

  it('emptyTrash clears localStorage trash instantly without awaiting network', async () => {
    store[STORAGE_KEYS.TRASH] = JSON.stringify([
      { id: 'item_1' },
      { id: 'item_2' },
      { id: 'item_3' }
    ]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const promise = storage.emptyTrash();
    // Verify localStorage is already cleared before the promise settles
    expect(store[STORAGE_KEYS.TRASH]).toBeUndefined();

    const res = await promise;
    expect(res).toBe(true);
  });
});
