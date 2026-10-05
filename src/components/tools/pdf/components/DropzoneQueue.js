/**
 * DropzoneQueue Component (< 150 lines)
 * Specialized Workspace Orchestrator for PDF Studio Pro
 * Renders tailored workspaces (Rotate, Split, Multi-file, Single-file Card) or clean Dropzone
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPdfRotateWorkspace } from './PdfRotateWorkspace.js';
import { renderPdfSplitWorkspace } from './PdfSplitWorkspace.js';
import { renderPdfOrganizeWorkspace } from './PdfOrganizeWorkspace.js';
import { renderPdfMultiFileWorkspace } from './PdfMultiFileWorkspace.js';
import { PDF_MODES } from './PdfModeSelector.js';

const MODE_DESCRIPTIONS = {
  merge: 'Ghép nhiều tệp PDF thành một tài liệu duy nhất theo thứ tự.',
  split: 'Tách các trang đã chọn hoặc trích xuất theo dải trang thành tệp mới.',
  rotate: 'Xoay hướng các trang 90°, 180° hoặc 270° không làm giảm chất lượng.',
  organize: 'Sắp xếp lại thứ tự các trang, xóa trang không cần thiết hoặc xoay trang trực quan.',
  compress: 'Giảm dung lượng tệp PDF với các mức tối ưu hóa luồng dữ liệu.',
  extract_images: 'Trích xuất toàn bộ hình ảnh gốc từ tài liệu PDF thành tệp ZIP.',
  images_to_pdf: 'Chỉ nhận tệp hình ảnh (PNG, JPG, WebP...). Tự động căn chỉnh vừa khổ A4.',
  pdf_to_docx: 'Chuyển đổi tài liệu PDF thành văn bản Word (.docx) có thể chỉnh sửa, giữ nguyên bảng biểu.',
  watermark: 'Chèn chữ chìm đánh dấu bản quyền hoặc đánh số trang tự động.',
  security: 'Khóa mật khẩu mã hóa AES-256 hoặc giải mã gỡ bỏ mật khẩu.'
};

export function renderDropzoneQueue(queueState = {}) {
  const {
    mode = 'compress',
    files = [],
    pageRotations = {},
    selectedSplitPages = new Set(),
    splitRangeError = null,
    totalPages = 0,
    pages = '',
    thumbnailPage = 0,
    isLoadingFile = false,
    loadingFileName = '',
    isProcessing = false
  } = queueState;

  // 1. When a file is being selected/dropped and loaded, render the upload animation
  if (isLoadingFile) {
    return `
      <div id="pdfFileLoadingCard" class="p-8 sm:p-12 rounded-2xl bg-white dark:bg-[#121215] border-2 border-dashed border-emerald-500/80 dark:border-emerald-500/70 shadow-xs flex flex-col items-center justify-center text-center space-y-4 animate-fadeIn select-none min-h-[220px]">
        <div class="relative flex items-center justify-center">
          <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 shadow-sm">
            <i data-lucide="upload-cloud" class="w-7 h-7 animate-bounce"></i>
          </div>
          <span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
          <span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500"></span>
        </div>
        <div class="space-y-1.5 max-w-sm">
          <h4 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">${loadingFileName || 'Đang tải tệp lên...'}</h4>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">Đang nạp và phân tích cấu trúc tệp PDF...</p>
        </div>
        <div class="w-48 h-1.5 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full w-full animate-pulse"></div>
        </div>
      </div>
    `.trim();
  }

  // 2. When files are already chosen, delegate to the specialized workspace
  if (files.length > 0) {
    if (mode === 'rotate') {
      return renderPdfRotateWorkspace({
        file: files[0],
        pageRotations,
        totalPages: totalPages || files[0]?.pages || 0,
        thumbnailPage
      });
    }

    if (mode === 'split') {
      return renderPdfSplitWorkspace({
        file: files[0],
        selectedPages: selectedSplitPages,
        splitRangeError,
        totalPages: totalPages || files[0]?.pages || 0,
        pagesInput: pages,
        thumbnailPage
      });
    }

    if (mode === 'organize') {
      return renderPdfOrganizeWorkspace({
        file: files[0],
        organizeOrder: queueState.organizeOrder,
        organizeDeleted: queueState.organizeDeleted,
        organizeRotations: queueState.organizeRotations,
        totalPages: totalPages || files[0]?.pages || 0,
        thumbnailPage
      });
    }

    if (mode === 'merge' || mode === 'images_to_pdf') {
      return renderPdfMultiFileWorkspace({
        mode,
        files
      });
    }

    // Single-file operations (compress, watermark, security, extract_images, pdf_to_docx)
    const singleFile = files[0];

    return `
      <div id="pdfSingleFileCardRoot" class="space-y-4 select-none">
        <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border-2 border-dashed border-emerald-500/80 dark:border-emerald-500/70 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <i data-lucide="file-text" class="w-6 h-6"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">${singleFile.name}</span>
                ${isProcessing ? `
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1.5 shrink-0">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Đang xử lý
                  </span>
                ` : `
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    Sẵn sàng
                  </span>
                `}
              </div>
              <p class="text-xs font-mono text-zinc-500 mt-1">
                ${formatBytes(singleFile.size)} ${singleFile.pages ? `• ${singleFile.pages} trang` : ''}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button id="btnPreviewSingleFile" type="button" class="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              <span>Xem trước</span>
            </button>
            <button id="btnChangeSingleFile" type="button" ${isProcessing ? 'disabled' : ''} class="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition ${isProcessing ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}">
              <i data-lucide="file-up" class="w-3.5 h-3.5"></i>
              <span>Đổi tệp</span>
            </button>
          </div>
        </div>
      </div>
    `.trim();
  }

  // 2. When no files are selected, render the clean Dropzone
  const isMulti = mode === 'merge' || mode === 'images_to_pdf';
  const isImages = mode === 'images_to_pdf';
  const currentMode = PDF_MODES.find((m) => m.id === mode);
  const functionName = currentMode ? currentMode.label : 'PDF';
  const description = MODE_DESCRIPTIONS[mode] || '';
  const title = isImages
    ? 'Kéo thả hoặc tải ảnh lên'
    : mode === 'extract_images'
    ? 'Kéo thả tệp PDF cần trích xuất ảnh'
    : mode === 'organize'
    ? 'Kéo thả tệp PDF cần sắp xếp trang'
    : mode === 'pdf_to_docx'
    ? 'Kéo thả tệp PDF cần chuyển sang Word'
    : 'Kéo thả hoặc tải tệp lên';
  const subtitle = `
    <span class="inline-block font-semibold text-zinc-800 dark:text-zinc-200">${functionName}</span>
    ${description ? `<span class="block text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">${description}</span>` : ''}
  `.trim();
  const accept = isImages
    ? 'image/png, image/jpeg, image/webp, image/avif, image/gif, image/bmp, image/tiff, .png, .jpg, .jpeg, .webp, .avif, .gif, .bmp, .tiff'
    : '.pdf, application/pdf';

  return `
    <div id="pdfUnifiedDropzoneCard" class="relative rounded-2xl bg-white dark:bg-[#121215] border-2 border-dashed border-red-500/80 dark:border-red-500/70 shadow-xs transition-colors duration-200 overflow-hidden flex flex-col justify-between">
      <!-- File Dropzone Area -->
      <div id="pdfDropzone" class="relative group p-6 sm:p-8 text-center cursor-pointer flex flex-col items-center justify-center min-h-[190px] transition duration-200 hover:bg-zinc-50/50 dark:hover:bg-white/[0.01]">
        <input type="file" id="pdfDropzone_input" class="hidden" accept="${accept}" ${isMulti ? 'multiple' : ''}>
        
        <div class="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-zinc-300 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:text-black dark:group-hover:text-white transition duration-200">
          <i data-lucide="upload-cloud" class="w-6 h-6"></i>
        </div>
        
        <h4 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">${title}</h4>
        ${subtitle ? `<p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm font-normal">${subtitle}</p>` : ''}
        
        <div class="mt-4">
          <button type="button" onclick="document.getElementById('pdfDropzone_input').click()" 
                  class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold shadow-xs transition cursor-pointer">
            Chọn tệp
          </button>
        </div>
      </div>

      ${!isImages ? `
        <!-- Google Drive Direct Import Bottom Bar (Unified) -->
        <div class="border-t border-dashed border-zinc-200 dark:border-white/[0.08] bg-zinc-50/60 dark:bg-white/[0.015] p-3.5 sm:p-4 space-y-2.5">
          <div class="flex items-center text-xs px-0.5">
            <span class="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <i data-lucide="link" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Hoặc dán liên kết Google Drive</span>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <i data-lucide="cloud" class="w-4 h-4"></i>
              </div>
              <input type="url" id="inputPdfDriveLink" placeholder="https://drive.google.com/file/d/.../view"
                class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200/90 dark:border-white/[0.08] text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono" />
            </div>
            <button type="button" id="btnImportPdfDrive"
              class="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs shrink-0 active:scale-[0.98]">
              <i data-lucide="arrow-down-to-dot" class="w-4 h-4 text-emerald-400 dark:text-emerald-500"></i>
              <span>Nạp tệp</span>
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `.trim();
}

