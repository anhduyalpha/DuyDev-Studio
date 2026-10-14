/**
 * Scribd State Manager & Hook
 * Reactive state controller implementing IModuleTaskManager for GlobalTaskDock.
 * Decouples background processing from DOM lifecycle (KI-FIX-015).
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
    this.moduleTitle = 'Scribd Archiver';
    this.route = '#tool/scribd';

    this.isDownloading = false;
    this.currentJobId = null;
    this.currentDocTitle = 'Tài liệu Scribd';
    this.progress = 0;
    this.stepLabel = 'Sẵn sàng';
    this.logs = [];
    this.files = [];
    this.trash = [];
    this.currentTab = 'files'; // 'files' | 'trash'
    this.searchQuery = '';
    this.subscribers = new Set();
    this.eventSource = null;
    this.pollTimer = null;
    this.initialized = false;
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
      this.resumeJob(saved.jobId, saved.url);
    }
  }

  getState() {
    return {
      isDownloading: this.isDownloading,
      currentJobId: this.currentJobId,
      currentDocTitle: this.currentDocTitle,
      progress: this.progress,
      stepLabel: this.stepLabel,
      logs: this.logs,
      files: this.files,
      trash: this.trash,
      currentTab: this.currentTab,
      searchQuery: this.searchQuery
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

  async startDownload(rawInput, forceReload = false) {
    if (this.isDownloading) {
      showToast('Đang có tiến trình kết xuất đang chạy', 'warning');
      return;
    }

    const candidate = extractScribdUrlOrId(rawInput);
    if (!candidate) {
      showToast('Không tìm thấy URL hoặc mã Scribd hợp lệ trong nội dung đã nhập', 'error');
      return;
    }

    this.isDownloading = true;
    this.progress = 5;
    this.stepLabel = 'Đang kết nối máy chủ kết xuất...';
    this.logs = [`🚀 Tiếp nhận yêu cầu: ${candidate}`];
    this.currentDocTitle = 'Tài liệu Scribd ' + candidate;
    this.notify();

    try {
      const data = await startDownloadApi(candidate, forceReload);

      if (data.from_cache && data.status === 'completed') {
        this.progress = 100;
        this.stepLabel = 'Tài liệu có sẵn trong bộ nhớ đệm';
        this.logs.push('⚡ Tài liệu đã có sẵn trong kho lưu trữ.');
        if (data.result?.name) {
          this.logs.push(`✅ Sẵn sàng: ${data.result.name}`);
        }
        this.isDownloading = false;
        saveActiveJob(null);
        showToast('Tài liệu đã có sẵn trong máy chủ!', 'success');
        await this.refreshFiles();
        this.notify();
        return;
      }

      this.currentJobId = data.job_id;
      saveActiveJob({ jobId: data.job_id, url: candidate });
      this.connectSse(data.job_id);
    } catch (err) {
      this.isDownloading = false;
      this.progress = 0;
      this.stepLabel = 'Lỗi kết nối';
      this.logs.push(`❌ Lỗi: ${err.message}`);
      saveActiveJob(null);
      showToast(err.message || 'Lỗi khi khởi động kết xuất', 'error');
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
        // Fallback to polling if SSE is disconnected
        if (this.eventSource) {
          this.eventSource.close();
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

    const poll = async () => {
      try {
        const data = await safeFetchJson(`/api/v1/scribd/status/${jobId}`);
        this.handleJobUpdate(data);
      } catch (_) {}
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
      this.progress = 100;
      this.stepLabel = msg.step_label || 'Hoàn tất!';
      this.closeConnections();
      saveActiveJob(null);
      showToast('Kết xuất PDF tài liệu Scribd thành công!', 'success');
      this.refreshFiles();
    } else if (msg.status === 'failed' || msg.status === 'cancelled') {
      this.isDownloading = false;
      this.stepLabel = msg.status === 'cancelled' ? 'Đã hủy tác vụ' : (msg.error || 'Kết xuất thất bại');
      this.closeConnections();
      saveActiveJob(null);
      showToast(this.stepLabel, msg.status === 'cancelled' ? 'info' : 'error');
    }

    this.notify();
  }

  async resumeJob(jobId, url) {
    this.isDownloading = true;
    this.currentJobId = jobId;
    this.currentDocTitle = 'Tài liệu ' + (url || jobId);
    this.progress = 20;
    this.stepLabel = 'Đang tiếp tục theo dõi tiến trình...';
    this.logs = ['🔄 Khôi phục theo dõi tiến trình nền: ' + jobId];
    this.notify();
    this.connectSse(jobId);
  }

  async cancelJob() {
    if (!this.currentJobId) {
      this.isDownloading = false;
      this.notify();
      return;
    }
    const jid = this.currentJobId;
    this.closeConnections();
    this.isDownloading = false;
    this.stepLabel = 'Đang hủy...';
    this.logs.push('🛑 Gửi lệnh hủy tiến trình...');
    saveActiveJob(null);
    this.notify();

    await cancelJobApi(jid);
    showToast('Đã gửi yêu cầu hủy kết xuất', 'info');
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
    const ok = await moveToTrashApi(filename);
    if (ok) {
      showToast('Đã chuyển tệp vào thùng rác', 'info');
      await this.refreshFiles();
    } else {
      showToast('Lỗi khi chuyển vào thùng rác', 'error');
    }
  }

  async restoreFromTrash(filename) {
    const ok = await restoreFromTrashApi(filename);
    if (ok) {
      showToast('Đã khôi phục tệp thành công', 'success');
      await this.refreshFiles();
    } else {
      showToast('Lỗi khi khôi phục tệp', 'error');
    }
  }

  async deletePermanent(filename) {
    const ok = await deletePermanentApi(filename);
    if (ok) {
      showToast('Đã xóa vĩnh viễn tệp', 'info');
      await this.refreshFiles();
    } else {
      showToast('Lỗi khi xóa vĩnh viễn', 'error');
    }
  }

  async emptyTrash() {
    const ok = await emptyTrashApi();
    if (ok) {
      showToast('Đã dọn sạch thùng rác', 'info');
      await this.refreshFiles();
    } else {
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
    // Non-destructive cleanup: keep background task coordinator listening if still downloading
    // Only close connection if completed
    if (!this.isDownloading) {
      this.closeConnections();
    }
  }
}

export const scribdManager = new ScribdManager();
