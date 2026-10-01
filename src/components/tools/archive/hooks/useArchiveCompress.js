/**
 * useArchiveCompress - Manages multi-file uploads via ResumableUploader and archive generation (< 100 lines)
 */

import { smartUploadFile, poolAll } from '../../../../utilities/resumableUploader.js';

export async function compressFilesToServer(files, options, onStage, onProgress) {
  const apiBase = window.location.origin;

  if (onStage) {
    onStage(`Đang tải lên song song ${files.length} tệp tin...`);
  }

  const fileProgressMap = new Map();

  // Step 1: Upload files concurrently via bounded poolAll
  const fileIds = await poolAll(files, async (f, i) => {
    const rawFile = f.rawFile || f;
    const uploadRes = await smartUploadFile(rawFile, {
      purpose: 'archive-compress',
      thresholdBytes: 50 * 1024 * 1024,
      onStage: (st) => onStage && onStage(`[${i + 1}/${files.length}] ${st}`),
      onProgress: (p) => {
        fileProgressMap.set(i, p.percent || 0);
        if (onProgress) {
          onProgress({
            ...p,
            currentFileIndex: i,
            totalFiles: files.length,
            fileName: f.name
          });
        }
      }
    });

    if (!uploadRes?.fileId) throw new Error(`Tải tệp '${f.name}' thất bại`);
    return uploadRes.fileId;
  }, 3);

  // Step 2: Trigger backend archive creation
  if (onStage) onStage('Đang đóng gói và nén tệp tin...');

  const compressRes = await fetch(`${apiBase}/api/v1/archive/compress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileIds,
      archiveName: options.archiveName || 'archive.zip',
      format: options.format || 'zip',
      compressionLevel: options.compressionLevel || 'normal'
    })
  });

  if (!compressRes.ok) {
    const errJson = await compressRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Nén tệp tin thất bại (${compressRes.status})`);
  }

  const compressData = await compressRes.json();
  const res = compressData.data;

  const downloadUrl = res.downloadUrl.startsWith('http')
    ? res.downloadUrl
    : `${apiBase}${res.downloadUrl}`;

  return { ...res, downloadUrl };
}
