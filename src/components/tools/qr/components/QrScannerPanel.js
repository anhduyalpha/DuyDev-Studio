/**
 * QrScannerPanel Component
 * Dual-layer camera / image scanner dropzone & result viewer
 */

import { renderDropzone } from '../../../common/Dropzone.js';

export function renderQrScannerWorkspace(scan = {}) {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 space-y-3">
        ${renderDropzone({
          id: 'qrScanDropzone',
          title: 'Kéo thả hoặc tải ảnh lên',
          subtitle: 'Hỗ trợ PNG, JPG, WEBP (Ctrl + V để dán ảnh)',
          accept: 'image/*'
        })}

        <!-- Quick Paste Action Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.07] text-xs shadow-2xs">
          <div class="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <i data-lucide="clipboard" class="w-4 h-4 text-indigo-500 shrink-0"></i>
            <span class="font-medium">Dán ảnh màn hình:</span>
            <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-white/10 font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-white/10 shadow-3xs">Ctrl + V</kbd>
          </div>

          <button type="button" id="btnPasteScanImage" class="py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer">
            <i data-lucide="clipboard-paste" class="w-3.5 h-3.5"></i> Dán từ Clipboard
          </button>
        </div>
      </div>

      <div class="lg:col-span-5 space-y-4">
        <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-4 shadow-sm">
          <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <i data-lucide="scan" class="w-4 h-4 text-emerald-500"></i> Kết Quả Quét QR
          </h3>

          ${scan?.isScanning ? `
            <div class="text-center py-12 text-xs text-zinc-500 font-mono space-y-2">
              <i data-lucide="loader-2" class="w-8 h-8 mx-auto text-indigo-500 animate-spin"></i>
              <p>Đang phân tích hình ảnh...</p>
            </div>
          ` : scan?.result ? `
            <div class="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] space-y-3">
              <div class="flex items-center justify-between text-xs text-zinc-500">
                <span>Nội dung giải mã:</span>
                <button id="btnCopyScanResult" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép
                </button>
              </div>
              <div class="p-3 bg-white dark:bg-[#18181B] rounded-lg border border-zinc-200/60 dark:border-white/[0.08] font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all select-all max-h-48 overflow-y-auto leading-relaxed">
                ${scan.result}
              </div>
              ${scan.result.startsWith('http://') || scan.result.startsWith('https://') ? `
                <a href="${scan.result}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm">
                  <i data-lucide="external-link" class="w-4 h-4"></i> Mở liên kết
                </a>
              ` : ''}
            </div>
          ` : `
            <div class="text-center py-12 text-xs text-zinc-400 font-mono space-y-2">
              <i data-lucide="qr-code" class="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 stroke-[1.5]"></i>
              <p>Chưa có ảnh nào được quét</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `.trim();
}
