/**
 * pdfApi - Network upload and job dispatch helpers (< 120 lines)
 */

import { storage } from '../../../../utilities/storage.js';
import { smartUploadFile } from '../../../../utilities/resumableUploader.js';

/**
 * Uploads PDF files concurrently with smart chunking (> 50MB) and eager upload reuse.
 */
export async function uploadPdfFiles(files, onProgress, signal) {
  const uploadedFileIds = new Array(files.length);
  const concurrency = Math.min(3, files.length);
  let activeIndex = 0;

  const uploadSingle = async (idx) => {
    const item = files[idx];
    if (signal?.aborted) {
      throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
    }

    // Fast-path: Already uploaded by Background Eager Upload
    if (item.fileId) {
      uploadedFileIds[idx] = item.fileId;
      if (onProgress) onProgress(idx, files.length, item.name, 100);
      return item.fileId;
    }

    // In-flight eager upload: wait for ongoing promise
    if (item.uploadPromise) {
      try {
        const id = await item.uploadPromise;
        if (id) {
          uploadedFileIds[idx] = id;
          if (onProgress) onProgress(idx, files.length, item.name, 100);
          return id;
        }
      } catch (_) {}
    }

    const targetBlob = item.rawFile || item;
    if (onProgress) onProgress(idx, files.length, item.name, 0);
    let res;
    try {
      res = await smartUploadFile(targetBlob, {
        purpose: 'pdf-convert',
        signal,
        onProgress: (p) => {
          if (onProgress) onProgress(idx, files.length, item.name, p.percent);
        }
      });
    } catch (uploadErr) {
      if (signal?.aborted || uploadErr?.name === 'AbortError' || uploadErr?.message?.toLowerCase().includes('abort')) {
        throw new DOMException('Tác vụ tải tệp đã bị hủy', 'AbortError');
      }
      throw uploadErr;
    }

    const fileId = res?.fileId || res?.id;
    if (!fileId) throw new Error(`Không nhận được fileId khi tải tệp ${item.name}`);

    item.fileId = fileId;
    item.uploadStatus = 'uploaded';
    uploadedFileIds[idx] = fileId;
    if (onProgress) onProgress(idx, files.length, item.name, 100);
    return fileId;
  };

  const pool = Array.from({ length: concurrency }, async () => {
    while (activeIndex < files.length) {
      const idx = activeIndex++;
      await uploadSingle(idx);
    }
  });

  await Promise.all(pool);
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

/**
 * Builds result object and logs history for instant client-side processed PDF tasks.
 */
export function buildClientPdfResult(blob, mainFile, mode, durationSec) {
  const localUrl = URL.createObjectURL(blob);
  const baseName = mainFile?.name ? mainFile.name.replace(/\.[^/.]+$/, '') : 'document';
  const outFileName = `${baseName}_${mode}.pdf`;

  const result = {
    fileName: outFileName,
    originalSize: mainFile?.size || blob.size,
    resultSize: blob.size,
    savedPct: 0,
    duration: `${durationSec}s`,
    downloadUrl: localUrl,
    resultFileId: null,
    historyId: `hist_client_${Date.now()}`,
    mode: mode,
    isClientProcessed: true
  };

  storage.recordCompletedJob({
    id: result.historyId,
    tool: 'PDF Studio',
    toolTitle: 'PDF Studio Pro',
    toolId: 'pdf-studio',
    fileName: result.fileName,
    originalSize: result.originalSize,
    resultSize: result.resultSize,
    savedPct: 0,
    mode: mode,
    status: 'success',
    downloadUrl: localUrl,
    resultFileId: null
  });

  return result;
}
