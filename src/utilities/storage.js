/**
 * Persistent Store for Tasks, History & Trash Bin (< 200 lines)
 * Synchronizes with Fastify /api/v1/history & /api/v1/trash with deduplication
 */

import { getDeviceId } from './deviceId.js';

export const STORAGE_KEYS = {
  HISTORY: 'ds_job_history_v2',
  TRASH: 'ds_trash_v2',
  SETTINGS: 'ds_settings_v2'
};

function normalizeHistoryItem(item) {
  if (!item) return item;
  if (!item.toolId && item.tool) item.toolId = item.tool;
  if (!item.toolTitle && item.tool) item.toolTitle = item.tool;
  if ((!item.resultSize || item.resultSize === 0) && item.downloadUrl && item.downloadUrl.startsWith('data:image')) {
    const b64 = item.downloadUrl.split(',')[1] || '';
    item.resultSize = Math.round(b64.length * 0.75) || 1200;
  }
  if (item.detailsJson && typeof item.detailsJson === 'string') {
    try {
      const details = JSON.parse(item.detailsJson);
      if (details && typeof details === 'object') {
        if (!item.cover && details.cover) item.cover = details.cover;
        if (!item.thumbnail && details.thumbnail) item.thumbnail = details.thumbnail;
        if (!item.author && details.author) item.author = details.author;
        if (!item.artist && details.artist) item.artist = details.artist;
        if (!item.duration && details.duration) item.duration = details.duration;
        if (!item.driveRelPath && details.driveRelPath) item.driveRelPath = details.driveRelPath;
        if (!item.originalUrl && details.originalUrl) item.originalUrl = details.originalUrl;
        if (!item.quality && details.quality) item.quality = details.quality;
        if (!item.mediaType && details.mediaType) item.mediaType = details.mediaType;
        if (!item.viewUrl && details.viewUrl) item.viewUrl = details.viewUrl;
        if (!item.videoHdUrl && details.videoHdUrl) item.videoHdUrl = details.videoHdUrl;
        if (!item.videoSdUrl && details.videoSdUrl) item.videoSdUrl = details.videoSdUrl;
      }
    } catch {}
  }
  return item;
}

function mergeHistoryItems(primary, secondary) {
  if (!secondary) return primary;
  if (!primary) return secondary;
  return {
    ...secondary,
    ...primary,
    cover: primary.cover || secondary.cover || null,
    thumbnail: primary.thumbnail || secondary.thumbnail || primary.cover || secondary.cover || null,
    author: primary.author || secondary.author || null,
    artist: primary.artist || secondary.artist || null,
    duration: primary.duration || secondary.duration || null,
    driveRelPath: primary.driveRelPath || secondary.driveRelPath || null,
    originalUrl: primary.originalUrl || secondary.originalUrl || null,
    quality: primary.quality || secondary.quality || null,
    mediaType: primary.mediaType || secondary.mediaType || null,
    viewUrl: primary.viewUrl || secondary.viewUrl || null,
    videoHdUrl: primary.videoHdUrl || secondary.videoHdUrl || null,
    videoSdUrl: primary.videoSdUrl || secondary.videoSdUrl || null,
    detailsJson: primary.detailsJson || secondary.detailsJson || null
  };
}

function deduplicateList(items) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const raw of items) {
    const item = normalizeHistoryItem(raw);
    if (!item) continue;
    // Strict deduplication key:
    // 1) Match by toolId + clean originalUrl
    // 2) Match by non-data downloadUrl
    // 3) Match by fileName + 60s creation timestamp
    // 4) Fallback to id
    let key = '';
    if (item.toolId && item.originalUrl) {
      const cleanUrl = String(item.originalUrl).split('?')[0].replace(/\/$/, '').toLowerCase();
      key = `${item.toolId.toLowerCase().replace(/-downloader$/, '')}:${cleanUrl}`;
    } else if (item.downloadUrl && !item.downloadUrl.startsWith('data:')) {
      const cleanUrl = String(item.downloadUrl).split('?')[0].replace(/\/$/, '').toLowerCase();
      key = cleanUrl;
    } else if (item.fileName && item.createdAt) {
      const timeBucket = Math.floor(new Date(item.createdAt).getTime() / 60000);
      key = `${(item.toolId || 'job').toLowerCase()}:${item.fileName}:${timeBucket}`;
    } else if (item.id) {
      key = String(item.id);
    }
    if (!key) continue;

    if (map.has(key)) {
      map.set(key, mergeHistoryItems(map.get(key), item));
    } else {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

export function dispatchHistoryUpdated(toolId, action, item = null) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('dd:history-updated', {
        detail: {
          toolId: toolId || null,
          action: action || 'update',
          item: item || null,
          timestamp: Date.now()
        }
      }));
    } catch (_) {}
  }
}

export const storage = {
  getLocalHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? deduplicateList(JSON.parse(data)) : [];
    } catch { return []; }
  },

  getHistory() { return this.getLocalHistory(); },

  getToolHistory(toolId) {
    if (!toolId) return this.getLocalHistory();
    const target = String(toolId).toLowerCase().replace(/-downloader$/, '').trim();
    return this.getLocalHistory().filter(item => {
      if (!item) return false;
      const tid = String(item.toolId || item.tool || '').toLowerCase().replace(/-downloader$/, '').trim();
      return tid === target || tid === `${target}-downloader` || target === `${tid}-downloader`;
    });
  },

  getLocalTrash() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRASH);
      return data ? deduplicateList(JSON.parse(data)) : [];
    } catch { return []; }
  },

  getToolTrash(toolId) {
    if (!toolId) return this.getLocalTrash();
    const target = String(toolId).toLowerCase().replace(/-downloader$/, '').trim();
    return this.getLocalTrash().filter(item => {
      if (!item) return false;
      const tid = String(item.toolId || item.tool || '').toLowerCase().replace(/-downloader$/, '').trim();
      return tid === target || tid === `${target}-downloader` || target === `${tid}-downloader`;
    });
  },

  updateItemDrivePath(idOrUrl, relPath) {
    if (!idOrUrl || !relPath) return;
    const normalizedPath = relPath.startsWith('/') ? relPath : `/${relPath}`;
    try {
      const history = this.getLocalHistory();
      let changed = false;
      let matchedItem = null;
      history.forEach(item => {
        const idMatches = String(item.id) === String(idOrUrl) ||
          String(item.id).includes(String(idOrUrl)) ||
          String(idOrUrl).includes(String(item.id));
        const urlMatches = (item.downloadUrl && (item.downloadUrl === idOrUrl || item.downloadUrl.includes(String(idOrUrl)))) ||
          (item.originalUrl && (item.originalUrl === idOrUrl || item.originalUrl.includes(String(idOrUrl))));
        const fileMatches = item.fileName && (String(idOrUrl).includes(item.fileName) || item.fileName.includes(String(idOrUrl)));

        if (idMatches || urlMatches || fileMatches) {
          item.driveRelPath = normalizedPath;
          if (item.detailsJson) {
            try {
              const details = JSON.parse(item.detailsJson);
              details.driveRelPath = normalizedPath;
              item.detailsJson = JSON.stringify(details);
            } catch {}
          }
          changed = true;
          matchedItem = item;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        dispatchHistoryUpdated(matchedItem?.toolId, 'update-drive', matchedItem);
        // Synchronize updated drive link to Fastify backend history
        if (matchedItem) {
          const deviceId = getDeviceId();
          fetch('/api/v1/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-device-id': deviceId
            },
            body: JSON.stringify({
              deviceId,
              toolId: matchedItem.toolId || 'general',
              toolTitle: matchedItem.toolTitle || matchedItem.tool || 'Công cụ',
              fileName: matchedItem.fileName || 'Tài liệu',
              downloadUrl: matchedItem.downloadUrl || null,
              status: matchedItem.status || 'success',
              detailsJson: matchedItem.detailsJson || JSON.stringify({ driveRelPath: normalizedPath })
            })
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[storage] Failed to update history drive path:', e);
    }
  },

  async clearToolHistoryToTrash(toolId) {
    const items = this.getToolHistory(toolId);
    if (!items.length) return;
    this.moveItemsToTrashSync(items.map(i => i.id));
    dispatchHistoryUpdated(toolId, 'clear-tool');
    try {
      const deviceId = getDeviceId();
      await Promise.all(items.map(async item => {
        const res = await fetch(`/api/v1/history/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': deviceId }
        }).catch(() => null);
        if ((!res || !res.ok) && item.downloadUrl) {
          await fetch(`/api/v1/history/${encodeURIComponent(item.downloadUrl)}`, {
            method: 'DELETE',
            headers: { 'x-device-id': deviceId }
          }).catch(() => {});
        }
      }));
    } catch {}
  },

  async fetchHistory() {
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/v1/history?limit=50&deviceId=${encodeURIComponent(deviceId)}`, {
        headers: { 'x-device-id': deviceId }
      });
      if (res.ok) {
        const json = await res.json();
        const serverItems = deduplicateList(json.data?.items || []);
        const localItems = this.getLocalHistory();
        const merged = deduplicateList([...localItems, ...serverItems]);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(merged.slice(0, 50)));
        return merged;
      }
    } catch (e) {
      console.warn('Failed to fetch history from server', e);
    }
    return this.getLocalHistory();
  },

  recordCompletedJob(record) {
    if (!record) return;
    let size = record.resultSize || 0;
    if (!size && record.downloadUrl?.startsWith('data:image')) {
      size = Math.round((record.downloadUrl.split(',')[1] || '').length * 0.75) || 1200;
    }

    const authorVal = typeof record.author === 'string'
      ? record.author
      : (record.author?.name || record.author?.username || record.author?.channel || (typeof record.artist === 'string' ? record.artist : null));

    const artistVal = typeof record.artist === 'string'
      ? record.artist
      : (record.artist?.name || authorVal || null);

    const detailsObj = {
      mode: record.mode,
      savedPct: record.savedPct,
      targetFormat: record.targetFormat,
      cover: record.cover || record.thumbnail || null,
      thumbnail: record.thumbnail || record.cover || null,
      author: authorVal,
      artist: artistVal,
      duration: record.duration || null,
      driveRelPath: record.driveRelPath || null,
      originalUrl: record.originalUrl || record.url || null,
      quality: record.quality || null,
      mediaType: record.mediaType || null,
      viewUrl: record.viewUrl || null,
      videoHdUrl: record.videoHdUrl || null,
      videoSdUrl: record.videoSdUrl || null
    };

    const detailsJsonString = typeof record.detailsJson === 'string'
      ? record.detailsJson
      : JSON.stringify(detailsObj);

    const itemPayload = {
      id: record.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool: record.tool || record.toolTitle || 'Công cụ',
      toolTitle: record.toolTitle || record.tool || 'Công cụ',
      toolId: record.toolId || 'general',
      fileName: record.fileName || 'Tài liệu',
      originalSize: record.originalSize || 0,
      resultSize: size,
      savedPct: record.savedPct || 0,
      mode: record.mode || null,
      targetFormat: record.targetFormat || null,
      downloadUrl: record.downloadUrl || null,
      resultFileId: record.resultFileId || null,
      status: record.status || 'success',
      createdAt: record.createdAt || new Date().toISOString(),
      cover: detailsObj.cover,
      thumbnail: detailsObj.thumbnail,
      author: detailsObj.author,
      artist: detailsObj.artist,
      duration: detailsObj.duration,
      driveRelPath: detailsObj.driveRelPath,
      originalUrl: detailsObj.originalUrl,
      quality: detailsObj.quality,
      mediaType: detailsObj.mediaType,
      viewUrl: detailsObj.viewUrl,
      videoHdUrl: detailsObj.videoHdUrl,
      videoSdUrl: detailsObj.videoSdUrl,
      detailsJson: detailsJsonString
    };

    try {
      const list = this.getLocalHistory();
      const existingIndex = list.findIndex(i =>
        (record.id && i.id === record.id) ||
        (record.downloadUrl && i.downloadUrl === record.downloadUrl) ||
        (record.originalUrl && i.originalUrl && i.originalUrl === record.originalUrl)
      );

      if (existingIndex !== -1) {
        list[existingIndex] = { ...list[existingIndex], ...itemPayload };
      } else {
        list.unshift(itemPayload);
      }
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList(list).slice(0, 50)));
      dispatchHistoryUpdated(itemPayload.toolId, 'record', itemPayload);
    } catch (e) {
      console.warn('Failed to record completed job locally', e);
    }

    // Sync to Fastify backend /api/v1/history with user's X-Device-Id
    try {
      const deviceId = getDeviceId();
      fetch('/api/v1/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        body: JSON.stringify({
          deviceId,
          toolId: record.toolId || 'general',
          toolTitle: record.toolTitle || record.tool || 'Công cụ',
          fileName: record.fileName || 'Tài liệu',
          originalSize: record.originalSize || 0,
          resultSize: size,
          downloadUrl: record.downloadUrl || null,
          resultFileId: record.resultFileId || null,
          status: record.status || 'success',
          detailsJson: detailsJsonString
        })
      }).then(async res => {
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.data?.id) {
            const list = this.getLocalHistory();
            const target = list.find(x => x.id === itemPayload.id || (x.downloadUrl && x.downloadUrl === itemPayload.downloadUrl));
            if (target) {
              target.id = json.data.id;
              localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
            }
          }
        }
      }).catch(() => {});
    } catch {}
  },

  async addHistoryItem(item) {
    let size = item.resultSize || 0;
    if (!size && item.downloadUrl?.startsWith('data:image')) {
      size = Math.round((item.downloadUrl.split(',')[1] || '').length * 0.75) || 1200;
    }

    const localRecord = {
      id: item.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool: item.tool || item.toolTitle || 'Công cụ',
      toolTitle: item.toolTitle || item.tool || 'Công cụ',
      toolId: item.toolId || 'general',
      fileName: item.fileName || 'Tài liệu',
      originalSize: item.originalSize || 0,
      resultSize: size,
      downloadUrl: item.downloadUrl || null,
      resultFileId: item.resultFileId || null,
      status: item.status || 'success',
      createdAt: new Date().toISOString()
    };

    try {
      const list = this.getLocalHistory();
      list.unshift(localRecord);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList(list).slice(0, 50)));
      dispatchHistoryUpdated(localRecord.toolId, 'add', localRecord);
    } catch {}

    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        body: JSON.stringify({
          deviceId,
          toolId: item.toolId || 'general',
          toolTitle: item.toolTitle || item.tool || 'Công cụ',
          fileName: item.fileName || 'Tài liệu',
          originalSize: item.originalSize || 0,
          resultSize: size,
          downloadUrl: item.downloadUrl || null,
          resultFileId: item.resultFileId || null,
          status: item.status || 'success'
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.id) {
          localRecord.id = json.data.id;
          const currentList = this.getLocalHistory();
          const target = currentList.find(x => x.downloadUrl === localRecord.downloadUrl);
          if (target) target.id = json.data.id;
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList(currentList).slice(0, 50)));
        }
      }
    } catch {}
    return localRecord;
  },

  moveToTrashSync(id) {
    let trashedItem = null;
    try {
      const historyList = this.getLocalHistory();
      const itemIndex = historyList.findIndex(item => item.id === id || (item.downloadUrl && item.downloadUrl === id));
      if (itemIndex !== -1) {
        trashedItem = { ...historyList[itemIndex], deletedAt: new Date().toISOString() };
        historyList.splice(itemIndex, 1);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyList));
      }
      if (trashedItem) {
        const trashList = this.getLocalTrash();
        trashList.unshift(trashedItem);
        localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(deduplicateList(trashList).slice(0, 50)));
        dispatchHistoryUpdated(trashedItem?.toolId, 'trash', trashedItem);
      }
    } catch {}
    return trashedItem;
  },

  moveItemsToTrashSync(ids) {
    try {
      const idSet = new Set(ids);
      const historyList = this.getLocalHistory();
      const trashList = this.getLocalTrash();
      const now = new Date().toISOString();
      const newlyTrashed = [];
      const remainingHistory = [];

      for (const item of historyList) {
        if (idSet.has(item.id) || (item.downloadUrl && idSet.has(item.downloadUrl))) {
          newlyTrashed.push({ ...item, deletedAt: now });
        } else {
          remainingHistory.push(item);
        }
      }

      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(remainingHistory));
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(deduplicateList([...newlyTrashed, ...trashList]).slice(0, 50)));
      dispatchHistoryUpdated(null, 'trash-multiple');
    } catch {}
  },

  async moveToTrash(id) {
    const trashedItem = this.moveToTrashSync(id);
    try {
      const deviceId = getDeviceId();
      const targetId = trashedItem?.id || id;
      const res = await fetch(`/api/v1/history/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: { 'x-device-id': deviceId }
      });
      if (!res.ok && trashedItem?.downloadUrl && trashedItem.downloadUrl !== targetId) {
        await fetch(`/api/v1/history/${encodeURIComponent(trashedItem.downloadUrl)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': deviceId }
        }).catch(() => {});
      }
    } catch {}
    return trashedItem;
  },

  clearHistoryToTrashSync() {
    try {
      const historyList = this.getLocalHistory();
      const trashList = this.getLocalTrash();
      const now = new Date().toISOString();
      const newlyTrashed = historyList.map(h => ({ ...h, deletedAt: now }));
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(deduplicateList([...newlyTrashed, ...trashList]).slice(0, 50)));
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      dispatchHistoryUpdated(null, 'clear-all-trash');
    } catch {}
  },

  async clearHistoryToTrash() {
    this.clearHistoryToTrashSync();
    try {
      const deviceId = getDeviceId();
      await fetch('/api/v1/history', {
        method: 'DELETE',
        headers: { 'x-device-id': deviceId }
      });
    } catch {}
  },

  async fetchTrash() {
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/v1/trash?limit=50&deviceId=${encodeURIComponent(deviceId)}`, {
        headers: { 'x-device-id': deviceId }
      });
      if (res.ok) {
        const json = await res.json();
        const items = deduplicateList(json.data?.items || []);
        localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(items.slice(0, 50)));
        return items;
      }
    } catch (e) {
      console.warn('Failed to fetch trash from server', e);
    }
    return this.getLocalTrash();
  },

  restoreTrashItemSync(id) {
    let restored = null;
    try {
      const trashList = this.getLocalTrash();
      const idx = trashList.findIndex(item => item.id === id || (item.downloadUrl && item.downloadUrl === id));
      if (idx !== -1) {
        restored = { ...trashList[idx] };
        delete restored.deletedAt;
        trashList.splice(idx, 1);
        localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(trashList));
        const historyList = this.getLocalHistory();
        historyList.unshift(restored);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList(historyList).slice(0, 50)));
        dispatchHistoryUpdated(restored?.toolId, 'restore', restored);
      }
    } catch {}
    return restored;
  },

  restoreItemsFromTrashSync(ids) {
    try {
      const idSet = new Set(ids);
      const trashList = this.getLocalTrash();
      const historyList = this.getLocalHistory();
      const restored = [];
      const remainingTrash = [];

      for (const item of trashList) {
        if (idSet.has(item.id) || (item.downloadUrl && idSet.has(item.downloadUrl))) {
          const c = { ...item };
          delete c.deletedAt;
          restored.push(c);
        } else {
          remainingTrash.push(item);
        }
      }

      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(remainingTrash));
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList([...restored, ...historyList]).slice(0, 50)));
      dispatchHistoryUpdated(null, 'restore-multiple');
    } catch {}
  },

  async restoreTrashItem(id) {
    const restored = this.restoreTrashItemSync(id);
    try {
      const deviceId = getDeviceId();
      const targetId = restored?.id || id;
      let res = await fetch(`/api/v1/trash/${encodeURIComponent(targetId)}/restore`, {
        method: 'POST',
        headers: { 'x-device-id': deviceId }
      });
      if (!res.ok && restored?.downloadUrl && restored.downloadUrl !== targetId) {
        res = await fetch(`/api/v1/trash/${encodeURIComponent(restored.downloadUrl)}/restore`, {
          method: 'POST',
          headers: { 'x-device-id': deviceId }
        });
      }
      return res.ok;
    } catch { return false; }
  },

  restoreAllTrashSync() {
    try {
      const restored = this.getLocalTrash().map(t => { const c = { ...t }; delete c.deletedAt; return c; });
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList([...restored, ...this.getLocalHistory()]).slice(0, 50)));
      localStorage.removeItem(STORAGE_KEYS.TRASH);
      dispatchHistoryUpdated(null, 'restore-all');
    } catch {}
  },

  async restoreAllTrash() {
    this.restoreAllTrashSync();
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/trash/restore-all', {
        method: 'POST',
        headers: { 'x-device-id': deviceId }
      });
      return res.ok;
    } catch { return false; }
  },

  permanentlyDeleteTrashItemSync(id) {
    try {
      const trashList = this.getLocalTrash().filter(item => item.id !== id && item.downloadUrl !== id);
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(trashList));
      dispatchHistoryUpdated(null, 'delete-permanent');
    } catch {}
  },

  permanentlyDeleteItemsSync(ids) {
    try {
      const idSet = new Set(ids);
      const trashList = this.getLocalTrash().filter(item => !idSet.has(item.id) && !idSet.has(item.downloadUrl));
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(trashList));
      dispatchHistoryUpdated(null, 'delete-multiple');
    } catch {}
  },

  async permanentlyDeleteTrashItem(id) {
    const trashList = this.getLocalTrash();
    const item = trashList.find(x => x.id === id || x.downloadUrl === id);
    this.permanentlyDeleteTrashItemSync(id);
    try {
      const deviceId = getDeviceId();
      let res = await fetch(`/api/v1/trash/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-device-id': deviceId }
      });
      if (!res.ok && item?.downloadUrl && item.downloadUrl !== id) {
        await fetch(`/api/v1/trash/${encodeURIComponent(item.downloadUrl)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': deviceId }
        });
      }
      return res.ok;
    } catch { return false; }
  },

  emptyTrashSync() {
    try {
      localStorage.removeItem(STORAGE_KEYS.TRASH);
      dispatchHistoryUpdated(null, 'empty-trash');
    } catch {}
  },

  async emptyTrash() {
    this.emptyTrashSync();
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/v1/trash', {
        method: 'DELETE',
        headers: { 'x-device-id': deviceId }
      });
      return res.ok;
    } catch { return false; }
  }
};
