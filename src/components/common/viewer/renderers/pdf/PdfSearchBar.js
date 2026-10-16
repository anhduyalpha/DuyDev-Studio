/**
 * PdfSearchBar Component (< 190 lines)
 * Floating In-Document Keyword Search Engine for PDF Viewport
 */

export class PdfSearchEngine {
  constructor(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.pageTextCache = new Map(); // pageNum -> string
    this.matches = []; // Array<{ pageNum: number, matchIndex: number, query: string }>
    this.currentIndex = -1;
    this.currentQuery = '';
    this.isIndexing = false;
  }

  async getPageText(pageNum) {
    if (this.pageTextCache.has(pageNum)) {
      return this.pageTextCache.get(pageNum);
    }
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(' ');
      this.pageTextCache.set(pageNum, text);
      return text;
    } catch {
      return '';
    }
  }

  async search(rawQuery) {
    const query = (rawQuery || '').trim();
    this.currentQuery = query;
    this.matches = [];
    this.currentIndex = -1;

    if (!query || !this.pdfDoc) {
      return { matches: [], total: 0, current: 0 };
    }

    const lowerQuery = query.toLowerCase();
    const totalPages = this.pdfDoc.numPages;

    for (let p = 1; p <= totalPages; p++) {
      const text = await this.getPageText(p);
      const lowerText = text.toLowerCase();
      let pos = 0;
      let countOnPage = 0;

      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        this.matches.push({
          pageNum: p,
          matchIndex: countOnPage,
          query
        });
        countOnPage++;
        pos += lowerQuery.length;
      }
    }

    if (this.matches.length > 0) {
      this.currentIndex = 0;
    }

    return {
      matches: this.matches,
      total: this.matches.length,
      current: this.matches.length > 0 ? 1 : 0,
      activeMatch: this.matches[this.currentIndex] || null
    };
  }

  nextMatch() {
    if (this.matches.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    return {
      current: this.currentIndex + 1,
      total: this.matches.length,
      match: this.matches[this.currentIndex]
    };
  }

  prevMatch() {
    if (this.matches.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    return {
      current: this.currentIndex + 1,
      total: this.matches.length,
      match: this.matches[this.currentIndex]
    };
  }

  getCurrentMatch() {
    return this.matches[this.currentIndex] || null;
  }

  destroy() {
    this.pageTextCache.clear();
    this.matches = [];
    this.pdfDoc = null;
  }
}

export function renderSearchBar() {
  return `
    <div id="pdfSearchBar" class="fixed top-4 right-4 sm:right-6 z-40 transition-all duration-200 transform -translate-y-6 opacity-0 pointer-events-none select-none">
      <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-[#121216]/95 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 shadow-xl text-zinc-800 dark:text-zinc-200 text-xs">
        <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0"></i>
        
        <input id="inputPdfSearch" type="text" placeholder="Tìm kiếm trong tài liệu..."
          class="w-36 sm:w-48 bg-transparent py-1 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none font-sans" />

        <span id="pdfSearchCount" class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 px-1 whitespace-nowrap min-w-[36px] text-center">0/0</span>

        <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5"></div>

        <button id="btnPdfSearchPrev" type="button" title="Kết quả trước (Shift+Enter)"
          class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:bg-zinc-200 dark:active:bg-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
          <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
        </button>

        <button id="btnPdfSearchNext" type="button" title="Kết quả tiếp (Enter)"
          class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:bg-zinc-200 dark:active:bg-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
          <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
        </button>

        <button id="btnPdfSearchClose" type="button" title="Đóng tìm kiếm (Esc)"
          class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:bg-zinc-200 dark:active:bg-white/15 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `;
}

export function openSearchBar() {
  const bar = document.getElementById('pdfSearchBar');
  const input = document.getElementById('inputPdfSearch');
  if (bar) {
    bar.classList.remove('-translate-y-6', 'opacity-0', 'pointer-events-none');
    bar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
    if (window.lucide) window.lucide.createIcons({ root: bar });
    setTimeout(() => {
      input?.focus();
      input?.select();
    }, 50);
  }
}

export function closeSearchBar() {
  const bar = document.getElementById('pdfSearchBar');
  if (bar) {
    bar.classList.add('-translate-y-6', 'opacity-0', 'pointer-events-none');
    bar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
  }
}

export function toggleSearchBar() {
  const bar = document.getElementById('pdfSearchBar');
  if (!bar) return;
  const isOpen = bar.classList.contains('opacity-100');
  if (isOpen) closeSearchBar();
  else openSearchBar();
}

export function updateSearchBarMatchCount(current, total) {
  const countLabel = document.getElementById('pdfSearchCount');
  const btnPrev = document.getElementById('btnPdfSearchPrev');
  const btnNext = document.getElementById('btnPdfSearchNext');

  if (countLabel) {
    countLabel.textContent = total > 0 ? `${current}/${total}` : '0/0';
  }
  if (btnPrev) btnPrev.disabled = total === 0;
  if (btnNext) btnNext.disabled = total === 0;
}

export function attachSearchBarListeners({ onSearch, onNext, onPrev, onClose }) {
  const input = document.getElementById('inputPdfSearch');
  const btnPrev = document.getElementById('btnPdfSearchPrev');
  const btnNext = document.getElementById('btnPdfSearchNext');
  const btnClose = document.getElementById('btnPdfSearchClose');

  let debounceTimer = null;

  input?.addEventListener('input', (e) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (onSearch) onSearch(e.target.value);
    }, 200);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        if (onPrev) onPrev();
      } else {
        if (onNext) onNext();
      }
    } else if (e.key === 'Escape') {
      closeSearchBar();
      if (onClose) onClose();
    }
  });

  btnPrev?.addEventListener('click', () => { if (onPrev) onPrev(); });
  btnNext?.addEventListener('click', () => { if (onNext) onNext(); });
  btnClose?.addEventListener('click', () => {
    closeSearchBar();
    if (onClose) onClose();
  });
}
