/**
 * Scribd Document Archiver Workspace Component
 * High-performance Zero-Iframe workspace orchestrator for Scribd Document Archiver.
 * Impeccable UI standards: Light-first & Dark parity, strict design tokens,
 * robust cleanup on unmount (KI-FIX-015).
 */

import { scribdManager, extractScribdUrlOrId } from './hooks/useScribd.js';
import { renderDocumentItem } from './components/DocumentItem.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { showToast } from '../../../utilities/toast.js';

export function renderScribdWorkspace() {
  const state = scribdManager.getState();
  const isDownloading = state.isDownloading;

  return `
    <div id="scribdWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <!-- Breadcrumb Header -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate">Scribd Document Archiver</span>
        </div>
      </div>

      <!-- Hero Input Card -->
      <div class="scribd-hero-card">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <i data-lucide="file-down" class="w-5 h-5"></i>
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">Kết Xuất Tài Liệu Scribd</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Trích xuất văn bản vector, bảng biểu và hình ảnh gốc sang định dạng PDF chất lượng cao.</p>
            </div>
          </div>
        </div>

        <form id="scribdDownloadForm" class="space-y-3" onsubmit="return false;">
          <div class="relative flex items-center">
            <input
              type="text"
              id="scribdUrlInput"
              class="w-full pl-3.5 pr-24 py-2.5 rounded-xl text-xs sm:text-sm bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] focus:border-indigo-500 dark:focus:border-indigo-500 focus:outline-none transition text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
              placeholder="Dán liên kết Scribd hoặc nhập mã ID (ví dụ: 693471767)..."
              autocomplete="off"
              ${isDownloading ? 'disabled' : ''}
            />
            <div class="absolute right-1.5 flex items-center gap-1">
              <button
                type="button"
                id="btnScribdPaste"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-white/[0.08] transition shadow-xs flex items-center gap-1 cursor-pointer min-h-[32px]"
                title="Dán nhanh từ Clipboard"
              >
                <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                <span class="hidden xs:inline">Dán</span>
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
              <input type="checkbox" id="chkScribdForceReload" class="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500" />
              <span>Kết xuất mới (Bỏ qua bộ nhớ đệm Cache)</span>
            </label>

            <button
              type="submit"
              id="btnScribdStart"
              class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-2 cursor-pointer min-h-[40px]"
              ${isDownloading ? 'disabled' : ''}
            >
              <i data-lucide="${isDownloading ? 'loader' : 'download-cloud'}" class="w-4 h-4 ${isDownloading ? 'animate-spin' : ''}"></i>
              <span>${isDownloading ? 'Đang kết xuất...' : 'Bắt đầu kết xuất'}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Live Terminal / Progress Card -->
      <div id="scribdTerminalCard" class="scribd-hero-card ${isDownloading || (state.logs && state.logs.length > 0) ? '' : 'hidden'}">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isDownloading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}"></span>
            <span id="scribdProgressStep" class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">${state.stepLabel || 'Sẵn sàng'}</span>
          </div>
          <div class="flex items-center gap-2">
            <span id="scribdProgressPct" class="text-xs sm:text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">${state.progress || 0}%</span>
            ${isDownloading ? `
              <button
                type="button"
                id="btnScribdCancel"
                class="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 transition cursor-pointer"
              >
                Hủy
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Progress Bar Thread -->
        <div class="w-full bg-zinc-200 dark:bg-white/[0.08] h-1.5 rounded-full overflow-hidden mb-3">
          <div id="scribdProgressBar" class="h-1.5 bg-indigo-600 rounded-full transition-all duration-300" style="width: ${state.progress || 0}%"></div>
        </div>

        <!-- Terminal Logs -->
        <div id="scribdTerminalScreen" class="scribd-terminal-box p-3 rounded-xl max-h-48 overflow-y-auto space-y-1">
          ${(state.logs || []).map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
        </div>
      </div>

      <!-- Document List Card -->
      <div class="scribd-hero-card">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <!-- Tabs -->
          <div class="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08]">
            <button
              type="button"
              id="tabScribdFiles"
              class="tab-filter-scribd px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${state.currentTab === 'files' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
              data-tab="files"
            >
              Tất cả tài liệu (${(state.files || []).length})
            </button>
            <button
              type="button"
              id="tabScribdTrash"
              class="tab-filter-scribd px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${state.currentTab === 'trash' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
              data-tab="trash"
            >
              Thùng rác (${(state.trash || []).length})
            </button>
          </div>

          <!-- Search & Actions -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <div class="relative flex-1 sm:w-48">
              <input
                type="text"
                id="inputScribdSearch"
                value="${escapeHtml(state.searchQuery || '')}"
                placeholder="Tìm tài liệu..."
                class="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] focus:border-indigo-500 focus:outline-none transition text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
              <i data-lucide="search" class="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400"></i>
            </div>
            <button
              type="button"
              id="btnRefreshScribdList"
              class="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] transition cursor-pointer"
              title="Làm mới danh sách"
            >
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            </button>
            ${state.currentTab === 'trash' && (state.trash || []).length > 0 ? `
              <button
                type="button"
                id="btnEmptyScribdTrash"
                class="px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 transition cursor-pointer flex items-center gap-1"
                title="Dọn sạch thùng rác"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span class="hidden xs:inline">Dọn sạch</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Files Container -->
        <div id="scribdItemsContainer" class="space-y-2">
          ${renderDocumentList(state)}
        </div>
      </div>
    </div>
  `.trim();
}

function renderDocumentList(state) {
  const isTrash = state.currentTab === 'trash';
  const list = isTrash ? (state.trash || []) : (state.files || []);
  const q = (state.searchQuery || '').toLowerCase();

  const filtered = q
    ? list.filter((item) => (item.name || '').toLowerCase().includes(q) || (item.title || '').toLowerCase().includes(q))
    : list;

  if (filtered.length === 0) {
    return `
      <div class="py-12 text-center text-zinc-400 dark:text-zinc-500">
        <i data-lucide="${isTrash ? 'trash' : 'inbox'}" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <p class="text-xs sm:text-sm font-medium">${isTrash ? 'Thùng rác trống' : 'Chưa có tài liệu nào được kết xuất'}</p>
        <p class="text-[11px] mt-0.5 text-zinc-400">${isTrash ? 'Các tệp bị xóa sẽ xuất hiện tại đây' : 'Nhập liên kết Scribd ở trên để bắt đầu lưu trữ'}</p>
      </div>
    `;
  }

  return filtered.map((doc) => renderDocumentItem(doc, isTrash)).join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function attachScribdListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
  scribdManager.init();

  let prevDownloading = false;
  let prevStructureKey = '';

  function handleFormSubmit() {
    const input = document.getElementById('scribdUrlInput');
    const chk = document.getElementById('chkScribdForceReload');
    const val = input ? input.value.trim() : '';
    if (!val) {
      showToast('Vui lòng nhập liên kết hoặc mã tài liệu Scribd', 'warning');
      return;
    }
    scribdManager.startDownload(val, Boolean(chk && chk.checked));
  }

  function attachHeroHandlers() {
    const form = document.getElementById('scribdDownloadForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        handleFormSubmit();
        return false;
      };
    }

    const pasteBtn = document.getElementById('btnScribdPaste');
    if (pasteBtn) {
      pasteBtn.onclick = async () => {
        if (scribdManager.getState().isDownloading) return;
        if (navigator.clipboard?.readText) {
          try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
              const input = document.getElementById('scribdUrlInput');
              if (input) input.value = text.trim();
              const extracted = extractScribdUrlOrId(text);
              if (extracted) {
                scribdManager.startDownload(extracted);
                return;
              }
              showToast('Đã dán văn bản từ clipboard', 'info');
              return;
            }
            showToast('Bộ nhớ tạm rỗng', 'warning');
            return;
          } catch (_) {}
        }
        showToast('Nhấn Ctrl + V để dán link', 'info');
      };
    }

    const cancelBtn = document.getElementById('btnScribdCancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => scribdManager.cancelJob();
    }
  }

  function attachListHandlers() {
    document.querySelectorAll('.tab-filter-scribd').forEach((tab) => {
      tab.onclick = () => {
        const targetTab = tab.getAttribute('data-tab');
        scribdManager.setTab(targetTab);
      };
    });

    const searchInput = document.getElementById('inputScribdSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        scribdManager.setSearchQuery(e.target.value);
      };
    }

    const refreshBtn = document.getElementById('btnRefreshScribdList');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        scribdManager.refreshFiles();
        showToast('Đã cập nhật danh sách', 'info');
      };
    }

    const emptyTrashBtn = document.getElementById('btnEmptyScribdTrash');
    if (emptyTrashBtn) {
      emptyTrashBtn.onclick = () => {
        if (confirm('Bạn có chắc chắn muốn dọn sạch toàn bộ thùng rác Scribd?')) {
          scribdManager.emptyTrash();
        }
      };
    }

    attachItemDelegation();
  }

  function attachItemDelegation() {
    const root = document.getElementById('scribdWorkspaceRoot');
    if (!root) return;

    root.onclick = (e) => {
      // 1. Xem trước PDF
      const viewBtn = e.target.closest('.btn-view-scribd-doc');
      if (viewBtn) {
        e.preventDefault();
        const docName = viewBtn.getAttribute('data-doc-name') || 'Tài liệu';
        const streamUrl = viewBtn.getAttribute('data-stream-url');
        const downloadUrl = viewBtn.getAttribute('data-download-url');

        ViewerConnector.openViewer({
          name: docName,
          viewUrl: streamUrl,
          downloadUrl: downloadUrl,
          mimeType: 'application/pdf',
          sourceModule: 'Scribd Archiver'
        });
        return;
      }

      // 2. Lưu vào Studio Drive
      const driveBtn = e.target.closest('.btn-save-scribd-drive');
      if (driveBtn) {
        e.preventDefault();
        const docName = driveBtn.getAttribute('data-doc-name');
        const docTitle = driveBtn.getAttribute('data-doc-title') || '';
        if (docName) scribdManager.saveToDrive(docName, docTitle);
        return;
      }

      // 3. Chuyển vào thùng rác
      const trashBtn = e.target.closest('.btn-trash-scribd-doc');
      if (trashBtn) {
        e.preventDefault();
        const docName = trashBtn.getAttribute('data-doc-name');
        if (docName) scribdManager.moveToTrash(docName);
        return;
      }

      // 4. Khôi phục từ thùng rác
      const restoreBtn = e.target.closest('.btn-restore-scribd-doc');
      if (restoreBtn) {
        e.preventDefault();
        const docName = restoreBtn.getAttribute('data-doc-name');
        if (docName) scribdManager.restoreFromTrash(docName);
        return;
      }

      // 5. Xóa vĩnh viễn
      const permBtn = e.target.closest('.btn-perm-delete-scribd-doc');
      if (permBtn) {
        e.preventDefault();
        const docName = permBtn.getAttribute('data-doc-name');
        if (docName && confirm(`Xóa vĩnh viễn tệp "${docName}"?`)) {
          scribdManager.deletePermanent(docName);
        }
        return;
      }
    };
  }

  // Subscribe state changes
  const unsubscribe = scribdManager.subscribe((state) => {
    const heroCard = document.getElementById('scribdDownloadForm');
    const termCard = document.getElementById('scribdTerminalCard');
    const itemsContainer = document.getElementById('scribdItemsContainer');

    // Terminal updates
    if (termCard) {
      const isVisible = state.isDownloading || (state.logs && state.logs.length > 0);
      termCard.classList.toggle('hidden', !isVisible);

      const stepEl = document.getElementById('scribdProgressStep');
      if (stepEl) stepEl.textContent = state.stepLabel || 'Sẵn sàng';

      const pctEl = document.getElementById('scribdProgressPct');
      if (pctEl) pctEl.textContent = `${state.progress || 0}%`;

      const barEl = document.getElementById('scribdProgressBar');
      if (barEl) barEl.style.width = `${state.progress || 0}%`;

      const screenEl = document.getElementById('scribdTerminalScreen');
      if (screenEl) {
        screenEl.innerHTML = (state.logs || []).map((l) => `<div>${escapeHtml(l)}</div>`).join('');
        screenEl.scrollTop = screenEl.scrollHeight;
      }
    }

    // List updates
    const structureKey = `${state.currentTab}:${(state.files || []).length}:${(state.trash || []).length}:${state.searchQuery}`;
    if (itemsContainer && structureKey !== prevStructureKey) {
      prevStructureKey = structureKey;
      itemsContainer.innerHTML = renderDocumentList(state);
      if (window.lucide?.createIcons) window.lucide.createIcons({ root: itemsContainer });
    }
  });

  // Global paste handler
  function handleGlobalPaste(e) {
    if (['TEXTAREA', 'INPUT'].includes(e.target?.tagName)) return;
    const text = (e.clipboardData || window.clipboardData)?.getData('text');
    if (text && text.trim()) {
      const extracted = extractScribdUrlOrId(text);
      if (extracted) {
        e.preventDefault();
        const input = document.getElementById('scribdUrlInput');
        if (input) input.value = text.trim();
        scribdManager.startDownload(extracted);
      }
    }
  }

  window.addEventListener('paste', handleGlobalPaste);
  attachHeroHandlers();
  attachListHandlers();

  // Return cleanup function
  return () => {
    unsubscribe();
    window.removeEventListener('paste', handleGlobalPaste);
    scribdManager.cleanupWorkspace();
  };
}
