/**
 * QrStudio - Modular Main Shell & Tab Switcher (< 120 lines)
 * Professional Dark Minimalism
 */

import { qrState, QR_TABS } from './hooks/useQrState.js';
import { renderQrFormDynamic } from './components/QrFormDynamic.js';
import { renderQrFormVietQr } from './components/QrFormVietQr.js';
import { renderQrFormWifi } from './components/QrFormWifi.js';
import { renderQrFormVCard } from './components/QrFormVCard.js';
import { renderQrFormStatic, renderQrActionControls } from './components/QrFormStatic.js';
import { renderQrStylePanel } from './components/QrStylePanel.js';
import { renderQrPreviewCard } from './components/QrPreviewCard.js';
import { renderQrScannerWorkspace } from './components/QrScannerPanel.js';
import { renderQrHistoryList } from './components/QrHistoryList.js';
import { attachQrStudioListeners, attachQrScannerListeners } from './hooks/useQrListeners.js';
import { renderResetStateButton } from '../../../utilities/moduleState.js';

export { qrState, attachQrStudioListeners, attachQrScannerListeners };

export function renderQrScanner() {
  const { scan, error } = qrState;

  return `
    <div class="space-y-6 animate-fadeIn">
      <!-- Breadcrumb -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Quét Mã QR</span>
        </div>
        ${renderResetStateButton('qr')}
      </div>

      <!-- Header Intro -->
      <div>
        <h2 class="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <i data-lucide="scan-line" class="w-5 h-5 text-emerald-500"></i>
          Quét Mã QR
        </h2>
      </div>

      ${error ? `
        <div class="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-2"><i data-lucide="alert-circle" class="w-4 h-4 text-red-500 shrink-0"></i><span>${error}</span></div>
          <button id="btnDismissQrError" class="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition cursor-pointer"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        </div>
      ` : ''}

      <!-- Main Scanner Workspace -->
      ${renderQrScannerWorkspace(scan)}

      <!-- Scanned QR History -->
      ${renderQrHistoryList('scan')}
    </div>
  `.trim();
}

export function renderQrStudio(initialTab = null) {
  if (initialTab && QR_TABS.some((t) => t.id === initialTab)) {
    qrState.activeTab = initialTab;
  } else if (!QR_TABS.some((t) => t.id === qrState.activeTab)) {
    qrState.activeTab = 'url';
  }

  const { activeTab, error, dynamic, styling, vietqr, wifi, vcard } = qrState;

  return `
    <div class="space-y-6 animate-fadeIn">
      <!-- Breadcrumb -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Tạo Mã QR</span>
        </div>
        ${renderResetStateButton('qr')}
      </div>

      <!-- Navigation Tabs Bar (Creation Only) -->
      <div id="qrTabBar" class="flex items-center gap-1.5 p-1.5 bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl max-w-2xl overflow-x-auto scroll-smooth">
        ${QR_TABS.map((t) => `
          <button type="button" data-qr-tab="${t.id}" class="btn-qr-tab flex-1 flex items-center justify-center gap-2 py-2 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === t.id ? 'bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-white shadow-xs border border-zinc-200/80 dark:border-white/10' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }">
            <i data-lucide="${t.icon}" class="w-4 h-4 shrink-0"></i>
            <span>${t.label}</span>
          </button>
        `).join('')}
      </div>

      ${error ? `
        <div class="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-2"><i data-lucide="alert-circle" class="w-4 h-4 text-red-500 shrink-0"></i><span>${error}</span></div>
          <button id="btnDismissQrError" class="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition cursor-pointer"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        </div>
      ` : ''}

      <!-- Main Creation Workspace Area -->
      <div id="qrWorkspaceContent">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7 space-y-6">
            <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-6 space-y-6 shadow-sm">
              ${
                activeTab === 'url'
                  ? renderQrFormDynamic(dynamic) + renderQrStylePanel(styling)
                  : (
                      activeTab === 'vietqr' ? renderQrFormVietQr(vietqr)
                      : activeTab === 'wifi' ? renderQrFormWifi(wifi)
                      : activeTab === 'vcard' ? renderQrFormVCard(vcard)
                      : renderQrFormStatic(qrState)
                    ) + renderQrActionControls(qrState)
              }
            </div>
          </div>
          <div class="lg:col-span-5 space-y-4">
            ${renderQrPreviewCard(qrState)}
          </div>
        </div>
      </div>

      <!-- Created QR History Section -->
      ${renderQrHistoryList('create')}
    </div>
  `.trim();
}
