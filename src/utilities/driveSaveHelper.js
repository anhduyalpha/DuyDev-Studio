/**
 * driveSaveHelper.js - Universal Auth-Gated Save to Studio Drive Helper
 * Prompts admin authorization when needed and persists artifacts to Studio Drive.
 */

import { isAdminAuthenticated, getStorageAuthHeaders, requireAdmin, lockAdminSession } from './adminAuth.js';
import { showToast } from './toast.js';

/**
 * Saves an artifact (either via backend fileId copy or client Blob upload) to Studio Drive.
 * Automatically checks admin authentication, prompts PIN modal if locked,
 * and handles token expiration retry safely.
 *
 * @param {Object} options
 * @param {string} [options.fileId] - Backend temporary file ID
 * @param {Blob|File} [options.blob] - Client-side generated Blob/File
 * @param {string} options.fileName - Destination filename
 * @param {string} options.targetFolder - Destination folder (e.g. '/pdf', '/converted', '/archives', '/images', '/documents')
 * @param {Object} [options.metadata] - Optional custom sidecar metadata
 * @param {boolean} [options.overwrite=false] - Whether to overwrite existing file
 * @param {Function} [options.onUnlockRequired] - Optional callback when unlock modal is shown
 * @param {boolean} [_isRetry=false] - Internal single-retry guard
 * @returns {Promise<{ success: boolean, data?: { path: string, name: string, sizeBytes: number }, error?: string }>}
 */
export async function saveArtifactToDrive({
  fileId,
  blob,
  fileName,
  targetFolder,
  metadata = {},
  overwrite = false,
  onUnlockRequired,
  _isRetry = false
} = {}) {
  // If not authenticated, prompt admin unlock modal first
  if (!isAdminAuthenticated()) {
    if (typeof onUnlockRequired === 'function') {
      try { onUnlockRequired(); } catch {}
    }
    return new Promise((resolve) => {
      requireAdmin(async () => {
        const result = await saveArtifactToDrive({
          fileId,
          blob,
          fileName,
          targetFolder,
          metadata,
          overwrite,
          _isRetry: true
        });
        resolve(result);
      }, 'Nhập mật khẩu Quản trị viên để lưu tệp vào Kho lưu trữ Drive.');
    });
  }

  try {
    let response;
    const headers = getStorageAuthHeaders();

    if (blob) {
      const formData = new FormData();
      formData.append('targetFolder', targetFolder);
      if (fileName) formData.append('fileName', fileName);
      if (overwrite) formData.append('overwrite', 'true');
      if (metadata && Object.keys(metadata).length > 0) {
        formData.append('metadata', JSON.stringify(metadata));
      }
      formData.append('file', blob, fileName || 'artifact');

      response = await fetch('/api/v1/storage/save-artifact', {
        method: 'POST',
        headers,
        body: formData
      });
    } else if (fileId) {
      headers['Content-Type'] = 'application/json';
      response = await fetch('/api/v1/storage/save-artifact', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileId,
          targetFolder,
          fileName,
          overwrite,
          metadata
        })
      });
    } else {
      showToast('Không có dữ liệu tệp để lưu', 'error');
      return { success: false, error: 'NO_FILE_SPECIFIED' };
    }

    if (response.status === 401 && !_isRetry) {
      lockAdminSession();
      return new Promise((resolve) => {
        requireAdmin(async () => {
          const retryResult = await saveArtifactToDrive({
            fileId,
            blob,
            fileName,
            targetFolder,
            metadata,
            overwrite,
            _isRetry: true
          });
          resolve(retryResult);
        }, 'Phiên xác thực đã hết hạn. Vui lòng nhập mật khẩu Quản trị viên để tiếp tục.');
      });
    }

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data.message || data.error || 'Lưu tệp vào Drive thất bại';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    }

    const savedPath = data.data?.path || `${targetFolder}/${fileName}`;
    showToast(`Đã lưu vào Drive: ${savedPath}`, 'success');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ds:artifact-saved-to-drive', {
        detail: { path: savedPath, fileId, data: data.data }
      }));
    }

    return { success: true, data: data.data };
  } catch (err) {
    const message = err?.message || 'Không thể kết nối đến máy chủ';
    showToast(message, 'error');
    return { success: false, error: message };
  }
}
