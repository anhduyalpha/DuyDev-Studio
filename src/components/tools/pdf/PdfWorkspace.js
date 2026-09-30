/**
 * PdfWorkspace Component (< 100 lines)
 * Unified PDF Studio Pro workspace layout shell.
 */

import { renderPdfModeSelector } from './components/PdfModeSelector.js';
import { renderDropzoneQueue } from './components/DropzoneQueue.js';
import { renderConfigPanel } from './components/ConfigPanel.js';
import { renderResultCard } from './components/ResultCard.js';
import { renderPdfErrorBanner } from './components/PdfErrorBanner.js';
import { renderPdfHistoryList } from './components/PdfHistoryList.js';
import { renderResetStateButton } from '../../../utilities/moduleState.js';

export { attachPdfConverterListeners } from './hooks/usePdfDom.js';
export { renderPdfErrorBanner };

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
        ${renderResetStateButton('pdf_studio')}
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
