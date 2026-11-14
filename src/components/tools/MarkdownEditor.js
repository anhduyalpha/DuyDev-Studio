/**
 * MarkdownEditor Component (Dark Professional Minimalism)
 * Live Markdown Dual-Pane Workspace with Direct DOCX, PDF, HTML, and TXT Export,
 * Local/Drive File Loader, Synchronized Scroll, and Pro Shortcuts.
 */

import { showToast } from '../../utilities/toast.js';
import { parseMarkdownToHtml, downloadBlob } from '../../utilities/markdownParser.js';
import { loadModuleState, saveModuleState } from '../../utilities/moduleState.js';
import { storage } from '../../utilities/storage.js';
import { requireAdmin, getStorageAuthHeaders } from '../../utilities/adminAuth.js';

/**
 * @typedef {Object} MarkdownState
 * @property {string} content - Markdown raw text content
 * @property {'split'|'edit'|'preview'} viewMode - Dual pane view mode layout
 * @property {boolean} syncScroll - Whether proportional scroll synchronization is active
 */

/** @type {MarkdownState} */
export const markdownState = {
  content: `# DuyDev Studio - Tài Liệu Mẫu

Chào mừng bạn đến với **Bộ Soạn Thảo & Chuyển Đổi Markdown**.

## Tính Năng Nổi Bật
- **Soạn thảo thời gian thực**: Xem trước nội dung trực tiếp hai màn hình.
- **Xuất file đa dạng**: Xuất trực tiếp .DOCX chuẩn Word, file .PDF vector, hoặc .HTML.
- **Mở tài liệu**: Nhập file .md/.txt từ máy hoặc mở trực tiếp từ Drive cá nhân.
- **Cuộn đồng bộ**: Di chuyển đồng thời giữa khung soạn thảo và bản xem trước.

### Bảng dữ liệu mẫu
| Công Cụ | Định Dạng | Tình Trạng |
| :--- | :--- | :--- |
| Nén PDF | PDF -> Word, Ảnh | Sẵn sàng |
| Đọc File Nén | .zip, .rar, .7z | Trực tiếp |
| VietQR | EMVCo 2026 | Hoạt động |

> "Đơn giản hóa công việc với những tiện ích nhanh chóng, bảo mật và trực quan."

\`\`\`javascript
// DuyDev Studio Code Snippet
function studioReady() {
  console.log("Ready to build and convert!");
}
\`\`\`
`,
  viewMode: 'split',
  syncScroll: true
};

const savedMd = loadModuleState('markdown', null);
if (savedMd) {
  if (savedMd.content !== undefined) {
    markdownState.content = savedMd.content;
  }
  if (savedMd.viewMode) {
    markdownState.viewMode = savedMd.viewMode;
  }
  if (savedMd.syncScroll !== undefined) {
    markdownState.syncScroll = Boolean(savedMd.syncScroll);
  }
}

let mdDebounceTimer = null;
let mdPendingContent = null;
let isSyncingScroll = false;

/**
 * Immediately flushes any pending debounced Markdown parse and localStorage persistence.
 */
export function flushMarkdownSync() {
  if (mdDebounceTimer !== null) {
    clearTimeout(mdDebounceTimer);
    mdDebounceTimer = null;
  }
  if (mdPendingContent !== null) {
    markdownState.content = mdPendingContent;
    mdPendingContent = null;
    persistMarkdownState();
    const preview = document.getElementById('markdownPreview');
    if (preview) {
      preview.innerHTML = parseMarkdownToHtml(markdownState.content);
    }
    const countEl = document.getElementById('markdownCharCount');
    if (countEl) {
      countEl.textContent = `${markdownState.content.length} ký tự`;
    }
  }
}

/**
 * Persists the current Markdown editor content and view mode.
 */
export function persistMarkdownState() {
  saveModuleState('markdown', {
    content: markdownState.content,
    viewMode: markdownState.viewMode,
    syncScroll: markdownState.syncScroll
  });
}

/**
 * Helper to escape HTML strings for safe modal rendering
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the Markdown dual-pane editor workspace.
 * @returns {string} HTML markup string
 */
export function renderMarkdownEditor() {
  const { content, viewMode, syncScroll } = markdownState;
  const renderedHtml = parseMarkdownToHtml(content);

  return `
    <div class="space-y-5 animate-fadeIn pb-12 md:pb-16">
      
      <!-- Hidden Local File Input -->
      <input type="file" id="mdLocalFileInput" accept=".md,.markdown,.txt" class="hidden" />

      <!-- Top Breadcrumb & Actions Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Văn Bản & Tài Liệu</span>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-600 dark:text-zinc-400 font-medium">Markdown</span>
        </div>

        <!-- Open & Export Actions -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Open Buttons -->
          <button id="btnOpenLocal" type="button" class="min-h-[44px] px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2 transition shadow-xs cursor-pointer">
            <i data-lucide="folder-open" class="w-4 h-4 text-indigo-500"></i> Mở file
          </button>
          <button id="btnOpenDrive" type="button" class="min-h-[44px] px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2 transition shadow-xs cursor-pointer">
            <i data-lucide="hard-drive" class="w-4 h-4 text-amber-500"></i> Mở từ Drive
          </button>

          <!-- Export Actions -->
          <button id="btnExportDocx" type="button" class="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer">
            <i data-lucide="file-text" class="w-4 h-4"></i> Xuất .DOCX
          </button>
          <button id="btnExportPdf" type="button" class="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer">
            <i data-lucide="file-down" class="w-4 h-4 text-red-400 dark:text-red-600"></i> Xuất .PDF
          </button>

          <button id="btnExportMd" type="button" class="min-h-[44px] px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition shadow-xs cursor-pointer">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải .md
          </button>
          <button id="btnExportHtml" type="button" class="min-h-[44px] px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition shadow-xs cursor-pointer">
            <i data-lucide="file-code" class="w-3.5 h-3.5"></i> Xuất HTML
          </button>
          <button id="btnPrintPdf" type="button" class="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer" title="In trực tiếp bằng hộp thoại trình duyệt">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i> In
          </button>
        </div>
      </div>

      <!-- Markdown Quick Toolbar -->
      <div class="flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] rounded-2xl shadow-xs">
        ${[
          { label: 'H1', snippet: '# Tiêu đề chính\n' },
          { label: 'H2', snippet: '## Tiêu đề phụ\n' },
          { label: 'B', snippet: '**In đậm**' },
          { label: 'I', snippet: '*In nghiêng*' },
          { label: 'Quote', snippet: '> Trích dẫn\n' },
          { label: 'Code', snippet: '```javascript\nconsole.log("Hello");\n```\n' },
          { label: 'Table', snippet: '| Cột 1 | Cột 2 |\n| :--- | :--- |\n| A | B |\n' },
          { label: 'Link', snippet: '[Tên link](https://example.com)' }
        ]
          .map(
            (tb) => `
          <button data-insert-snippet="${encodeURIComponent(
            tb.snippet
          )}" class="btn-insert-md px-2.5 py-1.5 min-h-[36px] rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 text-xs font-mono font-medium transition cursor-pointer">
            ${tb.label}
          </button>
        `
          )
          .join('')}

        <!-- Sync Scroll Toggle -->
        <button id="btnToggleSyncScroll" type="button" class="ml-2 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
          syncScroll
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
            : 'bg-zinc-100 text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400'
        }" title="Bật/tắt cuộn đồng bộ giữa khung soạn thảo và xem trước">
          <i data-lucide="arrow-down-up" class="w-3.5 h-3.5"></i> Cuộn đồng bộ
        </button>

        <!-- View Mode Switcher -->
        <div class="ml-auto flex items-center gap-1">
          <button data-md-view="split" class="btn-md-view px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-medium transition cursor-pointer ${
            viewMode === 'split'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400'
          }">Song song</button>
          <button data-md-view="edit" class="btn-md-view px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-medium transition cursor-pointer ${
            viewMode === 'edit'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400'
          }">Soạn thảo</button>
          <button data-md-view="preview" class="btn-md-view px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-medium transition cursor-pointer ${
            viewMode === 'preview'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400'
          }">Xem trước</button>
        </div>
      </div>

      <!-- Editor Container Grid -->
      <div class="grid grid-cols-1 ${viewMode === 'split' ? 'lg:grid-cols-2' : ''} gap-6">
        
        <!-- Editor Left Pane -->
        <div class="${
          viewMode === 'preview' ? 'hidden' : 'block'
        } bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-4 shadow-sm flex flex-col">
          <div class="text-[11px] font-mono text-zinc-400 mb-2 flex items-center justify-between">
            <span class="flex items-center gap-1.5 font-semibold">
              <i data-lucide="edit-3" class="w-3.5 h-3.5 text-zinc-500"></i> SOẠN THẢO MARKDOWN
            </span>
            <span id="markdownCharCount">${content.length} ký tự</span>
          </div>
          <textarea id="markdownInput" rows="22" class="w-full flex-1 p-3 rounded-xl bg-zinc-50/70 dark:bg-[#0E0E11] border border-zinc-200/60 dark:border-white/[0.04] text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y custom-scrollbar">${content}</textarea>
        </div>

        <!-- Preview Right Pane -->
        <div id="markdownPreviewPane" class="${
          viewMode === 'edit' ? 'hidden' : 'block'
        } bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-6 shadow-sm overflow-y-auto max-h-[640px] custom-scrollbar">
          <div class="text-[11px] font-mono text-zinc-400 mb-3 pb-2 border-b border-zinc-100 dark:border-white/[0.05] flex items-center justify-between">
            <span class="font-semibold">BẢN XEM TRƯỚC</span>
            <span class="text-[10px] text-zinc-400">Ctrl+B: In đậm | Ctrl+I: In nghiêng | Ctrl+S: Lưu .md</span>
          </div>
          <div id="markdownPreview" class="prose dark:prose-invert prose-zinc max-w-none text-xs leading-relaxed space-y-3">
            ${renderedHtml}
          </div>
        </div>

      </div>

      <!-- Drive Picker Modal Container -->
      <div id="mdDrivePickerModalContainer"></div>

    </div>
  `;
}

/**
 * Attaches DOM listeners for the Markdown Editor, Export actions,
 * Local file loading, Drive picker, Scroll sync, and Keyboard shortcuts.
 * @param {() => void} [onReRender]
 * @returns {() => void} Teardown cleanup function
 */
export function attachMarkdownEditorListeners(onReRender) {
  const textarea = document.getElementById('markdownInput');
  const preview = document.getElementById('markdownPreview');
  const previewPane = document.getElementById('markdownPreviewPane');

  // Input debouncing & character count
  const handleInput = (e) => {
    const val = e.target.value;
    mdPendingContent = val;
    const countEl = document.getElementById('markdownCharCount');
    if (countEl) {
      countEl.textContent = `${val.length} ký tự`;
    }

    if (mdDebounceTimer) {
      clearTimeout(mdDebounceTimer);
    }
    mdDebounceTimer = setTimeout(() => {
      mdDebounceTimer = null;
      if (mdPendingContent !== null) {
        markdownState.content = mdPendingContent;
        mdPendingContent = null;
        persistMarkdownState();
        if (preview) {
          preview.innerHTML = parseMarkdownToHtml(markdownState.content);
        }
      }
    }, 180);
  };

  if (textarea) {
    textarea.addEventListener('input', handleInput);
  }

  // Synchronized scroll handlers with loop guard
  const handleTextareaScroll = () => {
    if (!markdownState.syncScroll || isSyncingScroll || !previewPane || !textarea) return;
    const maxTextareaScroll = textarea.scrollHeight - textarea.clientHeight;
    if (maxTextareaScroll <= 0) return;

    isSyncingScroll = true;
    const scrollRatio = textarea.scrollTop / maxTextareaScroll;
    const maxPreviewScroll = previewPane.scrollHeight - previewPane.clientHeight;
    previewPane.scrollTop = scrollRatio * maxPreviewScroll;

    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  };

  const handlePreviewScroll = () => {
    if (!markdownState.syncScroll || isSyncingScroll || !previewPane || !textarea) return;
    const maxPreviewScroll = previewPane.scrollHeight - previewPane.clientHeight;
    if (maxPreviewScroll <= 0) return;

    isSyncingScroll = true;
    const scrollRatio = previewPane.scrollTop / maxPreviewScroll;
    const maxTextareaScroll = textarea.scrollHeight - textarea.clientHeight;
    textarea.scrollTop = scrollRatio * maxTextareaScroll;

    requestAnimationFrame(() => {
      isSyncingScroll = false;
    });
  };

  if (textarea) {
    textarea.addEventListener('scroll', handleTextareaScroll, { passive: true });
  }
  if (previewPane) {
    previewPane.addEventListener('scroll', handlePreviewScroll, { passive: true });
  }

  // Toggle Sync Scroll button
  const btnToggleSync = document.getElementById('btnToggleSyncScroll');
  if (btnToggleSync) {
    btnToggleSync.addEventListener('click', () => {
      markdownState.syncScroll = !markdownState.syncScroll;
      persistMarkdownState();
      if (onReRender) {
        onReRender();
      } else {
        btnToggleSync.className = `ml-2 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
          markdownState.syncScroll
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
            : 'bg-zinc-100 text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400'
        }`;
      }
      showToast(
        markdownState.syncScroll ? 'Đã bật cuộn đồng bộ' : 'Đã tắt cuộn đồng bộ',
        'info'
      );
    });
  }

  // Snippet toolbar insertion
  document.querySelectorAll('.btn-insert-md').forEach((btn) => {
    btn.addEventListener('click', () => {
      const snippet = decodeURIComponent(btn.dataset.insertSnippet || '');
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = textarea.value;
        textarea.value = current.substring(0, start) + snippet + current.substring(end);
        mdPendingContent = textarea.value;
        flushMarkdownSync();
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }
    });
  });

  // View modes
  document.querySelectorAll('.btn-md-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      flushMarkdownSync();
      markdownState.viewMode = btn.dataset.mdView;
      persistMarkdownState();
      if (onReRender) onReRender();
    });
  });

  // Open Local File Input (.md, .markdown, .txt)
  const localInput = document.getElementById('mdLocalFileInput');
  const btnOpenLocal = document.getElementById('btnOpenLocal');
  if (btnOpenLocal && localInput) {
    btnOpenLocal.addEventListener('click', () => {
      localInput.click();
    });
  }

  const handleLocalFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readEvent) => {
      const content = readEvent.target?.result || '';
      markdownState.content = String(content);
      mdPendingContent = null;
      if (textarea) {
        textarea.value = markdownState.content;
      }
      persistMarkdownState();
      if (preview) {
        preview.innerHTML = parseMarkdownToHtml(markdownState.content);
      }
      const countEl = document.getElementById('markdownCharCount');
      if (countEl) {
        countEl.textContent = `${markdownState.content.length} ký tự`;
      }
      showToast(`Đã mở ${file.name}`, 'success');
      // Reset input value so same file can be selected again
      localInput.value = '';
    };
    reader.onerror = () => {
      showToast('Không thể đọc file đã chọn', 'error');
    };
    reader.readAsText(file);
  };

  if (localInput) {
    localInput.addEventListener('change', handleLocalFileChange);
  }

  // Open from Drive Action
  const btnOpenDrive = document.getElementById('btnOpenDrive');
  if (btnOpenDrive) {
    btnOpenDrive.addEventListener('click', () => {
      requireAdmin(async () => {
        openDriveDocumentPicker();
      }, 'Mở khóa Storage Drive để chọn file Markdown');
    });
  }

  /**
   * Opens Drive Picker Modal querying /api/v1/storage/list
   */
  async function openDriveDocumentPicker() {
    const modalRoot = document.getElementById('mdDrivePickerModalContainer');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div id="mdDriveModalBackdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
        <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/10">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <i data-lucide="hard-drive" class="w-4 h-4"></i>
              </div>
              <h4 class="font-bold text-sm text-zinc-900 dark:text-white">Mở file từ Storage Drive</h4>
            </div>
            <button id="btnCloseDriveModal" class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div id="mdDriveFileList" class="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 py-2 min-h-[160px] text-xs">
            <div class="flex items-center justify-center py-8 text-zinc-400">
              <i data-lucide="loader-2" class="w-5 h-5 animate-spin mr-2"></i> Đang tải danh sách file...
            </div>
          </div>

          <div class="flex items-center justify-end pt-2 border-t border-zinc-100 dark:border-white/10">
            <button id="btnCancelDriveModal" class="px-4 py-2 min-h-[44px] rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    const closeModal = () => {
      modalRoot.innerHTML = '';
    };

    document.getElementById('btnCloseDriveModal')?.addEventListener('click', closeModal);
    document.getElementById('btnCancelDriveModal')?.addEventListener('click', closeModal);

    try {
      const res = await fetch('/api/v1/storage/list?path=/', {
        headers: getStorageAuthHeaders()
      });

      if (!res.ok) {
        throw new Error(`Storage error ${res.status}`);
      }

      const listData = await res.json();
      const files = listData.items || listData.files || [];

      // Filter text and markdown files
      const mdFiles = files.filter((f) => {
        const name = (f.name || f.filename || '').toLowerCase();
        return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
      });

      const listEl = document.getElementById('mdDriveFileList');
      if (!listEl) return;

      if (mdFiles.length === 0) {
        listEl.innerHTML = `
          <div class="text-center py-8 text-zinc-400 space-y-2">
            <i data-lucide="file-question" class="w-8 h-8 mx-auto text-zinc-500"></i>
            <p>Không tìm thấy file .md hoặc .txt nào trong thư mục gốc của Drive.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      listEl.innerHTML = mdFiles
        .map((f) => {
          const filePath = f.path || f.relPath || `/${f.name}`;
          const fileSize = f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} KB` : '';
          return `
            <div data-drive-path="${escapeHtml(filePath)}" class="drive-item flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 hover:bg-indigo-50 dark:bg-white/[0.02] dark:hover:bg-indigo-500/10 border border-zinc-200/60 dark:border-white/[0.05] transition cursor-pointer group">
              <div class="flex items-center gap-2.5 truncate">
                <i data-lucide="file-text" class="w-4 h-4 text-indigo-500 shrink-0"></i>
                <span class="font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">${escapeHtml(
                  f.name
                )}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] text-zinc-400">${fileSize}</span>
                <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-500 transition"></i>
              </div>
            </div>
          `;
        })
        .join('');

      if (window.lucide) window.lucide.createIcons();

      listEl.querySelectorAll('.drive-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const drivePath = item.getAttribute('data-drive-path');
          if (!drivePath) return;

          try {
            item.innerHTML = `<span class="text-indigo-500 py-1 flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Đang tải nội dung...</span>`;
            if (window.lucide) window.lucide.createIcons();

            const downRes = await fetch(
              `/api/v1/storage/download?path=${encodeURIComponent(drivePath)}`,
              {
                headers: getStorageAuthHeaders()
              }
            );

            if (!downRes.ok) {
              throw new Error(`Download failed: HTTP ${downRes.status}`);
            }

            const text = await downRes.text();
            markdownState.content = text;
            mdPendingContent = null;
            if (textarea) textarea.value = text;
            persistMarkdownState();
            if (preview) preview.innerHTML = parseMarkdownToHtml(text);
            const countEl = document.getElementById('markdownCharCount');
            if (countEl) countEl.textContent = `${text.length} ký tự`;

            closeModal();
            showToast('Đã tải tài liệu từ Drive thành công', 'success');
          } catch (err) {
            showToast('Lỗi khi tải file từ Drive', 'error');
            closeModal();
          }
        });
      });
    } catch (netErr) {
      const listEl = document.getElementById('mdDriveFileList');
      if (listEl) {
        listEl.innerHTML = `
          <div class="text-center py-6 text-red-500 space-y-1">
            <p class="font-semibold">Không thể kết nối đến Storage Drive.</p>
            <p class="text-[11px] text-zinc-400">Vui lòng kiểm tra quyền quản trị hoặc thử lại sau.</p>
          </div>
        `;
      }
    }
  }

  // Export DOCX & PDF via Backend API /api/v1/markdown/export
  async function triggerBackendExport(format) {
    flushMarkdownSync();
    const btn = format === 'docx' ? document.getElementById('btnExportDocx') : document.getElementById('btnExportPdf');
    const originalText = btn ? btn.innerHTML : '';

    if (btn) {
      btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Đang xử lý...`;
      btn.setAttribute('disabled', 'true');
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const res = await fetch('/api/v1/markdown/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': storage.getDeviceId ? storage.getDeviceId() : 'browser'
        },
        body: JSON.stringify({
          format,
          markdown: markdownState.content,
          filename: 'document'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Export failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.downloadUrl) {
        throw new Error('Export endpoint returned invalid download URL');
      }

      // Trigger file download
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.fileName || `document.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Record to local storage history
      storage.addHistoryItem({
        toolId: 'markdown-docs',
        toolTitle: 'Văn Bản & Markdown',
        fileName: data.fileName || `document.${format}`,
        resultSize: data.sizeBytes || 0,
        resultFileId: data.fileId,
        downloadUrl: data.downloadUrl
      });

      showToast(`Đã xuất ${data.fileName || `document.${format}`}`, 'success');
    } catch (exportErr) {
      showToast(exportErr.message || 'Lỗi khi xuất file', 'error');
    } finally {
      if (btn) {
        btn.innerHTML = originalText;
        btn.removeAttribute('disabled');
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  // Export DOCX
  const btnExpDocx = document.getElementById('btnExportDocx');
  if (btnExpDocx) {
    btnExpDocx.addEventListener('click', () => {
      triggerBackendExport('docx');
    });
  }

  // Export PDF
  const btnExpPdf = document.getElementById('btnExportPdf');
  if (btnExpPdf) {
    btnExpPdf.addEventListener('click', () => {
      triggerBackendExport('pdf');
    });
  }

  // Export HTML
  const btnExpHtml = document.getElementById('btnExportHtml');
  if (btnExpHtml) {
    btnExpHtml.addEventListener('click', () => {
      flushMarkdownSync();
      const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>DuyDev Studio - Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    pre { background: #f1f5f9; padding: 12px; border-radius: 8px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f8fafc; }
    blockquote { border-left: 4px solid #6366f1; margin: 0; padding-left: 16px; color: #64748b; font-style: italic; }
  </style>
</head>
<body>
  ${parseMarkdownToHtml(markdownState.content)}
</body>
</html>`;
      downloadBlob(htmlContent, 'document.html', 'text/html');
      storage.addHistoryItem({
        toolId: 'markdown-docs',
        toolTitle: 'Văn Bản & Markdown',
        fileName: 'document.html',
        resultSize: new Blob([htmlContent]).size
      });
      showToast('Đã xuất document.html', 'success');
    });
  }

  // Export MD
  const btnExpMd = document.getElementById('btnExportMd');
  if (btnExpMd) {
    btnExpMd.addEventListener('click', () => {
      flushMarkdownSync();
      downloadBlob(markdownState.content, 'document.md', 'text/markdown');
      storage.addHistoryItem({
        toolId: 'markdown-docs',
        toolTitle: 'Văn Bản & Markdown',
        fileName: 'document.md',
        resultSize: new Blob([markdownState.content]).size
      });
      showToast('Đã tải document.md', 'success');
    });
  }

  // Print PDF via browser dialog
  const btnPrint = document.getElementById('btnPrintPdf');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      flushMarkdownSync();
      window.print();
    });
  }

  // Keyboard Shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+S
  const handleKeydown = (e) => {
    // Only intercept if event occurs inside editor textarea or when editor is mounted
    const isEditorActive = Boolean(document.getElementById('markdownInput'));
    if (!isEditorActive) return;

    // Ctrl+S: Save/Download .md
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flushMarkdownSync();
      downloadBlob(markdownState.content, 'document.md', 'text/markdown');
      showToast('Đã lưu document.md', 'success');
      return;
    }

    // Ctrl+B: Bold selection or insert placeholder
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      if (document.activeElement === textarea && textarea) {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = textarea.value;
        const selected = current.substring(start, end);
        const replacement = selected ? `**${selected}**` : '**In đậm**';
        textarea.value = current.substring(0, start) + replacement + current.substring(end);
        mdPendingContent = textarea.value;
        flushMarkdownSync();
        textarea.setSelectionRange(
          start + (selected ? 2 : 2),
          start + replacement.length - (selected ? 2 : 2)
        );
      }
      return;
    }

    // Ctrl+I: Italic selection or insert placeholder
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      if (document.activeElement === textarea && textarea) {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = textarea.value;
        const selected = current.substring(start, end);
        const replacement = selected ? `*${selected}*` : '*In nghiêng*';
        textarea.value = current.substring(0, start) + replacement + current.substring(end);
        mdPendingContent = textarea.value;
        flushMarkdownSync();
        textarea.setSelectionRange(
          start + (selected ? 1 : 1),
          start + replacement.length - (selected ? 1 : 1)
        );
      }
      return;
    }
  };

  window.addEventListener('keydown', handleKeydown);

  // Return unmount cleanup function
  return () => {
    if (mdDebounceTimer) {
      clearTimeout(mdDebounceTimer);
      mdDebounceTimer = null;
    }
    if (mdPendingContent !== null) {
      markdownState.content = mdPendingContent;
      mdPendingContent = null;
      persistMarkdownState();
    }
    if (textarea) {
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('scroll', handleTextareaScroll);
    }
    if (previewPane) {
      previewPane.removeEventListener('scroll', handlePreviewScroll);
    }
    if (localInput) {
      localInput.removeEventListener('change', handleLocalFileChange);
    }
    window.removeEventListener('keydown', handleKeydown);
  };
}
