/**
 * Reusable Minimalist Reset Button Component
 * Standard Linear / Vercel style utility control
 */

export function renderResetStateButton(moduleId, label = 'Đặt lại') {
  return `
    <button type="button" data-reset-module="${moduleId}" title="Đặt lại" class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] transition cursor-pointer border border-zinc-200/70 dark:border-white/[0.06] shadow-2xs">
      <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
      <span>${label}</span>
    </button>
  `.trim();
}

export default renderResetStateButton;
