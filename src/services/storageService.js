/**
 * storageService.js - Client API Service for CasaOS Files Storage
 * Handles directory listing, progress-tracked file uploads, folder creation, deletion, and renaming.
 * Supports multi-gigabyte uploads (100MB - 10GB+) via ResumableUploader.
 */

import { getStorageAuthHeaders } from '../utilities/adminAuth.js';
import { smartUploadFile, poolAll } from '../utilities/resumableUploader.js';

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
   * Transparently uses Cloudflare R2 Transit Pipe on WAN or Gigabit direct streaming on LAN via smartUploadFile.
   * Executes multi-file uploads concurrently via bounded poolAll (concurrency = 3).
   */
  static async uploadFiles(files, targetPath = '/', onProgress = null, options = {}) {
    const fileList = Array.from(files);
    const totalFiles = fileList.length;

    return poolAll(fileList, async (currentFile, i) => {
      if (typeof options.onStage === 'function') {
        options.onStage(`Đang tải lên ${currentFile.name}...`, i + 1, totalFiles, currentFile);
      }

      return await smartUploadFile(currentFile, {
        purpose: 'storage-drive',
        targetDir: targetPath,
        headers: getStorageAuthHeaders(),
        signal: options.signal,
        onStage: (stage) => {
          if (typeof options.onStage === 'function') {
            options.onStage(stage, i + 1, totalFiles, currentFile);
          }
        },
        onUploaderCreated: (uploader) => {
          if (typeof options.onUploaderCreated === 'function') {
            options.onUploaderCreated(uploader, currentFile, i + 1, totalFiles);
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
