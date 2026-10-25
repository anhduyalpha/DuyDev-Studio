/**
 * Instagram API Client Service
 */

export const instagramApi = {
  /**
   * Resolves an Instagram URL to metadata and direct stream URLs
   * @param {string} url 
   * @returns {Promise<any>}
   */
  async resolveVideo(url) {
    const res = await fetch('/api/v1/instagram/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const errMsg = json.message ||
        (typeof json.error === 'string' ? json.error : json.error?.message) ||
        `Không thể trích xuất video Instagram (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return json.data;
  },

  /**
   * Checks if media already exists in Studio Drive
   * @param {{ url?: string, id?: string }} payload
   * @returns {Promise<{ exists: boolean, item?: any }>}
   */
  async checkDuplicate(payload) {
    try {
      const res = await fetch('/api/v1/instagram/check-duplicate', {
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

  /**
   * Builds the stream proxy URL for smooth playback and downloads
   * @param {string} mediaUrl 
   * @param {string} [filename] 
   * @param {boolean} [download=false] 
   * @returns {string}
   */
  getStreamUrl(mediaUrl, filename = 'instagram_video.mp4', download = false) {
    if (!mediaUrl) return '';
    const params = new URLSearchParams({
      url: mediaUrl,
      filename: filename,
      download: download ? '1' : '0'
    });
    return `/api/v1/instagram/stream?${params.toString()}`;
  },

  /**
   * Saves the media stream directly into DD Studio Drive
   * @param {{ url: string, title?: string, id?: string }} payload 
   * @returns {Promise<{ success: boolean, data: { fileName: string, relPath: string, sizeBytes: number, fileId: string } }>}
   */
  async saveToDrive(payload) {
    const res = await fetch('/api/v1/instagram/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const errMsg = json.message ||
        (typeof json.error === 'string' ? json.error : json.error?.message) ||
        `Lỗi khi lưu video Instagram vào Drive (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return json;
  }
};
