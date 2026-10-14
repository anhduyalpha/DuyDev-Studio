import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractTiktokUrls, TiktokManager } from '../../../src/components/tools/tiktok/hooks/useTiktok.js';

describe('TikTok Batch Queue, Dirty-Text Extractor & Drive-Linked History', () => {
  describe('extractTiktokUrls', () => {
    it('should extract a single clean TikTok video URL', () => {
      const raw = 'https://www.tiktok.com/@alphadaniel/video/7251387037834595630';
      const extracted = extractTiktokUrls(raw);
      expect(extracted).toEqual(['https://www.tiktok.com/@alphadaniel/video/7251387037834595630']);
    });

    it('should extract short vt.tiktok.com and vm.tiktok.com URLs from dirty mobile share text', () => {
      const dirty = '7.50 Xem video của @nguoidung tại https://vt.tiktok.com/ZSg1anWX/ #trend #viral';
      const extracted = extractTiktokUrls(dirty);
      expect(extracted).toEqual(['https://vt.tiktok.com/ZSg1anWX/']);
    });

    it('should trim trailing punctuation (dots, commas, exclamation marks)', () => {
      const text = 'Xem link này nè: https://vt.tiktok.com/ZSg1anWX/,... thật không thể tin được!';
      const extracted = extractTiktokUrls(text);
      expect(extracted).toEqual(['https://vt.tiktok.com/ZSg1anWX/']);
    });

    it('should normalize URLs lacking https:// protocol', () => {
      const noProto = 'tiktok.com/@creator/video/9876543210';
      const extracted = extractTiktokUrls(noProto);
      expect(extracted).toEqual(['https://tiktok.com/@creator/video/9876543210']);
    });

    it('should extract multiple distinct URLs from multi-line text and deduplicate identical links', () => {
      const multi = `
        1. https://vt.tiktok.com/ZSg1anWX/
        2. https://www.tiktok.com/@user1/video/1111111111
        3. Xem lại cái này https://vt.tiktok.com/ZSg1anWX/ (trùng lặp)
        4. https://vm.tiktok.com/ZMeABCDEF/!
      `;
      const extracted = extractTiktokUrls(multi);
      expect(extracted).toHaveLength(3);
      expect(extracted).toEqual([
        'https://vt.tiktok.com/ZSg1anWX/',
        'https://www.tiktok.com/@user1/video/1111111111',
        'https://vm.tiktok.com/ZMeABCDEF/'
      ]);
    });

    it('should return an empty array for non-TikTok URLs or empty strings', () => {
      expect(extractTiktokUrls('')).toEqual([]);
      expect(extractTiktokUrls(null as any)).toEqual([]);
      expect(extractTiktokUrls('https://youtube.com/watch?v=12345')).toEqual([]);
      expect(extractTiktokUrls('Tin tức tổng hợp hôm nay')).toEqual([]);
    });
  });

  describe('History Persistence & Drive Linking', () => {
    let manager: TiktokManager;
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        })
      });

      manager = new TiktokManager();
    });

    it('should save history with driveRelPath when video is already in Drive', () => {
      const item = {
        id: '1234567890',
        title: 'Dance Video',
        cover: 'https://cdn.tiktok.com/cover.jpg',
        author: '@dancer',
        duration: 30,
        url: 'https://vt.tiktok.com/ZSg1anWX/',
        driveRelPath: '/tiktok/dance_video.mp4',
        timestamp: Date.now()
      };

      manager.saveHistory(item);
      const history = manager.loadHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('1234567890');
      expect(history[0].driveRelPath).toBe('/tiktok/dance_video.mp4');
    });

    it('should update existing history item with driveRelPath after saving to Drive', () => {
      // First save without driveRelPath
      manager.saveHistory({
        id: '5555555555',
        title: 'Cooking Tutorial',
        cover: 'https://cdn.tiktok.com/cook.jpg',
        author: '@chef',
        duration: 60,
        url: 'https://www.tiktok.com/@chef/video/5555555555',
        driveRelPath: null,
        timestamp: Date.now()
      });

      expect(manager.loadHistory()[0].driveRelPath).toBeNull();

      // Later, user clicks Save to Drive or batch processor saves it
      manager.updateHistoryDrivePath('5555555555', 'tiktok/cooking_tutorial.mp4');

      const updated = manager.loadHistory();
      expect(updated[0].driveRelPath).toBe('/tiktok/cooking_tutorial.mp4');
      expect(manager.getState().recentHistory[0].driveRelPath).toBe('/tiktok/cooking_tutorial.mp4');
    });
  });

  describe('Task Coordinator & Background Batch ActiveTasks Integration', () => {
    let manager: TiktokManager;

    beforeEach(() => {
      manager = new TiktokManager();
    });

    it('should return empty active tasks when idle', () => {
      expect(manager.getActiveTasks()).toEqual([]);
    });

    it('should expose single resolve task when isLoading is true', () => {
      manager.setUrl('https://vt.tiktok.com/ZSg1anWX/');
      manager.getState().isLoading = true;

      const tasks = manager.getActiveTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('tiktok-single-resolve');
      expect(tasks[0].moduleId).toBe('tiktok-downloader');
      expect(tasks[0].status).toBe('running');
      expect(tasks[0].route).toBe('#tool/tiktok-downloader');
    });

    it('should expose single drive save task when isSavingDrive is true', () => {
      manager.getState().isSavingDrive = true;
      manager.getState().videoData = { id: '111', title: 'Viral Trend' } as any;

      const tasks = manager.getActiveTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('tiktok-single-save-drive');
      expect(tasks[0].title).toContain('Viral Trend');
    });

    it('should expose batch queue task with progress, stage, and cancel callback', () => {
      manager.getState().batchQueue = {
        isActive: true,
        total: 5,
        current: 2,
        successCount: 2,
        skipCount: 0,
        failCount: 0,
        currentUrl: 'https://vt.tiktok.com/ZSg1anWX/',
        currentTitle: 'Clip Hài Hước #3',
        isCancelled: false
      };

      const tasks = manager.getActiveTasks();
      expect(tasks).toHaveLength(1);
      const batchTask = tasks[0];
      expect(batchTask.id).toBe('tiktok-batch-save-drive');
      expect(batchTask.progress).toBe(40); // 2/5 = 40%
      expect(batchTask.title).toBe('Lưu hàng loạt TikTok (2/5)');
      expect(batchTask.stage).toBe('Đang xử lý: Clip Hài Hước #3');
      expect(typeof batchTask.cancel).toBe('function');

      // Test cancellation via coordinator
      manager.cancelTask('tiktok-batch-save-drive');
      expect(manager.getState().batchQueue.isActive).toBe(false);
      expect(manager.getState().batchQueue.isCancelled).toBe(true);
    });
  });
});
