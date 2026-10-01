/**
 * pdfApi - Network upload and job dispatch helpers (< 120 lines)
 */

import { storage } from '../../../../utilities/storage.js';
import { poolAll, smartUploadFile } from '../../../../utilities/resumableUploader.js';

export async function uploadPdfFiles(files, onProgress, signal) {
  if (signal?.aborted) {
    throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
  }

  const fileProgressMap = new Map();

  return poolAll(files, async (item, idx) => {
    if (signal?.aborted) {
      throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
    }

    // 1. If already uploaded via background eager upload, return existing fileId
    if (item.fileId) {
      fileProgressMap.set(idx, 100);
      if (onProgress) onProgress(idx, files.length, item.name, 100);
      return item.fileId;
    }

    // 2. If eager upload is currently in flight, await it
    if (item.uploadPromise) {
      try {
        item.onEagerProgress = (p) => {
          const pct = p.percent || 0;
          fileProgressMap.set(idx, pct);
          if (onProgress) onProgress(idx, files.length, item.name, pct);
        };

        let abortListener;
        const res = await Promise.race([
          item.uploadPromise,
          new Promise((_, reject) => {
            if (signal?.aborted) {
              return reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
            }
            if (signal) {
              abortListener = () => {
                try { item.abortController?.abort(); } catch {}
                reject(new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError'));
              };
              signal.addEventListener('abort', abortListener, { once: true });
            }
          })
        ]).finally(() => {
          item.onEagerProgress = null;
          if (signal && abortListener) {
            signal.removeEventListener('abort', abortListener);
          }
        });

        const fid = res?.fileId || item.fileId;
        if (fid) {
          fileProgressMap.set(idx, 100);
          if (onProgress) onProgress(idx, files.length, item.name, 100);
          return fid;
        }
      } catch (err) {
        if (signal?.aborted || err?.name === 'AbortError') {
          throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
        }
        // If eager upload failed or was cancelled, continue to direct retry below
      }
    }

    // 3. Parallel upload with smartUploadFile
    fileProgressMap.set(idx, 0);
    if (onProgress) onProgress(idx, files.length, item.name, 0);

    let res;
    try {
      res = await smartUploadFile(item.rawFile || item, {
        purpose: 'pdf-convert',
        signal,
        onProgress: (p) => {
          const pct = p.percent || 0;
          fileProgressMap.set(idx, pct);
          if (onProgress) onProgress(idx, files.length, item.name, pct);
        }
      });
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') {
        throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
      }
      throw err;
    }

    item.fileId = res.fileId;
    item.uploadStatus = 'uploaded';
    item.uploadProgress = 100;
    fileProgressMap.set(idx, 100);
    if (onProgress) onProgress(idx, files.length, item.name, 100);

    return res.fileId;
  }, 3);
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
