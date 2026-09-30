/**
 * ConverterProgress Component
 * Real-time SSE telemetry and glowing progress bar.
 * Pre-mounted and toggled via CSS hidden to prevent DOM destruction/flicker.
 */

export function renderConverterProgress(state) {
  const { isConverting = false, progress = 0, stage = '' } = state;
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return `
    <div id="converterProgressPanel" class="${isConverting ? '' : 'hidden'} p-5 rounded-2xl bg-white dark:bg-[#121215] border border-indigo-500/30 dark:border-indigo-500/20 shadow-lg space-y-3 transition-all duration-200">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span id="converterProgressStage" class="font-medium text-zinc-900 dark:text-white">
            ${stage || 'Đang xử lý dữ liệu...'}
          </span>
        </div>
        <span id="converterProgressPct" class="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
          ${pct}%
        </span>
      </div>

      <div class="w-full h-2.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden p-0.5 relative">
        <div id="converterProgressBar" class="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out relative shadow-[0_0_12px_rgba(99,102,241,0.5)]"
             style="width: ${pct}%">
          <div class="absolute right-0 top-0 bottom-0 w-2 bg-white/60 rounded-full blur-[1px]"></div>
        </div>
      </div>

      <div class="flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
        <span>SSE Stream Connected</span>
        <span id="converterStreamStatus">${pct < 100 ? 'Đang truyền luồng sự kiện...' : 'Hoàn tất'}</span>
      </div>
    </div>
  `.trim();
}
