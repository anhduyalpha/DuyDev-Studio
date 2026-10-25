/**
 * PdfContinueModal Component (< 200 lines)
 * Module Selector Modal for Chaining PDF Results and History Files
 * Displays an Impeccable grid of compatible PDF & Studio modules for user selection.
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { soundEngine } from '../../../../utilities/soundEngine.js';

let activeContinueKeydownHandler = null;

const PDF_STUDIO_MODULES = [
  {
    id: 'compress',
    title: 'Nén PDF',
    icon: 'minimize-2',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    desc: 'Giảm dung lượng tệp tối ưu'
  },
  {
    id: 'split',
    title: 'Tách trang',
    icon: 'scissors',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    desc: 'Trích xuất hoặc chia tách các trang'
  },
  {
    id: 'rotate',
    title: 'Xoay trang',
    icon: 'rotate-cw',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
    desc: 'Xoay góc 90°, 180° hoặc 270°'
  },
  {
    id: 'organize',
    title: 'Sắp xếp trang',
    icon: 'layout-grid',
    badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20',
    desc: 'Đổi thứ tự trang hoặc xóa trang'
  },
  {
    id: 'merge',
    title: 'Ghép PDF',
    icon: 'layers',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    desc: 'Ghép thêm với các tệp PDF khác'
  },
  {
    id: 'pdf_to_docx',
    title: 'PDF sang Word',
    icon: 'file-text',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    desc: 'Chuyển thành văn bản Word (.docx)'
  },
  {
    id: 'extract_images',
    title: 'Trích ảnh',
    icon: 'images',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    desc: 'Rút toàn bộ ảnh gốc ra tệp ZIP'
  },
  {
    id: 'watermark',
    title: 'Đóng dấu Watermark',
    icon: 'stamp',
    badgeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
    desc: 'Chèn chữ chìm hoặc số trang'
  },
  {
    id: 'security',
    title: 'Bảo mật & Khóa',
    icon: 'shield',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    desc: 'Khóa mật khẩu hoặc giải mã'
  }
];

const CROSS_MODULES = [
  {
    id: 'quiz-generator',
    title: 'Tạo đề trắc nghiệm',
    icon: 'sparkles',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
    desc: 'Bóc tách câu hỏi và xuất đề A4 2 cột'
  },
  {
    id: 'universal-converter',
    title: 'Chuyển đổi định dạng',
    icon: 'refresh-cw',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
    desc: 'Chuyển sang các định dạng tệp khác'
  }
];

/**
 * Closes the active PDF continue modal and unlocks document scrolling.
 */
export function closePdfContinueModal() {
  const modal = document.getElementById('pdfContinueModal');
  if (modal) modal.remove();

  if (activeContinueKeydownHandler) {
    window.removeEventListener('keydown', activeContinueKeydownHandler);
    activeContinueKeydownHandler = null;
  }
  document.body.style.overflow = '';
}

/**
 * Opens the interactive module selector modal for chaining a PDF result or history item.
 * @param {{ fileInfo: Object, qm: Object }} param
 */
export function openPdfContinueModal({ fileInfo, qm } = {}) {
  closePdfContinueModal();
  if (!fileInfo || !qm) return;

  const fileName = fileInfo.fileName || fileInfo.name || 'document.pdf';
  const fileSize = fileInfo.fileSize || fileInfo.size || 0;

  const modalHtml = `
    <div id="pdfContinueModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div id="pdfContinueModalCard" class="w-full max-w-2xl bg-white dark:bg-[#121215] border border-zinc-200/90 dark:border-white/[0.09] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Header Bar -->
        <div class="p-4 sm:p-5 bg-zinc-50/70 dark:bg-white/[0.02] border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
              <i data-lucide="arrow-up-right" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Chọn công cụ xử lý tiếp
              </h3>
              <p class="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                ${fileName} ${fileSize ? `• ${formatBytes(fileSize)}` : ''}
              </p>
            </div>
          </div>

          <button id="btnClosePdfContinueModal" type="button" class="w-9 h-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center transition cursor-pointer shrink-0" title="Đóng">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Body with Modules Grid -->
        <div class="overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
          <!-- Section 1: PDF Studio Modules -->
          <div>
            <div class="flex items-center gap-2 mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Công cụ PDF Studio
              </span>
              <div class="flex-1 h-px bg-zinc-100 dark:bg-white/[0.06]"></div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
              ${PDF_STUDIO_MODULES.map((m) => `
                <button type="button" data-continue-mode="${m.id}"
                  class="btn-select-continue-module text-left p-3 rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-zinc-50/50 hover:bg-white dark:bg-white/[0.02] dark:hover:bg-white/[0.06] hover:border-zinc-300 dark:hover:border-white/20 transition-all hover:shadow-xs active:scale-[0.98] cursor-pointer flex items-start gap-3 group">
                  <div class="w-9 h-9 rounded-lg ${m.badgeClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <i data-lucide="${m.icon}" class="w-4 h-4"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        ${m.title}
                      </span>
                      <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                      ${m.desc}
                    </p>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Section 2: Cross-Tool Modules -->
          <div>
            <div class="flex items-center gap-2 mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Mô-đun liên quan
              </span>
              <div class="flex-1 h-px bg-zinc-100 dark:bg-white/[0.06]"></div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              ${CROSS_MODULES.map((m) => `
                <button type="button" data-continue-mode="${m.id}"
                  class="btn-select-continue-module text-left p-3 rounded-xl border border-zinc-200/80 dark:border-white/[0.07] bg-zinc-50/50 hover:bg-white dark:bg-white/[0.02] dark:hover:bg-white/[0.06] hover:border-zinc-300 dark:hover:border-white/20 transition-all hover:shadow-xs active:scale-[0.98] cursor-pointer flex items-start gap-3 group">
                  <div class="w-9 h-9 rounded-lg ${m.badgeClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <i data-lucide="${m.icon}" class="w-4 h-4"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        ${m.title}
                      </span>
                      <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                      ${m.desc}
                    </p>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.body.style.overflow = 'hidden';

  const modalEl = document.getElementById('pdfContinueModal');
  const cardEl = document.getElementById('pdfContinueModalCard');
  if (!modalEl) return;

  if (window.lucide) window.lucide.createIcons({ root: modalEl });

  // Event bindings
  modalEl.querySelector('#btnClosePdfContinueModal')?.addEventListener('click', closePdfContinueModal);

  modalEl.addEventListener('click', (e) => {
    if (cardEl && !cardEl.contains(e.target)) {
      closePdfContinueModal();
    }
  });

  activeContinueKeydownHandler = (e) => {
    if (e.key === 'Escape') closePdfContinueModal();
  };
  window.addEventListener('keydown', activeContinueKeydownHandler);

  modalEl.querySelectorAll('.btn-select-continue-module').forEach((btn) => {
    btn.onclick = () => {
      const mode = btn.dataset.continueMode;
      if (!mode) return;
      soundEngine.playAction();
      closePdfContinueModal();
      qm.chainResultToMode(mode, fileInfo);
    };
  });
}
