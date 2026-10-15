/**
 * Scribd State Manager & Hook
 * Reactive state controller implementing IModuleTaskManager for GlobalTaskDock.
 * Features 100% parity with Studocu Downloader specifications (KI-FIX-015).
 */

import { showToast } from '../../../../utilities/toast.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';
import {
  fetchFilesAndTrash,
  startDownloadApi,
  cancelJobApi,
  moveToTrashApi,
  restoreFromTrashApi,
  deletePermanentApi,
  emptyTrashApi,
  saveToDriveApi,
  saveActiveJob,
  loadActiveJob,
  safeFetchJson
} from '../services/scribdApi.js';

export function extractScribdUrlOrId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();

  // URL extraction
  const urlMatch = str.match(/https?:\/\/[^\s]*scribd\.com[^\s]*/i);
  if (urlMatch) return urlMatch[0].replace(/[)\]'",;]+$/, '');

  // Numeric ID extraction
  const idMatch = str.match(/\b\d{6,15}\b/);
  if (idMatch) return idMatch[0];

  return null;
}

class ScribdManager {
  constructor() {
    this.moduleId = 'scribd-archiver';
    this.moduleTitle = 'Scribd Downloader';
    this.route = '#tool/scribd';

    this.isDownloading = false;
    this.currentJobId = null;
    this.currentDocTitle = 'Tài liệu Scribd';
    this.jobStartTime = null;
    this.elapsedSeconds = 0;
    this.progress = 5;
    this.stepLabel = 'Khởi tạo...';
    this.logs = [];
    this.hasError = false;

    this.files = [];
    this.trash = [];
    this.currentTab = 'pdf'; // 'pdf' | 'trash'
    this.searchQuery = '';
    this.sortOption = 'newest';

    this.subscribers = new Set();
    this.eventSource = null;
    this.pollTimer = null;
    this.timerInterval = null;
    this.orbInstance = null;

    this.downloadedDocNames = this.loadDownloadedDocs();
    this.justDownloadedDocName = null;
    this.initialized = false;
  }

  loadDownloadedDocs() {
    try {
      const raw = sessionStorage.getItem('ds_scribd_downloaded_docs');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (_) {
      return new Set();
    }
  }

  saveDownloadedDocs() {
    try {
      sessionStorage.setItem('ds_scribd_downloaded_docs', JSON.stringify([...this.downloadedDocNames]));
    } catch (_) {}
  }

  markAsDownloaded(docName, isJust = false) {
    if (!docName) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const key = norm(docName);
    this.downloadedDocNames.add(key);
    this.saveDownloadedDocs();
    if (isJust) {
      this.justDownloadedDocName = key;
      setTimeout(() => {
        if (this.justDownloadedDocName === key) {
          this.justDownloadedDocName = null;
          this.notify();
        }
      }, 7000);
    }
    this.notify();
  }

  isDocDownloaded(docName) {
    if (!docName) return false;
    const norm = (s) => (s || '').normalize('NFC').trim();
    return this.downloadedDocNames.has(norm(docName));
  }

  isDocJustDownloaded(docName) {
    if (!docName) return false;
    const norm = (s) => (s || '').normalize('NFC').trim();
    return this.justDownloadedDocName === norm(docName);
  }

  init() {
    if (this.initialized) {
      this.refreshFiles();
      return;
    }
    this.initialized = true;

    // Register with Universal Task Coordinator
    taskCoordinator.registerManager(this);

    // Initial file fetch
    this.refreshFiles();

    // Check for active pending job
    const saved = loadActiveJob();
    if (saved && saved.jobId) {
      this.resumeJob(saved.jobId, saved.url, saved.jobStartTime);
    }
  }

  getState() {
    return {
      isDownloading: this.isDownloading,
      currentJobId: this.currentJobId,
      currentDocTitle: this.currentDocTitle,
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
      justDownloadedDocName: this.justDownloadedDocName
    };
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    listener(this.getState());
    return () => this.subscribers.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach((fn) => {
      try { fn(state); } catch (_) {}
    });
    taskCoordinator.notify();
  }

  getActiveTasks() {
    if (!this.isDownloading) return [];
    return [
      {
        id: this.currentJobId || 'scribd-job',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.currentDocTitle || 'Tài liệu Scribd',
        status: 'running',
        progress: this.progress,
        stage: this.stepLabel,
        route: this.route,
        cancel: () => this.cancelJob()
      }
    ];
  }

  async refreshFiles() {
    const data = await fetchFilesAndTrash();
    this.files = data.files || [];
    this.trash = data.trash || [];
    this.notify();
  }

  setTab(tab) {
    this.currentTab = tab;
    this.notify();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.notify();
  }

  setSortOption(opt) {
    this.sortOption = opt;
    this.notify();
  }

  getFilteredItems() {
    let list = this.currentTab === 'trash' ? [...this.trash] : [...this.files];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(f => (f.name || f.title || '').toLowerCase().includes(q));
    }
    const sorts = {
      oldest: (a, b) => (a.mtime || 0) - (b.mtime || 0),
      name_asc: (a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || '', 'vi'),
      name_desc: (a, b) => (b.title || b.name || '').localeCompare(a.title || a.name || '', 'vi'),
      size_desc: (a, b) => (b.size_bytes || 0) - (a.size_bytes || 0),
      size_asc: (a, b) => (a.size_bytes || 0) - (b.size_bytes || 0),
      newest: (a, b) => (b.mtime || 0) - (a.mtime || 0)
    };
    return list.sort(sorts[this.sortOption] || sorts.newest);
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.jobStartTime) {
        this.elapsedSeconds = Math.floor((Date.now() - this.jobStartTime) / 1000);
        this.notify();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startThinkingOrbs() {
    requestAnimationFrame(() => {
      const cvs = document.getElementById('scribdThinkingOrbCanvas');
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

  async startDownload(rawInput, forceReload = false) {
    const candidate = extractScribdUrlOrId(rawInput);
    if (!candidate) {
      showToast('Không tìm thấy URL hoặc mã Scribd hợp lệ trong nội dung đã nhập', 'error');
      return;
    }

    if (this.isDownloading) {
      this.closeConnections();
      this.isDownloading = false;
      this.stopTimer();
      this.stopThinkingOrbs();
      saveActiveJob(null);
    }

    this.isDownloading = true;
    this.hasError = false;
    this.jobStartTime = Date.now();
    this.elapsedSeconds = 0;
    this.progress = 5;
    this.stepLabel = 'Đang chuẩn bị tải tài liệu...';
    this.logs = [`🚀 Đang xử lý liên kết: ${candidate}`];
    this.currentDocTitle = 'Tài liệu Scribd ' + candidate;
    this.startTimer();
    this.startThinkingOrbs();
    this.notify();

    try {
      const data = await startDownloadApi(candidate, forceReload);

      if (data.from_cache && data.status === 'completed') {
        this.progress = 100;
        this.stepLabel = 'Tài liệu đã có sẵn trên máy chủ';
        this.logs.push('⚡ Tài liệu đã có sẵn trong kho lưu trữ.');
        if (data.result?.name) {
          this.logs.push(`✅ Sẵn sàng: ${data.result.name}`);
          this.markAsDownloaded(data.result.name, true);
        }
        this.isDownloading = false;
        this.stopTimer();
        this.stopThinkingOrbs();
        saveActiveJob(null);
        showToast('Tài liệu đã có sẵn trong máy chủ!', 'success');
        await this.refreshFiles();
        this.notify();
        return;
      }

      this.currentJobId = data.job_id;
      saveActiveJob({ jobId: data.job_id, jobStartTime: this.jobStartTime, url: candidate });
      this.connectSse(data.job_id);
    } catch (err) {
      this.isDownloading = false;
      this.hasError = true;
      this.progress = 0;
      this.stepLabel = 'Lỗi kết nối';
      this.logs.push(`❌ Lỗi: ${err.message}`);
      this.stopTimer();
      this.stopThinkingOrbs();
      saveActiveJob(null);
      showToast(err.message || 'Lỗi khi bắt đầu tải', 'error');
      this.notify();
    }
  }

  connectSse(jobId) {
    this.closeConnections();

    try {
      this.eventSource = new EventSource(`/api/v1/scribd/events/${jobId}`);

      this.eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleJobUpdate(msg);
        } catch (_) {}
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          try { this.eventSource.close(); } catch (_) {}
          this.eventSource = null;
        }
        this.startPolling(jobId);
      };
    } catch (_) {
      this.startPolling(jobId);
    }
  }

  startPolling(jobId) {
    this.closeConnections();

    let failCount = 0;
    const poll = async () => {
      try {
        const data = await safeFetchJson(`/api/v1/scribd/status/${jobId}`);
        failCount = 0;
        this.handleJobUpdate(data);
      } catch (err) {
        failCount++;
        if (failCount >= 2) {
          this.closeConnections();
          this.isDownloading = false;
          this.currentJobId = null;
          this.stopTimer();
          this.stopThinkingOrbs();
          saveActiveJob(null);
          this.stepLabel = 'Tác vụ đã kết thúc hoặc máy chủ khởi động lại.';
          this.notify();
        }
      }
    };

    poll();
    this.pollTimer = setInterval(poll, 1500);
  }

  handleJobUpdate(msg) {
    if (!msg) return;

    if (typeof msg.progress === 'number') {
      this.progress = Math.max(0, Math.min(100, Math.round(msg.progress)));
    }
    if (msg.step_label) {
      this.stepLabel = msg.step_label;
    }
    if (Array.isArray(msg.logs) && msg.logs.length > 0) {
      msg.logs.forEach((line) => {
        if (!this.logs.includes(line)) {
          this.logs.push(line);
        }
      });
      if (this.logs.length > 200) {
        this.logs = this.logs.slice(-200);
      }
    }
    if (msg.result?.title) {
      this.currentDocTitle = msg.result.title;
    }

    if (msg.status === 'completed') {
      this.isDownloading = false;
      this.hasError = false;
      this.progress = 100;
      this.stepLabel = msg.step_label || 'Hoàn tất!';
      if (msg.result?.name) {
        this.markAsDownloaded(msg.result.name, true);
      }
      this.closeConnections();
      this.stopTimer();
      this.stopThinkingOrbs();
      saveActiveJob(null);
      showToast('Đã tải xong file PDF!', 'success');
      this.refreshFiles();
    } else if (msg.status === 'failed' || msg.status === 'cancelled') {
      this.isDownloading = false;
      this.hasError = msg.status === 'failed';
      this.stepLabel = msg.status === 'cancelled' ? 'Đã hủy tác vụ' : (msg.error || 'Không thể tải tài liệu');
      this.closeConnections();
      this.stopTimer();
      this.stopThinkingOrbs();
      saveActiveJob(null);
      showToast(this.stepLabel, msg.status === 'cancelled' ? 'info' : 'error');
    }

    this.notify();
  }

  async resumeJob(jobId, url, startTime) {
    try {
      const data = await safeFetchJson(`/api/v1/scribd/status/${jobId}`);
      if (!data || data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        saveActiveJob(null);
        this.isDownloading = false;
        if (data?.status === 'completed') {
          this.refreshFiles();
        }
        this.notify();
        return;
      }

      this.isDownloading = true;
      this.hasError = false;
      this.currentJobId = jobId;
      this.currentDocTitle = 'Tài liệu ' + (url || jobId);
      this.jobStartTime = startTime || Date.now();
      this.progress = typeof data.progress === 'number' ? data.progress : 20;
      this.stepLabel = data.step_label || 'Đang tiếp tục theo dõi tiến trình...';
      this.logs = ['🔄 Khôi phục theo dõi tiến trình: ' + jobId];
      this.startTimer();
      this.startThinkingOrbs();
      this.notify();
      this.connectSse(jobId);
    } catch (_) {
      saveActiveJob(null);
      this.isDownloading = false;
      this.currentJobId = null;
      this.closeConnections();
      this.stopTimer();
      this.stopThinkingOrbs();
      this.notify();
    }
  }

  async cancelJob() {
    const jid = this.currentJobId;
    this.closeConnections();
    this.isDownloading = false;
    this.currentJobId = null;
    this.stopTimer();
    this.stopThinkingOrbs();
    this.stepLabel = 'Đã hủy tác vụ';
    this.logs.push('🛑 Tiến trình đã được hủy.');
    saveActiveJob(null);
    this.notify();

    if (jid) {
      await cancelJobApi(jid).catch(() => null);
    }
    showToast('Đã dừng quá trình tải', 'info');
    this.refreshFiles();
  }

  async saveToDrive(filename, title = '') {
    try {
      showToast('Đang lưu vào Studio Drive...', 'info');
      const res = await saveToDriveApi(filename, title, 'scribd');
      if (res.success) {
        showToast('Đã lưu tài liệu vào Studio Drive (/drive/scribd)', 'success');
        const item = this.files.find((f) => f.name === filename);
        if (item) item.from_drive = true;
        this.notify();
      }
    } catch (err) {
      showToast(err.message || 'Lỗi lưu Studio Drive', 'error');
    }
  }

  async moveToTrash(filename) {
    if (!filename) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const targetIdx = this.files.findIndex(f => norm(f.name) === norm(filename) || norm(f.title) === norm(filename));
    const item = targetIdx !== -1 ? this.files[targetIdx] : null;

    const prevFiles = [...this.files];
    const prevTrash = [...this.trash];

    if (item) {
      this.files = this.files.filter((_, i) => i !== targetIdx);
      this.trash = [{ ...item, status: 'trashed' }, ...this.trash];
      this.notify();
    }

    try {
      const ok = await moveToTrashApi(filename);
      if (ok) {
        showToast('Đã chuyển tệp vào thùng rác', 'info');
        await this.refreshFiles();
      } else {
        if (item) {
          this.files = prevFiles;
          this.trash = prevTrash;
          this.notify();
        }
        showToast('Lỗi khi chuyển vào thùng rác', 'error');
      }
    } catch (_) {
      if (item) {
        this.files = prevFiles;
        this.trash = prevTrash;
        this.notify();
      }
      showToast('Lỗi khi chuyển vào thùng rác', 'error');
    }
  }

  async restoreFromTrash(filename) {
    if (!filename) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const targetIdx = this.trash.findIndex(f => norm(f.name) === norm(filename) || norm(f.title) === norm(filename));
    const item = targetIdx !== -1 ? this.trash[targetIdx] : null;

    const prevFiles = [...this.files];
    const prevTrash = [...this.trash];

    if (item) {
      this.trash = this.trash.filter((_, i) => i !== targetIdx);
      this.files = [{ ...item, status: 'active', mtime: Date.now() }, ...this.files];
      this.notify();
    }

    try {
      const ok = await restoreFromTrashApi(filename);
      if (ok) {
        showToast('Đã khôi phục tệp thành công', 'success');
        await this.refreshFiles();
      } else {
        if (item) {
          this.files = prevFiles;
          this.trash = prevTrash;
          this.notify();
        }
        showToast('Lỗi khi khôi phục tệp', 'error');
      }
    } catch (_) {
      if (item) {
        this.files = prevFiles;
        this.trash = prevTrash;
        this.notify();
      }
      showToast('Lỗi khi khôi phục tệp', 'error');
    }
  }

  async deletePermanent(filename) {
    if (!filename) return;
    const norm = (s) => (s || '').normalize('NFC').trim();
    const prevFiles = [...this.files];
    const prevTrash = [...this.trash];

    this.trash = this.trash.filter(f => norm(f.name) !== norm(filename));
    this.files = this.files.filter(f => norm(f.name) !== norm(filename));
    this.notify();

    try {
      const ok = await deletePermanentApi(filename);
      if (ok) {
        showToast('Đã xóa vĩnh viễn tệp', 'info');
        await this.refreshFiles();
      } else {
        this.files = prevFiles;
        this.trash = prevTrash;
        this.notify();
        showToast('Lỗi khi xóa vĩnh viễn', 'error');
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

    this.trash = [];
    this.notify();

    try {
      const ok = await emptyTrashApi();
      if (ok) {
        showToast('Đã dọn sạch thùng rác', 'info');
        await this.refreshFiles();
      } else {
        this.trash = prevTrash;
        this.notify();
        showToast('Lỗi khi dọn thùng rác', 'error');
      }
    } catch (_) {
      this.trash = prevTrash;
      this.notify();
      showToast('Lỗi khi dọn thùng rác', 'error');
    }
  }

  closeConnections() {
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (_) {}
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  cleanupWorkspace() {
    this.stopTimer();
    this.stopThinkingOrbs();
    if (!this.isDownloading) {
      this.closeConnections();
    }
  }
}

export const scribdManager = new ScribdManager();
