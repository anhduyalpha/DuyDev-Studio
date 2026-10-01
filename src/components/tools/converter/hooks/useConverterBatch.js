/**
 * Converter Batch Engine & Archive Packaging
 * Multi-file concurrency pool, SSE progress tracking, and server ZIP generation.
 */

import { showToast } from '../../../../utilities/toast.js';
import { smartUploadFile } from '../../../../utilities/resumableUploader.js';

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
        showToast(`Chuyển đổi hoàn tất (${done}/${total})`, done === total ? 'success' : 'info');
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

export function startBackgroundUpload(manager, item) {
  if (!item.file || item.fileId || item.uploadStatus === 'uploading' || item.uploadStatus === 'uploaded') {
    return item.uploadPromise || Promise.resolve();
  }

  const abortController = new AbortController();
  item.abortController = abortController;
  item.uploadStatus = 'uploading';
  item.uploadProgress = 0;
  item.uploadError = null;

  const uploadPromise = (async () => {
    try {
      const upData = await smartUploadFile(item.file, {
        purpose: 'universal-converter',
        signal: abortController.signal,
        abortController: abortController,
        onProgress: (p) => {
          if (!abortController.signal.aborted) {
            item.uploadProgress = p.percent || 0;
            manager.notify('upload-progress');
          }
        }
      });
      if (abortController.signal.aborted) return;
      if (!upData?.fileId) {
        throw new Error('Máy chủ không trả về fileId');
      }
      item.fileId = upData.fileId;
      item.uploadStatus = 'uploaded';
      item.uploadProgress = 100;
      item.uploadError = null;
      manager.persist();
      manager.notify('upload-progress');
      return upData;
    } catch (err) {
      if (abortController.signal.aborted) return;
      item.uploadStatus = 'error';
      item.uploadError = err.message || 'Lỗi tải lên ngầm';
      manager.persist();
      manager.notify('upload-progress');
      throw err;
    }
  })();

  item.uploadPromise = uploadPromise;
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

    // 1. Upload if missing fileId
    if (!item.fileId && item.file) {
      // If background upload is still in flight, wait for it
      if (item.uploadPromise && item.uploadStatus === 'uploading') {
        item.stage = 'Đang chờ hoàn tất tải lên ngầm...';
        manager.notify('item-progress');
        try {
          await item.uploadPromise;
        } catch (_) {}
      }

      // If still missing fileId (e.g. background upload error or not started), perform direct upload
      if (!item.fileId) {
        const abortController = new AbortController();
        item.abortController = abortController;
        item.uploadStatus = 'uploading';
        manager.notify('upload-progress');
        const upData = await smartUploadFile(item.file, {
          purpose: 'universal-converter',
          signal: abortController.signal,
          abortController: abortController,
          onStage: (stage) => {
            item.stage = stage;
            manager.notify('item-progress');
          },
          onProgress: (p) => {
            item.progress = Math.min(40, Math.round(p.percent * 0.4));
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

    // 1.1 Final verification of fileId before creating job
    if (!item.fileId) {
      throw new Error('Không thể xác thực mã tệp trên máy chủ (fileId missing)');
    }

    // 2. Enqueue conversion job
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

    // 3. Listen to SSE events
    await new Promise((res, rej) => {
      const es = new EventSource(eventsUrl);
      item.eventSource = es;

      es.addEventListener('progress', (e) => {
        try {
          const d = JSON.parse(e.data);
          item.progress = d.percentage || d.progress || item.progress;
          item.stage = d.stage || `Đang xử lý ${item.progress}%`;
          manager.notify('item-progress');
        } catch {}
      });

      es.addEventListener('completed', (e) => {
        es.close();
        item.eventSource = null;
        try {
          const d = JSON.parse(e.data);
          const origSize = item.detectedMeta?.size || d.originalSizeBytes || 1024;
          const resSize = d.resultSizeBytes || Math.round(origSize * 0.7);
          const idx = manager.items.indexOf(item);
          const finalName = computeRenamedName(item.file?.name, item.targetFormat, idx, manager.renamePattern);

          item.status = 'completed';
          item.progress = 100;
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
        } catch (err) { rej(err); }
      });

      es.addEventListener('failed', (e) => {
        es.close();
        item.eventSource = null;
        try {
          const d = JSON.parse(e.data);
          rej(new Error(d.error || 'Xử lý chuyển đổi thất bại'));
        } catch {
          rej(new Error('Xử lý chuyển đổi thất bại'));
        }
      });

      es.onerror = () => {
        es.close();
        item.eventSource = null;
        rej(new Error('Mất kết nối với worker SSE'));
      };
    });
  } catch (err) {
    item.status = 'error';
    item.error = err.message || 'Chuyển đổi thất bại';
    manager.persist();
    manager.notify('item-error');
  }
}

export async function createZipBundleFromCompleted(manager) {
  const completed = manager.items.filter(it => it.status === 'completed' && it.result?.fileId);
  if (completed.length === 0) {
    showToast('Không có tệp đã hoàn tất để tạo ZIP', 'warning');
    return;
  }

  const fileIds = completed.map(it => it.result.fileId);
  const dateStr = new Date().toISOString().slice(0, 10);
  const archiveName = `FileConverter_${dateStr}.zip`;

  showToast('Đang nén tệp ZIP...', 'info');

  try {
    const res = await fetch('/api/v1/archive/compress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileIds,
        archiveName,
        format: 'zip',
        compressionLevel: 6
      })
    });

    if (!res.ok) throw new Error(`Lỗi nén tệp (${res.status})`);
    const body = await res.json();
    const downloadUrl = body.data?.downloadUrl;
    if (!downloadUrl) throw new Error('Không có link tải ZIP');

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = archiveName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Đang tải tệp ZIP', 'success');
  } catch (err) {
    showToast(err.message || 'Không thể tạo tệp ZIP', 'error');
  }
}
