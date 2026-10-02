/**
 * ConverterOptions Component
 * Format-specific options, batch rename rules, and conversion trigger.
 */

export function renderConverterOptions(state) {
  const { targetFormat = 'webp', options = {}, isConverting, selectedCategory = 'image', renamePattern = {}, items = [] } = state;
  const isImage = selectedCategory === 'image';
  const isVideo = selectedCategory === 'video';
  const isAudio = selectedCategory === 'audio';
  const isDoc = selectedCategory === 'document';

  const pendingCount = items.filter(it => it.status === 'ready' || it.status === 'idle' || it.status === 'retry').length;
  const isDisabled = pendingCount === 0 || isConverting;

  let summarySubtitle = 'Mặc định';
  if (isImage) {
    summarySubtitle = `Chất lượng nén ${options.quality || 80}%`;
  } else if (isVideo) {
    summarySubtitle = `${options.resolution || 'Gốc'} • ${options.fps || 'Gốc'} FPS`;
  } else if (isAudio) {
    summarySubtitle = `${options.bitrate || '320k'}`;
  } else if (isDoc) {
    summarySubtitle = options.ocr ? 'Nhận dạng OCR' : 'Mặc định';
  }

  return `
    <div class="space-y-3.5">
      <!-- 1. Collapsible Options Dropbox / Accordion (Default closed) -->
      <details id="converterOptionsDisclosure" class="group/options rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] shadow-sm overflow-hidden text-xs">
        <summary class="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <i data-lucide="sliders" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Tùy chọn chuyển đổi</span>
                <span id="badgeCurrentTargetFormat" class="px-2 py-0.5 text-[10px] font-mono rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold uppercase">
                  ${targetFormat}
                </span>
              </div>
              <p id="labelOptionsSummarySubtitle" class="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate">${summarySubtitle}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200 group-open/options:rotate-180 text-zinc-400"></i>
          </div>
        </summary>

        <div class="p-4 sm:p-5 pt-2 border-t border-zinc-100 dark:border-white/[0.06] space-y-4">
          <!-- 1. Image Options Section -->
          <div id="optionsSection_image" class="converter-opt-section ${isImage ? '' : 'hidden'} space-y-3">
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <label for="inputQualityRange" class="font-medium text-zinc-700 dark:text-zinc-300">Chất lượng nén</label>
                <span id="badgeQualityValue" class="font-mono font-bold text-indigo-600 dark:text-indigo-400">${options.quality || 80}%</span>
              </div>
              <input type="range" id="inputQualityRange" min="10" max="100" value="${options.quality || 80}" class="w-full accent-indigo-600 dark:accent-indigo-400 h-1.5 bg-zinc-200 dark:bg-white/[0.1] rounded-lg cursor-pointer">
              <div class="flex justify-between text-[10px] text-zinc-400 font-mono"><span>10%</span><span>80%</span><span>100%</span></div>
            </div>
            <div class="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chiều rộng</label>
                <input type="number" id="inputImageWidth" placeholder="Tự động" value="${options.width || ''}" class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white font-mono">
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chiều cao</label>
                <input type="number" id="inputImageHeight" placeholder="Tự động" value="${options.height || ''}" class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white font-mono">
              </div>
            </div>
          </div>

          <!-- 2. Video Options Section -->
          <div id="optionsSection_video" class="converter-opt-section ${isVideo ? '' : 'hidden'} space-y-3">
            <div>
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Độ phân giải</label>
              <select id="selectVideoRes" class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white">
                <option value="original" ${options.resolution === 'original' ? 'selected' : ''}>Gốc</option>
                <option value="1080p" ${options.resolution === '1080p' ? 'selected' : ''}>1080p</option>
                <option value="720p" ${options.resolution === '720p' ? 'selected' : ''}>720p</option>
                <option value="480p" ${options.resolution === '480p' ? 'selected' : ''}>480p</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Khung hình</label>
              <select id="selectVideoFps" class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white">
                <option value="original" ${options.fps === 'original' ? 'selected' : ''}>Gốc</option>
                <option value="30" ${options.fps === '30' ? 'selected' : ''}>30 FPS</option>
                <option value="60" ${options.fps === '60' ? 'selected' : ''}>60 FPS</option>
              </select>
            </div>
          </div>

          <!-- 3. Audio Options Section -->
          <div id="optionsSection_audio" class="converter-opt-section ${isAudio ? '' : 'hidden'} space-y-3">
            <div>
              <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Bitrate</label>
              <select id="selectAudioBitrate" class="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white font-mono">
                <option value="320k" ${options.bitrate === '320k' ? 'selected' : ''}>320 kbps</option>
                <option value="192k" ${options.bitrate === '192k' ? 'selected' : ''}>192 kbps</option>
                <option value="128k" ${options.bitrate === '128k' ? 'selected' : ''}>128 kbps</option>
              </select>
            </div>
          </div>

          <!-- 4. Document Options Section -->
          <div id="optionsSection_document" class="converter-opt-section ${isDoc ? '' : 'hidden'} space-y-3">
            <label class="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.08] cursor-pointer">
              <input type="checkbox" id="checkOcrFeature" ${options.ocr ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500">
              <span class="text-xs font-medium text-zinc-900 dark:text-white">Nhận dạng chữ OCR</span>
            </label>
          </div>

          <!-- 5. Batch Rename Options Section -->
          <div class="pt-2 border-t border-zinc-100 dark:border-white/[0.06] space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-indigo-500"></i> Đổi tên hàng loạt
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] text-zinc-500 mb-1">Tiền tố</label>
                <input type="text" id="inputRenamePrefix" placeholder="VD: img_" value="${renamePattern.prefix || ''}" class="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white font-mono">
              </div>
              <div>
                <label class="block text-[11px] text-zinc-500 mb-1">Hậu tố</label>
                <input type="text" id="inputRenameSuffix" placeholder="VD: _converted" value="${renamePattern.suffix || ''}" class="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white font-mono">
              </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" id="checkRenameNumbering" ${renamePattern.numbering ? 'checked' : ''} class="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500">
              <span class="text-xs text-zinc-600 dark:text-zinc-400">Đánh số thứ tự</span>
            </label>
          </div>
        </div>
      </details>

      <!-- 2. Primary Action Hero Button (Always prominent) -->
      <button id="btnStartConversion" type="button" ${isDisabled ? 'disabled' : ''}
        class="w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-200 select-none ${
          isDisabled
            ? 'bg-zinc-100 dark:bg-white/[0.05] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-white/[0.06] cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-[0.98] cursor-pointer'
        }">
        <span id="btnStartConversionIcon">
          ${isConverting
            ? '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>'
            : '<i data-lucide="zap" class="w-5 h-5 fill-current"></i>'}
        </span>
        <span id="btnStartConversionText">
          ${isConverting ? 'Đang chuyển đổi theo lô...' : pendingCount > 0 ? `Chuyển đổi ${pendingCount} tệp tin` : 'Chọn tệp để chuyển đổi'}
        </span>
      </button>
    </div>
  `.trim();
}
