/**
 * ConfigPanel Component (< 190 lines)
 * Contextual settings panel for PDF Studio Pro modes.
 * Displays dedicated configuration controls only when options exist (Compress, Watermark, Security),
 * and presents clean direct action execution for zero-config modes (Merge, Split, Rotate, Images-to-PDF, Extract Images, View).
 */

export function renderConfigPanel(queueState = {}) {
  const {
    mode = 'compress',
    securityAction = 'lock',
    compressionPreset = 'medium',
    selectedSplitPages = new Set(),
    splitRangeError = null,
    watermarkText = '',
    watermarkPosition = 'center',
    watermarkOpacity = 0.3,
    pageNumbers = false,
    password = '',
    pages = '',
    isProcessing = false,
    progress = 0,
    stage = '',
    files = []
  } = queueState;

  if (!files || files.length === 0) {
    return '';
  }

  const splitCount = selectedSplitPages.size;

  const renderModeSettings = () => {
    switch (mode) {
      case 'compress':
        return `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Mức độ nén</label>
              <div class="grid grid-cols-3 gap-1.5">
                ${[
                  { id: 'high', label: 'Nén cao' },
                  { id: 'medium', label: 'Cân bằng' },
                  { id: 'low', label: 'Nén nhẹ' }
                ].map((lvl) => `
                  <button type="button" data-compression="${lvl.id}" ${isProcessing ? 'disabled' : ''}
                    class="btn-compression-preset py-2 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      isProcessing ? 'opacity-50 cursor-not-allowed ' : ''
                    }${
                      compressionPreset === lvl.id
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-zinc-400'
                    }">
                    ${lvl.label}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        `;

      case 'watermark':
        return `
          <div class="space-y-3">
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Chữ watermark</label>
              <input type="text" id="inputPdfWatermark" value="${watermarkText}" placeholder="Nhập chữ chìm..." ${isProcessing ? 'disabled' : ''}
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Vị trí</label>
              <div class="grid grid-cols-3 gap-1.5">
                ${[
                  { id: 'center', label: 'Chéo giữa' },
                  { id: 'top', label: 'Đầu trang' },
                  { id: 'bottom', label: 'Chân trang' }
                ].map((pos) => `
                  <button type="button" data-watermark-pos="${pos.id}" ${isProcessing ? 'disabled' : ''}
                    class="btn-watermark-pos py-2 px-1 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      isProcessing ? 'opacity-50 cursor-not-allowed ' : ''
                    }${
                      watermarkPosition === pos.id
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-zinc-400'
                    }">
                    ${pos.label}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label class="font-semibold text-zinc-700 dark:text-zinc-300">Độ mờ</label>
                <span id="watermarkOpacityLabel" class="font-mono font-bold text-amber-500">${Math.round(watermarkOpacity * 100)}%</span>
              </div>
              <input type="range" id="inputWatermarkOpacity" min="0.1" max="1.0" step="0.05" value="${watermarkOpacity}" ${isProcessing ? 'disabled' : ''}
                class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
            </div>

            <label class="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
              <input type="checkbox" id="chkPdfPageNumbers" ${pageNumbers ? 'checked' : ''} ${isProcessing ? 'disabled' : ''} class="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500 disabled:cursor-not-allowed">
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">Đánh số trang</span>
            </label>
          </div>
        `;

      case 'security':
        return `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-sec-action="lock" ${isProcessing ? 'disabled' : ''}
                class="btn-sec-action py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isProcessing ? 'opacity-50 cursor-not-allowed ' : ''
                }${
                  securityAction === 'lock'
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-zinc-400'
                }">
                <i data-lucide="lock" class="w-3.5 h-3.5"></i> Đặt mật khẩu
              </button>
              <button type="button" data-sec-action="unlock" ${isProcessing ? 'disabled' : ''}
                class="btn-sec-action py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isProcessing ? 'opacity-50 cursor-not-allowed ' : ''
                }${
                  securityAction === 'unlock'
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-xs'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-zinc-400'
                }">
                <i data-lucide="unlock" class="w-3.5 h-3.5"></i> Gỡ mật khẩu
              </button>
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Mật khẩu</label>
              <input type="password" id="inputPdfPassword" value="${password}" placeholder="Nhập mật khẩu..." ${isProcessing ? 'disabled' : ''}
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
            </div>
          </div>
        `;

      case 'organize': {
        const totalOrder = queueState.organizeOrder?.length || (files[0]?.pages || 1);
        const delCount = queueState.organizeDeleted?.size || 0;
        const remaining = Math.max(0, totalOrder - delCount);
        return `
          <div class="space-y-3">
            <div class="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-zinc-500">Trang giữ lại:</span>
                <span class="font-bold text-zinc-900 dark:text-zinc-100 font-mono">${remaining} / ${totalOrder}</span>
              </div>
              ${delCount > 0 ? `
                <div class="flex items-center justify-between text-xs">
                  <span class="text-red-500">Đã loại bỏ:</span>
                  <span class="font-bold text-red-500 font-mono">${delCount} trang</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      case 'pdf_to_docx':
        return `
          <div class="space-y-3">
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Dải trang chuyển đổi (Tùy chọn)</label>
              <input type="text" id="inputPdfDocxPages" value="${pages}" placeholder="Ví dụ: 1-10, 15 (Để trống để chuyển hết)" ${isProcessing ? 'disabled' : ''}
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed">
            </div>
            <div class="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-2 text-zinc-600 dark:text-zinc-400">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> AI Decision Router & Sanitizer
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  ACTIVE
                </span>
              </div>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
                PyMuPDF Diagnostics • Agnes AI Router • DOCX Structural Sanitizer
              </div>
            </div>
          </div>
        `;

      case 'rotate':
      case 'split':
      case 'merge':
      case 'images_to_pdf':
      case 'extract_images':
      case 'view':
      default:
        return '';
    }
  };

  let startDisabled = files.length === 0;
  if (mode === 'merge') {
    startDisabled = startDisabled || files.length < 2;
  } else if (mode === 'images_to_pdf') {
    startDisabled = startDisabled || files.length < 1;
  } else if (mode === 'split') {
    startDisabled = startDisabled || (splitCount === 0 && !pages) || Boolean(splitRangeError);
  } else if (mode === 'organize') {
    const activeRemaining = (queueState.organizeOrder?.length || (files[0]?.pages || 1)) - (queueState.organizeDeleted?.size || 0);
    startDisabled = startDisabled || activeRemaining <= 0;
  } else if (mode === 'security') {
    startDisabled = startDisabled || !password;
  } else if (mode === 'watermark') {
    startDisabled = startDisabled || (!watermarkText.trim() && !pageNumbers);
  }

  const getPrimaryButtonLabel = () => {
    switch (mode) {
      case 'merge':
        return `Ghép ${files.length} tệp PDF`;
      case 'split':
        return splitCount > 0 ? `Tách ${splitCount} trang đã chọn` : 'Tách trang';
      case 'rotate':
        return 'Lưu file xoay';
      case 'organize': {
        const activeRemaining = (queueState.organizeOrder?.length || (files[0]?.pages || 1)) - (queueState.organizeDeleted?.size || 0);
        return `Lưu PDF đã sắp xếp (${activeRemaining} trang)`;
      }
      case 'images_to_pdf':
        return files.length === 1 ? 'Tạo PDF từ 1 ảnh' : `Tạo PDF từ ${files.length} ảnh`;
      case 'pdf_to_docx':
        return 'Chuyển sang Word (.docx)';
      case 'compress': {
        const levelMap = { high: 'Nén cao', medium: 'Cân bằng', low: 'Nén nhẹ' };
        return `Nén PDF (${levelMap[compressionPreset] || 'Cân bằng'})`;
      }
      case 'extract_images':
        return 'Trích xuất toàn bộ ảnh';
      case 'watermark':
        return 'Đóng dấu PDF';
      case 'security':
        return securityAction === 'unlock' ? 'Mở khóa PDF' : 'Khóa mật khẩu PDF';
      case 'view':
        return 'Xem PDF';
      default:
        return 'Bắt đầu';
    }
  };

  const settingsHtml = renderModeSettings().trim();
  const hasSettings = Boolean(settingsHtml);

  const renderActionOrProgress = () => {
    if (isProcessing) {
      return `
        <div class="space-y-2">
          <button id="btnStartProcess" disabled type="button"
            class="w-full py-3 px-4 rounded-xl bg-amber-500/80 text-zinc-950 font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition opacity-75 cursor-not-allowed">
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-zinc-950"></i>
            <span>Đang xử lý (${Math.round(progress || 0)}%)...</span>
          </button>
          <button id="btnCancelPdfProcess" type="button"
            class="w-full py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
            <i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Hủy tác vụ
          </button>
        </div>
      `;
    }

    return `
      <button id="btnStartProcess" ${startDisabled ? 'disabled' : ''} type="button"
        class="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer">
        <i data-lucide="${mode === 'view' ? 'eye' : 'play'}" class="w-4 h-4"></i>
        <span>${getPrimaryButtonLabel()}</span>
      </button>
    `;
  };

  if (!hasSettings) {
    return `
      <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-4 sm:p-5 shadow-xs">
        ${renderActionOrProgress()}
      </div>
    `.trim();
  }

  return `
    <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-4 shadow-xs">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <i data-lucide="sliders-horizontal" class="w-4 h-4 text-amber-500"></i> Cấu hình
      </h3>

      ${settingsHtml}

      <div class="pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
        ${renderActionOrProgress()}
      </div>
    </div>
  `.trim();
}
