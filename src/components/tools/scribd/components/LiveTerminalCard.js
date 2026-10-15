/**
 * LiveTerminalCard Component - Integrated Compact Progress Drawer
 * Scoped for Scribd Document Archiver.
 * Features 3-step segmented indicator, big percentage readout, and collapsible 4-line log ticker.
 */

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

export function parseLogType(text) {
  if (text.includes('✅') || text.includes('Tải hoàn tất') || text.includes('Tải thành công') || text.includes('Hoàn tất') || text.includes('Sẵn sàng')) {
    return { type: 'success', icon: '✓' };
  }
  if (text.includes('❌') || text.includes('THẤT BẠI') || text.includes('LỖI') || text.includes('Error') || text.includes('thất bại')) {
    return { type: 'error', icon: '✕' };
  }
  if (text.includes('⚠️') || text.includes('Cảnh báo') || text.includes('giới hạn') || text.includes('hàng đợi')) {
    return { type: 'warn', icon: '!' };
  }
  if (text.includes('🔄') || text.includes('thu thập') || text.includes('Trang ') || text.includes('Ghép nối') || text.includes('In ấn') || text.includes('kết xuất') || text.includes('Đang xuất')) {
    return { type: 'progress', icon: '↻' };
  }
  if (text.includes('⚡') || text.includes('🚀') || text.includes('Nhận diện') || text.includes('CACHE') || text.includes('giải phóng')) {
    return { type: 'accent', icon: '⚡' };
  }
  return { type: 'normal', icon: '›' };
}

export function renderTerminalLogs(logs) {
  if (!logs || logs.length === 0) {
    return '<div class="text-zinc-500 text-xs italic py-2">Chờ nhật ký tiến trình...</div>';
  }
  const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
  return logs.map((raw, idx) => {
    const isLast = (idx === logs.length - 1);
    const { type, icon } = parseLogType(raw);
    let clean = raw.replace(emojiRegex, '').trim();
    if (!clean) clean = raw.trim();
    const num = String(idx + 1).padStart(2, '0');
    const activeClass = isLast ? ' log-active' : '';

    return `
      <div class="log-line log-${type}${activeClass} flex items-start gap-2 py-0.5 leading-relaxed">
        <span class="log-num text-zinc-500 shrink-0 select-none">${num}</span>
        <span class="log-badge-icon text-orange-400 shrink-0 font-bold select-none">${icon}</span>
        <span class="log-text flex-1 break-words">${escapeHtml(clean)}</span>
      </div>
    `.trim();
  }).join('');
}

export function getStatusBadgeHtml(state) {
  if (state.isDownloading) {
    return '<span id="scribdStatusBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-orange-500/20 text-[#EA580C] dark:text-orange-400 border border-orange-500/30 animate-pulse">ĐANG XỬ LÝ</span>';
  }
  if (state.hasError) {
    return '<span id="scribdStatusBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30">LỖI</span>';
  }
  if (state.progress === 100) {
    return '<span id="scribdStatusBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">HOÀN TẤT</span>';
  }
  return '<span id="scribdStatusBadge" class="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-zinc-500/20 text-zinc-500 dark:text-zinc-400 border border-zinc-500/30">SẴN SÀNG</span>';
}

export function renderLiveTerminalCard(state) {
  const isVisible = Boolean(state.isDownloading || state.hasError);
  const isRunning = Boolean(state.isDownloading);
  const statusBadge = getStatusBadgeHtml(state);
  const pct = Number(state.progress || 5);

  const step1Class = pct >= 25 ? 'step-done' : 'step-active';
  const step2Class = pct >= 85 ? 'step-done' : (pct >= 25 ? 'step-active' : '');
  const step3Class = pct >= 100 ? 'step-done' : (pct >= 85 ? 'step-active' : '');

  return `
    <div id="scribdTerminalCard" class="scribd-progress-panel ${isVisible ? '' : 'hidden'} p-4 sm:p-5 space-y-4">
      <!-- 1. Segmented Step Indicator -->
      <div class="scribd-step-container">
        <div id="scribdStep1" class="scribd-step-item ${step1Class}">
          <i data-lucide="${pct >= 25 ? 'check' : 'radio'}" class="w-3.5 h-3.5 shrink-0 ${pct < 25 ? 'animate-pulse text-[#EA580C]' : ''}"></i>
          <span class="truncate">1. Kết nối</span>
        </div>
        <div id="scribdStep2" class="scribd-step-item ${step2Class}">
          <i data-lucide="${pct >= 85 ? 'check' : (pct >= 25 ? 'radio' : 'clock')}" class="w-3.5 h-3.5 shrink-0 ${pct >= 25 && pct < 85 ? 'animate-pulse text-[#EA580C]' : ''}"></i>
          <span class="truncate">2. Tải trang</span>
        </div>
        <div id="scribdStep3" class="scribd-step-item ${step3Class}">
          <i data-lucide="${pct >= 100 ? 'check' : (pct >= 85 ? 'radio' : 'file-check')}" class="w-3.5 h-3.5 shrink-0 ${pct >= 85 && pct < 100 ? 'animate-pulse text-[#EA580C]' : ''}"></i>
          <span class="truncate">3. Đóng gói PDF</span>
        </div>
      </div>

      <!-- 2. Progress Header with Big Percentage Readout -->
      <div class="flex items-center justify-between gap-3 pt-1">
        <div class="space-y-0.5 min-w-0">
          <span id="scribdProgressStep" class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
            ${escapeHtml(state.stepLabel || 'Đang kết nối máy chủ xử lý...')}
          </span>
          <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            <span>Thời gian:</span>
            <span id="scribdTimer" class="font-bold text-zinc-700 dark:text-zinc-300">${state.elapsedSeconds || 0}s</span>
            <span>•</span>
            ${statusBadge}
          </div>
        </div>

        <!-- Big Percentage Readout -->
        <div class="text-right shrink-0">
          <span id="scribdProgressPct" class="scribd-progress-pct-big">
            ${pct}%
          </span>
        </div>
      </div>

      <!-- Smooth Gradient Progress Bar -->
      <div class="h-2 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden p-[1px]">
        <div
          id="scribdProgressBar"
          class="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 transition-all duration-300"
          style="width: ${pct}%;"
        ></div>
      </div>

      <!-- 3. Collapsible 4-Line Live Log Ticker with Generous Internal Padding (12px 16px) -->
      <div class="pt-1 space-y-2">
        <div class="flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            id="scribdToggleTickerBtn"
            class="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer select-none py-1 min-h-[44px] touch-manipulation"
          >
            <i data-lucide="terminal" class="w-3.5 h-3.5 text-[#EA580C]"></i>
            <span class="font-medium text-[11.5px]">Nhật ký chi tiết</span>
            <i data-lucide="chevron-down" id="scribdTickerChevron" class="w-3.5 h-3.5 transition-transform duration-200"></i>
          </button>

          <div class="flex items-center gap-2">
            ${isRunning ? `
              <button
                type="button"
                id="scribdCancelBtn"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/25 transition cursor-pointer select-none min-h-[44px] touch-manipulation"
                title="Hủy tiến trình"
              >
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                <span>Hủy</span>
              </button>
            ` : ''}

            ${!isRunning ? `
              <button
                type="button"
                id="scribdDismissErrorBtn"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer select-none min-h-[44px] touch-manipulation"
                title="Đóng bảng"
              >
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                <span>Đóng</span>
              </button>
            ` : ''}

            <button
              type="button"
              id="scribdCopyLogsBtn"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 transition cursor-pointer select-none min-h-[44px] touch-manipulation"
              title="Sao chép toàn bộ nhật ký"
            >
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              <span id="scribdCopyLogsText" class="hidden sm:inline">Sao chép</span>
            </button>
          </div>
        </div>

        <div id="scribdTickerContent" class="transition-all duration-200">
          <div id="scribdTerminalScreen" class="scribd-ticker-box">
            ${renderTerminalLogs(state.logs || [])}
          </div>
        </div>
      </div>
    </div>
  `.trim();
}
