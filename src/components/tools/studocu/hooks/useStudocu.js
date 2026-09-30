/**
 * useStudocu Hook & State Manager (< 220 lines)
 * Central reactive controller for Native Studocu Downloader.
 * Features Active Job Persistence across page reloads.
 */

import { showToast } from '../../../../utilities/toast.js';
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
  cancelJobApi
} from './studocuApi.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';

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
      counts: { pdf: this.files.length, trash: this.trash.length }
    };
  }

  async init() {
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
      const payload = { url, cookie: cookie || undefined };
      const data = await safeFetchJson('/api/v1/studocu/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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
        this.orbInstance = window.ThinkingOrbs.createThinkingOrb(cvs, { state: 'working', size: 20, isDark: true, speed: 1.25 });
      }
    });
  }

  stopThinkingOrbs() {
    if (this.orbInstance) {
      try { this.orbInstance.stop(); } catch (_) {}
      this.orbInstance = null;
    }
  }

  startPolling(jobId) {
    clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/studocu/status/${jobId}`);
        if (!res.ok) return;
        const job = await res.json().catch(() => null);
        if (!job || job.error) return;

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
          this.finishJob(true, 'Tải hoàn tất');
        } else if (job.status === 'error' || job.status === 'failed') {
          this.finishJob(false, job.error || 'Quá trình trích xuất gặp lỗi');
        } else if (job.status === 'cancelled') {
          this.finishJob(false, 'Tiến trình đã bị hủy');
        } else {
          this.notify();
        }
      } catch (_) {}
    }, 800);
  }

  finishJob(isSuccess, message) {
    saveActiveJob(null);
    clearInterval(this.pollInterval);
    clearInterval(this.timerInterval);
    this.isDownloading = false;
    this.hasError = !isSuccess;
    this.stopThinkingOrbs();

    if (isSuccess) {
      showToast(message || 'Tải hoàn tất', 'success');
      playCompleteSound();
      this.fetchFiles();
    } else {
      showToast(message || 'Thao tác thất bại');
      this.logs.push(`❌ ${message}`);
    }
    this.notify();
  }

  async cancelJob() {
    if (this.currentJobId) {
      saveActiveJob(null);
      await cancelJobApi(this.currentJobId);
      this.finishJob(false, 'Đã hủy tải');
    }
  }

  async moveToTrash(filename) { if (await moveToTrashApi(filename)) await this.fetchFiles(); }
  async restoreFromTrash(filename) { if (await restoreFromTrashApi(filename)) await this.fetchFiles(); }
  async deletePermanent(filename) { if (await deletePermanentApi(filename)) await this.fetchFiles(); }
  async emptyTrash() { if (await emptyTrashApi()) await this.fetchFiles(); }

  getActiveTasks() {
    if (!this.isDownloading) return [];
    return [
      {
        id: `studocu-job-${this.currentJobId || 'active'}`,
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title: this.stepLabel ? `Tài liệu: ${this.stepLabel}` : 'Tải tài liệu Studocu',
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
