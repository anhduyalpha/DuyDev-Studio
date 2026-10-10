/**
 * QuizHistoryList Component (< 240 lines)
 * Collapsible dropbox history & trash list with prominent file headers,
 * 2-column Worksheet / Answer details, and zero copy buttons.
 * Adheres to Rule 1 & Rule 3 (UI Minimalism, High Information Density).
 */

import { getQuizHistoryList, getQuizTrashList } from '../utilities/quizHistoryHelper.js';
import { formatBytes, formatRelativeTime } from '../../../../utilities/formatters.js';

let activeQuizTab = 'history'; // 'history' | 'trash'
let isQuizHistoryBoxOpen = false;
const openDropboxes = new Set(); // Set of pair IDs currently expanded

export function setQuizHistoryTab(tab) {
  activeQuizTab = tab;
}

export function getQuizHistoryTab() {
  return activeQuizTab;
}

export function toggleQuizHistoryBox(forceState) {
  isQuizHistoryBoxOpen = typeof forceState === 'boolean' ? forceState : !isQuizHistoryBoxOpen;
}

export function isQuizHistoryBoxExpanded() {
  return isQuizHistoryBoxOpen;
}

export function setQuizHistoryBoxOpen(open) {
  isQuizHistoryBoxOpen = open;
}

export function toggleQuizDropbox(pairId) {
  if (openDropboxes.has(pairId)) {
    openDropboxes.delete(pairId);
  } else {
    openDropboxes.add(pairId);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderQuizHistoryList() {
  const historyItems = getQuizHistoryList();
  const trashItems = getQuizTrashList();
  const isTrash = activeQuizTab === 'trash';
  const currentList = isTrash ? trashItems : historyItems;
  const isOpen = isQuizHistoryBoxOpen;

  return `
    <div id="quizHistoryCard" class="bg-white dark:bg-[#0d0d10] border border-zinc-200/80 dark:border-zinc-800/60 rounded-2xl overflow-hidden select-none shadow-xs dark:shadow-none transition-all">
      <!-- Clickable Master Dropbox Header -->
      <button type="button" id="btnToggleQuizHistoryBox" class="w-full flex items-center justify-between p-4 sm:p-4.5 cursor-pointer select-none text-left hover:bg-zinc-50/70 dark:hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <i data-lucide="graduation-cap" class="w-4 h-4"></i>
          </div>
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Lịch sử tạo bài tập</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              ${historyItems.length} bộ đề
            </span>
            ${trashItems.length > 0 ? `
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                ${trashItems.length} thùng rác
              </span>
            ` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
            ${isOpen ? 'Thu gọn' : 'Xem lịch sử'}
          </span>
          <div class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-180 text-zinc-900 dark:text-zinc-100' : ''}">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
          </div>
        </div>
      </button>

      <!-- Collapsible Master Body (Revealed on Click) -->
      <div id="quizHistoryBoxBody" class="${isOpen ? 'block' : 'hidden'} border-t border-zinc-200 dark:border-zinc-800/60 p-4 sm:p-5 space-y-4 bg-zinc-50/30 dark:bg-black/20">
        <!-- Header with Tabs & Global Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800/60">
          <!-- Segmented Tab: Lịch sử vs Thùng rác -->
          <div class="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/70 rounded-xl text-xs font-semibold">
            <button type="button" id="btnQuizTabHistory"
              class="px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${!isTrash ? 'bg-white dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/50 shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent'}">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Lịch sử</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
                ${historyItems.length}
              </span>
            </button>
            <button type="button" id="btnQuizTabTrash"
              class="px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${isTrash ? 'bg-white dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/50 shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent'}">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-500"></i>
              <span>Thùng rác</span>
              ${trashItems.length > 0 ? `
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  ${trashItems.length}
                </span>
              ` : ''}
            </button>
          </div>

          <!-- Right Header Actions -->
          <div class="flex items-center gap-2 text-xs">
            ${!isTrash ? `
              ${historyItems.length > 0 ? `
                <button type="button" id="btnQuizTrashAll" class="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 hover:bg-rose-500/10 dark:hover:bg-rose-950/40 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-800/80 hover:border-rose-300 dark:hover:border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer">
                  <i data-lucide="trash-2" class="w-3 h-3"></i>
                  <span>Chuyển tất cả vào thùng rác</span>
                </button>
              ` : ''}
            ` : `
              ${trashItems.length > 0 ? `
                <button type="button" id="btnQuizRestoreAllTrash" class="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/40 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-zinc-200 dark:border-zinc-800/80 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition flex items-center gap-1.5 cursor-pointer">
                  <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
                  <span>Khôi phục tất cả</span>
                </button>
                <button type="button" id="btnQuizEmptyTrash" class="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 border border-rose-500/20 dark:border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer">
                  <i data-lucide="trash" class="w-3 h-3"></i>
                  <span>Dọn sạch thùng rác</span>
                </button>
              ` : ''}
            `}
          </div>
        </div>

        <!-- Item List or Empty Placeholder -->
        ${currentList.length === 0 ? renderEmptyPlaceholder(isTrash) : renderDropboxList(currentList, isTrash)}
      </div>
    </div>
  `.trim();
}

function renderEmptyPlaceholder(isTrash) {
  if (isTrash) {
    return `
      <div class="py-8 text-center space-y-2">
        <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 flex items-center justify-center mx-auto">
          <i data-lucide="trash-2" class="w-5 h-5"></i>
        </div>
        <p class="text-xs font-medium text-zinc-700 dark:text-zinc-400">Thùng rác trống</p>
        <p class="text-[11px] text-zinc-500 dark:text-zinc-600">Các bộ đề bạn xóa sẽ tạm lưu tại đây để khôi phục khi cần.</p>
      </div>
    `.trim();
  }

  return `
    <div class="py-8 text-center space-y-2">
      <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 flex items-center justify-center mx-auto">
        <i data-lucide="folder-clock" class="w-5 h-5"></i>
      </div>
      <p class="text-xs font-medium text-zinc-700 dark:text-zinc-400">Chưa có lịch sử tạo bài tập</p>
      <p class="text-[11px] text-zinc-500 dark:text-zinc-600">Bộ đề bài và đáp án sau khi tạo sẽ hiển thị tại đây theo dạng hộp thả (dropbox).</p>
    </div>
  `.trim();
}

function renderDropboxList(items, isTrash) {
  return `
    <div class="space-y-3">
      ${items.map((pair) => renderDropboxItem(pair, isTrash)).join('')}
    </div>
  `.trim();
}

function renderDropboxItem(pair, isTrash) {
  const ws = pair.worksheet || {};
  const ans = pair.answer || {};
  const isOpen = openDropboxes.has(pair.id);

  const mainFileName = pair.prefix || ws.fileName || pair.title || 'Bo_De_Trac_Nghiem';
  const count = pair.count || 20;
  const totalPages = (ws.pages || 1) + (ans.pages || 1);
  const totalSize = (ws.sizeBytes || 0) + (ans.sizeBytes || 0);
  const timeStr = isTrash ? formatRelativeTime(pair.deletedAt || pair.createdAt) : formatRelativeTime(pair.createdAt);

  return `
    <div class="quiz-dropbox border ${isOpen ? 'border-zinc-300 dark:border-zinc-700/90 bg-zinc-50 dark:bg-zinc-900/70 shadow-sm' : 'border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-zinc-300 dark:hover:border-zinc-700/60 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/50'} rounded-xl overflow-hidden transition-all duration-200">
      <!-- Prominent Opaque Dropbox Header -->
      <div
        class="quiz-dropbox-header cursor-pointer select-none bg-zinc-100/60 dark:bg-zinc-900/70 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 border-b ${isOpen ? 'border-zinc-200 dark:border-zinc-800' : 'border-transparent'} p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors"
        data-pair-id="${pair.id}"
      >
        <!-- Left: Prominent Filename Title & Meta -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/25 flex items-center justify-center shrink-0">
            <i data-lucide="layers" class="w-4 h-4"></i>
          </div>
          <div class="min-w-0 space-y-1">
            <div class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight truncate" title="${escapeHtml(mainFileName)}">
              ${escapeHtml(mainFileName)}
            </div>
            <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              <span class="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold">${count} câu</span>
              <span class="text-zinc-400 dark:text-zinc-600">•</span>
              <span class="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">${totalPages} trang A4</span>
              <span class="text-zinc-400 dark:text-zinc-600">•</span>
              <span class="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">${formatBytes(totalSize)}</span>
              <span class="text-zinc-400 dark:text-zinc-600">•</span>
              <span class="text-[11px] text-zinc-500">${timeStr}</span>
            </div>
          </div>
        </div>

        <!-- Right: Actions & Toggle Chevron -->
        <div class="flex items-center gap-1.5 shrink-0">
          ${!isTrash ? `
            <button
              type="button"
              class="btn-quiz-trash-single p-2 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-300 dark:hover:border-rose-500/20 transition cursor-pointer"
              data-pair-id="${pair.id}"
              title="Chuyển vào thùng rác"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          ` : `
            <button
              type="button"
              class="btn-quiz-restore-single p-2 rounded-lg text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 border border-transparent hover:border-emerald-300 dark:hover:border-emerald-500/20 transition cursor-pointer"
              data-pair-id="${pair.id}"
              title="Khôi phục bộ đề"
            >
              <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
            </button>
            <button
              type="button"
              class="btn-quiz-delete-perm-single p-2 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-300 dark:hover:border-rose-500/20 transition cursor-pointer"
              data-pair-id="${pair.id}"
              title="Xóa vĩnh viễn"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          `}

          <!-- Chevron Expand Indicator -->
          <div class="quiz-dropbox-chevron w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-180 text-zinc-900 dark:text-zinc-200' : ''}">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
          </div>
        </div>
      </div>

      <!-- Collapsible Body (Revealed on Click) -->
      <div class="quiz-dropbox-content ${isOpen ? 'block' : 'hidden'} p-3.5 sm:p-4 bg-zinc-100/40 dark:bg-black/40 border-t border-zinc-200 dark:border-zinc-800/70">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <!-- Cột 1: Đề bài Card -->
          <div class="bg-white dark:bg-[#101014] border border-blue-500/20 hover:border-blue-500/40 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition shadow-xs">
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase tracking-wide">
                  Đề bài (PDF)
                </span>
                <span class="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  ${ws.pages || 1} trang • ${formatBytes(ws.sizeBytes)}
                </span>
              </div>
              <div class="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate font-mono" title="${escapeHtml(ws.fileName)}">
                ${escapeHtml(ws.fileName)}
              </div>
            </div>

            <!-- Action Buttons: Chỉ có Xem trước và Tải về -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
              <button
                type="button"
                class="btn-quiz-history-preview py-2 px-3 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                data-file-id="${ws.fileId}"
                data-file-name="${escapeHtml(ws.fileName)}"
                data-view-url="${ws.viewUrl || (ws.fileId ? `/api/v1/files/view/${ws.fileId}` : '')}"
                data-download-url="${ws.downloadUrl || ''}"
              >
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                <span>Xem trước</span>
              </button>
              <a
                href="${ws.downloadUrl}"
                download="${escapeHtml(ws.fileName)}"
                data-file-url="${ws.downloadUrl}"
                data-file-name="${escapeHtml(ws.fileName)}"
                class="btn-quiz-history-download py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>Tải về</span>
              </a>
            </div>
          </div>

          <!-- Cột 2: Đáp án & Lời giải Card -->
          <div class="bg-white dark:bg-[#101014] border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition shadow-xs">
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  Đáp án & Lời giải
                </span>
                <span class="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  ${ans.pages || 1} trang • ${formatBytes(ans.sizeBytes)}
                </span>
              </div>
              <div class="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate font-mono" title="${escapeHtml(ans.fileName)}">
                ${escapeHtml(ans.fileName)}
              </div>
            </div>

            <!-- Action Buttons: Chỉ có Xem trước và Tải về -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
              <button
                type="button"
                class="btn-quiz-history-preview py-2 px-3 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
                data-file-id="${ans.fileId}"
                data-file-name="${escapeHtml(ans.fileName)}"
                data-view-url="${ans.viewUrl || (ans.fileId ? `/api/v1/files/view/${ans.fileId}` : '')}"
                data-download-url="${ans.downloadUrl || ''}"
              >
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                <span>Xem trước</span>
              </button>
              <a
                href="${ans.downloadUrl}"
                download="${escapeHtml(ans.fileName)}"
                data-file-url="${ans.downloadUrl}"
                data-file-name="${escapeHtml(ans.fileName)}"
                class="btn-quiz-history-download py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>Tải về</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}
