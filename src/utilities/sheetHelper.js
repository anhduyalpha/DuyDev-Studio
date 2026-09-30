/**
 * sheetHelper (< 50 lines)
 * Reusable utility to dynamically load SheetJS (XLSX) on demand
 */

let sheetPromise = null;

export function ensureSheetJsLoaded() {
  if (window.XLSX) {
    return Promise.resolve(window.XLSX);
  }

  if (sheetPromise) return sheetPromise;

  sheetPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/src/vendor/xlsx.full.min.js';
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        sheetPromise = null;
        script.remove();
        reject(new Error('Thư viện SheetJS không khởi tạo được'));
      }
    };
    script.onerror = () => {
      sheetPromise = null;
      script.remove();
      reject(new Error('Không thể tải /src/vendor/xlsx.full.min.js'));
    };
    document.head.appendChild(script);
  });

  return sheetPromise;
}
