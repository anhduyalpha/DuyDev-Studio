/**
 * Shared client-side JSZip loader & ZIP bundle downloader for Media workspaces
 * (Instagram Carousel, Facebook Albums, TikTok/Douyin Slideshows).
 */

import { showToast } from './toast.js';

export function buildSafeMediaFilename(title, fallback, ext) {
  const clean = String(title || '')
    .replace(/[\\/:*?"<>|#\r\n\t]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .replace(/^_+|_+$/g, '');
  return `${clean || fallback}.${ext}`;
}

export async function ensureJSZip() {
  if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="jszip"]');
    if (existing) {
      if (window.JSZip) return resolve(window.JSZip);
      existing.addEventListener('load', () => resolve(window.JSZip));
      existing.addEventListener('error', () => reject(new Error('Không thể nạp thư viện JSZip')));
      return;
    }
    const script = document.createElement('script');
    script.src = '/src/vendor/jszip.min.js';
    script.onload = () => {
      if (window.JSZip) resolve(window.JSZip);
      else reject(new Error('JSZip không khởi tạo được trên trình duyệt'));
    };
    script.onerror = () => reject(new Error('Không thể nạp thư viện JSZip từ máy chủ'));
    document.head.appendChild(script);
  });
}

/**
 * Fetches ordered proxied media items, packages into a ZIP archive, and saves via APK bridge or Blob anchor.
 * @param {Array<{ url: string, name: string }>} entries
 * @param {string} zipFileName
 * @param {(statusText: string) => void} [onProgress]
 */
export async function downloadMediaZip(entries, zipFileName, onProgress) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Không tìm thấy tệp nào để đóng gói');
  }
  onProgress?.('Đang khởi tạo thư viện nén...');
  const JSZipLib = await ensureJSZip();
  const zip = new JSZipLib();

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    onProgress?.(`Đang tải tệp ${i + 1}/${entries.length}...`);
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Lỗi tải ${item.name} (${res.status})`);
    zip.file(item.name, await res.blob());
  }

  onProgress?.('Đang nén tệp .ZIP...');
  const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    if (typeof meta.percent === 'number') {
      onProgress?.(`Đang nén ${Math.round(meta.percent)}%...`);
    }
  });

  if (window.AndroidBridge?.saveBase64File) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = String(reader.result || '').split(',')[1] || '';
      if (base64data) {
        window.AndroidBridge.saveBase64File(base64data, zipFileName, 'application/zip');
        showToast('Đã lưu album ZIP vào máy!', 'success');
      }
    };
    reader.readAsDataURL(zipBlob);
  } else {
    const blobUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = zipFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    showToast('Tải toàn bộ album ZIP thành công!', 'success');
  }
}
