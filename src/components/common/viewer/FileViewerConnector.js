/**
 * FileViewerConnector (< 250 lines)
 * Pluggable Adapter for DD Studio Universal File Viewer Core
 * Normalizes items from any module (History, Trash, Converter, Archive, MediaStudio, QR, Storage)
 */

import { openFileViewer, FILE_CATEGORIES } from './FileViewerCore.js';
import { StorageService } from '../../../services/storageService.js';
import { getAdminToken } from '../../../utilities/adminAuth.js';

export { FILE_CATEGORIES };

const SERVER_CONVERTED_EXTS = ['doc', 'dot', 'odt', 'rtf', 'ppt', 'pptx', 'odp'];

const EXT_MAP = {
  // Images
  jpg: FILE_CATEGORIES.IMAGE, jpeg: FILE_CATEGORIES.IMAGE, png: FILE_CATEGORIES.IMAGE,
  webp: FILE_CATEGORIES.IMAGE, avif: FILE_CATEGORIES.IMAGE, gif: FILE_CATEGORIES.IMAGE,
  svg: FILE_CATEGORIES.IMAGE, bmp: FILE_CATEGORIES.IMAGE, ico: FILE_CATEGORIES.IMAGE,
  tiff: FILE_CATEGORIES.IMAGE, tif: FILE_CATEGORIES.IMAGE,
  // Audio
  mp3: FILE_CATEGORIES.AUDIO, wav: FILE_CATEGORIES.AUDIO, flac: FILE_CATEGORIES.AUDIO,
  aac: FILE_CATEGORIES.AUDIO, ogg: FILE_CATEGORIES.AUDIO, m4a: FILE_CATEGORIES.AUDIO,
  opus: FILE_CATEGORIES.AUDIO, wma: FILE_CATEGORIES.AUDIO, aiff: FILE_CATEGORIES.AUDIO,
  // Video
  mp4: FILE_CATEGORIES.VIDEO, webm: FILE_CATEGORIES.VIDEO, mkv: FILE_CATEGORIES.VIDEO,
  mov: FILE_CATEGORIES.VIDEO, avi: FILE_CATEGORIES.VIDEO, flv: FILE_CATEGORIES.VIDEO,
  wmv: FILE_CATEGORIES.VIDEO, ogv: FILE_CATEGORIES.VIDEO,
  // PDF & Server Converted Documents
  pdf: FILE_CATEGORIES.PDF,
  doc: FILE_CATEGORIES.PDF, dot: FILE_CATEGORIES.PDF, odt: FILE_CATEGORIES.PDF, rtf: FILE_CATEGORIES.PDF,
  ppt: FILE_CATEGORIES.PDF, pptx: FILE_CATEGORIES.PDF, odp: FILE_CATEGORIES.PDF,
  // Native Client-Side Word Documents
  docx: FILE_CATEGORIES.WORD, dotx: FILE_CATEGORIES.WORD,
  // Native Client-Side Spreadsheets
  xlsx: FILE_CATEGORIES.SHEET, xls: FILE_CATEGORIES.SHEET, csv: FILE_CATEGORIES.SHEET,
  tsv: FILE_CATEGORIES.SHEET, ods: FILE_CATEGORIES.SHEET,
  // Web & HTML
  html: FILE_CATEGORIES.HTML, htm: FILE_CATEGORIES.HTML, xhtml: FILE_CATEGORIES.HTML,
  // Fonts
  ttf: FILE_CATEGORIES.FONT, otf: FILE_CATEGORIES.FONT,
  woff: FILE_CATEGORIES.FONT, woff2: FILE_CATEGORIES.FONT,
  // Archives
  zip: FILE_CATEGORIES.ARCHIVE, rar: FILE_CATEGORIES.ARCHIVE, '7z': FILE_CATEGORIES.ARCHIVE,
  tar: FILE_CATEGORIES.ARCHIVE, gz: FILE_CATEGORIES.ARCHIVE, bz2: FILE_CATEGORIES.ARCHIVE,
  tgz: FILE_CATEGORIES.ARCHIVE, xz: FILE_CATEGORIES.ARCHIVE,
  // Code & Plain Text
  txt: FILE_CATEGORIES.TEXT, md: FILE_CATEGORIES.TEXT, markdown: FILE_CATEGORIES.TEXT,
  json: FILE_CATEGORIES.TEXT, json5: FILE_CATEGORIES.TEXT,
  xml: FILE_CATEGORIES.TEXT,
  css: FILE_CATEGORIES.TEXT, scss: FILE_CATEGORIES.TEXT, sass: FILE_CATEGORIES.TEXT, less: FILE_CATEGORIES.TEXT,
  js: FILE_CATEGORIES.TEXT, mjs: FILE_CATEGORIES.TEXT, cjs: FILE_CATEGORIES.TEXT,
  ts: FILE_CATEGORIES.TEXT, mts: FILE_CATEGORIES.TEXT, cts: FILE_CATEGORIES.TEXT,
  jsx: FILE_CATEGORIES.TEXT, tsx: FILE_CATEGORIES.TEXT, vue: FILE_CATEGORIES.TEXT, svelte: FILE_CATEGORIES.TEXT,
  py: FILE_CATEGORIES.TEXT, pyw: FILE_CATEGORIES.TEXT,
  c: FILE_CATEGORIES.TEXT, h: FILE_CATEGORIES.TEXT, cpp: FILE_CATEGORIES.TEXT, cc: FILE_CATEGORIES.TEXT,
  cxx: FILE_CATEGORIES.TEXT, hpp: FILE_CATEGORIES.TEXT, cs: FILE_CATEGORIES.TEXT,
  java: FILE_CATEGORIES.TEXT, kt: FILE_CATEGORIES.TEXT, kts: FILE_CATEGORIES.TEXT,
  rs: FILE_CATEGORIES.TEXT, go: FILE_CATEGORIES.TEXT,
  php: FILE_CATEGORIES.TEXT, rb: FILE_CATEGORIES.TEXT,
  sh: FILE_CATEGORIES.TEXT, bash: FILE_CATEGORIES.TEXT, zsh: FILE_CATEGORIES.TEXT,
  bat: FILE_CATEGORIES.TEXT, cmd: FILE_CATEGORIES.TEXT, ps1: FILE_CATEGORIES.TEXT,
  sql: FILE_CATEGORIES.TEXT, log: FILE_CATEGORIES.TEXT,
  yaml: FILE_CATEGORIES.TEXT, yml: FILE_CATEGORIES.TEXT,
  toml: FILE_CATEGORIES.TEXT, ini: FILE_CATEGORIES.TEXT, env: FILE_CATEGORIES.TEXT,
  conf: FILE_CATEGORIES.TEXT, config: FILE_CATEGORIES.TEXT, properties: FILE_CATEGORIES.TEXT,
  diff: FILE_CATEGORIES.TEXT, patch: FILE_CATEGORIES.TEXT,
  lua: FILE_CATEGORIES.TEXT, r: FILE_CATEGORIES.TEXT, swift: FILE_CATEGORIES.TEXT,
  dart: FILE_CATEGORIES.TEXT, pl: FILE_CATEGORIES.TEXT, pm: FILE_CATEGORIES.TEXT,
  graphql: FILE_CATEGORIES.TEXT, gql: FILE_CATEGORIES.TEXT
};

export function detectFileCategory(fileName = '', mimeType = '', viewUrl = '') {
  if (viewUrl && (viewUrl.startsWith('data:image/') || viewUrl.startsWith('data:image/svg+xml'))) {
    return FILE_CATEGORIES.IMAGE;
  }
  const baseName = fileName.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (['dockerfile', 'makefile', 'license', 'licence', 'cmakelists.txt', '.gitignore', '.env', '.dockerignore', '.editorconfig'].includes(baseName)) {
    return FILE_CATEGORIES.TEXT;
  }
  if (mimeType) {
    if (mimeType.startsWith('image/')) return FILE_CATEGORIES.IMAGE;
    if (mimeType.startsWith('audio/')) return FILE_CATEGORIES.AUDIO;
    if (mimeType.startsWith('video/')) return FILE_CATEGORIES.VIDEO;
    if (mimeType === 'application/pdf') return FILE_CATEGORIES.PDF;
    if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
      const ext = baseName.split('.').pop() || '';
      return ext === 'docx' || ext === 'dotx' ? FILE_CATEGORIES.WORD : FILE_CATEGORIES.PDF;
    }
    if (mimeType.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel') return FILE_CATEGORIES.SHEET;
    if (mimeType.includes('presentationml') || mimeType === 'application/vnd.ms-powerpoint') return FILE_CATEGORIES.PDF;
    if (mimeType === 'text/html') return FILE_CATEGORIES.HTML;
    if (mimeType.startsWith('font/') || mimeType.includes('font-')) return FILE_CATEGORIES.FONT;
    if (
      mimeType === 'application/zip' ||
      mimeType === 'application/x-zip-compressed' ||
      mimeType === 'application/x-rar-compressed' ||
      mimeType === 'application/x-7z-compressed' ||
      mimeType === 'application/x-tar' ||
      mimeType === 'application/gzip'
    ) return FILE_CATEGORIES.ARCHIVE;
    if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return FILE_CATEGORIES.TEXT;
  }
  if (fileName.includes('.')) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (EXT_MAP[ext]) return EXT_MAP[ext];
  }
  if (fileName.startsWith('[') || fileName.startsWith('QR_') || fileName.startsWith('Quét QR')) {
    if (viewUrl && (viewUrl.startsWith('data:image') || viewUrl.includes('/api/v1/files/'))) {
      return FILE_CATEGORIES.IMAGE;
    }
  }
  return FILE_CATEGORIES.FALLBACK;
}

export function resolveViewerUrls(item) {
  let fileId = item.fileId || item.resultFileId;
  let viewUrl = item.viewUrl || item.url || item.downloadUrl || '';
  let downloadUrl = item.downloadUrl || item.url || '';
  const drivePath = item.path || item.drivePath || null;
  const fileName = item.fileName || item.name || item.originalName || (drivePath ? drivePath.split('/').pop() : '');
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isServerConvertedDoc = SERVER_CONVERTED_EXTS.includes(ext);

  // 1. Storage Drive items with relative path
  if (drivePath && !viewUrl && !fileId) {
    viewUrl = StorageService.getDownloadUrl(drivePath, true);
    downloadUrl = StorageService.getDownloadUrl(drivePath, false);
  }

  // 2. Storage direct routes (/api/v1/storage/download)
  if (viewUrl.includes('/api/v1/storage/download') || downloadUrl.includes('/api/v1/storage/download')) {
    let sView = viewUrl || downloadUrl;
    let sDl = downloadUrl || viewUrl;
    if (!sView.includes('inline=true')) {
      sView = sView.includes('?') ? `${sView}&inline=true` : `${sView}?inline=true`;
    }
    sDl = sDl.replace(/([?&])inline=true(&|$)/, (m, p1, p2) => {
      if (p1 === '?' && p2 === '&') return '?';
      if (p1 === '&') return p2 ? '&' : '';
      return '';
    });
    viewUrl = sView;
    downloadUrl = sDl;
  }

  // 3. Dedicated streaming & download routes: preserve without rewriting
  if (viewUrl.includes('/api/v1/studocu/') || downloadUrl.includes('/api/v1/studocu/') || viewUrl.startsWith('/downloads/') || downloadUrl.startsWith('/downloads/')) {
    let finalView = viewUrl || downloadUrl;
    let finalDl = downloadUrl || viewUrl;

    if (finalView.includes('/api/v1/studocu/download/')) {
      const fn = finalView.split('/api/v1/studocu/download/')[1];
      finalView = `/api/v1/studocu/stream?file=${fn}`;
    } else if (finalView.startsWith('/downloads/')) {
      const fn = finalView.replace('/downloads/', '');
      finalView = `/api/v1/studocu/stream?file=${fn}`;
    }

    if (!finalDl.includes('/api/v1/studocu/download/')) {
      const fnMatch = finalView.match(/[?&]file=([^&#]+)/) || finalDl.match(/\/([^/?#]+)$/);
      const fn = fnMatch ? fnMatch[1] : '';
      if (fn) finalDl = `/api/v1/studocu/download/${fn}`;
    }

    return { viewUrl: finalView, downloadUrl: finalDl, fileId: null };
  }

  // 4. Archive extract routes: ensure viewUrl always has inline=true
  if (viewUrl.includes('/api/v1/archive/') || downloadUrl.includes('/api/v1/archive/')) {
    let aView = viewUrl || downloadUrl;
    let aDl = downloadUrl || viewUrl;
    if (!aView.includes('inline=true')) {
      aView = aView.includes('?') ? `${aView}&inline=true` : `${aView}?inline=true`;
    }
    if (aDl.includes('&inline=true')) {
      aDl = aDl.replace('&inline=true', '');
    } else if (aDl.includes('?inline=true')) {
      aDl = aDl.replace('?inline=true', '');
    }
    viewUrl = aView;
    downloadUrl = aDl;
  }

  // 5. Storage records: strictly extract fileId only for /api/v1/files/(download|view)/:fileId
  if (!fileId && (downloadUrl || viewUrl)) {
    const rawTarget = (downloadUrl || viewUrl).trim();
    const match = rawTarget.match(/\/api\/v1\/files\/(?:download|view)\/([^?#]+)/);
    if (match) fileId = match[1].trim();
  }

  if (fileId && !viewUrl.includes('/api/v1/viewer/preview-pdf')) {
    let decoded = fileId;
    try { decoded = decodeURIComponent(fileId); } catch {}
    const safeFileId = encodeURIComponent(decoded);
    viewUrl = `/api/v1/files/view/${safeFileId}`;
    downloadUrl = `/api/v1/files/download/${safeFileId}`;
  } else if (viewUrl && !viewUrl.startsWith('blob:') && !viewUrl.startsWith('data:') && !viewUrl.includes('inline=') && !viewUrl.includes('/api/v1/viewer/preview-pdf')) {
    if (viewUrl.includes('/api/v1/files/download/')) {
      viewUrl = viewUrl.replace('/api/v1/files/download/', '/api/v1/files/view/');
    } else {
      viewUrl = viewUrl.includes('?') ? `${viewUrl}&inline=true` : `${viewUrl}?inline=true`;
    }
  }

  // 6. Server-Assisted Universal PDF Preview routing for legacy office formats
  if (isServerConvertedDoc) {
    const token = getAdminToken();
    const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';
    if (fileId) {
      viewUrl = `/api/v1/viewer/preview-pdf?fileId=${encodeURIComponent(fileId)}${authParam}`;
    } else if (drivePath) {
      viewUrl = `/api/v1/viewer/preview-pdf?path=${encodeURIComponent(drivePath)}${authParam}`;
    } else {
      const pathMatch = (downloadUrl || viewUrl).match(/[?&]path=([^&#]+)/);
      if (pathMatch) {
        viewUrl = `/api/v1/viewer/preview-pdf?path=${pathMatch[1]}${authParam}`;
      }
    }
  }

  return { viewUrl, downloadUrl, fileId };
}

export const ViewerConnector = {
  /**
   * Universal Preview Entry Point
   * Accepts any record schema from any DD Studio module
   */
  preview(item) {
    if (!item) return;
    const rawFile = item.rawFile || item.file || null;
    let { viewUrl, downloadUrl, fileId } = resolveViewerUrls(item);
    let isBlob = Boolean(item.isBlob);

    if (!viewUrl && rawFile instanceof Blob) {
      viewUrl = URL.createObjectURL(rawFile);
      if (!downloadUrl) downloadUrl = viewUrl;
      isBlob = true;
    }

    const name = item.fileName || item.name || item.originalName || (item.path ? item.path.split('/').pop() : 'Tài liệu');
    const mimeType = item.mimeType || item.type || (rawFile ? rawFile.type : '');
    let size = Number(item.resultSize || item.originalSize || item.sizeBytes || item.size || (rawFile ? rawFile.size : 0));

    if (!size && viewUrl && viewUrl.startsWith('data:image')) {
      const b64 = viewUrl.split(',')[1] || '';
      size = Math.round(b64.length * 0.75) || 1200;
    }

    const category = item.category || detectFileCategory(name, mimeType, viewUrl);

    openFileViewer({
      name,
      category,
      fileId,
      drivePath: item.path || item.drivePath || null,
      rawFile,
      viewUrl,
      downloadUrl,
      size,
      mimeType,
      isBlob,
      sourceModule: item.tool || item.toolTitle || item.sourceModule || ''
    });
  },

  /**
   * Universal Preview Alias for direct module integration
   */
  openViewer(item) {
    return this.preview(item);
  },

  /**
   * Client-side Blob Preview Entry Point
   */
  previewBlob(blob, fileName = 'Tệp tin') {
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    const category = detectFileCategory(fileName, blob.type);
    openFileViewer({
      name: fileName,
      category,
      rawFile: blob,
      viewUrl: blobUrl,
      downloadUrl: blobUrl,
      size: blob.size,
      mimeType: blob.type,
      isBlob: true
    });
  }
};
