/**
 * DocumentItem Component - Stitch Editorial Bookshelf Book-Spine Card
 * Scoped for Scribd Document Archiver.
 * Implements 4px vertical Terracotta book-spine bar, 3:4 miniature book badge,
 * clean non-truncated metadata, comfortable 15.5px title, and full-width balanced action buttons.
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCleanTime(timeStr) {
  if (!timeStr) return '';
  const str = String(timeStr).trim();
  // Case 1: YYYY-MM-DD[T or space]HH:mm(:ss)?(.fraction)?(Z/offset)?
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}:\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
  if (ymdMatch) {
    const [, y, m, d, hm] = ymdMatch;
    const dd = d.padStart(2, '0');
    const mm = m.padStart(2, '0');
    return `${dd}/${mm}/${y} ${hm}`;
  }
  // Case 2: DD/MM/YYYY HH:mm:ss -> DD/MM/YYYY HH:mm
  const dmyMatch = str.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s+\d{1,2}:\d{2})(?::\d{2})?$/);
  if (dmyMatch) {
    return dmyMatch[1];
  }
  // Case 3: HH:mm:ss -> HH:mm
  const timeOnly = str.match(/^(\d{1,2}:\d{2}):\d{2}$/);
  if (timeOnly) {
    return timeOnly[1];
  }
  return str;
}

export function renderDocumentItem(doc, isTrash = false, options = {}) {
  const docName = doc.name || 'Tài liệu không tên';
  const docTitle = doc.title || docName;
  const docSize = doc.size || (doc.size_mb ? `${doc.size_mb} MB` : (doc.size_bytes ? `${(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ''));
  const rawTime = doc.time || doc.created_at || (doc.mtime ? new Date(doc.mtime * 1000).toISOString() : '');
  const cleanTime = formatCleanTime(rawTime);
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

      <!-- 2. Content Row: Sleek 38x38px Badge + Title + Clean Metadata -->
      <div class="flex items-start gap-3 min-w-0">
        <!-- Sleek Compact 38x38px Icon Badge (aligned with title) -->
        <div class="scribd-book-badge shrink-0" title="Tài liệu PDF Scribd">
          <i data-lucide="book-open" class="w-4 h-4 text-[#EA580C] dark:text-orange-400"></i>
        </div>

        <!-- Title & Clean Monospace Metadata -->
        <div class="min-w-0 flex-1 space-y-1.5">
          <span
            class="file-name btn-view-scribd-doc text-[15.5px] leading-[1.4] font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#EA580C] dark:hover:text-orange-400 line-clamp-2 cursor-pointer transition select-none block"
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
              <span class="meta-pill px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/50 whitespace-nowrap">
                ${escapeHtml(docSize)}
              </span>
            ` : ''}

            ${cleanTime ? `
              <span class="meta-pill px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/50 whitespace-nowrap">
                ${escapeHtml(cleanTime)}
              </span>
            ` : ''}

            ${doc.from_drive ? `
              <span class="meta-pill px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 inline-flex items-center gap-1 whitespace-nowrap">
                <i data-lucide="check" class="w-3 h-3"></i>
                <span>Drive</span>
              </span>
            ` : ''}

            ${isDownloaded ? `
              <span class="meta-pill px-2 py-0.5 rounded-md bg-orange-500/10 text-[#EA580C] dark:text-orange-400 border border-orange-500/25 inline-flex items-center gap-1 whitespace-nowrap" title="Tệp đã tải về máy">
                <i data-lucide="${isJustDownloaded ? 'sparkles' : 'check'}" class="w-3 h-3 text-[#EA580C] dark:text-orange-400"></i>
                <span>${isJustDownloaded ? 'Vừa tải xong' : 'Đã tải'}</span>
              </span>
            ` : ''}

            ${isTrash ? `
              <span class="meta-pill px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/25 whitespace-nowrap">
                Thùng rác
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- 3. Bottom Action Row: Full-Width Balanced Action Bar -->
      <div class="file-actions w-full flex items-center gap-2.5 pt-1 shrink-0">
        ${!isTrash ? `
          <button
            type="button"
            class="btn-book-action btn-view btn-view-scribd-doc flex-1 h-[44px] min-h-[44px] px-3.5 rounded-xl text-sm font-semibold touch-manipulation cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            data-doc-name="${escapeHtml(docName)}"
            data-doc-title="${escapeHtml(docTitle)}"
            data-stream-url="${escapeHtml(streamUrl)}"
            data-download-url="${escapeHtml(downloadUrl)}"
            title="Đọc tài liệu"
          >
            <i data-lucide="eye" class="w-4 h-4 shrink-0"></i>
            <span>Đọc</span>
          </button>

          <a
            href="${downloadUrl}"
            download="${escapeHtml(docName)}"
            class="btn-book-action btn-dl btn-dl-highlight flex-[1.2] h-[44px] min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            data-doc-name="${escapeHtml(docName)}"
            title="Tải tệp PDF"
          >
            <i data-lucide="download" class="w-4 h-4 shrink-0"></i>
            <span>Tải PDF</span>
          </a>

          <button
            type="button"
            class="btn-book-action btn-del btn-trash-scribd-doc w-[44px] min-w-[44px] h-[44px] min-h-[44px] p-0 rounded-xl shrink-0 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 touch-manipulation cursor-pointer inline-flex items-center justify-center"
            data-doc-name="${escapeHtml(docName)}"
            title="Chuyển vào thùng rác"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : `
          <button
            type="button"
            class="btn-book-action btn-restore btn-restore-scribd-doc flex-1 h-[44px] min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            data-doc-name="${escapeHtml(docName)}"
            title="Khôi phục tài liệu"
          >
            <i data-lucide="rotate-ccw" class="w-4 h-4 shrink-0"></i>
            <span>Khôi phục</span>
          </button>

          <button
            type="button"
            class="btn-book-action btn-del btn-delete-perm-scribd-doc w-[44px] min-w-[44px] h-[44px] min-h-[44px] p-0 rounded-xl shrink-0 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 touch-manipulation cursor-pointer inline-flex items-center justify-center"
            data-doc-name="${escapeHtml(docName)}"
            title="Xóa vĩnh viễn"
          >
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        `}
      </div>
    </div>
  `.trim();
}
