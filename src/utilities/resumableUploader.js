/**
 * Resumable Chunked Uploader Engine & Universal Smart Upload
 * High-speed concurrent multi-stream uploads with adaptive chunk sizing (5MB - 40MB),
 * jittered exponential retry, socket timeouts, offline/online auto-recovery, and checkpointing.
 */

const CHECKPOINT_KEY = 'ds_chunk_upload_checkpoint';

export function isWanConnection() {
  if (typeof window === 'undefined' || !window.location) return false;
  const h = window.location.hostname || '';
  return h.includes('alphadaniel.io.vn') || h.includes('cloudflare');
}

export function resolveApiUrl(path) {
  if (typeof window !== 'undefined' && window.location?.origin && typeof path === 'string' && path.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function getOptimalChunkSize(fileSize, _isWan = isWanConnection()) {
  // Adaptive chunk sizing ladder for high throughput over WAN/Cloudflare and all networks:
  // Cloudflare request body limit on free/standard plans is 100MB; all chunk sizes remain
  // comfortably between 20MB and 50MB for files > 80MB. This minimizes round-trip overhead and fully
  // saturates TCP/HTTP2 pipes with 4 concurrent streams, just like leading cloud storage providers.
  if (!fileSize || fileSize <= 0) return 20 * 1024 * 1024;
  if (fileSize > 5 * 1024 * 1024 * 1024) return 50 * 1024 * 1024; // > 5GB: 50MB chunks
  if (fileSize > 2 * 1024 * 1024 * 1024) return 40 * 1024 * 1024; // 2GB - 5GB: 40MB chunks
  if (fileSize > 500 * 1024 * 1024) return 30 * 1024 * 1024;      // 500MB - 2GB: 30MB chunks
  return 20 * 1024 * 1024;                                         // <= 500MB: 20MB chunks
}

export class ResumableUploader {
  constructor(file, options = {}) {
    this.file = file;
    this.chunkSize = options.chunkSize || getOptimalChunkSize(file.size);
    this.concurrency = options.concurrency || 4;
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
        const initController = new AbortController();
        const initTimeoutId = setTimeout(() => initController.abort(), 30_000);
        let initRes;
        try {
          initRes = await fetch('/api/v1/files/chunk/init', {
            method: 'POST',
            signal: initController.signal,
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
        } finally {
          clearTimeout(initTimeoutId);
        }
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
      this.emitTelemetry(0);

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
      const compController = new AbortController();
      const compTimeoutId = setTimeout(() => compController.abort(), 60_000);
      let compRes;
      try {
        compRes = await fetch('/api/v1/files/chunk/complete', {
          method: 'POST',
          signal: compController.signal,
          headers: { 'Content-Type': 'application/json', ...this.headers },
          body: JSON.stringify({ uploadId: this.uploadId })
        });
      } finally {
        clearTimeout(compTimeoutId);
      }
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

  _getChunkByteLength(chunkIndex) {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(this.file.size, start + this.chunkSize);
    return Math.max(0, end - start);
  }

  _getCompletedBytes() {
    let sum = 0;
    for (const idx of this.uploadedChunks) {
      sum += this._getChunkByteLength(idx);
    }
    return sum;
  }

  _getCurrentTotalSent() {
    let inFlight = 0;
    for (const [idx, b] of this.activeBytes.entries()) {
      if (!this.uploadedChunks.has(idx)) {
        inFlight += b;
      }
    }
    return Math.min(this.file.size, this._getCompletedBytes() + inFlight);
  }

  sendChunk(chunkIndex) {
    return new Promise((resolve, reject) => {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(this.file.size, start + this.chunkSize);
      const blobSlice = this.file.slice(start, end);

      const xhr = new XMLHttpRequest();
      xhr.timeout = 300_000; // 5 minutes timeout per chunk
      this.activeXhrs.set(chunkIndex, xhr);

      // Fast streaming raw binary pipeline (WinSCP style, bypasses multipart overhead)
      xhr.open('POST', `/api/v1/files/chunk/stream?uploadId=${encodeURIComponent(this.uploadId)}&chunkIndex=${chunkIndex}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Upload-Id', String(this.uploadId));
      xhr.setRequestHeader('X-Chunk-Index', String(chunkIndex));

      for (const [k, v] of Object.entries(this.headers)) {
        xhr.setRequestHeader(k, v);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          this.activeBytes.set(chunkIndex, e.loaded);
          const totalSent = this._getCurrentTotalSent();
          this.calculateSpeed(totalSent);
        }
      };

      xhr.onload = () => {
        this.activeXhrs.delete(chunkIndex);
        if (xhr.status >= 200 && xhr.status < 300) {
          // Atomically mark chunk uploaded before clearing activeBytes to avoid telemetry dips
          this.uploadedChunks.add(chunkIndex);
          this.activeBytes.delete(chunkIndex);
          resolve();
        } else {
          this.activeBytes.delete(chunkIndex);
          reject(new Error(`Chunk #${chunkIndex} tải thất bại (${xhr.status})`));
        }
      };

      xhr.ontimeout = () => {
        this.activeXhrs.delete(chunkIndex);
        this.activeBytes.delete(chunkIndex);
        reject(new Error(`Chunk #${chunkIndex} hết thời gian phản hồi (300s)`));
      };

      xhr.onerror = () => {
        this.activeXhrs.delete(chunkIndex);
        this.activeBytes.delete(chunkIndex);
        reject(new Error(`Lỗi kết nối khi gửi chunk #${chunkIndex}`));
      };

      xhr.send(blobSlice);
    });
  }

  calculateSpeed(totalSent) {
    const now = Date.now();
    const timeDelta = (now - this.lastWindowTime) / 1000;
    if (timeDelta >= 0.25 || totalSent === this.file.size) {
      const bytesDelta = totalSent - this.lastWindowBytes;
      if (bytesDelta >= 0 && timeDelta > 0) {
        const instantSpeed = bytesDelta / timeDelta;
        // Exponential moving average filter for smooth speed readout
        this.speed = this.speed === 0 ? instantSpeed : (this.speed * 0.7 + instantSpeed * 0.3);
      }
      this.lastWindowBytes = totalSent;
      this.lastWindowTime = now;
      this.emitTelemetry(totalSent);
    }
  }

  emitTelemetry(knownSent) {
    const uploadedBytes = Math.min(this.file.size, knownSent ?? this._getCurrentTotalSent());
    const percent = this.file.size > 0 ? Math.min(100, Math.round((uploadedBytes / this.file.size) * 100)) : 0;
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
    this.lastWindowBytes = this._getCurrentTotalSent();
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
 * Uploads a file directly to Cloudflare R2 Edge using Presigned PUT URL,
 * monitors upload telemetry, and executes server ingestion upon completion.
 */
function uploadViaR2Transit(file, presignData, options = {}) {
  const signal = options.signal || options.abortController?.signal;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
    }

    if (typeof options.onStage === 'function') {
      options.onStage('Đang tăng tốc tải lên đám mây...');
    }

    const xhr = new XMLHttpRequest();
    if (typeof options.onXhrCreated === 'function') {
      options.onXhrCreated(xhr);
    }
    if (typeof options.onUploaderCreated === 'function') {
      options.onUploaderCreated({
        cancel: () => {
          try { xhr.abort(); } catch (_) {}
        },
        pause: () => {},
        resume: () => {}
      });
    }

    const abortHandler = () => {
      try { xhr.abort(); } catch (_) {}
      reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    xhr.open('PUT', presignData.presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    let lastTime = Date.now();
    let lastLoaded = 0;
    let currentSpeed = 0;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        const now = Date.now();
        const timeDelta = (now - lastTime) / 1000;
        if (timeDelta >= 0.25 || e.loaded === e.total) {
          const bytesDelta = e.loaded - lastLoaded;
          const instantSpeed = timeDelta > 0 ? Math.max(0, bytesDelta / timeDelta) : 0;
          currentSpeed = currentSpeed === 0 ? instantSpeed : (currentSpeed * 0.7 + instantSpeed * 0.3);
          lastLoaded = e.loaded;
          lastTime = now;
        }

        const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
        const remainingBytes = Math.max(0, e.total - e.loaded);
        const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

        options.onProgress({
          percent,
          uploadedBytes: e.loaded,
          totalBytes: e.total,
          formattedUploaded: formatBytes(e.loaded),
          formattedTotal: formatBytes(e.total),
          speedBytesPerSec: currentSpeed,
          formattedSpeed: formatSpeed(currentSpeed),
          etaSeconds,
          formattedEta: formatEta(etaSeconds)
        });
      }
    };

    xhr.onload = async () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          if (typeof options.onStage === 'function') {
            options.onStage('Đang nạp tệp vào máy chủ...');
          }
          const completeRes = await fetch(resolveApiUrl('/api/v1/files/complete-transit'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(options.headers || {})
            },
            body: JSON.stringify({
              fileKey: presignData.fileKey,
              fileId: presignData.fileId,
              originalName: file.name,
              mimeType: file.type || 'application/octet-stream',
              purpose: options.purpose || 'general',
              targetDir: options.targetDir || undefined,
              sizeBytes: file.size
            }),
            signal
          });
          const completeJson = await completeRes.json();
          if (completeRes.ok && completeJson.success) {
            resolve(completeJson.data);
          } else {
            reject(new Error(completeJson.error?.message || 'Lỗi nạp tệp từ trạm trung chuyển'));
          }
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Tải lên trạm trung chuyển thất bại với mã HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(new Error('Lỗi kết nối mạng khi tải lên trạm trung chuyển'));
    };

    xhr.timeout = 600_000;
    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(new Error('Hết thời gian tải lên trạm trung chuyển (600s)'));
    };

    xhr.onabort = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
    };

    xhr.send(file);
  });
}

/**
 * Universal Smart Upload helper:
 * Automatically routes through Cloudflare R2 Transit Pipe on WAN,
 * or direct streaming for <= 80MB on LAN, with ResumableUploader fallback.
 */
export async function smartUploadFile(file, options = {}) {
  const signal = options.signal || options.abortController?.signal;

  if (signal?.aborted) {
    throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
  }

  // 0. Android Native Background Upload Delegation
  if (
    typeof window !== 'undefined' &&
    window.AndroidBridge?.isNativeApp?.() &&
    window.AndroidBridge?.hasNativeUri?.(file.name, file.size)
  ) {
    try {
      const activeHost = window.AndroidBridge.getActiveHost?.() || (typeof window.location !== 'undefined' ? window.location.origin : '');
      const payload = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        purpose: options.purpose || 'general',
        targetDir: options.targetDir || '/',
        serverUrl: activeHost
      };

      const taskId = window.AndroidBridge.startBackgroundUpload(JSON.stringify(payload));
      if (!taskId) throw new Error('Không thể khởi tạo tiến trình upload trong nền');

      return await new Promise((resolve, reject) => {
        let isSettled = false;

        const cleanup = () => {
          window.removeEventListener('ds:native-upload-progress', progressHandler);
          window.removeEventListener('ds:native-upload-complete', completeHandler);
          if (signal) signal.removeEventListener('abort', abortHandler);
        };

        const abortHandler = () => {
          if (isSettled) return;
          isSettled = true;
          try { window.AndroidBridge.cancelBackgroundUpload(taskId); } catch (_) {}
          cleanup();
          reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
        };

        if (typeof options.onUploaderCreated === 'function') {
          options.onUploaderCreated({
            cancel: () => {
              abortHandler();
            },
            pause: () => {},
            resume: () => {}
          });
        }

        if (typeof options.onStage === 'function') {
          options.onStage('Đang tải lên trong nền (Android WorkManager)...');
        }

        const progressHandler = (e) => {
          const detail = e.detail;
          if (detail && detail.taskId === taskId) {
            if (options.onProgress) {
              options.onProgress({
                percent: detail.percent || 0,
                uploadedBytes: detail.uploadedBytes || 0,
                totalBytes: detail.totalBytes || file.size,
                formattedUploaded: formatBytes(detail.uploadedBytes || 0),
                formattedTotal: formatBytes(detail.totalBytes || file.size),
                speedBytesPerSec: detail.speedBytesPerSec || 0,
                formattedSpeed: formatSpeed(detail.speedBytesPerSec || 0),
                etaSeconds: detail.etaSeconds || 0,
                formattedEta: formatEta(detail.etaSeconds || 0)
              });
            }
            if (detail.stageText && options.onStage) {
              options.onStage(detail.stageText);
            }
          }
        };

        const completeHandler = (e) => {
          const detail = e.detail;
          if (detail && detail.taskId === taskId) {
            if (isSettled) return;
            isSettled = true;
            cleanup();
            if (detail.success) {
              resolve(detail.data);
            } else {
              const errMsg = detail.error || 'Upload trong nền thất bại';
              if (errMsg.includes('hủy') || errMsg.includes('cancel')) {
                reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
              } else {
                reject(new Error(errMsg));
              }
            }
          }
        };

        if (signal) {
          if (signal.aborted) {
            abortHandler();
            return;
          }
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        window.addEventListener('ds:native-upload-progress', progressHandler);
        window.addEventListener('ds:native-upload-complete', completeHandler);
      });
    } catch (nativeErr) {
      if (signal?.aborted) throw nativeErr;
      console.warn('[SmartUpload] Native background upload failed, falling back to Web pipeline:', nativeErr);
      // Fall through cleanly to Web pipeline
    }
  }

  // 1. Presign query: check if R2 Transit Pipe is available for this request
  if (!options.uploadUrl && !options.forceDirect) {
    try {
      const presignRes = await fetch(resolveApiUrl('/api/v1/files/presign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          purpose: options.purpose || 'general',
          targetDir: options.targetDir || undefined
        }),
        signal
      });

      if (presignRes.ok) {
        const presignJson = await presignRes.json();
        if (presignJson.success && presignJson.data?.mode === 'r2') {
          try {
            return await uploadViaR2Transit(file, presignJson.data, options);
          } catch (r2Err) {
            if (signal?.aborted) throw r2Err;
            console.warn('[SmartUpload] R2 transit failed, falling back to direct upload:', r2Err);
            // Fall through gracefully to direct upload
          }
        } else if (presignJson.success && presignJson.data?.uploadUrl) {
          options.uploadUrl = presignJson.data.uploadUrl;
        }
      }
    } catch (presignErr) {
      if (signal?.aborted) throw presignErr;
      console.warn('[SmartUpload] Presign request failed, falling back to direct upload:', presignErr);
      // Fall through gracefully to direct upload
    }
  }

  // 2. Direct streaming handles up to 80MB in 1 single fast HTTP/2 POST request on all connections.
  const defaultThreshold = 80 * 1024 * 1024;
  const threshold = options.thresholdBytes || defaultThreshold;

  if (file.size <= threshold && !options.forceChunked) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
      }

      if (typeof options.onStage === 'function') {
        options.onStage('Đang tải tệp lên...');
      }

      const xhr = new XMLHttpRequest();
      if (typeof options.onXhrCreated === 'function') {
        options.onXhrCreated(xhr);
      }
      if (typeof options.onUploaderCreated === 'function') {
        options.onUploaderCreated({
          cancel: () => {
            try { xhr.abort(); } catch (_) {}
          },
          pause: () => {},
          resume: () => {}
        });
      }

      const abortHandler = () => {
        try { xhr.abort(); } catch (_) {}
        reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
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

      let lastTime = Date.now();
      let lastLoaded = 0;
      let currentSpeed = 0;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && options.onProgress) {
          const now = Date.now();
          const timeDelta = (now - lastTime) / 1000;
          if (timeDelta >= 0.25 || e.loaded === e.total) {
            const bytesDelta = e.loaded - lastLoaded;
            const instantSpeed = timeDelta > 0 ? Math.max(0, bytesDelta / timeDelta) : 0;
            currentSpeed = currentSpeed === 0 ? instantSpeed : (currentSpeed * 0.7 + instantSpeed * 0.3);
            lastLoaded = e.loaded;
            lastTime = now;
          }

          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          const remainingBytes = Math.max(0, e.total - e.loaded);
          const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

          options.onProgress({
            percent,
            uploadedBytes: e.loaded,
            totalBytes: e.total,
            formattedUploaded: formatBytes(e.loaded),
            formattedTotal: formatBytes(e.total),
            speedBytesPerSec: currentSpeed,
            formattedSpeed: formatSpeed(currentSpeed),
            etaSeconds,
            formattedEta: formatEta(etaSeconds)
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

      xhr.timeout = 300_000;
      xhr.ontimeout = () => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        reject(new Error('Hết thời gian phản hồi khi tải tệp lên (300s)'));
      };

      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
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
      throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
    }
    signal.addEventListener('abort', () => uploader.cancel(), { once: true });
  }
  return uploader.start();
}

/**
 * Bounded concurrency parallel pool for multi-file operations.
 * Executes workerFn(item, index) with at most maxConcurrency concurrent tasks.
 * Preserves result order.
 */
export async function poolAll(items, workerFn, maxConcurrency = 3) {
  if (!items || items.length === 0) return [];
  const results = new Array(items.length);
  let nextIdx = 0;

  const workers = new Array(Math.min(items.length, maxConcurrency)).fill(0).map(async () => {
    while (nextIdx < items.length) {
      const currentIdx = nextIdx++;
      results[currentIdx] = await workerFn(items[currentIdx], currentIdx);
    }
  });

  await Promise.all(workers);
  return results;
}
