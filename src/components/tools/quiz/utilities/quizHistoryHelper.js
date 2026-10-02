/**
 * Quiz History & Trash Helper (< 220 lines)
 * Manages paired Quiz history & trash (Worksheet + Solution pairs) in localStorage
 * with full synchronization to DD Studio's global trash system and header indicator.
 * Adheres to Rule 1 & Rule 3 (UI Minimalism, Single Responsibility).
 */

import { storage } from '../../../../utilities/storage.js';
import { updateHeaderTrashIndicator } from '../../../layout/Header.js';

export const QUIZ_HISTORY_KEY = 'ds_quiz_history_v1';
export const QUIZ_TRASH_KEY = 'ds_quiz_trash_v1';

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
    deletedAt: item.deletedAt || null,
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

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeQuizPair).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeSet(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.warn(`Failed to write ${key} to localStorage`, e);
  }
}

/**
 * Retrieves the list of active paired quiz history items.
 * Performs a one-time migration from global history only on initial start.
 */
export function getQuizHistoryList() {
  let list = safeGet(QUIZ_HISTORY_KEY);

  // One-time initial migration only if key has never been set
  if (list === null) {
    list = [];
    try {
      const globalHistory = storage.getLocalHistory() || [];
      const quizItems = globalHistory.filter((i) => i.toolId === 'quiz-generator' || (i.fileName && (i.fileName.endsWith('_DeBai.pdf') || i.fileName.endsWith('_DapAn.pdf'))));

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
        const paired = normalizeQuizPair({
          id: `legacy_${ws?.resultFileId || Date.now()}`,
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
        if (paired) list.push(paired);
      }
    } catch {}
    safeSet(QUIZ_HISTORY_KEY, list);
  }

  list.sort((a, b) => b.timestamp - a.timestamp);
  return list;
}

/**
 * Retrieves the list of trashed paired quiz items.
 */
export function getQuizTrashList() {
  const list = safeGet(QUIZ_TRASH_KEY) || [];
  list.sort((a, b) => (new Date(b.deletedAt || 0).getTime()) - (new Date(a.deletedAt || 0).getTime()));
  return list;
}

/**
 * Saves a new completed quiz pair into history.
 */
export function saveQuizHistoryPair(rawPair) {
  const pair = normalizeQuizPair(rawPair);
  if (!pair) return;

  const history = getQuizHistoryList().filter((p) => p.id !== pair.id && p.worksheet.fileId !== pair.worksheet.fileId);
  history.unshift(pair);
  safeSet(QUIZ_HISTORY_KEY, history);
}

/**
 * Moves a quiz pair to Trash, synchronizing with DD Studio's global trash.
 */
export function moveQuizPairToTrash(pairId) {
  const history = getQuizHistoryList();
  const idx = history.findIndex((p) => p.id === pairId);
  if (idx === -1) return null;

  const pair = history.splice(idx, 1)[0];
  pair.deletedAt = new Date().toISOString();
  safeSet(QUIZ_HISTORY_KEY, history);

  const trash = getQuizTrashList().filter((p) => p.id !== pairId);
  trash.unshift(pair);
  safeSet(QUIZ_TRASH_KEY, trash);

  // Sync with global storage trash
  try {
    if (pair.worksheet.fileId) storage.moveToTrashSync(pair.worksheet.fileId);
    if (pair.answer.fileId) storage.moveToTrashSync(pair.answer.fileId);
    updateHeaderTrashIndicator();
  } catch {}

  return pair;
}

/**
 * Restores a quiz pair from Trash back to active History.
 */
export function restoreQuizPairFromTrash(pairId) {
  const trash = getQuizTrashList();
  const idx = trash.findIndex((p) => p.id === pairId);
  if (idx === -1) return null;

  const pair = trash.splice(idx, 1)[0];
  delete pair.deletedAt;
  safeSet(QUIZ_TRASH_KEY, trash);

  const history = getQuizHistoryList().filter((p) => p.id !== pairId);
  history.unshift(pair);
  safeSet(QUIZ_HISTORY_KEY, history);

  // Sync restore with global storage
  try {
    if (pair.worksheet.fileId) storage.restoreTrashItemSync(pair.worksheet.fileId);
    if (pair.answer.fileId) storage.restoreTrashItemSync(pair.answer.fileId);
    updateHeaderTrashIndicator();
  } catch {}

  return pair;
}

/**
 * Permanently deletes a quiz pair from Trash.
 */
export function deleteQuizPairPermanently(pairId) {
  const trash = getQuizTrashList();
  const target = trash.find((p) => p.id === pairId);
  const remaining = trash.filter((p) => p.id !== pairId);
  safeSet(QUIZ_TRASH_KEY, remaining);

  // Also remove from active history just in case
  const history = getQuizHistoryList().filter((p) => p.id !== pairId);
  safeSet(QUIZ_HISTORY_KEY, history);

  // Sync permanent purge with global storage
  try {
    if (target?.worksheet?.fileId) storage.permanentlyDeleteTrashItemSync(target.worksheet.fileId);
    if (target?.answer?.fileId) storage.permanentlyDeleteTrashItemSync(target.answer.fileId);
    updateHeaderTrashIndicator();
  } catch {}
}

/**
 * Moves all active history pairs to Trash.
 */
export function moveAllQuizPairsToTrash() {
  const history = getQuizHistoryList();
  const now = new Date().toISOString();
  const newlyTrashed = history.map((p) => ({ ...p, deletedAt: now }));

  safeSet(QUIZ_HISTORY_KEY, []);

  const trash = getQuizTrashList();
  safeSet(QUIZ_TRASH_KEY, [...newlyTrashed, ...trash]);

  try {
    for (const p of history) {
      if (p.worksheet.fileId) storage.moveToTrashSync(p.worksheet.fileId);
      if (p.answer.fileId) storage.moveToTrashSync(p.answer.fileId);
    }
    updateHeaderTrashIndicator();
  } catch {}
}

/**
 * Restores all trashed quiz pairs back to History.
 */
export function restoreAllQuizPairsFromTrash() {
  const trash = getQuizTrashList();
  const restored = trash.map((p) => {
    const c = { ...p };
    delete c.deletedAt;
    return c;
  });

  safeSet(QUIZ_TRASH_KEY, []);

  const history = getQuizHistoryList();
  safeSet(QUIZ_HISTORY_KEY, [...restored, ...history]);

  try {
    for (const p of trash) {
      if (p.worksheet.fileId) storage.restoreTrashItemSync(p.worksheet.fileId);
      if (p.answer.fileId) storage.restoreTrashItemSync(p.answer.fileId);
    }
    updateHeaderTrashIndicator();
  } catch {}
}

/**
 * Permanently purges all items in Quiz Trash.
 */
export function emptyQuizTrashPermanently() {
  const trash = getQuizTrashList();
  safeSet(QUIZ_TRASH_KEY, []);

  try {
    for (const p of trash) {
      if (p.worksheet.fileId) storage.permanentlyDeleteTrashItemSync(p.worksheet.fileId);
      if (p.answer.fileId) storage.permanentlyDeleteTrashItemSync(p.answer.fileId);
    }
    updateHeaderTrashIndicator();
  } catch {}
}

/**
 * Backward compatibility aliases
 */
export const deleteQuizHistoryItem = moveQuizPairToTrash;
export const clearAllQuizHistory = moveAllQuizPairsToTrash;
