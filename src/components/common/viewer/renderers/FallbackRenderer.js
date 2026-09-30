/**
 * FallbackRenderer Component (< 190 lines)
 * Clean developer-style card + 16KB Hex Dump Inspector for binary / unsupported files
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { copyText } from '../../../../utilities/clipboard.js';
import { showToast } from '../../../../utilities/toast.js';

export function renderFallbackViewer(state) {
  const ext = (state.name.split('.').pop() || 'FILE').toUpperCase();

  return `
    <div id="fallbackViewerRoot" class="flex-1 flex flex-col min-h-[350px] max-h-[82vh] relative overflow-hidden bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
      <!-- Header Bar -->
      <div class="px-4 py-2.5 border-b border-zinc-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-zinc-50/80 dark:bg-white/[0.02] shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
            ${ext}
          </span>
          <span class="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">${state.name}</span>
          <span class="text-xs font-mono text-zinc-400">(${formatBytes(state.size || 0)})</span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button id="btnCopyHexDump" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép Hex
          </button>
          <a href="${state.downloadUrl}" download="${state.name}" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về
          </a>
        </div>
      </div>

      <!-- Hex Inspector Notice -->
      <div class="px-4 py-2 bg-amber-500/5 dark:bg-amber-500/10 border-b border-amber-500/20 text-[11px] font-mono text-amber-800 dark:text-amber-300 flex items-center justify-between">
        <span>Không có trình xem trước chuyên dụng. Đang hiển thị Hex Dump (16KB đầu tiên):</span>
        <span id="hexBytesCount" class="font-bold">Đang đọc...</span>
      </div>

      <!-- Hex Dump Viewport -->
      <div id="hexDumpContainer" class="flex-1 overflow-auto custom-scrollbar p-3 sm:p-4 bg-zinc-950 font-mono text-[11px] sm:text-xs text-zinc-300 leading-relaxed select-text">
        <div id="hexDumpContent" class="space-y-0.5 whitespace-pre">Đang tải dữ liệu nhị phân...</div>
      </div>
    </div>
  `;
}

export function attachFallbackListeners(state, registerCleanup) {
  const abortController = new AbortController();
  registerCleanup(() => abortController.abort());

  const dumpEl = document.getElementById('hexDumpContent');
  const countEl = document.getElementById('hexBytesCount');
  const copyBtn = document.getElementById('btnCopyHexDump');

  let rawHexOutput = '';

  function formatHexDump(buffer) {
    const bytes = new Uint8Array(buffer);
    const lines = [];
    const max = Math.min(bytes.length, 16384);

    for (let i = 0; i < max; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(8, '0').toUpperCase();
      
      const hexParts = [];
      const asciiParts = [];

      for (let j = 0; j < 16; j++) {
        if (j < chunk.length) {
          const b = chunk[j];
          hexParts.push(b.toString(16).padStart(2, '0').toUpperCase());
          asciiParts.push((b >= 32 && b <= 126) ? String.fromCharCode(b) : '.');
        } else {
          hexParts.push('  ');
        }
      }

      // Add middle spacer at byte 8
      const hex1 = hexParts.slice(0, 8).join(' ');
      const hex2 = hexParts.slice(8, 16).join(' ');
      const hexStr = `${hex1}  ${hex2}`;
      const asciiStr = asciiParts.join('');

      lines.push(`${offset}  ${hexStr}  |${asciiStr}|`);
    }

    return lines.join('\n');
  }

  async function loadBytes() {
    try {
      let buffer;
      if (state.rawFile instanceof Blob) {
        const slice = state.rawFile.slice(0, 16384);
        buffer = await slice.arrayBuffer();
      } else {
        const res = await fetch(state.viewUrl, {
          headers: { Range: 'bytes=0-16383' },
          signal: abortController.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = await res.arrayBuffer();
      }

      const dump = formatHexDump(buffer);
      rawHexOutput = dump;

      if (dumpEl) dumpEl.textContent = dump;
      if (countEl) countEl.textContent = `${Math.min(buffer.byteLength, 16384)} bytes`;
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (dumpEl) dumpEl.textContent = `Lỗi đọc tệp: ${err.message}`;
      if (countEl) countEl.textContent = 'Lỗi';
    }
  }

  copyBtn?.addEventListener('click', async () => {
    if (!rawHexOutput) return;
    const ok = await copyText(rawHexOutput);
    showToast(ok ? 'Đã sao chép Hex Dump' : 'Lỗi sao chép', ok ? 'success' : 'error');
  });

  loadBytes();
}
