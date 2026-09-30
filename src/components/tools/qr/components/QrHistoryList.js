/**
 * QrHistoryList Component (< 120 lines)
 * Displays recent QR code generations and scan results with quick actions
 */

import { storage } from '../../../../utilities/storage.js';
import { formatRelativeTime } from '../../../../utilities/formatters.js';
import { copyText, copyQrImageOrFallback } from '../../../../utilities/clipboard.js';
import { showToast } from '../../../../utilities/toast.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';

function parseQrDetails(fileName = '') {
  const match = fileName.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    const tag = match[1];
    const rest = match[2];
    let icon = 'qr-code';
    let badgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30';
    let iconBg = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';

    if (tag === 'VietQR') {
      icon = 'credit-card';
      badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30';
      iconBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    } else if (tag === 'Wi-Fi') {
      icon = 'wifi';
      badgeClass = 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-500/30';
      iconBg = 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    } else if (tag === 'Link Web') {
      icon = 'globe';
      badgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30';
      iconBg = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    } else if (tag === 'Danh Bạ') {
      icon = 'contact';
      badgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/30';
      iconBg = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    } else if (tag === 'Văn Bản') {
      icon = 'file-text';
      badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30';
      iconBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    } else if (tag.startsWith('Quét QR')) {
      icon = 'scan';
      badgeClass = 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-200/60 dark:border-teal-500/30';
      iconBg = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
    }

    const parts = rest.split(/\s*•\s*/);
    const mainTitle = parts[0] || rest;
    const subtitle = parts.slice(1).join(' • ');
    return { tag, mainTitle, subtitle, icon, badgeClass, iconBg, raw: rest };
  }

  const isScan = fileName.startsWith('Quét QR:');
  const clean = isScan ? fileName.replace(/^Quét QR:\s*/, '') : fileName;
  return {
    tag: isScan ? 'Đã Quét' : 'Mã QR',
    mainTitle: clean,
    subtitle: '',
    icon: isScan ? 'scan' : 'qr-code',
    badgeClass: isScan ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-200/60 dark:border-teal-500/30' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30',
    iconBg: isScan ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    raw: clean
  };
}

export function renderQrHistoryList(filterMode = 'all') {
  const allHistory = storage.getLocalHistory();
  const qrItems = allHistory.filter(item => {
    const isScan = item.toolId === 'qr-scan' || (item.fileName && (item.fileName.startsWith('Quét QR') || item.fileName.startsWith('[Quét QR')));
    const isCreate = item.toolId === 'qr-multi' || item.tool === 'Mã QR Đa Năng' || item.toolTitle === 'Mã QR Đa Năng' || item.toolTitle === 'Tạo Mã QR' || (item.fileName && (item.fileName.startsWith('QR_') || (item.fileName.startsWith('[') && !item.fileName.startsWith('[Quét QR'))));
    if (filterMode === 'create') return isCreate && !isScan;
    if (filterMode === 'scan') return isScan;
    return isScan || isCreate;
  }).slice(0, 15);

  if (qrItems.length === 0) return '';

  const titleText = filterMode === 'create' ? 'Lịch sử tạo QR' : (filterMode === 'scan' ? 'Lịch sử quét QR' : 'Lịch sử QR');

  return `
    <div class="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] space-y-4 shadow-sm">
      <div class="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-white/[0.05]">
        <h4 class="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="history" class="w-4 h-4 text-indigo-500"></i> ${titleText}
        </h4>
        <span class="text-xs text-zinc-400 font-mono">${qrItems.length} tác vụ</span>
      </div>

      <div class="divide-y divide-zinc-100 dark:divide-white/[0.05]">
        ${qrItems.map(item => {
          const info = parseQrDetails(item.fileName || '');
          const isUrl = item.downloadUrl && (item.downloadUrl.startsWith('http://') || item.downloadUrl.startsWith('https://'));
          const copyVal = isUrl ? item.downloadUrl : (info.raw || item.fileName || '');

          return `
            <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div class="w-9 h-9 rounded-xl ${info.iconBg} border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <i data-lucide="${info.icon}" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight ${info.badgeClass}">
                      ${info.tag}
                    </span>
                    <span class="font-semibold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm truncate font-mono" title="${info.mainTitle}">
                      ${info.mainTitle}
                    </span>
                  </div>
                  ${info.subtitle ? `
                    <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono truncate" title="${info.subtitle}">
                      ${info.subtitle}
                    </p>
                  ` : ''}
                  <p class="text-[10px] text-zinc-400 font-mono mt-0.5">
                    ${formatRelativeTime(item.createdAt || item.timestamp)}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button type="button" data-copy-qr-id="${item.id}" data-copy-text="${copyVal.replace(/"/g, '&quot;')}" title="Sao chép" class="btn-copy-qr-history px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép
                </button>

                ${isUrl ? `
                  <a href="${item.downloadUrl}" target="_blank" rel="noopener noreferrer" title="Mở link" class="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                  </a>
                ` : ''}

                ${item.downloadUrl && item.downloadUrl.startsWith('data:image') ? `
                  <button type="button" data-preview-qr="${item.id}" title="Xem" class="btn-preview-qr-item p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition cursor-pointer">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                  </button>
                ` : ''}

                <button type="button" data-trash-qr="${item.id}" data-url="${item.downloadUrl || ''}" title="Xóa" class="btn-trash-qr-item p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

export function attachQrHistoryListeners(onReRender) {
  document.querySelectorAll('.btn-preview-qr-item').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.previewQr;
      const all = storage.getLocalHistory();
      const item = all.find(x => x.id === id);
      if (item) ViewerConnector.preview(item);
    };
  });

  document.querySelectorAll('.btn-copy-qr-history').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.copyQrId;
      const all = storage.getLocalHistory();
      const item = all.find(x => x.id === id);
      if (item && item.downloadUrl && item.downloadUrl.startsWith('data:image')) {
        const res = await copyQrImageOrFallback({
          dataUrl: item.downloadUrl,
          text: item.fileName
        });
        if (res.success) {
          showToast(res.mode === 'image' ? 'Đã sao chép ảnh QR' : 'Đã sao chép link', 'success');
        } else {
          showToast('Không thể sao chép mã QR', 'error');
        }
      } else {
        const text = btn.dataset.copyText || (item ? item.downloadUrl || item.fileName : '');
        if (text) {
          const ok = await copyText(text);
          showToast(ok ? 'Đã sao chép nội dung' : 'Không thể sao chép', ok ? 'success' : 'error');
        }
      }
    };
  });

  document.querySelectorAll('.btn-trash-qr-item').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.deleting === 'true') return;
      const id = btn.dataset.trashQr || btn.dataset.url;
      if (id) {
        btn.dataset.deleting = 'true';
        btn.closest('.flex.items-center.justify-between')?.classList.add('opacity-40', 'pointer-events-none');
        await storage.moveToTrash(id);
        showToast('Đã xóa', 'info');
        if (onReRender) onReRender();
      }
    };
  });
}
