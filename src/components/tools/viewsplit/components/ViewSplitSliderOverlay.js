/**
 * ViewSplitSliderOverlay.js - Superimposed Comparison Workspace
 * Handles Interactive Split Slider Wipe (Before/After) and Difference Diff Heatmap.
 */

import { LAYOUT_MODES } from '../hooks/useViewSplit.js';

/**
 * Renders Slider Wipe / Difference Diff overlay container markup.
 * @param {Object} state
 * @returns {string}
 */
export function renderViewSplitSliderOverlay(state) {
  const {
    layout,
    panes,
    sliderPos,
    diffMultiplier,
    filter
  } = state;

  const isDiffMode = layout === LAYOUT_MODES.DIFF;
  const paneA = panes[0];
  const paneB = panes[1];
  const hasA = Boolean(paneA.image);
  const hasB = Boolean(paneB.image);
  const isReady = hasA && hasB;

  return `
    <div class="viewsplit-overlay-container relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-lg select-none">
      <!-- Underlying Composite Canvas -->
      <canvas
        id="viewsplit-overlay-canvas"
        class="absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing select-none"
        style="${filter === 'nearest' ? 'image-rendering: pixelated;' : ''}"
      ></canvas>

      <!-- Top Overlay Header -->
      <div class="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none z-20">
        <!-- Mode Badge & Image Labels -->
        <div class="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs shadow-md">
          <span class="w-2.5 h-2.5 rounded-full ${isDiffMode ? 'bg-rose-500 animate-pulse' : 'bg-cyan-400'}"></span>
          <span class="font-bold text-white uppercase tracking-wider text-[11px]">
            ${isDiffMode ? 'Difference Diff' : 'Slider Wipe'}
          </span>
          <span class="text-zinc-500">•</span>
          <span class="text-zinc-300 font-medium">${paneA.title}</span>
          <span class="text-zinc-500">vs</span>
          <span class="text-zinc-300 font-medium">${paneB.title}</span>
        </div>

        <!-- Controls: Swap Images & Diff Multiplier -->
        <div class="pointer-events-auto flex items-center gap-1.5">
          ${
            isDiffMode
              ? `
                <!-- Diff Multiplier Picker -->
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs text-zinc-300 shadow-md">
                  <span class="text-[11px] text-zinc-400">Độ lệch:</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value="${diffMultiplier}"
                    data-action="set-diff-multiplier"
                    class="w-20 accent-rose-500 cursor-pointer"
                    title="Khuếch đại sai khác: ${diffMultiplier}x"
                  />
                  <span class="font-mono text-rose-400 font-bold text-[11px]">${diffMultiplier}x</span>
                </div>
              `
              : `
                <!-- Slider Percentage Badge -->
                <div class="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-400 font-semibold shadow-md">
                  ${Math.round(sliderPos * 100)}%
                </div>
              `
          }

          <!-- Swap Pane A & B -->
          <button
            type="button"
            data-action="swap-overlay-panes"
            title="Đảo vị trí Trước / Sau (Pane A ⇄ Pane B)"
            class="px-2.5 py-1 rounded-xl bg-black/70 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition cursor-pointer flex items-center gap-1 shadow-md"
          >
            <i data-lucide="arrow-left-right" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Đảo ảnh</span>
          </button>
        </div>
      </div>

      <!-- Wipe Divider Line & Drag Handle (Visible only in Slider Wipe mode when both images loaded) -->
      ${
        !isDiffMode && isReady
          ? `
            <div
              id="viewsplit-slider-divider"
              class="absolute top-0 bottom-0 pointer-events-auto z-10 cursor-ew-resize flex items-center justify-center -translate-x-1/2"
              style="left: ${sliderPos * 100}%; width: 32px;"
            >
              <!-- Center White Line -->
              <div class="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none"></div>

              <!-- Center Pill Handle -->
              <div class="relative w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border-2 border-white shadow-xl flex items-center justify-center text-zinc-900 dark:text-white text-xs font-bold transition-transform hover:scale-110 active:scale-95">
                <i data-lucide="chevrons-left-right" class="w-4 h-4 text-cyan-500"></i>
              </div>
            </div>
          `
          : ''
      }

      <!-- Corner Labels for Before & After -->
      ${
        !isDiffMode && isReady
          ? `
            <div class="absolute bottom-3 left-3 pointer-events-none z-10 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-bold text-white shadow-sm">
              BEFORE (${paneA.title})
            </div>
            <div class="absolute bottom-3 right-3 pointer-events-none z-10 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-bold text-cyan-400 shadow-sm">
              AFTER (${paneB.title})
            </div>
          `
          : ''
      }

      <!-- Empty / Missing Image Ingestion Cards -->
      ${
        !isReady
          ? `
            <div class="absolute inset-0 z-0 flex flex-col md:flex-row items-center justify-center gap-4 p-6 bg-zinc-950/80 backdrop-blur-md">
              <!-- Slot A Card -->
              <div class="flex-1 max-w-sm w-full p-5 rounded-2xl bg-zinc-900/60 border border-white/10 text-center flex flex-col items-center">
                <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-2">
                  <i data-lucide="image" class="w-5 h-5"></i>
                </div>
                <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-1">Ảnh Gốc (Before - ${paneA.title})</h4>
                <p class="text-[11px] text-zinc-400 mb-3">${hasA ? paneA.name : 'Chưa chọn ảnh'}</p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    data-action="pick-file"
                    data-pane-id="1"
                    class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    ${hasA ? 'Đổi ảnh' : 'Chọn tệp'}
                  </button>
                  <button
                    type="button"
                    data-action="open-url-modal"
                    data-pane-id="1"
                    class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    URL / Drive
                  </button>
                </div>
              </div>

              <!-- Slot B Card -->
              <div class="flex-1 max-w-sm w-full p-5 rounded-2xl bg-zinc-900/60 border border-white/10 text-center flex flex-col items-center">
                <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-2">
                  <i data-lucide="image" class="w-5 h-5"></i>
                </div>
                <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-1">Ảnh Đích (After - ${paneB.title})</h4>
                <p class="text-[11px] text-zinc-400 mb-3">${hasB ? paneB.name : 'Chưa chọn ảnh'}</p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    data-action="pick-file"
                    data-pane-id="2"
                    class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    ${hasB ? 'Đổi ảnh' : 'Chọn tệp'}
                  </button>
                  <button
                    type="button"
                    data-action="open-url-modal"
                    data-pane-id="2"
                    class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-medium border border-white/10 cursor-pointer"
                  >
                    URL / Drive
                  </button>
                </div>
              </div>
            </div>
          `
          : ''
      }
    </div>
  `;
}
