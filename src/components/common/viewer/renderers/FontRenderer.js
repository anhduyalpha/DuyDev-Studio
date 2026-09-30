/**
 * FontRenderer Component (< 150 lines)
 * Interactive Typography Specimen & Glyph Inspector for .ttf, .otf, .woff, .woff2
 */

import { formatBytes } from '../../../../utilities/formatters.js';

let fontCounter = 0;

export function renderFontViewer(state) {
  const ext = (state.name.split('.').pop() || 'FONT').toUpperCase();
  return `
    <div id="fontViewerRoot" class="flex-1 flex flex-col min-h-[350px] max-h-[82vh] relative overflow-hidden bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
      <!-- Toolbar -->
      <div class="px-4 py-2.5 border-b border-zinc-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-zinc-50/80 dark:bg-white/[0.02] shrink-0">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            ${ext}
          </span>
          <span class="text-xs font-mono text-zinc-500 dark:text-zinc-400">${state.size > 0 ? formatBytes(state.size) : 'Phông chữ'}</span>
        </div>

        <div class="flex items-center gap-2 flex-1 max-w-md ml-auto">
          <input id="inputFontSample" type="text" value="The quick brown fox jumps over the lazy dog" placeholder="Nhập văn bản mẫu..." class="w-full px-3 py-1 text-xs rounded-lg bg-white dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:border-violet-500 transition" />
        </div>
      </div>

      <!-- Scrollable Waterfall & Glyphs Area -->
      <div class="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6 space-y-6">
        <!-- Typography Waterfall -->
        <div id="fontWaterfallContainer" class="space-y-4"></div>

        <!-- Glyph Grid -->
        <div class="space-y-2 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
          <h5 class="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Ký tự mẫu (Glyphs)</h5>
          <div id="fontGlyphGrid" class="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/[0.04]"></div>
        </div>
      </div>
    </div>
  `;
}

export function attachFontListeners(state, registerCleanup) {
  const fontId = `CustomFont_${++fontCounter}`;
  const ext = (state.name?.split('.').pop() || '').toLowerCase();
  const formatMap = {
    woff2: "format('woff2')",
    woff: "format('woff')",
    otf: "format('opentype')",
    ttf: "format('truetype')"
  };
  const formatHint = formatMap[ext] || '';

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @font-face {
      font-family: '${fontId}';
      src: url('${state.viewUrl}') ${formatHint};
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(styleEl);
  registerCleanup(() => styleEl.remove());

  const sampleInput = document.getElementById('inputFontSample');
  const waterfall = document.getElementById('fontWaterfallContainer');
  const glyphGrid = document.getElementById('fontGlyphGrid');

  const sizes = [12, 16, 20, 28, 36, 48, 64];

  function updateWaterfall(text) {
    if (!waterfall) return;
    const displayText = text.trim() || 'The quick brown fox jumps over the lazy dog';
    waterfall.innerHTML = sizes.map(sz => `
      <div class="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-3 border-b border-zinc-100 dark:border-white/[0.04]">
        <span class="w-12 font-mono text-[11px] text-zinc-400 shrink-0">${sz}px</span>
        <div style="font-family: '${fontId}', sans-serif; font-size: ${sz}px; line-height: 1.25;" class="text-zinc-900 dark:text-zinc-100 break-words flex-1">
          ${displayText}
        </div>
      </div>
    `).join('');
  }

  function renderGlyphs() {
    if (!glyphGrid) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    glyphGrid.innerHTML = chars.split('').map(ch => `
      <div style="font-family: '${fontId}', sans-serif;" class="h-8 flex items-center justify-center rounded bg-white dark:bg-white/[0.05] border border-zinc-200/50 dark:border-white/[0.05] text-sm text-zinc-800 dark:text-zinc-200 hover:border-violet-500 hover:scale-110 transition cursor-default" title="${ch}">
        ${ch}
      </div>
    `).join('');
  }

  updateWaterfall(sampleInput?.value || '');
  renderGlyphs();

  sampleInput?.addEventListener('input', (e) => {
    updateWaterfall(e.target.value);
  });
}
