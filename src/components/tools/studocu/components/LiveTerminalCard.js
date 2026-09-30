/**
 * LiveTerminalCard Component (< 120 lines)
 * macOS-styled terminal with live extraction log stream, progress bar, and syntax highlighting.
 */

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

export function parseLogType(text) {
  if (text.includes('✅') || text.includes('Tải hoàn tất') || text.includes('Tải thành công') || text.includes('Hoàn tất')) {
    return { type: 'success', icon: '✓' };
  }
  if (text.includes('❌') || text.includes('THẤT BẠI') || text.includes('LỖI') || text.includes('Error')) {
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
    return '<div class="text-zinc-600 text-xs italic py-2">Chờ nhật ký tiến trình...</div>';
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
      <div class="log-line log-${type}${activeClass}">
        <span class="log-num">${num}</span>
        <span class="log-badge-icon">${icon}</span>
        <span class="log-text">${escapeHtml(clean)}</span>
      </div>
    `.trim();
  }).join('');
}

export function renderLiveTerminalCard(state) {
  const isVisible = state.isDownloading || (state.logs && state.logs.length > 0);
  const isRunning = state.isDownloading;
  const statusBadge = isRunning
    ? '<span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">ĐANG TẢI</span>'
    : state.hasError
      ? '<span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-red-500/20 text-red-400 border border-red-500/30">THẤT BẠI</span>'
      : '<span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">HOÀN TẤT</span>';

  return `
    <div id="studocuTerminalCard" class="${isVisible ? '' : 'hidden'} rounded-xl overflow-hidden border border-zinc-800 bg-[#0d0d10] shadow-xl space-y-0">
      <!-- macOS Chrome Header -->
      <div class="flex items-center justify-between gap-2 px-3 py-2 bg-[#111114] border-b border-zinc-800/80">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          <div class="terminal-dots hidden sm:flex">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-zinc-400 font-mono min-w-0">
            <i data-lucide="terminal" class="w-3.5 h-3.5 text-zinc-500 shrink-0"></i>
            <span class="truncate">Live Stream</span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
          ${statusBadge}
          <span id="studocuTimer" class="text-xs font-mono text-zinc-400">${state.elapsedSeconds || 0}s</span>

          ${isRunning ? `
            <button
              type="button"
              id="studocuCancelBtn"
              class="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 border border-red-500/25 transition cursor-pointer"
              title="Hủy tải"
            >
              <i data-lucide="x" class="w-3 h-3"></i>
              <span>Hủy</span>
            </button>
          ` : ''}

          <button
            type="button"
            id="studocuCopyLogsBtn"
            class="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-zinc-700 transition cursor-pointer"
            title="Sao chép log"
          >
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span id="studocuCopyLogsText" class="hidden sm:inline">Sao chép</span>
          </button>
        </div>
      </div>

      <!-- Real-time Progress Bar -->
      <div class="px-4 py-2 border-b border-zinc-800/60 bg-zinc-950/40 space-y-1.5">
        <div class="flex items-center justify-between text-xs font-mono">
          <span id="studocuProgressStep" class="text-sky-400 font-medium truncate max-w-[80%]">${state.stepLabel || 'Khởi tạo...'}</span>
          <span id="studocuProgressPct" class="text-zinc-200 font-bold">${state.progress || 5}%</span>
        </div>
        <div class="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden">
          <div id="studocuProgressBar" class="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 rounded-full transition-all duration-300" style="width: ${state.progress || 5}%;"></div>
        </div>
      </div>

      <!-- Terminal Log Lines Screen -->
      <div id="studocuTerminalScreen" class="terminal-screen">
        ${renderTerminalLogs(state.logs || [])}
      </div>
    </div>
  `.trim();
}
