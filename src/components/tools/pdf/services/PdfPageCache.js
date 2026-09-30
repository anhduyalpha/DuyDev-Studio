/**
 * PdfPageCache - In-Memory Singleton LRU Cache for Rendered PDF Page Bitmaps
 * Provides instant 0ms restoration for continuous thumbnail displays.
 * Strictly enforces single responsibility and resource cleanup.
 */

export class PdfPageCache {
  /**
   * @param {number} maxCapacity Maximum number of page bitmaps to keep in memory (default 64)
   */
  constructor(maxCapacity = 64) {
    this.maxCapacity = Math.max(1, maxCapacity);
    /** @type {Map<string, { bitmap: any, width: number, height: number, timestamp: number }>} */
    this.cache = new Map();
  }

  /**
   * Standard key generator for a rendered PDF page thumbnail
   * @param {object|string} fileOrId File object or file identifier string
   * @param {number} pageIndex 0-based page index
   * @param {number} [rotation=0] Visual rotation angle in degrees
   * @param {number} [scale=1] Render scale or resolution factor
   * @returns {string} Formatted cache key: `${fileId}_p${pageIndex}_r${rotation}_s${scale}`
   */
  buildKey(fileOrId, pageIndex, rotation = 0, scale = 1) {
    const fileId = typeof fileOrId === 'string'
      ? fileOrId
      : (fileOrId?.id || fileOrId?.name || 'pdf_doc');
    return `${fileId}_p${pageIndex}_r${rotation || 0}_s${scale || 1}`;
  }

  /**
   * Resolves arguments into a normalized string key
   * @private
   */
  _resolveKey(keyOrFile, pageIndex, rotation, scale) {
    if (typeof keyOrFile === 'string' && pageIndex === undefined) {
      return keyOrFile;
    }
    return this.buildKey(keyOrFile, pageIndex, rotation, scale);
  }

  /**
   * Checks whether a rendered bitmap exists in the cache
   * @param {string|object} keyOrFile Cache key or File object
   * @param {number} [pageIndex] 0-based page index (if file passed)
   * @param {number} [rotation=0]
   * @param {number} [scale=1]
   * @returns {boolean}
   */
  has(keyOrFile, pageIndex, rotation = 0, scale = 1) {
    const key = this._resolveKey(keyOrFile, pageIndex, rotation, scale);
    return this.cache.has(key);
  }

  /**
   * Synchronously retrieves a cached page bitmap and marks it as Most Recently Used
   * @param {string|object} keyOrFile Cache key or File object
   * @param {number} [pageIndex] 0-based page index (if file passed)
   * @param {number} [rotation=0]
   * @param {number} [scale=1]
   * @returns {{ bitmap: any, width: number, height: number, timestamp: number } | null}
   */
  get(keyOrFile, pageIndex, rotation = 0, scale = 1) {
    const key = this._resolveKey(keyOrFile, pageIndex, rotation, scale);
    if (!this.cache.has(key)) {
      return null;
    }
    const entry = this.cache.get(key);
    // Refresh LRU position by deleting and re-inserting at tail
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Stores a rendered page bitmap in the cache with LRU eviction
   * @param {string|object} keyOrFile Cache key or File object
   * @param {any} data Rendered bitmap, canvas, or object containing bitmap, width, height
   * @param {number} [pageIndex]
   * @param {number} [rotation=0]
   * @param {number} [scale=1]
   */
  set(keyOrFile, data, pageIndex, rotation = 0, scale = 1) {
    if (!data) return;
    const key = this._resolveKey(keyOrFile, pageIndex, rotation, scale);

    // If key already exists, evict old entry cleanly first
    if (this.cache.has(key)) {
      this.evict(key);
    } else if (this.cache.size >= this.maxCapacity) {
      // Evict oldest entry (first item in insertion order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.evict(oldestKey);
      }
    }

    let entry;
    if (data.bitmap) {
      entry = {
        bitmap: data.bitmap,
        width: Number(data.width || data.bitmap.width || 0),
        height: Number(data.height || data.bitmap.height || 0),
        timestamp: Date.now()
      };
    } else if (typeof data.width === 'number' && typeof data.height === 'number') {
      entry = {
        bitmap: data,
        width: data.width,
        height: data.height,
        timestamp: Date.now()
      };
    } else {
      entry = {
        bitmap: data,
        width: 0,
        height: 0,
        timestamp: Date.now()
      };
    }

    this.cache.set(key, entry);
  }

  /**
   * Evicts a single entry from the cache and releases underlying GPU/ImageBitmap memory
   * @param {string} key Cache key
   * @returns {boolean} True if evicted
   */
  evict(key) {
    if (!this.cache.has(key)) return false;
    const entry = this.cache.get(key);
    this.cache.delete(key);
    if (entry?.bitmap && typeof entry.bitmap.close === 'function') {
      try {
        entry.bitmap.close();
      } catch {}
    }
    return true;
  }

  /**
   * Releases all cached page bitmaps associated with a specific file
   * @param {string|object} fileOrId File object or file identifier
   * @returns {number} Number of evicted entries
   */
  releaseForFile(fileOrId) {
    const fileId = typeof fileOrId === 'string'
      ? fileOrId
      : (fileOrId?.id || fileOrId?.name);
    if (!fileId) return 0;

    const prefix = `${fileId}_p`;
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        if (this.evict(key)) count++;
      }
    }
    return count;
  }

  /**
   * Clears the entire cache and releases all bitmaps
   */
  clear() {
    for (const entry of this.cache.values()) {
      if (entry?.bitmap && typeof entry.bitmap.close === 'function') {
        try {
          entry.bitmap.close();
        } catch {}
      }
    }
    this.cache.clear();
  }

  /**
   * Current number of cached items
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }
}

export const pdfPageCache = new PdfPageCache(64);
export default pdfPageCache;
