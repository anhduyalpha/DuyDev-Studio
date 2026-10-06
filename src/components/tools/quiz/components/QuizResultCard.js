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
    <div id="quizProcessingBox" class="quiz-animated-box shadow-xl shadow-indigo-500/10 animate-fadeIn">
      <!-- Animated Moving Gradient Border -->
      <div class="quiz-border-processing" aria-hidden="true"></div>

      <!-- Inner Card Body -->
      <div class="relative z-[1] w-full rounded-[14.5px] bg-gradient-to-b from-[#141419] to-[#0f0f13] p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/25">
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

        <div class="flex items-center justify-end pt-2">
          <button type="button" id="btnQuizCancelJob" class="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition cursor-pointer">
            Hủy tác vụ
          </button>
        </div>
      </div>
    </div>
  `.trim();
}

function renderCompletedState(state) {
  const res = state.result;
  const ws = res.worksheet || {};
  const ans = res.answer || {};
  const count = res.questionsCount || state.count || 20;
  const imagesCount = res.extractedImagesCount || 0;
  const qTypes = res.questionTypes || null;

  const wsId = ws.fileId || ws.id || '';
  const wsName = ws.fileName || ws.name || 'DeBai.pdf';
  const wsPages = ws.pages || ws.pageCount || 1;
  const wsSize = ws.sizeBytes || ws.size || 0;
  const wsEncoded = encodeURIComponent(wsName);
  const wsDownloadUrl = ws.downloadUrl || (wsId ? `/api/v1/files/download/${wsId}/${wsEncoded}?filename=${wsEncoded}` : '#');
  const wsViewUrl = ws.viewUrl || (wsId ? `/api/v1/files/view/${wsId}/${wsEncoded}` : '');

  const ansId = ans.fileId || ans.id || '';
  const ansName = ans.fileName || ans.name || 'DapAn.pdf';
  const ansPages = ans.pages || ans.pageCount || 1;
  const ansSize = ans.sizeBytes || ans.size || 0;
  const ansEncoded = encodeURIComponent(ansName);
  const ansDownloadUrl = ans.downloadUrl || (ansId ? `/api/v1/files/download/${ansId}/${ansEncoded}?filename=${ansEncoded}` : '#');
  const ansViewUrl = ans.viewUrl || (ansId ? `/api/v1/files/view/${ansId}/${ansEncoded}` : '');

  const imgBadge = imagesCount > 0
    ? `<span class="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">${imagesCount} hình vẽ</span>`
    : '';

  const typeBadges = qTypes && (qTypes.true_false > 0 || qTypes.short_answer > 0)
    ? `
      <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${qTypes.mcq || 0} MCQ</span>
      ${qTypes.true_false > 0 ? `<span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${qTypes.true_false} Đ/S</span>` : ''}
      ${qTypes.short_answer > 0 ? `<span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${qTypes.short_answer} TLN</span>` : ''}
    `
    : '';

  return `
    <div id="quizCompletedBox" class="quiz-animated-box shadow-xl shadow-emerald-500/5 animate-fadeIn">
      <!-- Animated Moving Gradient Border -->
      <div class="quiz-border-completed" aria-hidden="true"></div>

      <!-- Inner Card Body -->
      <div class="relative z-[1] w-full rounded-[14.5px] bg-gradient-to-b from-[#141419] to-[#0f0f13] p-4 sm:p-5 space-y-4">
        <!-- Result Header -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] shrink-0"></span>
            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <h4 class="text-sm font-bold text-zinc-100">Đã tạo Đề bài & Đáp án A4</h4>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Hoàn tất
              </span>
            </div>
          </div>
          <button type="button" id="btnQuizReset" class="btn-quiz-reset text-xs sm:text-sm px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/30 border border-indigo-400/40 hover:border-indigo-300 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95">
            <i data-lucide="plus" class="w-4 h-4 stroke-[2.5]"></i>
            <span>Làm tài liệu khác</span>
          </button>
        </div>

        <!-- Dual Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <!-- Worksheet Card -->
          <div class="bg-[#121217] border border-blue-500/30 hover:border-blue-500/55 rounded-xl p-4 flex flex-col justify-between space-y-4 transition shadow-xs">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">Đề bài</span>
                <span class="text-xs text-zinc-500 font-mono">${wsPages} trang A4</span>
              </div>
              <div class="text-sm font-medium text-zinc-200 truncate" title="${escapeHtml(wsName)}">${escapeHtml(wsName)}</div>
              <div class="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400">
                <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${count} câu</span>
                ${imgBadge}
                ${typeBadges}
                <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${formatBytes(wsSize)}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
              <button type="button" class="btn-quiz-preview w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition touch-manipulation min-h-[42px] cursor-pointer" data-file-id="${wsId}" data-file-name="${escapeHtml(wsName)}" data-view-url="${wsViewUrl}" data-download-url="${wsDownloadUrl || ''}">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                <span>Xem trước</span>
              </button>
              <a href="${wsDownloadUrl}" download="${escapeHtml(wsName)}" data-file-url="${wsDownloadUrl}" data-file-name="${escapeHtml(wsName)}" class="btn-quiz-download w-full py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 transition touch-manipulation min-h-[42px] cursor-pointer">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>Tải về</span>
              </a>
            </div>
          </div>

          <!-- Answer Key Card -->
          <div class="bg-[#121217] border border-emerald-500/30 hover:border-emerald-500/55 rounded-xl p-4 flex flex-col justify-between space-y-4 transition shadow-xs">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Đáp án & Lời giải</span>
                <span class="text-xs text-zinc-500 font-mono">${ansPages} trang A4</span>
              </div>
              <div class="text-sm font-medium text-zinc-200 truncate" title="${escapeHtml(ansName)}">${escapeHtml(ansName)}</div>
              <div class="flex flex-wrap gap-1.5 text-[11px] font-mono text-zinc-400">
                <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">Ma trận + Lời giải</span>
                ${imgBadge}
                <span class="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">${formatBytes(ansSize)}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
              <button type="button" class="btn-quiz-preview w-full py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition touch-manipulation min-h-[42px] cursor-pointer" data-file-id="${ansId}" data-file-name="${escapeHtml(ansName)}" data-view-url="${ansViewUrl}" data-download-url="${ansDownloadUrl || ''}">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                <span>Xem trước</span>
              </button>
              <a href="${ansDownloadUrl}" download="${escapeHtml(ansName)}" data-file-url="${ansDownloadUrl}" data-file-name="${escapeHtml(ansName)}" class="btn-quiz-download w-full py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 transition touch-manipulation min-h-[42px] cursor-pointer">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>Tải về</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Bottom Action Bar / Làm tài liệu khác -->
        <div class="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs text-zinc-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>
            <span class="font-mono text-[11px] text-zinc-400">Đã lưu trữ vào lịch sử bài tập</span>
          </div>
          <button type="button" class="btn-quiz-reset w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 border border-indigo-400/40 hover:border-indigo-300 transition-all cursor-pointer active:scale-98">
            <i data-lucide="plus" class="w-4 h-4 stroke-[2.5]"></i>
            <span>Làm tài liệu khác</span>
          </button>
        </div>
      </div>
    </div>
  `.trim();
}


function renderErrorState(state) {
  let errorMsg = state.error || 'Đã xảy ra lỗi khi tạo bài tập.';
  const lower = errorMsg.toLowerCase();
  if (
    lower.includes('prisma') ||
    lower.includes('record to update not found') ||
    lower.includes('invocation') ||
    lower.includes('database') ||
    lower.includes('sqlite')
  ) {
    errorMsg = 'Hệ thống cơ sở dữ liệu tạm thời bận, vui lòng bấm Thử lại để tiếp tục.';
  } else if (
    lower.includes('không có câu hỏi') ||
    lower.includes('không tìm thấy câu hỏi') ||
    lower.includes('no questions')
  ) {
    errorMsg = 'Không có câu hỏi trong trang, vui lòng chọn lại.';
  } else if (errorMsg.includes('Traceback (most recent call last):')) {
    const lines = errorMsg.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine.includes(':')) {
      errorMsg = lastLine.split(':').slice(1).join(':').trim() || lastLine;
    } else {
      errorMsg = lastLine;
    }
  }

  return `
    <div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-3">
      <div class="flex items-center gap-2 text-red-400 text-sm font-semibold">
        <i data-lucide="alert-circle" class="w-4 h-4"></i>
        <span>Lỗi tạo bài tập</span>
      </div>
      <p class="text-xs text-red-300/90 leading-relaxed font-medium">${escapeHtml(errorMsg)}</p>
      <button type="button" id="btnQuizReset" class="btn-quiz-reset text-xs px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold border border-red-400/30 transition shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95">
        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
        <span>Thử lại</span>
      </button>
    </div>
  `.trim();
}

function renderEmptyPlaceholder() {
  return `
    <div class="relative overflow-hidden rounded-2xl border-2 border-dashed border-zinc-800/90 hover:border-zinc-700/80 bg-gradient-to-b from-zinc-900/25 via-[#111114]/40 to-zinc-950/70 p-6 sm:p-7 text-center transition-all">
      <div class="flex flex-col items-center justify-center space-y-3">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-400">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
          <span>Khu vực xuất kết quả</span>
        </div>

        <div class="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-xs">
          <i data-lucide="file-check-2" class="w-5 h-5"></i>
        </div>

        <div class="space-y-1">
          <h4 class="text-sm font-semibold text-zinc-200">Đề bài & Đáp án A4</h4>
          <p class="text-xs text-zinc-500 max-w-md mx-auto">
            Tệp PDF đề bài và đáp án chi tiết sẽ tự động xuất hiện tại đây sau khi hoàn tất xử lý.
          </p>
        </div>

        <!-- Visual Slot Previews (Dashed Ghost Cards) -->
        <div class="grid grid-cols-2 gap-3 w-full max-w-md pt-1.5">
          <div class="border border-dashed border-zinc-800/80 rounded-xl py-2 px-3 bg-zinc-900/30 flex items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-zinc-600"></i>
            <span>Đề bài (PDF)</span>
          </div>
          <div class="border border-dashed border-zinc-800/80 rounded-xl py-2 px-3 bg-zinc-900/30 flex items-center justify-center gap-2 text-zinc-500 text-xs font-mono">
            <i data-lucide="check-square" class="w-3.5 h-3.5 text-zinc-600"></i>
            <span>Đáp án & Lời giải</span>
          </div>
        </div>
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
