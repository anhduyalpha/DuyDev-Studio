/**
 * useQrPaste - Universal Clipboard & Paste Handler for QR Scanner
 * Supports Ctrl+V keyboard paste, clipboard API, and data URLs (< 90 lines)
 */

import { processScanFile } from './useQrActions.js';
import { showToast } from '../../../../utilities/toast.js';

let activePasteListener = null;

export function detachQrPasteHandler() {
  if (activePasteListener) {
    window.removeEventListener('paste', activePasteListener);
    activePasteListener = null;
  }
}

export function attachQrPasteHandler(onReRender) {
  detachQrPasteHandler();

  activePasteListener = async (e) => {
    const targetTag = document.activeElement?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea') return;

    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            showToast('Đang giải mã ảnh vừa dán (Ctrl + V)...', 'info');
            await processScanFile(file, onReRender);
            return;
          }
        }
      }
    }

    const text = e.clipboardData?.getData('text')?.trim();
    if (text && (text.startsWith('data:image/') || /^https?:\/\/.*\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(text))) {
      e.preventDefault();
      try {
        showToast('Đang tải và quét ảnh...', 'info');
        const res = await fetch(text);
        const blob = await res.blob();
        const file = new File([blob], 'pasted-qr.png', { type: blob.type || 'image/png' });
        await processScanFile(file, onReRender);
      } catch {
        showToast('Không thể tải ảnh từ URL vừa dán', 'error');
      }
    }
  };

  window.addEventListener('paste', activePasteListener);
}

export async function handleClipboardPaste(onReRender) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'clipboard-qr.png', { type: imageType });
          showToast('Đang quét ảnh từ Clipboard...', 'info');
          await processScanFile(file, onReRender);
          return;
        }
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      const text = (await navigator.clipboard.readText()).trim();
      if (text && (text.startsWith('data:image/') || /^https?:\/\/.*\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(text))) {
        showToast('Đang tải và quét ảnh từ Clipboard...', 'info');
        const res = await fetch(text);
        const blob = await res.blob();
        const file = new File([blob], 'clipboard-qr.png', { type: blob.type || 'image/png' });
        await processScanFile(file, onReRender);
        return;
      }
    }

    showToast('Không tìm thấy ảnh trong Clipboard. Vui lòng copy ảnh rồi bấm dán.', 'info');
  } catch {
    showToast('Chưa cấp quyền truy cập Clipboard. Bạn có thể nhấn Ctrl + V để dán trực tiếp.', 'error');
  }
}
