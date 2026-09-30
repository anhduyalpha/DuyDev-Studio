/**
 * clientPdfEngine (< 230 lines)
 * High-speed client-side PDF processing engine leveraging offline pdf-lib.
 * Handles instant Rotate, Organize, Split, Merge, Images-to-PDF, and Watermark.
 */

import { ensurePdfLibLoaded } from '../../../../utilities/pdfLibHelper.js';

export const CLIENT_PDF_MAX_BYTES = 100 * 1024 * 1024; // 100MB RAM safety cap
export const CLIENT_PDF_MAX_PAGES = 300;

export const CLIENT_SUPPORTED_MODES = new Set([
  'rotate', 'organize', 'split', 'merge', 'images_to_pdf', 'watermark'
]);

/**
 * Checks if a PDF operation can be processed safely inside browser memory.
 */
export function canHandleClientPdf(mode, files = [], totalPages = 0, options = {}) {
  if (!CLIENT_SUPPORTED_MODES.has(mode)) return false;
  if (!files || files.length === 0) return false;

  for (const f of files) {
    if (f.size > CLIENT_PDF_MAX_BYTES) return false;
  }

  if (totalPages > CLIENT_PDF_MAX_PAGES) return false;

  // Watermark with non-ASCII text requires server TrueType font engine
  if (mode === 'watermark' && options?.watermarkText && /[^\x00-\x7F]/.test(options.watermarkText)) {
    return false;
  }

  return true;
}

/**
 * Rasterizes and embeds any image (PNG, JPG, WebP, BMP) into a PDF document.
 */
async function embedImageToPdf(doc, PDFLib, file) {
  const buf = await (file.rawFile || file).arrayBuffer();
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const isJpg = mime === 'image/jpeg' || mime === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
  const isPng = mime === 'image/png' || name.endsWith('.png');

  if (isJpg) {
    try { return await doc.embedJpg(buf); } catch (_) {}
  }
  if (isPng) {
    try { return await doc.embedPng(buf); } catch (_) {}
  }

  // Convert WebP / BMP / GIF to PNG via canvas
  const blob = file.rawFile || file;
  if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(bmp, 0, 0);
    const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (bmp.close) bmp.close();
    if (pngBlob) {
      const pngBuf = await pngBlob.arrayBuffer();
      return await doc.embedPng(pngBuf);
    }
  }

  return await doc.embedPng(buf);
}

/**
 * Executes Rotate on client.
 */
async function executeRotate(PDFLib, file, options) {
  const buf = await (file.rawFile || file).arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf);
  const pages = doc.getPages();
  const rotations = options.rotations || {};
  const defaultAngle = Number(options.angle || 0);

  pages.forEach((page, idx) => {
    const explicitDeg = rotations[idx] !== undefined ? rotations[idx] : defaultAngle;
    if (explicitDeg) {
      const cur = page.getRotation().angle;
      const next = (((cur + explicitDeg) % 360) + 360) % 360;
      page.setRotation(PDFLib.degrees(next));
    }
  });

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Executes Organize & Reorder on client.
 */
async function executeOrganize(PDFLib, file, options) {
  const buf = await (file.rawFile || file).arrayBuffer();
  const srcDoc = await PDFLib.PDFDocument.load(buf);
  const total = srcDoc.getPageCount();
  const order = Array.isArray(options.order) && options.order.length > 0
    ? options.order
    : Array.from({ length: total }, (_, i) => i);
  const deletedSet = options.deletedSet instanceof Set ? options.deletedSet : new Set(options.deletedSet || []);
  const rotations = options.rotations || {};

  const validIndices = order.filter((i) => i >= 0 && i < total && !deletedSet.has(i));
  if (validIndices.length === 0) {
    throw new Error('Cần giữ lại ít nhất 1 trang trong tài liệu');
  }

  const newDoc = await PDFLib.PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);

  copiedPages.forEach((page, slotIdx) => {
    const origIdx = validIndices[slotIdx];
    const deg = rotations[origIdx] || 0;
    if (deg) {
      const cur = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((((cur + deg) % 360) + 360) % 360));
    }
    newDoc.addPage(page);
  });

  const bytes = await newDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Executes Split on client.
 */
async function executeSplit(PDFLib, file, options) {
  const buf = await (file.rawFile || file).arrayBuffer();
  const srcDoc = await PDFLib.PDFDocument.load(buf);
  let selected = Array.from(options.selectedSplitPages || []).filter((p) => p >= 0 && p < total);
  if (selected.length === 0 && options.pages) {
    const parts = options.pages.split(',').map((s) => s.trim()).filter(Boolean);
    const set = new Set();
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (start && end) {
          for (let p = Math.max(1, start); p <= Math.min(total, end); p++) set.add(p - 1);
        }
      } else {
        const p = Number(part);
        if (p >= 1 && p <= total) set.add(p - 1);
      }
    }
    selected = Array.from(set).sort((a, b) => a - b);
  }
  if (selected.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 trang cần tách');
  }

  const newDoc = await PDFLib.PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, selected);
  copied.forEach((p) => newDoc.addPage(p));
  const bytes = await newDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Executes Merge on client.
 */
async function executeMerge(PDFLib, files) {
  const newDoc = await PDFLib.PDFDocument.create();
  for (const f of files) {
    const buf = await (f.rawFile || f).arrayBuffer();
    const doc = await PDFLib.PDFDocument.load(buf);
    const indices = Array.from({ length: doc.getPageCount() }, (_, i) => i);
    const copied = await newDoc.copyPages(doc, indices);
    copied.forEach((p) => newDoc.addPage(p));
  }
  const bytes = await newDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Executes Images-to-PDF on client.
 */
async function executeImagesToPdf(PDFLib, files) {
  const newDoc = await PDFLib.PDFDocument.create();
  for (const f of files) {
    const img = await embedImageToPdf(newDoc, PDFLib, f);
    const page = newDoc.addPage([595, 842]);
    const maxW = 595 - 40;
    const maxH = 842 - 40;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (595 - drawW) / 2;
    const drawY = (842 - drawH) / 2;
    page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
  }
  const bytes = await newDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Executes Watermark on client.
 */
async function executeWatermark(PDFLib, file, options) {
  const buf = await (file.rawFile || file).arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf);
  const pages = doc.getPages();
  const total = pages.length;
  const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const text = options.watermarkText || '';
  const pos = options.watermarkPosition || 'center';
  const opacity = typeof options.watermarkOpacity === 'number' ? options.watermarkOpacity : 0.3;
  const pageNums = Boolean(options.pageNumbers);

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    if (text) {
      const size = Math.min(48, Math.max(18, Math.floor(width / (text.length * 0.7))));
      const w = font.widthOfTextAtSize(text, size);
      if (pos === 'center') {
        page.drawText(text, {
          x: (width - w * 0.7) / 2, y: (height - size * 0.7) / 2,
          size, font, color: PDFLib.rgb(0.5, 0.5, 0.5), opacity,
          rotate: PDFLib.degrees(45)
        });
      } else if (pos === 'top') {
        page.drawText(text, {
          x: (width - w) / 2, y: height - 40, size: Math.min(size, 20),
          font, color: PDFLib.rgb(0.5, 0.5, 0.5), opacity
        });
      } else {
        page.drawText(text, {
          x: (width - w) / 2, y: 30, size: Math.min(size, 20),
          font, color: PDFLib.rgb(0.5, 0.5, 0.5), opacity
        });
      }
    }
    if (pageNums) {
      const numStr = `Trang ${idx + 1} / ${total}`;
      const numW = font.widthOfTextAtSize(numStr, 10);
      page.drawText(numStr, {
        x: (width - numW) / 2, y: 15, size: 10, font,
        color: PDFLib.rgb(0.4, 0.4, 0.4), opacity: 0.8
      });
    }
  });

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Master dispatcher for client-side PDF tasks.
 */
export async function executeClientPdfTask(mode, files, options = {}) {
  const PDFLib = await ensurePdfLibLoaded();
  const first = files[0];

  switch (mode) {
    case 'rotate':
      return executeRotate(PDFLib, first, options);
    case 'organize':
      return executeOrganize(PDFLib, first, options);
    case 'split':
      return executeSplit(PDFLib, first, options);
    case 'merge':
      return executeMerge(PDFLib, files);
    case 'images_to_pdf':
      return executeImagesToPdf(PDFLib, files);
    case 'watermark':
      return executeWatermark(PDFLib, first, options);
    default:
      throw new Error(`Chế độ ${mode} không hỗ trợ xử lý phía Client`);
  }
}
