/**
 * Quiz History Helper (< 180 lines)
 * Manages paired Quiz history (Worksheet + Solution pairs) in localStorage
 * with automatic fallback to global storage and server history.
 * Adhering to Rule 1 & Rule 3 (UI Minimalism, Single Responsibility).
 */

import { storage } from '../../../../utilities/storage.js';

export const QUIZ_HISTORY_KEY = 'ds_quiz_history_v1';

/**
 * Normalizes and validates a paired quiz history item.
 * @param {object} item
 * @returns {object|null}
 */
function normalizeQuizPair(item) {
  if (!item || typeof item !== 'object') return null;
  const ws = item.worksheet || {};
  const ans = item.answer || {};

  if (!ws.fileId && !ws.downloadUrl && !ans.fileId && !ans.downloadUrl) {
    return null;
  }

  return {
    id: item.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Number(item.timestamp) || Date.now(),
    createdAt: item.createdAt || new Date().toISOString(),
    prefix: item.prefix || item.title || 'Bài tập',
    title: item.title || 'Bài tập trắc nghiệm',
    count: Number(item.count) || 20,
    pages: item.pages || '',
    worksheet: {
      fileId: ws.fileId || ws.id || '',
      fileName: ws.fileName || ws.name || 'DeBai.pdf',
      sizeBytes: Number(ws.sizeBytes || ws.size || 0),
      pages: Number(ws.pages || ws.pageCount || 1),
      downloadUrl: ws.downloadUrl || (ws.fileId ? `/api/v1/files/download/${ws.fileId}` : '#'),
      viewUrl: ws.viewUrl || (ws.fileId ? `/api/v1/files/view/${ws.fileId}` : '#')
    },
    answer: {
      fileId: ans.fileId || ans.id || '',
      fileName: ans.fileName || ans.name || 'DapAn.pdf',
      sizeBytes: Number(ans.sizeBytes || ans.size || 0),
      pages: Number(ans.pages || ans.pageCount || 1),
      downloadUrl: ans.downloadUrl || (ans.fileId ? `/api/v1/files/download/${ans.fileId}` : '#'),
      viewUrl: ans.viewUrl || (ans.fileId ? `/api/v1/files/view/${ans.fileId}` : '#')
    }
  };
}

/**
 * Retrieves the list of paired quiz history items, sorted newest first.
 * @returns {Array<object>}
 */
export function getQuizHistoryList() {
  let list = [];
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed.map(normalizeQuizPair).filter(Boolean);
      }
    }
  } catch (e) {
    console.warn('Failed to read quiz history from localStorage', e);
  }

  // Fallback discovery: Scan global history for legacy quiz items not yet paired
  try {
    const globalHistory = storage.getLocalHistory() || [];
    const quizItems = globalHistory.filter((i) => i.toolId === 'quiz-generator' || (i.fileName && (i.fileName.endsWith('_DeBai.pdf') || i.fileName.endsWith('_DapAn.pdf'))));

    const existingIds = new Set(list.map((p) => p.worksheet.fileId || p.worksheet.downloadUrl));

    // Group legacy items by prefix or base time
    const legacyGroups = new Map();
    for (const item of quizItems) {
      const name = item.fileName || '';
      const prefix = name.replace(/_(DeBai|DapAn)\.pdf$/i, '');
      const key = `${prefix}_${Math.floor(new Date(item.createdAt || 0).getTime() / 60000)}`;

      if (!legacyGroups.has(key)) {
        legacyGroups.set(key, { prefix, createdAt: item.createdAt, items: [] });
      }
      legacyGroups.get(key).items.push(item);
    }

    for (const group of legacyGroups.values()) {
      const ws = group.items.find((i) => (i.fileName || '').includes('_DeBai')) || group.items[0];
      const ans = group.items.find((i) => (i.fileName || '').includes('_DapAn')) || group.items[1] || ws;

      const wsKey = ws?.resultFileId || ws?.downloadUrl;
      if (wsKey && !existingIds.has(wsKey)) {
        const paired = normalizeQuizPair({
          id: `legacy_${wsKey}`,
          timestamp: new Date(group.createdAt || 0).getTime(),
          createdAt: group.createdAt,
          prefix: group.prefix,
          title: group.prefix,
          count: 20,
          worksheet: {
            fileId: ws?.resultFileId,
            fileName: ws?.fileName,
            sizeBytes: ws?.resultSize,
            downloadUrl: ws?.downloadUrl,
            viewUrl: ws?.resultFileId ? `/api/v1/files/view/${ws.resultFileId}` : ws?.downloadUrl
          },
          answer: {
            fileId: ans?.resultFileId,
            fileName: ans?.fileName,
            sizeBytes: ans?.resultSize,
            downloadUrl: ans?.downloadUrl,
            viewUrl: ans?.resultFileId ? `/api/v1/files/view/${ans.resultFileId}` : ans?.downloadUrl
          }
        });
        if (paired) {
          list.push(paired);
          existingIds.add(wsKey);
        }
      }
    }
  } catch (e) {
    console.warn('Fallback quiz pairing scan error', e);
  }

  // Sort descending by timestamp
  list.sort((a, b) => b.timestamp - a.timestamp);
  return list.slice(0, 50);
}

/**
 * Appends or updates a paired quiz history item and synchronizes with storage.
 * @param {object} rawPair
 */
export function saveQuizHistoryPair(rawPair) {
  const pair = normalizeQuizPair(rawPair);
  if (!pair) return;

  try {
    const list = getQuizHistoryList();
    // Deduplicate by id or fileIds
    const filtered = list.filter((p) => p.id !== pair.id && p.worksheet.fileId !== pair.worksheet.fileId);
    filtered.unshift(pair);
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch (e) {
    console.warn('Failed to save quiz history pair', e);
  }
}

/**
 * Removes a specific quiz pair from history.
 * @param {string} id
 */
export function deleteQuizHistoryItem(id) {
  try {
    const list = getQuizHistoryList().filter((p) => p.id !== id);
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to delete quiz history item', e);
  }
}

/**
 * Clears all quiz history entries.
 */
export function clearAllQuizHistory() {
  try {
    localStorage.removeItem(QUIZ_HISTORY_KEY);
  } catch (e) {
    console.warn('Failed to clear quiz history', e);
  }
}
