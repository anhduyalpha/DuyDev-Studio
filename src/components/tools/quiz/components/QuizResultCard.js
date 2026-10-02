/**
 * QuizResultCard Component (< 230 lines)
 * Live telemetry progress card and dual result cards (Worksheet + Solution)
 * adhering to Rule 1 & Rule 3 (UI Minimalism).
 */

export function renderQuizResultCard(state) {
  if (state.isProcessing) {
    return renderProcessingState(state);
  }

  if (state.result) {
    return renderCompletedState(state);
  }

  if (state.error) {
    return renderErrorState(state);
  }

  return renderEmptyPlaceholder();
}

function renderProcessingState(state) {
  const pct = Math.max(5, Math.min(100, state.progress || 0));

  return `
    <div id="quizProcessingBox" class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-6 space-y-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>
          </div>
          <div class="min-w-0">
            <h4 class="text-sm font-semibold text-zinc-100">Đang biên soạn đề bài & đáp án</h4>
            <p id="quizProgressStage" class="text-xs text-zinc-400 truncate">${escapeHtml(state.stage || 'Đang xử lý...')}</p>
          </div>
        </div>
        <span id="quizProgressText" class="text-sm font-mono font-semibold text-zinc-200 shrink-0">${pct}%</span>
      </div>

      <!-- Progress bar -->
      <div class="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
        <div id="quizProgressBar" class="bg-indigo-500 h-2 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
      </div>

      <div class="flex items-center justify-between pt-2">
        <span class="text-[11px] text-zinc-500 font-mono">A4 PDF Pipeline</span>
        <button type="button" id="btnQuizCancelJob" class="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition">
          Hủy tác vụ
        </button>
      </div>
    </div>
  `.trim();
}

function renderCompletedState(state) {
  const res = state.result;
  const ws = res.worksheet || {};
  const ans = res.answer || {};
  const count = res.questionsCount || state.count || 20;

  const wsId = ws.fileId || ws.id || '';
  const wsName = ws.fileName || ws.name || 'DeBai.pdf';
  const wsPages = ws.pages || ws.pageCount || 1;
  const wsSize = ws.sizeBytes || ws.size || 0;
  const wsDownloadUrl = ws.downloadUrl || (wsId ? `/api/v1/files/download/${wsId}` : '#');

  const ansId = ans.fileId || ans.id || '';
  const ansName = ans.fileName || ans.name || 'DapAn.pdf';
  const ansPages = ans.pages || ans.pageCount || 1;
  const ansSize = ans.sizeBytes || ans.size || 0;
  const ansDownloadUrl = ans.downloadUrl || (ansId ? `/api/v1/files/download/${ansId}` : '#');

  return `
    <div class="space-y-4 animate-fadeIn">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <h4 class="text-sm font-semibold text-zinc-100">Đã tạo Đề bài & Đáp án A4</h4>
        </div>
        <button type="button" id="btnQuizReset" class="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition">
          Làm bài tập khác
        </button>
      </div>

      <!-- Dual Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Worksheet Card -->
        <div class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">Đề bài</span>
              <span class="text-xs text-zinc-500 font-mono">${wsPages} trang A4</span>
            </div>
            <div class="text-sm font-medium text-zinc-200 truncate" title="${escapeHtml(wsName)}">${escapeHtml(wsName)}</div>
            <div class="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400">
              <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${count} câu</span>
              <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${formatBytes(wsSize)}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
            <button type="button" class="btn-quiz-preview w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition" data-file-id="${wsId}" data-file-name="${escapeHtml(wsName)}">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              <span>Xem trước</span>
            </button>
            <a href="${wsDownloadUrl}" download="${escapeHtml(wsName)}" class="w-full py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Tải về</span>
            </a>
          </div>
        </div>

        <!-- Answer Key Card -->
        <div class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Đáp án & Lời giải</span>
              <span class="text-xs text-zinc-500 font-mono">${ansPages} trang A4</span>
            </div>
            <div class="text-sm font-medium text-zinc-200 truncate" title="${escapeHtml(ansName)}">${escapeHtml(ansName)}</div>
            <div class="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400">
              <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Ma trận + Lời giải</span>
              <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${formatBytes(ansSize)}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
            <button type="button" class="btn-quiz-preview w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition" data-file-id="${ansId}" data-file-name="${escapeHtml(ansName)}">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              <span>Xem trước</span>
            </button>
            <a href="${ansDownloadUrl}" download="${escapeHtml(ansName)}" class="w-full py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Tải về</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function renderErrorState(state) {
  return `
    <div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-3">
      <div class="flex items-center gap-2 text-red-400 text-sm font-semibold">
        <i data-lucide="alert-circle" class="w-4 h-4"></i>
        <span>Lỗi tạo bài tập</span>
      </div>
      <p class="text-xs text-red-300/90 leading-relaxed">${escapeHtml(state.error)}</p>
      <button type="button" id="btnQuizReset" class="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 transition">
        Thử lại
      </button>
    </div>
  `.trim();
}

function renderEmptyPlaceholder() {
  return `
    <div class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-6 text-center space-y-2">
      <div class="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
        <i data-lucide="file-check-2" class="w-5 h-5"></i>
      </div>
      <div>
        <h4 class="text-sm font-semibold text-zinc-200">Đề bài & Đáp án A4</h4>
        <p class="text-xs text-zinc-500 max-w-sm mx-auto mt-0.5">
          Tệp PDF đề bài và đáp án chi tiết sẽ hiển thị tại đây sau khi hoàn tất.
        </p>
      </div>
    </div>
  `.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
