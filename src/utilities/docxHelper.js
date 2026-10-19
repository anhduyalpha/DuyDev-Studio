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
        const jszipUrl = typeof window !== 'undefined' ? new URL('/src/vendor/jszip.min.js', window.location.origin).href : '/src/vendor/jszip.min.js';
        await loadScript(jszipUrl);
      }
      if (!window.docx) {
        const docxUrl = typeof window !== 'undefined' ? new URL('/src/vendor/docx-preview.min.js', window.location.origin).href : '/src/vendor/docx-preview.min.js';
        await loadScript(docxUrl);
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
