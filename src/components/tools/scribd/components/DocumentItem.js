/**
 * DocumentItem Component (< 120 lines)
 * Renders individual document row with obsidian styling matching Studocu specifications.
 * Scoped for Scribd Document Archiver.
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
  const itemClasses = ['file-item'];
  if (isDownloaded) itemClasses.push('file-item-downloaded');
  if (isJustDownloaded) itemClasses.push('file-item-just-downloaded');

  return `
    <div class="${itemClasses.join(' ')}" data-doc-name="${escapeHtml(docName)}">
      <!-- Left: File Badge & Info -->
      <div class="file-item-left">
        <div class="file-type-badge badge-type-pdf">
          PDF
        </div>
        <div class="file-info">
          <span
            class="file-name btn-view-scribd-doc cursor-pointer"
            data-doc-name="${escapeHtml(docName)}"
            data-doc-title="${escapeHtml(docTitle)}"
            data-stream-url="${escapeHtml(streamUrl)}"
            data-download-url="${escapeHtml(downloadUrl)}"
            title="${escapeHtml(docTitle)}"
          >
            ${escapeHtml(docTitle)}
          </span>
          <div class="file-meta-row">
            ${docSize ? `<span class="meta-pill">${escapeHtml(docSize)}</span>` : ''}
            ${timeStr ? `<span class="meta-pill">${escapeHtml(timeStr)}</span>` : ''}
            <span class="meta-pill meta-user" title="Người tải: ${escapeHtml(uploader)}">
              <i data-lucide="user" class="w-3 h-3"></i>
              <span>${escapeHtml(uploader)}</span>
            </span>
            ${doc.from_drive ? '<span class="meta-pill text-indigo-600 dark:text-indigo-400 border-indigo-500/25">Đã lưu Drive</span>' : ''}
            ${isDownloaded ? `
              <span class="meta-pill meta-downloaded text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-medium inline-flex items-center gap-1" title="Tệp đã tải về">
                <i data-lucide="${isJustDownloaded ? 'sparkles' : 'check'}" class="w-3 h-3 text-emerald-500"></i>
                <span>${isJustDownloaded ? 'Vừa tải xong' : 'Đã tải'}</span>
              </span>
            ` : ''}
            ${isTrash ? '<span class="meta-pill text-rose-500 dark:text-rose-400 border-rose-500/25">Thùng rác</span>' : ''}
          </div>
        </div>
      </div>

      <!-- Right: Action Buttons (Xem, Tải, Lưu Drive, Xóa) -->
      <div class="file-actions">
        ${!isTrash ? `
          <button
            type="button"
            class="btn-action btn-view btn-view-scribd-doc"
            data-doc-name="${escapeHtml(docName)}"
            data-doc-title="${escapeHtml(docTitle)}"
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
            class="btn-action btn-dl"
            title="Tải về"
            data-doc-name="${escapeHtml(docName)}"
          >
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Tải</span>
          </a>
          <button
            type="button"
            class="btn-action btn-drive btn-save-scribd-drive"
            data-doc-name="${escapeHtml(docName)}"
            data-doc-title="${escapeHtml(docTitle)}"
            title="Lưu vào Studio Drive"
          >
            <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
            <span>Drive</span>
          </button>
          <button
            type="button"
            class="btn-action btn-del btn-trash-scribd-doc"
            data-doc-name="${escapeHtml(docName)}"
            title="Xóa"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        ` : `
          <button
            type="button"
            class="btn-action btn-restore btn-restore-scribd-doc"
            data-doc-name="${escapeHtml(docName)}"
            title="Khôi phục"
          >
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Khôi phục</span>
          </button>
          <button
            type="button"
            class="btn-action btn-del btn-delete-perm-scribd-doc"
            data-doc-name="${escapeHtml(docName)}"
            title="Xóa vĩnh viễn"
          >
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        `}
      </div>
    </div>
  `.trim();
}
