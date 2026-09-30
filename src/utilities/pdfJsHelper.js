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
    const script = document.createElement('script');
    script.src = '/pdfjs/build/pdf.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js library failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load /pdfjs/build/pdf.js'));
    document.head.appendChild(script);
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
