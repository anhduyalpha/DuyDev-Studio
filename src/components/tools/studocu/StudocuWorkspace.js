/**
 * StudocuWorkspace Component (< 230 lines)
 * Native Zero-Iframe workspace orchestrator for Studocu Downloader.
 * High-performance selective DOM updates eliminating input focus loss.
 */

import { renderHeroPasteCard } from './components/HeroPasteCard.js';
import { renderLiveTerminalCard, renderTerminalLogs } from './components/LiveTerminalCard.js';
import { renderDocumentListCard, renderDocumentItemsHtml } from './components/DocumentListCard.js';
import { renderSlideConfirmModal, openSlideConfirmModal } from './components/SlideConfirmModal.js';
import { renderInvalidUrlAlertModal, openInvalidUrlAlertModal } from './components/InvalidUrlAlertModal.js';
import { studocuManager } from './hooks/useStudocu.js';
import { extractStudocuUrl, verifyStudocuUrl } from './hooks/studocuApi.js';
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

export { extractStudocuUrl, verifyStudocuUrl };

function isValidStudocuUrl(str) {
  return verifyStudocuUrl(str).isValid;
}

function handleUrlCandidate(raw) {
  const clean = String(raw || '').trim();
  const urlInput = document.getElementById('studocuUrlInput');
  const clearBtn = document.getElementById('btnClearStudocuUrl');

  if (!clean) {
    showToast('Vui lòng nhập hoặc dán liên kết Studocu', 'warning');
    return;
  }

  const check = verifyStudocuUrl(clean);
  const targetUrl = check.url || clean;

  if (urlInput && urlInput.value !== targetUrl) {
    urlInput.value = targetUrl;
  }
  if (clearBtn) clearBtn.classList.toggle('hidden', !urlInput?.value?.trim());

  if (!check.isValid) {
    openInvalidUrlAlertModal({
      title: check.type === 'course' ? 'Liên kết môn học, không phải tài liệu' : 'Liên kết không hợp lệ',
      subtitle: check.type === 'course' ? 'Cần chọn tệp tài liệu cụ thể để tải' : 'Vui lòng kiểm tra lại đường dẫn',
      message: check.error
    });
    showToast(check.error || 'Link studocu không hợp lệ', 'warning');
    const t = document.getElementById('studocuPasteBtnTitle');
    if (t) {
      const old = t.textContent;
      t.textContent = check.type === 'course' ? 'Link môn học, không phải file' : 'Liên kết không hợp lệ';
      setTimeout(() => { if (t) t.textContent = old; }, 2500);
    }
    return;
  }
  studocuManager.startDownload(check.url, null);
}

export function attachStudocuListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
  studocuManager.init();

  let prevDownloading = false;
  let prevStructureKey = '';
  let prevSearchQuery = '';
  let prevJustDownloadedDocName = '';
  let prevJustDownloadedDocId = '';

  function scrollToDocument(identifier, docId = null) {
    if (!identifier && !docId) return;
    const itemsEl = document.getElementById('studocuItemsContainer');
    if (!itemsEl) return;
    const norm = (s) => (s || '').normalize('NFC').trim().toLowerCase();
    const cleanExt = (s) => norm(s).replace(/\.(pdf|md)$/i, '');
    const targetNorm = identifier ? norm(identifier) : null;
    const targetClean = identifier ? cleanExt(identifier) : null;
    const targetDocId = docId ? String(docId).trim() : null;

    let targetEl = null;
    itemsEl.querySelectorAll('.file-item').forEach(el => {
      if (targetEl) return;
      const itemDocName = norm(el.getAttribute('data-doc-name'));
      const itemDocId = el.getAttribute('data-doc-id');
      const isMatch = Boolean(
        (targetNorm && (itemDocName === targetNorm || cleanExt(itemDocName) === targetClean)) ||
        (targetDocId && itemDocId && itemDocId === targetDocId)
      );
      if (isMatch) targetEl = el;
    });

    if (targetEl) {
      requestAnimationFrame(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

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
          const check = verifyStudocuUrl(trimmed);
          const targetUrl = check.url || trimmed;
          if (urlInput) {
            urlInput.value = targetUrl;
            if (clearBtn) clearBtn.classList.remove('hidden');
          }
          updateButtonState();

          if (check.isValid) {
            showToast('Đã dán liên kết & bắt đầu tải...', 'success');
            studocuManager.startDownload(check.url, null);
            return;
          } else {
            if (urlInput) urlInput.focus();
            openInvalidUrlAlertModal({
              title: check.type === 'course' ? 'Liên kết môn học, không phải tài liệu' : 'Liên kết không hợp lệ',
              subtitle: check.type === 'course' ? 'Cần chọn tệp tài liệu cụ thể để tải' : 'Vui lòng kiểm tra lại đường dẫn',
              message: check.error
            });
            showToast(check.error || 'Nội dung trong clipboard không phải liên kết Studocu hợp lệ', 'warning');
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
      const badgeEl = document.getElementById('studocuStatusBadge');
      if (badgeEl) {
        badgeEl.innerHTML = state.isDownloading
          ? '<span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">ĐANG TẢI</span>'
          : state.hasError
            ? '<span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-red-500/20 text-red-400 border border-red-500/30">THẤT BẠI</span>'
            : '<span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">HOÀN TẤT</span>';
      }
      if (barEl) barEl.style.width = `${state.progress || 5}%`;
    }

    const itemsEl = document.getElementById('studocuItemsContainer');
    const topItemId = state.filteredItems?.[0]?.name || state.filteredItems?.[0]?.id || '';
    const layoutKey = `${state.currentTab}:${state.sortOption}:${state.counts.pdf}:${state.counts.trash}:${topItemId}`;
    const highlightKey = state.justDownloadedDocName || '';
    const highlightId = state.justDownloadedDocId || '';

    if (listEl && layoutKey !== prevStructureKey) {
      prevStructureKey = layoutKey;
      prevJustDownloadedDocName = highlightKey;
      prevJustDownloadedDocId = highlightId;
      prevSearchQuery = state.searchQuery;
      listEl.innerHTML = renderDocumentListCard(state);
      if (window.lucide?.createIcons) window.lucide.createIcons();
      attachListHandlers();
      if (highlightKey || highlightId) {
        scrollToDocument(highlightKey, highlightId);
      }
    } else if (itemsEl && state.searchQuery !== prevSearchQuery) {
      prevSearchQuery = state.searchQuery;
      prevJustDownloadedDocName = highlightKey;
      prevJustDownloadedDocId = highlightId;
      const isTrash = state.currentTab === 'trash';
      const downloadedSet = state.downloadedDocNames || new Set();
      const justDownloadedName = state.justDownloadedDocName || null;
      const itemOptions = {
        isDocDownloaded: (name, id) => {
          const norm = (s) => (s || '').normalize('NFC').trim().toLowerCase();
          const cleanExt = (s) => norm(s).replace(/\.(pdf|md)$/i, '');
          const n = norm(name);
          if (justDownloadedName && (n === norm(justDownloadedName) || cleanExt(n) === cleanExt(justDownloadedName))) return true;
          if (highlightId && id && String(id).trim() === highlightId) return true;
          return downloadedSet.has(norm(name));
        },
        isDocJustDownloaded: (name, id) => {
          const norm = (s) => (s || '').normalize('NFC').trim().toLowerCase();
          const cleanExt = (s) => norm(s).replace(/\.(pdf|md)$/i, '');
          const n = norm(name);
          if (justDownloadedName && (n === norm(justDownloadedName) || cleanExt(n) === cleanExt(justDownloadedName))) return true;
          if (highlightId && id && String(id).trim() === highlightId) return true;
          return false;
        }
      };
      itemsEl.innerHTML = renderDocumentItemsHtml(state.filteredItems || [], isTrash, itemOptions);
      if (window.lucide?.createIcons) window.lucide.createIcons({ root: itemsEl });
      attachItemRowHandlers(itemsEl);
      const clearBtn = document.getElementById('btnClearStudocuSearch');
      if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchQuery);
      const countBadge = document.getElementById('studocuItemCountBadge');
      if (countBadge) countBadge.textContent = `${(state.filteredItems || []).length} tệp`;
      if (highlightKey || highlightId) {
        scrollToDocument(highlightKey, highlightId);
      }
    } else if (itemsEl && (highlightKey !== prevJustDownloadedDocName || highlightId !== prevJustDownloadedDocId)) {
      prevJustDownloadedDocName = highlightKey;
      prevJustDownloadedDocId = highlightId;
      const norm = (s) => (s || '').normalize('NFC').trim().toLowerCase();
      const cleanExt = (s) => norm(s).replace(/\.(pdf|md)$/i, '');
      const targetNorm = highlightKey ? norm(highlightKey) : null;
      const targetClean = highlightKey ? cleanExt(highlightKey) : null;
      const targetId = highlightId ? String(highlightId).trim() : null;

      let matchedEl = null;
      itemsEl.querySelectorAll('.file-item').forEach(el => {
        const itemDocName = norm(el.getAttribute('data-doc-name'));
        const itemDocId = el.getAttribute('data-doc-id');
        const isMatch = Boolean(
          (targetNorm && (itemDocName === targetNorm || cleanExt(itemDocName) === targetClean)) ||
          (targetId && itemDocId && itemDocId === targetId)
        );
        el.classList.toggle('file-item-downloaded', isMatch);
        el.classList.toggle('file-item-just-downloaded', isMatch);
        if (isMatch && !matchedEl) {
          matchedEl = el;
        }
      });

      if (matchedEl && (highlightKey || highlightId)) {
        requestAnimationFrame(() => {
          matchedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
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
