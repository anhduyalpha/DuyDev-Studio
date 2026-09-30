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
  [SharePayloadType.STUDOCU_URL]: 'Liên kết Studocu',
  [SharePayloadType.GENERIC_URL]: 'Liên kết',
  [SharePayloadType.PLAIN_TEXT]: 'Văn bản',
  [SharePayloadType.IMAGE_FILES]: 'Hình ảnh',
  [SharePayloadType.PDF_FILES]: 'Tài liệu PDF',
  [SharePayloadType.ARCHIVE_FILES]: 'Tệp nén',
  [SharePayloadType.GENERIC_FILES]: 'Tệp tin',
};

const TYPE_ICONS = {
  [SharePayloadType.STUDOCU_URL]: 'book-open',
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
  const label = TYPE_LABELS[classification.type] || 'Dữ liệu';
  const parts = [];

  if (payload.url) {
    try {
      const domain = new URL(payload.url).hostname;
      parts.push(`<span class="text-xs text-zinc-400 truncate block" title="${payload.url}">${domain}</span>`);
    } catch {
      parts.push(`<span class="text-xs text-zinc-400 truncate block">${payload.url}</span>`);
    }
  } else if (payload.text) {
    const preview = payload.text.length > 80 ? payload.text.slice(0, 80) + '…' : payload.text;
    parts.push(`<span class="text-xs text-zinc-400 truncate block">${preview}</span>`);
  }

  if (payload.files?.length) {
    const fileList = payload.files.slice(0, 3).map(f =>
      `<span class="text-xs text-zinc-400">${f.name} <span class="text-zinc-600">(${formatBytes(f.size)})</span></span>`
    ).join('<br>');
    if (payload.files.length > 3) {
      parts.push(fileList + `<br><span class="text-xs text-zinc-500">+${payload.files.length - 3} tệp khác</span>`);
    } else {
      parts.push(fileList);
    }
  }

  return `
    <div class="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
      <div class="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
        <i data-lucide="${icon}" class="w-4 h-4"></i>
      </div>
      <div class="min-w-0 flex-1">
        <span class="inline-block px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-[10px] font-semibold uppercase tracking-wider">${label}</span>
        ${payload.title ? `<p class="text-sm text-zinc-200 mt-1 truncate">${payload.title}</p>` : ''}
        <div class="mt-1">${parts.join('')}</div>
      </div>
    </div>
  `;
}

/**
 * Build action cards grid HTML.
 * @param {Array<{ label: string, route: string, mode?: string, isPrimary?: boolean }>} recommendations
 * @returns {string}
 */
function renderActionCards(recommendations) {
  return recommendations.map((rec, i) => `
    <button type="button"
      class="share-action-card group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left w-full
        ${rec.isPrimary
          ? 'border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20'
          : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600'}"
      data-action-index="${i}">
      ${rec.isPrimary ? '<span class="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider shrink-0">★</span>' : ''}
      <span class="text-sm text-zinc-200 group-hover:text-white">${rec.label}</span>
      <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 ml-auto shrink-0"></i>
    </button>
  `).join('');
}

/**
 * Open the Smart Share Dispatch Modal.
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 */
export function openShareTargetModal(payload) {
  const container = document.getElementById('globalShareTargetContainer');
  if (!container) return;

  const classification = classifySharedPayload(payload);
  if (!classification.recommendations.length) {
    // Nothing to recommend — clean hash if on #share-target and exit
    if (window.location.hash === '#share-target' || window.location.hash.startsWith('#share-target?')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }

  // Clean up any previously attached listener before reopening
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  container.innerHTML = `
    <div id="shareTargetBackdrop" class="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm animate-fadeIn" style="animation: fadeIn 0.15s ease-out;"></div>
    <div class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div id="shareTargetPanel" class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-zinc-800 bg-[#111114] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
              <i data-lucide="share-2" class="w-4 h-4"></i>
            </div>
            <h3 class="text-sm font-semibold text-zinc-100">Dữ liệu chia sẻ</h3>
          </div>
          <button type="button" id="shareTargetBtnClose" class="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/80 transition cursor-pointer" title="Đóng">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Payload Preview -->
        ${renderPayloadPreview(payload, classification)}

        <!-- Action Cards -->
        <div class="space-y-2">
          <p class="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Chọn hành động</p>
          <div class="space-y-2">
            ${renderActionCards(classification.recommendations)}
          </div>
        </div>
      </div>
    </div>
  `;

  // Render Lucide icons
  if (window.lucide) window.lucide.createIcons();

  // Bind events
  const close = () => closeShareTargetModal();

  document.getElementById('shareTargetBtnClose')?.addEventListener('click', close);
  document.getElementById('shareTargetBackdrop')?.addEventListener('click', close);

  const onKeydown = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKeydown);

  container.querySelectorAll('.share-action-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.actionIndex, 10);
      const action = classification.recommendations[idx];
      if (action) dispatchSharedPayloadToTool(action, payload);
    });
  });

  cleanupFn = () => {
    document.removeEventListener('keydown', onKeydown);
  };
}

/**
 * Close the Share Target Modal and clean up.
 */
export function closeShareTargetModal() {
  const container = document.getElementById('globalShareTargetContainer');
  if (container) container.innerHTML = '';
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
  // Clean hash if it's #share-target
  if (window.location.hash === '#share-target' || window.location.hash.startsWith('#share-target?')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  // If mainContent is unexpectedly empty, ensure home view renders
  const main = document.getElementById('mainContent');
  if (main && !main.children.length) {
    window.dispatchEvent(new CustomEvent('ds:re-render'));
  }
}

/**
 * Dispatch shared payload to the selected tool module.
 * Uses dynamic imports to load only the target module.
 * @param {{ label: string, route: string, mode?: string }} action
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 */
async function dispatchSharedPayloadToTool(action, payload) {
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
        if (files?.[0]) await processScanFile(files[0], onReRender);
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
        if (files?.length) await pdfQueueManager.addFiles(files);
        break;
      }
      case '#tool/universal-converter': {
        const { converterManager } = await import('../tools/converter/hooks/useConverter.js');
        if (files?.length) converterManager.addFiles(files);
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
