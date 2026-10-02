/**
 * QuizConfigPanel Component (< 230 lines)
 * Form and parameter controls for AI Quiz Generator adhering to Rule 1 & Rule 3 (minimalism).
 */

export function renderQuizConfigPanel(state) {
  const isFileMode = state.sourceMode === 'file';
  const hasFile = Boolean(state.file);
  const isFileReady = state.file?.status === 'ready';
  const isDriveMode = state.sourceMode === 'gdrive';
  const hasDriveUrl = Boolean(state.gdriveUrl);
  const isReadyToGenerate = (isFileMode ? isFileReady : hasDriveUrl) && Boolean(state.pages) && !state.isProcessing;

  const countPills = [5, 10, 15, 20, 25, 30];

  return `
    <div class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-5 space-y-5 shadow-sm">
      <!-- Source Mode Tabs -->
      <div class="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nguồn tài liệu</span>
        <div class="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
          <button id="btnQuizModeFile" type="button" class="px-3 py-1.5 rounded-md font-medium transition ${
            isFileMode ? 'bg-zinc-800 text-zinc-100 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
          }">Tệp PDF</button>
          <button id="btnQuizModeDrive" type="button" class="px-3 py-1.5 rounded-md font-medium transition ${
            isDriveMode ? 'bg-zinc-800 text-zinc-100 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
          }">Google Drive</button>
        </div>
      </div>

      <!-- Source Input Area -->
      <div>
        ${
          isFileMode
            ? `
          <div id="quizDropzone" class="relative group border-2 border-dashed ${
            hasFile ? 'border-zinc-700 bg-zinc-900/40' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/40'
          } rounded-xl p-5 transition flex flex-col items-center justify-center text-center cursor-pointer">
            <input type="file" id="quizFileInput" accept=".pdf,application/pdf" class="hidden" />
            ${
              hasFile
                ? `
              <div class="w-full space-y-3">
                <div class="flex items-center justify-between gap-3 bg-[#18181b] p-3 rounded-lg border border-zinc-800 text-left">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                      <i data-lucide="file-text" class="w-5 h-5"></i>
                    </div>
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-zinc-200 truncate">${escapeHtml(state.file.name)}</div>
                      <div class="text-xs text-zinc-500 font-mono">${formatBytes(state.file.size)}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    ${
                      state.file.status === 'ready'
                        ? `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Sẵn sàng</span>`
                        : state.file.status === 'uploading'
                        ? `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">${state.file.uploadProgress || 0}%</span>`
                        : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">Lỗi</span>`
                    }
                    <button type="button" id="btnQuizChangeFile" class="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition">Đổi tệp</button>
                  </div>
                </div>
              </div>
            `
                : `
              <div class="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                <i data-lucide="upload-cloud" class="w-5 h-5"></i>
              </div>
              <p class="text-sm font-medium text-zinc-300">Chọn hoặc kéo thả tệp PDF sách/đề thi</p>
              <p class="text-xs text-zinc-500 font-mono mt-1">Định dạng .pdf</p>
            `
            }
          </div>
        `
            : `
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-zinc-400">Liên kết Google Drive (Quyền xem công khai)</label>
            <div class="relative">
              <input type="url" id="quizDriveInput" value="${escapeHtml(state.gdriveUrl)}" placeholder="https://drive.google.com/file/d/.../view" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-zinc-600 transition" />
            </div>
          </div>
        `
        }
      </div>

      <!-- Natural Language Prompt Box -->
      <div class="space-y-2 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/60">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Nhận diện lệnh tự nhiên</span>
          </label>
          <span class="text-[11px] text-zinc-500 font-mono">0ms Regex + AI</span>
        </div>
        <div class="flex gap-2">
          <input type="text" id="quizPromptInput" placeholder="Ví dụ: Làm trắc nghiệm từ trang 11 từ câu 1 đến câu 20" class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-indigo-500/50 transition" />
          <button type="button" id="btnQuizParsePrompt" class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition shrink-0">
            Phân tích
          </button>
        </div>
      </div>

      <!-- Generation Parameters -->
      <div class="space-y-4">
        <!-- Pages Input -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-zinc-300">Trang trích xuất (Bắt buộc)</label>
            <span class="text-[11px] text-zinc-500 font-mono">vd: 11 hoặc 11-15 hoặc 4,5,6</span>
          </div>
          <input type="text" id="quizPagesInput" value="${escapeHtml(state.pages)}" placeholder="11" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-hidden focus:border-zinc-600 transition" />
        </div>

        <!-- Question Count & Quick Pills -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-zinc-300">Số lượng câu hỏi</label>
            <span class="text-xs font-mono text-zinc-400">${state.count} câu</span>
          </div>
          <div class="grid grid-cols-6 gap-1.5">
            ${countPills
              .map(
                (n) => `
              <button type="button" data-count="${n}" class="btn-quiz-count-pill py-1.5 rounded-lg text-xs font-mono transition border ${
                  state.count === n
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-semibold'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }">${n}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Start Number & Output Prefix -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-zinc-300">Bắt đầu từ câu</label>
            <input type="number" id="quizStartInput" min="1" max="500" value="${state.start}" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 font-mono focus:outline-hidden focus:border-zinc-600 transition" />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-zinc-300">Tên file xuất (Prefix)</label>
            <input type="text" id="quizPrefixInput" value="${escapeHtml(state.prefix)}" placeholder="Quiz_A4" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 font-mono focus:outline-hidden focus:border-zinc-600 transition" />
          </div>
        </div>

        <!-- Header Title -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-zinc-300">Tiêu đề in đầu trang</label>
          <input type="text" id="quizTitleInput" value="${escapeHtml(state.title)}" placeholder="BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-hidden focus:border-zinc-600 transition" />
        </div>
      </div>

      <!-- Action Button -->
      <div class="pt-2">
        <button type="button" id="btnQuizGenerate" ${!isReadyToGenerate ? 'disabled' : ''} class="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition shadow-md ${
    isReadyToGenerate
      ? 'bg-zinc-100 hover:bg-white text-zinc-950 cursor-pointer'
      : 'bg-zinc-900 text-zinc-600 border border-zinc-800/80 cursor-not-allowed'
  }">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
          <span>${state.isProcessing ? 'Đang tạo bài tập...' : 'Tạo 2 bản PDF A4 (Đề bài & Đáp án)'}</span>
        </button>
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
