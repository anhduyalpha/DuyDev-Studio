/**
 * ViewSplitPixelInspector.js - Floating Glass HUD Loupe Component
 * Magnified 9x9 pixel grid loupe with sharp pixel boundaries, live coordinates (X, Y),
 * RGB channels, HEX color code, color swatch preview, and 1-click clipboard copy.
 */

import { PANE_TITLES } from '../hooks/useViewSplit.js';

/**
 * Renders Pixel Inspector HUD markup.
 * @param {Object} state
 * @returns {string}
 */
export function renderViewSplitPixelInspector(state) {
  const { inspectorOpen, pixelInspectorState } = state;
  if (!inspectorOpen) {
    return `
      <!-- Collapsed Mini HUD Button -->
      <button
        type="button"
        data-action="toggle-inspector"
        title="Mở HUD Kính lúp soi điểm ảnh (I)"
        class="fixed bottom-4 right-4 z-40 p-2.5 rounded-2xl bg-black/80 hover:bg-black backdrop-blur-xl border border-white/15 text-cyan-400 shadow-2xl transition hover:scale-105 cursor-pointer flex items-center gap-2"
      >
        <i data-lucide="zoom-in" class="w-4 h-4"></i>
        <span class="text-xs font-semibold text-white">Loupe</span>
      </button>
    `;
  }

  const {
    paneId,
    x,
    y,
    r,
    g,
    b,
    a,
    hex,
    isValid
  } = pixelInspectorState;

  const paneTitle = PANE_TITLES[paneId - 1] || `Ảnh ${paneId}`;

  return `
    <div
      id="viewsplit-pixel-inspector-hud"
      class="fixed bottom-4 right-4 z-40 w-[290px] sm:w-[320px] rounded-2xl bg-zinc-950/90 dark:bg-black/85 backdrop-blur-2xl border border-white/15 shadow-2xl p-3 text-zinc-100 select-none animate-fadeIn"
    >
      <!-- HUD Header (Draggable Handle) -->
      <div
        id="viewsplit-inspector-header"
        class="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs cursor-move select-none"
      >
        <div class="flex items-center gap-1.5 font-bold tracking-tight text-white pointer-events-none">
          <i data-lucide="zoom-in" class="w-3.5 h-3.5 text-cyan-400"></i>
          <span>Pixel Inspector</span>
          <span id="viewsplit-inspector-pane-title" class="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300 font-mono">${paneTitle}</span>
        </div>
        <button
          type="button"
          data-action="toggle-inspector"
          title="Thu nhỏ HUD (I)"
          class="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <!-- Main Body: 9x9 Loupe on left, Telemetry on right -->
      <div class="flex items-center gap-3">
        <!-- 9x9 Loupe Canvas Container -->
        <div class="relative w-[90px] h-[90px] rounded-xl overflow-hidden bg-black border border-white/20 shrink-0 shadow-inner flex items-center justify-center">
          <canvas
            id="viewsplit-loupe-canvas"
            width="90"
            height="90"
            class="w-full h-full block"
          ></canvas>
          <span
            id="viewsplit-inspector-no-pixel"
            class="absolute text-[10px] text-zinc-500 font-mono pointer-events-none"
            style="display: ${isValid ? 'none' : 'block'};"
          >No Pixel</span>
        </div>

        <!-- Telemetry Data -->
        <div class="flex-1 min-w-0 flex flex-col gap-1 font-mono text-[11px]">
          <!-- Coordinates (X, Y) -->
          <div class="flex items-center justify-between text-zinc-300">
            <span class="text-zinc-500 text-[10px] uppercase font-sans">Toạ độ</span>
            <span id="viewsplit-inspector-coords" class="font-bold text-white">${isValid ? `X:${x} Y:${y}` : '--, --'}</span>
          </div>

          <!-- RGB & Alpha Channels -->
          <div class="flex items-center justify-between text-zinc-300">
            <span class="text-zinc-500 text-[10px] uppercase font-sans">RGB</span>
            <span id="viewsplit-inspector-rgb" class="text-zinc-200">${isValid ? `${r}, ${g}, ${b}` : '--, --, --'}</span>
          </div>

          <!-- Alpha -->
          <div class="flex items-center justify-between text-zinc-400 text-[10px]">
            <span class="text-zinc-500 uppercase font-sans">Alpha</span>
            <span id="viewsplit-inspector-alpha">${isValid ? `${a} (${Math.round((a / 255) * 100)}%)` : '--'}</span>
          </div>

          <!-- HEX & Swatch & 1-Click Copy -->
          <div class="flex items-center justify-between mt-1 pt-1.5 border-t border-white/10">
            <div class="flex items-center gap-1.5">
              <!-- Color Swatch Preview -->
              <div
                id="viewsplit-inspector-swatch"
                class="w-4 h-4 rounded-md border border-white/30 shadow-sm shrink-0"
                style="background-color: ${isValid ? `rgba(${r},${g},${b},${a / 255})` : 'transparent'};"
                title="${isValid ? hex : 'Chưa có mẫu màu'}"
              ></div>
              <span id="viewsplit-inspector-hex" class="font-bold text-cyan-400 text-xs">${isValid ? hex : '------'}</span>
            </div>

            <!-- 1-Click Copy Button -->
            <button
              type="button"
              id="viewsplit-inspector-copy-btn"
              data-action="copy-hex"
              data-hex="${isValid ? hex : ''}"
              title="Sao chép mã HEX"
              ${!isValid ? 'disabled' : ''}
              class="px-2 py-1 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 border border-white/10 text-[10px] font-sans font-medium transition cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i data-lucide="copy" class="w-3 h-3"></i>
              <span>Copy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Updates DOM telemetry values directly in 0ms without re-rendering the whole page.
 * @param {Object} state
 * @param {string} [activePaneTitle]
 */
export function updatePixelInspectorHud(state, activePaneTitle = '') {
  if (!state) return;
  const { x, y, r, g, b, a, hex, isValid } = state;

  const titleEl = document.getElementById('viewsplit-inspector-pane-title');
  if (titleEl && activePaneTitle) {
    titleEl.textContent = activePaneTitle;
  }
  const coordsEl = document.getElementById('viewsplit-inspector-coords');
  if (coordsEl) {
    coordsEl.textContent = isValid ? `X:${x} Y:${y}` : '--, --';
  }
  const rgbEl = document.getElementById('viewsplit-inspector-rgb');
  if (rgbEl) {
    rgbEl.textContent = isValid ? `${r}, ${g}, ${b}` : '--, --, --';
  }
  const alphaEl = document.getElementById('viewsplit-inspector-alpha');
  if (alphaEl) {
    alphaEl.textContent = isValid ? `${a} (${Math.round((a / 255) * 100)}%)` : '--';
  }
  const swatchEl = document.getElementById('viewsplit-inspector-swatch');
  if (swatchEl) {
    swatchEl.style.backgroundColor = isValid ? `rgba(${r},${g},${b},${a / 255})` : 'transparent';
    swatchEl.title = isValid ? hex : 'Chưa có mẫu màu';
  }
  const hexEl = document.getElementById('viewsplit-inspector-hex');
  if (hexEl) {
    hexEl.textContent = isValid ? hex : '------';
  }
  const copyBtn = document.getElementById('viewsplit-inspector-copy-btn');
  if (copyBtn) {
    copyBtn.dataset.hex = isValid ? hex : '';
    copyBtn.disabled = !isValid;
  }
  const noPixelEl = document.getElementById('viewsplit-inspector-no-pixel');
  if (noPixelEl) {
    noPixelEl.style.display = isValid ? 'none' : 'block';
  }
}

/**
 * Draws the magnified 9x9 pixel grid onto the loupe canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<Object>} neighborhood - 81 cell objects from extract9x9Neighborhood
 */
export function drawLoupe(canvas, neighborhood) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!neighborhood || neighborhood.length !== 81) {
    ctx.fillStyle = '#121215';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const cellSize = w / 9;

  for (let i = 0; i < 81; i++) {
    const cell = neighborhood[i];
    const gridX = (i % 9) * cellSize;
    const gridY = Math.floor(i / 9) * cellSize;

    if (cell.isValid) {
      ctx.fillStyle = `rgba(${cell.r}, ${cell.g}, ${cell.b}, ${cell.a / 255})`;
      ctx.fillRect(gridX, gridY, cellSize, cellSize);
    } else {
      // Checkerboard for out-of-bounds or transparency
      ctx.fillStyle = (Math.floor(i / 9) + (i % 9)) % 2 === 0 ? '#18181B' : '#09090B';
      ctx.fillRect(gridX, gridY, cellSize, cellSize);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(gridX, gridY, cellSize, cellSize);
  }

  // Highlight Center Cell (Index 40 = Row 4, Col 4)
  const centerGridX = 4 * cellSize;
  const centerGridY = 4 * cellSize;

  // Sharp outer border
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(centerGridX + 0.5, centerGridY + 0.5, cellSize - 1, cellSize - 1);

  // Subtle inner shadow / dark edge
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(centerGridX + 1.5, centerGridY + 1.5, cellSize - 3, cellSize - 3);
}
