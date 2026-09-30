/**
 * HistoryConfirmModal Component (< 50 lines)
 */

export function renderHistoryConfirmModal(confirmModal) {
  if (!confirmModal) return '';

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-sm text-zinc-900 dark:text-white">${confirmModal.title}</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">${confirmModal.message}</p>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button id="btnCancelConfirm" class="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition">Hủy</button>
          <button id="btnProceedConfirm" class="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition shadow-xs">Xác nhận</button>
        </div>
      </div>
    </div>
  `;
}
