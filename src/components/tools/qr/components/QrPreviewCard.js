/**
 * QrPreviewCard Component
 * Live preview, telemetry stats, destination switcher & export buttons
 */

export function renderQrPreviewCard(state) {
  const { activeTab, format, dynamic, generatedResult, isGenerating } = state;

  return `
    <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-6 text-center space-y-5 shadow-sm">
      <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
        <span class="font-medium">Xem Trước</span>
        <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 font-semibold">${(format || 'png').toUpperCase()}</span>
      </div>

      ${activeTab === 'url' ? `
        <!-- DYNAMIC QR PREVIEW & TELEMETRY -->
        ${dynamic.isCreating ? `
          <div class="p-5 bg-zinc-950 rounded-2xl border border-white/10 shadow-sm max-w-[280px] mx-auto flex flex-col items-center justify-center aspect-square gap-3">
            <div class="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <span class="text-xs font-mono text-zinc-400">Đang tạo mã QR...</span>
          </div>
        ` : dynamic.createdQr ? `
          <div id="dynamicQrCanvasContainer" class="p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-[280px] mx-auto flex items-center justify-center aspect-square">
            <!-- Mounted live via QRCodeStyling -->
          </div>

          <div class="space-y-4 pt-1">
            <!-- Telemetry Badge & Refresh -->
            <div class="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 text-xs">
              <span class="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i> ${dynamic.createdQr.scanCount} lượt quét
              </span>
              <button id="btnRefreshAnalytics" ${dynamic.isRefreshingAnalytics ? 'disabled' : ''} class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center gap-1 text-[11px] font-medium transition cursor-pointer">
                <i data-lucide="refresh-cw" class="w-3 h-3 ${dynamic.isRefreshingAnalytics ? 'animate-spin' : ''}"></i> Làm mới
              </button>
            </div>

            <!-- Short URL Box -->
            <div class="p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200/80 dark:border-white/[0.06] text-left space-y-1.5">
              <span class="text-[11px] text-zinc-500 block">Link rút gọn:</span>
              <div class="flex items-center justify-between gap-2">
                <a href="${dynamic.createdQr.shortUrl}" target="_blank" rel="noopener noreferrer" class="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                  ${dynamic.createdQr.shortUrl}
                </a>
                <button id="btnCopyDynamicShortLink" class="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-1 rounded transition" title="Sao chép">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- In-Place Destination Editor -->
            <div class="p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-xl border border-zinc-200/80 dark:border-white/[0.06] text-left space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-zinc-500">Đích đến:</span>
                ${!dynamic.isEditingDestination ? `
                  <button id="btnToggleEditDestination" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                    <i data-lucide="edit-3" class="w-3 h-3"></i> Đổi link
                  </button>
                ` : ''}
              </div>

              ${dynamic.isEditingDestination ? `
                <div class="space-y-2">
                  <input type="url" id="inputEditTargetUrl" value="${dynamic.editTargetUrl || dynamic.createdQr.targetUrl}" placeholder="https://..." class="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <div class="flex items-center gap-2">
                    <button id="btnSaveDestination" ${dynamic.isSavingDestination ? 'disabled' : ''} class="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1 transition">
                      ${dynamic.isSavingDestination ? '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>' : 'Lưu'}
                    </button>
                    <button id="btnCancelEditDestination" class="py-1.5 px-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition">
                      Hủy
                    </button>
                  </div>
                </div>
              ` : `
                <div class="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate select-all">
                  ${dynamic.createdQr.targetUrl}
                </div>
              `}
            </div>

            <!-- Export Action Buttons -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button id="btnDownloadDynamicPng" class="py-2 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1 transition shadow-sm">
                <i data-lucide="download" class="w-3.5 h-3.5"></i> PNG
              </button>
              <button id="btnDownloadDynamicSvg" class="py-2 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1 transition">
                <i data-lucide="file-code" class="w-3.5 h-3.5"></i> SVG
              </button>
              <button id="btnCopyDynamicImage" class="py-2 px-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1 transition" title="Sao chép ảnh">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Ảnh
              </button>
              <button id="btnTrashDynamicQr" class="py-2 px-2.5 rounded-xl bg-zinc-100 hover:bg-red-50 text-zinc-600 hover:text-red-600 dark:bg-white/[0.06] dark:hover:bg-red-500/10 dark:text-zinc-300 dark:hover:text-red-400 text-xs font-medium flex items-center justify-center gap-1 transition" title="Chuyển vào thùng rác">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        ` : `
          <div class="py-16 flex items-center justify-center">
            <div class="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-center text-zinc-400">
              <i data-lucide="qr-code" class="w-8 h-8 stroke-[1.5]"></i>
            </div>
        `}
      ` : isGenerating ? `
        <!-- STATIC QR LOADING BLACKOUT BOX -->
        <div class="p-5 bg-zinc-950 rounded-2xl border border-white/10 shadow-sm max-w-[260px] mx-auto flex flex-col items-center justify-center aspect-square gap-3">
          <div class="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
          <span class="text-xs font-mono text-zinc-400">Đang tạo mã QR...</span>
        </div>
      ` : generatedResult ? `
        <!-- STATIC QR RESULT -->
        <div class="p-5 bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-[260px] mx-auto flex items-center justify-center aspect-square">
          ${generatedResult.format === 'svg' ? `
            <div class="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
              ${generatedResult.content}
            </div>
          ` : `
            <img src="${generatedResult.dataUrl || generatedResult.content}" alt="Generated QR" class="w-full h-full object-contain rounded-lg">
          `}
        </div>

        <div class="space-y-2 pt-2">
          <div class="flex items-center justify-center gap-2">
            <button id="btnDownloadQr" class="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải Về
            </button>
            <button id="btnCopyQrData" class="py-2.5 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition" title="Sao chép">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button id="btnTrashStaticQr" class="py-2.5 px-3.5 rounded-xl bg-zinc-100 hover:bg-red-50 text-zinc-600 hover:text-red-600 dark:bg-white/[0.06] dark:hover:bg-red-500/10 dark:text-zinc-300 dark:hover:text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition" title="Chuyển vào thùng rác">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      ` : `
        <div class="py-16 flex items-center justify-center">
          <div class="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-center text-zinc-400">
            <i data-lucide="qr-code" class="w-8 h-8 stroke-[1.5]"></i>
          </div>
        </div>
      `}
    </div>
  `.trim();
}
