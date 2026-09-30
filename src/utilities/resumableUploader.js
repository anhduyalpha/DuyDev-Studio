/**
 * Resumable Chunked Uploader Engine & Universal Smart Upload
 * High-speed concurrent multi-stream uploads with adaptive chunk sizing (5MB - 40MB),
 * jittered exponential retry, socket timeouts, offline/online auto-recovery, and checkpointing.
 */

const CHECKPOINT_KEY = 'ds_chunk_upload_checkpoint';

export function getOptimalChunkSize(fileSize) {
  if (fileSize > 5 * 1024 * 1024 * 1024) return 40 * 1024 * 1024; // > 5GB: 40MB chunks
  if (fileSize > 2 * 1024 * 1024 * 1024) return 32 * 1024 * 1024; // 2GB - 5GB: 32MB chunks
  if (fileSize > 500 * 1024 * 1024) return 25 * 1024 * 1024;      // 500MB - 2GB: 25MB chunks
  if (fileSize > 150 * 1024 * 1024) return 15 * 1024 * 1024;      // 150MB - 500MB: 15MB chunks
  if (fileSize > 50 * 1024 * 1024) return 10 * 1024 * 1024;       // 50MB - 150MB: 10MB chunks
  return 10 * 1024 * 1024;                                         // <= 50MB: 10MB chunks
}

export class ResumableUploader {
  constructor(file, options = {}) {
    this.file = file;
    this.chunkSize = options.chunkSize || getOptimalChunkSize(file.size);
    this.concurrency = options.concurrency || (file.size > 1024 * 1024 * 1024 ? 4 : 3);
    this.purpose = options.purpose || 'archive-inspect';
    this.targetDir = options.targetDir || null;
    this.headers = options.headers || {};
    this.onProgress = options.onProgress || (() => {});
    this.onStage = options.onStage || (() => {});
    this.onError = options.onError || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.totalChunks = Math.ceil(this.file.size / this.chunkSize) || 1;
    this.uploadId = options.existingUploadId || null;
    this.uploadedChunks = new Set(options.existingUploadedChunks || []);
    this.isPaused = false;
    this.isCancelled = false;
    this.activeXhrs = new Map();
    this.activeBytes = new Map();
    this.startTime = 0;
    this.lastWindowBytes = 0;
    this.lastWindowTime = 0;
    this.speed = 0;

    this._onOffline = () => {
      if (!this.isPaused && !this.isCancelled) {
        this.pause();
        this.onStage('Mạng gián đoạn. Tự động tạm dừng tải lên...');
      }
    };
    this._onOnline = () => {
      if (this.isPaused && !this.isCancelled) {
        this.resume();
        this.onStage('Đã khôi phục mạng. Đang tiếp tục tải lên...');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', this._onOffline);
      window.addEventListener('online', this._onOnline);
    }
  }

  _cleanupListeners() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('offline', this._onOffline);
      window.removeEventListener('online', this._onOnline);
    }
  }

  static getCheckpoint() {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  static clearCheckpoint() {
    try { localStorage.removeItem(CHECKPOINT_KEY); } catch (_) {}
  }

  saveCheckpoint() {
    try {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
        uploadId: this.uploadId,
        fileName: this.file.name,
        fileSize: this.file.size,
        lastModified: this.file.lastModified,
        totalChunks: this.totalChunks,
        chunkSize: this.chunkSize,
        purpose: this.purpose,
        targetDir: this.targetDir,
        updatedAt: Date.now()
      }));
    } catch (_) {}
  }

  async start() {
    this.startTime = Date.now();
    this.lastWindowTime = this.startTime;

    try {
      if (!this.uploadId) {
        this.onStage('Khởi tạo phiên truyền tệp...');
        const initRes = await fetch('/api/v1/files/chunk/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.headers },
          body: JSON.stringify({
            fileName: this.file.name,
            fileSize: this.file.size,
            totalChunks: this.totalChunks,
            chunkSize: this.chunkSize,
            purpose: this.purpose,
            targetDir: this.targetDir,
            strictSizeCheck: true
          })
        });
        const initData = await initRes.json();
        if (!initRes.ok || !initData.success) {
          throw new Error(initData.error?.message || (typeof initData.error === 'string' ? initData.error : 'Khởi tạo tải thất bại'));
        }
        this.uploadId = initData.data.uploadId;
      } else {
        const statRes = await fetch(`/api/v1/files/chunk/status/${this.uploadId}`, { headers: this.headers });
        const statData = await statRes.json();
        if (statRes.ok && statData.data?.uploadedChunks) {
          statData.data.uploadedChunks.forEach(idx => this.uploadedChunks.add(idx));
        }
      }

      this.saveCheckpoint();

      // Step 2: Upload remaining chunks concurrently with worker pool
      const pending = [];
      for (let i = 0; i < this.totalChunks; i++) {
        if (!this.uploadedChunks.has(i)) pending.push(i);
      }

      const worker = async () => {
        while (pending.length > 0) {
          if (this.isCancelled) throw new Error('Đã hủy tải tệp lên');
          while (this.isPaused) {
            await new Promise(r => setTimeout(r, 200));
            if (this.isCancelled) throw new Error('Đã hủy tải tệp lên');
          }
          const chunkIdx = pending.shift();
          if (chunkIdx === undefined) break;

          this.onStage(`Đang truyền tệp [${this.uploadedChunks.size + 1}/${this.totalChunks}]...`);
          await this.uploadChunkWithRetry(chunkIdx);
          this.uploadedChunks.add(chunkIdx);
          this.activeBytes.delete(chunkIdx);
          this.saveCheckpoint();
          this.emitTelemetry();
        }
      };

      const workerCount = Math.min(this.concurrency, Math.max(1, pending.length));
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      // Step 3: Complete & Assembly
      this.onStage('Đang hoàn tất và ghép tệp trên server...');
      const compRes = await fetch('/api/v1/files/chunk/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.headers },
        body: JSON.stringify({ uploadId: this.uploadId })
      });
      const compData = await compRes.json();
      if (!compRes.ok || !compData.success) {
        throw new Error(compData.error?.message || (typeof compData.error === 'string' ? compData.error : 'Ghép tệp thất bại'));
      }

      ResumableUploader.clearCheckpoint();
      this._cleanupListeners();
      this.onComplete(compData.data);
      return compData.data;
    } catch (err) {
      this._cleanupListeners();
      this.onError(err);
      throw err;
    }
  }

  async uploadChunkWithRetry(chunkIndex, maxRetries = 6) {
    let attempt = 0;
    while (attempt < maxRetries) {
      if (this.isCancelled) throw new Error('Đã hủy tải tệp lên');
      while (this.isPaused) {
        await new Promise(r => setTimeout(r, 200));
        if (this.isCancelled) throw new Error('Đã hủy tải tệp lên');
      }
      try {
        await this.sendChunk(chunkIndex);
        return;
      } catch (err) {
        if (this.isCancelled) throw new Error('Đã hủy tải tệp lên');
        if (this.isPaused) continue;
        attempt++;
        if (attempt >= maxRetries) throw err;
        const delay = Math.min(20000, 800 * Math.pow(1.7, attempt)) + Math.floor(Math.random() * 400);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  sendChunk(chunkIndex) {
    return new Promise((resolve, reject) => {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(this.file.size, start + this.chunkSize);
      const blobSlice = this.file.slice(start, end);

      const formData = new FormData();
      formData.append('file', blobSlice, `chunk_${chunkIndex}.part`);

      const xhr = new XMLHttpRequest();
      xhr.timeout = 180_000; // 3 minutes timeout per chunk
      this.activeXhrs.set(chunkIndex, xhr);

      xhr.open('POST', `/api/v1/files/chunk/upload?uploadId=${encodeURIComponent(this.uploadId)}&chunkIndex=${chunkIndex}`);

      for (const [k, v] of Object.entries(this.headers)) {
        xhr.setRequestHeader(k, v);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          this.activeBytes.set(chunkIndex, e.loaded);
          let inFlight = 0;
          for (const b of this.activeBytes.values()) inFlight += b;
          const totalSent = (this.uploadedChunks.size * this.chunkSize) + inFlight;
          this.calculateSpeed(totalSent);
        }
      };

      xhr.onload = () => {
        this.activeXhrs.delete(chunkIndex);
        this.activeBytes.delete(chunkIndex);
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Chunk #${chunkIndex} tải thất bại (${xhr.status})`));
      };

      xhr.ontimeout = () => {
        this.activeXhrs.delete(chunkIndex);
        this.activeBytes.delete(chunkIndex);
        reject(new Error(`Chunk #${chunkIndex} hết thời gian phản hồi (180s)`));
      };

      xhr.onerror = () => {
        this.activeXhrs.delete(chunkIndex);
        this.activeBytes.delete(chunkIndex);
        reject(new Error(`Lỗi kết nối khi gửi chunk #${chunkIndex}`));
      };

      xhr.send(formData);
    });
  }

  calculateSpeed(totalSent) {
    const now = Date.now();
    const timeDelta = (now - this.lastWindowTime) / 1000;
    if (timeDelta >= 0.5) {
      const bytesDelta = totalSent - this.lastWindowBytes;
      const instantSpeed = Math.max(0, bytesDelta / timeDelta);
      // Exponential moving average filter for smooth speed readout
      this.speed = this.speed === 0 ? instantSpeed : (this.speed * 0.7 + instantSpeed * 0.3);
      this.lastWindowBytes = totalSent;
      this.lastWindowTime = now;
      this.emitTelemetry(totalSent);
    }
  }

  emitTelemetry(knownSent) {
    let inFlight = 0;
    for (const b of this.activeBytes.values()) inFlight += b;
    const uploadedBytes = Math.min(this.file.size, knownSent ?? ((this.uploadedChunks.size * this.chunkSize) + inFlight));
    const percent = Math.min(100, Math.round((uploadedBytes / this.file.size) * 100));
    const remainingBytes = Math.max(0, this.file.size - uploadedBytes);
    const etaSeconds = this.speed > 0 ? Math.round(remainingBytes / this.speed) : 0;

    this.onProgress({
      percent,
      uploadedBytes,
      totalBytes: this.file.size,
      formattedUploaded: formatBytes(uploadedBytes),
      formattedTotal: formatBytes(this.file.size),
      speedBytesPerSec: this.speed,
      formattedSpeed: formatSpeed(this.speed),
      etaSeconds,
      formattedEta: formatEta(etaSeconds),
      isPaused: this.isPaused
    });
  }

  pause() {
    this.isPaused = true;
    for (const xhr of this.activeXhrs.values()) { try { xhr.abort(); } catch (_) {} }
    this.activeXhrs.clear();
    this.activeBytes.clear();
    this.emitTelemetry();
  }

  resume() {
    this.isPaused = false;
    this.lastWindowTime = Date.now();
    this.emitTelemetry();
  }

  cancel() {
    this.isCancelled = true;
    this._cleanupListeners();
    for (const xhr of this.activeXhrs.values()) { try { xhr.abort(); } catch (_) {} }
    this.activeXhrs.clear();
    this.activeBytes.clear();
    if (this.uploadId) {
      fetch(`/api/v1/files/chunk/${this.uploadId}`, { method: 'DELETE', headers: this.headers }).catch(() => {});
    }
    ResumableUploader.clearCheckpoint();
  }
}

export function formatBytes(b) {
  if (!b || b <= 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatSpeed(bps) {
  if (!bps || bps < 1024) return '0 KB/s';
  return bps < 1048576 ? `${(bps / 1024).toFixed(1)} KB/s` : `${(bps / 1048576).toFixed(1)} MB/s`;
}

export function formatEta(sec) {
  if (!sec || sec <= 0) return '--';
  return sec < 60 ? `~${sec}s` : `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

/**
 * Universal Smart Upload helper:
 * Automatically uses direct upload for <= 50MB and ResumableUploader for > 50MB (up to 10GB+).
 */
export async function smartUploadFile(file, options = {}) {
  const threshold = options.thresholdBytes || 50 * 1024 * 1024;
  const signal = options.signal || options.abortController?.signal;

  if (file.size <= threshold && !options.forceChunked) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new DOMException('Upload aborted', 'AbortError'));
      }

      const xhr = new XMLHttpRequest();
      if (typeof options.onXhrCreated === 'function') {
        options.onXhrCreated(xhr);
      }

      const abortHandler = () => {
        try { xhr.abort(); } catch (_) {}
        reject(new DOMException('Upload aborted', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      const formData = new FormData();
      formData.append('file', file);
      if (options.purpose) formData.append('purpose', options.purpose);

      const url = options.uploadUrl || `/api/v1/files/upload?purpose=${encodeURIComponent(options.purpose || 'general')}`;
      xhr.open('POST', url);

      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) xhr.setRequestHeader(k, v);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && options.onProgress) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          options.onProgress({
            percent,
            uploadedBytes: e.loaded,
            totalBytes: e.total,
            formattedUploaded: formatBytes(e.loaded),
            formattedTotal: formatBytes(e.total),
            speedBytesPerSec: 0,
            formattedSpeed: '--',
            etaSeconds: 0,
            formattedEta: '--'
          });
        }
      };

      xhr.onload = () => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.error?.message || res.message || `Lỗi tải lên (${xhr.status})`));
          }
        } catch {
          reject(new Error(`Tải lên thất bại với mã HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        reject(new Error('Lỗi kết nối mạng khi tải tệp lên'));
      };

      xhr.timeout = 180_000;
      xhr.ontimeout = () => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        reject(new Error('Hết thời gian phản hồi khi tải tệp lên (180s)'));
      };

      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        reject(new DOMException('Upload aborted', 'AbortError'));
      };

      xhr.send(formData);
    });
  }

  const uploader = new ResumableUploader(file, options);
  if (typeof options.onUploaderCreated === 'function') {
    options.onUploaderCreated(uploader);
  }
  if (signal) {
    if (signal.aborted) {
      uploader.cancel();
      throw new DOMException('Upload aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => uploader.cancel(), { once: true });
  }
  return uploader.start();
}
