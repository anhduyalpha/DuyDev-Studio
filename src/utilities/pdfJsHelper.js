/**
 * pdfJsHelper (< 60 lines)
 * Reusable utility to dynamically initialize PDF.js and render page thumbnails
 */

let pdfJsPromise = null;

export function ensurePdfJsLoaded() {
  if (window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.js';
    }
    return Promise.resolve(window.pdfjsLib);
  }

  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    const loadScript = (src, isFallback = false) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = isFallback
            ? 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            : '/pdfjs/build/pdf.worker.js';
          resolve(window.pdfjsLib);
        } else if (!isFallback) {
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', true);
        } else {
          reject(new Error('PDF.js library failed to initialize'));
        }
      };
      script.onerror = () => {
        if (!isFallback) {
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', true);
        } else {
          reject(new Error('Failed to load PDF.js engine from both local and CDN'));
        }
      };
      document.head.appendChild(script);
    };

    loadScript('/pdfjs/build/pdf.js');
  });

  return pdfJsPromise;
}

export async function renderPageThumbnail(page, canvas, maxDimension = 260) {
  if (!page || !canvas) return;
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxDimension / initialViewport.width, maxDimension / initialViewport.height);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await page.render({ canvasContext: ctx, viewport }).promise;
}
