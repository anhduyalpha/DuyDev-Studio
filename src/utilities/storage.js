/**
 * Persistent Store for Tasks, History & Trash Bin (< 200 lines)
 * Synchronizes with Fastify /api/v1/history & /api/v1/trash with deduplication
 */

export const STORAGE_KEYS = {
  HISTORY: 'ds_job_history_v2',
  TRASH: 'ds_trash_v2',
  SETTINGS: 'ds_settings_v2'
};

function normalizeHistoryItem(item) {
  if (!item) return item;
  if ((!item.resultSize || item.resultSize === 0) && item.downloadUrl && item.downloadUrl.startsWith('data:image')) {
    const b64 = item.downloadUrl.split(',')[1] || '';
    item.resultSize = Math.round(b64.length * 0.75) || 1200;
  }
  return item;
}

function deduplicateList(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.map(normalizeHistoryItem).filter(item => {
    if (!item) return false;
    const key = item.downloadUrl || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const storage = {
  getLocalHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? deduplicateList(JSON.parse(data)) : [];
    } catch { return []; }
  },

  getHistory() { return this.getLocalHistory(); },

  getLocalTrash() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRASH);
      return data ? deduplicateList(JSON.parse(data)) : [];
    } catch { return []; }
  },

  async fetchHistory() {
    try {
      const res = await fetch('/api/v1/history?limit=50');
      if (res.ok) {
        const json = await res.json();
        const items = deduplicateList(json.data?.items || []);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(items.slice(0, 50)));
        return items;
      }
    } catch {}
    return this.getLocalHistory();
  },

  recordCompletedJob(record) {
    if (!record) return;
    try {
      const list = this.getLocalHistory();
      const exists = list.some(i => (record.id && i.id === record.id) || (record.downloadUrl && i.downloadUrl === record.downloadUrl));
      if (!exists) {
        let size = record.resultSize || 0;
        if (!size && record.downloadUrl?.startsWith('data:image')) {
          size = Math.round((record.downloadUrl.split(',')[1] || '').length * 0.75) || 1200;
        }
        list.unshift({
          id: record.id || `job-${Date.now()}`,
          tool: record.tool || record.toolTitle || 'Công cụ',
          toolTitle: record.toolTitle || record.tool || 'Công cụ',
          toolId: record.toolId || 'general',
          fileName: record.fileName || 'Tài liệu',
          originalSize: record.originalSize || 0,
          resultSize: size,
          downloadUrl: record.downloadUrl || null,
          resultFileId: record.resultFileId || null,
          status: record.status || 'success',
          createdAt: record.createdAt || new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList(list).slice(0, 50)));
      }
    } catch (e) {
      console.warn('Failed to record completed job locally', e);
    }
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
    } catch {}

    try {
      const res = await fetch('/api/v1/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    } catch {}
  },

  async moveToTrash(id) {
    const trashedItem = this.moveToTrashSync(id);
    try {
      const targetId = trashedItem?.id || id;
      await fetch(`/api/v1/history/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
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
    } catch {}
  },

  async clearHistoryToTrash() {
    this.clearHistoryToTrashSync();
    try {
      await fetch('/api/v1/history', { method: 'DELETE' });
    } catch {}
  },

  async fetchTrash() {
    try {
      const res = await fetch('/api/v1/trash?limit=50');
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
    } catch {}
  },

  async restoreTrashItem(id) {
    const restored = this.restoreTrashItemSync(id);
    try {
      const targetId = restored?.id || id;
      const res = await fetch(`/api/v1/trash/${encodeURIComponent(targetId)}/restore`, { method: 'POST' });
      return res.ok;
    } catch { return false; }
  },

  restoreAllTrashSync() {
    try {
      const restored = this.getLocalTrash().map(t => { const c = { ...t }; delete c.deletedAt; return c; });
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduplicateList([...restored, ...this.getLocalHistory()]).slice(0, 50)));
      localStorage.removeItem(STORAGE_KEYS.TRASH);
    } catch {}
  },

  async restoreAllTrash() {
    this.restoreAllTrashSync();
    try {
      const res = await fetch('/api/v1/trash/restore-all', { method: 'POST' });
      return res.ok;
    } catch { return false; }
  },

  permanentlyDeleteTrashItemSync(id) {
    try {
      const trashList = this.getLocalTrash().filter(item => item.id !== id && item.downloadUrl !== id);
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(trashList));
    } catch {}
  },

  permanentlyDeleteItemsSync(ids) {
    try {
      const idSet = new Set(ids);
      const trashList = this.getLocalTrash().filter(item => !idSet.has(item.id) && !idSet.has(item.downloadUrl));
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(trashList));
    } catch {}
  },

  async permanentlyDeleteTrashItem(id) {
    this.permanentlyDeleteTrashItemSync(id);
    try {
      const res = await fetch(`/api/v1/trash/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.ok;
    } catch { return false; }
  },

  emptyTrashSync() {
    try {
      localStorage.removeItem(STORAGE_KEYS.TRASH);
    } catch {}
  },

  async emptyTrash() {
    this.emptyTrashSync();
    try {
      const res = await fetch('/api/v1/trash', { method: 'DELETE' });
      return res.ok;
    } catch { return false; }
  }
};
