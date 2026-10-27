/**
 * Spotify API Client Service
 */

export const spotifyApi = {
  /**
   * Resolves a Spotify track URL to metadata and audio stream
   * @param {string} url 
   * @param {boolean} [refresh=false]
   * @returns {Promise<any>}
   */
  async resolveTrack(url, refresh = false) {
    const res = await fetch('/api/v1/spotify/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, refresh })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const errMsg = json.message ||
        (typeof json.error === 'string' ? json.error : json.error?.message) ||
        `Không thể trích xuất thông tin bài hát Spotify (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return json.data;
  },

  /**
   * Checks if audio track already exists in Studio Drive
   * @param {{ url?: string, id?: string, title?: string }} payload
   * @returns {Promise<{ exists: boolean, item?: any }>}
   */
  async checkDuplicate(payload) {
    try {
      const res = await fetch('/api/v1/spotify/check-duplicate', {
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
   * Builds the stream proxy URL for smooth audio playback and MP3 download
   * @param {string} audioUrl 
   * @param {string} [filename] 
   * @param {boolean} [download=false] 
   * @returns {string}
   */
  getStreamUrl(audioUrl, filename = 'spotify_track.mp3', download = false) {
    if (!audioUrl) return '';
    const params = new URLSearchParams({
      url: audioUrl,
      filename: filename,
      download: download ? '1' : '0'
    });
    return `/api/v1/spotify/stream?${params.toString()}`;
  },

  /**
   * Saves the MP3 track directly into DD Studio Drive
   * @param {{ url: string, title?: string, artist?: string, album?: string, cover?: string, audioUrl?: string }} payload 
   * @returns {Promise<{ success: boolean, data: { fileName: string, relPath: string, sizeBytes: number, fileSizeInMb: string, fileId: string } }>}
   */
  async saveToDrive(payload) {
    const res = await fetch('/api/v1/spotify/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const errMsg = json.message ||
        (typeof json.error === 'string' ? json.error : json.error?.message) ||
        `Lỗi khi lưu bài hát Spotify vào Drive (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return json;
  }
};
