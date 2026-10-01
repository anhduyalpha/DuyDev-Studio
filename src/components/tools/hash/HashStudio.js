/**
 * HashStudio Component
 * Client-side File & Text Checksums (SHA-256, SHA-1, SHA-512) and Base64 Studio.
 */

import { showToast } from '../../../utilities/toast.js';
import { formatBytes } from '../../../utilities/formatters.js';
import { copyText } from '../../../utilities/clipboard.js';
import { renderDropzone, attachDropzoneListeners } from '../../common/Dropzone.js';
import { calculateTextHashes, processHashFile, updateBase64 } from './hooks/useHashActions.js';
import { renderHashCards, renderCompareMatchHtml, bindCopyHashButtons } from './components/HashCards.js';
import { loadModuleState, saveModuleState } from '../../../utilities/moduleState.js';

/**
 * @typedef {Object} HashResultMap
 * @property {string} sha256
 * @property {string} sha1
 * @property {string} sha512
 */

/**
 * @typedef {Object} HashStudioState
 * @property {'file'|'text'|'base64'} activeTab
 * @property {File|null} file
 * @property {HashResultMap|null} fileHashes
 * @property {boolean} isHashing
 * @property {number} hashProgress
 * @property {string} compareHash
 * @property {boolean|null} compareMatch
 * @property {string} textInput
 * @property {HashResultMap|null} textHashes
 * @property {string} base64Input
 * @property {string} base64Output
 * @property {'encode'|'decode'} base64Mode
 */

/** @type {HashStudioState} */
export const hashState = {
  activeTab: 'file',
  file: null,
  fileHashes: null,
  isHashing: false,
  hashProgress: 0,
  compareHash: '',
  compareMatch: null,
  textInput: '',
  textHashes: null,
  base64Input: '',
  base64Output: '',
  base64Mode: 'encode'
};

const savedHash = loadModuleState('hash', null);
if (savedHash) {
  Object.assign(hashState, savedHash);
}

/**
 * Persists the current HashStudio state to local storage.
 */
export const persistHashState = () => saveModuleState('hash', hashState);

/**
 * Renders the Hash & Base64 Studio markup.
 * @returns {string} HTML markup string
 */
export function renderHashStudio() {
  const {
    activeTab,
    file,
    fileHashes,
    isHashing,
    compareHash,
    compareMatch,
    textInput,
    textHashes,
    base64Input,
    base64Output,
    base64Mode
  } = hashState;

  return `
    <div class="space-y-6 animate-fadeIn">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Hệ thống</span>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-600 dark:text-zinc-400 font-medium">Mã Băm & Base64</span>
        </div>
      </div>

      <div class="flex items-center gap-1.5 p-1.5 bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.06] rounded-2xl max-w-md">
        ${[
          { id: 'file', label: 'Tệp tin', icon: 'file-check' },
          { id: 'text', label: 'Văn bản', icon: 'binary' },
          { id: 'base64', label: 'Base64', icon: 'code-2' }
        ]
          .map(
            (t) => `
          <button data-hash-tab="${t.id}" class="btn-hash-tab flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === t.id
                ? 'bg-white dark:bg-white/[0.1] text-zinc-900 dark:text-white shadow-xs border border-zinc-200/60 dark:border-white/10'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }">
            <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
            <span>${t.label}</span>
          </button>
        `
          )
          .join('')}
      </div>

      ${
        activeTab === 'file'
          ? `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 space-y-4">
            ${renderDropzone({
              id: 'hashDropzone',
              title: 'Kéo thả hoặc tải tệp lên',
              subtitle: 'Mọi định dạng tệp',
              accept: '*/*'
            })}
            ${
              file
                ? `
              <div class="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] flex items-center justify-between gap-3 shadow-xs">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                    <i data-lucide="file" class="w-4 h-4"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">${file.name}</p>
                    <p class="text-[11px] font-mono text-zinc-500">${formatBytes(file.size)}</p>
                  </div>
                </div>
                ${
                  isHashing
                    ? '<div class="flex items-center gap-2 text-xs font-mono text-indigo-600 dark:text-indigo-400 animate-pulse"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Đang băm...</div>'
                    : '<span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Xong</span>'
                }
              </div>
            `
                : ''
            }
          </div>

          <div class="lg:col-span-6 space-y-4">
            <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-4 shadow-sm">
              <div class="flex items-center justify-between"><span class="text-xs font-semibold text-zinc-900 dark:text-white">Mã băm checksum</span></div>
              <div id="fileHashResultCards">${renderHashCards(fileHashes)}</div>
              ${
                fileHashes
                  ? `
                <div class="pt-2 border-t border-zinc-100 dark:border-white/[0.06] space-y-2">
                  <span class="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">So sánh mã băm</span>
                  <input type="text" id="inputCompareHash" value="${compareHash}" placeholder="Dán mã băm..." class="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <div id="hashCompareResult">${renderCompareMatchHtml(compareMatch)}</div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      `
          : activeTab === 'text'
          ? `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 space-y-4">
            <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-2 shadow-sm">
              <span class="text-xs font-semibold text-zinc-900 dark:text-white">Dữ liệu đầu vào</span>
              <textarea id="inputHashText" rows="8" placeholder="Nhập văn bản..." class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">${textInput}</textarea>
            </div>
          </div>
          <div class="lg:col-span-6 space-y-4">
            <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-3 shadow-sm">
              <span class="text-xs font-semibold text-zinc-900 dark:text-white">Kết quả mã băm</span>
              <div id="textHashResultCards">${renderHashCards(textHashes)}</div>
            </div>
          </div>
        </div>
      `
          : `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 space-y-4">
            <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-4 shadow-sm">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-zinc-900 dark:text-white">Dữ liệu đầu vào</span>
                <div class="flex items-center gap-2">
                  <button id="btnBase64ModeEncode" class="px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    base64Mode === 'encode'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-400'
                  }">Mã hóa</button>
                  <button id="btnBase64ModeDecode" class="px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    base64Mode === 'decode'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-400'
                  }">Giải mã</button>
                </div>
              </div>
              <textarea id="inputBase64" rows="8" placeholder="${
                base64Mode === 'encode' ? 'Nhập văn bản...' : 'Dán chuỗi Base64...'
              }" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">${base64Input}</textarea>
            </div>
          </div>
          <div class="lg:col-span-6 space-y-4">
            <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 space-y-4 shadow-sm">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-zinc-900 dark:text-white">Kết quả</span>
                <div id="base64CopyWrap">
                  ${
                    base64Output
                      ? '<button id="btnCopyBase64" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"><i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép</button>'
                      : ''
                  }
                </div>
              </div>
              <textarea id="outputBase64" readonly rows="8" placeholder="Kết quả..." class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50/50 dark:bg-[#101014] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none select-all">${base64Output}</textarea>
            </div>
          </div>
        </div>
      `
      }
    </div>
  `.trim();
}

/**
 * Binds the click event to copy Base64 output text.
 */
function bindBase64Copy() {
  const btn = document.getElementById('btnCopyBase64');
  if (btn) {
    btn.onclick = async () => {
      if (hashState.base64Output) {
        const ok = await copyText(hashState.base64Output);
        showToast(ok ? 'Đã sao chép Base64' : 'Không thể sao chép', ok ? 'success' : 'error');
      }
    };
  }
}

/**
 * Synchronizes the Base64 output textarea and the copy button visibility.
 */
function updateBase64Dom() {
  const outEl = document.getElementById('outputBase64');
  if (outEl) {
    outEl.value = hashState.base64Output;
  }

  const wrap = document.getElementById('base64CopyWrap');
  if (wrap) {
    const hasBtn = Boolean(wrap.querySelector('#btnCopyBase64'));
    const wantsBtn = Boolean(hashState.base64Output);

    if (hasBtn !== wantsBtn) {
      if (wantsBtn) {
        wrap.innerHTML =
          '<button id="btnCopyBase64" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"><i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép</button>';
        if (window.lucide) {
          window.lucide.createIcons({ root: wrap });
        }
        bindBase64Copy();
      } else {
        wrap.innerHTML = '';
      }
    }
  }
}

/**
 * Attaches DOM listeners for Hash & Base64 Studio.
 * @param {() => void} [onReRender] - Callback to trigger full re-render on tab change or state update
 * @returns {() => void} Teardown cleanup function
 */
export function attachHashStudioListeners(onReRender) {
  let isTeardown = false;

  document.querySelectorAll('.btn-hash-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isTeardown) return;
      hashState.activeTab = btn.dataset.hashTab;
      persistHashState();
      if (onReRender) onReRender();
    });
  });

  attachDropzoneListeners('hashDropzone', async (files) => {
    if (isTeardown || !files || files.length === 0) return;
    await processHashFile(files[0], hashState, () => {
      if (!isTeardown && onReRender) onReRender();
    });
    if (!isTeardown) {
      persistHashState();
    }
  });

  const compareInput = document.getElementById('inputCompareHash');
  if (compareInput) {
    compareInput.addEventListener('input', (e) => {
      if (isTeardown) return;
      const val = e.target.value.trim().toLowerCase();
      hashState.compareHash = val;

      if (!val || !hashState.fileHashes) {
        hashState.compareMatch = null;
      } else {
        hashState.compareMatch = Object.values(hashState.fileHashes).some(
          (h) => h.toLowerCase() === val
        );
      }

      persistHashState();

      const compRes = document.getElementById('hashCompareResult');
      if (compRes) {
        compRes.innerHTML = renderCompareMatchHtml(hashState.compareMatch);
        if (window.lucide) {
          window.lucide.createIcons({ root: compRes });
        }
      }
    });
  }

  bindCopyHashButtons(document);

  const textInput = document.getElementById('inputHashText');
  let textHashSeq = 0;
  if (textInput) {
    textInput.addEventListener('input', async (e) => {
      if (isTeardown) return;
      const val = e.target.value;
      hashState.textInput = val;
      const seq = ++textHashSeq;

      const hashes = val ? await calculateTextHashes(val) : null;
      if (isTeardown || seq !== textHashSeq) return;

      hashState.textHashes = hashes;
      persistHashState();

      const cardsEl = document.getElementById('textHashResultCards');
      if (cardsEl) {
        cardsEl.innerHTML = renderHashCards(hashState.textHashes);
        bindCopyHashButtons(cardsEl);
        if (window.lucide) {
          window.lucide.createIcons({ root: cardsEl });
        }
      }
    });
  }

  const btnEncode = document.getElementById('btnBase64ModeEncode');
  const btnDecode = document.getElementById('btnBase64ModeDecode');
  const base64In = document.getElementById('inputBase64');

  if (btnEncode && btnDecode && base64In) {
    const activeClass =
      'px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer bg-zinc-900 text-white dark:bg-white dark:text-zinc-950';
    const inactiveClass =
      'px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer bg-zinc-100 text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-400';

    const switchMode = (mode) => {
      if (isTeardown) return;
      hashState.base64Mode = mode;

      if (mode === 'encode') {
        btnEncode.className = activeClass;
        btnDecode.className = inactiveClass;
        base64In.placeholder = 'Nhập văn bản...';
      } else {
        btnEncode.className = inactiveClass;
        btnDecode.className = activeClass;
        base64In.placeholder = 'Dán chuỗi Base64...';
      }

      updateBase64(hashState);
      persistHashState();
      updateBase64Dom();
    };

    btnEncode.onclick = () => switchMode('encode');
    btnDecode.onclick = () => switchMode('decode');
  }

  if (base64In) {
    base64In.addEventListener('input', (e) => {
      if (isTeardown) return;
      hashState.base64Input = e.target.value;
      updateBase64(hashState);
      persistHashState();
      updateBase64Dom();
    });
  }

  bindBase64Copy();

  return () => {
    isTeardown = true;
  };
}
