/**
 * useArchiveCompress - Manages multi-file uploads via ResumableUploader and archive generation (< 100 lines)
 */

import { ResumableUploader } from '../../../../utilities/resumableUploader.js';

export async function compressFilesToServer(files, options, onStage, onProgress) {
  const apiBase = window.location.origin;
  const fileIds = [];

  // Step 1: Upload each file in the batch via ResumableUploader
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rawFile = f.rawFile || f;
    if (onStage) {
      onStage(`Đang truyền tệp (${i + 1}/${files.length}): ${f.name}`);
    }

    const uploader = new ResumableUploader(rawFile, {
      purpose: 'archive-compress',
      onStage: (st) => onStage && onStage(`[${i + 1}/${files.length}] ${st}`),
      onProgress: (p) => {
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

    const uploadRes = await uploader.start();
    if (!uploadRes?.fileId) throw new Error(`Tải tệp '${f.name}' thất bại`);
    fileIds.push(uploadRes.fileId);
  }

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
