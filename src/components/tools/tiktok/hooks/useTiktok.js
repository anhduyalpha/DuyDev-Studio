/**
 * useTiktok Hook & State Store
 * High-performance state coordinator with surgical DOM notifications.
 */

import { tiktokApi } from '../services/tiktokApi.js';
import { showToast } from '../../../../utilities/toast.js';

const STORAGE_KEY = 'ds_tiktok_history_v1';

class TiktokManager {
  constructor() {
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
      recentHistory: this.loadHistory()
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
      const existing = this.loadHistory().filter((x) => x.id !== item.id);
      const updated = [item, ...existing].slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this.state.recentHistory = updated;
    } catch (e) {
      console.warn('[TikTokManager] Failed to persist history:', e);
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
    } else {
      this.state.duplicatePreCheck = null;
    }
    this.notify({ type: 'pre-check-duplicate', item: this.state.duplicatePreCheck });
    return this.state.duplicatePreCheck;
  }

  async resolve(candidateUrl = this.state.url) {
    const rawUrl = (candidateUrl || '').trim();
    if (!rawUrl) {
      this.state.error = 'Vui lòng nhập hoặc dán liên kết video TikTok';
      this.notify({ type: 'error' });
      return;
    }

    this.state.url = rawUrl;
    this.state.isLoading = true;
    this.state.error = null;
    this.state.savedDriveResult = null;
    this.state.existingInDrive = null;
    this.state.isForceResave = false;
    this.notify({ type: 'loading' });

    try {
      const data = await tiktokApi.resolveVideo(rawUrl);
      this.state.videoData = data;
      this.state.existingInDrive = data.existingInDrive || null;
      this.state.isLoading = false;
      this.saveHistory({
        id: data.id,
        title: data.title,
        cover: data.cover,
        author: data.author?.nickname || data.author?.uniqueId,
        duration: data.duration,
        url: rawUrl,
        timestamp: Date.now()
      });
      showToast('Đã lấy video TikTok thành công', 'success');
      this.notify({ type: 'resolved', data });
    } catch (err) {
      this.state.isLoading = false;
      this.state.error = err?.message || 'Không thể trích xuất video TikTok này';
      showToast(this.state.error, 'error');
      this.notify({ type: 'error' });
    }
  }

  async saveCurrentToDrive(forceOverwrite = this.state.isForceResave) {
    if (!this.state.videoData?.videoUrl) return;

    this.state.isSavingDrive = true;
    this.notify({ type: 'saving-drive' });

    try {
      const targetUrl = this.state.videoData.videoHdUrl || this.state.videoData.videoUrl;
      const result = await tiktokApi.saveToDrive({
        url: targetUrl,
        title: this.state.videoData.title,
        id: this.state.videoData.id,
        originalUrl: this.state.url,
        cover: this.state.videoData.cover,
        author: this.state.videoData.author,
        duration: this.state.videoData.duration,
        overwrite: forceOverwrite
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
      showToast(`Đã lưu "${result.fileName}" vào thư mục /tiktok của Drive`, 'success');
      this.notify({ type: 'drive-saved', result });
    } catch (err) {
      this.state.isSavingDrive = false;
      showToast(`Lỗi lưu Drive: ${err?.message || 'Thất bại'}`, 'error');
      this.notify({ type: 'drive-error' });
    }
  }
}

export const tiktokManager = new TiktokManager();
