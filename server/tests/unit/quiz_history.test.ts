import { describe, it, expect, beforeEach } from 'vitest';
import {
  getQuizHistoryList,
  getQuizTrashList,
  saveQuizHistoryPair,
  moveQuizPairToTrash,
  restoreQuizPairFromTrash,
  deleteQuizPairPermanently,
  moveAllQuizPairsToTrash,
  restoreAllQuizPairsFromTrash,
  emptyQuizTrashPermanently,
  deleteQuizHistoryItem,
  clearAllQuizHistory,
  QUIZ_HISTORY_KEY,
  QUIZ_TRASH_KEY
} from '../../src/../../src/components/tools/quiz/utilities/quizHistoryHelper.js';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] || null,
    get length() { return store.size; }
  } as any;
}

describe('Quiz History & Trash Helper Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty history and trash lists when localStorage is empty', () => {
    const history = getQuizHistoryList();
    const trash = getQuizTrashList();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
    expect(Array.isArray(trash)).toBe(true);
    expect(trash.length).toBe(0);
  });

  it('correctly saves, normalizes, and retrieves a paired quiz history item', () => {
    const mockPair = {
      id: 'quiz_test_123',
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      prefix: 'HoaHoc12',
      title: 'Bài tập este lipit',
      count: 20,
      pages: '1-5',
      worksheet: {
        fileId: 'fil_ws_123',
        fileName: 'HoaHoc12_DeBai.pdf',
        sizeBytes: 105432,
        pages: 3,
        downloadUrl: '/api/v1/files/download/fil_ws_123/HoaHoc12_DeBai.pdf',
        viewUrl: '/api/v1/files/view/fil_ws_123'
      },
      answer: {
        fileId: 'fil_ans_123',
        fileName: 'HoaHoc12_DapAn.pdf',
        sizeBytes: 85210,
        pages: 2,
        downloadUrl: '/api/v1/files/download/fil_ans_123/HoaHoc12_DapAn.pdf',
        viewUrl: '/api/v1/files/view/fil_ans_123'
      }
    };

    saveQuizHistoryPair(mockPair);

    const list = getQuizHistoryList();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('quiz_test_123');
    expect(list[0].prefix).toBe('HoaHoc12');
    expect(list[0].count).toBe(20);
    expect(list[0].worksheet.fileName).toBe('HoaHoc12_DeBai.pdf');
    expect(list[0].worksheet.pages).toBe(3);
    expect(list[0].answer.fileName).toBe('HoaHoc12_DapAn.pdf');
    expect(list[0].answer.pages).toBe(2);
  });

  it('deduplicates items when saved with same id or worksheet fileId', () => {
    const pairA = {
      id: 'quiz_dup_1',
      worksheet: { fileId: 'ws_same', fileName: 'De1.pdf' },
      answer: { fileId: 'ans_1', fileName: 'Da1.pdf' }
    };
    const pairB = {
      id: 'quiz_dup_2',
      worksheet: { fileId: 'ws_same', fileName: 'De1_Updated.pdf' },
      answer: { fileId: 'ans_1', fileName: 'Da1_Updated.pdf' }
    };

    saveQuizHistoryPair(pairA);
    saveQuizHistoryPair(pairB);

    const list = getQuizHistoryList();
    expect(list.length).toBe(1);
    expect(list[0].worksheet.fileName).toBe('De1_Updated.pdf');
  });

  it('moves a single quiz pair to Trash with deletedAt timestamp', () => {
    saveQuizHistoryPair({
      id: 'quiz_move_to_trash',
      worksheet: { fileId: 'ws_trash', fileName: 'DeBai.pdf' },
      answer: { fileId: 'ans_trash', fileName: 'DapAn.pdf' }
    });
    saveQuizHistoryPair({
      id: 'quiz_stay_in_history',
      worksheet: { fileId: 'ws_stay', fileName: 'DeBai2.pdf' },
      answer: { fileId: 'ans_stay', fileName: 'DapAn2.pdf' }
    });

    expect(getQuizHistoryList().length).toBe(2);
    expect(getQuizTrashList().length).toBe(0);

    const trashed = moveQuizPairToTrash('quiz_move_to_trash');
    expect(trashed).not.toBeNull();
    expect(trashed?.id).toBe('quiz_move_to_trash');
    expect(trashed?.deletedAt).toBeDefined();

    const history = getQuizHistoryList();
    const trash = getQuizTrashList();

    expect(history.length).toBe(1);
    expect(history[0].id).toBe('quiz_stay_in_history');

    expect(trash.length).toBe(1);
    expect(trash[0].id).toBe('quiz_move_to_trash');
    expect(trash[0].deletedAt).toBeTruthy();
  });

  it('restores a quiz pair from Trash back to active History', () => {
    saveQuizHistoryPair({
      id: 'quiz_to_restore',
      worksheet: { fileId: 'ws_res', fileName: 'DeBaiRes.pdf' },
      answer: { fileId: 'ans_res', fileName: 'DapAnRes.pdf' }
    });

    moveQuizPairToTrash('quiz_to_restore');
    expect(getQuizHistoryList().length).toBe(0);
    expect(getQuizTrashList().length).toBe(1);

    const restored = restoreQuizPairFromTrash('quiz_to_restore');
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe('quiz_to_restore');
    expect(restored?.deletedAt).toBeUndefined();

    expect(getQuizHistoryList().length).toBe(1);
    expect(getQuizTrashList().length).toBe(0);
  });

  it('permanently deletes a quiz pair from Trash without resurrecting', () => {
    saveQuizHistoryPair({
      id: 'quiz_perm_del',
      worksheet: { fileId: 'ws_perm', fileName: 'DeBaiPerm.pdf' },
      answer: { fileId: 'ans_perm', fileName: 'DapAnPerm.pdf' }
    });

    moveQuizPairToTrash('quiz_perm_del');
    expect(getQuizTrashList().length).toBe(1);

    deleteQuizPairPermanently('quiz_perm_del');
    expect(getQuizTrashList().length).toBe(0);
    expect(getQuizHistoryList().length).toBe(0);
  });

  it('handles bulk actions: moveAllQuizPairsToTrash, restoreAllQuizPairsFromTrash, emptyQuizTrashPermanently', () => {
    saveQuizHistoryPair({
      id: 'bulk_1',
      worksheet: { fileId: 'ws_bulk_1' },
      answer: { fileId: 'ans_bulk_1' }
    });
    saveQuizHistoryPair({
      id: 'bulk_2',
      worksheet: { fileId: 'ws_bulk_2' },
      answer: { fileId: 'ans_bulk_2' }
    });

    expect(getQuizHistoryList().length).toBe(2);

    // 1. Move all to trash
    moveAllQuizPairsToTrash();
    expect(getQuizHistoryList().length).toBe(0);
    expect(getQuizTrashList().length).toBe(2);

    // 2. Restore all from trash
    restoreAllQuizPairsFromTrash();
    expect(getQuizHistoryList().length).toBe(2);
    expect(getQuizTrashList().length).toBe(0);

    // 3. Move all to trash again, then empty permanently
    moveAllQuizPairsToTrash();
    expect(getQuizTrashList().length).toBe(2);
    emptyQuizTrashPermanently();
    expect(getQuizTrashList().length).toBe(0);
    expect(getQuizHistoryList().length).toBe(0);
  });

  it('supports backward-compatibility aliases deleteQuizHistoryItem and clearAllQuizHistory', () => {
    saveQuizHistoryPair({
      id: 'compat_item',
      worksheet: { fileId: 'ws_compat' },
      answer: { fileId: 'ans_compat' }
    });

    expect(getQuizHistoryList().length).toBe(1);
    deleteQuizHistoryItem('compat_item');
    expect(getQuizHistoryList().length).toBe(0);
    expect(getQuizTrashList().length).toBe(1);

    clearAllQuizHistory();
    expect(getQuizHistoryList().length).toBe(0);
  });
});
