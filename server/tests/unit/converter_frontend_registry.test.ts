import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_CATEGORIES,
  CATEGORY_FORMATS,
  sniffFileExtension,
  getFormatCategory,
  getSmartDefaultTarget,
  getCompatibleOutputs
} from '../../../src/components/tools/converter/utilities/converterFormatRegistry.js';

describe('Frontend Converter Format Registry Unit Tests', () => {
  it('should define 6 standard categories', () => {
    expect(SUPPORTED_CATEGORIES).toHaveLength(6);
    const ids = SUPPORTED_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(['image', 'video', 'audio', 'document', 'data', 'archive']);
  });

  it('sniffFileExtension: should correctly parse filenames and MIME types', () => {
    expect(sniffFileExtension('my_file.docx')).toBe('docx');
    expect(sniffFileExtension('archive.tar.gz')).toBe('gz');
    expect(sniffFileExtension('image_without_ext', 'image/png')).toBe('png');
    expect(sniffFileExtension('song_without_ext', 'audio/mpeg')).toBe('mp3');
    expect(sniffFileExtension('no_ext_no_mime')).toBe('');
  });

  it('getFormatCategory: should categorize extensions accurately', () => {
    expect(getFormatCategory('png')).toBe('image');
    expect(getFormatCategory('jpg')).toBe('image');
    expect(getFormatCategory('mp4')).toBe('video');
    expect(getFormatCategory('mp3')).toBe('audio');
    expect(getFormatCategory('docx')).toBe('document');
    expect(getFormatCategory('pdf')).toBe('document');
    expect(getFormatCategory('csv')).toBe('data');
    expect(getFormatCategory('xlsx')).toBe('data');
    expect(getFormatCategory('zip')).toBe('archive');
    expect(getFormatCategory('7z')).toBe('archive');
    expect(getFormatCategory('unknown_xyz')).toBe('document');
  });

  it('getCompatibleOutputs: should exclude source format and phantom formats', () => {
    const pngOutputs = getCompatibleOutputs('png');
    const pngIds = pngOutputs.map((f) => f.id);
    expect(pngIds).not.toContain('png');
    expect(pngIds).not.toContain('avif'); // phantom format
    expect(pngIds).not.toContain('svg'); // pillow cannot export svg
    expect(pngIds).toContain('webp');

    const docxOutputs = getCompatibleOutputs('docx');
    const docxIds = docxOutputs.map((f) => f.id);
    expect(docxIds).not.toContain('docx');
    expect(docxIds).toEqual(['pdf', 'txt', 'html', 'md']);

    const svgOutputs = getCompatibleOutputs('svg');
    const svgIds = svgOutputs.map((f) => f.id);
    expect(svgIds).toEqual(['png', 'jpg', 'pdf']);
  });

  it('getSmartDefaultTarget: should recommend optimal target', () => {
    expect(getSmartDefaultTarget('docx')).toBe('pdf');
    expect(getSmartDefaultTarget('pdf')).toBe('docx');
    expect(getSmartDefaultTarget('csv')).toBe('xlsx');
    expect(getSmartDefaultTarget('xlsx')).toBe('csv');
    expect(getSmartDefaultTarget('png')).toBe('webp');
    expect(getSmartDefaultTarget('jpg')).toBe('webp');
    expect(getSmartDefaultTarget('mp4')).toBe('webm');
    expect(getSmartDefaultTarget('mp3')).toBe('wav');
    expect(getSmartDefaultTarget('zip')).toBe('7z');
  });

  it('Video source should tag extracted audio formats with audio category', () => {
    const mp4Outputs = getCompatibleOutputs('mp4');
    const mp3Target = mp4Outputs.find((f) => f.id === 'mp3');
    const webmTarget = mp4Outputs.find((f) => f.id === 'webm');

    expect(mp3Target).toBeDefined();
    expect(mp3Target?.category).toBe('audio');
    expect(webmTarget?.category).toBe('video');
  });

  it('PDF outputs should include rtf format', () => {
    const pdfOutputs = getCompatibleOutputs('pdf');
    const ids = pdfOutputs.map((f) => f.id);
    expect(ids).toContain('rtf');
  });

  it('Defensive inputs: handles null, undefined, spaces, and MIME parameters gracefully', () => {
    // null and undefined inputs
    expect(sniffFileExtension(null as any)).toBe('');
    expect(sniffFileExtension(undefined as any)).toBe('');
    expect(sniffFileExtension('file.with.trailing.space.docx ')).toBe('docx');
    expect(sniffFileExtension('noext', 'text/csv; charset=utf-8')).toBe('csv');
    expect(sniffFileExtension('noext', 'APPLICATION/PDF; name=test.pdf')).toBe('pdf');

    expect(getFormatCategory(null as any)).toBe('document');
    expect(getFormatCategory(undefined as any)).toBe('document');
    expect(getFormatCategory(' .png ')).toBe('image');
    expect(getFormatCategory('rtf')).toBe('document');

    expect(getSmartDefaultTarget(null as any)).toBe('pdf');
    expect(getSmartDefaultTarget(undefined as any)).toBe('pdf');
    expect(getSmartDefaultTarget(' .jpg ')).toBe('webp');

    expect(() => getCompatibleOutputs(null as any)).not.toThrow();
    expect(() => getCompatibleOutputs(undefined as any)).not.toThrow();
  });

  it('ConverterManager applyBatchFormatToCategory: prevents self-conversion and incompatible formats', async () => {
    const { ConverterManager } = await import('../../../src/components/tools/converter/hooks/useConverter.js');
    const manager = new ConverterManager();
    manager.items = [];

    // Add mock PNG and mock WEBP items
    const pngItem = {
      id: 'it_1',
      file: null,
      detectedMeta: {
        name: 'photo.png',
        extension: 'PNG',
        category: 'image',
        categoryLabel: 'Hình ảnh'
      },
      targetFormat: 'webp',
      status: 'ready'
    };

    const webpItem = {
      id: 'it_2',
      file: null,
      detectedMeta: {
        name: 'graphic.webp',
        extension: 'WEBP',
        category: 'image',
        categoryLabel: 'Hình ảnh'
      },
      targetFormat: 'png',
      status: 'ready'
    };

    manager.items = [pngItem as any, webpItem as any];

    // Batch apply 'webp' format to category 'image'
    manager.applyBatchFormatToCategory('image', 'webp');
    // PNG item can convert to webp -> updated
    expect(pngItem.targetFormat).toBe('webp');
    // WEBP item must NOT be converted to webp (self-conversion prevented!) -> retains 'png'
    expect(webpItem.targetFormat).toBe('png');

    // Batch apply incompatible format 'unsupported_xyz'
    manager.applyBatchFormatToCategory('image', 'unsupported_xyz');
    expect(pngItem.targetFormat).toBe('webp');
    expect(webpItem.targetFormat).toBe('png');

    // Test setItemFormat syncs targetFormat when single item in queue
    manager.items = [pngItem as any];
    manager.setItemFormat('it_1', 'jpg');
    expect(pngItem.targetFormat).toBe('jpg');
    expect(manager.targetFormat).toBe('jpg');
  });
});
