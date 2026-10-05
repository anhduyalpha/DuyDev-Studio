/**
 * usePdfPaste - Universal Clipboard & Paste Handler for PDF Studio (Images to PDF)
 * Supports Ctrl+V keyboard shortcut, clipboard API, and data URLs (< 120 lines)
 */

import { showToast } from '../../../../utilities/toast.js';

/**
 * Extracts valid image files from clipboard DataTransfer / items
 * @param {DataTransfer} clipboardData
 * @returns {Promise<File[]>}
 */
export async function extractImagesFromClipboard(clipboardData) {
  if (!clipboardData) return [];
  const files = [];
  const items = clipboardData.items;

  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type && item.type.startsWith('image/')) {
        const blob = item.getAsFile ? item.getAsFile() : null;
        if (blob) {
          const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          const isGenericName = !blob.name || blob.name === 'image.png' || blob.name === 'blob';
          const fileName = isGenericName
            ? `anh_dan_${Date.now()}_${i + 1}.${ext}`
            : blob.name;
          files.push(new File([blob], fileName, { type: blob.type || `image/${ext}` }));
        }
      }
    }
  }

  // Fallback to files list if items didn't produce files
  if (files.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff|avif)$/i.test(f.name)) {
        files.push(f);
      }
    }
  }

  // Check if text is a data URL (e.g. data:image/png;base64,...)
  if (files.length === 0 && typeof clipboardData.getData === 'function') {
    const text = clipboardData.getData('text')?.trim();
    if (text && text.startsWith('data:image/')) {
      try {
        const res = await fetch(text);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        files.push(new File([blob], `anh_dan_${Date.now()}.${ext}`, { type: blob.type }));
      } catch {}
    }
  }

  return files;
}

/**
 * Reads images programmatically from navigator.clipboard API
 * @param {object} queueManager
 */
export async function pasteImageFromClipboard(queueManager) {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      showToast('Trình duyệt không hỗ trợ đọc ảnh từ clipboard. Hãy bấm phím Ctrl+V để dán trực tiếp.', 'info');
      return;
    }
    const clipboardItems = await navigator.clipboard.read();
    const files = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          files.push(new File([blob], `anh_dan_${Date.now()}_${i + 1}.${ext}`, { type }));
          break;
        }
      }
    }

    if (files.length > 0) {
      await queueManager.addFiles(files);
      showToast(files.length === 1 ? 'Đã dán 1 ảnh từ bộ nhớ tạm' : `Đã dán ${files.length} ảnh từ bộ nhớ tạm`, 'success');
    } else {
      showToast('Không tìm thấy hình ảnh nào trong bộ nhớ tạm', 'info');
    }
  } catch (err) {
    showToast('Vui lòng cấp quyền truy cập bộ nhớ tạm hoặc nhấn phím Ctrl+V để dán ảnh', 'warning');
  }
}

/**
 * Attaches global paste listener for Ctrl+V image insertion into PDF Studio
 * @param {object} queueManager
 * @returns {() => void} Cleanup function to detach listener
 */
export function attachPdfClipboardPaste(queueManager) {
  const handlePasteEvent = async (e) => {
    // Only handle when PDF Studio workspace is mounted and in images_to_pdf mode
    const dropzoneContainer = document.getElementById('pdfDropzoneContainer');
    if (!dropzoneContainer || queueManager.mode !== 'images_to_pdf') return;

    // Do not intercept if user is typing in an active text input or textarea
    const activeEl = document.activeElement;
    if (activeEl) {
      const tag = activeEl.tagName.toLowerCase();
      const type = (activeEl.type || '').toLowerCase();
      if (tag === 'textarea' || (tag === 'input' && !['button', 'checkbox', 'radio', 'file', 'submit'].includes(type))) {
        return;
      }
    }

    const files = await extractImagesFromClipboard(e.clipboardData);
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await queueManager.addFiles(files);
      showToast(files.length === 1 ? 'Đã dán 1 ảnh từ bộ nhớ tạm (Ctrl+V)' : `Đã dán ${files.length} ảnh từ bộ nhớ tạm (Ctrl+V)`, 'success');
    }
  };

  window.addEventListener('paste', handlePasteEvent);

  return () => {
    window.removeEventListener('paste', handlePasteEvent);
  };
}
