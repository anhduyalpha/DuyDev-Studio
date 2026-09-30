/**
 * HashCards Component (< 60 lines)
 * Renders hash result cards, comparison badges, and clipboard wiring.
 */

import { copyText } from '../../../../utilities/clipboard.js';
import { showToast } from '../../../../utilities/toast.js';

export function renderHashCards(hashes) {
  if (!hashes) return '<div class="text-center py-12 text-xs text-zinc-400 font-mono">Chưa có dữ liệu</div>';
  return `<div class="space-y-3">
    ${[
      { name: 'SHA-256', val: hashes.sha256 },
      { name: 'SHA-1', val: hashes.sha1 },
      { name: 'SHA-512', val: hashes.sha512 }
    ].map(h => `<div class="p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200/80 dark:border-white/[0.06] space-y-1">
      <div class="flex items-center justify-between text-[11px]"><span class="font-semibold text-zinc-700 dark:text-zinc-300">${h.name}</span><button data-copy-hash="${h.val}" class="btn-copy-hash text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 transition cursor-pointer"><i data-lucide="copy" class="w-3 h-3"></i> Chép</button></div>
      <p class="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all select-all">${h.val}</p>
    </div>`).join('')}
  </div>`;
}

export function renderCompareMatchHtml(match) {
  if (match === true) return '<p class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><i data-lucide="check-circle" class="w-4 h-4"></i> Trùng khớp</p>';
  if (match === false) return '<p class="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4"></i> Không trùng khớp</p>';
  return '';
}

export function bindCopyHashButtons(container = document) {
  if (!container) return;
  container.querySelectorAll('.btn-copy-hash').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.copyHash) {
        const ok = await copyText(btn.dataset.copyHash);
        showToast(ok ? 'Đã sao chép mã băm' : 'Không thể sao chép', ok ? 'success' : 'error');
      }
    };
  });
}
