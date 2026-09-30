/**
 * ConverterHistoryList Component (< 160 lines)
 * Dedicated history section for File Converter Pro
 */

import { storage } from '../../../../utilities/storage.js';
import { formatBytes, formatRelativeTime } from '../../../../utilities/formatters.js';
import { showToast } from '../../../../utilities/toast.js';
import { copyText } from '../../../../utilities/clipboard.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';

export function getConverterHistoryItems(limit = 5) {
  return storage.getLocalHistory().filter(i => {
    const tid = i.toolId || '';
    const title = i.toolTitle || i.tool || '';
    return (
      tid === 'universal-converter' ||
      tid === 'converter' ||
      tid === 'image-converter' ||
      tid === 'video-audio' ||
      title === 'File Converter' ||
      title === 'File Converter Pro' ||
      title === 'Chuyển Đổi Tệp'
    );
  }).slice(0, limit);
}

function resolveItemUrl(item) {
  return item.downloadUrl || (item.resultFileId ? `/api/v1/files/download/${item.resultFileId}` : (item.id ? `/api/v1/files/download/${item.id}` : '#'));
}

export function renderConverterHistoryList() {
  const items = getConverterHistoryItems(5);
  if (items.length === 0) {
    return `
      <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 shadow-xs">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <i data-lucide="clock" class="w-4 h-4 text-indigo-500"></i> Lịch sử
          </h4>
          <span class="text-xs font-mono text-zinc-400">Trống</span>
        </div>
        <p class="text-xs font-mono text-zinc-400 dark:text-zinc-500 text-center py-6">Chưa có lịch sử</p>
      </div>
    `.trim();
  }

  return `
    <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-4 shadow-xs">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/[0.06]">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <i data-lucide="clock" class="w-4 h-4 text-indigo-500"></i> Lịch sử
          </h4>
          <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">${items.length}</span>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <button id="btnClearConverterHistory" type="button" class="text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 font-semibold transition cursor-pointer">Xóa lịch sử</button>
          <span class="text-zinc-300 dark:text-zinc-700">|</span>
          <a href="#history" class="text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white font-semibold transition">Xem tất cả</a>
        </div>
      </div>

      <div class="space-y-2">
        ${items.map(item => {
          const time = item.timestamp || item.createdAt || Date.now();
          const origSize = Number(item.originalSize || 0);
          const resSize = Number(item.resultSize || item.size || 0);
          const targetFmt = (item.targetFormat || (item.fileName || '').split('.').pop() || 'FILE').toUpperCase();
          const url = resolveItemUrl(item);

          return `
            <div class="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/10 gap-3 transition">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">${targetFmt.slice(0, 4)}</div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate font-mono" title="${item.fileName || 'Tệp tin'}">${item.fileName || 'Tệp chuyển đổi'}</p>
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">${targetFmt}</span>
                  </div>
                  <p class="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                    ${origSize && resSize ? `${formatBytes(origSize)} → ${formatBytes(resSize)}` : formatBytes(resSize || origSize)} • ${formatRelativeTime(time)}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-preview-converter-id="${item.id}" title="Xem trước" class="btn-preview-converter-history p-1.5 text-zinc-600 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                <button type="button" data-reuse-converter-id="${item.id}" title="Xử lý tiếp" class="btn-reuse-converter-history p-1.5 text-zinc-600 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer"><i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i></button>
                <a href="${url}" download="${item.fileName || 'file'}" title="Tải về" class="p-1.5 text-zinc-600 hover:text-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition inline-flex items-center"><i data-lucide="download" class="w-3.5 h-3.5"></i></a>
                <button type="button" data-copy-converter-url="${url}" title="Sao chép link" class="btn-copy-converter-history p-1.5 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] rounded-lg transition cursor-pointer"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                <button type="button" data-trash-converter-id="${item.id}" title="Xóa" class="btn-trash-converter-history p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

export function updateConverterHistoryDom(manager) {
  const el = document.getElementById('converterHistoryContainer');
  if (!el) return;
  el.innerHTML = renderConverterHistoryList();
  bindConverterHistory(manager);
  if (window.lucide) window.lucide.createIcons({ root: el });
}

export function bindConverterHistory(manager) {
  const el = document.getElementById('converterHistoryContainer');
  if (!el) return;

  const btnClear = el.querySelector('#btnClearConverterHistory');
  if (btnClear) {
    btnClear.onclick = async () => {
      const items = getConverterHistoryItems(100);
      for (const it of items) await storage.moveToTrash(it.id);
      showToast('Đã xóa lịch sử', 'info');
      updateConverterHistoryDom(manager);
    };
  }

  el.querySelectorAll('.btn-preview-converter-history').forEach(btn => {
    btn.onclick = () => {
      const it = storage.getLocalHistory().find(x => x.id === btn.dataset.previewConverterId);
      if (it) ViewerConnector.preview(it);
    };
  });

  el.querySelectorAll('.btn-reuse-converter-history').forEach(btn => {
    btn.onclick = async () => {
      const it = storage.getLocalHistory().find(x => x.id === btn.dataset.reuseConverterId);
      if (!it) return;
      try {
        const url = resolveItemUrl(it);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể tải tệp từ máy chủ');
        const blob = await res.blob();
        const file = new File([blob], it.fileName || 'converted-file', { type: blob.type || 'application/octet-stream' });
        manager.addFiles([file]);
        document.getElementById('converterWorkspaceRoot')?.scrollIntoView({ behavior: 'smooth' });
        showToast('Đã nạp tệp', 'success');
      } catch (err) {
        showToast(err.message || 'Lỗi khi nạp tệp', 'error');
      }
    };
  });

  el.querySelectorAll('.btn-copy-converter-history').forEach(btn => {
    btn.onclick = async () => {
      const raw = btn.dataset.copyConverterUrl;
      if (!raw || raw === '#') return;
      const fullUrl = raw.startsWith('http') ? raw : new URL(raw, window.location.origin).href;
      if (await copyText(fullUrl)) showToast('Đã sao chép link', 'success');
    };
  });

  el.querySelectorAll('.btn-trash-converter-history').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.deleting === 'true') return;
      if (btn.dataset.trashConverterId) {
        btn.dataset.deleting = 'true';
        btn.closest('.flex.items-center.justify-between')?.classList.add('opacity-40', 'pointer-events-none');
        await storage.moveToTrash(btn.dataset.trashConverterId);
        showToast('Đã chuyển vào thùng rác', 'info');
        updateConverterHistoryDom(manager);
      }
    };
  });
}
