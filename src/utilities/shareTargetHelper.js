/**
 * @module shareTargetHelper
 * Utilities for reading, classifying, and cleaning up Web Share Target payloads
 * stored in IndexedDB by the Service Worker or provided via URL parameters.
 */

/** @enum {string} Payload classification types */
export const SharePayloadType = {
  STUDOCU_URL: 'STUDOCU_URL',
  IMAGE_URL: 'IMAGE_URL',
  GENERIC_URL: 'GENERIC_URL',
  PLAIN_TEXT: 'PLAIN_TEXT',
  IMAGE_FILES: 'IMAGE_FILES',
  PDF_FILES: 'PDF_FILES',
  ARCHIVE_FILES: 'ARCHIVE_FILES',
  GENERIC_FILES: 'GENERIC_FILES',
};

const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz'];
const ARCHIVE_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/vnd.rar',
  'application/x-bzip2'
];
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff|svg|avif|ico)(\?.*)?$/i;

function isStudocuHost(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return host === 'studocu.com' || host.endsWith('.studocu.com') || host === 'studocu.vn' || host.endsWith('.studocu.vn');
}

/**
 * Extracts a direct image URL from Google Images, search links, or text containing image URLs.
 * @param {string} [url]
 * @param {string} [text]
 * @returns {string|null} Direct image URL if detected
 */
export function extractImageUrlFromTextOrUrl(url = '', text = '') {
  const combined = `${url} ${text}`.trim();
  if (!combined) return null;

  // 1. Check for Google Images imgurl parameter
  const imgUrlMatch = combined.match(/[?&]imgurl=([^&\s]+)/i);
  if (imgUrlMatch && imgUrlMatch[1]) {
    try {
      return decodeURIComponent(imgUrlMatch[1]);
    } catch {
      return imgUrlMatch[1];
    }
  }

  // 2. Check for direct image URLs ending in image extensions
  const directImgMatch = combined.match(/https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|gif|bmp|svg|avif)(?:\?[^\s"'<>]*)?/i);
  if (directImgMatch) {
    return directImgMatch[0];
  }

  // 3. Check for Google app shortlinks or Google imgres
  if (url && (url.includes('images.app.goo.gl') || url.includes('google.com/imgres'))) {
    return url;
  }

  return null;
}

/**
 * Open IndexedDB ds_share_db.
 * @returns {Promise<IDBDatabase>}
 */
function openShareDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported'));
    }
    const req = indexedDB.open('ds_share_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shares', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Peek pending share payload from IndexedDB without write locks or deletion.
 * Opens a readonly transaction on object store 'shares'.
 * @returns {Promise<{title?: string, text?: string, url?: string, files?: File[]}|null>}
 */
export async function peekPendingSharedPayload() {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const db = await openShareDb();
    try {
      const tx = db.transaction('shares', 'readonly');
      const store = tx.objectStore('shares');
      const allPayloads = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!allPayloads || !allPayloads.length) return null;
      return allPayloads[allPayloads.length - 1];
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/**
 * Read and delete pending share payloads from IndexedDB using readwrite transaction.
 * Opens a readwrite transaction ONLY to consume data.
 * @returns {Promise<{title?: string, text?: string, url?: string, files?: File[]}|null>}
 */
export async function consumePendingSharedPayload() {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const db = await openShareDb();
    try {
      const tx = db.transaction('shares', 'readwrite');
      const store = tx.objectStore('shares');

      const allPayloads = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!allPayloads || !allPayloads.length) {
        return null;
      }

      store.clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      return allPayloads[allPayloads.length - 1];
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/**
 * Poll for pending shared data with adaptive backoff and BroadcastChannel wake-up.
 * @param {number} [maxWaitMs=4500]
 * @returns {Promise<{title?: string, text?: string, url?: string, files?: File[]}|null>}
 */
export async function pollPendingSharedData(maxWaitMs = 4500) {
  // 1. Instant check
  const instantPeek = await peekPendingSharedPayload();
  if (instantPeek) {
    const consumed = await consumePendingSharedPayload();
    if (consumed) return consumed;
  }

  const startTime = Date.now();
  const delays = [40, 60, 100, 150, 250, 350, 500, 600, 800, 1000];

  return new Promise((resolve) => {
    let resolved = false;
    let bc = null;
    let timerId = null;

    const cleanup = () => {
      if (timerId) clearTimeout(timerId);
      if (bc) {
        try {
          bc.close();
        } catch {}
        bc = null;
      }
    };

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    // BroadcastChannel instant wake-up
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('ds_share_channel');
        bc.onmessage = async (event) => {
          if (event.data?.type === 'PAYLOAD_READY') {
            const payload = await consumePendingSharedPayload();
            if (payload) finish(payload);
          }
        };
      } catch {}
    }

    // Adaptive backoff poll step
    let stepIndex = 0;
    const scheduleNext = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        finish(null);
        return;
      }

      const delay = delays[Math.min(stepIndex, delays.length - 1)];
      stepIndex++;

      timerId = setTimeout(async () => {
        if (resolved) return;
        const peek = await peekPendingSharedPayload();
        if (peek) {
          const payload = await consumePendingSharedPayload();
          if (payload) {
            finish(payload);
            return;
          }
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  });
}

/**
 * Read and delete all pending share payloads from IndexedDB (consume-once).
 * Backward-compatible wrapper around consumePendingSharedPayload.
 * @returns {Promise<{title?: string, text?: string, url?: string, files?: File[]}|null>}
 */
export async function retrievePendingSharedData() {
  return consumePendingSharedPayload();
}

/**
 * Classify share payload and return type + rich recommended actions.
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 * @returns {{ type: string, recommendations: Array<{ label: string, route: string, mode?: string, imageUrl?: string, isPrimary?: boolean }> }}
 */
export function classifySharedPayload(payload) {
  const { url, text, files } = payload || {};

  // 1. File-based classification (highest priority)
  if (files && files.length > 0) {
    const firstFile = files[0];
    if (!firstFile) {
      return { type: SharePayloadType.PLAIN_TEXT, recommendations: [] };
    }
    const name = (firstFile.name || '').toLowerCase();
    const mime = (firstFile.type || '').toLowerCase();

    if (mime.startsWith('image/') || IMAGE_RE.test(name)) {
      return {
        type: SharePayloadType.IMAGE_FILES,
        recommendations: [
          { label: 'Quét mã QR từ ảnh này', route: '#tool/qr-scan', isPrimary: true },
          { label: 'Đổi định dạng ảnh (Converter)', route: '#tool/universal-converter' },
          { label: 'Chuyển ảnh thành PDF', route: '#tool/pdf-studio', mode: 'images_to_pdf' },
          { label: 'Tính mã băm kiểm tra toàn vẹn', route: '#tool/hash-checksum' },
        ],
      };
    }

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      return {
        type: SharePayloadType.PDF_FILES,
        recommendations: [
          { label: 'Nén PDF', route: '#tool/pdf-studio', mode: 'compress', isPrimary: true },
          { label: 'PDF sang Word', route: '#tool/pdf-studio', mode: 'pdf_to_docx' },
          { label: 'Tách trang', route: '#tool/pdf-studio', mode: 'split' },
          { label: 'Xoay trang', route: '#tool/pdf-studio', mode: 'rotate' },
          { label: 'Xem tài liệu PDF', route: '#tool/pdf-studio', mode: 'view' },
        ],
      };
    }

    const isArchive = ARCHIVE_EXTS.some(ext => name.endsWith(ext)) ||
      (mime && ARCHIVE_MIMES.includes(mime));

    if (isArchive) {
      return {
        type: SharePayloadType.ARCHIVE_FILES,
        recommendations: [
          { label: 'Soi tệp nén trực tuyến', route: '#tool/archive-inspect', isPrimary: true },
          { label: 'Chuyển đổi định dạng tệp', route: '#tool/universal-converter' },
        ],
      };
    }

    return {
      type: SharePayloadType.GENERIC_FILES,
      recommendations: [
        { label: 'Chuyển đổi định dạng', route: '#tool/universal-converter', isPrimary: true },
        { label: 'Tính mã băm', route: '#tool/hash-checksum' },
      ],
    };
  }

  // 2. Image URL / Google Image search detection
  const detectedImageUrl = extractImageUrlFromTextOrUrl(url, text);
  if (detectedImageUrl) {
    return {
      type: SharePayloadType.IMAGE_URL,
      recommendations: [
        { label: 'Quét mã QR từ liên kết ảnh này', route: '#tool/qr-scan', imageUrl: detectedImageUrl, isPrimary: true },
        { label: 'Tải ảnh & Đổi định dạng', route: '#tool/universal-converter', imageUrl: detectedImageUrl },
        { label: 'Chuyển ảnh thành PDF', route: '#tool/pdf-studio', mode: 'images_to_pdf', imageUrl: detectedImageUrl },
        { label: 'Tạo mã QR cho liên kết gốc', route: '#tool/qr-multi' },
      ],
    };
  }

  // 3. URL-based classification
  const effectiveUrl = url || (text?.match(/https?:\/\/\S+/)?.[0]) || '';

  if (effectiveUrl) {
    try {
      const parsed = new URL(effectiveUrl);
      if (isStudocuHost(parsed.hostname)) {
        return {
          type: SharePayloadType.STUDOCU_URL,
          recommendations: [
            { label: 'Tải tài liệu Studocu', route: '#tool/studocu-dl', isPrimary: true },
            { label: 'Tạo mã QR cho liên kết này', route: '#tool/qr-multi' },
          ],
        };
      }
    } catch { /* invalid URL, fall through */ }

    return {
      type: SharePayloadType.GENERIC_URL,
      recommendations: [
        { label: 'Tạo mã QR cho liên kết này', route: '#tool/qr-multi', isPrimary: true },
        { label: 'Quét mã QR từ trang web này', route: '#tool/qr-scan' },
        { label: 'Rút gọn liên kết', route: '#tool/qr-multi' },
      ],
    };
  }

  // 4. Plain text
  if (text) {
    return {
      type: SharePayloadType.PLAIN_TEXT,
      recommendations: [
        { label: 'Tạo mã QR cho văn bản này', route: '#tool/qr-multi', isPrimary: true },
        { label: 'Tính mã băm chuỗi văn bản', route: '#tool/hash-checksum' },
      ],
    };
  }

  return { type: SharePayloadType.PLAIN_TEXT, recommendations: [] };
}
