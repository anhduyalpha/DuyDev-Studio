/**
 * pdfLibHelper (< 50 lines)
 * On-demand dynamic loader for offline pdf-lib PWA asset
 */

let pdfLibPromise = null;

export function ensurePdfLibLoaded() {
  if (typeof window !== 'undefined' && window.PDFLib) {
    return Promise.resolve(window.PDFLib);
  }

  if (pdfLibPromise) return pdfLibPromise;

  pdfLibPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !document?.head) {
      if (typeof globalThis !== 'undefined' && globalThis.PDFLib) {
        return resolve(globalThis.PDFLib);
      }
      import('pdf-lib')
        .then((mod) => resolve(mod))
        .catch(() => reject(new Error('Browser environment required for PDFLib')));
      return;
    }
    const script = document.createElement('script');
    script.src = '/src/vendor/pdf-lib.min.js';
    script.onload = () => {
      if (window.PDFLib) resolve(window.PDFLib);
      else reject(new Error('PDFLib failed to initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load /src/vendor/pdf-lib.min.js'));
    document.head.appendChild(script);
  });

  return pdfLibPromise;
}
