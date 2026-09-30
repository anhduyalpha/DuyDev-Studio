/**
 * docxHelper (< 50 lines)
 * Reusable utility to dynamically load docx-preview on demand
 */

let docxPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Không thể tải ${src}`));
    };
    document.head.appendChild(script);
  });
}

export function ensureDocxLoaded() {
  if (window.docx) {
    return Promise.resolve(window.docx);
  }

  if (docxPromise) return docxPromise;

  docxPromise = (async () => {
    try {
      if (!window.JSZip) {
        await loadScript('/src/vendor/jszip.min.js');
      }
      if (!window.docx) {
        await loadScript('/src/vendor/docx-preview.min.js');
      }
      if (!window.docx) {
        throw new Error('Thư viện docx-preview không khởi tạo được');
      }
      return window.docx;
    } catch (err) {
      docxPromise = null;
      throw err;
    }
  })();

  return docxPromise;
}
