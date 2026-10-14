/**
 * TikTok API Client Service
 */

export const tiktokApi = {
  /**
   * Resolves a TikTok URL to metadata and direct stream URLs
   * @param {string} url 
   * @returns {Promise<any>}
   */
  async resolveVideo(url) {
    const res = await fetch('/api/v1/tiktok/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Không thể trích xuất video TikTok');
    }
    return json.data;
  },

  /**
   * Checks if a TikTok video or URL already exists physically in Studio Drive
   * @param {{ url?: string, id?: string }} payload
   * @returns {Promise<{ exists: boolean, item?: any }>}
   */
  async checkDuplicate(payload) {
    try {
      const res = await fetch('/api/v1/tiktok/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
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
  getStreamUrl(videoUrl, filename = 'tiktok_video.mp4', download = false) {
    if (!videoUrl) return '';
    const params = new URLSearchParams({
      url: videoUrl,
      filename: filename,
      download: download ? '1' : '0'
    });
    return `/api/v1/tiktok/stream?${params.toString()}`;
  },

  /**
   * Saves the video stream directly into DD Studio Drive
   * @param {{ url: string, title?: string, id?: string }} payload 
   * @returns {Promise<{ success: boolean, data: { fileName: string, relPath: string, sizeBytes: number, fileId: string } }>}
   */
  async saveToDrive(payload) {
    const res = await fetch('/api/v1/tiktok/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Lỗi lưu video vào Drive');
    }
    return json.data;
  }
};
