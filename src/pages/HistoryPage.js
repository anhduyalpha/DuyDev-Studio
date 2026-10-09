/**
 * History & Trash Bin Page Controller (< 220 lines)
 */

import { storage } from '../utilities/storage.js';
import { ViewerConnector } from '../components/common/viewer/FileViewerConnector.js';
import { showToast } from '../utilities/toast.js';
import { openSlideConfirmModal } from '../components/common/SlideConfirmModal.js';
import { updateHeaderTrashIndicator } from '../components/layout/Header.js';
import { renderHistoryItemRow } from '../components/history/HistoryItemRow.js';

let historyState = {
  currentTab: 'history', historyItems: storage.getLocalHistory(),
  trashItems: storage.getLocalTrash(), searchQuery: ''
};

let isSyncing = false;

function renderHistoryRows(currentList, isTrash, q) {
  if (currentList.length === 0) {
    return `
      <div class="p-12 text-center text-xs text-zinc-400 font-mono space-y-2">
        <i data-lucide="${isTrash ? 'trash' : 'inbox'}" class="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 stroke-[1.5]"></i>
        <p>${q ? 'Không tìm thấy kết quả.' : (isTrash ? 'Thùng rác trống.' : 'Chưa có tác vụ.')}</p>
      </div>
    `;
  }
  return `
    <div class="divide-y divide-zinc-100 dark:divide-white/5">
      ${currentList.map(item => renderHistoryItemRow(item, isTrash)).join('')}
    </div>
  `;
}

export function renderHistoryPage(initialTab) {
  const hash = window.location.hash;
  historyState.currentTab = (initialTab === 'trash' || hash === '#trash') ? 'trash' : 'history';
  historyState.historyItems = storage.getLocalHistory();
  historyState.trashItems = storage.getLocalTrash();

  const { currentTab, historyItems, trashItems, searchQuery } = historyState;
  const isTrash = currentTab === 'trash';
  const rawList = isTrash ? trashItems : historyItems;
  const q = (searchQuery || '').trim().toLowerCase();
  const currentList = q
    ? rawList.filter(i => (i.fileName || '').toLowerCase().includes(q) || (i.toolTitle || i.tool || '').toLowerCase().includes(q))
    : rawList;

  return `
    <div class="space-y-6 animate-fadeIn">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <i data-lucide="${isTrash ? 'trash-2' : 'history'}" class="w-5 h-5 text-indigo-500 dark:text-indigo-400"></i>
            ${isTrash ? 'Thùng Rác' : 'Lịch Sử Tác Vụ'}
          </h2>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input id="inputHistorySearch" type="text" value="${searchQuery}" placeholder="Tìm kiếm..." class="w-36 sm:w-48 pl-8 pr-3 py-1.5 rounded-xl glass-search text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none transition font-sans" />
          </div>

          <div class="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold">
            <button id="btnTabHistory" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${!isTrash ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
              Lịch sử (${historyItems.length})
            </button>
            <button id="btnTabTrash" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${isTrash ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
              Thùng rác (${trashItems.length})
            </button>
          </div>

          ${!isTrash && historyItems.length > 0 ? `
            <button id="btnClearHistoryBtn" class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-600 dark:bg-white/[0.05] dark:hover:bg-red-500/20 dark:text-zinc-300 dark:hover:text-red-300 text-xs font-semibold border border-zinc-200 dark:border-white/5 transition cursor-pointer">
              Xóa tất cả
            </button>
          ` : ''}

          ${isTrash && trashItems.length > 0 ? `
            <button id="btnRestoreAllTrash" class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-300 text-xs font-semibold transition cursor-pointer">
              Khôi phục tất cả
            </button>
            <button id="btnEmptyTrashBtn" class="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-300 text-xs font-semibold transition cursor-pointer">
              Dọn sạch
            </button>
          ` : ''}
        </div>
      </div>

      <div id="historyItemsList" class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/5 overflow-hidden shadow-sm">
        ${renderHistoryRows(currentList, isTrash, q)}
      </div>
    </div>
  `;
}

function bindRowActions(root, rerender) {
  root.querySelectorAll('.btn-preview-history').forEach(btn => {
    btn.onclick = () => {
      const list = historyState.currentTab === 'trash' ? historyState.trashItems : historyState.historyItems;
      const item = list.find(x => x.id === btn.dataset.previewId);
      if (item) ViewerConnector.preview(item);
    };
  });

  root.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.deleting === 'true') return;
      btn.dataset.deleting = 'true';
      btn.closest('.history-row')?.classList.add('opacity-40', 'pointer-events-none');
      const id = btn.dataset.deleteHistory;
      const item = historyState.historyItems.find(x => x.id === id);
      if (item) {
        historyState.historyItems = historyState.historyItems.filter(x => x.id !== id);
        historyState.trashItems.unshift({ ...item, deletedAt: new Date().toISOString() });
        await storage.moveToTrash(id);
        updateHeaderTrashIndicator();
        showToast('Đã chuyển mục vào thùng rác', 'info');
        if (rerender) rerender();
      }
    };
  });

  root.querySelectorAll('.btn-restore-item').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.restoring === 'true') return;
      btn.dataset.restoring = 'true';
      const id = btn.dataset.restoreTrash;
      const item = historyState.trashItems.find(x => x.id === id);
      if (item) {
        historyState.trashItems = historyState.trashItems.filter(x => x.id !== id);
        historyState.historyItems.unshift(item);
        await storage.restoreTrashItem(id);
        updateHeaderTrashIndicator();
        showToast('Đã khôi phục', 'success');
        if (rerender) rerender();
      }
    };
  });

  root.querySelectorAll('.btn-perm-delete').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.deleting === 'true') return;
      btn.dataset.deleting = 'true';
      btn.closest('.history-row')?.classList.add('opacity-40', 'pointer-events-none');
      const id = btn.dataset.permDelete;
      historyState.trashItems = historyState.trashItems.filter(x => x.id !== id);
      await storage.permanentlyDeleteTrashItem(id);
      updateHeaderTrashIndicator();
      showToast('Đã xoá vĩnh viễn', 'info');
      if (rerender) rerender();
    };
  });
}

function updateHistoryListDom(rerender) {
  const container = document.getElementById('historyItemsList');
  if (!container) return;
  const isTrash = historyState.currentTab === 'trash';
  const rawList = isTrash ? historyState.trashItems : historyState.historyItems;
  const q = (historyState.searchQuery || '').trim().toLowerCase();
  const filtered = q
    ? rawList.filter(i => (i.fileName || '').toLowerCase().includes(q) || (i.toolTitle || i.tool || '').toLowerCase().includes(q))
    : rawList;

  container.innerHTML = renderHistoryRows(filtered, isTrash, q);
  if (window.lucide) window.lucide.createIcons({ root: container });
  bindRowActions(container, rerender);
}

export function attachHistoryPageListeners(rerender) {
  if (!isSyncing) {
    isSyncing = true;
    Promise.all([storage.fetchHistory(), storage.fetchTrash()])
      .then(([hist, trash]) => {
        isSyncing = false;
        const hChanged = JSON.stringify(hist) !== JSON.stringify(historyState.historyItems);
        const tChanged = JSON.stringify(trash) !== JSON.stringify(historyState.trashItems);
        if (hChanged || tChanged) {
          historyState.historyItems = hist;
          historyState.trashItems = trash;
          if (rerender) rerender();
        }
      })
      .catch(() => { isSyncing = false; });
  }

  const switchTab = (t) => {
    historyState.currentTab = t;
    if (window.location.hash !== `#${t}`) window.location.hash = `#${t}`;
    else if (rerender) rerender();
  };
  document.getElementById('btnTabHistory')?.addEventListener('click', () => switchTab('history'));
  document.getElementById('btnTabTrash')?.addEventListener('click', () => switchTab('trash'));

  // Seamless in-place search without losing input focus
  document.getElementById('inputHistorySearch')?.addEventListener('input', (e) => {
    historyState.searchQuery = e.target.value;
    updateHistoryListDom(rerender);
  });

  const listEl = document.getElementById('historyItemsList');
  if (listEl) bindRowActions(listEl, rerender);

  document.getElementById('btnClearHistoryBtn')?.addEventListener('click', () => {
    const count = historyState.historyItems.length;
    if (count === 0) return;
    openSlideConfirmModal({
      title: 'Xóa toàn bộ lịch sử',
      description: `Chuyển toàn bộ ${count} mục lịch sử vào thùng rác.`,
      warningText: 'Các mục này sẽ được chuyển vào Thùng rác và có thể khôi phục lại bất kỳ lúc nào.',
      actionText: 'Kéo sang phải để xóa tất cả',
      confirmingText: 'Đang chuyển vào thùng rác...',
      onConfirm: async () => {
        await storage.clearHistoryToTrash();
        historyState.trashItems = [...historyState.historyItems, ...historyState.trashItems];
        historyState.historyItems = [];
        updateHeaderTrashIndicator();
        showToast('Đã chuyển toàn bộ lịch sử vào thùng rác', 'info');
        if (rerender) rerender();
      }
    });
  });

  document.getElementById('btnRestoreAllTrash')?.addEventListener('click', async () => {
    await storage.restoreAllTrash();
    historyState.historyItems = [...historyState.trashItems, ...historyState.historyItems];
    historyState.trashItems = [];
    updateHeaderTrashIndicator();
    showToast('Đã khôi phục', 'success');
    if (rerender) rerender();
  });

  document.getElementById('btnEmptyTrashBtn')?.addEventListener('click', () => {
    openSlideConfirmModal({
      title: 'Dọn sạch thùng rác',
      description: 'Xóa vĩnh viễn toàn bộ tệp trong thùng rác.',
      warningText: 'Hành động này không thể hoàn tác. Các tệp sẽ bị xóa hoàn toàn khỏi máy chủ.',
      actionText: 'Kéo sang phải để xác nhận',
      confirmingText: 'Đang dọn sạch...',
      onConfirm: async () => {
        await storage.emptyTrash();
        historyState.trashItems = [];
        updateHeaderTrashIndicator();
        showToast('Đã dọn sạch thùng rác', 'info');
        if (rerender) rerender();
      }
    });
  });

  return () => {};
}
