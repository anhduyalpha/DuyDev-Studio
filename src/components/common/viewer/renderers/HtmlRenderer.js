/**
 * HtmlRenderer Component (< 150 lines)
 * Sandboxed HTML/Webpage Previewer with responsive viewport toggles and source view
 */

import { copyText } from '../../../../utilities/clipboard.js';
import { showToast } from '../../../../utilities/toast.js';

export function renderHtmlViewer(state) {
  return `
    <div id="htmlViewerRoot" class="flex-1 flex flex-col min-h-[350px] max-h-[82vh] relative overflow-hidden bg-zinc-100 dark:bg-[#0a0a0d] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
      <!-- Toolbar -->
      <div class="px-4 py-2 border-b border-zinc-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5 bg-white/90 dark:bg-[#121215]/90 backdrop-blur-xs shrink-0 z-10">
        <!-- View Mode Segmented Controls -->
        <div class="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold">
          <button id="btnHtmlModePreview" type="button" class="px-2.5 py-1 rounded-md bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs cursor-pointer transition">
            Trang web
          </button>
          <button id="btnHtmlModeSource" type="button" class="px-2.5 py-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition">
            Mã nguồn
          </button>
        </div>

        <!-- Viewport Size Toggles (Preview Mode only) -->
        <div id="htmlViewportControls" class="flex items-center gap-1 text-xs font-mono">
          <button id="btnVpDesktop" type="button" class="px-2 py-1 rounded-lg bg-zinc-200/80 dark:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[11px] font-bold transition cursor-pointer" title="Desktop 100%">
            100%
          </button>
          <button id="btnVpTablet" type="button" class="px-2 py-1 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/[0.05] text-zinc-600 dark:text-zinc-400 text-[11px] transition cursor-pointer" title="Tablet 768px">
            768px
          </button>
          <button id="btnVpMobile" type="button" class="px-2 py-1 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/[0.05] text-zinc-600 dark:text-zinc-400 text-[11px] transition cursor-pointer" title="Mobile 375px">
            375px
          </button>
        </div>

        <!-- Source Copy Button (Source Mode only) -->
        <button id="btnCopyHtmlSource" type="button" class="hidden px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold items-center gap-1.5 transition cursor-pointer">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép
        </button>
      </div>

      <!-- Preview Viewport -->
      <div id="htmlPreviewContainer" class="flex-1 flex justify-center items-stretch overflow-hidden p-2 sm:p-4">
        <iframe id="htmlIframe" src="${state.viewUrl}" sandbox="allow-same-origin allow-scripts" class="w-full h-full bg-white rounded-lg border border-zinc-200/80 shadow-md transition-all duration-200"></iframe>
      </div>

      <!-- Source Viewport -->
      <div id="htmlSourceContainer" class="flex-1 overflow-auto custom-scrollbar p-3 hidden">
        <pre class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.06] text-zinc-900 dark:text-zinc-100 font-mono text-xs leading-relaxed overflow-auto custom-scrollbar select-text"><code id="htmlSourceCode" class="hljs">Đang tải mã nguồn...</code></pre>
      </div>
    </div>
  `;
}

export function attachHtmlListeners(state, registerCleanup) {
  const abortController = new AbortController();
  registerCleanup(() => abortController.abort());

  const previewContainer = document.getElementById('htmlPreviewContainer');
  const sourceContainer = document.getElementById('htmlSourceContainer');
  const iframe = document.getElementById('htmlIframe');
  const sourceCodeEl = document.getElementById('htmlSourceCode');
  const vpControls = document.getElementById('htmlViewportControls');
  const copyBtn = document.getElementById('btnCopyHtmlSource');

  const btnPreview = document.getElementById('btnHtmlModePreview');
  const btnSource = document.getElementById('btnHtmlModeSource');
  const btnDesktop = document.getElementById('btnVpDesktop');
  const btnTablet = document.getElementById('btnVpTablet');
  const btnMobile = document.getElementById('btnVpMobile');

  let rawSource = '';

  function setMode(mode) {
    const isPrev = mode === 'preview';
    if (previewContainer) previewContainer.classList.toggle('hidden', !isPrev);
    if (sourceContainer) sourceContainer.classList.toggle('hidden', isPrev);
    if (vpControls) vpControls.classList.toggle('hidden', !isPrev);
    if (copyBtn) copyBtn.classList.toggle('hidden', isPrev);

    if (btnPreview) {
      btnPreview.className = isPrev
        ? 'px-2.5 py-1 rounded-md bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs cursor-pointer transition'
        : 'px-2.5 py-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition';
    }
    if (btnSource) {
      btnSource.className = !isPrev
        ? 'px-2.5 py-1 rounded-md bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs cursor-pointer transition'
        : 'px-2.5 py-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition';
    }

    if (!isPrev && !rawSource) {
      const getSourcePromise = (state.rawFile instanceof Blob)
        ? state.rawFile.text()
        : fetch(state.viewUrl, { signal: abortController.signal, credentials: 'same-origin' }).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          });

      getSourcePromise
        .then(t => {
          rawSource = t;
          if (sourceCodeEl) {
            if (window.hljs && t.length <= 500000) {
              try {
                sourceCodeEl.innerHTML = window.hljs.highlight(t, { language: 'xml' }).value;
              } catch {
                sourceCodeEl.textContent = t;
              }
            } else {
              sourceCodeEl.textContent = t;
            }
          }
        })
        .catch(err => {
          if (sourceCodeEl) sourceCodeEl.textContent = `Lỗi đọc mã nguồn: ${err.message}`;
        });
    }
  }

  function setVp(w, activeBtn) {
    if (iframe) iframe.style.width = w;
    [btnDesktop, btnTablet, btnMobile].forEach(b => {
      if (!b) return;
      if (b === activeBtn) {
        b.className = 'px-2 py-1 rounded-lg bg-zinc-200/80 dark:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[11px] font-bold transition cursor-pointer';
      } else {
        b.className = 'px-2 py-1 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/[0.05] text-zinc-600 dark:text-zinc-400 text-[11px] transition cursor-pointer';
      }
    });
  }

  btnPreview?.addEventListener('click', () => setMode('preview'));
  btnSource?.addEventListener('click', () => setMode('source'));

  btnDesktop?.addEventListener('click', () => setVp('100%', btnDesktop));
  btnTablet?.addEventListener('click', () => setVp('768px', btnTablet));
  btnMobile?.addEventListener('click', () => setVp('375px', btnMobile));

  copyBtn?.addEventListener('click', async () => {
    if (!rawSource) return;
    const ok = await copyText(rawSource);
    showToast(ok ? 'Đã sao chép mã HTML' : 'Lỗi sao chép', ok ? 'success' : 'error');
  });
}
