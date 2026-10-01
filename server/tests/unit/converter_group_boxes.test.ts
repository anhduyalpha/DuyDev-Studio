import { describe, it, expect } from 'vitest';
import { getItemGroupMap, renderFormatSelector } from '../../../src/components/tools/converter/components/FormatSelector.js';
import { renderConverterQueueList } from '../../../src/components/tools/converter/components/ConverterQueueList.js';
import { getOptimalChunkSize } from '../../../src/utilities/resumableUploader.js';
import fs from 'fs';
import path from 'path';

describe('Converter Group Boxes & Upload Speed Acceleration Suite', () => {
  describe('1. getItemGroupMap & Dynamic Partitioning', () => {
    it('should partition mixed files into exact extension groups without collisions', () => {
      const mockItems = [
        { id: '1', detectedMeta: { name: 'photo1.png', extension: 'PNG', category: 'image', categoryLabel: 'Hình ảnh', size: 1024 }, targetFormat: 'webp' },
        { id: '2', detectedMeta: { name: 'doc1.docx', extension: 'docx', category: 'document', categoryLabel: 'Tài liệu', size: 2048 }, targetFormat: 'pdf' },
        { id: '3', detectedMeta: { name: 'photo2.PNG', extension: 'PNG', category: 'image', categoryLabel: 'Hình ảnh', size: 1536 }, targetFormat: 'webp' },
        { id: '4', detectedMeta: { name: 'clip.mp4', extension: 'mp4', category: 'video', categoryLabel: 'Video', size: 10485760 }, targetFormat: 'mp3' },
        { id: '5', detectedMeta: { name: 'photo3.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh', size: 3072 }, targetFormat: 'webp' },
      ];

      const groupMap = getItemGroupMap(mockItems);
      expect(groupMap.size).toBe(3);
      expect(groupMap.has('png')).toBe(true);
      expect(groupMap.has('docx')).toBe(true);
      expect(groupMap.has('mp4')).toBe(true);

      const pngGroup = groupMap.get('png')!;
      expect(pngGroup.items).toHaveLength(3);
      expect(pngGroup.category).toBe('image');
      expect(pngGroup.categoryLabel).toBe('Hình ảnh');

      const docxGroup = groupMap.get('docx')!;
      expect(docxGroup.items).toHaveLength(1);

      const mp4Group = groupMap.get('mp4')!;
      expect(mp4Group.items).toHaveLength(1);
    });

    it('should automatically prune excess group box when all items of an extension are deleted', () => {
      let items = [
        { id: '1', detectedMeta: { name: 'a.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh' }, targetFormat: 'webp' },
        { id: '2', detectedMeta: { name: 'b.docx', extension: 'docx', category: 'document', categoryLabel: 'Tài liệu' }, targetFormat: 'pdf' },
        { id: '3', detectedMeta: { name: 'c.docx', extension: 'docx', category: 'document', categoryLabel: 'Tài liệu' }, targetFormat: 'pdf' },
      ];

      let groups = getItemGroupMap(items);
      expect(groups.size).toBe(2);
      expect(groups.has('docx')).toBe(true);
      expect(groups.get('docx')!.items).toHaveLength(2);

      // Simulate removing 1 DOCX item
      items = items.filter(it => it.id !== '2');
      groups = getItemGroupMap(items);
      expect(groups.size).toBe(2);
      expect(groups.get('docx')!.items).toHaveLength(1);

      // Simulate removing final DOCX item
      items = items.filter(it => it.id !== '3');
      groups = getItemGroupMap(items);
      expect(groups.size).toBe(1);
      expect(groups.has('docx')).toBe(false);
      expect(groups.has('png')).toBe(true);

      // Verify rendered HTML has no lingering DOCX group box
      const renderedHtml = renderFormatSelector({ items, targetFormat: 'webp' });
      expect(renderedHtml).not.toContain('data-group-ext="docx"');
      expect(renderedHtml).toContain('data-group-ext="png"');
    });

    it('should return empty Map and render standard 6-category browse mode when queue is empty', () => {
      const emptyMap = getItemGroupMap([]);
      expect(emptyMap.size).toBe(0);

      const renderedHtml = renderFormatSelector({ items: [], selectedCategory: 'image', targetFormat: 'webp' });
      expect(renderedHtml).not.toContain('converter-group-box');
      expect(renderedHtml).toContain('btn-converter-cat');
      expect(renderedHtml).toContain('formatGrid_image');
    });
  });

  describe('2. Grouped Format Box DOM Rendering & Minimalist Standards', () => {
    it('should render correct group badges, target format, and format pill data attributes', () => {
      const items = [
        { id: '1', detectedMeta: { name: 'scan1.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh', size: 1024 }, targetFormat: 'webp' },
        { id: '2', detectedMeta: { name: 'scan2.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh', size: 2048 }, targetFormat: 'webp' },
      ];

      const html = renderFormatSelector({ items, targetFormat: 'webp' });
      expect(html).toContain('converter-group-box');
      expect(html).toContain('PNG');
      expect(html).toContain('HÌNH ẢNH');
      expect(html).toContain('2 tệp');
      expect(html).toContain('ĐÍCH: WEBP');
      expect(html).toContain('data-group-ext="png"');
      expect(html).toContain('data-format="webp"');
      expect(html).toContain('btn-group-format-pill');
    });

    it('should adhere strictly to Rule 3 UI Minimalism (no marketing fluff or tutorial helper text)', () => {
      const items = [
        { id: '1', detectedMeta: { name: 'report.docx', extension: 'docx', category: 'document', categoryLabel: 'Tài liệu', size: 5000 }, targetFormat: 'pdf' },
      ];

      const html = renderFormatSelector({ items, targetFormat: 'pdf' });
      expect(html).not.toMatch(/Sẵn sàng in ấn/i);
      expect(html).not.toMatch(/Phổ biến nhất/i);
      expect(html).not.toMatch(/Khuyên dùng cho/i);
    });

    it('should render collapsible details dropdown with chevron arrow instead of horizontal scroll', () => {
      const items = [
        { id: '1', detectedMeta: { name: 'scan1.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh', size: 1024 }, targetFormat: 'webp' },
        { id: '2', detectedMeta: { name: 'scan2.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh', size: 2048 }, targetFormat: 'webp' },
      ];

      const html = renderFormatSelector({ items, targetFormat: 'webp' });
      expect(html).toContain('<details class="group/files');
      expect(html).toContain('chevron-down');
      expect(html).toContain('Danh sách 2 tệp PNG');
      expect(html).not.toContain('overflow-x-auto');
    });
  });

  describe('3. Batch Format Synchronization per Extension via real ConverterManager', () => {
    it('should update all items with the target extension while leaving other extensions untouched using real ConverterManager', async () => {
      const { ConverterManager } = await import('../../../src/components/tools/converter/hooks/useConverter.js');
      const manager = new ConverterManager();
      manager.items = [
        { id: '1', detectedMeta: { extension: 'png' }, targetFormat: 'webp', status: 'ready' },
        { id: '2', detectedMeta: { extension: 'png' }, targetFormat: 'webp', status: 'ready' },
        { id: '3', detectedMeta: { extension: 'docx' }, targetFormat: 'pdf', status: 'ready' },
      ];

      manager.setFormatForExtension('png', 'jpg');
      expect(manager.items[0].targetFormat).toBe('jpg');
      expect(manager.items[1].targetFormat).toBe('jpg');
      expect(manager.items[2].targetFormat).toBe('pdf'); // docx must remain unchanged
      expect(manager.targetFormat).toBe('jpg');
      expect(manager.selectedCategory).toBe('image');
    });

    it('should NOT overwrite targetFormat for items that are already converting or completed', async () => {
      const { ConverterManager } = await import('../../../src/components/tools/converter/hooks/useConverter.js');
      const manager = new ConverterManager();
      manager.items = [
        { id: '1', detectedMeta: { extension: 'png' }, targetFormat: 'webp', status: 'completed' },
        { id: '2', detectedMeta: { extension: 'png' }, targetFormat: 'webp', status: 'converting' },
        { id: '3', detectedMeta: { extension: 'png' }, targetFormat: 'webp', status: 'ready' },
      ];

      manager.setFormatForExtension('png', 'jpg');
      expect(manager.items[0].targetFormat).toBe('webp'); // completed item kept intact
      expect(manager.items[1].targetFormat).toBe('webp'); // converting item kept intact
      expect(manager.items[2].targetFormat).toBe('jpg');  // ready item updated
    });

    it('should render group-format-grid rather than format-category-grid to prevent syncCategoryUI collision', () => {
      const items = [
        { id: '1', detectedMeta: { name: 'sample.png', extension: 'png', category: 'image', categoryLabel: 'Hình ảnh' }, targetFormat: 'webp' }
      ];
      const html = renderFormatSelector({ items, targetFormat: 'webp' });
      expect(html).toContain('group-format-grid');
      expect(html).not.toMatch(/<div class="format-category-grid/);
    });
  });

  describe('4. Background Eager Upload Badges in ConverterQueueList', () => {
    it('should display "Đang tải lên" with progress when uploadStatus is uploading', () => {
      const state = {
        isConverting: false,
        items: [
          {
            id: 'item_1',
            detectedMeta: { name: 'test.png', extension: 'png', category: 'image', size: 1024 },
            targetFormat: 'webp',
            status: 'ready',
            uploadStatus: 'uploading',
            uploadProgress: 45
          }
        ]
      };

      const html = renderConverterQueueList(state);
      expect(html).toContain('Đang tải lên 45%');
    });

    it('should display "Đã sẵn sàng" when uploadStatus is uploaded', () => {
      const state = {
        isConverting: false,
        items: [
          {
            id: 'item_2',
            fileId: 'fil_ready_123',
            detectedMeta: { name: 'test.docx', extension: 'docx', category: 'document', size: 4096 },
            targetFormat: 'pdf',
            status: 'ready',
            uploadStatus: 'uploaded',
            uploadProgress: 100
          }
        ]
      };

      const html = renderConverterQueueList(state);
      expect(html).toContain('Đã sẵn sàng');
    });

    it('should display "Chờ lệnh" when idle and not uploaded', () => {
      const state = {
        isConverting: false,
        items: [
          {
            id: 'item_3',
            detectedMeta: { name: 'test.mp3', extension: 'mp3', category: 'audio', size: 2048 },
            targetFormat: 'wav',
            status: 'ready',
            uploadStatus: 'idle',
            uploadProgress: 0
          }
        ]
      };

      const html = renderConverterQueueList(state);
      expect(html).toContain('Chờ lệnh');
    });
  });

  describe('5. Upload Acceleration & Optimal Chunk Size Verification', () => {
    it('should return optimal chunk ladder (20MB up to 50MB)', () => {
      expect(getOptimalChunkSize(5 * 1024 * 1024)).toBe(20 * 1024 * 1024);
      expect(getOptimalChunkSize(30 * 1024 * 1024)).toBe(20 * 1024 * 1024);
      expect(getOptimalChunkSize(50 * 1024 * 1024)).toBe(20 * 1024 * 1024);
      expect(getOptimalChunkSize(100 * 1024 * 1024)).toBe(20 * 1024 * 1024);
      expect(getOptimalChunkSize(200 * 1024 * 1024)).toBe(20 * 1024 * 1024);
      expect(getOptimalChunkSize(1024 * 1024 * 1024)).toBe(30 * 1024 * 1024);
      expect(getOptimalChunkSize(3 * 1024 * 1024 * 1024)).toBe(40 * 1024 * 1024);
      expect(getOptimalChunkSize(10 * 1024 * 1024 * 1024)).toBe(50 * 1024 * 1024);
    });

    it('should verify 4MB highWaterMark is configured in app.ts and files.controller.ts', () => {
      const appFile = fs.readFileSync(path.resolve(__dirname, '../../src/app.ts'), 'utf-8');
      expect(appFile).toContain('highWaterMark: 4 * 1024 * 1024');
      expect(appFile).toContain('fileHwm: 4 * 1024 * 1024');

      const controllerFile = fs.readFileSync(path.resolve(__dirname, '../../src/api/controllers/files.controller.ts'), 'utf-8');
      expect(controllerFile).toContain('createWriteStream(targetPath, { highWaterMark: 4 * 1024 * 1024 })');
    });
  });
});
