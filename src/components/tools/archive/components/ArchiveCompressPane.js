/**
 * ArchiveCompressPane Component (< 150 lines)
 * Creates compressed archives (ZIP, TAR.GZ, 7Z) from multiple files
 */

import { renderDropzone } from '../../../common/Dropzone.js';
import { formatBytes } from '../../../../utilities/formatters.js';

export function renderArchiveCompressPane(state = {}) {
  const {
    files = [],
    archiveName = 'archive.zip',
    format = 'zip',
    compressionLevel = 'normal',
    isCompressing = false,
    stage = '',
    result = null
  } = state;

  return `
    <div class="space-y-6">
      ${!result ? `
        <!-- Dropzone for multiple files -->
        <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-6 sm:p-8 shadow-sm space-y-5">
          ${renderDropzone({
            id: 'archiveCompressDropzone',
            title: 'Kéo thả hoặc tải tệp lên',
            subtitle: 'Mọi định dạng tệp',
            accept: '*/*'
          })}

          ${files.length > 0 ? `
            <div class="space-y-4 pt-2">
              <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span class="font-medium">Đã chọn ${files.length} tệp (${formatBytes(files.reduce((acc, f) => acc + f.size, 0))})</span>
                <button id="btnClearCompressFiles" class="hover:text-red-500 transition">Xóa tất cả</button>
              </div>

              <div class="max-h-56 overflow-y-auto space-y-2 custom-scrollbar">
                ${files.map((file, idx) => `
                  <div class="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] text-xs">
                    <div class="flex items-center gap-2 min-w-0 truncate">
                      <i data-lucide="file" class="w-4 h-4 text-zinc-400 shrink-0"></i>
                      <span class="truncate text-zinc-800 dark:text-zinc-200 font-medium">${file.name}</span>
                      <span class="font-mono text-zinc-400 shrink-0">${formatBytes(file.size)}</span>
                    </div>
                    <button class="btn-remove-compress-file p-1 hover:text-red-500 text-zinc-400 transition" data-index="${idx}">
                      <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                `).join('')}
              </div>

              <!-- Options -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tên tệp nén</label>
                  <input id="inputCompressName" type="text" value="${archiveName}" class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white font-mono focus:outline-hidden focus:border-indigo-500" />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Định dạng</label>
                  <select id="selectCompressFormat" class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white font-medium focus:outline-hidden focus:border-indigo-500">
                    <option value="zip" ${format === 'zip' ? 'selected' : ''}>ZIP</option>
                    <option value="tar.gz" ${format === 'tar.gz' ? 'selected' : ''}>TAR.GZ</option>
                    <option value="7z" ${format === '7z' ? 'selected' : ''}>7Z</option>
                  </select>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Mức nén</label>
                  <select id="selectCompressLevel" class="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white font-medium focus:outline-hidden focus:border-indigo-500">
                    <option value="fast" ${compressionLevel === 'fast' ? 'selected' : ''}>Nhanh</option>
                    <option value="normal" ${compressionLevel === 'normal' ? 'selected' : ''}>Tiêu chuẩn</option>
                    <option value="maximum" ${compressionLevel === 'maximum' ? 'selected' : ''}>Tối đa</option>
                  </select>
                </div>
              </div>

              <!-- Action Button -->
              <div class="pt-2">
                <button id="btnRunCompress" ${isCompressing ? 'disabled' : ''} class="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm ${isCompressing ? 'opacity-60 cursor-not-allowed' : ''}">
                  ${isCompressing ? `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span id="compressStageText">${stage || 'Đang nén tệp tin...'}</span>` : '<i data-lucide="archive" class="w-4 h-4"></i> Tạo tệp nén'}
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      ` : `
        <!-- Completed Result -->
        <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-8 text-center space-y-6 shadow-sm">
          <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <i data-lucide="check-circle-2" class="w-7 h-7"></i>
          </div>

          <div class="space-y-1">
            <h3 class="text-lg font-bold text-zinc-900 dark:text-white">${result.archiveName}</h3>
            <p class="text-xs sm:text-sm font-mono text-zinc-500 dark:text-zinc-400">
              Dung lượng: ${formatBytes(result.sizeBytes)} • ${result.totalFiles} tệp đã nén
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <a href="${result.downloadUrl}" download="${result.archiveName}" class="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold inline-flex items-center gap-2 transition shadow-sm">
              <i data-lucide="download" class="w-4 h-4"></i> Tải về (${formatBytes(result.sizeBytes)})
            </a>
            <button id="btnTrashCompressResult" class="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-600 dark:bg-white/[0.04] dark:hover:bg-red-500/10 dark:text-zinc-300 dark:hover:text-red-400 border border-zinc-200 dark:border-white/[0.08] text-sm font-semibold inline-flex items-center gap-1.5 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i> Xóa
            </button>
            <button id="btnResetCompress" class="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] text-sm font-semibold transition">
              Nén đợt mới
            </button>
          </div>
        </div>
      `}
    </div>
  `.trim();
}
