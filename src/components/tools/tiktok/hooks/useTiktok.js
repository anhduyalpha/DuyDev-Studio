/**
 * useTiktok Hook & State Store
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

  notify() {
    this.listeners.forEach((fn) => {
      try { fn(this.state); } catch (e) { console.error('[TikTokManager] Listener error:', e); }
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
      this.notify();
    } catch {}
  }

  setUrl(url) {
    this.state.url = url;
    this.state.error = null;
    this.notify();
  }

  clear() {
    this.state.url = '';
    this.state.error = null;
    this.state.videoData = null;
    this.state.savedDriveResult = null;
    this.notify();
  }

  async resolve(candidateUrl = this.state.url) {
    const rawUrl = (candidateUrl || '').trim();
    if (!rawUrl) {
      this.state.error = 'Vui lòng nhập hoặc dán liên kết video TikTok';
      this.notify();
      return;
    }

    this.state.url = rawUrl;
    this.state.isLoading = true;
    this.state.error = null;
    this.state.savedDriveResult = null;
    this.notify();

    try {
      const data = await tiktokApi.resolveVideo(rawUrl);
      this.state.videoData = data;
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
      showToast('Đã bóc tách video TikTok thành công', 'success');
      this.notify();
    } catch (err) {
      this.state.isLoading = false;
      this.state.error = err?.message || 'Không thể trích xuất video TikTok này';
      showToast(this.state.error, 'error');
      this.notify();
    }
  }

  async saveCurrentToDrive() {
    if (!this.state.videoData?.videoUrl) return;

    this.state.isSavingDrive = true;
    this.notify();

    try {
      const targetUrl = this.state.videoData.videoHdUrl || this.state.videoData.videoUrl;
      const result = await tiktokApi.saveToDrive({
        url: targetUrl,
        title: this.state.videoData.title,
        id: this.state.videoData.id
      });
      this.state.isSavingDrive = false;
      this.state.savedDriveResult = result;
      showToast(`Đã lưu "${result.fileName}" vào thư mục /tiktok của Drive`, 'success');
      this.notify();
    } catch (err) {
      this.state.isSavingDrive = false;
      showToast(`Lỗi lưu Drive: ${err?.message || 'Thất bại'}`, 'error');
      this.notify();
    }
  }
}

export const tiktokManager = new TiktokManager();
