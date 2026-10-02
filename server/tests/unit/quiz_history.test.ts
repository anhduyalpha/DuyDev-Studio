import { describe, it, expect, beforeEach } from 'vitest';
import {
  getQuizHistoryList,
  saveQuizHistoryPair,
  deleteQuizHistoryItem,
  clearAllQuizHistory,
  QUIZ_HISTORY_KEY
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

describe('Quiz History Helper Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty history list when localStorage is empty', () => {
    const list = getQuizHistoryList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
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

  it('deletes a single quiz history item by ID', () => {
    saveQuizHistoryPair({
      id: 'quiz_item_to_delete',
      worksheet: { fileId: 'ws_del', fileName: 'DeBai.pdf' },
      answer: { fileId: 'ans_del', fileName: 'DapAn.pdf' }
    });
    saveQuizHistoryPair({
      id: 'quiz_item_to_keep',
      worksheet: { fileId: 'ws_keep', fileName: 'DeBai2.pdf' },
      answer: { fileId: 'ans_keep', fileName: 'DapAn2.pdf' }
    });

    expect(getQuizHistoryList().length).toBe(2);

    deleteQuizHistoryItem('quiz_item_to_delete');

    const updated = getQuizHistoryList();
    expect(updated.length).toBe(1);
    expect(updated[0].id).toBe('quiz_item_to_keep');
  });

  it('clears all quiz history entries', () => {
    saveQuizHistoryPair({
      id: 'pair_1',
      worksheet: { fileId: 'ws_1' },
      answer: { fileId: 'ans_1' }
    });
    saveQuizHistoryPair({
      id: 'pair_2',
      worksheet: { fileId: 'ws_2' },
      answer: { fileId: 'ans_2' }
    });

    expect(getQuizHistoryList().length).toBe(2);

    clearAllQuizHistory();
    expect(getQuizHistoryList().length).toBe(0);
  });
});
