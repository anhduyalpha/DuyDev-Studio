/**
 * QuizConfigPanel Component (< 230 lines)
 * Unified single-page form controls for AI Quiz Generator.
 * Adhering to Rule 1 & Rule 3 (UI Minimalism).
 */

import { isValidDriveUrl } from '../hooks/useQuiz.js';

export function renderQuizConfigPanel(state) {
  if (state.isProcessing) {
    return '';
  }

  const hasFile = Boolean(state.file);
  const isFileReady = state.file?.status === 'ready';
  const hasDriveUrl = Boolean(state.gdriveUrl?.trim());
  const isDriveValid = isValidDriveUrl(state.gdriveUrl);
  const isSourceReady = isFileReady || isDriveValid;

  const step = state.step || (isSourceReady ? 2 : 1);
  const showPrompt = step >= 2 && isSourceReady;
  const showParams = step >= 3 && isSourceReady;

  const hasValidPrefix = Boolean(state.prefix?.trim());
  const hasValidPages = Boolean(state.pages?.trim());

  const isReadyToGenerate = isSourceReady && hasValidPages && hasValidPrefix && !state.isProcessing;

  return `
    <div class="bg-[#111114] border border-zinc-800/80 rounded-2xl p-5 space-y-5 shadow-sm">
      <!-- 1. Nguồn tài liệu Section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <span>Nguồn tài liệu</span>
            <span class="text-rose-500 font-bold">*</span>
            <span id="quizSourceStatus">
              ${
                isSourceReady
                  ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="check" class="w-2.5 h-2.5"></i> Hợp lệ</span>`
                  : `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Bắt buộc</span>`
              }
            </span>
          </label>
          <div id="quizSourceDetail">
            ${
              isFileReady
                ? `<span class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i data-lucide="check" class="w-3 h-3"></i> Tệp PDF sẵn sàng</span>`
                : isDriveValid
                ? `<span class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i data-lucide="check" class="w-3 h-3"></i> Google Drive hợp lệ</span>`
                : `<span class="text-[11px] text-zinc-500 font-mono">Tệp PDF hoặc Drive</span>`
            }
          </div>
        </div>

        <!-- 1. PDF File Dropzone -->
        <div id="quizDropzone" class="relative group border-2 border-dashed ${
          hasFile
            ? 'border-zinc-700 bg-zinc-900/40'
            : isDriveValid
            ? 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/40'
            : 'border-rose-500/30 hover:border-rose-500/50 bg-rose-950/5'
        } rounded-xl p-4 transition flex flex-col items-center justify-center text-center cursor-pointer">
          <input type="file" id="quizFileInput" accept=".pdf,application/pdf" class="hidden" />
          ${
            hasFile
              ? `
            <div class="w-full space-y-2">
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
                  <button type="button" id="btnQuizChangeFile" class="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer">Đổi tệp</button>
                </div>
              </div>
            </div>
          `
              : `
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center group-hover:scale-105 transition shrink-0">
                <i data-lucide="upload-cloud" class="w-4 h-4"></i>
              </div>
              <div class="text-left">
                <p class="text-xs sm:text-sm font-medium text-zinc-300">Chọn hoặc kéo thả tệp PDF</p>
                <p class="text-[11px] text-zinc-500 font-mono">Tự động nhận diện</p>
              </div>
            </div>
          `
          }
        </div>

        <!-- Divider -->
        <div class="flex items-center gap-3 my-1">
          <div class="flex-1 h-px bg-zinc-800/80"></div>
          <span class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Hoặc Google Drive</span>
          <div class="flex-1 h-px bg-zinc-800/80"></div>
        </div>

        <!-- 2. Google Drive Link Input (Tự động nhận diện) -->
        <div class="relative">
          <input type="url" id="quizDriveInput" value="${escapeHtml(state.gdriveUrl)}" placeholder="https://drive.google.com/file/d/.../view" class="w-full bg-zinc-950 border ${
            isDriveValid
              ? 'border-emerald-500/40 focus:border-emerald-500'
              : hasDriveUrl
              ? 'border-rose-500/40 focus:border-rose-500'
              : !hasFile
              ? 'border-rose-500/20 focus:border-rose-500/50'
              : 'border-zinc-800 focus:border-zinc-600'
          } rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden transition" />
        </div>
      </div>

      <!-- 2. Nhận diện thông minh Section (Chỉ hiện khi Nguồn đã OK - Ảnh 1) -->
      ${
        showPrompt
          ? `
        <div id="quizPromptBox" class="space-y-2 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/60 animate-fadeIn">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-400"></i>
              <span>Nhận diện thông minh</span>
            </label>
            ${
              !showParams
                ? `
              <button type="button" id="btnQuizSkipPrompt" class="text-[11px] text-zinc-500 hover:text-indigo-400 transition flex items-center gap-1 cursor-pointer">
                <span>Nhập thông số thủ công</span>
                <i data-lucide="arrow-down" class="w-3 h-3"></i>
              </button>
            `
                : ''
            }
          </div>
          <div class="flex gap-2">
            <input type="text" id="quizPromptInput" ${state.isAnalyzingPrompt ? 'disabled' : ''} placeholder="Ví dụ: Trang 11, 20 câu, từ câu 1" class="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-indigo-500/50 transition disabled:opacity-50" />
            <button type="button" id="btnQuizParsePrompt" ${state.isAnalyzingPrompt ? 'disabled' : ''} class="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              ${
                state.isAnalyzingPrompt
                  ? `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Đang phân tích...</span>`
                  : `<i data-lucide="sparkles" class="w-3.5 h-3.5"></i><span>Phân tích</span>`
              }
            </button>
          </div>
        </div>
      `
          : ''
      }

      <!-- 3. Generation Parameters Section (Chỉ hiện khi phân tích xong hoặc chọn thủ công - Ảnh 2) -->
      ${
        showParams
          ? `
        <div id="quizParamsBox" class="space-y-4 animate-fadeIn">
          <!-- Pages Input (Mandatory) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <span>Trang trích xuất</span>
                <span class="text-rose-500 font-bold">*</span>
                <span id="quizPagesStatus">
                  ${
                    hasValidPages
                      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="check" class="w-2.5 h-2.5"></i> Hợp lệ</span>`
                      : `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Bắt buộc</span>`
                  }
                </span>
              </label>
              <span class="text-[11px] text-zinc-500 font-mono">vd: 11 hoặc 11-15</span>
            </div>
            <input type="text" id="quizPagesInput" value="${escapeHtml(state.pages)}" placeholder="11" class="w-full bg-zinc-950 border ${
              hasValidPages ? 'border-emerald-500/40 focus:border-emerald-500' : 'border-rose-500/40 focus:border-rose-500'
            } rounded-xl px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-hidden transition" />
          </div>

          <!-- Question Count Input -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-zinc-300">Số lượng câu hỏi</label>
              <span class="text-[11px] text-zinc-500 font-mono">vd: 20, 23, 37...</span>
            </div>
            <input type="number" id="quizCountInput" min="1" max="200" value="${state.count || 20}" placeholder="20" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 font-mono focus:outline-hidden focus:border-zinc-600 transition" />
          </div>

          <!-- Start Number & Mandatory File Name Box -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div class="sm:col-span-4 space-y-1.5">
              <label class="text-xs font-medium text-zinc-300">Bắt đầu từ câu</label>
              <input type="number" id="quizStartInput" min="1" max="500" value="${state.start}" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 font-mono focus:outline-hidden focus:border-zinc-600 transition" />
            </div>
            <div class="sm:col-span-8 space-y-1.5">
              <label class="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <span>Tên file</span>
                <span class="text-rose-500 font-bold">*</span>
                <span id="quizPrefixStatus">
                  ${
                    hasValidPrefix
                      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="check" class="w-2.5 h-2.5"></i> Hợp lệ</span>`
                      : `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Bắt buộc</span>`
                  }
                </span>
              </label>
              <input type="text" id="quizPrefixInput" value="${escapeHtml(state.prefix)}" placeholder="Ví dụ: Ester Lipid,..." class="w-full bg-zinc-950 border ${
                hasValidPrefix ? 'border-emerald-500/40 focus:border-emerald-500' : 'border-rose-500/40 focus:border-rose-500'
              } rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-hidden transition" />
            </div>
          </div>

          <!-- Header Title -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-zinc-300">Tiêu đề in đầu trang</label>
            <input type="text" id="quizTitleInput" value="${escapeHtml(state.title)}" placeholder="BÀI TẬP TRẮC NGHIỆM" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-hidden focus:border-zinc-600 transition" />
          </div>

          <!-- Action Button -->
          <div class="pt-2">
            <button type="button" id="btnQuizGenerate" ${!isReadyToGenerate ? 'disabled' : ''} class="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition shadow-md ${
              isReadyToGenerate
                ? 'bg-zinc-100 hover:bg-white text-zinc-950 cursor-pointer'
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800/80 cursor-not-allowed'
            }">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>${state.isProcessing ? 'Đang tạo bài tập trắc nghiệm...' : 'Tạo Đề bài & Đáp án A4'}</span>
            </button>
          </div>
        </div>
      `
          : ''
      }
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
