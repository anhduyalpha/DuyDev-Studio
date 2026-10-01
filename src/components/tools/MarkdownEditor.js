/**
 * MarkdownEditor Component (Dark Professional Minimalism)
 * Live Markdown Dual-Pane Workspace with Export to HTML, TXT, and Print to PDF.
 */

import { showToast } from '../../utilities/toast.js';
import { parseMarkdownToHtml, downloadBlob } from '../../utilities/markdownParser.js';
import { loadModuleState, saveModuleState } from '../../utilities/moduleState.js';
import { storage } from '../../utilities/storage.js';

/**
 * @typedef {Object} MarkdownState
 * @property {string} content - Markdown raw text content
 * @property {'split'|'edit'|'preview'} viewMode - Dual pane view mode layout
 */

/** @type {MarkdownState} */
export const markdownState = {
  content: `# DuyDev Studio - Tài Liệu Mẫu

Chào mừng bạn đến với **Bộ Soạn Thảo & Chuyển Đổi Markdown**.

## Tính Năng Nổi Bật
- **Soạn thảo thời gian thực**: Xem trước nội dung trực tiếp hai màn hình.
- **Xuất file đa dạng**: Tải về file \`.md\`, xuất \`.html\` nguyên bản hoặc in PDF.
- **Tốc độ cao**: Không phụ thuộc mạng, bảo mật nội dung tuyệt đối.

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
  viewMode: 'split'
};

const savedMd = loadModuleState('markdown', null);
if (savedMd) {
  if (savedMd.content !== undefined) {
    markdownState.content = savedMd.content;
  }
  if (savedMd.viewMode) {
    markdownState.viewMode = savedMd.viewMode;
  }
}

/**
 * Persists the current Markdown editor content and view mode.
 */
export function persistMarkdownState() {
  saveModuleState('markdown', {
    content: markdownState.content,
    viewMode: markdownState.viewMode
  });
}

/**
 * Renders the Markdown dual-pane editor workspace.
 * @returns {string} HTML markup string
 */
export function renderMarkdownEditor() {
  const { content, viewMode } = markdownState;
  const renderedHtml = parseMarkdownToHtml(content);

  return `
    <div class="space-y-6 animate-fadeIn">
      
      <!-- Top Breadcrumb & Controls -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Văn Bản & Tài Liệu</span>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-600 dark:text-zinc-400 font-medium">Markdown</span>
        </div>

        <!-- Export Buttons -->
        <div class="flex items-center gap-2">
          <button id="btnExportHtml" class="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition shadow-xs">
            <i data-lucide="file-code" class="w-3.5 h-3.5"></i> Xuất HTML
          </button>
          <button id="btnExportMd" class="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition shadow-xs">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải .md
          </button>
          <button id="btnPrintPdf" class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i> In / Xuất PDF
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
          )}" class="btn-insert-md px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 text-xs font-mono font-medium transition">
            ${tb.label}
          </button>
        `
          )
          .join('')}

        <div class="ml-auto flex items-center gap-1">
          <button data-md-view="split" class="btn-md-view px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            viewMode === 'split'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400'
          }">Song song</button>
          <button data-md-view="edit" class="btn-md-view px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            viewMode === 'edit'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-600 dark:text-zinc-400'
          }">Soạn thảo</button>
          <button data-md-view="preview" class="btn-md-view px-2.5 py-1 rounded-lg text-xs font-medium transition ${
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
            <span>SOẠN THẢO MARKDOWN</span>
            <span>${content.length} ký tự</span>
          </div>
          <textarea id="markdownInput" rows="22" class="w-full flex-1 p-3 rounded-xl bg-zinc-50/70 dark:bg-[#0E0E11] border border-zinc-200/60 dark:border-white/[0.04] text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y">${content}</textarea>
        </div>

        <!-- Preview Right Pane -->
        <div class="${
          viewMode === 'edit' ? 'hidden' : 'block'
        } bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-6 shadow-sm overflow-y-auto max-h-[640px] custom-scrollbar">
          <div class="text-[11px] font-mono text-zinc-400 mb-3 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
            BẢN XEM TRƯỚC
          </div>
          <div id="markdownPreview" class="prose dark:prose-invert prose-zinc max-w-none text-xs leading-relaxed space-y-3">
            ${renderedHtml}
          </div>
        </div>

      </div>

    </div>
  `;
}

/**
 * Attaches DOM listeners for the Markdown Editor and Export actions.
 * @param {() => void} [onReRender]
 * @returns {() => void} Teardown cleanup function
 */
export function attachMarkdownEditorListeners(onReRender) {
  const textarea = document.getElementById('markdownInput');
  const preview = document.getElementById('markdownPreview');

  if (textarea) {
    textarea.addEventListener('input', (e) => {
      markdownState.content = e.target.value;
      persistMarkdownState();
      if (preview) {
        preview.innerHTML = parseMarkdownToHtml(markdownState.content);
      }
    });
  }

  // Snippet buttons
  document.querySelectorAll('.btn-insert-md').forEach((btn) => {
    btn.addEventListener('click', () => {
      const snippet = decodeURIComponent(btn.dataset.insertSnippet || '');
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = textarea.value;
        textarea.value = current.substring(0, start) + snippet + current.substring(end);
        markdownState.content = textarea.value;
        persistMarkdownState();
        if (preview) {
          preview.innerHTML = parseMarkdownToHtml(markdownState.content);
        }
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }
    });
  });

  // View modes
  document.querySelectorAll('.btn-md-view').forEach((btn) => {
    btn.addEventListener('click', () => {
      markdownState.viewMode = btn.dataset.mdView;
      persistMarkdownState();
      if (onReRender) onReRender();
    });
  });

  // Export HTML
  const btnExpHtml = document.getElementById('btnExportHtml');
  if (btnExpHtml) {
    btnExpHtml.addEventListener('click', () => {
      const htmlContent = `<!DOCTYPE html>
<html>
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

  // Print PDF
  const btnPrint = document.getElementById('btnPrintPdf');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  return () => {
    // Teardown: no active asynchronous timers to clear
  };
}
