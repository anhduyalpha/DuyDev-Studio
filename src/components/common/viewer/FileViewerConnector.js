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
  heic: FILE_CATEGORIES.IMAGE, heif: FILE_CATEGORIES.IMAGE,
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
  woff: FILE_CATEGORIES.FONT, woff2: FILE_CATEGORIES.FONT, eot: FILE_CATEGORIES.FONT,
  // Archives
  zip: FILE_CATEGORIES.ARCHIVE, rar: FILE_CATEGORIES.ARCHIVE, '7z': FILE_CATEGORIES.ARCHIVE,
  tar: FILE_CATEGORIES.ARCHIVE, gz: FILE_CATEGORIES.ARCHIVE, bz2: FILE_CATEGORIES.ARCHIVE,
  tgz: FILE_CATEGORIES.ARCHIVE, xz: FILE_CATEGORIES.ARCHIVE,
  iso: FILE_CATEGORIES.FALLBACK, bin: FILE_CATEGORIES.FALLBACK, dat: FILE_CATEGORIES.FALLBACK,
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
  graphql: FILE_CATEGORIES.TEXT, gql: FILE_CATEGORIES.TEXT,
  vtt: FILE_CATEGORIES.TEXT, srt: FILE_CATEGORIES.TEXT
};

export function extractFileName(item = {}, viewUrl = '', downloadUrl = '') {
  let name = item.fileName || item.name || item.originalName || item.title || '';
  if (!name && (item.path || item.drivePath)) {
    const rawPath = item.path || item.drivePath;
    name = rawPath.replace(/\\/g, '/').split('/').pop() || '';
  }

  // Fallback to URL inspection if no clean name is present or generic route name was provided
  const lowerName = (name || '').toLowerCase().trim();
  if (!name || lowerName === 'tài liệu' || lowerName === 'tệp tin' || lowerName === 'download' || lowerName === 'view') {
    const targetUrl = viewUrl || downloadUrl || item.url || '';
    if (targetUrl) {
      const queryMatch = targetUrl.match(/[?&](?:path|file|name|fileName)=([^&#]+)/i);
      if (queryMatch) {
        try {
          const decoded = decodeURIComponent(queryMatch[1]);
          name = decoded.replace(/\\/g, '/').split('/').pop() || '';
        } catch {}
      }

      if (!name) {
        const fileRouteMatch = targetUrl.match(/\/api\/v1\/files\/(?:view|download)\/([^/?#]+)/i);
        if (fileRouteMatch) {
          try {
            name = decodeURIComponent(fileRouteMatch[1]);
          } catch {}
        }
      }

      if (!name && targetUrl.includes('/')) {
        const cleanPath = targetUrl.split('?')[0].split('#')[0];
        const lastPart = cleanPath.split('/').pop() || '';
        if (lastPart && !lastPart.startsWith('api') && !lastPart.startsWith('download') && !lastPart.startsWith('stream')) {
          try {
            name = decodeURIComponent(lastPart);
          } catch {}
        }
      }
    }
  }

  try {
    name = decodeURIComponent(name);
  } catch {}

  name = name.split('?')[0].split('#')[0].trim();
  return name || 'Tài liệu';
}

export function extractFileExtension(fileName = '', mimeType = '', viewUrl = '') {
  let cleanName = (fileName || '').split('?')[0].split('#')[0].trim();
  try { cleanName = decodeURIComponent(cleanName); } catch {}
  if (cleanName.includes('.')) {
    const ext = cleanName.split('.').pop()?.toLowerCase();
    if (ext && ext.length <= 10) return ext;
  }
  if (viewUrl) {
    const qMatch = viewUrl.match(/[?&](?:path|file|name|fileName)=([^&#]+)/i);
    if (qMatch) {
      try {
        const decoded = decodeURIComponent(qMatch[1]);
        if (decoded.includes('.')) {
          const ext = decoded.split('.').pop()?.toLowerCase();
          if (ext && ext.length <= 10) return ext;
        }
      } catch {}
    }
    const cleanUrl = viewUrl.split('?')[0].split('#')[0].trim();
    if (cleanUrl.includes('.')) {
      const ext = cleanUrl.split('.').pop()?.toLowerCase();
      if (ext && ext.length <= 10) return ext;
    }
  }
  if (mimeType) {
    const lower = mimeType.toLowerCase();
    if (lower === 'application/pdf') return 'pdf';
    if (lower.includes('wordprocessingml')) return 'docx';
    if (lower === 'application/msword') return 'doc';
    if (lower.includes('spreadsheetml')) return 'xlsx';
    if (lower === 'application/vnd.ms-excel') return 'xls';
    if (lower === 'text/csv') return 'csv';
    if (lower.includes('presentationml')) return 'pptx';
    if (lower === 'application/vnd.ms-powerpoint') return 'ppt';
    if (lower === 'application/zip') return 'zip';
    if (lower.includes('rar')) return 'rar';
    if (lower.includes('7z')) return '7z';
    if (lower.startsWith('image/jpeg')) return 'jpg';
    if (lower.startsWith('image/png')) return 'png';
    if (lower.startsWith('image/webp')) return 'webp';
    if (lower.startsWith('image/svg')) return 'svg';
    if (lower.startsWith('audio/mpeg')) return 'mp3';
    if (lower.startsWith('video/mp4')) return 'mp4';
    if (lower.startsWith('text/html')) return 'html';
    if (lower.startsWith('text/plain')) return 'txt';
  }
  return '';
}

export function detectFileCategory(fileName = '', mimeType = '', viewUrl = '') {
  if (viewUrl && (viewUrl.startsWith('data:image/') || viewUrl.startsWith('data:image/svg+xml'))) {
    return FILE_CATEGORIES.IMAGE;
  }

  let cleanName = fileName || '';
  try { cleanName = decodeURIComponent(cleanName); } catch {}
  cleanName = cleanName.split('?')[0].split('#')[0].trim();

  const baseName = cleanName.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (['dockerfile', 'makefile', 'license', 'licence', 'cmakelists.txt', '.gitignore', '.env', '.dockerignore', '.editorconfig'].includes(baseName)) {
    return FILE_CATEGORIES.TEXT;
  }

  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime.startsWith('image/')) return FILE_CATEGORIES.IMAGE;
    if (lowerMime.startsWith('audio/')) return FILE_CATEGORIES.AUDIO;
    if (lowerMime.startsWith('video/')) return FILE_CATEGORIES.VIDEO;
    if (lowerMime === 'application/pdf') return FILE_CATEGORIES.PDF;
    if (lowerMime.includes('wordprocessingml') || lowerMime === 'application/msword') {
      const ext = baseName.split('.').pop() || '';
      return ext === 'docx' || ext === 'dotx' ? FILE_CATEGORIES.WORD : FILE_CATEGORIES.PDF;
    }
    if (lowerMime.includes('spreadsheetml') || lowerMime === 'application/vnd.ms-excel') return FILE_CATEGORIES.SHEET;
    if (lowerMime.includes('presentationml') || lowerMime === 'application/vnd.ms-powerpoint') return FILE_CATEGORIES.PDF;
    if (lowerMime === 'text/html' || lowerMime === 'application/xhtml+xml') return FILE_CATEGORIES.HTML;
    if (lowerMime.startsWith('font/') || lowerMime.includes('font-')) return FILE_CATEGORIES.FONT;
    if (
      lowerMime === 'application/zip' ||
      lowerMime === 'application/x-zip-compressed' ||
      lowerMime === 'application/x-rar-compressed' ||
      lowerMime === 'application/x-7z-compressed' ||
      lowerMime === 'application/x-tar' ||
      lowerMime === 'application/gzip' ||
      lowerMime === 'application/x-bzip2' ||
      lowerMime === 'application/x-xz'
    ) return FILE_CATEGORIES.ARCHIVE;
    if (lowerMime.startsWith('text/') || lowerMime.includes('json') || lowerMime.includes('xml')) return FILE_CATEGORIES.TEXT;
  }

  const ext = extractFileExtension(cleanName, mimeType, viewUrl);
  if (ext && EXT_MAP[ext]) {
    return EXT_MAP[ext];
  }

  if (cleanName.startsWith('[') || cleanName.startsWith('QR_') || cleanName.startsWith('Quét QR')) {
    if (viewUrl && (viewUrl.startsWith('data:image') || viewUrl.includes('/api/v1/files/'))) {
      return FILE_CATEGORIES.IMAGE;
    }
  }
  return FILE_CATEGORIES.FALLBACK;
}

/**
 * Reliable 16-byte magic number signature inspector
 * Detects %PDF, PK\x03\x04 (Docx/Xlsx/Zip), PNG, JPEG, GIF, WEBP, MP3, MP4, WebM, RAR, 7z
 */
export function detectCategoryFromMagicBytes(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
    return FILE_CATEGORIES.PDF;
  }
  // PNG: \x89PNG (0x89, 0x50, 0x4E, 0x47)
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
    return FILE_CATEGORIES.IMAGE;
  }
  // JPEG: \xFF\xD8\xFF
  if (u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) {
    return FILE_CATEGORIES.IMAGE;
  }
  // GIF: GIF87a or GIF89a
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) {
    return FILE_CATEGORIES.IMAGE;
  }
  // WEBP: RIFF....WEBP (offset 8: 0x57, 0x45, 0x42, 0x50)
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8.length >= 12) {
    if (u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
      return FILE_CATEGORIES.IMAGE;
    }
  }
  // ZIP / Office OpenXML: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04) {
    try {
      let str = '';
      const len = Math.min(u8.length, 1024);
      for (let i = 0; i < len; i++) str += String.fromCharCode(u8[i]);
      if (str.includes('word/')) return FILE_CATEGORIES.WORD;
      if (str.includes('xl/')) return FILE_CATEGORIES.SHEET;
      if (str.includes('ppt/')) return FILE_CATEGORIES.PDF;
    } catch {}
    return FILE_CATEGORIES.ARCHIVE;
  }
  // MP3: ID3 (0x49, 0x44, 0x33) or MPEG sync word 0xFF 0xFB/0xFA/0xF3/0xF2
  if ((u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) || (u8[0] === 0xFF && (u8[1] & 0xE0) === 0xE0)) {
    return FILE_CATEGORIES.AUDIO;
  }
  // MP4 / MOV: bytes 4-7 = 'ftyp' (0x66, 0x74, 0x79, 0x70)
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    return FILE_CATEGORIES.VIDEO;
  }
  // WebM / MKV: 0x1A, 0x45, 0xDF, 0xA3
  if (u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3) {
    return FILE_CATEGORIES.VIDEO;
  }
  // RAR: Rar! (0x52, 0x61, 0x72, 0x21)
  if (u8[0] === 0x52 && u8[1] === 0x61 && u8[2] === 0x72 && u8[3] === 0x21) {
    return FILE_CATEGORIES.ARCHIVE;
  }
  // 7Z: 7z (0x37, 0x7A, 0xBC, 0xAF)
  if (u8[0] === 0x37 && u8[1] === 0x7A && u8[2] === 0xBC && u8[3] === 0xAF) {
    return FILE_CATEGORIES.ARCHIVE;
  }
  return null;
}

/**
 * Unified authenticated fetch helper for DD Studio Universal Viewer
 * Automatically attaches X-Device-Id, x-storage-auth, and Bearer tokens for internal routes
 */
export async function viewerFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  let isInternal = false;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000');
    isInternal = typeof window !== 'undefined' ? (parsed.origin === window.location.origin) : true;
    if (typeof url === 'string' && (url.startsWith('/api/') || url.startsWith('/downloads/'))) isInternal = true;
  } catch {
    if (typeof url === 'string' && (url.startsWith('/') || url.startsWith('./'))) isInternal = true;
  }

  if (isInternal && typeof window !== 'undefined') {
    const deviceId = localStorage.getItem('ds_device_id') || window.__ddDeviceId || '';
    if (deviceId && !headers.has('x-device-id')) {
      headers.set('x-device-id', deviceId);
    }
    const token = getAdminToken();
    if (token) {
      if (!headers.has('x-storage-auth')) headers.set('x-storage-auth', token);
      if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
    }
  }

  return fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers
  });
}

if (typeof window !== 'undefined') {
  window.viewerFetch = viewerFetch;
  window.__ddViewerFetch = viewerFetch;
}

export function resolveViewerUrls(item) {
  let fileId = item.fileId || item.resultFileId;
  let viewUrl = item.viewUrl || item.url || item.downloadUrl || '';
  let downloadUrl = item.downloadUrl || item.url || '';
  const drivePath = item.path || item.drivePath || item.driveRelPath || null;
  const fileName = extractFileName(item, viewUrl, downloadUrl);
  const ext = extractFileExtension(fileName, item.mimeType || item.mime || item.type, viewUrl);
  const isServerConvertedDoc = SERVER_CONVERTED_EXTS.includes(ext);
  const token = getAdminToken();
  const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';
  const deviceId = (typeof localStorage !== 'undefined' ? (localStorage.getItem('ds_device_id') || '') : '') || (typeof window !== 'undefined' ? (window.__ddDeviceId || '') : '');
  const devParam = deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : '';

  // 1. Storage Drive items with relative path
  if (drivePath && (!viewUrl || item.driveRelPath) && !fileId) {
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
    // Ensure token & deviceId are attached for Range streams and media decoders
    if (token && !sView.includes('auth=') && !sView.includes('token=')) {
      sView = sView.includes('?') ? `${sView}${authParam}` : `${sView}?${authParam.replace(/^&/, '')}`;
    }
    if (deviceId && !sView.includes('deviceId=')) {
      sView = sView.includes('?') ? `${sView}${devParam}` : `${sView}?${devParam.replace(/^&/, '')}`;
    }
    if (token && !sDl.includes('auth=') && !sDl.includes('token=')) {
      sDl = sDl.includes('?') ? `${sDl}${authParam}` : `${sDl}?${authParam.replace(/^&/, '')}`;
    }
    if (deviceId && !sDl.includes('deviceId=')) {
      sDl = sDl.includes('?') ? `${sDl}${devParam}` : `${sDl}?${devParam.replace(/^&/, '')}`;
    }
    viewUrl = sView;
    downloadUrl = sDl;
  }

  // 3. Dedicated streaming & download routes: preserve without rewriting
  if (viewUrl.includes('/api/v1/youtube/stream') || downloadUrl.includes('/api/v1/youtube/stream')) {
    return { viewUrl: viewUrl || downloadUrl, downloadUrl: downloadUrl || viewUrl, fileId: null };
  }

  // 3b. Scribd routes: rewrite download to stream to avoid attachment triggers
  if (viewUrl.includes('/api/v1/scribd/') || downloadUrl.includes('/api/v1/scribd/')) {
    let finalView = viewUrl || downloadUrl;
    let finalDl = downloadUrl || viewUrl;

    if (finalView.includes('/api/v1/scribd/download/')) {
      const fn = finalView.split('/api/v1/scribd/download/')[1];
      finalView = `/api/v1/scribd/stream?file=${fn}`;
    }

    if (!finalDl.includes('/api/v1/scribd/download/')) {
      const fnMatch = finalView.match(/[?&]file=([^&#]+)/) || finalDl.match(/\/([^/?#]+)$/);
      const fn = fnMatch ? fnMatch[1] : (fileName ? encodeURIComponent(fileName) : '');
      if (fn) finalDl = `/api/v1/scribd/download/${fn}`;
    }

    return { viewUrl: finalView, downloadUrl: finalDl, fileId: null };
  }

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
      const fn = fnMatch ? fnMatch[1] : (fileName ? encodeURIComponent(fileName) : '');
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
    const match = rawTarget.match(/\/api\/v1\/files\/(?:download|view)\/([^/?#]+)/);
    if (match) fileId = match[1].trim();
  }

  if (fileId && !viewUrl.includes('/api/v1/viewer/preview-pdf')) {
    let decoded = fileId;
    try { decoded = decodeURIComponent(fileId); } catch {}
    const safeFileId = encodeURIComponent(decoded);
    viewUrl = `/api/v1/files/view/${safeFileId}`;
    downloadUrl = `/api/v1/files/download/${safeFileId}`;
    if (token) {
      viewUrl += `?auth=${encodeURIComponent(token)}`;
      downloadUrl += `?auth=${encodeURIComponent(token)}`;
    }
    if (deviceId) {
      viewUrl += (viewUrl.includes('?') ? '&' : '?') + `deviceId=${encodeURIComponent(deviceId)}`;
      downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + `deviceId=${encodeURIComponent(deviceId)}`;
    }
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
    const deviceId = (typeof localStorage !== 'undefined' ? (localStorage.getItem('ds_device_id') || '') : '') || (typeof window !== 'undefined' ? (window.__ddDeviceId || '') : '');
    const devParam = deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : '';
    if (fileId) {
      viewUrl = `/api/v1/viewer/preview-pdf?fileId=${encodeURIComponent(fileId)}${authParam}${devParam}`;
    } else if (drivePath) {
      viewUrl = `/api/v1/viewer/preview-pdf?path=${encodeURIComponent(drivePath)}${authParam}${devParam}`;
    } else {
      const pathMatch = (downloadUrl || viewUrl).match(/[?&]path=([^&#]+)/);
      if (pathMatch) {
        viewUrl = `/api/v1/viewer/preview-pdf?path=${pathMatch[1]}${authParam}${devParam}`;
      }
    }
  }

  return { viewUrl, downloadUrl, fileId };
}

export function openPlaylistItem(playlist, index, direction = 'next') {
  if (!Array.isArray(playlist) || playlist.length === 0) return;
  let targetIndex = index;
  if (targetIndex < 0) targetIndex = playlist.length - 1;
  if (targetIndex >= playlist.length) targetIndex = 0;
  const targetItem = playlist[targetIndex];
  if (!targetItem) return;
  ViewerConnector.preview(targetItem, {
    playlist,
    playlistIndex: targetIndex,
    direction
  });
}

export const ViewerConnector = {
  /**
   * Universal Preview Entry Point
   * Accepts any record schema from any DD Studio module
   * Supports (url, filename), ({ url, name, path, size, mime, blob, file }), or File/Blob
   */
  preview(item, options = {}) {
    if (!item) return;

    // 1. Normalize (url, filename) or (url, options) caller contract
    if (typeof item === 'string') {
      const itemUrl = item.trim();
      const itemName = typeof options === 'string' ? options : (options.name || options.fileName || '');
      const optObj = typeof options === 'object' && options !== null ? options : {};
      item = {
        viewUrl: itemUrl,
        downloadUrl: itemUrl,
        name: itemName,
        ...optObj
      };
      options = optObj;
    } else if (typeof Blob !== 'undefined' && item instanceof Blob) {
      // 2. Normalize (File | Blob, filename) caller contract
      const blobName = typeof options === 'string' ? options : (options.name || options.fileName || item.name || 'Tệp tin');
      const optObj = typeof options === 'object' && options !== null ? options : {};
      item = {
        rawFile: item,
        file: item,
        name: blobName,
        size: item.size,
        mimeType: item.type,
        isBlob: true,
        ...optObj
      };
      options = optObj;
    }

    const rawFile = item.rawFile || item.file || item.blob || null;
    let { viewUrl, downloadUrl, fileId } = resolveViewerUrls(item);
    let isBlob = Boolean(item.isBlob);

    if (!viewUrl && rawFile instanceof Blob) {
      viewUrl = URL.createObjectURL(rawFile);
      if (!downloadUrl) downloadUrl = viewUrl;
      isBlob = true;
    }

    const name = extractFileName(item, viewUrl, downloadUrl);
    const mimeType = item.mimeType || item.mime || item.type || (rawFile ? rawFile.type : '');
    let size = Number(item.resultSize || item.originalSize || item.sizeBytes || item.size || (rawFile ? rawFile.size : 0));

    if (!size && viewUrl && viewUrl.startsWith('data:image')) {
      const b64 = viewUrl.split(',')[1] || '';
      size = Math.round(b64.length * 0.75) || 1200;
    }

    let category = item.category || detectFileCategory(name, mimeType, viewUrl);

    // Fast-path Magic Bytes Check for Blob instances
    if (category === FILE_CATEGORIES.FALLBACK && rawFile instanceof Blob && rawFile.size >= 4) {
      try {
        const slice = rawFile.slice(0, 1024);
        slice.arrayBuffer().then((buf) => {
          const magicCat = detectCategoryFromMagicBytes(new Uint8Array(buf));
          if (magicCat && typeof window !== 'undefined' && window.__ddActiveViewerState) {
            window.__ddActiveViewerState.category = magicCat;
          }
        }).catch(() => {});
      } catch {}
    }

    const playlist = options.playlist || item.playlist || null;
    const playlistIndex = typeof options.playlistIndex === 'number' ? options.playlistIndex : (typeof item.playlistIndex === 'number' ? item.playlistIndex : -1);
    const direction = options.direction || item.direction || null;
    const metadata = item.metadata || options.metadata || null;

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
      sourceModule: item.tool || item.toolTitle || item.sourceModule || '',
      metadata,
      playlist,
      playlistIndex,
      direction,
      onSwitchItem: (targetIdx, dir) => {
        if (Array.isArray(playlist) && playlist.length > 0) {
          openPlaylistItem(playlist, targetIdx, dir);
        }
      }
    });
  },

  /**
   * Universal Preview Aliases for direct module integration
   */
  open(item, options = {}) {
    return this.preview(item, options);
  },

  openViewer(item, options = {}) {
    return this.preview(item, options);
  },

  /**
   * Client-side Blob Preview Entry Point
   */
  previewBlob(blob, fileName = 'Tệp tin') {
    return this.preview(blob, fileName);
  },

  /**
   * Centralized Authenticated Fetcher helper
   */
  viewerFetch(url, options = {}) {
    return viewerFetch(url, options);
  }
};

if (typeof window !== 'undefined') {
  window.openFileViewer = (item, options) => ViewerConnector.preview(item, options);
}
