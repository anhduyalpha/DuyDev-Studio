/**
 * @module ShareTargetModal
 * Smart Share Dispatch Modal — receives payloads from Web Share Target API,
 * displays preview + recommended tool actions, dispatches data to selected module.
 */

import { classifySharedPayload, SharePayloadType } from '../../utilities/shareTargetHelper.js';
import { formatBytes } from '../../utilities/formatters.js';

/** @type {(() => void)|null} */
let cleanupFn = null;

const TYPE_LABELS = {
  [SharePayloadType.STUDOCU_URL]: 'Tài liệu Studocu',
  [SharePayloadType.IMAGE_URL]: 'Liên kết Hình ảnh / QR',
  [SharePayloadType.GENERIC_URL]: 'Liên kết Web',
  [SharePayloadType.PLAIN_TEXT]: 'Văn bản',
  [SharePayloadType.IMAGE_FILES]: 'Tệp Hình ảnh',
  [SharePayloadType.PDF_FILES]: 'Tài liệu PDF',
  [SharePayloadType.ARCHIVE_FILES]: 'Tệp nén',
  [SharePayloadType.GENERIC_FILES]: 'Tệp tin',
};

const TYPE_ICONS = {
  [SharePayloadType.STUDOCU_URL]: 'book-open',
  [SharePayloadType.IMAGE_URL]: 'image',
  [SharePayloadType.GENERIC_URL]: 'link',
  [SharePayloadType.PLAIN_TEXT]: 'type',
  [SharePayloadType.IMAGE_FILES]: 'image',
  [SharePayloadType.PDF_FILES]: 'file-text',
  [SharePayloadType.ARCHIVE_FILES]: 'archive',
  [SharePayloadType.GENERIC_FILES]: 'file',
};

/**
 * Build payload preview HTML.
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 * @param {{ type: string }} classification
 * @returns {string}
 */
function renderPayloadPreview(payload, classification) {
  const icon = TYPE_ICONS[classification.type] || 'file';
  const label = TYPE_LABELS[classification.type] || 'Dữ liệu chia sẻ';
  const parts = [];

  if (payload.url) {
    try {
      const parsed = new URL(payload.url);
      const displayDomain = parsed.hostname.replace(/^www\./, '');
      const pathSnippet = parsed.pathname.length > 25 ? parsed.pathname.slice(0, 25) + '…' : parsed.pathname;
      parts.push(`<span class="text-xs text-zinc-300 font-mono truncate block" title="${payload.url}">${displayDomain}${pathSnippet}</span>`);
    } catch {
      parts.push(`<span class="text-xs text-zinc-300 font-mono truncate block">${payload.url}</span>`);
    }
  } else if (payload.text) {
    const preview = payload.text.length > 80 ? payload.text.slice(0, 80) + '…' : payload.text;
    parts.push(`<span class="text-xs text-zinc-400 truncate block">${preview}</span>`);
  }

  if (payload.files && payload.files.length > 0) {
    const fileList = payload.files.slice(0, 3).map(f =>
      `<span class="text-xs text-zinc-300">${f.name} <span class="text-zinc-500 font-mono">(${formatBytes(f.size)})</span></span>`
    ).join('<br>');
    if (payload.files.length > 3) {
      parts.push(fileList + `<br><span class="text-xs text-zinc-500 font-semibold">+${payload.files.length - 3} tệp khác</span>`);
    } else {
      parts.push(fileList);
    }
  }

  return `
    <div class="flex items-start gap-3 p-3.5 rounded-2xl bg-zinc-800/50 border border-zinc-700/60 shadow-inner">
      <div class="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
      </div>
      <div class="min-w-0 flex-1 space-y-1">
        <span class="inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold uppercase tracking-wider">${label}</span>
        ${payload.title ? `<p class="text-sm font-medium text-zinc-100 truncate">${payload.title}</p>` : ''}
        <div class="space-y-0.5">${parts.join('')}</div>
      </div>
    </div>
  `;
}

/**
 * Build action cards grid HTML.
 * @param {Array<{ label: string, route: string, mode?: string, imageUrl?: string, isPrimary?: boolean }>} recommendations
 * @param {number} [selectedIndex=0]
 * @returns {string}
 */
function renderActionCards(recommendations, selectedIndex = 0) {
  return recommendations.map((rec, i) => {
    const isSelected = (i === selectedIndex);
    return `
    <button type="button"
      class="share-action-card group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left w-full
        ${isSelected
          ? 'border-indigo-500/80 bg-indigo-500/15 shadow-sm ring-1 ring-indigo-500/30'
          : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600'}"
      data-action-index="${i}"
      aria-selected="${isSelected ? 'true' : 'false'}">
      <span class="action-indicator text-xs ${isSelected ? 'text-indigo-400 font-bold' : 'text-zinc-600'} shrink-0">
        ${isSelected ? '★' : '•'}
      </span>
      <span class="text-xs sm:text-sm font-medium ${isSelected ? 'text-white font-semibold' : 'text-zinc-200 group-hover:text-white'} flex-1 truncate">
        ${rec.label}
      </span>
      ${isSelected
        ? `<span class="action-badge px-2 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 text-[10px] font-semibold flex items-center gap-1 shrink-0 animate-fadeIn">
            <span>Mở</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </span>`
        : `<i data-lucide="chevron-right" class="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5"></i>`
      }
    </button>
  `;
  }).join('');
}

/**
 * Safely trigger Lucide icon rendering even if the external script is still loading.
 */
function triggerLucideIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  } else if (typeof window !== 'undefined') {
    const timer = setInterval(() => {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
        clearInterval(timer);
      }
    }, 50);
    setTimeout(() => clearInterval(timer), 2500);
  }
}

/**
 * Check if the Share Target Modal is currently active/open.
 * @returns {boolean}
 */
export function isShareTargetModalOpen() {
  return typeof window !== 'undefined' && Boolean(window.__FAST_PATH_SHARE_ACTIVE);
}

/**
 * Open the Smart Share Dispatch Modal.
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 */
export function openShareTargetModal(payload) {
  const placeholder = document.getElementById('fastPathSharePlaceholder');
  if (placeholder) placeholder.remove();

  const container = document.getElementById('globalShareTargetContainer');
  if (!container) return;

  window.__FAST_PATH_SHARE_ACTIVE = true;

  const classification = classifySharedPayload(payload);
  if (!classification.recommendations || !classification.recommendations.length) {
    // If no recommendations, clean hash if on #share-target and exit
    if (window.location.hash === '#share-target' || window.location.hash.startsWith('#share-target?')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.__FAST_PATH_SHARE_ACTIVE = false;
    return;
  }

  // Clean up any previously attached listener before reopening
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  const primaryIdx = classification.recommendations.findIndex(r => r.isPrimary);
  let selectedIndex = primaryIdx >= 0 ? primaryIdx : 0;
  let lastClickedIndex = -1;

  container.innerHTML = `
    <div id="shareTargetBackdrop" class="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm animate-fadeIn"></div>
    <div class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div id="shareTargetPanel" class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between pb-1 border-b border-zinc-800/60">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
              <i data-lucide="share-2" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-zinc-100">Chia sẻ vào DuyDev Studio</h3>
              <p class="text-[11px] text-zinc-500">Chọn module để nạp và xử lý tệp</p>
            </div>
          </div>
          <button type="button" id="shareTargetBtnClose" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/80 transition cursor-pointer" title="Đóng">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Payload Preview -->
        ${renderPayloadPreview(payload, classification)}

        <!-- Action Cards -->
        <div class="space-y-2">
          <p class="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Hành động gợi ý</p>
          <div id="shareActionCardsList" class="space-y-2">
            ${renderActionCards(classification.recommendations, selectedIndex)}
          </div>
        </div>

        <!-- Action Footer -->
        <div class="pt-2 border-t border-zinc-800/60">
          <button type="button" id="shareTargetBtnSubmit"
            class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs tracking-wide shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition cursor-pointer">
            <span id="shareTargetSubmitLabel">Mở module: ${classification.recommendations[selectedIndex]?.label || 'Đã chọn'}</span>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  // Render Lucide icons safely
  triggerLucideIcons();

  // Bind events
  const close = () => closeShareTargetModal();

  document.getElementById('shareTargetBtnClose')?.addEventListener('click', close);
  document.getElementById('shareTargetBackdrop')?.addEventListener('click', close);

  const confirmAction = () => {
    const action = classification.recommendations[selectedIndex];
    if (action) dispatchSharedPayloadToTool(action, payload);
  };

  document.getElementById('shareTargetBtnSubmit')?.addEventListener('click', confirmAction);

  function updateSelection(newIndex) {
    selectedIndex = newIndex;
    const listEl = document.getElementById('shareActionCardsList');
    if (listEl) {
      listEl.innerHTML = renderActionCards(classification.recommendations, selectedIndex);
      triggerLucideIcons();
      bindCardClicks();
    }
    const labelEl = document.getElementById('shareTargetSubmitLabel');
    if (labelEl && classification.recommendations[selectedIndex]) {
      labelEl.textContent = `Mở module: ${classification.recommendations[selectedIndex].label}`;
    }
  }

  function bindCardClicks() {
    container.querySelectorAll('.share-action-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.actionIndex, 10);
        if (lastClickedIndex === idx) {
          // Second click on the same selected module -> Dispatch!
          const action = classification.recommendations[idx];
          if (action) dispatchSharedPayloadToTool(action, payload);
        } else {
          // First click -> select this module, jump the purple highlight down to this module!
          lastClickedIndex = idx;
          updateSelection(idx);
        }
      });
    });
  }

  bindCardClicks();

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (selectedIndex + 1) % classification.recommendations.length;
      lastClickedIndex = next;
      updateSelection(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (selectedIndex - 1 + classification.recommendations.length) % classification.recommendations.length;
      lastClickedIndex = prev;
      updateSelection(prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmAction();
    }
  };
  document.addEventListener('keydown', onKeydown);

  cleanupFn = () => {
    document.removeEventListener('keydown', onKeydown);
  };
}

/**
 * Close the Share Target Modal and clean up.
 */
export function closeShareTargetModal() {
  window.__FAST_PATH_SHARE_ACTIVE = false;
  const placeholder = document.getElementById('fastPathSharePlaceholder');
  if (placeholder) placeholder.remove();
  const container = document.getElementById('globalShareTargetContainer');
  if (container) container.innerHTML = '';
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
  // Clean hash and query params if on share-target
  if (window.location.hash === '#share-target' || window.location.hash.startsWith('#share-target?')) {
    history.replaceState(null, '', window.location.pathname);
  }
  // If mainContent is unexpectedly empty, ensure home view renders
  const main = document.getElementById('mainContent');
  if (main && !main.children.length) {
    window.dispatchEvent(new CustomEvent('ds:re-render'));
  }
}

/**
 * Fetch image blob helper with graceful CORS fallback
 * @param {string} imageUrl
 * @returns {Promise<File|null>}
 */
async function fetchImageAsFile(imageUrl) {
  try {
    const resp = await fetch(imageUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const ext = blob.type.split('/')[1] || 'png';
    return new File([blob], `shared-image.${ext}`, { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
}

/**
 * Dispatch shared payload to the selected tool module.
 * @param {{ label: string, route: string, mode?: string, imageUrl?: string }} action
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 */
async function dispatchSharedPayloadToTool(action, payload) {
  // If app.js background bootstrap hasn't signaled ready, wait for ds:app-ready
  if (typeof window !== 'undefined' && !window.__dsAppReady) {
    const submitBtn = document.getElementById('shareTargetBtnSubmit');
    const submitLabel = document.getElementById('shareTargetSubmitLabel');
    if (submitLabel) submitLabel.textContent = 'Đang khởi động module...';
    if (submitBtn) submitBtn.classList.add('opacity-75', 'pointer-events-none');
    window.addEventListener('ds:app-ready', () => {
      dispatchSharedPayloadToTool(action, payload);
    }, { once: true });
    return;
  }

  closeShareTargetModal();

  // Navigate to target route if not already there
  if (window.location.hash !== action.route) {
    window.location.hash = action.route;
    // Wait for hashchange handler to initialize the module
    await new Promise(r => setTimeout(r, 150));
  }

  const { files, url, text } = payload;
  const onReRender = () => window.dispatchEvent(new CustomEvent('ds:re-render'));

  try {
    switch (action.route) {
      case '#tool/studocu-dl': {
        const { studocuManager } = await import('../tools/studocu/hooks/useStudocu.js');
        const targetUrl = url || (text?.match(/https?:\/\/\S+/)?.[0]) || text || '';
        if (targetUrl) studocuManager.startDownload(targetUrl);
        break;
      }
      case '#tool/qr-scan': {
        const { processScanFile } = await import('../tools/qr/hooks/useQrActions.js');
        if (files?.[0]) {
          await processScanFile(files[0], onReRender);
        } else if (action.imageUrl || url) {
          const imgUrl = action.imageUrl || url;
          const file = await fetchImageAsFile(imgUrl);
          if (file) {
            await processScanFile(file, onReRender);
          } else {
            // Attempt server proxy decode
            try {
              const res = await fetch('/api/v1/qr/decode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: imgUrl })
              });
              const json = await res.json();
              if (json.success && json.data?.text) {
                const { qrState } = await import('../tools/qr/hooks/useQrState.js');
                qrState.scan.result = json.data.text;
                onReRender();
              }
            } catch (err) {
              console.warn('[ShareTarget] Image scan fallback failed:', err);
            }
          }
        }
        break;
      }
      case '#tool/qr-multi': {
        const { qrState, persistQrState } = await import('../tools/qr/hooks/useQrState.js');
        const targetUrl = url || (text?.match(/https?:\/\/\S+/)?.[0]) || '';
        if (targetUrl) {
          qrState.activeTab = 'url';
          if (qrState.dynamic) qrState.dynamic.targetUrl = targetUrl;
          if (qrState.url) qrState.url.targetUrl = targetUrl;
          const urlInput = document.getElementById('dynamicTargetUrl');
          if (urlInput) {
            urlInput.value = targetUrl;
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else if (text) {
          qrState.activeTab = 'text';
          if (qrState.text) qrState.text.content = text;
          const textInput = document.getElementById('qrTextInput');
          if (textInput) {
            textInput.value = text;
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        persistQrState();
        onReRender();
        break;
      }
      case '#tool/pdf-studio': {
        const { pdfQueueManager } = await import('../tools/pdf/hooks/usePdfQueue.js');
        if (action.mode) pdfQueueManager.setMode(action.mode);
        if (files?.length) {
          await pdfQueueManager.addFiles(files);
        } else if (action.imageUrl) {
          const imgFile = await fetchImageAsFile(action.imageUrl);
          if (imgFile) await pdfQueueManager.addFiles([imgFile]);
        }
        break;
      }
      case '#tool/universal-converter': {
        const { converterManager } = await import('../tools/converter/hooks/useConverter.js');
        if (files?.length) {
          converterManager.addFiles(files);
        } else if (action.imageUrl) {
          const imgFile = await fetchImageAsFile(action.imageUrl);
          if (imgFile) converterManager.addFiles([imgFile]);
        }
        break;
      }
      case '#tool/archive-inspect': {
        const { archiveManager } = await import('../tools/archive/hooks/useArchive.js');
        if (files?.[0]) archiveManager.startUpload(files[0]);
        break;
      }
      case '#tool/hash-checksum': {
        const { hashState } = await import('../tools/hash/HashStudio.js');
        const { processHashFile, calculateTextHashes } = await import('../tools/hash/hooks/useHashActions.js');
        if (files?.[0]) {
          hashState.activeTab = 'file';
          await processHashFile(files[0], hashState, onReRender);
        } else if (text) {
          hashState.activeTab = 'text';
          hashState.textInput = text;
          const textInput = document.getElementById('inputHashText');
          if (textInput) textInput.value = text;
          hashState.textHashes = await calculateTextHashes(text);
          onReRender();
        }
        break;
      }
    }
  } catch (err) {
    console.error('[ShareTarget] Dispatch error:', err);
  }
}
