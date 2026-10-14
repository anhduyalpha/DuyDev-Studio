/**
 * Scribd DocumentItem Component
 * Renders individual document row with clean Obsidian/Linear styling.
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentItem(doc, isTrash = false) {
  const docName = doc.name || 'Tài liệu không tên';
  const docTitle = doc.title || docName;
  const docSize = doc.size_mb ? `${doc.size_mb} MB` : (doc.size_bytes ? `${(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB` : '');
  const timeStr = doc.time || '';
  const downloadUrl = `/api/v1/scribd/download/${encodeURIComponent(docName)}`;
  const streamUrl = `/api/v1/scribd/stream?file=${encodeURIComponent(docName)}`;

  return `
    <div class="scribd-file-item flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111114] hover:border-zinc-300 dark:hover:border-white/[0.16] transition shadow-xs" data-doc-name="${escapeHtml(docName)}">
      <!-- Left: File Badge & Info -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
          PDF
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="btn-view-scribd-doc text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition"
              data-doc-name="${escapeHtml(docName)}"
              data-stream-url="${escapeHtml(streamUrl)}"
              data-download-url="${escapeHtml(downloadUrl)}"
              title="${escapeHtml(docTitle)}"
            >
              ${escapeHtml(docTitle)}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            ${docSize ? `<span class="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.06] font-mono text-[11px]">${escapeHtml(docSize)}</span>` : ''}
            ${timeStr ? `<span class="hidden xs:inline">${escapeHtml(timeStr)}</span>` : ''}
            ${doc.from_drive ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">Đã lưu Drive</span>' : ''}
          </div>
        </div>
      </div>

      <!-- Right: Action Buttons -->
      <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        ${!isTrash ? `
          <button
            type="button"
            class="btn-view-scribd-doc inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.12] transition cursor-pointer min-h-[36px]"
            data-doc-name="${escapeHtml(docName)}"
            data-stream-url="${escapeHtml(streamUrl)}"
            data-download-url="${escapeHtml(downloadUrl)}"
            title="Xem trước"
          >
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>Xem</span>
          </button>
          <a
            href="${downloadUrl}"
            download="${escapeHtml(docName)}"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.12] transition cursor-pointer min-h-[36px]"
            title="Tải về máy"
          >
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Tải</span>
          </a>
          <button
            type="button"
            class="btn-save-scribd-drive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/20 transition cursor-pointer min-h-[36px]"
            data-doc-name="${escapeHtml(docName)}"
            data-doc-title="${escapeHtml(docTitle)}"
            title="Lưu vào Studio Drive"
          >
            <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Lưu Drive</span>
          </button>
          <button
            type="button"
            class="btn-trash-scribd-doc inline-flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer min-h-[36px] min-w-[36px]"
            data-doc-name="${escapeHtml(docName)}"
            title="Xóa"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : `
          <button
            type="button"
            class="btn-restore-scribd-doc inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.12] transition cursor-pointer min-h-[36px]"
            data-doc-name="${escapeHtml(docName)}"
            title="Khôi phục"
          >
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Khôi phục</span>
          </button>
          <button
            type="button"
            class="btn-perm-delete-scribd-doc inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer min-h-[36px]"
            data-doc-name="${escapeHtml(docName)}"
            title="Xóa vĩnh viễn"
          >
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
            <span>Xóa hẳn</span>
          </button>
        `}
      </div>
    </div>
  `;
}
