/**
 * useArchiveInspect Hook & Helper (< 150 lines)
 * Manages zero-extraction archive inspection via ResumableUploader
 */

import { smartUploadFile } from '../../../../utilities/resumableUploader.js';
import { extractFolders, getFilesInFolder } from './archiveTreeHelper.js';

export async function inspectArchiveFile(file, options = {}) {
  const { onProgress, onStage, existingUploadId, existingUploadedChunks } = options;
  const apiBase = window.location.origin;

  if (onStage) onStage('Đang tải tệp nén lên máy chủ...');

  // Step 1: Upload file using smartUploadFile (direct stream for <= 50MB, resumable for > 50MB)
  const uploadResult = await smartUploadFile(file, {
    purpose: 'archive-inspect',
    thresholdBytes: 50 * 1024 * 1024,
    existingUploadId,
    existingUploadedChunks,
    onProgress,
    onStage,
    onUploaderCreated: options.onUploaderCreated,
    signal: options.signal
  });

  if (!uploadResult?.fileId) throw new Error('Không nhận được fileId sau khi tải lên');

  // Step 2: Request zero-extraction structural inspection
  if (onStage) onStage('Đang phân tích cấu trúc tệp nén...');

  const inspectRes = await fetch(`${apiBase}/api/v1/archive/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: uploadResult.fileId })
  });

  if (!inspectRes.ok) {
    const errJson = await inspectRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Không thể phân tích file nén (${inspectRes.status})`);
  }

  const inspected = (await inspectRes.json()).data;

  return {
    fileId: uploadResult.fileId,
    archiveName: file?.name || uploadResult?.originalName || inspected.archiveName,
    totalFiles: inspected.totalFiles,
    totalUncompressedBytes: inspected.totalUncompressedBytes,
    totalCompressedBytes: inspected.totalCompressedBytes,
    format: inspected.format,
    allEntries: inspected.tree,
    folders: extractFolders(inspected.tree),
    currentFiles: getFilesInFolder(inspected.tree, '/'),
    downloadUrl: `${apiBase}/api/v1/files/download/${uploadResult.fileId}`,
    apiBase
  };
}

export async function inspectNestedArchiveFile(parentFileId, memberPath, apiBase) {
  const res = await fetch(`${apiBase}/api/v1/archive/inspect-nested`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentFileId, memberPath })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Không thể phân tích file nén con (${res.status})`);
  }

  const inspected = (await res.json()).data;

  return {
    fileId: inspected.fileId,
    nestedName: inspected.nestedName,
    totalFiles: inspected.totalFiles,
    totalUncompressedBytes: inspected.totalUncompressedBytes,
    totalCompressedBytes: inspected.totalCompressedBytes,
    format: inspected.format,
    allEntries: inspected.tree,
    folders: extractFolders(inspected.tree),
    currentFiles: getFilesInFolder(inspected.tree, '/'),
    downloadUrl: `${apiBase}/api/v1/files/download/${inspected.fileId}`,
    apiBase
  };
}
