/**
 * ConverterWorkspace Component (< 100 lines)
 * Layout shell for File Converter Pro batch workspace.
 */

import { renderConverterDropzone } from './components/ConverterDropzone.js';
import { renderFormatSelector } from './components/FormatSelector.js';
import { renderConverterOptions } from './components/ConverterOptions.js';
import { renderConverterQueueList } from './components/ConverterQueueList.js';
import { renderConverterResult } from './components/ConverterResult.js';
import { renderConverterHistoryList } from './components/ConverterHistoryList.js';

export { attachConverterListeners } from './hooks/useConverterDom.js';

export function renderConverterWorkspace(state) {
  const items = state.items || [];
  const hasItems = items.length > 0;
  const allDone = hasItems && items.every((it) => it.status === 'completed' || it.status === 'error');
  const hasCompleted = items.some((it) => it.status === 'completed');
  const showQueue = hasItems && !allDone;

  return `
    <div id="converterWorkspaceRoot" class="space-y-6 pb-36 sm:pb-32">
      <!-- Breadcrumb Navigation -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Chuyển Đổi</span>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-600 dark:text-zinc-400 font-medium">File Converter</span>
        </div>
      </div>

      <!-- Persistent Error Banner -->
      <div id="converterErrorBanner" class="${state.error ? '' : 'hidden'} p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center gap-2.5">
          <i data-lucide="alert-circle" class="w-5 h-5 text-red-500 shrink-0"></i>
          <span id="converterErrorText">${state.error || ''}</span>
        </div>
        <button id="btnDismissConverterError" type="button" class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition cursor-pointer">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Stage-Driven Responsive Layout -->
      <div id="converterMainGrid" class="${hasItems && !allDone ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : hasItems && allDone ? 'max-w-4xl mx-auto space-y-4' : 'max-w-2xl mx-auto space-y-4'}">
        <!-- Left Column / Center Dropzone: Dropzone, Batch Format Selector, Queue List, Result/ZIP -->
        <div id="converterLeftCol" class="${hasItems && !allDone ? 'lg:col-span-7 space-y-4' : 'space-y-4 w-full'}">
          <div id="converterDropzoneContainer" class="${allDone ? 'hidden' : ''}">${renderConverterDropzone(state)}</div>
          <div id="converterFormatContainer" class="${showQueue ? '' : 'hidden'}">${renderFormatSelector(state)}</div>
          <div id="converterQueueContainer" class="${showQueue ? '' : 'hidden'}">${renderConverterQueueList(state)}</div>
          <div id="converterResultContainer" class="${hasCompleted ? '' : 'hidden'}">${renderConverterResult(state)}</div>
        </div>

        <!-- Right Column: Contextual Options & Action Button (Only when pending items exist) -->
        <div id="converterRightCol" class="${hasItems && !allDone ? 'lg:col-span-5 space-y-4 lg:sticky lg:top-6 lg:self-start' : 'hidden'}">
          <div id="converterOptionsContainer">${renderConverterOptions(state)}</div>
        </div>
      </div>

      <!-- Dedicated History Section -->
      <div id="converterHistoryContainer" class="pt-4 sm:pt-6">
        ${renderConverterHistoryList()}
      </div>
    </div>
  `.trim();
}
