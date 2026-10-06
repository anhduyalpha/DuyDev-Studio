/**
 * PdfWorkspace Component (< 120 lines)
 * Unified PDF Studio Pro workspace layout shell.
 * Integrates 2-column responsive layout and Mobile Sticky Action Bar for thumb ergonomics.
 */

import { renderPdfModeSelector } from './components/PdfModeSelector.js';
import { renderDropzoneQueue } from './components/DropzoneQueue.js';
import { renderConfigPanel } from './components/ConfigPanel.js';
import { renderResultCard } from './components/ResultCard.js';
import { renderPdfErrorBanner } from './components/PdfErrorBanner.js';
import { renderPdfHistoryList } from './components/PdfHistoryList.js';
import { getToolTheme } from './services/pdfThemes.js';

export { attachPdfConverterListeners } from './hooks/usePdfDom.js';
export { renderPdfErrorBanner };

export function renderMobileStickyBar(queueState = {}) {
  const {
    mode = 'compress',
    files = [],
    selectedSplitPages = new Set(),
    splitRangeError = null,
    pages = '',
    pageRotations = {},
    password = '',
    watermarkText = '',
    pageNumbers = false,
    compressionPreset = 'medium',
    isProcessing = false,
    progress = 0
  } = queueState;

  if (!files || files.length === 0) return '';

  const theme = getToolTheme(mode);
  const splitCount = selectedSplitPages.size;
  const rotatedCount = Object.values(pageRotations || {}).filter((deg) => (deg % 360) !== 0).length;

  let startDisabled = false;
  let actionLabel = 'Bắt đầu';
  let summaryTitle = theme.label;
  let summarySub = files[0]?.name || '';

  switch (mode) {
    case 'merge':
      startDisabled = files.length < 2;
      actionLabel = `Ghép (${files.length})`;
      summarySub = `${files.length} tệp đã chọn`;
      break;
    case 'images_to_pdf':
      startDisabled = files.length < 1;
      actionLabel = `Tạo PDF (${files.length})`;
      summarySub = `${files.length} ảnh đã chọn`;
      break;
    case 'split':
      startDisabled = (splitCount === 0 && !pages) || Boolean(splitRangeError);
      actionLabel = splitCount > 0 ? `Tách ${splitCount} trang` : 'Tách trang';
      summarySub = splitCount > 0 ? `Đã chọn ${splitCount} trang` : (pages ? `Dải: ${pages}` : 'Chưa chọn trang');
      break;
    case 'rotate':
      startDisabled = false;
      actionLabel = 'Lưu file xoay';
      summarySub = rotatedCount > 0 ? `Đã xoay ${rotatedCount} trang` : 'Góc xoay hiện tại';
      break;
    case 'organize': {
      const activeRemaining = (queueState.organizeOrder?.length || (files[0]?.pages || 1)) - (queueState.organizeDeleted?.size || 0);
      startDisabled = activeRemaining <= 0;
      actionLabel = `Lưu (${activeRemaining} trang)`;
      summarySub = `${activeRemaining} trang giữ lại`;
      break;
    }
    case 'compress': {
      const levelMap = { high: 'Nén cao', medium: 'Cân bằng', low: 'Nén nhẹ' };
      actionLabel = 'Nén PDF';
      summarySub = levelMap[compressionPreset] || 'Cân bằng';
      break;
    }
    case 'extract_images':
      actionLabel = 'Trích ảnh';
      summarySub = files[0]?.name || 'Tệp PDF';
      break;
    case 'watermark':
      startDisabled = (!watermarkText.trim() && !pageNumbers);
      actionLabel = 'Đóng dấu';
      summarySub = watermarkText || (pageNumbers ? 'Đánh số trang' : 'Chưa cấu hình');
      break;
    case 'security':
      startDisabled = !password;
      actionLabel = queueState.securityAction === 'unlock' ? 'Mở khóa' : 'Khóa file';
      summarySub = queueState.securityAction === 'unlock' ? 'Gỡ mật khẩu' : 'Đặt mật khẩu';
      break;
    case 'pdf_to_docx':
      actionLabel = 'Sang Word';
      summarySub = pages ? `Trang: ${pages}` : 'Toàn bộ trang';
      break;
    default:
      actionLabel = 'Thực hiện';
  }

  return `
    <div id="pdfMobileStickyBar" class="sm:hidden fixed bottom-[74px] left-3 right-3 z-30 max-w-md mx-auto p-2.5 rounded-2xl bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xl border border-zinc-200/90 dark:border-white/[0.12] shadow-2xl flex items-center justify-between gap-3 animate-fadeIn select-none">
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="w-8 h-8 rounded-lg ${theme.bgSoft} border ${theme.borderColor} ${theme.textSoft} flex items-center justify-center shrink-0">
          <i data-lucide="${theme.icon}" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">${summaryTitle}</div>
          <div class="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">${summarySub}</div>
        </div>
      </div>

      <button type="button" id="btnStartProcessMobile" ${startDisabled || isProcessing ? 'disabled' : ''}
        class="min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-md ${
          isProcessing
            ? `${theme.ctaProgress} opacity-85 cursor-not-allowed`
            : startDisabled
            ? 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-white/[0.06] cursor-not-allowed'
            : `${theme.ctaGradient} active:scale-95 cursor-pointer`
        }">
        <i data-lucide="${isProcessing ? 'loader-2' : 'play'}" class="w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : 'fill-current'}"></i>
        <span>${isProcessing ? `${Math.round(progress || 0)}%` : actionLabel}</span>
      </button>
    </div>
  `.trim();
}

export function renderPdfConverter(queueState = {}) {
  const { error, result, mode = 'compress', files = [], isProcessing = false } = queueState;
  const hasFiles = files.length > 0;
  const isVisualMode = (mode === 'rotate' || mode === 'split') && hasFiles;
  const leftSpan = !hasFiles ? 'lg:col-span-12' : (isVisualMode ? 'lg:col-span-8' : 'lg:col-span-7');
  const rightSpan = !hasFiles ? 'hidden' : (isVisualMode ? 'lg:col-span-4' : 'lg:col-span-5');

  return `
    <div id="pdfStudioWorkspaceRoot" class="space-y-6 animate-fadeIn">
      <!-- Breadcrumb Navigation -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">PDF Studio</span>
        </div>
      </div>

      <!-- Mode Selector -->
      <div id="pdfModeSelectorContainer">
        ${renderPdfModeSelector(mode, isProcessing)}
      </div>

      <!-- Error Banner -->
      <div id="pdfErrorBannerContainer">
        ${renderPdfErrorBanner(error)}
      </div>

      <!-- 2-Column Responsive Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div id="pdfDropzoneContainer" class="${leftSpan} space-y-4">
          ${renderDropzoneQueue(queueState)}
        </div>
        <div id="pdfConfigContainer" class="${rightSpan} space-y-4">
          ${renderConfigPanel(queueState)}
        </div>
      </div>

      <!-- Mobile Sticky Bottom Action Bar (Pillar 5) -->
      <div id="pdfMobileStickyContainer">
        ${hasFiles ? renderMobileStickyBar(queueState) : ''}
      </div>

      <!-- Result Card -->
      <div id="pdfResultContainer">
        ${renderResultCard(result)}
      </div>

      <!-- History List -->
      <div id="pdfHistoryContainer" class="pt-2">
        ${renderPdfHistoryList()}
      </div>
    </div>
  `.trim();
}
