/**
 * pdfApi - Network upload and job dispatch helpers (< 120 lines)
 */

import { storage } from '../../../../utilities/storage.js';

export async function uploadPdfFiles(files, onProgress, signal) {
  const apiBase = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const uploadedFileIds = [];

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
    }

    const item = files[i];
    if (onProgress) onProgress(i, files.length, item.name, 0);

    const formData = new FormData();
    formData.append('file', item.rawFile);
    formData.append('purpose', 'pdf-convert');

    const fileId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${apiBase}/api/v1/files/upload?purpose=pdf-convert`);

      const onAbort = () => {
        try { xhr.abort(); } catch {}
        reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
      };

      if (signal) {
        if (signal.aborted) {
          return onAbort();
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      const cleanupSignal = () => {
        if (signal) {
          try { signal.removeEventListener('abort', onAbort); } catch {}
        }
      };

      if (xhr.upload && onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && e.total > 0) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(i, files.length, item.name, pct);
          }
        });
      }

      xhr.onload = () => {
        cleanupSignal();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res.data?.fileId);
          } catch (e) {
            reject(new Error(`Lỗi phân tích phản hồi máy chủ: ${e.message}`));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || `Lỗi tải tệp ${item.name}`));
          } catch {
            reject(new Error(`Lỗi tải tệp ${item.name} (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        cleanupSignal();
        if (signal?.aborted) {
          reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
        } else {
          reject(new Error(`Lỗi kết nối khi tải tệp ${item.name}`));
        }
      };

      xhr.onabort = () => {
        cleanupSignal();
        reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
      };

      xhr.send(formData);
    });

    uploadedFileIds.push(fileId);
    if (onProgress) onProgress(i, files.length, item.name, 100);
  }

  return uploadedFileIds;
}

export async function dispatchPdfJob(uploadedFileIds, operation, options, signal) {
  const apiBase = typeof window !== 'undefined' && window.location ? window.location.origin : '';

  const jobRes = await fetch(`${apiBase}/api/v1/jobs/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      fileId: uploadedFileIds[0],
      operation,
      options: {
        ...options,
        fileIds: uploadedFileIds.length > 1 ? uploadedFileIds : undefined
      }
    })
  });

  if (!jobRes.ok) {
    const err = await jobRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Không thể tạo tác vụ xử lý');
  }

  const { data } = await jobRes.json();
  return data;
}

/**
 * Combined upload and job dispatch helper supporting AbortSignal.
 */
export async function uploadPdfJob({ files, operation, options, onProgress, signal }) {
  const uploadedFileIds = await uploadPdfFiles(files, onProgress, signal);
  return dispatchPdfJob(uploadedFileIds, operation, options, signal);
}

export function buildPdfResult(data, mainFile, mode, durationSec, apiBase) {
  const dl = data.downloadUrl || `/api/v1/files/download/${data.resultFileId}`;
  const fullUrl = dl.startsWith('http') ? dl : `${apiBase || ''}${dl}`;
  const baseName = mainFile?.name ? mainFile.name.replace(/\.[^/.]+$/, '') : 'document';
  const isDocx = mode === 'pdf_to_docx';
  const outExt = mode === 'extract_images' ? 'zip' : isDocx ? 'docx' : 'pdf';
  const outFileName = isDocx ? `${baseName}.docx` : `${baseName}_${mode}.${outExt}`;

  const result = {
    fileName: outFileName,
    originalSize: data.originalSizeBytes || mainFile?.size || 0,
    resultSize: data.resultSizeBytes || Math.round((mainFile?.size || 1024) * 0.8),
    savedPct: data.savingsPct || 0,
    duration: `${durationSec}s`,
    downloadUrl: fullUrl,
    resultFileId: data.resultFileId,
    historyId: data.historyId,
    mode: mode
  };

  storage.recordCompletedJob({
    id: data.historyId || `hist_${Date.now()}`,
    tool: 'PDF Studio',
    toolTitle: 'PDF Studio Pro',
    toolId: 'pdf-studio',
    fileName: result.fileName,
    originalSize: result.originalSize,
    resultSize: result.resultSize,
    savedPct: result.savedPct,
    mode: mode,
    status: 'success',
    downloadUrl: fullUrl,
    resultFileId: data.resultFileId
  });

  storage.fetchHistory().catch(() => {});

  return result;
}
