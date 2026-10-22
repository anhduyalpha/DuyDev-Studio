/**
 * StudocuWorkspace Component (< 230 lines)
 * Native Zero-Iframe workspace orchestrator for Studocu Downloader.
 * High-performance selective DOM updates eliminating input focus loss.
 */

import { renderHeroPasteCard } from './components/HeroPasteCard.js';
import { renderLiveTerminalCard, renderTerminalLogs } from './components/LiveTerminalCard.js';
import { renderDocumentListCard, renderDocumentItemsHtml } from './components/DocumentListCard.js';
import { renderSlideConfirmModal, openSlideConfirmModal } from './components/SlideConfirmModal.js';
import { studocuManager } from './hooks/useStudocu.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { showToast } from '../../../utilities/toast.js';

export function renderStudocuWorkspace() {
  const state = studocuManager.getState();

  return `
    <div id="studocuWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-16 sm:pb-20">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate">Studocu Downloader</span>
        </div>
      </div>

      <div id="studocuHeroContainer">${renderHeroPasteCard(state)}</div>
      <div id="studocuTerminalContainer">${renderLiveTerminalCard(state)}</div>
      <div id="studocuListContainer">${renderDocumentListCard(state)}</div>
      ${renderSlideConfirmModal()}
    </div>
  `.trim();
}

export function extractStudocuUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // 1. Strip markdown links [title](url) or <url>
  const mdMatch = text.match(/\((https?:\/\/[^\s)]+)\)/i) || text.match(/<([^\s>]+)>/);
  if (mdMatch) {
    text = mdMatch[1];
  }

  // 2. Extract URL match from surrounded text
  const urlMatch = text.match(/https?:\/\/[^\s"']+/i) || text.match(/(?:www\.)?(?:studocu|studeersnel)\.[a-z.]+\/[^\s"']+/i);
  if (urlMatch) {
    text = urlMatch[0];
  }

  // 3. Remove trailing punctuation commonly attached in text (. , ; ) > " ' etc.)
  text = text.replace(/[.,;!?>"')\]]+$/, '').trim();

  // 4. Ensure protocol
  if (!/^https?:\/\//i.test(text)) {
    text = 'https://' + text.replace(/^\/+/, '');
  }

  // 5. Validate hostname
  try {
    const parsed = new URL(text);
    const host = parsed.hostname.toLowerCase();
    const isStudocu = host === 'studocu.com' ||
      host.endsWith('.studocu.com') ||
      host === 'studocu.vn' ||
      host.endsWith('.studocu.vn') ||
      host === 'studeersnel.nl' ||
      host.endsWith('.studeersnel.nl');

    if (isStudocu) {
      return parsed.href;
    }
  } catch (_) {}

  return null;
}

function isValidStudocuUrl(str) {
  return Boolean(extractStudocuUrl(str));
}

function handleUrlCandidate(raw) {
  const clean = String(raw || '').trim();
  const validUrl = extractStudocuUrl(clean);
  const urlInput = document.getElementById('studocuUrlInput');
  const clearBtn = document.getElementById('btnClearStudocuUrl');

  if (urlInput && urlInput.value !== (validUrl || clean)) {
    urlInput.value = validUrl || clean;
  }
  if (clearBtn) clearBtn.classList.toggle('hidden', !urlInput?.value?.trim());

  if (!validUrl) {
    showToast('Link studocu không hợp lệ', 'error');
    const t = document.getElementById('studocuPasteBtnTitle');
    if (t) {
      const old = t.textContent;
      t.textContent = 'Liên kết không hợp lệ';
      setTimeout(() => { if (t) t.textContent = old; }, 2000);
    }
    return;
  }
  studocuManager.startDownload(validUrl, null);
}

export function attachStudocuListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
  studocuManager.init();

  let prevDownloading = false;
  let prevStructureKey = '';
  let prevSearchQuery = '';
  let prevJustDownloadedDocName = '';

  function attachHeroHandlers() {
    const heroCancel = document.getElementById('studocuHeroCancelBtn');
    if (heroCancel) heroCancel.onclick = () => studocuManager.cancelJob();

    const form = document.getElementById('studocuDownloadForm');
    const urlInput = document.getElementById('studocuUrlInput');
    const clearBtn = document.getElementById('btnClearStudocuUrl');
    const pasteBtn = document.getElementById('studocuPasteBtn');

    function updateButtonState() {
      const pasteBtnTitle = document.getElementById('studocuPasteBtnTitle');
      const pasteBtnIcon = document.getElementById('studocuPasteBtnIcon');
      const pasteBtnEl = document.getElementById('studocuPasteBtn');
      if (!pasteBtnEl || studocuManager.getState().isDownloading) return;

      const hasValue = Boolean(urlInput?.value?.trim());
      if (hasValue) {
        if (pasteBtnTitle) pasteBtnTitle.textContent = 'Bắt đầu tải';
        if (pasteBtnIcon) pasteBtnIcon.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i>';
        pasteBtnEl.setAttribute('title', 'Bắt đầu tải tài liệu');
      } else {
        if (pasteBtnTitle) pasteBtnTitle.textContent = 'Dán link & Tải';
        if (pasteBtnIcon) pasteBtnIcon.innerHTML = '<i data-lucide="clipboard" class="w-4 h-4"></i>';
        pasteBtnEl.setAttribute('title', 'Dán link từ bộ nhớ tạm & Tải ngay');
      }
      if (window.lucide?.createIcons) window.lucide.createIcons({ root: pasteBtnEl });
    }

    const submitDownload = () => {
      if (studocuManager.getState().isDownloading) return;
      const val = urlInput?.value?.trim();
      if (val) {
        handleUrlCandidate(val);
      }
    };

    if (urlInput) {
      urlInput.oninput = () => {
        if (clearBtn) clearBtn.classList.toggle('hidden', !urlInput.value.trim());
        updateButtonState();
      };
      urlInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitDownload();
        }
      };
      urlInput.onpaste = (e) => {
        const text = (e.clipboardData || window.clipboardData)?.getData('text');
        if (text && isValidStudocuUrl(text.trim())) {
          setTimeout(() => {
            handleUrlCandidate(text.trim());
            updateButtonState();
          }, 50);
        } else {
          setTimeout(() => updateButtonState(), 50);
        }
      };
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        if (urlInput) {
          urlInput.value = '';
          urlInput.focus();
        }
        clearBtn.classList.add('hidden');
        updateButtonState();
      };
    }

    if (form) form.onsubmit = (e) => { e.preventDefault(); submitDownload(); return false; };

    if (pasteBtn && !pasteBtn.disabled) {
      pasteBtn.onclick = async () => {
        if (studocuManager.getState().isDownloading) return;

        // Option 1 Check: User has already entered or pasted a link into the box
        const currentInput = urlInput?.value?.trim();
        if (currentInput) {
          handleUrlCandidate(currentInput);
          return;
        }

        // Option 2: 1-Click Paste & Auto-Download from Clipboard
        let text = '';

        // 1. Android Native Bridge (0ms direct clipboard access)
        try {
          if (typeof window !== 'undefined' && typeof window.AndroidBridge?.getClipboardText === 'function') {
            text = window.AndroidBridge.getClipboardText() || '';
          }
        } catch (_) {}

        // 2. Modern async Clipboard API with 3000ms race timeout
        if (!text && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          try {
            const clipPromise = navigator.clipboard.readText();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('CLIPBOARD_TIMEOUT')), 3000)
            );
            text = await Promise.race([clipPromise, timeoutPromise]);
          } catch (err) {
            console.warn('[Studocu] Clipboard read failed:', err);
          }
        }

        const trimmed = (text || '').trim();
        if (trimmed) {
          const validUrl = extractStudocuUrl(trimmed);
          if (validUrl) {
            // Auto-paste link into the input box so the user sees it
            if (urlInput) {
              urlInput.value = validUrl;
              if (clearBtn) clearBtn.classList.remove('hidden');
            }
            updateButtonState();
            showToast('Đã dán liên kết & bắt đầu tải...', 'success');
            studocuManager.startDownload(validUrl, null);
            return;
          } else {
            // Clipboard contains non-Studocu text
            if (urlInput) {
              urlInput.value = trimmed;
              if (clearBtn) clearBtn.classList.remove('hidden');
              urlInput.focus();
            }
            updateButtonState();
            showToast('Nội dung trong clipboard không phải liên kết Studocu hợp lệ', 'warning');
            return;
          }
        }

        // 3. Fallback: Clipboard empty or blocked by browser permission
        showToast('Bộ nhớ tạm trống hoặc bị trình duyệt chặn. Vui lòng bấm vào ô nhập để dán link.', 'info');
        if (urlInput) {
          urlInput.focus();
        }
      };
    }

    updateButtonState();
  }

  function attachTerminalHandlers() {
    const cancelBtn = document.getElementById('studocuCancelBtn');
    if (cancelBtn) cancelBtn.onclick = () => studocuManager.cancelJob();

    const copyBtn = document.getElementById('studocuCopyLogsBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const { logs } = studocuManager.getState();
        if (logs?.length) {
          navigator.clipboard.writeText(logs.join('\n')).then(() => {
            const txt = document.getElementById('studocuCopyLogsText');
            if (txt) { txt.textContent = 'Đã chép'; setTimeout(() => { txt.textContent = 'Sao chép'; }, 1500); }
            showToast('Đã sao chép nhật ký', 'success');
          });
        }
      };
    }
  }

  function attachItemRowHandlers(container = document) {
    container.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = btn.getAttribute('data-doc-id');
        const name = btn.getAttribute('data-doc-name');
        const isPdf = !name.toLowerCase().endsWith('.md');
        const hasHexId = Boolean(id && /^[0-9a-f]{16}$/i.test(id));
        const streamUrl = hasHexId
          ? `/api/v1/studocu/stream?id=${encodeURIComponent(id)}`
          : `/api/v1/studocu/stream?file=${encodeURIComponent(name)}`;
        ViewerConnector.preview({
          id, name, fileName: name,
          category: isPdf ? 'pdf' : 'text',
          mimeType: isPdf ? 'application/pdf' : 'text/plain',
          viewUrl: streamUrl,
          url: streamUrl,
          downloadUrl: `/api/v1/studocu/download/${encodeURIComponent(name)}`
        });
      };
    });
    container.querySelectorAll('.btn-trash-doc').forEach(b => { b.onclick = (e) => { e.stopPropagation(); studocuManager.moveToTrash(b.getAttribute('data-doc-name')); }; });
    container.querySelectorAll('.btn-restore-doc').forEach(b => { b.onclick = (e) => { e.stopPropagation(); studocuManager.restoreFromTrash(b.getAttribute('data-doc-name')); }; });
    container.querySelectorAll('.btn-delete-perm-doc').forEach(b => { b.onclick = (e) => { e.stopPropagation(); studocuManager.deletePermanent(b.getAttribute('data-doc-name')); }; });
    container.querySelectorAll('.btn-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const docName = btn.getAttribute('data-doc-name') || btn.getAttribute('download');
        if (docName) {
          studocuManager.markAsDownloaded(docName, true);
        }
      });
    });
  }

  function attachListHandlers() {
    const searchInput = document.getElementById('studocuSearchInput');
    if (searchInput) searchInput.oninput = (e) => { studocuManager.searchQuery = e.target.value; studocuManager.notify(); };

    const clearSearch = document.getElementById('btnClearStudocuSearch');
    if (clearSearch) clearSearch.onclick = () => {
      studocuManager.searchQuery = '';
      if (searchInput) searchInput.value = '';
      studocuManager.notify();
    };

    const sortSelect = document.getElementById('studocuSortSelect');
    if (sortSelect) sortSelect.onchange = (e) => { studocuManager.sortOption = e.target.value; studocuManager.notify(); };

    document.querySelectorAll('.tab-filter-studocu').forEach(tab => {
      tab.onclick = () => { studocuManager.currentTab = tab.getAttribute('data-tab'); studocuManager.notify(); };
    });

    const btnRefresh = document.getElementById('btnRefreshStudocuList');
    if (btnRefresh) btnRefresh.onclick = () => studocuManager.fetchFiles();

    const btnEmptyTrash = document.getElementById('btnEmptyStudocuTrash');
    if (btnEmptyTrash) btnEmptyTrash.onclick = () => openSlideConfirmModal(() => studocuManager.emptyTrash());

    attachItemRowHandlers(document);
  }

  const unsubscribe = studocuManager.subscribe((state) => {
    const heroEl = document.getElementById('studocuHeroContainer');
    const termCard = document.getElementById('studocuTerminalCard');
    const listEl = document.getElementById('studocuListContainer');

    if (heroEl && state.isDownloading !== prevDownloading) {
      heroEl.innerHTML = renderHeroPasteCard(state);
      prevDownloading = state.isDownloading;
      attachHeroHandlers();
      if (window.lucide?.createIcons) window.lucide.createIcons();
    }
    heroEl?.querySelector('.border-beam-card')?.classList.toggle('is-processing', Boolean(state.isDownloading));

    const shouldShowTerminal = state.isDownloading;
    if (termCard) {
      termCard.classList.toggle('hidden', !shouldShowTerminal);
      const screenEl = document.getElementById('studocuTerminalScreen');
      if (screenEl) {
        screenEl.innerHTML = renderTerminalLogs(state.logs || []);
        screenEl.scrollTop = screenEl.scrollHeight;
      }
      const timerEl = document.getElementById('studocuTimer');
      if (timerEl) timerEl.textContent = `${state.elapsedSeconds || 0}s`;
      const stepEl = document.getElementById('studocuProgressStep');
      if (stepEl) stepEl.textContent = state.stepLabel || 'Khởi tạo...';
      const pctEl = document.getElementById('studocuProgressPct');
      if (pctEl) pctEl.textContent = `${state.progress || 5}%`;
      const barEl = document.getElementById('studocuProgressBar');
      if (barEl) barEl.style.width = `${state.progress || 5}%`;
    }

    const itemsEl = document.getElementById('studocuItemsContainer');
    const topItemId = state.filteredItems?.[0]?.name || state.filteredItems?.[0]?.id || '';
    const layoutKey = `${state.currentTab}:${state.sortOption}:${state.counts.pdf}:${state.counts.trash}:${topItemId}`;
    const highlightKey = state.justDownloadedDocName || '';

    if (listEl && layoutKey !== prevStructureKey) {
      prevStructureKey = layoutKey;
      prevJustDownloadedDocName = highlightKey;
      prevSearchQuery = state.searchQuery;
      listEl.innerHTML = renderDocumentListCard(state);
      if (window.lucide?.createIcons) window.lucide.createIcons();
      attachListHandlers();
    } else if (itemsEl && state.searchQuery !== prevSearchQuery) {
      prevSearchQuery = state.searchQuery;
      prevJustDownloadedDocName = highlightKey;
      const isTrash = state.currentTab === 'trash';
      const downloadedSet = state.downloadedDocNames || new Set();
      const justDownloadedName = state.justDownloadedDocName || null;
      const itemOptions = {
        isDocDownloaded: (name) => {
          const norm = (s) => (s || '').normalize('NFC').trim();
          return downloadedSet.has(norm(name));
        },
        isDocJustDownloaded: (name) => {
          const norm = (s) => (s || '').normalize('NFC').trim();
          return Boolean(justDownloadedName && norm(name) === justDownloadedName);
        }
      };
      itemsEl.innerHTML = renderDocumentItemsHtml(state.filteredItems || [], isTrash, itemOptions);
      if (window.lucide?.createIcons) window.lucide.createIcons({ root: itemsEl });
      attachItemRowHandlers(itemsEl);
      const clearBtn = document.getElementById('btnClearStudocuSearch');
      if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchQuery);
      const countBadge = document.getElementById('studocuItemCountBadge');
      if (countBadge) countBadge.textContent = `${(state.filteredItems || []).length} tệp`;
    } else if (itemsEl && highlightKey !== prevJustDownloadedDocName) {
      prevJustDownloadedDocName = highlightKey;
      const norm = (s) => (s || '').normalize('NFC').trim();
      const targetNorm = highlightKey ? norm(highlightKey) : null;
      itemsEl.querySelectorAll('.file-item').forEach(el => {
        const itemDocName = norm(el.getAttribute('data-doc-name'));
        const isMatch = Boolean(targetNorm && itemDocName === targetNorm);
        el.classList.toggle('file-item-downloaded', isMatch);
        el.classList.toggle('file-item-just-downloaded', isMatch);
      });
    }
  });

  function handleGlobalPaste(e) {
    if (['TEXTAREA', 'INPUT'].includes(e.target?.tagName)) return;
    const text = (e.clipboardData || window.clipboardData)?.getData('text');
    if (text && text.trim() && isValidStudocuUrl(text)) {
      e.preventDefault();
      handleUrlCandidate(text);
    }
  }

  window.addEventListener('paste', handleGlobalPaste);
  attachHeroHandlers();
  attachTerminalHandlers();
  attachListHandlers();

  return () => {
    unsubscribe();
    window.removeEventListener('paste', handleGlobalPaste);
    studocuManager.cleanupWorkspace();
  };
}
