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
import {
  renderRecentActivity,
  setRecentActivityOpen,
  isRecentActivityExpanded,
  toggleRecentActivity
} from '../../../src/components/dashboard/RecentActivity.js';
import {
  renderMediaHistorySection,
  attachMediaHistoryListeners,
  isMediaHistoryExpanded,
  setMediaHistoryExpanded
} from '../../../src/components/tools/common/MediaHistorySection.js';

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
    setRecentActivityOpen(false);
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

  describe('5. Dashboard Recent Activity Dropbox', () => {
    it('returns empty string when there are no history items', () => {
      localStorage.setItem('ds_job_history_v2', JSON.stringify([]));
      const html = renderRecentActivity();
      expect(html).toBe('');
    });

    it('renders collapsed dropbox by default when items exist', () => {
      const mockHistory = [
        {
          id: 'hist_1',
          toolId: 'universal-converter',
          fileName: 'Bai tap TCP.txt',
          resultSize: 1200,
          timestamp: Date.now()
        }
      ];
      localStorage.setItem('ds_job_history_v2', JSON.stringify(mockHistory));

      setRecentActivityOpen(false);
      expect(isRecentActivityExpanded()).toBe(false);

      const html = renderRecentActivity();
      expect(html).toContain('id="btnToggleRecentActivity"');
      expect(html).toContain('Tác vụ gần đây');
      expect(html).toContain('id="recentActivityBody" class="hidden');
      expect(html).toContain('href="#trash"');
      expect(html).toContain('href="#history"');
    });

    it('toggles expansion state and reveals body when opened', () => {
      const mockHistory = [
        {
          id: 'hist_1',
          toolId: 'universal-converter',
          fileName: 'Bai tap TCP.txt',
          resultSize: 1200,
          timestamp: Date.now()
        }
      ];
      localStorage.setItem('ds_job_history_v2', JSON.stringify(mockHistory));

      toggleRecentActivity();
      expect(isRecentActivityExpanded()).toBe(true);

      const html = renderRecentActivity();
      expect(html).toContain('id="recentActivityBody" class="block');
      expect(html).toContain('id="recentActivityCardsGrid"');
      expect(html).toContain('Bai tap TCP.txt');

      toggleRecentActivity();
      expect(isRecentActivityExpanded()).toBe(false);
    });
  });

  describe('6. Media Downloaders Collapsible History Section (Facebook, Instagram, Spotify)', () => {
    it('is collapsed by default and renders clickable toggle button with dedicated labels and icon IDs', () => {
      setMediaHistoryExpanded('facebook-downloader', false);
      expect(isMediaHistoryExpanded('facebook-downloader')).toBe(false);

      const html = renderMediaHistorySection({
        toolId: 'facebook-downloader',
        title: 'Lịch Sử Tải Video Facebook',
        accentColor: '#1877F2'
      });

      expect(html).toContain('id="btnToggleMediaHistory"');
      expect(html).toContain('id="lblToggleMediaHistory"');
      expect(html).toContain('id="iconChevronMediaHistory"');
      expect(html).toContain('id="mediaHistoryBody" class="hidden');
      expect(html).toContain('Xem lịch sử');
    });

    it('expands cleanly and reveals body when isMediaHistoryExpanded is true', () => {
      setMediaHistoryExpanded('facebook-downloader', true);
      expect(isMediaHistoryExpanded('facebook-downloader')).toBe(true);

      const html = renderMediaHistorySection({
        toolId: 'facebook-downloader',
        title: 'Lịch Sử Tải Video Facebook',
        accentColor: '#1877F2'
      });

      expect(html).toContain('id="mediaHistoryBody" class="block');
      expect(html).toContain('Thu gọn');
    });

    it('toggles body in-place when toggle button is clicked without invoking onHistoryChange', () => {
      setMediaHistoryExpanded('instagram-downloader', false);

      const mockBody = {
        classList: {
          contains: (cls: string) => cls === 'hidden',
          remove: (cls: string) => {},
          add: (cls: string) => {}
        }
      };
      const mockLabel = { textContent: 'Xem lịch sử' };
      const mockChevron = {
        classList: {
          add: (...cls: string[]) => {},
          remove: (...cls: string[]) => {}
        }
      };

      let btnToggleHandler: any = null;
      const mockBtnToggle = {
        setAttribute: (k: string, v: string) => {},
        set onclick(fn: any) { btnToggleHandler = fn; },
        get onclick() { return btnToggleHandler; }
      };

      const mockContainer = {
        querySelector: (sel: string) => {
          if (sel === '#btnToggleMediaHistory') return mockBtnToggle;
          if (sel === '#mediaHistoryBody') return mockBody;
          if (sel === '#lblToggleMediaHistory') return mockLabel;
          if (sel === '#iconChevronMediaHistory') return mockChevron;
          return null;
        },
        querySelectorAll: () => []
      };

      let historyChangeCalled = false;
      attachMediaHistoryListeners({
        container: mockContainer as any,
        toolId: 'instagram-downloader',
        onHistoryChange: () => {
          historyChangeCalled = true;
        }
      });

      expect(typeof mockBtnToggle.onclick).toBe('function');
      const fakeEvent = { preventDefault: () => {} };
      mockBtnToggle.onclick(fakeEvent);

      expect(isMediaHistoryExpanded('instagram-downloader')).toBe(true);
      expect(mockLabel.textContent).toBe('Thu gọn');
      expect(historyChangeCalled).toBe(false); // Ironclad verification: Must NOT call onHistoryChange on toggle click!
    });
  });
});
