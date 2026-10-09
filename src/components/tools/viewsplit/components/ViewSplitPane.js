/**
 * ViewSplitPane.js - Individual Viewport Pane Component
 * Renders HTML5 Canvas, floating status overlay (dimensions, zoom factor),
 * active state rings, and dropzone ingestion fallback.
 */

import { formatBytes } from '../../../../utilities/formatters.js';

/**
 * Renders single Viewport Pane markup.
 * @param {Object} pane
 * @param {boolean} isActive
 * @param {string} filter
 * @returns {string}
 */
export function renderViewSplitPane(pane, isActive = false, filter = 'bilinear') {
  const hasImage = Boolean(pane.image);
  const zoomPercent = Math.round(pane.zoom * 100);

  return `
    <div
      class="viewsplit-pane group relative flex-1 min-w-0 min-h-[280px] h-full rounded-2xl overflow-hidden bg-zinc-950 border transition-all select-none ${
        isActive
          ? 'border-cyan-500/60 ring-2 ring-cyan-500/20 shadow-lg'
          : 'border-zinc-200/80 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
      }"
      data-pane-id="${pane.id}"
      tabindex="0"
    >
      <!-- Canvas Layer -->
      <canvas
        class="viewsplit-canvas absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing ${
          filter === 'nearest' ? 'image-pixelated' : ''
        }"
        data-pane-id="${pane.id}"
        style="${filter === 'nearest' ? 'image-rendering: pixelated;' : ''}"
      ></canvas>

      <!-- Top Overlay Bar (Floating HUD) -->
      <div class="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2 pointer-events-none z-10">
        <!-- Pane Identifier & File Name -->
        <div class="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 dark:bg-black/75 backdrop-blur-md border border-white/10 text-xs shadow-sm">
          <span class="w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-400'}"></span>
          <span class="font-bold text-white tracking-wide">${pane.title}</span>
          ${
            hasImage
              ? `<span class="text-zinc-400 truncate max-w-[120px] sm:max-w-[160px] hidden sm:inline" title="${pane.name}">${pane.name}</span>`
              : ''
          }
        </div>

        <!-- Right: Resolution & Zoom Badge & Actions -->
        <div class="pointer-events-auto flex items-center gap-1.5">
          ${
            hasImage
              ? `
                <div class="flex items-center gap-1 px-2 py-1 rounded-xl bg-black/60 dark:bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-mono text-zinc-300 shadow-sm">
                  <span>${pane.width}×${pane.height}</span>
                  <span class="text-zinc-500">•</span>
                  <span id="viewsplit-zoom-badge-${pane.id}" class="text-cyan-400 font-semibold">${zoomPercent}%</span>
                </div>
                <button
                  type="button"
                  data-action="open-url-modal"
                  data-pane-id="${pane.id}"
                  title="Thay đổi ảnh từ URL / Drive"
                  class="p-1 rounded-lg bg-black/60 hover:bg-black/80 text-zinc-400 hover:text-white border border-white/10 transition cursor-pointer"
                >
                  <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                </button>
                <button
                  type="button"
                  data-action="clear-pane"
                  data-pane-id="${pane.id}"
                  title="Đóng / Gỡ bỏ ảnh này"
                  class="p-1 rounded-lg bg-black/60 hover:bg-red-500/30 text-zinc-400 hover:text-red-400 border border-white/10 transition cursor-pointer"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              `
              : ''
          }
        </div>
      </div>

      <!-- Empty Dropzone State (Visible when no image loaded) -->
      ${
        !hasImage
          ? `
            <div class="viewsplit-dropzone absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/30 backdrop-blur-sm z-0">
              <input
                type="file"
                accept="image/*"
                class="viewsplit-file-input hidden"
                data-pane-id="${pane.id}"
              />
              <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <i data-lucide="image-plus" class="w-6 h-6"></i>
              </div>
              <h4 class="text-sm font-semibold text-zinc-200 mb-1">Nạp ảnh cho ${pane.title}</h4>
              <p class="text-xs text-zinc-400 max-w-xs mb-4">Kéo thả tệp tin ảnh, dán trực tiếp từ Clipboard hoặc tải từ liên kết.</p>

              <div class="flex items-center flex-wrap justify-center gap-2">
                <button
                  type="button"
                  data-action="pick-file"
                  data-pane-id="${pane.id}"
                  class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                  <span>Chọn tệp</span>
                </button>
                <button
                  type="button"
                  data-action="paste-clipboard"
                  data-pane-id="${pane.id}"
                  class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium border border-white/10 transition cursor-pointer flex items-center gap-1.5"
                >
                  <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                  <span>Dán ảnh</span>
                </button>
                <button
                  type="button"
                  data-action="open-url-modal"
                  data-pane-id="${pane.id}"
                  class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium border border-white/10 transition cursor-pointer flex items-center gap-1.5"
                >
                  <i data-lucide="link-2" class="w-3.5 h-3.5"></i>
                  <span>URL / Drive</span>
                </button>
              </div>
            </div>
          `
          : ''
      }
    </div>
  `;
}
