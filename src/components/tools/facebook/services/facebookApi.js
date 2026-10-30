/**
 * Facebook API Client Service
 */

export const facebookApi = {
  /**
   * Resolves a Facebook URL to metadata and direct stream URLs
   * @param {string} url 
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<any>}
   */
  async resolveVideo(url, options = {}) {
    const res = await fetch('/api/v1/facebook/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: options.signal
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const errMsg = json.message ||
        (typeof json.error === 'string' ? json.error : json.error?.message) ||
        `Không thể trích xuất video Facebook (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return json.data;
  },

  /**
   * Checks if video already exists in Studio Drive
   * @param {{ url?: string, id?: string }} payload
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<{ exists: boolean, item?: any }>}
   */
  async checkDuplicate(payload, options = {}) {
    try {
      const res = await fetch('/api/v1/facebook/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options.signal
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) return { exists: false };
      return json.data || { exists: false };
    } catch {
      return { exists: false };
    }
  },

  /**
   * Builds the stream proxy URL for smooth playback and downloads
   * @param {string} videoUrl 
   * @param {string} [filename] 
   * @param {boolean} [download=false] 
   * @returns {string}
   */
  getStreamUrl(videoUrl, filename = 'facebook_video.mp4', download = false) {
    if (!videoUrl) return '';
    const params = new URLSearchParams({
      url: videoUrl,
      filename: filename,
      download: download ? '1' : '0'
    });
    return `/api/v1/facebook/stream?${params.toString()}`;
  },

  /**
   * Saves the video stream directly into DD Studio Drive
   * @param {{ url: string, title?: string, id?: string, quality?: string }} payload 
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<{ success: boolean, data: { fileName: string, relPath: string, sizeBytes: number, fileId: string } }>}
   */
  async saveToDrive(payload, options = {}) {
    const res = await fetch('/api/v1/facebook/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const errMsg = json.message ||
        (typeof json.error === 'string' ? json.error : json.error?.message) ||
        `Lỗi khi lưu video Facebook vào Drive (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return json;
  }
};
