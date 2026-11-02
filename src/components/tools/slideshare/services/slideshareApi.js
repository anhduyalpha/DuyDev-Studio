/**
 * slideshareApi.js - SlideShare API Client
 */

function parseApiError(json, fallback) {
  if (typeof json.message === 'string' && json.message.trim()) return json.message.trim();
  if (typeof json.error === 'string' && json.error.trim()) return json.error.trim();
  if (json.error && typeof json.error.message === 'string' && json.error.message.trim()) {
    return json.error.message.trim();
  }
  return fallback;
}

export const slideshareApi = {
  async resolve(url, options = {}) {
    const res = await fetch('/api/v1/slideshare/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: options.signal
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(parseApiError(json, `Lỗi phân tích SlideShare (HTTP ${res.status})`));
    }
    return json.data;
  },

  async checkDuplicate(payload) {
    try {
      const res = await fetch('/api/v1/slideshare/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) return { exists: false };
      return json.data || { exists: false };
    } catch {
      return { exists: false };
    }
  },

  async saveToDrive(payload) {
    const res = await fetch('/api/v1/slideshare/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(parseApiError(json, 'Lỗi lưu tài liệu vào Studio Drive'));
    }
    return json.data;
  },

  getStreamUrl(pdfUrl, filename = 'slideshare_presentation.pdf', download = false) {
    if (!pdfUrl) return '';
    const params = new URLSearchParams({
      url: pdfUrl,
      filename,
      download: download ? 'true' : 'false'
    });
    return `/api/v1/slideshare/stream?${params.toString()}`;
  }
};
