/**
 * clientConverterEngine.js
 * Client-Side Fast-Path Converter Engine for File Converter Pro.
 * Provides instant in-browser conversion (< 150ms, 0ms upload) for images and text/data files.
 */

import { ensureSheetJsLoaded } from '../../../../utilities/sheetHelper.js';
import { sniffFileExtension } from '../utilities/converterFormatRegistry.js';

const CLIENT_IMAGE_SOURCES = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico'];
const CLIENT_IMAGE_TARGETS = ['png', 'jpg', 'jpeg', 'webp', 'ico', 'bmp', 'pdf'];
const MAX_IMAGE_CLIENT_SIZE = 30 * 1024 * 1024; // 30MB

const CLIENT_DATA_FORMATS = ['json', 'csv', 'txt', 'md', 'markdown', 'html', 'htm', 'xlsx'];
const MAX_DATA_CLIENT_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * Checks whether an item can be converted directly on the client side.
 * @param {Object} item - Converter queue item
 * @param {Object} options - Conversion options
 * @returns {boolean}
 */
export function canConvertClientSide(item, options = {}) {
  if (!item || !item.file) return false;

  const srcExt = (item.detectedMeta?.extension || sniffFileExtension(item.file.name, item.file.type) || '').toLowerCase().trim();
  const tgtExt = (item.targetFormat || '').toLowerCase().trim();

  if (!srcExt || !tgtExt || srcExt === tgtExt) return false;

  // 1. Image Fast-Path
  if (CLIENT_IMAGE_SOURCES.includes(srcExt) && CLIENT_IMAGE_TARGETS.includes(tgtExt)) {
    return item.file.size <= MAX_IMAGE_CLIENT_SIZE;
  }

  // 2. Data / Text Fast-Path
  if (CLIENT_DATA_FORMATS.includes(srcExt) && CLIENT_DATA_FORMATS.includes(tgtExt)) {
    return item.file.size <= MAX_DATA_CLIENT_SIZE;
  }

  return false;
}

/**
 * Executes client-side conversion for supported items.
 * @param {Object} item
 * @param {Object} options
 * @returns {Promise<{blob: Blob, fileName: string, mimeType: string, size: number}>}
 */
export async function convertClientSide(item, options = {}) {
  const srcExt = (item.detectedMeta?.extension || sniffFileExtension(item.file.name, item.file.type) || '').toLowerCase().trim();
  const tgtExt = (item.targetFormat || '').toLowerCase().trim();

  const baseName = (item.file.name || 'file').replace(/\.[^/.]+$/, '');
  const outFileName = `${baseName}.${tgtExt === 'jpeg' ? 'jpg' : tgtExt}`;

  if (CLIENT_IMAGE_SOURCES.includes(srcExt) && CLIENT_IMAGE_TARGETS.includes(tgtExt)) {
    const { blob, mimeType } = await convertImageOnClient(item.file, srcExt, tgtExt, options);
    return { blob, fileName: outFileName, mimeType, size: blob.size };
  }

  if (CLIENT_DATA_FORMATS.includes(srcExt) && CLIENT_DATA_FORMATS.includes(tgtExt)) {
    const { blob, mimeType } = await convertDataOnClient(item.file, srcExt, tgtExt, options);
    return { blob, fileName: outFileName, mimeType, size: blob.size };
  }

  throw new Error(`Định dạng ${srcExt} -> ${tgtExt} không được hỗ trợ xử lý trên trình duyệt`);
}

/**
 * Converts images using Canvas 2D and native browser codecs.
 */
async function convertImageOnClient(file, srcExt, tgtExt, options = {}) {
  const userW = Number(options.width) || 0;
  const userH = Number(options.height) || 0;
  const quality = options.quality !== undefined ? Math.max(0.1, Math.min(1.0, Number(options.quality) / 100)) : 0.85;

  let imgBitmapOrElement;
  let natWidth = 0;
  let natHeight = 0;

  if (srcExt === 'svg') {
    // Sharp 2K rendering for SVG: read SVG content and compute scale
    const svgText = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');

    let viewBoxW = 0;
    let viewBoxH = 0;
    if (svgEl) {
      const vb = svgEl.getAttribute('viewBox');
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          viewBoxW = parts[2];
          viewBoxH = parts[3];
        }
      }
      if (!viewBoxW) {
        viewBoxW = parseFloat(svgEl.getAttribute('width') || '0');
        viewBoxH = parseFloat(svgEl.getAttribute('height') || '0');
      }
    }

    if (!viewBoxW || !viewBoxH) {
      viewBoxW = 1000;
      viewBoxH = 1000;
    }

    // Default 2K resolution if not set by user
    const aspect = viewBoxW / viewBoxH;
    if (userW > 0 && userH > 0) {
      natWidth = userW;
      natHeight = userH;
    } else if (userW > 0) {
      natWidth = userW;
      natHeight = Math.round(userW / aspect);
    } else if (userH > 0) {
      natHeight = userH;
      natWidth = Math.round(userH * aspect);
    } else {
      const maxDim = 2048;
      if (aspect >= 1) {
        natWidth = maxDim;
        natHeight = Math.round(maxDim / aspect);
      } else {
        natHeight = maxDim;
        natWidth = Math.round(maxDim * aspect);
      }
    }

    // Load SVG into Image via object URL
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Không thể kết xuất tệp SVG'));
      img.src = blobUrl;
    });
    URL.revokeObjectURL(blobUrl);
    imgBitmapOrElement = img;
  } else {
    // Raster image: load via createImageBitmap or Image
    if (typeof createImageBitmap === 'function') {
      try {
        imgBitmapOrElement = await createImageBitmap(file);
        natWidth = imgBitmapOrElement.width;
        natHeight = imgBitmapOrElement.height;
      } catch (_) {
        // Fallback to Image element
        imgBitmapOrElement = await loadImageElement(file);
        natWidth = imgBitmapOrElement.naturalWidth || imgBitmapOrElement.width;
        natHeight = imgBitmapOrElement.naturalHeight || imgBitmapOrElement.height;
      }
    } else {
      imgBitmapOrElement = await loadImageElement(file);
      natWidth = imgBitmapOrElement.naturalWidth || imgBitmapOrElement.width;
      natHeight = imgBitmapOrElement.naturalHeight || imgBitmapOrElement.height;
    }

    // Determine target dimensions
    const aspect = (natWidth || 1) / (natHeight || 1);
    if (userW > 0 && userH > 0) {
      natWidth = userW;
      natHeight = userH;
    } else if (userW > 0) {
      natWidth = userW;
      natHeight = Math.round(userW / aspect);
    } else if (userH > 0) {
      natHeight = userH;
      natWidth = Math.round(userH * aspect);
    }
  }

  // Draw onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, natWidth);
  canvas.height = Math.max(1, natHeight);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill white background for formats without alpha channel
  if (['jpg', 'jpeg', 'bmp', 'pdf'].includes(tgtExt)) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(imgBitmapOrElement, 0, 0, canvas.width, canvas.height);

  // Export based on target format
  if (tgtExt === 'jpg' || tgtExt === 'jpeg') {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return { blob, mimeType: 'image/jpeg' };
  }

  if (tgtExt === 'webp') {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    return { blob, mimeType: 'image/webp' };
  }

  if (tgtExt === 'png') {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { blob, mimeType: 'image/png' };
  }

  if (tgtExt === 'bmp') {
    const blob = canvasToBmpBlob(canvas);
    return { blob, mimeType: 'image/bmp' };
  }

  if (tgtExt === 'ico') {
    // ICO icon container: scale down to 256 max if needed
    let icoCanvas = canvas;
    if (canvas.width > 256 || canvas.height > 256) {
      icoCanvas = document.createElement('canvas');
      const scale = 256 / Math.max(canvas.width, canvas.height);
      icoCanvas.width = Math.round(canvas.width * scale);
      icoCanvas.height = Math.round(canvas.height * scale);
      const icoCtx = icoCanvas.getContext('2d');
      icoCtx.imageSmoothingEnabled = true;
      icoCtx.imageSmoothingQuality = 'high';
      icoCtx.drawImage(canvas, 0, 0, icoCanvas.width, icoCanvas.height);
    }
    const pngBlob = await new Promise((res) => icoCanvas.toBlob(res, 'image/png'));
    const blob = await pngBlobToIcoBlob(pngBlob, icoCanvas.width, icoCanvas.height);
    return { blob, mimeType: 'image/x-icon' };
  }

  if (tgtExt === 'pdf') {
    const jpegBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
    const blob = await imageJpegToPdfBlob(jpegBlob, canvas.width, canvas.height);
    return { blob, mimeType: 'application/pdf' };
  }

  throw new Error(`Định dạng ảnh đích không hỗ trợ: ${tgtExt}`);
}

/**
 * Loads an image element from File.
 */
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Encodes canvas pixels into standard 24-bit uncompressed BMP blob.
 */
function canvasToBmpBlob(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint16(0, 0x4D42, false); // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true); // offset to pixels

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true); // 1 plane
  view.setUint16(28, 24, true); // 24 bpp
  view.setUint32(30, 0, true); // uncompressed
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // 72 DPI
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  const pixels = imgData.data;
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      view.setUint8(offset++, pixels[idx + 2]); // Blue
      view.setUint8(offset++, pixels[idx + 1]); // Green
      view.setUint8(offset++, pixels[idx]);     // Red
    }
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Wraps PNG image into standard Windows ICO container.
 */
async function pngBlobToIcoBlob(pngBlob, width, height) {
  const pngBuffer = await pngBlob.arrayBuffer();
  const totalSize = 22 + pngBuffer.byteLength;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // ICONDIR (6 bytes)
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true); // 1 = icon
  view.setUint16(4, 1, true); // 1 image

  // ICONDIRENTRY (16 bytes)
  view.setUint8(6, width >= 256 ? 0 : width);
  view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint8(8, 0); // color count
  view.setUint8(9, 0); // reserved
  view.setUint16(10, 1, true); // planes
  view.setUint16(12, 32, true); // bit count
  view.setUint32(14, pngBuffer.byteLength, true); // size
  view.setUint32(18, 22, true); // offset

  new Uint8Array(buffer, 22).set(new Uint8Array(pngBuffer));
  return new Blob([buffer], { type: 'image/x-icon' });
}

/**
 * Generates single-page PDF embedding JPEG.
 */
async function imageJpegToPdfBlob(jpegBlob, imgW, imgH) {
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

  // Page dimensions (points, 72 dpi)
  // Scale so page fits image aspect ratio neatly
  const ptW = Number((imgW * 0.75).toFixed(2));
  const ptH = Number((imgH * 0.75).toFixed(2));

  const contentStream = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
  const contentBytes = new TextEncoder().encode(contentStream);

  const chunks = [];
  const offsets = [];
  let currentOffset = 0;

  function addChunk(strOrBytes) {
    const b = typeof strOrBytes === 'string' ? new TextEncoder().encode(strOrBytes) : strOrBytes;
    chunks.push(b);
    currentOffset += b.byteLength;
  }

  // Header
  addChunk('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Obj 1: Catalog
  offsets.push(currentOffset);
  addChunk('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  offsets.push(currentOffset);
  addChunk('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Obj 3: Page
  offsets.push(currentOffset);
  addChunk(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

  // Obj 4: Image XObject
  offsets.push(currentOffset);
  addChunk(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`);
  addChunk(jpegBytes);
  addChunk('\nendstream\nendobj\n');

  // Obj 5: Contents
  offsets.push(currentOffset);
  addChunk(`5 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`);
  addChunk(contentBytes);
  addChunk('\nendstream\nendobj\n');

  // Xref table
  const startXref = currentOffset;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  addChunk(xref);

  return new Blob(chunks, { type: 'application/pdf' });
}

/**
 * Converts data/text formats on client side.
 */
async function convertDataOnClient(file, srcExt, tgtExt, options = {}) {
  // If XLSX is involved as source or target, utilize SheetJS
  if (srcExt === 'xlsx' || tgtExt === 'xlsx') {
    const XLSX = await ensureSheetJsLoaded();

    if (srcExt === 'xlsx') {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];

      if (tgtExt === 'csv') {
        const csvStr = XLSX.utils.sheet_to_csv(firstSheet);
        return { blob: new Blob([csvStr], { type: 'text/csv;charset=utf-8' }), mimeType: 'text/csv' };
      }
      if (tgtExt === 'json') {
        const jsonArr = XLSX.utils.sheet_to_json(firstSheet);
        const jsonStr = JSON.stringify(jsonArr, null, 2);
        return { blob: new Blob([jsonStr], { type: 'application/json;charset=utf-8' }), mimeType: 'application/json' };
      }
      if (tgtExt === 'html' || tgtExt === 'htm') {
        const htmlStr = XLSX.utils.sheet_to_html(firstSheet);
        return { blob: new Blob([htmlStr], { type: 'text/html;charset=utf-8' }), mimeType: 'text/html' };
      }
      if (tgtExt === 'txt') {
        const txtStr = XLSX.utils.sheet_to_txt(firstSheet);
        return { blob: new Blob([txtStr], { type: 'text/plain;charset=utf-8' }), mimeType: 'text/plain' };
      }
    }

    if (tgtExt === 'xlsx') {
      const text = await file.text();
      let wb;
      if (srcExt === 'json') {
        try {
          const parsed = JSON.parse(text);
          const data = Array.isArray(parsed) ? parsed : [parsed];
          const ws = XLSX.utils.json_to_sheet(data);
          wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        } catch (_) {
          throw new Error('Nội dung JSON không hợp lệ');
        }
      } else {
        // CSV / TXT / HTML table
        wb = XLSX.read(text, { type: 'string' });
      }

      const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return {
        blob: new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    }
  }

  // Pure text/data conversions (CSV, JSON, TXT, MD, HTML)
  const textContent = await file.text();

  if (srcExt === 'csv' && tgtExt === 'json') {
    const jsonStr = csvToJson(textContent);
    return { blob: new Blob([jsonStr], { type: 'application/json;charset=utf-8' }), mimeType: 'application/json' };
  }

  if (srcExt === 'json' && tgtExt === 'csv') {
    const csvStr = jsonToCsv(textContent);
    return { blob: new Blob([csvStr], { type: 'text/csv;charset=utf-8' }), mimeType: 'text/csv' };
  }

  if ((srcExt === 'md' || srcExt === 'markdown') && (tgtExt === 'html' || tgtExt === 'htm')) {
    const htmlStr = markdownToHtml(textContent, file.name);
    return { blob: new Blob([htmlStr], { type: 'text/html;charset=utf-8' }), mimeType: 'text/html' };
  }

  if ((srcExt === 'html' || srcExt === 'htm') && (tgtExt === 'md' || tgtExt === 'txt')) {
    const extracted = htmlToMarkdownOrTxt(textContent, tgtExt);
    const mime = tgtExt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    return { blob: new Blob([extracted], { type: mime }), mimeType: mime };
  }

  if (srcExt === 'txt' && (tgtExt === 'html' || tgtExt === 'htm')) {
    const htmlStr = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title></head><body><pre style="white-space:pre-wrap;font-family:monospace;">${escapeHtml(textContent)}</pre></body></html>`;
    return { blob: new Blob([htmlStr], { type: 'text/html;charset=utf-8' }), mimeType: 'text/html' };
  }

  if (srcExt === 'txt' && (tgtExt === 'md' || tgtExt === 'markdown')) {
    return { blob: new Blob([textContent], { type: 'text/markdown;charset=utf-8' }), mimeType: 'text/markdown' };
  }

  if ((srcExt === 'md' || srcExt === 'markdown') && tgtExt === 'txt') {
    const txt = textContent.replace(/#+\s/g, '').replace(/[*_~`]/g, '');
    return { blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }), mimeType: 'text/plain' };
  }

  // Generic pass-through if formats are text
  return {
    blob: new Blob([textContent], { type: 'text/plain;charset=utf-8' }),
    mimeType: 'text/plain'
  };
}

function csvToJson(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return '[]';
  const headers = parseCsvRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `col_${idx}`] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(obj);
  }
  return JSON.stringify(rows, null, 2);
}

function parseCsvRow(rowStr) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < rowStr.length; i++) {
    const c = rowStr[i];
    if (c === '"') {
      if (inQuotes && rowStr[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function jsonToCsv(jsonText) {
  const parsed = JSON.parse(jsonText);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  if (arr.length === 0) return '';
  const headers = Array.from(new Set(arr.flatMap((it) => Object.keys(it))));
  const csvLines = [headers.map(escapeCsvCell).join(',')];
  for (const item of arr) {
    const row = headers.map((h) => escapeCsvCell(item[h] !== undefined ? item[h] : ''));
    csvLines.push(row.join(','));
  }
  return csvLines.join('\n');
}

function escapeCsvCell(val) {
  const str = String(val === null || val === undefined ? '' : val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function markdownToHtml(mdText, title) {
  let html = escapeHtml(mdText);
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  // Paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#222;}</style></head><body><p>${html}</p></body></html>`;
}

function htmlToMarkdownOrTxt(htmlText, targetExt) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  if (targetExt === 'txt') {
    return doc.body.textContent || '';
  }
  // Basic markdown extraction
  let md = '';
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'h1') md += `# ${node.textContent.trim()}\n\n`;
      else if (tag === 'h2') md += `## ${node.textContent.trim()}\n\n`;
      else if (tag === 'h3') md += `### ${node.textContent.trim()}\n\n`;
      else if (tag === 'p') md += `${node.textContent.trim()}\n\n`;
      else if (tag === 'pre') md += `\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
      else md += `${node.textContent.trim()}\n\n`;
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      md += `${node.textContent.trim()}\n\n`;
    }
  });
  return md.trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
