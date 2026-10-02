/**
 * QuizHistoryList Component (< 230 lines)
 * 2-Column dedicated history list for Quiz Creator (Đề bài / Đáp án)
 * adhering to Rule 1 & Rule 3 (UI Minimalism, Zero Fluff).
 */

import { getQuizHistoryList } from '../utilities/quizHistoryHelper.js';
import { formatBytes, formatRelativeTime } from '../../../../utilities/formatters.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderQuizHistoryList() {
  const historyList = getQuizHistoryList();

  return `
    <div id="quizHistoryCard" class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/70">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          </div>
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-semibold text-zinc-100">Lịch sử tạo bài tập</h4>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300">
              ${historyList.length} bộ đề
            </span>
          </div>
        </div>

        ${historyList.length > 0 ? `
          <button type="button" id="btnQuizClearHistory" class="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
            <span>Xóa lịch sử</span>
          </button>
        ` : ''}
      </div>

      <!-- Content -->
      ${historyList.length === 0 ? renderEmptyState() : renderHistoryGrid(historyList)}
    </div>
  `.trim();
}

function renderEmptyState() {
  return `
    <div class="py-8 text-center space-y-2">
      <div class="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 flex items-center justify-center mx-auto">
        <i data-lucide="folder-clock" class="w-5 h-5"></i>
      </div>
      <p class="text-xs font-medium text-zinc-400">Chưa có lịch sử tạo bài tập</p>
      <p class="text-[11px] text-zinc-600 max-w-sm mx-auto">Các bộ đề bài và đáp án sau khi biên soạn sẽ hiển thị tại đây để bạn tải lại hoặc xem trước.</p>
    </div>
  `.trim();
}

function renderHistoryGrid(historyList) {
  return `
    <div class="space-y-4">
      <!-- 2-Column Section Header Guide -->
      <div class="hidden md:grid md:grid-cols-2 gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px]">Cột 1: Đề bài</span>
          <span class="text-[10px] text-zinc-500 font-normal lowercase">bản in học sinh</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">Cột 2: Đáp án</span>
          <span class="text-[10px] text-zinc-500 font-normal lowercase">ma trận & lời giải</span>
        </div>
      </div>

      <!-- Paired Rows -->
      <div class="space-y-3.5">
        ${historyList.map((pair) => renderPairRow(pair)).join('')}
      </div>
    </div>
  `.trim();
}

function renderPairRow(pair) {
  const ws = pair.worksheet || {};
  const ans = pair.answer || {};
  const title = pair.prefix || pair.title || 'Bộ bài tập';
  const relativeTime = formatRelativeTime(pair.createdAt);
  const count = pair.count || 20;

  return `
    <div class="bg-zinc-950/60 border border-zinc-800/90 rounded-xl p-3 sm:p-3.5 space-y-3 hover:border-zinc-700/80 transition">
      <!-- Pair Meta Header -->
      <div class="flex items-center justify-between gap-2 pb-2 border-b border-zinc-900">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="layers" class="w-3.5 h-3.5 text-zinc-500 shrink-0"></i>
          <span class="text-xs font-semibold text-zinc-200 truncate" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          <span class="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">${count} câu</span>
          <span class="text-[11px] text-zinc-500">${relativeTime}</span>
        </div>
        <button type="button" class="btn-quiz-delete-pair text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-zinc-900 transition" data-pair-id="${pair.id}" title="Xóa bộ đề này">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <!-- 2 Columns Grid: Đề bài vs Đáp án -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <!-- Cột 1: Đề bài Card -->
        <div class="bg-[#141418] border border-blue-500/20 hover:border-blue-500/40 rounded-lg p-3 flex flex-col justify-between space-y-2.5 transition">
          <div class="space-y-1.5 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wide">Đề bài</span>
              <span class="text-[11px] font-mono text-zinc-400">${ws.pages || 1} trang • ${formatBytes(ws.sizeBytes)}</span>
            </div>
            <div class="text-xs font-medium text-zinc-200 truncate" title="${escapeHtml(ws.fileName)}">
              ${escapeHtml(ws.fileName)}
            </div>
          </div>
          <div class="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-zinc-800/70">
            <button type="button" class="btn-quiz-history-preview py-1.5 px-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 border border-zinc-800 transition" data-file-id="${ws.fileId}" data-file-name="${escapeHtml(ws.fileName)}" data-view-url="${ws.viewUrl || ''}" data-download-url="${ws.downloadUrl || ''}">
              <i data-lucide="eye" class="w-3 h-3"></i>
              <span>Xem</span>
            </button>
            <a href="${ws.downloadUrl}" download="${escapeHtml(ws.fileName)}" target="_blank" rel="noopener noreferrer" data-file-url="${ws.downloadUrl}" data-file-name="${escapeHtml(ws.fileName)}" class="btn-quiz-history-download py-1.5 px-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-[11px] font-medium flex items-center justify-center gap-1 transition">
              <i data-lucide="download" class="w-3 h-3"></i>
              <span>Tải</span>
            </a>
            <button type="button" class="btn-quiz-history-copy py-1.5 px-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 border border-zinc-800 transition" data-copy-url="${ws.downloadUrl}" title="Sao chép link tải">
              <i data-lucide="copy" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Cột 2: Đáp án Card -->
        <div class="bg-[#141418] border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg p-3 flex flex-col justify-between space-y-2.5 transition">
          <div class="space-y-1.5 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">Đáp án & Lời giải</span>
              <span class="text-[11px] font-mono text-zinc-400">${ans.pages || 1} trang • ${formatBytes(ans.sizeBytes)}</span>
            </div>
            <div class="text-xs font-medium text-zinc-200 truncate" title="${escapeHtml(ans.fileName)}">
              ${escapeHtml(ans.fileName)}
            </div>
          </div>
          <div class="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-zinc-800/70">
            <button type="button" class="btn-quiz-history-preview py-1.5 px-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 border border-zinc-800 transition" data-file-id="${ans.fileId}" data-file-name="${escapeHtml(ans.fileName)}" data-view-url="${ans.viewUrl || ''}" data-download-url="${ans.downloadUrl || ''}">
              <i data-lucide="eye" class="w-3 h-3"></i>
              <span>Xem</span>
            </button>
            <a href="${ans.downloadUrl}" download="${escapeHtml(ans.fileName)}" target="_blank" rel="noopener noreferrer" data-file-url="${ans.downloadUrl}" data-file-name="${escapeHtml(ans.fileName)}" class="btn-quiz-history-download py-1.5 px-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-[11px] font-medium flex items-center justify-center gap-1 transition">
              <i data-lucide="download" class="w-3 h-3"></i>
              <span>Tải</span>
            </a>
            <button type="button" class="btn-quiz-history-copy py-1.5 px-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 border border-zinc-800 transition" data-copy-url="${ans.downloadUrl}" title="Sao chép link tải">
              <i data-lucide="copy" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}
