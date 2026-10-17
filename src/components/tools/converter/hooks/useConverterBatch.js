/**
 * Converter Batch Engine & Archive Packaging
 * Multi-file concurrency pool, Dual-Channel Watcher tracking, Client Fast-Path, and ZIP generation.
 */

import { showToast } from '../../../../utilities/toast.js';
import { smartUploadFile } from '../../../../utilities/resumableUploader.js';
import { canConvertClientSide, convertClientSide } from '../services/clientConverterEngine.js';
import { watchJobProgress } from '../../../../utilities/jobWatcher.js';

export function computeRenamedName(rawName, targetExt, idx, pattern = {}) {
  const base = (rawName || 'file').replace(/\.[^/.]+$/, '');
  const prefix = pattern.prefix || '';
  const suffix = pattern.suffix || '';
  const numStr = pattern.numbering ? `_${String(idx + 1).padStart(2, '0')}` : '';
  const cleanExt = (targetExt || 'bin').toLowerCase().replace(/^\./, '');
  return `${prefix}${base}${suffix}${numStr}.${cleanExt}`;
}

export async function runConcurrentQueue(manager, maxConcurrency = 3) {
  const pendingItems = manager.items.filter(it => it.status === 'idle' || it.status === 'ready' || it.status === 'retry');
  if (pendingItems.length === 0) return;

  manager.isConverting = true;
  manager.notify('batch-started');

  let activeCount = 0;
  let cursor = 0;

  return new Promise((resolve) => {
    function dispatchNext() {
      if (cursor >= pendingItems.length && activeCount === 0) {
        manager.isConverting = false;
        manager.persist();
        manager.notify('batch-completed');

        const done = manager.items.filter(i => i.status === 'completed').length;
        const total = manager.items.length;
        const failed = manager.items.filter(i => i.status === 'error').length;

        if (done === total && total > 0) {
          showToast(`Chuyển đổi hoàn tất (${done}/${total})`, 'success');
        } else if (done > 0 && done < total) {
          showToast(`Hoàn tất ${done}/${total} tệp (${failed} tệp lỗi)`, 'warning');
        } else if (done === 0 && total > 0) {
          const firstErr = manager.items.find(i => i.error)?.error || 'Đã xảy ra lỗi khi chuyển đổi';
          showToast(`Chuyển đổi thất bại: ${firstErr}`, 'error');
        }
        return resolve();
      }

      while (activeCount < maxConcurrency && cursor < pendingItems.length) {
        const item = pendingItems[cursor++];
        activeCount++;
        processSingleItem(manager, item).finally(() => {
          activeCount--;
          dispatchNext();
        });
      }
    }

    dispatchNext();
  });
}

const bgUploadQueue = [];
let activeBgUploads = 0;
const MAX_BG_UPLOAD_CONCURRENCY = 3;

function pumpBgUploadQueue(manager) {
  while (activeBgUploads < MAX_BG_UPLOAD_CONCURRENCY && bgUploadQueue.length > 0) {
    const task = bgUploadQueue.shift();
    activeBgUploads++;
    task.fn().finally(() => {
      activeBgUploads--;
      pumpBgUploadQueue(manager);
    });
  }
}

export function startBackgroundUpload(manager, item) {
  if (!item.file || item.fileId || item.uploadStatus === 'uploading' || item.uploadStatus === 'uploaded') {
    return item.uploadPromise || Promise.resolve();
  }

  if (item.uploadPromise) {
    return item.uploadPromise;
  }

  const abortController = new AbortController();
  item.abortController = abortController;
  item.uploadStatus = 'idle';
  item.uploadProgress = 0;
  item.uploadError = null;

  let resolveUpload, rejectUpload;
  const uploadPromise = new Promise((resolve, reject) => {
    resolveUpload = resolve;
    rejectUpload = reject;
  });
  item.uploadPromise = uploadPromise;

  const executeUpload = async () => {
    if (abortController.signal.aborted) {
      resolveUpload();
      return;
    }
    if (item.fileId) {
      resolveUpload({ fileId: item.fileId });
      return;
    }
    item.uploadStatus = 'uploading';
    manager.notify('upload-progress');

    try {
      const upData = await smartUploadFile(item.file, {
        purpose: 'universal-converter',
        presignData: item.presignData,
        signal: abortController.signal,
        abortController: abortController,
        onProgress: (p) => {
          if (!abortController.signal.aborted) {
            item.uploadProgress = p.percent || 0;
            manager.notify('upload-progress');
          }
        }
      });
      if (abortController.signal.aborted) {
        resolveUpload();
        return;
      }
      if (!upData?.fileId) {
        throw new Error('Máy chủ không trả về mã tệp (fileId)');
      }
      item.fileId = upData.fileId;
      item.uploadStatus = 'uploaded';
      item.uploadProgress = 100;
      item.uploadError = null;
      manager.persist();
      manager.notify('upload-progress');
      resolveUpload(upData);
    } catch (err) {
      if (abortController.signal.aborted) {
        resolveUpload();
        return;
      }
      item.uploadStatus = 'error';
      item.uploadError = err.message || 'Lỗi tải lên ngầm';
      manager.persist();
      manager.notify('upload-progress');
      rejectUpload(err);
    }
  };

  bgUploadQueue.push({ fn: executeUpload });
  pumpBgUploadQueue(manager);

  return uploadPromise;
}

export async function processSingleItem(manager, item) {
  try {
    item.status = 'converting';
    item.progress = 5;
    item.stage = 'Đang khởi tạo chuyển đổi...';
    manager.notify('item-progress');

    // 0. Hard guard: Ensure we have either fileId or file
    if (!item.fileId && !item.file) {
      throw new Error('Tệp chưa được tải lên máy chủ hoặc phiên làm việc đã hết hạn. Vui lòng nạp lại tệp.');
    }

    // 1. Client-Side Fast-Path Check (< 200ms, 0ms upload)
    if (canConvertClientSide(item, manager.options)) {
      try {
        item.progress = 20;
        item.stage = 'Đang chuyển đổi tức thì trên trình duyệt...';
        manager.notify('item-progress');

        const clientResult = await convertClientSide(item, manager.options);
        const idx = manager.items.indexOf(item);
        const finalName = computeRenamedName(item.file?.name, item.targetFormat, idx, manager.renamePattern);
        const downloadUrl = URL.createObjectURL(clientResult.blob);

        item.status = 'completed';
        item.progress = 100;
        item.stage = 'Hoàn tất';
        item.result = {
          fileId: null,
          clientBlob: clientResult.blob,
          fileName: finalName,
          originalSize: item.file?.size || clientResult.size,
          resultSize: clientResult.size,
          downloadUrl
        };
        manager.persist();
        manager.notify('item-completed');
        return;
      } catch (clientErr) {
        console.warn('[Converter] Client fast-path fallback to server:', clientErr);
        // Fall through to server worker seamlessly!
      }
    }

    // 2. Server Worker Path: Ensure file is uploaded
    if (!item.fileId && item.file) {
      // If background upload is still in flight, wait for it with visual feedback
      if (item.uploadPromise && !item.fileId) {
        item.stage = `Đang chờ tải lên máy chủ (${item.uploadProgress || 0}%)...`;
        manager.notify('item-progress');
        try {
          await item.uploadPromise;
        } catch (_) {}
      }

      // If still missing fileId, perform direct foreground upload
      if (!item.fileId) {
        const abortController = new AbortController();
        item.abortController = abortController;
        item.uploadStatus = 'uploading';
        manager.notify('upload-progress');

        const upData = await smartUploadFile(item.file, {
          purpose: 'universal-converter',
          presignData: item.presignData,
          signal: abortController.signal,
          abortController: abortController,
          onStage: (stage) => {
            item.stage = stage;
            manager.notify('item-progress');
          },
          onProgress: (p) => {
            item.progress = Math.min(30, Math.round(p.percent * 0.3));
            item.uploadProgress = p.percent || 0;
            item.stage = `Đang tải lên ${p.percent}%...`;
            manager.notify('item-progress');
            manager.notify('upload-progress');
          }
        });
        if (!upData?.fileId) {
          throw new Error('Tải lên thất bại: không nhận được mã tệp (fileId)');
        }
        item.fileId = upData.fileId;
        item.uploadStatus = 'uploaded';
        item.uploadProgress = 100;
        item.uploadError = null;
        manager.persist();
        manager.notify('upload-progress');
      }
    }

    // Final verification of fileId before creating job
    if (!item.fileId) {
      throw new Error('Không thể xác thực mã tệp trên máy chủ (fileId missing)');
    }

    // 3. Enqueue conversion job
    item.stage = 'Đang gửi tác vụ tới worker...';
    manager.notify('item-progress');

    const jobRes = await fetch('/api/v1/converter/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: item.fileId, targetFormat: item.targetFormat, options: manager.options })
    });
    if (!jobRes.ok) {
      const errBody = await jobRes.json().catch(() => null);
      throw new Error(errBody?.error?.message || errBody?.message || `Khởi tạo job thất bại (${jobRes.status})`);
    }
    const jobData = await jobRes.json();
    item.jobId = jobData.data?.jobId;
    const eventsUrl = jobData.data?.eventsUrl || `/api/v1/jobs/${item.jobId}/events`;

    // 4. Dual-Channel Watcher (SSE streaming + instant poll + fallback polling)
    await new Promise((res, rej) => {
      const cleanupWatcher = watchJobProgress({
        apiBase: '',
        eventsUrl,
        pollUrl: `/api/v1/jobs/${item.jobId}`,
        onProgress: (pct, stage) => {
          item.progress = pct || item.progress;
          item.stage = stage || `Đang xử lý ${item.progress}%`;
          manager.notify('item-progress');
        },
        onCompleted: (d) => {
          const origSize = item.detectedMeta?.size || d.originalSizeBytes || 1024;
          const resSize = d.resultSizeBytes || Math.round(origSize * 0.7);
          const idx = manager.items.indexOf(item);
          const serverExt = (d.resultFileName || '').split('.').pop()?.toLowerCase();
          const effectiveExt = (serverExt === 'zip' || d.isZip) ? 'zip' : item.targetFormat;
          const finalName = computeRenamedName(item.file?.name, effectiveExt, idx, manager.renamePattern);

          item.status = 'completed';
          item.progress = 100;
          item.stage = 'Hoàn tất';
          item.result = {
            fileId: d.resultFileId || item.fileId,
            fileName: finalName,
            originalSize: origSize,
            resultSize: resSize,
            downloadUrl: d.downloadUrl || `/api/v1/files/download/${d.resultFileId || item.fileId}`
          };
          manager.persist();
          manager.notify('item-completed');
          res();
        },
        onFailed: (errMsg) => {
          rej(new Error(errMsg || 'Xử lý chuyển đổi thất bại'));
        }
      });

      item.abortController = { abort: cleanupWatcher };
    });
  } catch (err) {
    item.status = 'error';
    item.error = err.message || 'Chuyển đổi thất bại';
    item.stage = item.error;
    manager.persist();
    manager.notify('item-error');
  }
}

async function ensureJsZipLoaded() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './src/vendor/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('Không thể tải thư viện JSZip'));
    document.head.appendChild(s);
  });
}

export async function createZipBundleFromCompleted(manager) {
  const completed = manager.items.filter(it => it.status === 'completed' && it.result);
  if (completed.length === 0) {
    showToast('Không có tệp đã hoàn tất để tạo ZIP', 'warning');
    return;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const archiveName = `FileConverter_${dateStr}.zip`;

  showToast('Đang nén tệp ZIP...', 'info');

  const bundleWithJsZip = async () => {
    const JSZip = await ensureJsZipLoaded();
    const zip = new JSZip();

    for (const it of completed) {
      let blob = it.result.clientBlob;
      if (!blob && it.result.downloadUrl) {
        try {
          const resp = await fetch(it.result.downloadUrl);
          if (resp.ok) {
            blob = await resp.blob();
          }
        } catch (fetchErr) {
          console.warn('[Converter] Failed to fetch item blob for ZIP:', fetchErr);
        }
      }
      if (blob) {
        zip.file(it.result.fileName, blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const downloadUrl = URL.createObjectURL(zipBlob);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = archiveName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Đang tải tệp ZIP', 'success');
  };

  try {
    const hasClientBlobs = completed.some(it => !it.result?.fileId || it.result?.clientBlob);

    if (hasClientBlobs) {
      await bundleWithJsZip();
      return;
    }

    // Pure server files: use server compressor
    const fileIds = completed.map(it => it.result.fileId).filter(Boolean);
    if (fileIds.length === 0) {
      await bundleWithJsZip();
      return;
    }

    const res = await fetch('/api/v1/archive/compress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileIds,
        archiveName,
        format: 'zip',
        compressionLevel: 'normal'
      })
    });

    if (!res.ok) {
      console.warn(`[Converter] Server compressor returned ${res.status}, falling back to JSZip client compression`);
      await bundleWithJsZip();
      return;
    }

    const body = await res.json();
    const downloadUrl = body.data?.downloadUrl;
    if (!downloadUrl) {
      console.warn('[Converter] Missing downloadUrl from server compressor, falling back to JSZip');
      await bundleWithJsZip();
      return;
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = archiveName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Đang tải tệp ZIP', 'success');
  } catch (err) {
    console.warn('[Converter] Error creating ZIP bundle, trying client fallback:', err);
    try {
      await bundleWithJsZip();
    } catch (fallbackErr) {
      showToast(fallbackErr.message || 'Không thể tạo tệp ZIP', 'error');
    }
  }
}
