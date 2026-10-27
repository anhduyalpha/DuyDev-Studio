/**
 * useStudocu Hook & State Manager (< 220 lines)
 * Central reactive controller for Native Studocu Downloader.
 * Features Active Job Persistence across page reloads.
 */

import { showToast } from '../../../../utilities/toast.js';
import { openInvalidUrlAlertModal } from '../components/InvalidUrlAlertModal.js';
import {
  fetchFilesAndTrash,
  moveToTrashApi,
  restoreFromTrashApi,
  deletePermanentApi,
  emptyTrashApi,
  playCompleteSound,
  safeFetchJson,
  saveActiveJob,
  loadActiveJob,
  cancelJobApi,
  verifyStudocuUrl
} from './studocuApi.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';
import { getDeviceId } from '../../../../utilities/deviceId.js';

class StudocuManager {
  constructor() {
    this.moduleId = 'studocu-dl';
    this.moduleTitle = 'Studocu Downloader';
    this.route = '#tool/studocu-dl';
    this.isDownloading = false;
    this.currentJobId = null;
    this.jobStartTime = null;
    this.elapsedSeconds = 0;
    this.progress = 5;
    this.stepLabel = 'Khởi tạo...';
    this.logs = [];
    this.hasError = false;
    this.files = [];
    this.trash = [];
    this.currentTab = 'pdf';
    this.searchQuery = '';
    this.sortOption = 'newest';
    this.subscribers = new Set();
    this.pollInterval = null;
    this.timerInterval = null;
    this.orbInstance = null;
    this.justDownloadedTimeout = null;
    this.downloadedDocNames = this.loadDownloadedDocs();
    this.justDownloadedDocName = null;
    this.justDownloadedDocId = null;
    this.activeDownloadUrl = null;
    this.activeTargetDocId = null;
    this.prevDownloadSnapshot = null;
  }

  loadDownloadedDocs() {
    return new Set();
  }

  saveDownloadedDocs() {
    // Ephemeral in-memory only: do not persist to sessionStorage/localStorage
  }

  clearDownloadedHighlight() {
    if (this.justDownloadedTimeout) {
      clearTimeout(this.justDownloadedTimeout);
      this.justDownloadedTimeout = null;
    }
    this.justDownloadedDocName = null;
    this.justDownloadedDocId = null;
    this.downloadedDocNames.clear();
    try { sessionStorage.removeItem('ds_studocu_downloaded_docs'); } catch (_) {}
  }

  cleanupWorkspace() {
    this.clearDownloadedHighlight();
    this.stopThinkingOrbs();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.stopPolling();
  }

  markAsDownloaded(docName, isJust = false, docId = null) {
    if (!docName && !docId) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const key = docName ? norm(docName) : '';

    // Cancel existing timeout if active
    if (this.justDownloadedTimeout) {
      clearTimeout(this.justDownloadedTimeout);
      this.justDownloadedTimeout = null;
    }

    // Only highlight the newest file (clear previous highlights to prevent stacking)
    this.downloadedDocNames.clear();
    if (key) this.downloadedDocNames.add(key);
    this.justDownloadedDocName = key;
    this.justDownloadedDocId = docId ? String(docId).trim() : null;

    // Automatically remove the highlight after 8 seconds ("rồi mất")
    this.justDownloadedTimeout = setTimeout(() => {
      if (this.justDownloadedDocName === key) {
        this.justDownloadedDocName = null;
        this.justDownloadedDocId = null;
        if (key) this.downloadedDocNames.delete(key);
        this.notify();
      }
    }, 8000);

    this.notify();
  }

  isDocDownloaded(docName, docId = null) {
    if (!docName && !docId) return false;
    const norm = (s) => (s || '').normalize('NFC').trim();
    if (docName && this.downloadedDocNames.has(norm(docName))) return true;
    if (docId && this.justDownloadedDocId && String(docId).trim() === this.justDownloadedDocId) return true;
    return false;
  }

  isDocJustDownloaded(docName, docId = null) {
    if (!docName && !docId) return false;
    const norm = (s) => (s || '').normalize('NFC').trim();
    if (docName && this.justDownloadedDocName === norm(docName)) return true;
    if (docId && this.justDownloadedDocId && String(docId).trim() === this.justDownloadedDocId) return true;
    return false;
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach(fn => typeof fn === 'function' && fn(state));
  }

  getState() {
    return {
      isDownloading: this.isDownloading,
      currentJobId: this.currentJobId,
      elapsedSeconds: this.elapsedSeconds,
      progress: this.progress,
      stepLabel: this.stepLabel,
      logs: this.logs,
      hasError: this.hasError,
      currentTab: this.currentTab,
      searchQuery: this.searchQuery,
      sortOption: this.sortOption,
      filteredItems: this.getFilteredItems(),
      counts: { pdf: this.files.length, trash: this.trash.length },
      downloadedDocNames: this.downloadedDocNames,
      justDownloadedDocName: this.justDownloadedDocName,
      justDownloadedDocId: this.justDownloadedDocId
    };
  }

  async init() {
    try { sessionStorage.removeItem('ds_studocu_downloaded_docs'); } catch (_) {}
    await this.fetchFiles();
    await this.resumeActiveJob();
  }

  async resumeActiveJob() {
    const saved = loadActiveJob();
    if (!saved?.jobId) return;

    try {
      const job = await safeFetchJson(`/api/v1/studocu/status/${saved.jobId}`);
      if (['completed', 'success', 'error', 'failed', 'cancelled'].includes(job?.status)) {
        saveActiveJob(null);
        return;
      }

      this.isDownloading = true;
      this.currentJobId = saved.jobId;
      this.jobStartTime = saved.jobStartTime || Date.now();
      if (Array.isArray(job?.logs)) {
        this.logs = job.logs;
        const last = job.logs[job.logs.length - 1] || '';
        this.stepLabel = last.replace(/^[^a-zA-Z0-9À-ỹ]+/, '').trim() || 'Đang tiếp tục tải...';
      }
      this.startTimer();
      this.startThinkingOrbs();
      this.startPolling(saved.jobId);
      this.notify();
    } catch (_) {
      saveActiveJob(null);
    }
  }

  async fetchFiles() {
    const { files, trash } = await fetchFilesAndTrash();
    this.files = files;
    this.trash = trash;
    this.notify();
  }

  findFileMatch(identifier = null, targetDocId = null, targetUrl = null) {
    if (!Array.isArray(this.files) || this.files.length === 0) return null;
    const norm = (s) => (s || '').normalize('NFC').trim().toLowerCase();
    const cleanExt = (s) => norm(s).replace(/\.(pdf|md)$/i, '');

    const idNorm = identifier ? norm(identifier) : '';
    const idClean = identifier ? cleanExt(identifier) : '';
    const docId = targetDocId ? String(targetDocId).trim() : null;

    // 1. Direct match by Studocu numeric doc ID across all metadata properties
    if (docId) {
      const byDocId = this.files.find(f => {
        if (f.id && String(f.id) === docId) return true;
        const urls = [f.original_url, f.source_url, f.url, f.download_url].filter(Boolean);
        for (const u of urls) {
          if (typeof u === 'string') {
            const m = u.match(/\/(\d{5,15})(?:[/?#]|$)/);
            if (m && m[1] === docId) return true;
            if (u.includes(`/${docId}`)) return true;
          }
        }
        if (f.name && new RegExp(`(^|\\D)${docId}(\\D|$)`).test(f.name)) return true;
        if (f.title && new RegExp(`(^|\\D)${docId}(\\D|$)`).test(f.title)) return true;
        return false;
      });
      if (byDocId) return byDocId;
    }

    // 2. Direct or normalized match by filename / title / internal ID
    if (idNorm) {
      const byName = this.files.find(f => {
        const fnNorm = norm(f.name);
        const ftNorm = norm(f.title);
        const fId = norm(f.id);
        if (fnNorm === idNorm || ftNorm === idNorm || fId === idNorm) return true;
        if (idClean && (cleanExt(f.name) === idClean || cleanExt(f.title) === idClean)) return true;
        return false;
      });
      if (byName) return byName;
    }

    // 3. Match by target URL
    if (targetUrl) {
      const urlNorm = norm(targetUrl);
      const byUrl = this.files.find(f => {
        const urls = [f.original_url, f.source_url, f.url].filter(Boolean);
        return urls.some(u => norm(u) === urlNorm);
      });
      if (byUrl) return byUrl;
    }

    return null;
  }

  getFilteredItems() {
    let list = this.currentTab === 'trash' ? [...this.trash] : [...this.files];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(f => (f.name || f.title || '').toLowerCase().includes(q));
    }
    const sorts = {
      oldest: (a, b) => (a.mtime || 0) - (b.mtime || 0),
      name_asc: (a, b) => (a.name || '').localeCompare(b.name || '', 'vi'),
      name_desc: (a, b) => (b.name || '').localeCompare(a.name || '', 'vi'),
      size_desc: (a, b) => (b.size_bytes || 0) - (a.size_bytes || 0),
      size_asc: (a, b) => (a.size_bytes || 0) - (b.size_bytes || 0),
      newest: (a, b) => (b.mtime || 0) - (a.mtime || 0)
    };
    return list.sort(sorts[this.sortOption] || sorts.newest);
  }

  async startDownload(url, cookie = null) {
    if (this.isDownloading) return;
    const check = verifyStudocuUrl(url);
    if (!check.isValid) {
      try {
        openInvalidUrlAlertModal({
          title: check.type === 'course' ? 'Liên kết môn học, không phải tài liệu' : 'Liên kết không hợp lệ',
          subtitle: check.type === 'course' ? 'Cần chọn tệp tài liệu cụ thể để tải' : 'Vui lòng kiểm tra lại đường dẫn',
          message: check.error
        });
      } catch (_) {}
      showToast(check.error || 'Liên kết không hợp lệ', 'warning');
      return;
    }
    const targetUrl = check.url || url;
    this.activeDownloadUrl = targetUrl;
    const docIdMatch = targetUrl.match(/\/(\d{5,15})(?:[/?#]|$)/);
    this.activeTargetDocId = docIdMatch ? docIdMatch[1] : null;

    // Fast check: is this document already in local memory (e.g. downloaded previously)?
    const existingFile = this.findFileMatch(null, this.activeTargetDocId, targetUrl);

    this.clearDownloadedHighlight();
    this.prevDownloadSnapshot = new Set(this.files.map(f => (f.name || f.title || '').normalize('NFC').trim()));
    this.isDownloading = true;
    this.hasError = false;
    this.progress = 6;
    this.stepLabel = 'Đang khởi chạy...';
    this.logs = ['Đang khởi chạy...'];
    this.jobStartTime = Date.now();
    this.elapsedSeconds = 0;
    this.notify();

    this.startTimer();
    this.startThinkingOrbs();

    try {
      const deviceId = getDeviceId();
      const payload = { url: targetUrl, cookie: cookie || undefined, deviceId };
      const data = await safeFetchJson('/api/v1/studocu/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId
        },
        body: JSON.stringify(payload)
      });

      // INSTANT CACHE HIT: Server returned completed result directly (< 20ms)
      if (data && (data.status === 'completed' || data.from_cache)) {
        const docName = data.result?.pdf?.name || data.result?.name || data.result?.title || existingFile?.name || existingFile?.title;
        const resolvedDocId = data.result?.pdf?.id || data.result?.id || this.activeTargetDocId || existingFile?.id;
        this.finishJob(true, 'Tài liệu đã có sẵn trên máy chủ', docName, {
          fromCache: true,
          targetDocId: resolvedDocId,
          targetUrl,
          matchedFile: existingFile
        });
        return;
      }

      this.currentJobId = data.job_id || data.id;
      saveActiveJob({ jobId: this.currentJobId, jobStartTime: this.jobStartTime, url });
      this.startPolling(this.currentJobId);
    } catch (err) {
      saveActiveJob(null);
      this.finishJob(false, err.message);
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.jobStartTime) {
        this.elapsedSeconds = Math.floor((Date.now() - this.jobStartTime) / 1000);
        this.notify();
      }
    }, 1000);
  }

  startThinkingOrbs() {
    requestAnimationFrame(() => {
      const cvs = document.getElementById('thinkingOrbCanvas');
      if (cvs && window.ThinkingOrbs) {
        this.stopThinkingOrbs();
        const isDark = document.documentElement.classList.contains('dark');
        this.orbInstance = window.ThinkingOrbs.createThinkingOrb(cvs, { state: 'working', size: 20, isDark, speed: 1.25 });
      }
    });
  }

  stopThinkingOrbs() {
    if (this.orbInstance) {
      try { this.orbInstance.stop(); } catch (_) {}
      this.orbInstance = null;
    }
  }

  stopPolling() {
    if (this.visibilityHandler) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('ds:visibility-change', this.visibilityHandler);
      }
      this.visibilityHandler = null;
    }
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  startPolling(jobId) {
    this.stopPolling();
    this.isPolling = true;
    let isPollingTick = false;

    const pollTick = async () => {
      if (!this.isPolling || !this.isDownloading || this.currentJobId !== jobId) return;
      if (isPollingTick) return;
      isPollingTick = true;

      try {
        const res = await fetch(`/api/v1/studocu/status/${jobId}`);
        if (!this.isPolling || !this.isDownloading || this.currentJobId !== jobId) return;
        if (!res.ok) {
          if (this.isPolling && this.isDownloading && this.currentJobId === jobId) {
            const isHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden' || document.documentElement.classList.contains('app-backgrounded'));
            this.pollTimeout = setTimeout(pollTick, isHidden ? 6000 : 1200);
          }
          return;
        }
        const job = await res.json().catch(() => null);
        if (!this.isPolling || !this.isDownloading || this.currentJobId !== jobId) return;
        if (!job || job.error) {
          if (this.isPolling && this.isDownloading && this.currentJobId === jobId) {
            const isHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden' || document.documentElement.classList.contains('app-backgrounded'));
            this.pollTimeout = setTimeout(pollTick, isHidden ? 6000 : 1200);
          }
          return;
        }

        if (Array.isArray(job.logs)) {
          this.logs = job.logs;
          const last = job.logs[job.logs.length - 1] || '';
          this.stepLabel = last.replace(/^[^a-zA-Z0-9À-ỹ]+/, '').trim() || 'Đang xử lý...';
        }

        if (job.progress) {
          if (typeof job.progress.percent === 'number') {
            this.progress = Math.max(this.progress, job.progress.percent);
          }
          if (job.progress.message) {
            this.stepLabel = job.progress.message;
          }
        }

        if (job.status === 'completed' || job.status === 'success') {
          this.progress = 100;
          this.stopPolling();
          const downloadedName = job?.result?.pdf?.name || job?.result?.name || job?.result?.filename || job?.result?.title || null;
          const resolvedDocId = job?.result?.pdf?.id || job?.result?.id || this.activeTargetDocId || null;
          this.finishJob(true, job?.from_cache ? 'Tài liệu đã có sẵn trên máy chủ' : 'Tải hoàn tất', downloadedName, {
            fromCache: Boolean(job?.from_cache),
            targetDocId: resolvedDocId,
            targetUrl: this.activeDownloadUrl
          });
          return;
        } else if (job.status === 'error' || job.status === 'failed') {
          this.stopPolling();
          this.finishJob(false, job.error || 'Không thể tải tài liệu');
          return;
        } else if (job.status === 'cancelled') {
          this.stopPolling();
          this.finishJob(false, 'Tiến trình đã bị hủy');
          return;
        } else {
          const isHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden' || document.documentElement.classList.contains('app-backgrounded'));
          if (!isHidden) {
            this.notify();
          }
        }
      } catch (_) {
      } finally {
        isPollingTick = false;
        if (this.isPolling && this.isDownloading && this.currentJobId === jobId) {
          const isHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden' || document.documentElement.classList.contains('app-backgrounded'));
          this.pollTimeout = setTimeout(pollTick, isHidden ? 5000 : 800);
        }
      }
    };

    this.visibilityHandler = () => {
      if (!this.isPolling || !this.isDownloading || this.currentJobId !== jobId) return;
      const isHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden' || document.documentElement.classList.contains('app-backgrounded'));
      if (!isHidden) {
        if (this.pollTimeout) {
          clearTimeout(this.pollTimeout);
          this.pollTimeout = null;
        }
        pollTick();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('ds:visibility-change', this.visibilityHandler);
    }

    this.pollTimeout = setTimeout(pollTick, 800);
  }

  finishJob(isSuccess, message, downloadedName = null, options = {}) {
    if (!this.isDownloading && !this.currentJobId && !options.fromCache) return;
    this.isDownloading = false;
    this.currentJobId = null;
    this.stopPolling();
    saveActiveJob(null);
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.hasError = !isSuccess;
    this.stopThinkingOrbs();

    if (isSuccess) {
      showToast(message || 'Tải hoàn tất', 'success');
      playCompleteSound();

      const targetDocId = options.targetDocId || this.activeTargetDocId || null;
      const targetUrl = options.targetUrl || this.activeDownloadUrl || null;

      // Ensure active tab is 'pdf' and clear search so the document is visible
      if (this.currentTab === 'trash') {
        this.currentTab = 'pdf';
      }
      if (this.searchQuery) {
        this.searchQuery = '';
      }

      // Step 1: Instant match if file is already in memory
      let immediateMatch = options.matchedFile || this.findFileMatch(downloadedName, targetDocId, targetUrl);
      if (immediateMatch) {
        const canonicalName = immediateMatch.name || immediateMatch.title;
        const canonicalId = immediateMatch.id || targetDocId;
        this.markAsDownloaded(canonicalName, true, canonicalId);
      }

      // Step 2: Background refresh to capture new downloads or disk changes
      this.fetchFiles().then(() => {
        let finalMatch = this.findFileMatch(downloadedName, targetDocId, targetUrl);
        if (!finalMatch && this.files.length > 0) {
          const newlyAdded = this.files.find(f => !this.prevDownloadSnapshot?.has((f.name || f.title || '').normalize('NFC').trim()));
          finalMatch = newlyAdded || this.files[0];
        }
        if (finalMatch) {
          const canonicalName = finalMatch.name || finalMatch.title;
          const canonicalId = finalMatch.id || targetDocId;
          this.markAsDownloaded(canonicalName, true, canonicalId);
        }
      });
    } else {
      showToast(message || 'Thao tác thất bại');
      this.logs.push(`❌ ${message}`);
    }
    this.notify();
  }

  async cancelJob() {
    if (this.currentJobId) {
      const jobId = this.currentJobId;
      saveActiveJob(null);
      this.stopPolling();
      await cancelJobApi(jobId);
      this.finishJob(false, 'Đã hủy tải');
    }
  }

  async moveToTrash(filename) {
    if (!filename) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const targetIdx = this.files.findIndex(f =>
      norm(f.name) === norm(filename) ||
      norm(f.title) === norm(filename) ||
      f.id === filename
    );
    const item = targetIdx !== -1 ? this.files[targetIdx] : null;

    const prevFiles = [...this.files];
    const prevTrash = [...this.trash];

    if (item) {
      // Optimistic UI: remove immediately from active list, add to trash
      this.files = this.files.filter((_, i) => i !== targetIdx);
      const trashedItem = {
        ...item,
        status: 'trashed',
        trashed_at: Date.now(),
        trashed_time: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        mtime: Date.now()
      };
      this.trash = [trashedItem, ...this.trash.filter(f => norm(f.name || f.title) !== norm(filename))];
      this.notify();
    }
    showToast('Đã chuyển tệp vào thùng rác', 'success');

    try {
      const ok = await moveToTrashApi(filename);
      if (!ok) {
        if (item) {
          this.files = prevFiles;
          this.trash = prevTrash;
          this.notify();
        }
        showToast('Không thể chuyển tệp vào thùng rác', 'error');
      } else {
        this.fetchFiles();
      }
    } catch (_) {
      if (item) {
        this.files = prevFiles;
        this.trash = prevTrash;
        this.notify();
      }
      showToast('Lỗi khi chuyển tệp vào thùng rác', 'error');
    }
  }

  async restoreFromTrash(filename) {
    if (!filename) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const targetIdx = this.trash.findIndex(f =>
      norm(f.name) === norm(filename) ||
      norm(f.title) === norm(filename) ||
      f.id === filename
    );
    const item = targetIdx !== -1 ? this.trash[targetIdx] : null;

    const prevFiles = [...this.files];
    const prevTrash = [...this.trash];

    if (item) {
      // Optimistic UI: remove immediately from trash, add back to active list
      this.trash = this.trash.filter((_, i) => i !== targetIdx);
      const restoredItem = {
        ...item,
        status: 'active',
        mtime: Date.now()
      };
      this.files = [restoredItem, ...this.files.filter(f => norm(f.name || f.title) !== norm(filename))];
      this.notify();
    }

    try {
      const ok = await restoreFromTrashApi(filename);
      if (ok) {
        showToast('Đã khôi phục tài liệu', 'success');
        await this.fetchFiles();
      } else {
        if (item) {
          this.files = prevFiles;
          this.trash = prevTrash;
          this.notify();
        }
        showToast('Không thể khôi phục tài liệu', 'error');
      }
    } catch (_) {
      if (item) {
        this.files = prevFiles;
        this.trash = prevTrash;
        this.notify();
      }
      showToast('Lỗi khi khôi phục tài liệu', 'error');
    }
  }

  async deletePermanent(filename) {
    if (!filename) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const prevFiles = [...this.files];
    const prevTrash = [...this.trash];

    // Optimistic UI: remove immediately from trash list
    this.trash = this.trash.filter(f => norm(f.name || f.title) !== norm(filename) && f.id !== filename);
    this.files = this.files.filter(f => norm(f.name || f.title) !== norm(filename) && f.id !== filename);
    this.notify();
    showToast('Đã xóa vĩnh viễn tài liệu', 'success');

    try {
      const ok = await deletePermanentApi(filename);
      if (!ok) {
        this.files = prevFiles;
        this.trash = prevTrash;
        this.notify();
        showToast('Không thể xóa vĩnh viễn tài liệu', 'error');
      } else {
        this.fetchFiles();
      }
    } catch (_) {
      this.files = prevFiles;
      this.trash = prevTrash;
      this.notify();
      showToast('Lỗi khi xóa vĩnh viễn', 'error');
    }
  }

  async emptyTrash() {
    if (this.trash.length === 0) return;
    const prevTrash = [...this.trash];

    // Optimistic UI: clear trash list immediately
    this.trash = [];
    this.notify();
    showToast('Đã dọn sạch thùng rác', 'success');

    try {
      const ok = await emptyTrashApi();
      if (!ok) {
        this.trash = prevTrash;
        this.notify();
        showToast('Không thể dọn sạch thùng rác', 'error');
      }
    } catch (_) {
      this.trash = prevTrash;
      this.notify();
      showToast('Lỗi khi dọn thùng rác', 'error');
    }
  }

  getActiveTasks() {
    if (!this.isDownloading) return [];
    return [
      {
        id: `studocu-job-${this.currentJobId || 'active'}`,
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.currentDocTitle ? `Đang xử lý: ${this.currentDocTitle}` : 'Tải tài liệu Studocu',
        status: 'running',
        progress: this.progress || 5,
        stage: this.stepLabel || 'Đang xử lý...',
        route: this.route,
        cancel: () => this.cancelJob()
      }
    ];
  }

  cancelTask() {
    this.cancelJob();
  }
}

export const studocuManager = new StudocuManager();
taskCoordinator.registerManager(studocuManager);
