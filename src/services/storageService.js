/**
 * storageService.js - Client API Service for CasaOS Files Storage
 * Handles directory listing, progress-tracked file uploads, folder creation, deletion, and renaming.
 * Supports multi-gigabyte uploads (100MB - 10GB+) via ResumableUploader.
 */

import { getStorageAuthHeaders, getAdminToken } from '../utilities/adminAuth.js';
import { ResumableUploader, formatBytes } from '../utilities/resumableUploader.js';

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
   * Transparently uses ResumableUploader (> 25MB up to 10GB+) or direct multipart (<= 25MB).
   */
  static async uploadFiles(files, targetPath = '/', onProgress = null, options = {}) {
    const fileList = Array.from(files);
    const uploadedResults = [];
    const totalFiles = fileList.length;

    for (let i = 0; i < totalFiles; i++) {
      const currentFile = fileList[i];
      const isLarge = currentFile.size > 25 * 1024 * 1024;

      if (isLarge) {
        // Multi-part adaptive chunked upload for large files (100MB - 10GB+)
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

        const result = await uploader.start();
        uploadedResults.push(result);
      } else {
        // Direct single-request upload for small files (<= 25MB)
        if (typeof options.onStage === 'function') {
          options.onStage(`Đang tải lên ${currentFile.name}...`, i + 1, totalFiles, currentFile);
        }

        const result = await new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', currentFile);

          const xhr = new XMLHttpRequest();
          const url = `/api/v1/storage/upload?path=${encodeURIComponent(targetPath)}`;
          xhr.open('POST', url);

          const token = getAdminToken();
          if (token) {
            xhr.setRequestHeader('x-storage-auth', token);
          }

          if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.round((evt.loaded / evt.total) * 100);
                onProgress(percent, evt.loaded, evt.total, {
                  percent,
                  uploadedBytes: evt.loaded,
                  totalBytes: evt.total,
                  formattedUploaded: formatBytes(evt.loaded),
                  formattedTotal: formatBytes(evt.total),
                  speedBytesPerSec: 0,
                  formattedSpeed: '',
                  etaSeconds: 0,
                  formattedEta: '',
                  fileIndex: i + 1,
                  totalFiles,
                  currentFileName: currentFile.name
                });
              }
            };
          }

          xhr.onload = () => {
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
            reject(new Error('Lỗi kết nối mạng trong quá trình tải tệp'));
          };

          xhr.send(formData);
        });

        uploadedResults.push(result);
      }
    }

    return uploadedResults;
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
