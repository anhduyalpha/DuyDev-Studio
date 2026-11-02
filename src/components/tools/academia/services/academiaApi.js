/**
 * academiaApi.js - Academia API Client
 */

export const academiaApi = {
  async resolve(url, options = {}) {
    const res = await fetch('/api/v1/academia/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: options.signal
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || `Lỗi phân tích Academia (HTTP ${res.status})`);
    }
    return json.data;
  },

  async checkDuplicate(payload) {
    try {
      const res = await fetch('/api/v1/academia/check-duplicate', {
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
    const res = await fetch('/api/v1/academia/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Lỗi lưu tài liệu vào Studio Drive');
    }
    return json.data;
  },

  getStreamUrl(pdfUrl, filename = 'academia_paper.pdf', download = false) {
    if (!pdfUrl) return '';
    const params = new URLSearchParams({
      url: pdfUrl,
      filename,
      download: download ? 'true' : 'false'
    });
    return `/api/v1/academia/stream?${params.toString()}`;
  }
};
