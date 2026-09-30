/**
 * PdfHistoryList Component (< 250 lines)
 * Dedicated history & trash management section for PDF Studio Pro
 * Features visual operation badges, savings telemetry, and slide-to-confirm destruction.
 */

import { storage } from '../../../../utilities/storage.js';
import { formatBytes, formatRelativeTime } from '../../../../utilities/formatters.js';
import { showToast } from '../../../../utilities/toast.js';
import { copyText } from '../../../../utilities/clipboard.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';
import { openSlideConfirmModal } from '../../../common/SlideConfirmModal.js';
import { updateHeaderTrashIndicator } from '../../../layout/Header.js';

let activePdfHistoryTab = 'history';

/**
 * Maps PDF history item to operation metadata, icon, and semantic badge style.
 */
export function getPdfOperationMeta(item) {
  const fileName = (item.fileName || '').toLowerCase();
  const rawMode = (item.mode || item.operation || '').toLowerCase();

  if (rawMode === 'merge' || fileName.includes('_merge.')) {
    return { type: 'merge', label: 'Ghép PDF', icon: 'layers', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
  }
  if (rawMode === 'split' || fileName.includes('_split.')) {
    return { type: 'split', label: 'Tách trang', icon: 'scissors', badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
  }
  if (rawMode === 'rotate' || fileName.includes('_rotate.')) {
    return { type: 'rotate', label: 'Xoay trang', icon: 'rotate-cw', badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
  }
  if (rawMode === 'images_to_pdf' || fileName.includes('_images_to_pdf.')) {
    return { type: 'images_to_pdf', label: 'Ảnh → PDF', icon: 'image', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
  }
  if (rawMode === 'extract_images' || fileName.includes('_images.zip') || fileName.endsWith('.zip')) {
    return { type: 'extract_images', label: 'Trích ảnh', icon: 'images', badgeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' };
  }
  if (rawMode === 'watermark' || fileName.includes('_watermark.')) {
    return { type: 'watermark', label: 'Watermark', icon: 'stamp', badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' };
  }
  if (rawMode === 'lock' || fileName.includes('_lock.')) {
    return { type: 'lock', label: 'Khóa mật khẩu', icon: 'lock', badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
  }
  if (rawMode === 'unlock' || fileName.includes('_unlock.')) {
    return { type: 'unlock', label: 'Gỡ mật khẩu', icon: 'unlock', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
  }
  if (rawMode === 'organize' || fileName.includes('_organize.')) {
    return { type: 'organize', label: 'Sắp xếp', icon: 'layout-grid', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
  }
  if (rawMode === 'pdf_to_docx' || fileName.includes('_pdf_to_docx.') || fileName.endsWith('.docx')) {
    return { type: 'pdf_to_docx', label: 'Word DOCX', icon: 'file-text', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
  }
  if (rawMode === 'compress' || fileName.includes('_compress.')) {
    return { type: 'compress', label: 'Nén PDF', icon: 'minimize-2', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', isCompress: true };
  }
  return { type: 'pdf', label: 'Xử lý PDF', icon: 'file-text', badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' };
}

function isPdfItem(item) {
  const tid = item.toolId || '';
  const title = item.toolTitle || item.tool || '';
  const name = item.fileName ? item.fileName.toLowerCase() : '';
  const rawMode = (item.mode || item.operation || '').toLowerCase();
  return (
    tid === 'pdf-studio' || tid === 'pdf' || tid === 'pdf-convert' || tid === 'pdf-merge' || tid === 'pdf-lock' ||
    title === 'PDF Studio' || title === 'PDF Studio Pro' || title === 'Xử lý PDF' || title === 'Nén & Đổi PDF' ||
    rawMode === 'organize' || rawMode === 'pdf_to_docx' ||
    (name.endsWith('.pdf') && (item.category === 'pdf' || !tid || tid.startsWith('pdf'))) ||
    (name.endsWith('.docx') && (rawMode === 'pdf_to_docx' || !tid || tid.startsWith('pdf') || title.includes('PDF')))
  );
}

export function getPdfHistoryItems(limit = 10) {
  return storage.getLocalHistory().filter(isPdfItem).slice(0, limit);
}

export function getPdfTrashItems(limit = 10) {
  return storage.getLocalTrash().filter(isPdfItem).slice(0, limit);
}

export function renderPdfHistoryList() {
  const historyItems = getPdfHistoryItems(10);
  const trashItems = getPdfTrashItems(10);
  const isTrash = activePdfHistoryTab === 'trash';
  const currentList = isTrash ? trashItems : historyItems;

  return `
    <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-4 sm:p-5 space-y-4 shadow-xs select-none">
      <!-- Header with Segmented Tabs & Actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-white/[0.06]">
        <div class="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl text-xs font-semibold">
          <button type="button" id="btnPdfTabHistory"
            class="px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${!isTrash ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Lịch sử</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 font-bold">${historyItems.length}</span>
          </button>
          <button type="button" id="btnPdfTabTrash"
            class="px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${isTrash ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-500"></i>
            <span>Thùng rác</span>
            ${trashItems.length > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">${trashItems.length}</span>` : ''}
          </button>
        </div>

        <div class="flex items-center gap-3 text-xs">
          ${!isTrash ? `
            ${historyItems.length > 0 ? `
              <button id="btnClearPdfHistory" type="button" class="text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 font-semibold transition cursor-pointer flex items-center gap-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Xóa tất cả</span>
              </button>
              <span class="text-zinc-300 dark:text-zinc-700">|</span>
            ` : ''}
            <a href="#history" class="text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white font-semibold transition flex items-center gap-1">
              <span>Xem tất cả</span>
              <i data-lucide="external-link" class="w-3 h-3"></i>
            </a>
          ` : `
            ${trashItems.length > 0 ? `
              <button id="btnRestoreAllPdfTrash" type="button" class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold transition cursor-pointer flex items-center gap-1">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                <span>Khôi phục tất cả</span>
              </button>
              <span class="text-zinc-300 dark:text-zinc-700">|</span>
              <button id="btnEmptyPdfTrash" type="button" class="text-red-500 hover:text-red-600 dark:text-red-400 font-semibold transition cursor-pointer flex items-center gap-1">
                <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                <span>Dọn sạch</span>
              </button>
            ` : `
              <span class="text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">Thùng rác trống</span>
            `}
          `}
        </div>
      </div>

      <!-- Item Rows -->
      ${currentList.length === 0 ? `
        <div class="text-center py-8 space-y-2">
          <div class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center bg-zinc-100 dark:bg-white/[0.04] text-zinc-400">
            <i data-lucide="${isTrash ? 'trash' : 'inbox'}" class="w-5 h-5"></i>
          </div>
          <p class="text-xs font-mono text-zinc-400 dark:text-zinc-500">
            ${isTrash ? 'Thùng rác PDF hiện đang trống' : 'Chưa có lịch sử xử lý tài liệu PDF'}
          </p>
        </div>
      ` : `
        <div class="space-y-2.5">
          ${currentList.map((item) => {
            const time = item.timestamp || item.createdAt || Date.now();
            const origSize = Number(item.originalSize || 0);
            const resSize = Number(item.resultSize || item.size || 0);
            const meta = getPdfOperationMeta(item);
            const savedPct = Number(item.savedPct || 0);
            const hasSavings = meta.isCompress && origSize > 0 && resSize > 0 && origSize > resSize;

            return `
              <div class="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/10 gap-3 transition">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-9 h-9 rounded-xl ${meta.badgeClass} flex items-center justify-center shrink-0 shadow-2xs">
                    <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${meta.badgeClass}">
                        ${meta.label}
                      </span>
                      <p class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate font-mono" title="${item.fileName || 'Tài liệu'}">
                        ${item.fileName || 'Tài liệu PDF'}
                      </p>
                    </div>
                    <div class="flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex-wrap">
                      ${hasSavings ? `
                        <span>${formatBytes(origSize)} → <strong class="text-zinc-800 dark:text-zinc-200">${formatBytes(resSize)}</strong></span>
                        <span class="px-1.5 py-0.2 rounded font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">-${savedPct || Math.round(((origSize - resSize) / origSize) * 100)}%</span>
                      ` : `
                        <span>${formatBytes(resSize || origSize)}</span>
                      `}
                      <span>•</span>
                      <span>${isTrash ? `Đã xóa ${formatRelativeTime(item.deletedAt || time)}` : formatRelativeTime(time)}</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  ${!isTrash ? `
                    <button type="button" data-preview-pdf-id="${item.id}" title="Xem trước"
                      class="btn-preview-pdf-history p-1.5 text-zinc-600 hover:text-amber-500 dark:text-zinc-400 dark:hover:text-amber-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-reuse-pdf-id="${item.id}" title="Xử lý tiếp"
                      class="btn-reuse-pdf-history p-1.5 text-zinc-600 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer">
                      <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                    </button>
                    <a href="${item.downloadUrl || '#'}" download="${item.fileName || 'document.pdf'}" title="Tải về"
                      class="p-1.5 text-zinc-600 hover:text-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition inline-flex items-center">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </a>
                    <button type="button" data-copy-pdf-url="${item.downloadUrl || ''}" title="Sao chép link"
                      class="btn-copy-pdf-history p-1.5 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-trash-pdf-id="${item.id}" title="Chuyển vào thùng rác"
                      class="btn-trash-pdf-history p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  ` : `
                    <button type="button" data-preview-pdf-id="${item.id}" title="Xem trước"
                      class="btn-preview-pdf-history p-1.5 text-zinc-600 hover:text-amber-500 dark:text-zinc-400 dark:hover:text-amber-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-restore-pdf-id="${item.id}" title="Khôi phục"
                      class="btn-restore-single-trash p-1.5 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer">
                      <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" data-delete-pdf-id="${item.id}" title="Xóa vĩnh viễn"
                      class="btn-delete-single-trash p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer">
                      <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `.trim();
}

export function updatePdfHistoryDom(qm) {
  const el = document.getElementById('pdfHistoryContainer');
  if (!el) return;
  el.innerHTML = renderPdfHistoryList();
  bindPdfHistory(qm);
  if (window.lucide) window.lucide.createIcons({ root: el });
}

export function bindPdfHistory(qm) {
  const el = document.getElementById('pdfHistoryContainer');
  if (!el) return;

  el.querySelector('#btnPdfTabHistory')?.addEventListener('click', () => {
    activePdfHistoryTab = 'history';
    updatePdfHistoryDom(qm);
  });

  el.querySelector('#btnPdfTabTrash')?.addEventListener('click', () => {
    activePdfHistoryTab = 'trash';
    updatePdfHistoryDom(qm);
  });

  // Slide-to-confirm for Clearing History (Moving all to Trash)
  const btnClear = el.querySelector('#btnClearPdfHistory');
  if (btnClear) {
    btnClear.onclick = () => {
      const items = getPdfHistoryItems(100);
      if (items.length === 0) return;
      openSlideConfirmModal({
        title: 'Xóa lịch sử PDF',
        description: `Chuyển toàn bộ ${items.length} tác vụ lịch sử PDF vào thùng rác.`,
        warningText: 'Các mục này sẽ được chuyển vào Thùng rác và có thể khôi phục lại bất kỳ lúc nào.',
        actionText: 'Trượt sang phải để xóa tất cả',
        confirmingText: 'Đang chuyển vào thùng rác...',
        onConfirm: async () => {
          // 1. Optimistic instant storage update
          storage.moveItemsToTrashSync(items.map((it) => it.id));

          // 2. Instant DOM & indicator update
          updateHeaderTrashIndicator();
          showToast(`Đã chuyển ${items.length} tác vụ vào thùng rác`, 'info');
          updatePdfHistoryDom(qm);

          // 3. Background server sync
          if (storage.getLocalHistory().length === 0) {
            storage.clearHistoryToTrash().catch(() => {});
          } else {
            Promise.all(items.map((it) => fetch(`/api/v1/history/${encodeURIComponent(it.id)}`, { method: 'DELETE' }).catch(() => {})));
          }
        }
      });
    };
  }

  // Slide-to-confirm for Emptying PDF Trash permanently
  const btnEmpty = el.querySelector('#btnEmptyPdfTrash');
  if (btnEmpty) {
    btnEmpty.onclick = () => {
      const trashItems = getPdfTrashItems(100);
      if (trashItems.length === 0) return;
      openSlideConfirmModal({
        title: 'Dọn sạch thùng rác PDF',
        description: `Xóa vĩnh viễn ${trashItems.length} tệp PDF khỏi hệ thống.`,
        warningText: 'Hành động này không thể hoàn tác. Các tệp sẽ bị xóa hoàn toàn khỏi máy chủ.',
        actionText: 'Trượt sang phải để xóa vĩnh viễn',
        confirmingText: 'Đang dọn sạch...',
        onConfirm: async () => {
          // 1. Optimistic instant storage purge
          storage.permanentlyDeleteItemsSync(trashItems.map((it) => it.id));

          // 2. Instant DOM & indicator update
          updateHeaderTrashIndicator();
          showToast('Đã dọn sạch thùng rác PDF', 'success');
          updatePdfHistoryDom(qm);

          // 3. Background server deletion
          if (storage.getLocalTrash().length === 0) {
            storage.emptyTrash().catch(() => {});
          } else {
            Promise.all(trashItems.map((it) => fetch(`/api/v1/trash/${encodeURIComponent(it.id)}`, { method: 'DELETE' }).catch(() => {})));
          }
        }
      });
    };
  }

  // Restore all PDF items from trash
  const btnRestoreAll = el.querySelector('#btnRestoreAllPdfTrash');
  if (btnRestoreAll) {
    btnRestoreAll.onclick = async () => {
      const trashItems = getPdfTrashItems(100);
      if (trashItems.length === 0) return;

      // 1. Optimistic instant storage restore
      storage.restoreItemsFromTrashSync(trashItems.map((it) => it.id));

      // 2. Instant DOM & indicator update
      updateHeaderTrashIndicator();
      showToast(`Đã khôi phục ${trashItems.length} tệp PDF`, 'success');
      activePdfHistoryTab = 'history';
      updatePdfHistoryDom(qm);

      // 3. Background server restore
      if (storage.getLocalTrash().length === 0) {
        storage.restoreAllTrash().catch(() => {});
      } else {
        Promise.all(trashItems.map((it) => fetch(`/api/v1/trash/${encodeURIComponent(it.id)}/restore`, { method: 'POST' }).catch(() => {})));
      }
    };
  }

  // Item row event bindings
  el.querySelectorAll('.btn-preview-pdf-history').forEach((btn) => {
    btn.onclick = () => {
      const list = activePdfHistoryTab === 'trash' ? storage.getLocalTrash() : storage.getLocalHistory();
      const it = list.find((x) => x.id === btn.dataset.previewPdfId);
      if (it) ViewerConnector.preview(it);
    };
  });

  el.querySelectorAll('.btn-reuse-pdf-history').forEach((btn) => {
    btn.onclick = async () => {
      const it = storage.getLocalHistory().find((x) => x.id === btn.dataset.reusePdfId);
      if (it && (await qm.addFileFromHistory(it))) {
        document.getElementById('pdfStudioWorkspaceRoot')?.scrollIntoView({ behavior: 'smooth' });
        showToast('Đã nạp tệp', 'success');
      }
    };
  });

  el.querySelectorAll('.btn-copy-pdf-history').forEach((btn) => {
    btn.onclick = async () => {
      if (btn.dataset.copyPdfUrl && (await copyText(btn.dataset.copyPdfUrl))) {
        showToast('Đã sao chép link', 'success');
      }
    };
  });

  el.querySelectorAll('.btn-trash-pdf-history').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.deleting === 'true') return;
      btn.dataset.deleting = 'true';
      btn.closest('.pdf-history-row')?.classList.add('opacity-40', 'pointer-events-none');
      const id = btn.dataset.trashPdfId;
      if (!id) return;
      storage.moveToTrashSync(id);
      updateHeaderTrashIndicator();
      showToast('Đã chuyển vào thùng rác', 'info');
      updatePdfHistoryDom(qm);
      fetch(`/api/v1/history/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    };
  });

  el.querySelectorAll('.btn-restore-single-trash').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.restoring === 'true') return;
      btn.dataset.restoring = 'true';
      const id = btn.dataset.restorePdfId;
      if (!id) return;
      const restored = storage.restoreTrashItemSync(id);
      updateHeaderTrashIndicator();
      showToast('Đã khôi phục tệp', 'success');
      updatePdfHistoryDom(qm);
      const targetId = restored?.id || id;
      fetch(`/api/v1/trash/${encodeURIComponent(targetId)}/restore`, { method: 'POST' }).catch(() => {});
    };
  });

  el.querySelectorAll('.btn-delete-single-trash').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.deleting === 'true') return;
      btn.dataset.deleting = 'true';
      btn.closest('.pdf-history-row')?.classList.add('opacity-40', 'pointer-events-none');
      const id = btn.dataset.deletePdfId;
      if (!id) return;
      storage.permanentlyDeleteTrashItemSync(id);
      updateHeaderTrashIndicator();
      showToast('Đã xóa vĩnh viễn tệp', 'info');
      updatePdfHistoryDom(qm);
      fetch(`/api/v1/trash/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    };
  });
}
