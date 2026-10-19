/**
 * useYoutube Hook & State Store
 * Manages YouTube URL extraction, metadata caching, download options,
 * Drive persistence, and recent history for DD Studio.
 */

import { youtubeApi } from '../services/youtubeApi.js';
import { showToast } from '../../../../utilities/toast.js';
import { soundEngine } from '../../../../utilities/soundEngine.js';
import { notifyJobComplete, notifyJobFailed } from '../../../../utilities/notificationHelper.js';

const STORAGE_KEY = 'ds_youtube_history_v1';

/**
 * Normalizes and extracts valid YouTube video URL from raw or dirty text
 * @param {string} rawText
 * @returns {string|null}
 */
export function extractYoutubeUrl(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}[^\s"'>]*/i
  );
  if (!match) return null;
  let url = match[0];
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds = 0) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats view count into readable short string (e.g. 1.2M, 450K)
 * @param {number} views
 * @returns {string}
 */
export function formatViewCount(views = 0) {
  if (!views || isNaN(views)) return '0 lượt xem';
  if (views >= 1000000000) return (views / 1000000000).toFixed(1) + 'B lượt xem';
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M lượt xem';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K lượt xem';
  return `${views} lượt xem`;
}

/**
 * Formats byte size into human readable string
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes = 0) {
  if (!bytes || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export class YoutubeManager {
  constructor() {
    this.moduleId = 'youtube-downloader';
    this.moduleTitle = 'YouTube Downloader';
    this.route = '#tool/youtube-downloader';

    this.listeners = new Set();
    this.state = {
      url: '',
      isLoading: false,
      isDownloading: false,
      isSavingDrive: false,
      downloadProgress: 0,
      downloadStatusText: '',
      error: null,
      videoData: null,
      downloadType: 'video', // 'video' | 'audio'
      selectedQuality: '1080p', // '1080p' | '720p' | '480p' | '360p' | 'mp3-320' | 'm4a-aac'
      lastResult: null,
      recentHistory: this.loadHistory()
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[YoutubeManager] Listener error:', err);
      }
    }
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
      const history = this.state.recentHistory.filter((h) => h.id !== item.id);
      history.unshift({
        ...item,
        savedAt: Date.now()
      });
      const trimmed = history.slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      this.state.recentHistory = trimmed;
      this.notify();
    } catch (err) {
      console.warn('[YoutubeManager] Failed to persist history:', err);
    }
  }

  removeHistoryItem(id) {
    this.state.recentHistory = this.state.recentHistory.filter((h) => h.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.recentHistory));
    } catch {}
    this.notify();
  }

  clearHistory() {
    this.state.recentHistory = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.notify();
    showToast('Đã xoá lịch sử tải YouTube', 'info');
  }

  setUrl(url) {
    this.state.url = url;
    this.state.error = null;
    this.notify();
  }

  setDownloadType(type) {
    if (this.state.downloadType === type) return;
    this.state.downloadType = type;
    if (type === 'video') {
      this.state.selectedQuality = '1080p';
    } else {
      this.state.selectedQuality = 'mp3-320';
    }
    this.notify();
  }

  setQuality(quality) {
    this.state.selectedQuality = quality;
    this.notify();
  }

  async resolve(rawUrl = this.state.url) {
    const cleanUrl = extractYoutubeUrl(rawUrl);
    if (!cleanUrl) {
      this.state.error = 'Vui lòng nhập liên kết YouTube hợp lệ (youtube.com hoặc youtu.be)';
      this.notify();
      showToast(this.state.error, 'warning');
      return;
    }

    this.state.url = cleanUrl;
    this.state.isLoading = true;
    this.state.error = null;
    this.state.videoData = null;
    this.state.lastResult = null;
    this.notify();

    try {
      const data = await youtubeApi.resolve(cleanUrl);
      this.state.videoData = data;
      this.state.isLoading = false;

      // Smart default quality based on what's available
      if (this.state.downloadType === 'video') {
        if (data.availableQualities && data.availableQualities.includes('1080p')) {
          this.state.selectedQuality = '1080p';
        } else if (data.availableQualities && data.availableQualities.includes('720p')) {
          this.state.selectedQuality = '720p';
        } else {
          this.state.selectedQuality = 'best';
        }
      }

      this.notify();
      try { soundEngine?.play('bell'); } catch {}
      showToast(`Đã nhận diện: ${data.title}`, 'success');
    } catch (err) {
      this.state.isLoading = false;
      this.state.error = err.message || 'Không thể trích xuất thông tin video';
      this.notify();
      try { soundEngine?.play('error'); } catch {}
      showToast(this.state.error, 'error');
    }
  }

  async download(options = {}) {
    if (!this.state.videoData) {
      showToast('Vui lòng phân tích liên kết YouTube trước', 'warning');
      return;
    }

    const type = options.type || this.state.downloadType;
    const quality = options.quality || this.state.selectedQuality;
    const url = this.state.videoData.webpageUrl || this.state.url;

    this.state.isDownloading = true;
    this.state.downloadStatusText = type === 'audio' 
      ? `Đang trích xuất & nén âm thanh ${quality}...` 
      : `Đang tải & hợp nhất video ${quality}...`;
    this.notify();

    try {
      const result = await youtubeApi.download({
        url,
        type,
        quality,
        saveToDrive: false
      });

      this.state.isDownloading = false;
      this.state.lastResult = result;
      this.state.downloadStatusText = '';

      // Save to recent history
      this.saveHistory({
        id: `${this.state.videoData.id}_${type}_${quality}`,
        videoId: this.state.videoData.id,
        title: result.title || this.state.videoData.title,
        thumbnail: this.state.videoData.thumbnail,
        duration: this.state.videoData.duration,
        durationString: this.state.videoData.durationString,
        type,
        quality,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
        downloadUrl: result.downloadUrl,
        viewUrl: result.viewUrl,
        savedToDrive: false
      });

      // Trigger download: native Android Bridge if available, otherwise direct browser anchor click
      if (window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
        window.AndroidBridge.downloadFile(
          result.downloadUrl,
          result.fileName,
          type === 'audio' ? (quality === 'm4a' ? 'audio/mp4' : 'audio/mpeg') : 'video/mp4'
        );
      } else {
        const a = document.createElement('a');
        a.href = result.downloadUrl;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
      }

      this.notify();
      try { soundEngine?.play('complete'); } catch {}
      showToast(`Tải xuống thành công: ${result.fileName}`, 'success');
      notifyJobComplete('Tải xuống YouTube hoàn tất', `"${result.fileName}" đã được tải về máy của bạn!`, {
        url: window.location.href,
        tag: `yt_${result.fileName || Date.now()}`
      });
    } catch (err) {
      this.state.isDownloading = false;
      this.state.downloadStatusText = '';
      this.notify();
      try { soundEngine?.play('error'); } catch {}
      showToast(err.message || 'Lỗi khi tải video/âm thanh', 'error');
      notifyJobFailed('Tải xuống YouTube thất bại', err.message || 'Không thể tải video/âm thanh', {
        url: window.location.href,
        tag: `yt_err_${Date.now()}`
      });
    }
  }

  async saveToDrive(options = {}) {
    if (!this.state.videoData) {
      showToast('Vui lòng phân tích liên kết YouTube trước', 'warning');
      return;
    }

    const type = options.type || this.state.downloadType;
    const quality = options.quality || this.state.selectedQuality;
    const url = this.state.videoData.webpageUrl || this.state.url;

    this.state.isSavingDrive = true;
    this.state.downloadStatusText = `Đang lưu vào Storage Drive (${type === 'audio' ? 'Âm thanh' : 'Video'})...`;
    this.notify();

    try {
      const result = await youtubeApi.saveToDrive({
        url,
        type,
        quality,
        title: this.state.videoData.title,
        videoId: this.state.videoData.id,
        author: this.state.videoData.uploader,
        duration: this.state.videoData.duration,
        cover: this.state.videoData.thumbnail
      });

      this.state.isSavingDrive = false;
      this.state.lastResult = result;
      this.state.downloadStatusText = '';

      // Save to recent history
      this.saveHistory({
        id: `${this.state.videoData.id}_${type}_${quality}_drive`,
        videoId: this.state.videoData.id,
        title: result.title || this.state.videoData.title,
        thumbnail: this.state.videoData.thumbnail,
        duration: this.state.videoData.duration,
        durationString: this.state.videoData.durationString,
        type,
        quality,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
        downloadUrl: result.downloadUrl,
        viewUrl: result.viewUrl,
        savedToDrive: true
      });

      this.notify();
      try { soundEngine?.play('complete'); } catch {}
      showToast(`Đã lưu vào Storage Drive: ${result.fileName}`, 'success');
    } catch (err) {
      this.state.isSavingDrive = false;
      this.state.downloadStatusText = '';
      this.notify();
      try { soundEngine?.play('error'); } catch {}
      showToast(err.message || 'Lỗi khi lưu vào Storage Drive', 'error');
    }
  }

  clear() {
    this.state.url = '';
    this.state.videoData = null;
    this.state.error = null;
    this.state.lastResult = null;
    this.notify();
  }
}

export const youtubeManager = new YoutubeManager();
