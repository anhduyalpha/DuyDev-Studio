/**
 * YouTube API Client Service
 * Communicates with DD Studio Fastify Backend (/api/v1/youtube/*)
 */

export const youtubeApi = {
  /**
   * Resolves YouTube video metadata via yt-dlp
   * @param {string} url
   * @returns {Promise<any>}
   */
  async resolve(url) {
    const res = await fetch('/api/v1/youtube/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Không thể trích xuất thông tin video YouTube');
    }
    return json.data;
  },

  /**
   * Downloads video or audio stream via yt-dlp
   * @param {{ url: string, type?: 'video'|'audio', quality?: string, customFilename?: string, saveToDrive?: boolean }} payload
   * @returns {Promise<any>}
   */
  async download(payload) {
    const res = await fetch('/api/v1/youtube/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Quá trình tải video/âm thanh thất bại');
    }
    return json.data;
  },

  /**
   * Saves video or audio directly into personal Storage Drive
   * @param {{ url: string, type?: 'video'|'audio', quality?: string, title?: string, videoId?: string, author?: string, duration?: number, cover?: string, overwrite?: boolean }} payload
   * @returns {Promise<any>}
   */
  async saveToDrive(payload) {
    const res = await fetch('/api/v1/youtube/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Lỗi khi lưu video vào Storage Drive');
    }
    return json.data;
  },

  /**
   * Builds stream or direct download URL
   * @param {string} filename
   * @param {boolean} [download=false]
   * @returns {string}
   */
  getStreamUrl(filename, download = false) {
    if (!filename) return '';
    return `/api/v1/youtube/stream/${encodeURIComponent(filename)}?download=${download ? '1' : '0'}`;
  }
};
