/**
 * TextRenderer Component (< 195 lines)
 * High-performance Syntax Highlighted Code & Text Viewer with Sync Line Numbers & Markdown Preview
 */

import { copyText } from '../../../../utilities/clipboard.js';
import { showToast } from '../../../../utilities/toast.js';
import { formatBytes } from '../../../../utilities/formatters.js';
import { parseMarkdownToHtml } from '../../../../utilities/markdownParser.js';

const EXT_LANG_MAP = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python',
  html: 'xml', htm: 'xml', xhtml: 'xml', svg: 'xml', xml: 'xml',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  json: 'json', json5: 'json',
  md: 'markdown', markdown: 'markdown',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp', java: 'java', kt: 'kotlin', kts: 'kotlin',
  rs: 'rust', go: 'go', php: 'php', rb: 'ruby',
  sql: 'sql', yaml: 'yaml', yml: 'yaml',
  ini: 'ini', toml: 'ini', conf: 'ini', env: 'ini',
  diff: 'diff', patch: 'diff', lua: 'lua', r: 'r',
  swift: 'swift', pl: 'perl', pm: 'perl', bat: 'shell', cmd: 'shell', ps1: 'shell'
};

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveLanguage(fileName = '') {
  const base = fileName.split(/[\\/]/).pop()?.toLowerCase() || '';
  if (['dockerfile', 'makefile'].includes(base)) return base;
  if (['.gitignore', '.env', '.dockerignore'].includes(base)) return 'ini';
  const ext = base.split('.').pop() || '';
  return EXT_LANG_MAP[ext] || '';
}

export function renderTextViewer(state) {
  const targetLang = resolveLanguage(state.name || '');
  const badgeLabel = (targetLang || 'text').toUpperCase();
  const isMd = targetLang === 'markdown';

  return `
    <div class="space-y-2.5">
      <!-- Toolbar -->
      <div class="flex items-center justify-between text-xs text-zinc-500">
        <div class="flex items-center gap-2">
          <span id="textLangBadge" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            ${badgeLabel}
          </span>
          <span id="textMetaInfo" class="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Đang tải...</span>
          ${isMd ? `
            <div class="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] text-[11px] font-semibold ml-2">
              <button id="btnMdModeFormatted" type="button" class="px-2 py-0.5 rounded bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs cursor-pointer transition">
                Xem định dạng
              </button>
              <button id="btnMdModeRaw" type="button" class="px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition">
                Mã nguồn
              </button>
            </div>
          ` : ''}
        </div>
        <div class="flex items-center gap-2">
          <button id="btnToggleWrap" type="button" class="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 font-mono transition text-[11px] cursor-pointer">
            Wrap: OFF
          </button>
          <button id="btnCopyTextContent" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 font-semibold transition flex items-center gap-1 cursor-pointer">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép
          </button>
        </div>
      </div>

      <!-- Markdown Formatted Pane (for md files) -->
      ${isMd ? `
        <div id="markdownFormattedPane" class="p-5 rounded-xl bg-white dark:bg-[#0E0E12] border border-zinc-200/80 dark:border-white/[0.06] overflow-auto custom-scrollbar max-h-[68vh] text-zinc-800 dark:text-zinc-200 select-text leading-relaxed">
          Đang kết xuất tài liệu...
        </div>
      ` : ''}

      <!-- Code Box with Synchronized Line Numbers -->
      <div id="textCodeWrapper" class="${isMd ? 'hidden' : ''} relative bg-zinc-50 dark:bg-[#0B0B0D] rounded-xl border border-zinc-200/80 dark:border-white/[0.06] overflow-hidden max-h-[68vh] flex">
        <div id="textLineNumbers" class="py-3 px-2 text-right font-mono text-xs text-zinc-400 dark:text-zinc-600 select-none bg-zinc-100/60 dark:bg-white/[0.02] border-r border-zinc-200/60 dark:border-white/[0.04] min-w-[42px] overflow-hidden leading-relaxed font-normal">
          1
        </div>
        <pre id="textContentPane" class="flex-1 p-3 font-mono text-xs text-zinc-800 dark:text-zinc-200 overflow-auto custom-scrollbar whitespace-pre leading-relaxed select-text outline-hidden"><code id="codeHighlightContent" class="hljs">Đang tải dữ liệu...</code></pre>
      </div>
    </div>
  `;
}

export function attachTextListeners(state, registerCleanup) {
  const abortController = new AbortController();
  if (registerCleanup) registerCleanup(() => abortController.abort());

  const pane = document.getElementById('textContentPane');
  const codeEl = document.getElementById('codeHighlightContent');
  const lineNumbers = document.getElementById('textLineNumbers');
  const metaInfo = document.getElementById('textMetaInfo');
  const langBadge = document.getElementById('textLangBadge');
  const copyBtn = document.getElementById('btnCopyTextContent');
  const wrapBtn = document.getElementById('btnToggleWrap');
  const mdPane = document.getElementById('markdownFormattedPane');
  const codeWrapper = document.getElementById('textCodeWrapper');
  const btnMdFormatted = document.getElementById('btnMdModeFormatted');
  const btnMdRaw = document.getElementById('btnMdModeRaw');

  let rawContent = '';
  let isWrapped = false;
  const targetLang = resolveLanguage(state.name || '');

  // Synchronize vertical scrolling between code pane and line numbers
  if (pane && lineNumbers) {
    const onScroll = () => {
      lineNumbers.scrollTop = pane.scrollTop;
    };
    pane.addEventListener('scroll', onScroll);
    if (registerCleanup) registerCleanup(() => pane.removeEventListener('scroll', onScroll));
  }

  if (btnMdFormatted && btnMdRaw) {
    btnMdFormatted.onclick = () => {
      mdPane?.classList.remove('hidden');
      codeWrapper?.classList.add('hidden');
      btnMdFormatted.className = 'px-2 py-0.5 rounded bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs cursor-pointer transition';
      btnMdRaw.className = 'px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition';
    };
    btnMdRaw.onclick = () => {
      mdPane?.classList.add('hidden');
      codeWrapper?.classList.remove('hidden');
      btnMdRaw.className = 'px-2 py-0.5 rounded bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-xs cursor-pointer transition';
      btnMdFormatted.className = 'px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer transition';
    };
  }

  const getContentPromise = (state.rawFile instanceof Blob)
    ? state.rawFile.text()
    : fetch(state.viewUrl, { signal: abortController.signal }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      });

  getContentPromise
    .then((text) => {
      rawContent = text;
      let highlighted = '';
      let displayLang = targetLang || 'text';

      if (mdPane && targetLang === 'markdown') {
        mdPane.innerHTML = parseMarkdownToHtml(text);
      }

      const hljs = window.hljs;
      if (hljs && text.length <= 500000) {
        try {
          if (targetLang && hljs.getLanguage(targetLang)) {
            highlighted = hljs.highlight(text, { language: targetLang, ignoreIllegals: true }).value;
          } else {
            const autoRes = hljs.highlightAuto(text);
            highlighted = autoRes.value;
            if (autoRes.language) displayLang = autoRes.language;
          }
        } catch {
          highlighted = escapeHtml(text);
        }
      } else {
        highlighted = escapeHtml(text);
      }

      if (codeEl) codeEl.innerHTML = highlighted;

      const lineCount = text.split('\n').length;
      if (lineNumbers) {
        lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, i) => i + 1).join('<br>');
      }
      if (metaInfo) {
        metaInfo.textContent = `${lineCount.toLocaleString()} dòng • ${formatBytes(new Blob([text]).size)}`;
      }
      if (langBadge) {
        langBadge.textContent = displayLang.toUpperCase();
      }
      if (window.lucide) window.lucide.createIcons();
    })
    .catch((err) => {
      if (codeEl) codeEl.textContent = `Không thể đọc nội dung: ${err.message}`;
      if (mdPane) mdPane.textContent = `Lỗi đọc nội dung: ${err.message}`;
      if (metaInfo) metaInfo.textContent = 'Lỗi';
    });

  copyBtn?.addEventListener('click', async () => {
    if (!rawContent) return;
    const ok = await copyText(rawContent);
    showToast(ok ? 'Đã sao chép' : 'Lỗi sao chép', ok ? 'success' : 'error');
  });

  wrapBtn?.addEventListener('click', () => {
    isWrapped = !isWrapped;
    if (pane) {
      pane.classList.toggle('whitespace-pre-wrap', isWrapped);
      pane.classList.toggle('whitespace-pre', !isWrapped);
    }
    if (wrapBtn) wrapBtn.textContent = `Wrap: ${isWrapped ? 'ON' : 'OFF'}`;
  });
}
