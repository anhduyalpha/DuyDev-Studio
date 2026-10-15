/**
 * ScribdWorkspace Component (< 280 lines)
 * Native Zero-Iframe workspace orchestrator for Scribd Downloader.
 * High-performance selective DOM updates eliminating input focus loss.
 * 100% parity with Studocu Downloader specifications (KI-FIX-015).
 */

import { renderHeroPasteCard } from './components/HeroPasteCard.js';
import { renderLiveTerminalCard, renderTerminalLogs } from './components/LiveTerminalCard.js';
import { renderDocumentListCard, renderDocumentItemsHtml } from './components/DocumentListCard.js';
import { renderSlideConfirmModal, openSlideConfirmModal } from './components/SlideConfirmModal.js';
import { scribdManager, validateScribdUrlOrId, extractScribdUrlOrId } from './hooks/useScribd.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { showToast } from '../../../utilities/toast.js';

export function renderScribdWorkspace() {
  const state = scribdManager.getState();

  return `
    <div id="scribdWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-24 sm:pb-8">
      <!-- Breadcrumb Header with Brand Terracotta Identity -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-orange-700 dark:text-orange-400 font-semibold truncate inline-flex items-center gap-1.5">
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-[#EA580C]"></i>
            <span>Scribd Downloader</span>
          </span>
        </div>
      </div>

      <div id="scribdHeroContainer">${renderHeroPasteCard(state)}</div>
      <div id="scribdTerminalContainer">${renderLiveTerminalCard(state)}</div>
      <div id="scribdListContainer">${renderDocumentListCard(state)}</div>
      ${renderSlideConfirmModal()}
    </div>
  `.trim();
}

function handleUrlCandidate(raw) {
  const check = validateScribdUrlOrId(raw);
  if (!check.valid) {
    showToast(check.error, check.isSearch ? 'warning' : 'error');
    const t = document.getElementById('scribdPasteBtnTitle');
    if (t) {
      const old = t.textContent;
      t.textContent = check.isSearch ? 'Link tìm kiếm' : 'Link không hợp lệ';
      setTimeout(() => { if (t) t.textContent = old; }, 2500);
    }
    return;
  }
  const forceReload = Boolean(document.getElementById('chkScribdForceReload')?.checked);
  scribdManager.startDownload(check.candidate, forceReload);
}

export function attachScribdListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
  scribdManager.init();

  let prevDownloading = false;
  let prevStructureKey = '';
  let prevSearchQuery = '';

  function attachHeroHandlers() {
    const urlInput = document.getElementById('scribdUrlInput');
    const clearBtn = document.getElementById('btnClearScribdUrl');
    const heroCancel = document.getElementById('scribdHeroCancelBtn');
    const resetBtn = document.getElementById('btnResetScribdState');
    const form = document.getElementById('scribdDownloadForm');
    const toggleManualBtn = document.getElementById('scribdToggleManualBtn');
    const manualDrawer = document.getElementById('scribdManualDrawer');
    const manualChevron = document.getElementById('scribdManualChevron');
    const pasteBtn = document.getElementById('scribdPasteBtn');

    if (toggleManualBtn && manualDrawer) {
      toggleManualBtn.onclick = () => {
        const isHidden = manualDrawer.classList.toggle('hidden');
        if (manualChevron) manualChevron.style.transform = isHidden ? '' : 'rotate(180deg)';
        if (!isHidden && urlInput) {
          urlInput.focus();
        }
      };
    }

    if (pasteBtn && !pasteBtn.disabled) {
      pasteBtn.onclick = async () => {
        if (scribdManager.getState().isDownloading) return;
        // 1-Click Clipboard Read & Start
        if (navigator.clipboard?.readText) {
          try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
              const check = validateScribdUrlOrId(text.trim());
              if (check.valid) {
                handleUrlCandidate(text.trim());
                return;
              }
            }
          } catch (_) {}
        }
        // Fallback: open manual drawer and focus input
        if (manualDrawer) {
          manualDrawer.classList.remove('hidden');
          if (manualChevron) manualChevron.style.transform = 'rotate(180deg)';
        }
        if (urlInput) {
          urlInput.focus();
        }
        showToast('Dán liên kết vào ô nhập hoặc nhấn Ctrl + V', 'info');
      };
    }

    function syncClearBtn() {
      if (clearBtn && urlInput) {
        clearBtn.classList.toggle('hidden', !urlInput.value.trim());
      }
    }

    if (urlInput) {
      urlInput.oninput = () => syncClearBtn();
      urlInput.onpaste = () => setTimeout(syncClearBtn, 50);
      syncClearBtn();
    }

    if (clearBtn && urlInput) {
      clearBtn.onclick = () => {
        urlInput.value = '';
        syncClearBtn();
        urlInput.focus();
      };
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        let val = urlInput ? urlInput.value.trim() : '';

        // If input is empty, try reading from clipboard automatically
        if (!val) {
          if (navigator.clipboard?.readText) {
            try {
              const text = await navigator.clipboard.readText();
              if (text && text.trim()) {
                val = text.trim();
                if (urlInput) {
                  urlInput.value = val;
                  syncClearBtn();
                }
              }
            } catch (_) {}
          }
        }

        if (!val) {
          showToast('Vui lòng nhập hoặc dán liên kết tài liệu Scribd', 'warning');
          if (urlInput) urlInput.focus();
          return;
        }

        handleUrlCandidate(val);
      };
    }

    if (heroCancel) heroCancel.onclick = () => scribdManager.cancelJob();

    if (resetBtn) {
      resetBtn.onclick = () => {
        if (urlInput) {
          urlInput.value = '';
          syncClearBtn();
        }
        scribdManager.resetState();
      };
    }
  }

  function attachTerminalHandlers() {
    const cancelBtn = document.getElementById('scribdCancelBtn');
    if (cancelBtn) cancelBtn.onclick = () => scribdManager.cancelJob();

    const dismissBtn = document.getElementById('scribdDismissErrorBtn');
    if (dismissBtn) dismissBtn.onclick = () => scribdManager.dismissError();

    const copyBtn = document.getElementById('scribdCopyLogsBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const { logs } = scribdManager.getState();
        if (logs?.length) {
          navigator.clipboard.writeText(logs.join('\n')).then(() => {
            const txt = document.getElementById('scribdCopyLogsText');
            if (txt) { txt.textContent = 'Đã chép'; setTimeout(() => { txt.textContent = 'Sao chép'; }, 1500); }
            showToast('Đã sao chép nhật ký', 'success');
          });
        }
      };
    }
  }

  function attachItemRowHandlers(container = document) {
    container.querySelectorAll('.btn-view-scribd-doc').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = btn.getAttribute('data-doc-name');
        const title = btn.getAttribute('data-doc-title') || name;
        const streamUrl = `/api/v1/scribd/stream?file=${encodeURIComponent(name)}`;
        const downloadUrl = `/api/v1/scribd/download/${encodeURIComponent(name)}`;
        ViewerConnector.preview({
          id: name,
          name: title,
          fileName: name,
          category: 'pdf',
          mimeType: 'application/pdf',
          viewUrl: streamUrl,
          url: streamUrl,
          downloadUrl
        });
      };
    });

    container.querySelectorAll('.btn-trash-scribd-doc').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        scribdManager.moveToTrash(b.getAttribute('data-doc-name'));
      };
    });

    container.querySelectorAll('.btn-restore-scribd-doc').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        scribdManager.restoreFromTrash(b.getAttribute('data-doc-name'));
      };
    });

    container.querySelectorAll('.btn-delete-perm-scribd-doc').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        scribdManager.deletePermanent(b.getAttribute('data-doc-name'));
      };
    });

    container.querySelectorAll('.btn-save-scribd-drive').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        scribdManager.saveToDrive(b.getAttribute('data-doc-name'), b.getAttribute('data-doc-title'));
      };
    });

    container.querySelectorAll('.btn-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const docName = btn.getAttribute('data-doc-name') || btn.getAttribute('download');
        if (docName) {
          scribdManager.markAsDownloaded(docName, true);
        }
        const fileItem = btn.closest('.file-item');
        if (fileItem) {
          fileItem.classList.add('file-item-downloaded', 'file-item-just-downloaded');
        }
      });
    });
  }

  function attachListHandlers() {
    const searchInput = document.getElementById('scribdSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        scribdManager.setSearchQuery(e.target.value);
      };
    }

    const clearSearch = document.getElementById('btnClearScribdSearch');
    if (clearSearch) {
      clearSearch.onclick = () => {
        scribdManager.setSearchQuery('');
        if (searchInput) searchInput.value = '';
      };
    }

    const sortSelect = document.getElementById('scribdSortSelect');
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        scribdManager.setSortOption(e.target.value);
      };
    }

    document.querySelectorAll('.tab-filter-scribd').forEach(tab => {
      tab.onclick = () => {
        scribdManager.setTab(tab.getAttribute('data-tab'));
      };
    });

    const btnRefresh = document.getElementById('btnRefreshScribdList');
    if (btnRefresh) {
      btnRefresh.onclick = () => scribdManager.refreshFiles();
    }

    const btnEmptyTrash = document.getElementById('btnEmptyScribdTrash');
    if (btnEmptyTrash) {
      btnEmptyTrash.onclick = () => openSlideConfirmModal(() => scribdManager.emptyTrash());
    }

    attachItemRowHandlers(document);
  }

  const unsubscribe = scribdManager.subscribe((state) => {
    const heroEl = document.getElementById('scribdHeroContainer');
    const termCard = document.getElementById('scribdTerminalCard');
    const listEl = document.getElementById('scribdListContainer');

    if (heroEl && state.isDownloading !== prevDownloading) {
      const currentVal = document.getElementById('scribdUrlInput')?.value || '';
      heroEl.innerHTML = renderHeroPasteCard(state);
      const newInput = document.getElementById('scribdUrlInput');
      if (newInput && currentVal) {
        newInput.value = currentVal;
        const clearBtn = document.getElementById('btnClearScribdUrl');
        if (clearBtn) clearBtn.classList.remove('hidden');
      }
      prevDownloading = state.isDownloading;
      attachHeroHandlers();
      if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    const shouldShowTerminal = state.isDownloading || state.hasError;
    if (termCard) {
      termCard.classList.toggle('hidden', !shouldShowTerminal);
      const screenEl = document.getElementById('scribdTerminalScreen');
      if (screenEl) {
        screenEl.innerHTML = renderTerminalLogs(state.logs || []);
        screenEl.scrollTop = screenEl.scrollHeight;
      }
      const timerEl = document.getElementById('scribdTimer');
      if (timerEl) timerEl.textContent = `${state.elapsedSeconds || 0}s`;
      const badgeEl = document.getElementById('scribdStatusBadge');
      if (badgeEl) {
        if (state.isDownloading) {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 animate-pulse';
          badgeEl.textContent = 'ĐANG XỬ LÝ';
        } else if (state.hasError) {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-red-500/20 text-red-400 border border-red-500/30';
          badgeEl.textContent = 'LỖI';
        } else if (state.progress === 100) {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          badgeEl.textContent = 'HOÀN TẤT';
        } else {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
          badgeEl.textContent = 'ĐÃ HỦY';
        }
      }
      const stepEl = document.getElementById('scribdProgressStep');
      if (stepEl) stepEl.textContent = state.stepLabel || 'Đang kết nối máy chủ xử lý...';
      const pctEl = document.getElementById('scribdProgressPct');
      if (pctEl) pctEl.textContent = `${state.progress || 5}%`;
      const barEl = document.getElementById('scribdProgressBar');
      if (barEl) barEl.style.width = `${state.progress || 5}%`;
    }

    const itemsEl = document.getElementById('scribdItemsContainer');
    const topItemId = state.filteredItems?.[0]?.name || state.filteredItems?.[0]?.id || '';
    const structureKey = `${state.currentTab}:${state.sortOption}:${state.counts.pdf}:${state.counts.trash}:${topItemId}:${state.justDownloadedDocName || ''}:${(state.downloadedDocNames?.size || 0)}`;

    if (listEl && structureKey !== prevStructureKey) {
      prevStructureKey = structureKey;
      prevSearchQuery = state.searchQuery;
      listEl.innerHTML = renderDocumentListCard(state);
      if (window.lucide?.createIcons) window.lucide.createIcons();
      attachListHandlers();
    } else if (itemsEl && state.searchQuery !== prevSearchQuery) {
      prevSearchQuery = state.searchQuery;
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
      const clearBtn = document.getElementById('btnClearScribdSearch');
      if (clearBtn) clearBtn.classList.toggle('hidden', !state.searchQuery);
      const countBadge = document.getElementById('scribdItemCountBadge');
      if (countBadge) countBadge.textContent = `${(state.filteredItems || []).length} tệp`;
    }
  });

  function handleGlobalPaste(e) {
    if (['TEXTAREA', 'INPUT'].includes(e.target?.tagName)) return;
    const text = (e.clipboardData || window.clipboardData)?.getData('text');
    if (text && text.trim() && (extractScribdUrlOrId(text) || isScribdSearchUrl(text))) {
      e.preventDefault();
      const urlInput = document.getElementById('scribdUrlInput');
      if (urlInput) {
        urlInput.value = text.trim();
        const clearBtn = document.getElementById('btnClearScribdUrl');
        if (clearBtn) clearBtn.classList.remove('hidden');
      }
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
    scribdManager.cleanupWorkspace();
  };
}
