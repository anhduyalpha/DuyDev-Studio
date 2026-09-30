/**
 * useFileQueue - Manages selected files and real-time backend execution
 * Powered by Fastify Multipart Streaming + BullMQ SSE Events
 */
import { storage } from '../utilities/storage.js';
import { showToast } from '../utilities/toast.js';
import { watchJobProgress } from '../utilities/jobWatcher.js';
import { loadModuleState, saveModuleState } from '../utilities/moduleState.js';
import { smartUploadFile } from '../utilities/resumableUploader.js';

export class FileQueueManager {
  constructor(defaultToolTitle = 'Nén & Đổi PDF', toolId = 'pdf-convert') {
    this.toolTitle = defaultToolTitle;
    this.toolId = toolId;
    this.files = [];
    this.mode = toolId === 'pdf-merge' ? 'merge' : toolId === 'pdf-lock' ? 'lock' : 'compress';
    this.targetFormat = 'docx';
    this.password = '';
    this.isProcessing = false;
    this.progress = 0;
    this.stage = '';
    this.result = null;
    this.error = null;
    this.activeEventSource = null;
    this.listeners = new Set();
    const saved = loadModuleState(`pdf_${toolId}`, null);
    if (saved) Object.assign(this, { mode: saved.mode || this.mode, targetFormat: saved.targetFormat || this.targetFormat, password: saved.password || this.password, result: saved.result || this.result });
  }

  persist() {
    saveModuleState(`pdf_${this.toolId}`, {
      mode: this.mode, targetFormat: this.targetFormat, password: this.password, result: this.result
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const p = {
      toolId: this.toolId, files: this.files, mode: this.mode, targetFormat: this.targetFormat,
      password: this.password, isProcessing: this.isProcessing, progress: this.progress,
      stage: this.stage, result: this.result, error: this.error
    };
    this.listeners.forEach((fn) => fn(p));
  }

  addFiles(fileList) {
    Array.from(fileList).forEach((f) => {
      this.files.push({
        id: `file-${Date.now()}${Math.random().toString(36).substring(2, 6)}`,
        name: f.name, size: f.size, type: f.type || 'application/pdf',
        pages: Math.max(1, Math.round(f.size / (450 * 1024))),
        rawFile: f
      });
    });
    this.result = null;
    this.error = null;
    this.notify();
  }

  removeFile(id) { this.files = this.files.filter((f) => f.id !== id); this.notify(); }
  clearFiles() { this.files = []; this.result = null; this.error = null; this.persist(); this.notify(); }
  setMode(mode) { this.mode = mode; this.persist(); this.notify(); }
  setTargetFormat(fmt) { this.targetFormat = fmt; this.persist(); this.notify(); }
  getApiBase() { return window.location.origin; }

  _recordResult(data, mainFile, durationSec, fullDownloadUrl) {
    const baseName = mainFile.name.replace(/\.[^/.]+$/, '');
    const resultExt = this.mode === 'convert' ? this.targetFormat : 'pdf';
    this.progress = 100;
    this.stage = 'Hoàn tất';
    this.isProcessing = false;
    this.result = {
      fileName: `${baseName}_optimized.${resultExt}`,
      originalSize: data.originalSizeBytes || mainFile.size,
      resultSize: data.resultSizeBytes || Math.round(mainFile.size * 0.8),
      savedPct: data.savingsPct || 0,
      duration: `${durationSec}s`,
      downloadUrl: fullDownloadUrl,
      resultFileId: data.resultFileId
    };

    const historyPayload = {
      tool: this.toolTitle, toolTitle: this.toolTitle, toolId: this.toolId,
      fileName: this.result.fileName, originalSize: this.result.originalSize,
      resultSize: this.result.resultSize, status: 'success', downloadUrl: fullDownloadUrl
    };

    if (data.historyId) {
      this.result.historyId = data.historyId;
      this.persist();
      storage.recordCompletedJob({ id: data.historyId, ...historyPayload });
    } else {
      storage.addHistoryItem(historyPayload).then((rec) => {
        if (rec?.id && this.result) {
          this.result.historyId = rec.id;
          this.persist();
        }
      }).catch(() => {});
    }
  }

  async runProcess() {
    if (this.files.length === 0) return showToast('Vui lòng chọn tệp', 'warning');
    const mainFile = this.files[0];
    if (!mainFile.rawFile) return showToast('Tệp không hợp lệ', 'error');

    const apiBase = this.getApiBase();
    const startTime = Date.now();
    this.isProcessing = true;
    this.progress = 5;
    this.stage = 'Đang tải tệp lên...';
    this.error = null;
    this.result = null;
    this.notify();

    try {
      const uploadData = await smartUploadFile(mainFile.rawFile, {
        purpose: 'pdf-convert',
        onStage: (stage) => {
          this.stage = stage;
          this.notify();
        },
        onProgress: (p) => {
          this.progress = Math.min(20, Math.round(p.percent * 0.2));
          this.stage = `Đang tải tệp lên ${p.percent}%...`;
          this.notify();
        }
      });
      this.progress = 20;
      this.stage = 'Đang khởi tạo tác vụ...';
      this.notify();

      let operation = 'compress';
      if (this.toolId === 'pdf-merge') operation = this.mode === 'split' ? 'split' : 'merge';
      else if (this.toolId === 'pdf-lock') operation = 'lock';
      else operation = this.mode === 'convert' ? 'convert' : 'compress';

      const jobRes = await fetch(`${apiBase}/api/v1/jobs/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.fileId, operation,
          options: {
            compressionLevel: 'medium', stripMetadata: true, targetFormat: this.targetFormat,
            ...(this.password ? { password: this.password } : {})
          }
        })
      });

      if (!jobRes.ok) {
        const errJson = await jobRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Không thể tạo tác vụ xử lý (HTTP ${jobRes.status})`);
      }

      const { data: { jobId, eventsUrl, pollUrl } } = await jobRes.json();
      this.progress = 30;
      this.stage = 'Đang kết nối luồng xử lý...';
      this.notify();

      return new Promise((resolve, reject) => {
        this.activeEventSource = watchJobProgress({
          apiBase, eventsUrl, pollUrl,
          onProgress: (pct, stageName) => {
            this.progress = Math.max(this.progress, pct);
            if (stageName) this.stage = stageName;
            this.notify();
          },
          onCompleted: (data) => {
            const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
            const dl = data.downloadUrl || `/api/v1/files/download/${data.resultFileId}`;
            const fullDownloadUrl = dl.startsWith('http') ? dl : `${apiBase}${dl}`;
            this._recordResult(data, mainFile, durationSec, fullDownloadUrl);
            showToast('Hoàn tất xử lý', 'success');
            this.notify();
            resolve(this.result);
          },
          onFailed: (errMessage) => {
            this.isProcessing = false;
            this.error = errMessage;
            showToast(`Xử lý thất bại: ${errMessage}`, 'error');
            this.notify();
            reject(new Error(errMessage));
          }
        });
      });
    } catch (err) {
      this.isProcessing = false;
      this.error = err.message || 'Lỗi không xác định khi thực hiện tác vụ';
      showToast(this.error, 'error');
      this.notify();
      throw err;
    }
  }

  resetResult() {
    this.result = null;
    this.error = null;
    this.stage = '';
    this.progress = 0;
    this.notify();
  }
}
