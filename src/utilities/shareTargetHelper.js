/**
 * @module shareTargetHelper
 * Utilities for reading, classifying, and cleaning up Web Share Target payloads
 * stored in IndexedDB by the Service Worker.
 */

/** @enum {string} Payload classification types */
export const SharePayloadType = {
  STUDOCU_URL: 'STUDOCU_URL',
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
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff|svg|avif|ico)$/i;

function isStudocuHost(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return host === 'studocu.com' || host.endsWith('.studocu.com') || host === 'studocu.vn' || host.endsWith('.studocu.vn');
}

/**
 * Open IndexedDB ds_share_db.
 * @returns {Promise<IDBDatabase>}
 */
function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ds_share_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shares', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Read and delete all pending share payloads from IndexedDB (consume-once).
 * Returns the most recent payload or null.
 * @returns {Promise<{title?: string, text?: string, url?: string, files?: File[]}|null>}
 */
export async function retrievePendingSharedData() {
  try {
    const db = await openShareDb();
    const tx = db.transaction('shares', 'readwrite');
    const store = tx.objectStore('shares');

    const allPayloads = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Clear after reading — atomic within same transaction
    store.clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    if (!allPayloads.length) return null;
    return allPayloads[allPayloads.length - 1];
  } catch {
    return null;
  }
}

/**
 * Classify share payload and return type + recommended actions.
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 * @returns {{ type: string, recommendations: Array<{ label: string, route: string, mode?: string, isPrimary?: boolean }> }}
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
          { label: 'Quét mã QR từ ảnh', route: '#tool/qr-scan', isPrimary: true },
          { label: 'Chuyển ảnh thành PDF', route: '#tool/pdf-studio', mode: 'images_to_pdf' },
          { label: 'Đổi định dạng ảnh', route: '#tool/universal-converter' },
          { label: 'Tính mã băm', route: '#tool/hash-checksum' },
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
          { label: 'Xem tài liệu', route: '#tool/pdf-studio', mode: 'view' },
        ],
      };
    }

    const isArchive = ARCHIVE_EXTS.some(ext => name.endsWith(ext)) ||
      (mime && ARCHIVE_MIMES.includes(mime));

    if (isArchive) {
      return {
        type: SharePayloadType.ARCHIVE_FILES,
        recommendations: [
          { label: 'Soi tệp nén', route: '#tool/archive-inspect', isPrimary: true },
          { label: 'Chuyển đổi định dạng', route: '#tool/universal-converter' },
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

  // 2. URL-based classification
  const effectiveUrl = url || (text?.match(/https?:\/\/\S+/)?.[0]) || '';

  if (effectiveUrl) {
    try {
      const parsed = new URL(effectiveUrl);
      if (isStudocuHost(parsed.hostname)) {
        return {
          type: SharePayloadType.STUDOCU_URL,
          recommendations: [
            { label: 'Tải tài liệu Studocu', route: '#tool/studocu-dl', isPrimary: true },
            { label: 'Tạo mã QR cho link này', route: '#tool/qr-multi' },
          ],
        };
      }
    } catch { /* invalid URL, fall through */ }

    return {
      type: SharePayloadType.GENERIC_URL,
      recommendations: [
        { label: 'Tạo mã QR cho link', route: '#tool/qr-multi', isPrimary: true },
      ],
    };
  }

  // 3. Plain text
  if (text) {
    return {
      type: SharePayloadType.PLAIN_TEXT,
      recommendations: [
        { label: 'Tạo mã QR văn bản', route: '#tool/qr-multi', isPrimary: true },
        { label: 'Tính mã băm', route: '#tool/hash-checksum' },
      ],
    };
  }

  return { type: SharePayloadType.PLAIN_TEXT, recommendations: [] };
}
