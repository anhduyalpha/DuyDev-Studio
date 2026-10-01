/**
 * storageService.js - Client API Service for CasaOS Files Storage
 * Handles directory listing, progress-tracked file uploads, folder creation, deletion, and renaming.
 * Supports multi-gigabyte uploads (100MB - 10GB+) via ResumableUploader.
 */

import { getStorageAuthHeaders, getAdminToken } from '../utilities/adminAuth.js';
import { ResumableUploader, formatBytes, formatSpeed, formatEta, poolAll } from '../utilities/resumableUploader.js';

export class StorageService {
  /**
   * Fetches folder contents and disk usage statistics
   */
  static async fetchList(path = '/') {
    const headers = getStorageAuthHeaders();
    const url = `/api/v1/storage/list?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers });

    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể tải danh sách tệp');
    }

    return data.data;
  }

  /**
   * Uploads one or more files to the destination directory.
   * Transparently uses ResumableUploader (> 50MB up to 10GB+) or direct multipart (<= 50MB).
   * Executes multi-file uploads concurrently via bounded poolAll (concurrency = 3).
   */
  static async uploadFiles(files, targetPath = '/', onProgress = null, options = {}) {
    const fileList = Array.from(files);
    const totalFiles = fileList.length;

    return poolAll(fileList, async (currentFile, i) => {
      const isLarge = currentFile.size > 50 * 1024 * 1024;

      if (isLarge) {
        // Multi-part adaptive chunked upload for large files (> 50MB up to 10GB+)
        const uploader = new ResumableUploader(currentFile, {
          purpose: 'storage-drive',
          targetDir: targetPath,
          headers: getStorageAuthHeaders(),
          onStage: (stage) => {
            if (typeof options.onStage === 'function') {
              options.onStage(stage, i + 1, totalFiles, currentFile);
            }
          },
          onProgress: (telemetry) => {
            if (typeof onProgress === 'function') {
              onProgress(telemetry.percent, telemetry.uploadedBytes, telemetry.totalBytes, {
                ...telemetry,
                fileIndex: i + 1,
                totalFiles,
                currentFileName: currentFile.name
              });
            }
          }
        });

        if (typeof options.onUploaderCreated === 'function') {
          options.onUploaderCreated(uploader, currentFile, i + 1, totalFiles);
        }

        return await uploader.start();
      } else {
        // Direct single-request upload for small files (<= 50MB)
        if (typeof options.onStage === 'function') {
          options.onStage(`Đang tải lên ${currentFile.name}...`, i + 1, totalFiles, currentFile);
        }

        return await new Promise((resolve, reject) => {
          const signal = options.signal;
          if (signal?.aborted) {
            return reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
          }

          const formData = new FormData();
          formData.append('file', currentFile);

          const xhr = new XMLHttpRequest();
          const url = `/api/v1/storage/upload?path=${encodeURIComponent(targetPath)}`;
          xhr.open('POST', url);

          const token = getAdminToken();
          if (token) {
            xhr.setRequestHeader('x-storage-auth', token);
          }

          const abortHandler = () => {
            try { xhr.abort(); } catch (_) {}
            reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
          };

          if (signal) {
            signal.addEventListener('abort', abortHandler, { once: true });
          }

          if (typeof options.onUploaderCreated === 'function') {
            options.onUploaderCreated({
              cancel: () => {
                try { xhr.abort(); } catch (_) {}
              },
              pause: () => {},
              resume: () => {}
            }, currentFile, i + 1, totalFiles);
          }

          let lastTime = Date.now();
          let lastLoaded = 0;
          let currentSpeed = 0;

          if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const now = Date.now();
                const timeDelta = (now - lastTime) / 1000;
                if (timeDelta >= 0.25 || evt.loaded === evt.total) {
                  const bytesDelta = evt.loaded - lastLoaded;
                  const instantSpeed = timeDelta > 0 ? Math.max(0, bytesDelta / timeDelta) : 0;
                  currentSpeed = currentSpeed === 0 ? instantSpeed : (currentSpeed * 0.7 + instantSpeed * 0.3);
                  lastLoaded = evt.loaded;
                  lastTime = now;
                }

                const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
                const remainingBytes = Math.max(0, evt.total - evt.loaded);
                const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

                onProgress(percent, evt.loaded, evt.total, {
                  percent,
                  uploadedBytes: evt.loaded,
                  totalBytes: evt.total,
                  formattedUploaded: formatBytes(evt.loaded),
                  formattedTotal: formatBytes(evt.total),
                  speedBytesPerSec: currentSpeed,
                  formattedSpeed: formatSpeed(currentSpeed),
                  etaSeconds,
                  formattedEta: formatEta(etaSeconds),
                  fileIndex: i + 1,
                  totalFiles,
                  currentFileName: currentFile.name
                });
              }
            };
          }

          xhr.onload = () => {
            if (signal) signal.removeEventListener('abort', abortHandler);
            if (xhr.status === 401) {
              return reject(new Error('UNAUTHORIZED'));
            }
            try {
              const res = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && res.success) {
                resolve(res.data);
              } else {
                reject(new Error(res.message || 'Lỗi tải lên tệp'));
              }
            } catch {
              reject(new Error(`Tải lên thất bại với mã lỗi HTTP ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            if (signal) signal.removeEventListener('abort', abortHandler);
            reject(new Error('Lỗi kết nối mạng trong quá trình tải tệp'));
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
    }, 3);
  }

  /**
   * Creates a new directory
   */
  static async createFolder(parentPath, name) {
    const headers = {
      'Content-Type': 'application/json',
      ...getStorageAuthHeaders()
    };
    const res = await fetch('/api/v1/storage/mkdir', {
      method: 'POST',
      headers,
      body: JSON.stringify({ path: parentPath, name })
    });

    if (res.status === 401) throw new Error('UNAUTHORIZED');
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể tạo thư mục');
    }
    return data.data;
  }

  /**
   * Deletes a file or directory
   */
  static async deleteItem(path) {
    const headers = {
      'Content-Type': 'application/json',
      ...getStorageAuthHeaders()
    };
    const res = await fetch('/api/v1/storage/delete', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ path })
    });

    if (res.status === 401) throw new Error('UNAUTHORIZED');
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể xóa mục');
    }
    return data.data;
  }

  /**
   * Renames a file or directory
   */
  static async renameItem(path, newName) {
    const headers = {
      'Content-Type': 'application/json',
      ...getStorageAuthHeaders()
    };
    const res = await fetch('/api/v1/storage/rename', {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, newName })
    });

    if (res.status === 401) throw new Error('UNAUTHORIZED');
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể đổi tên mục');
    }
    return data.data;
  }

  /**
   * Builds the download / direct view URL with auth token parameter
   */
  static getDownloadUrl(path, inline = false) {
    const token = getAdminToken();
    let url = `/api/v1/storage/download?path=${encodeURIComponent(path)}`;
    if (inline) url += '&inline=true';
    if (token) url += `&auth=${encodeURIComponent(token)}`;
    return url;
  }

  /**
   * Fetches drive statistics
   */
  static async fetchStats() {
    const headers = getStorageAuthHeaders();
    const res = await fetch('/api/v1/storage/stats', { headers });
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    const data = await res.json();
    return data.data;
  }
}
