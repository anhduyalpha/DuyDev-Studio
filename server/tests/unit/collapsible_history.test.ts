import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderConverterHistoryList,
  setConverterHistoryOpen,
  isConverterHistoryExpanded,
  getConverterHistoryItems
} from '../../../src/components/tools/converter/components/ConverterHistoryList.js';
import {
  renderPdfHistoryList,
  setPdfHistoryOpen,
  isPdfHistoryExpanded,
  getPdfHistoryItems
} from '../../../src/components/tools/pdf/components/PdfHistoryList.js';
import {
  renderQrHistoryList,
  setQrHistoryOpen,
  isQrHistoryExpanded
} from '../../../src/components/tools/qr/components/QrHistoryList.js';
import {
  renderQuizHistoryList,
  toggleQuizHistoryBox,
  setQuizHistoryBoxOpen,
  isQuizHistoryBoxExpanded
} from '../../../src/components/tools/quiz/components/QuizHistoryList.js';

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

describe('Collapsible History Dropboxes Across All Modules', () => {
  beforeEach(() => {
    localStorage.clear();
    setConverterHistoryOpen(false);
    setPdfHistoryOpen(false);
    setQrHistoryOpen('create', false);
    setQrHistoryOpen('scan', false);
    setQrHistoryOpen('all', false);
    setQuizHistoryBoxOpen(false);
  });

  describe('1. File Converter Pro History Dropbox', () => {
    it('is collapsed by default and renders clickable dropbox header button', () => {
      expect(isConverterHistoryExpanded()).toBe(false);
      const html = renderConverterHistoryList();
      expect(html).toContain('id="btnToggleConverterHistory"');
      expect(html).toContain('Lịch sử chuyển đổi');
      expect(html).toContain('id="converterHistoryBody" class="hidden');
    });

    it('expands cleanly and shows body when isConverterHistoryOpen is true', () => {
      setConverterHistoryOpen(true);
      expect(isConverterHistoryExpanded()).toBe(true);
      const html = renderConverterHistoryList();
      expect(html).toContain('id="converterHistoryBody" class="block');
      expect(html).toContain('Thu gọn');
    });
  });

  describe('2. PDF Studio Pro History Dropbox', () => {
    it('is collapsed by default and renders clickable dropbox header button', () => {
      expect(isPdfHistoryExpanded()).toBe(false);
      const html = renderPdfHistoryList();
      expect(html).toContain('id="btnTogglePdfHistory"');
      expect(html).toContain('Lịch sử & Thùng rác PDF');
      expect(html).toContain('id="pdfHistoryBody" class="hidden');
    });

    it('expands cleanly and displays segmented tabs and history items', () => {
      setPdfHistoryOpen(true);
      expect(isPdfHistoryExpanded()).toBe(true);
      const html = renderPdfHistoryList();
      expect(html).toContain('id="pdfHistoryBody" class="block');
      expect(html).toContain('id="btnPdfTabHistory"');
      expect(html).toContain('id="btnPdfTabTrash"');
      expect(html).toContain('Thu gọn');
    });
  });

  describe('3. QR Studio History Dropbox', () => {
    it('returns empty string when there are no QR history items', () => {
      const html = renderQrHistoryList('create');
      expect(html).toBe('');
    });

    it('renders collapsed dropbox when items exist', () => {
      // Mock history in localStorage
      const mockHistory = [
        {
          id: 'qr_1',
          toolId: 'qr-multi',
          fileName: '[VietQR] Napas 247',
          downloadUrl: 'data:image/png;base64,123',
          timestamp: Date.now()
        }
      ];
      localStorage.setItem('ds_job_history_v2', JSON.stringify(mockHistory));

      expect(isQrHistoryExpanded('create')).toBe(false);
      const html = renderQrHistoryList('create');
      expect(html).toContain('btn-toggle-qr-history');
      expect(html).toContain('Lịch sử tạo QR');
      expect(html).toContain('qr-history-body hidden');

      setQrHistoryOpen('create', true);
      const expandedHtml = renderQrHistoryList('create');
      expect(expandedHtml).toContain('qr-history-body block');
      expect(expandedHtml).toContain('Thu gọn');
    });
  });

  describe('4. Quiz Generator History Dropbox', () => {
    it('is collapsed by default and renders clickable master dropbox header', () => {
      expect(isQuizHistoryBoxExpanded()).toBe(false);
      const html = renderQuizHistoryList();
      expect(html).toContain('id="btnToggleQuizHistoryBox"');
      expect(html).toContain('Lịch sử tạo bài tập');
      expect(html).toContain('id="quizHistoryBoxBody" class="hidden');
    });

    it('toggles expansion state and shows master body with tabs and actions', () => {
      toggleQuizHistoryBox();
      expect(isQuizHistoryBoxExpanded()).toBe(true);
      const html = renderQuizHistoryList();
      expect(html).toContain('id="quizHistoryBoxBody" class="block');
      expect(html).toContain('id="btnQuizTabHistory"');
      expect(html).toContain('id="btnQuizTabTrash"');
      expect(html).toContain('Thu gọn');

      toggleQuizHistoryBox();
      expect(isQuizHistoryBoxExpanded()).toBe(false);
    });
  });
});
