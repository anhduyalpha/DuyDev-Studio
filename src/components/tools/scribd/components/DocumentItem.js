/**
 * DocumentItem Component - Stitch Editorial Bookshelf Book-Spine Card
 * Scoped for Scribd Document Archiver.
 * Implements 4px vertical Terracotta book-spine bar, 3:4 miniature book badge,
 * clean monospace metadata, and highlighted action controls.
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentItem(doc, isTrash = false, options = {}) {
  const docName = doc.name || 'Tài liệu không tên';
  const docTitle = doc.title || docName;
  const docSize = doc.size || (doc.size_mb ? `${doc.size_mb} MB` : (doc.size_bytes ? `${(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ''));
  const timeStr = doc.time || '';
  const uploader = doc.downloaded_by?.name || doc.downloaded_by?.device || doc.uploader || 'Web';
  const downloadUrl = `/api/v1/scribd/download/${encodeURIComponent(docName)}`;
  const streamUrl = `/api/v1/scribd/stream?file=${encodeURIComponent(docName)}`;

  const isDownloaded = Boolean(!isTrash && (doc.isDownloaded || options.isDownloaded));
  const isJustDownloaded = Boolean(!isTrash && (doc.isJustDownloaded || options.isJustDownloaded));
  const itemClasses = ['file-item', 'scribd-book-card'];
  if (isDownloaded) itemClasses.push('file-item-downloaded');
  if (isJustDownloaded) itemClasses.push('file-item-just-downloaded');

  return `
    <div class="${itemClasses.join(' ')}" data-doc-name="${escapeHtml(docName)}">
      <!-- 1. 4px Vertical Terracotta Book-Spine Accent Bar -->
      <div class="scribd-book-spine"></div>

      <!-- 2. Content Row: 3:4 Miniature Cover + Metadata -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <!-- Left: Book Badge + Title + Pills -->
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <!-- 3:4 Miniature Book-Cover Badge -->
          <div class="scribd-book-badge" title="Định dạng PDF nguyên bản">
            <span class="text-[8px] font-mono font-bold text-[#EA580C] dark:text-orange-400">PDF</span>
            <i data-lucide="book-open" class="w-3.5 h-3.5 text-[#EA580C] dark:text-orange-400/90 my-auto"></i>
            <span class="w-3 h-[1.5px] bg-[#EA580C]/30 dark:bg-orange-400/30 rounded-full"></span>
          </div>

          <!-- Title & Monospace Metadata -->
          <div class="min-w-0 flex-1 space-y-1">
            <span
              class="file-name btn-view-scribd-doc text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#EA580C] dark:hover:text-orange-400 line-clamp-2 cursor-pointer transition select-none"
              data-doc-name="${escapeHtml(docName)}"
              data-doc-title="${escapeHtml(docTitle)}"
              data-stream-url="${escapeHtml(streamUrl)}"
              data-download-url="${escapeHtml(downloadUrl)}"
              title="${escapeHtml(docTitle)}"
            >
              ${escapeHtml(docTitle)}
            </span>

            <div class="file-meta-row flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              ${docSize ? `
                <span class="meta-pill px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/50">
                  ${escapeHtml(docSize)}
                </span>
              ` : ''}

              ${timeStr ? `
                <span class="meta-pill px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/50">
                  ${escapeHtml(timeStr)}
                </span>
              ` : ''}

              <span class="meta-pill px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/50 inline-flex items-center gap-1" title="Người tải: ${escapeHtml(uploader)}">
                <i data-lucide="user" class="w-3 h-3 text-zinc-400"></i>
                <span class="truncate max-w-[100px]">${escapeHtml(uploader)}</span>
              </span>

              ${doc.from_drive ? `
                <span class="meta-pill px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 inline-flex items-center gap-1">
                  <i data-lucide="check" class="w-3 h-3"></i>
                  <span>Drive</span>
                </span>
              ` : ''}

              ${isDownloaded ? `
                <span class="meta-pill px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1" title="Tệp đã tải về máy">
                  <i data-lucide="${isJustDownloaded ? 'sparkles' : 'check'}" class="w-3 h-3 text-emerald-500"></i>
                  <span>${isJustDownloaded ? 'Vừa tải xong' : 'Đã tải'}</span>
                </span>
              ` : ''}

              ${isTrash ? `
                <span class="meta-pill px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/25">
                  Thùng rác
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Right: Action Buttons Strip -->
        <div class="file-actions flex flex-wrap items-center gap-1.5 sm:self-center shrink-0 pt-1 sm:pt-0">
          ${!isTrash ? `
            <button
              type="button"
              class="btn-book-action btn-view btn-view-scribd-doc touch-manipulation"
              data-doc-name="${escapeHtml(docName)}"
              data-doc-title="${escapeHtml(docTitle)}"
              data-stream-url="${escapeHtml(streamUrl)}"
              data-download-url="${escapeHtml(downloadUrl)}"
              title="Đọc tài liệu"
            >
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              <span>Đọc</span>
            </button>

            <a
              href="${downloadUrl}"
              download="${escapeHtml(docName)}"
              class="btn-book-action btn-dl btn-dl-highlight touch-manipulation font-semibold"
              data-doc-name="${escapeHtml(docName)}"
              title="Tải tệp PDF"
            >
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Tải PDF</span>
            </a>

            <button
              type="button"
              class="btn-book-action btn-drive btn-save-scribd-drive touch-manipulation"
              data-doc-name="${escapeHtml(docName)}"
              data-doc-title="${escapeHtml(docTitle)}"
              title="Lưu vào Drive"
            >
              <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
              <span>Drive</span>
            </button>

            <button
              type="button"
              class="btn-book-action btn-del btn-trash-scribd-doc min-w-[44px] text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 touch-manipulation"
              data-doc-name="${escapeHtml(docName)}"
              title="Chuyển vào thùng rác"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          ` : `
            <button
              type="button"
              class="btn-book-action btn-restore btn-restore-scribd-doc touch-manipulation"
              data-doc-name="${escapeHtml(docName)}"
              title="Khôi phục tài liệu"
            >
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Khôi phục</span>
            </button>

            <button
              type="button"
              class="btn-book-action btn-del btn-delete-perm-scribd-doc min-w-[44px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 touch-manipulation"
              data-doc-name="${escapeHtml(docName)}"
              title="Xóa vĩnh viễn"
            >
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          `}
        </div>
      </div>
    </div>
  `.trim();
}
