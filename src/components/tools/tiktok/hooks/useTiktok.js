/**
 * useTiktok Hook & State Store
 * High-performance state coordinator with surgical DOM notifications,
 * dirty-text URL extraction, Drive-linked history, and background batch queue.
 */

import { tiktokApi } from '../services/tiktokApi.js';
import { showToast } from '../../../../utilities/toast.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';
import { soundEngine } from '../../../../utilities/soundEngine.js';

const STORAGE_KEY = 'ds_tiktok_history_v1';

/**
 * Extracts all valid TikTok video URLs from raw or dirty text (e.g. mobile app share strings).
 * Supports standard tiktok.com/@user/video/id, short vt.tiktok.com, vm.tiktok.com, etc.
 * Normalizes missing protocol and removes duplicate entries.
 * @param {string} rawText
 * @returns {string[]}
 */
export function extractTiktokUrls(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return [];
  const regex = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?tiktok\.com\/[^\s"<>'`]+/gi;
  const matches = rawText.match(regex) || [];
  const cleaned = matches.map((u) => {
    let clean = u.replace(/[.,;:!?]+$/, '').trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean;
  }).filter(Boolean);

  return Array.from(new Set(cleaned));
}

export class TiktokManager {
  constructor() {
    this.moduleId = 'tiktok-downloader';
    this.moduleTitle = 'TikTok Downloader';
    this.route = '#tool/tiktok-downloader';

    this.listeners = new Set();
    this.state = {
      url: '',
      isLoading: false,
      error: null,
      videoData: null,
      isSavingDrive: false,
      savedDriveResult: null,
      existingInDrive: null,
      isForceResave: false,
      duplicatePreCheck: null,
      recentHistory: this.loadHistory(),
      batchQueue: {
        isActive: false,
        total: 0,
        current: 0,
        successCount: 0,
        skipCount: 0,
        failCount: 0,
        currentUrl: '',
        currentTitle: '',
        isCancelled: false
      }
    };
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = {}) {
    this.listeners.forEach((fn) => {
      try { fn(this.state, event); } catch (e) { console.error('[TikTokManager] Listener error:', e); }
    });
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveHistory(item) {
    try {
      const existing = this.loadHistory().filter((x) => String(x.id) !== String(item.id));
      const updated = [item, ...existing].slice(0, 15);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this.state.recentHistory = updated;
      this.notify({ type: 'history' });
    } catch (e) {
      console.warn('[TikTokManager] Failed to persist history:', e);
    }
  }

  updateHistoryDrivePath(videoId, relPath) {
    if (!videoId || !relPath) return;
    try {
      const history = this.loadHistory();
      const normalizedPath = relPath.startsWith('/') ? relPath : `/${relPath}`;
      let changed = false;
      history.forEach((h) => {
        if (String(h.id) === String(videoId) || (h.url && h.url.includes(String(videoId)))) {
          h.driveRelPath = normalizedPath;
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        this.state.recentHistory = history;
        this.notify({ type: 'history' });
      }
    } catch (e) {
      console.warn('[TikTokManager] Failed to update history drive path:', e);
    }
  }

  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.state.recentHistory = [];
      this.notify({ type: 'history' });
    } catch {}
  }

  setUrl(url, shouldNotify = false) {
    this.state.url = url;
    this.state.error = null;
    if (shouldNotify) {
      this.notify({ type: 'url' });
    }
  }

  clear() {
    this.state.url = '';
    this.state.error = null;
    this.state.videoData = null;
    this.state.savedDriveResult = null;
    this.state.existingInDrive = null;
    this.state.duplicatePreCheck = null;
    this.state.isForceResave = false;
    this.notify({ type: 'clear' });
  }

  setForceResave(val = true) {
    this.state.isForceResave = val;
    this.notify({ type: 'force-resave' });
  }

  async checkDuplicateUrl(candidateUrl = this.state.url) {
    const raw = (candidateUrl || '').trim();
    if (!raw) {
      this.state.duplicatePreCheck = null;
      return null;
    }
    const clean = raw.split('?')[0].replace(/\/$/, '');
    const res = await tiktokApi.checkDuplicate({ url: clean });
    if (res?.exists) {
      this.state.duplicatePreCheck = res.item;
      if (res.item?.tiktokVideoId && res.item?.relPath) {
        this.updateHistoryDrivePath(res.item.tiktokVideoId, res.item.relPath);
      }
    } else {
      this.state.duplicatePreCheck = null;
    }
    this.notify({ type: 'pre-check-duplicate', item: this.state.duplicatePreCheck });
    return this.state.duplicatePreCheck;
  }

  /**
   * Resolves a single TikTok video URL or initiates a batch download if multiple URLs are detected.
   * Auto-extracts clean URL from dirty mobile app share text.
   * @param {string} candidateUrl
   */
  async resolve(candidateUrl = this.state.url) {
    const rawInput = (candidateUrl || '').trim();
    if (!rawInput) {
      this.state.error = 'Vui lòng nhập hoặc dán liên kết video hoặc album ảnh TikTok';
      this.notify({ type: 'error' });
      return;
    }

    const extracted = extractTiktokUrls(rawInput);
    if (extracted.length === 0) {
      this.state.error = 'Không tìm thấy liên kết TikTok hợp lệ';
      this.notify({ type: 'error' });
      return;
    }

    // Multiple URLs detected -> trigger batch queue workflow
    if (extracted.length >= 2) {
      return this.startBatchSave(extracted);
    }

    // Exactly 1 URL -> normalize and resolve single video
    const cleanUrl = extracted[0];
    this.state.url = cleanUrl;
    this.state.isLoading = true;
    this.state.error = null;
    this.state.savedDriveResult = null;
    this.state.existingInDrive = null;
    this.state.isForceResave = false;
    soundEngine.playStart();
    this.notify({ type: 'loading' });

    try {
      const data = await tiktokApi.resolveVideo(cleanUrl);
      this.state.videoData = data;
      this.state.existingInDrive = data.existingInDrive || null;
      this.state.isLoading = false;

      const driveRelPath = data.existingInDrive ? (data.existingInDrive.relPath || data.existingInDrive.path) : null;
      this.saveHistory({
        id: data.id,
        title: data.title,
        cover: data.cover,
        author: data.author?.nickname || data.author?.uniqueId,
        duration: data.duration,
        url: cleanUrl,
        driveRelPath,
        isSlideshow: Boolean(data.isSlideshow),
        slideCount: data.images?.length || 0,
        timestamp: Date.now()
      });
      const successMsg = data.isSlideshow ? `Đã lấy album ảnh TikTok thành công (${data.images?.length || 0} ảnh)` : 'Đã lấy video TikTok thành công';
      showToast(successMsg, 'success');
      this.notify({ type: 'resolved', data });
    } catch (err) {
      this.state.isLoading = false;
      this.state.error = err?.message || 'Không thể trích xuất liên kết TikTok này';
      showToast(this.state.error, 'error');
      this.notify({ type: 'error' });
    }
  }

  /**
   * Saves the currently resolved video directly into Studio Drive (/tiktok).
   * @param {boolean} forceOverwrite
   */
  async saveCurrentToDrive(forceOverwrite = this.state.isForceResave) {
    if (!this.state.videoData?.videoUrl && (!this.state.videoData?.images || this.state.videoData.images.length === 0)) return;

    this.state.isSavingDrive = true;
    this.notify({ type: 'saving-drive' });

    try {
      const targetUrl = this.state.videoData.videoHdUrl || this.state.videoData.videoUrl || '';
      const result = await tiktokApi.saveToDrive({
        url: targetUrl,
        title: this.state.videoData.title,
        id: this.state.videoData.id,
        originalUrl: this.state.url,
        cover: this.state.videoData.cover,
        author: this.state.videoData.author,
        duration: this.state.videoData.duration,
        overwrite: forceOverwrite,
        isSlideshow: Boolean(this.state.videoData.isSlideshow),
        images: this.state.videoData.images || [],
        audioUrl: this.state.videoData.audioUrl || ''
      });
      this.state.isSavingDrive = false;
      this.state.savedDriveResult = result;
      this.state.existingInDrive = {
        fileName: result.fileName,
        relPath: result.relPath,
        sizeBytes: result.sizeBytes,
        title: this.state.videoData.title,
        thumbnail: result.metadata?.thumbnail || this.state.videoData.cover,
        tiktokVideoId: this.state.videoData.id
      };
      this.state.isForceResave = false;

      // Update Drive link in history
      this.updateHistoryDrivePath(this.state.videoData.id, result.relPath);

      showToast(`Đã lưu "${result.fileName}" vào thư mục /tiktok của Drive`, 'success');
      this.notify({ type: 'drive-saved', result });
    } catch (err) {
      this.state.isSavingDrive = false;
      showToast(`Lỗi lưu Drive: ${err?.message || 'Thất bại'}`, 'error');
      this.notify({ type: 'drive-error' });
    }
  }

  /**
   * Background batch processor for multiple TikTok URLs.
   * Resolves, checks duplicate, and saves directly to Studio Drive (/tiktok).
   * @param {string[]} urls
   */
  async startBatchSave(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;
    const uniqueUrls = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
    if (uniqueUrls.length === 0) return;

    if (this.state.batchQueue.isActive) {
      showToast('Hàng đợi tải TikTok đang chạy. Vui lòng chờ...', 'warning');
      return;
    }

    this.state.batchQueue = {
      isActive: true,
      total: uniqueUrls.length,
      current: 0,
      successCount: 0,
      skipCount: 0,
      failCount: 0,
      currentUrl: '',
      currentTitle: '',
      isCancelled: false
    };

    soundEngine.playStart();
    showToast(`Bắt đầu xử lý hàng đợi ${uniqueUrls.length} video TikTok vào Studio Drive...`, 'info');
    this.notify({ type: 'batch-started' });

    for (let i = 0; i < uniqueUrls.length; i++) {
      if (this.state.batchQueue.isCancelled) {
        showToast('Đã dừng hàng đợi tải TikTok', 'info');
        break;
      }

      const targetUrl = uniqueUrls[i];
      this.state.batchQueue.current = i;
      this.state.batchQueue.currentUrl = targetUrl;
      this.state.batchQueue.currentTitle = `Đang trích xuất liên kết (${i + 1}/${uniqueUrls.length})...`;
      this.notify({ type: 'batch-progress' });

      try {
        // Step 1: Resolve video metadata
        const data = await tiktokApi.resolveVideo(targetUrl);
        if (this.state.batchQueue.isCancelled) break;

        const videoTitle = data.title || `Video_${data.id}`;
        this.state.batchQueue.currentTitle = videoTitle;
        this.notify({ type: 'batch-progress' });

        // Step 2: Check if already exists in Drive
        let driveRelPath = null;
        if (data.existingInDrive) {
          driveRelPath = data.existingInDrive.relPath || data.existingInDrive.path;
          this.state.batchQueue.skipCount++;
        } else {
          // Step 3: Save directly to Drive
          const streamUrl = data.videoHdUrl || data.videoUrl || '';
          const saveRes = await tiktokApi.saveToDrive({
            url: streamUrl,
            title: data.title,
            id: data.id,
            originalUrl: targetUrl,
            cover: data.cover,
            author: data.author,
            duration: data.duration,
            overwrite: false,
            isSlideshow: Boolean(data.isSlideshow),
            images: data.images || [],
            audioUrl: data.audioUrl || ''
          });
          driveRelPath = saveRes.relPath;
          this.state.batchQueue.successCount++;
        }

        // Step 4: Persist in history with driveRelPath
        this.saveHistory({
          id: data.id,
          title: data.title,
          cover: data.cover,
          author: data.author?.nickname || data.author?.uniqueId,
          duration: data.duration,
          url: targetUrl,
          driveRelPath,
          isSlideshow: Boolean(data.isSlideshow),
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn(`[TikTokManager] Batch failed for ${targetUrl}:`, err);
        this.state.batchQueue.failCount++;
      }

      this.state.batchQueue.current = i + 1;
      this.notify({ type: 'batch-progress' });
    }

    const { successCount, skipCount, failCount, total, isCancelled } = this.state.batchQueue;
    this.state.batchQueue.isActive = false;
    this.state.batchQueue.currentTitle = '';
    this.notify({ type: 'batch-completed' });

    if (!isCancelled) {
      let summaryMsg = `Hoàn tất tải hàng loạt: ${successCount} video mới lưu vào Drive`;
      if (skipCount > 0) summaryMsg += `, ${skipCount} đã có sẵn`;
      if (failCount > 0) summaryMsg += `, ${failCount} không tải được`;
      showToast(summaryMsg, failCount === total && total > 0 ? 'error' : 'success');
    }
  }

  cancelBatch() {
    if (this.state.batchQueue.isActive) {
      this.state.batchQueue.isCancelled = true;
      this.state.batchQueue.isActive = false;
      this.notify({ type: 'batch-cancelled' });
    }
  }

  /**
   * Implements IModuleTaskManager for taskCoordinator and GlobalTaskDock integration.
   * @returns {import('../../../../utilities/taskCoordinator.js').ActiveTask[]}
   */
  getActiveTasks() {
    const tasks = [];
    if (this.state.batchQueue.isActive) {
      const q = this.state.batchQueue;
      const pct = q.total > 0 ? Math.round((q.current / q.total) * 100) : 0;
      tasks.push({
        id: 'tiktok-batch-save-drive',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: `Lưu hàng loạt TikTok (${q.current}/${q.total})`,
        status: 'running',
        progress: pct,
        stage: q.currentTitle ? `Đang xử lý: ${q.currentTitle}` : `Đang xử lý video ${q.current + 1}/${q.total}...`,
        route: this.route,
        cancel: () => this.cancelBatch()
      });
    } else if (this.state.isSavingDrive) {
      tasks.push({
        id: 'tiktok-single-save-drive',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.state.videoData?.title
          ? `Lưu Drive: ${this.state.videoData.title}`
          : (this.state.videoData?.isSlideshow ? 'Đang lưu Album ảnh vào Drive' : 'Đang lưu vào Studio Drive'),
        status: 'running',
        progress: 70,
        stage: this.state.videoData?.isSlideshow ? 'Đang đóng gói ZIP và ghi vào /tiktok...' : 'Đang ghi video vào /tiktok...',
        route: this.route
      });
    } else if (this.state.isLoading) {
      tasks.push({
        id: 'tiktok-single-resolve',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.state.url ? `Trích xuất: ${this.state.url}` : 'Đang lấy video TikTok',
        status: 'running',
        progress: 40,
        stage: 'Đang phân tích liên kết...',
        route: this.route
      });
    }
    return tasks;
  }

  cancelTask(taskId) {
    if (taskId === 'tiktok-batch-save-drive') {
      this.cancelBatch();
    }
  }
}

export const tiktokManager = new TiktokManager();
taskCoordinator.registerManager(tiktokManager);
