/**
 * Universal Clipboard Utility
 * Handles modern async Clipboard API with bulletproof fallbacks for
 * insecure HTTP LAN environments (document.execCommand).
 */

export async function copyText(text) {
  if (!text) return false;

  // 1. Try modern async Clipboard API if available and document has focus
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Insecure context or focus error; fall back to execCommand
    }
  }

  // 2. Robust execCommand fallback (works in HTTP, LAN IP, iframes)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export function dataUrlToBlob(dataUrl) {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (e) {
    console.warn('[Clipboard] dataUrlToBlob error:', e);
    return null;
  }
}

export async function svgToPngBlob(svgDataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 512;
          canvas.height = img.naturalHeight || 512;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => resolve(b), 'image/png');
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = svgDataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Copies a QR image blob or falls back to text/URL in clipboard.
 * @param {Object} options
 * @param {Blob} [options.blob]
 * @param {string} [options.dataUrl]
 * @param {string} [options.text]
 * @returns {Promise<{ success: boolean, mode: 'image'|'text'|'none' }>}
 */
export async function copyQrImageOrFallback({ blob, dataUrl, text }) {
  let targetBlob = blob;

  // 1. Resolve blob from dataUrl
  if (!targetBlob && dataUrl) {
    if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/webp')) {
      targetBlob = dataUrlToBlob(dataUrl);
    } else if (dataUrl.startsWith('data:image/svg+xml') || dataUrl.includes('<svg')) {
      targetBlob = await svgToPngBlob(dataUrl);
    }
  }

  // 2. Try copying binary PNG image if ClipboardItem is supported
  if (targetBlob && navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof window.ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': targetBlob })
      ]);
      return { success: true, mode: 'image' };
    } catch (err) {
      console.warn('[Clipboard] Image copy failed, falling back to text:', err);
    }
  }

  // 3. Fallback: Copy link, content, or data URL as text
  const targetText = text || dataUrl || '';
  if (targetText) {
    const ok = await copyText(targetText);
    if (ok) {
      return { success: true, mode: 'text' };
    }
  }

  return { success: false, mode: 'none' };
}
