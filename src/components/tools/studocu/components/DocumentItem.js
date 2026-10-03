/**
 * DocumentItem Component (< 110 lines)
 * Renders individual document row with obsidian styling matching Studocu Downloader specifications.
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentItem(doc, isTrash = false) {
  const isPdf = Boolean(doc.is_pdf ?? (doc.format === 'pdf' || (doc.name && doc.name.toLowerCase().endsWith('.pdf'))));
  const hasHexId = Boolean(doc.id && /^[0-9a-f]{16}$/i.test(doc.id));
  const docId = hasHexId ? doc.id : (doc.name || 'document');
  const docName = doc.name || 'Tài liệu không tên';
  const docSize = doc.size || (doc.size_mb ? `${doc.size_mb} MB` : (doc.size_bytes ? `${(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ''));
  const timeStr = doc.time || '';
  const uploader = doc.downloaded_by?.name || doc.downloaded_by?.device || doc.uploader || 'Web';
  const streamUrl = hasHexId
    ? `/api/v1/studocu/stream?id=${encodeURIComponent(doc.id)}`
    : `/api/v1/studocu/stream?file=${encodeURIComponent(docName)}`;
  const downloadUrl = `/api/v1/studocu/download/${encodeURIComponent(docName)}`;

  return `
    <div class="file-item">
      <!-- Left: File Badge & Info -->
      <div class="file-item-left">
        <div class="file-type-badge ${isPdf ? 'badge-type-pdf' : 'badge-type-md'}">
          ${isPdf ? 'PDF' : 'MD'}
        </div>
        <div class="file-info">
          <span
            class="file-name btn-view-doc cursor-pointer"
            data-doc-id="${escapeHtml(docId)}"
            data-doc-name="${escapeHtml(docName)}"
            title="${escapeHtml(docName)}"
          >
            ${escapeHtml(docName)}
          </span>
          <div class="file-meta-row">
            ${docSize ? `<span class="meta-pill">${escapeHtml(docSize)}</span>` : ''}
            ${timeStr ? `<span class="meta-pill">${escapeHtml(timeStr)}</span>` : ''}
            <span class="meta-pill meta-user" title="Người tải: ${escapeHtml(uploader)}">
              <i data-lucide="user" class="w-3 h-3"></i>
              <span>${escapeHtml(uploader)}</span>
            </span>
            ${isTrash ? '<span class="meta-pill text-rose-400 border-rose-500/25">Thùng rác</span>' : ''}
          </div>
        </div>
      </div>

      <!-- Right: Action Buttons (Xem, Tải, Xóa) -->
      <div class="file-actions">
        ${!isTrash ? `
          <button
            type="button"
            class="btn-action btn-view btn-view-doc"
            data-doc-id="${escapeHtml(docId)}"
            data-doc-name="${escapeHtml(docName)}"
            title="Xem"
          >
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            <span>Xem</span>
          </button>
          <a
            href="${downloadUrl}"
            download="${escapeHtml(docName)}"
            class="btn-action btn-dl"
            title="Tải về"
          >
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Tải</span>
          </a>
          <button
            type="button"
            class="btn-action btn-del btn-trash-doc"
            data-doc-name="${escapeHtml(docName)}"
            title="Xóa"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        ` : `
          <button
            type="button"
            class="btn-action btn-restore btn-restore-doc"
            data-doc-name="${escapeHtml(docName)}"
            title="Khôi phục"
          >
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Khôi phục</span>
          </button>
          <button
            type="button"
            class="btn-action btn-del btn-delete-perm-doc"
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
