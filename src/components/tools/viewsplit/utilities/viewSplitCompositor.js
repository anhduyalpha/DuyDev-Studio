/**
 * viewSplitCompositor.js - Client-Side Multi-Pane Canvas Image Compositor
 * Synthesizes high-resolution merged comparisons, wipe overlays, difference maps,
 * and facilitates 1-click clipboard copying and lossless downloads (PNG/WebP).
 */

import { LAYOUT_MODES } from '../hooks/useViewSplit.js';
import { calculateDifferencePixel } from '../hooks/useViewSplitSync.js';

/**
 * Creates a canvas composited from active panes according to layout mode.
 *
 * @param {Array<Object>} panes
 * @param {string} layout
 * @param {Object} [options]
 * @param {number} [options.sliderPos=0.5]
 * @param {number} [options.diffMultiplier=3]
 * @param {string} [options.filter='bilinear']
 * @param {string} [options.background='#09090B']
 * @returns {HTMLCanvasElement}
 */
export function composeMergedComparisonCanvas(panes, layout, {
  sliderPos = 0.5,
  diffMultiplier = 3,
  filter = 'bilinear',
  background = '#09090B'
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = filter === 'bilinear';

  const validPanes = panes.filter((p) => p && p.image);
  if (validPanes.length === 0) {
    canvas.width = 800;
    canvas.height = 600;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#71717A';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Không có hình ảnh nào được nạp', canvas.width / 2, canvas.height / 2);
    return canvas;
  }

  // Draw pane label helper
  const drawLabel = (context, text, x, y) => {
    context.save();
    context.font = 'bold 12px Inter, sans-serif';
    const textWidth = context.measureText(text).width;
    context.fillStyle = 'rgba(0, 0, 0, 0.75)';
    context.fillRect(x - 8, y - 14, textWidth + 16, 22);
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 1;
    context.strokeRect(x - 8, y - 14, textWidth + 16, 22);
    context.fillStyle = '#FFFFFF';
    context.fillText(text, x, y + 2);
    context.restore();
  };

  if (layout === LAYOUT_MODES.SLIDER || layout === LAYOUT_MODES.DIFF) {
    const paneA = panes[0]?.image ? panes[0] : validPanes[0];
    const paneB = panes[1]?.image ? panes[1] : (validPanes[1] || validPanes[0]);

    let targetWidth = Math.max(paneA.width, paneB.width);
    let targetHeight = Math.max(paneA.height, paneB.height);
    const MAX_CANVAS_DIM = 8192;
    if (targetWidth > MAX_CANVAS_DIM || targetHeight > MAX_CANVAS_DIM) {
      const scale = Math.min(MAX_CANVAS_DIM / targetWidth, MAX_CANVAS_DIM / targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (layout === LAYOUT_MODES.SLIDER) {
      const splitX = Math.round(targetWidth * sliderPos);

      // Draw Left Image (Pane A) clipped to [0, 0, splitX, targetHeight]
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, targetHeight);
      ctx.clip();
      ctx.drawImage(paneA.image, 0, 0, targetWidth, targetHeight);
      drawLabel(ctx, `${paneA.title} (Before)`, 16, 24);
      ctx.restore();

      // Draw Right Image (Pane B) clipped to [splitX, 0, targetWidth - splitX, targetHeight]
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, targetWidth - splitX, targetHeight);
      ctx.clip();
      ctx.drawImage(paneB.image, 0, 0, targetWidth, targetHeight);
      drawLabel(ctx, `${paneB.title} (After)`, splitX + 16, 24);
      ctx.restore();

      // Divider line
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, targetHeight);
      ctx.stroke();

      // Handle circle
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(splitX, targetHeight / 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#09090B';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⬌', splitX, targetHeight / 2);
      ctx.restore();
    } else {
      // DIFFERENCE DIFF MODE: Hardware-accelerated GPU difference composite
      ctx.drawImage(paneA.image, 0, 0, targetWidth, targetHeight);
      ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(paneB.image, 0, 0, targetWidth, targetHeight);

      if (diffMultiplier > 1) {
        const scratch = document.createElement('canvas');
        scratch.width = targetWidth;
        scratch.height = targetHeight;
        const sCtx = scratch.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(canvas, 0, 0);
          ctx.globalCompositeOperation = 'lighter';
          for (let m = 1; m < diffMultiplier; m++) {
            ctx.drawImage(scratch, 0, 0);
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      drawLabel(ctx, `Difference Diff (${diffMultiplier}x) | |${paneA.title} - ${paneB.title}|`, 16, 24);
    }

    return canvas;
  }

  // Multi-pane layouts
  switch (layout) {
    case LAYOUT_MODES.SINGLE: {
      const p = validPanes[0];
      canvas.width = p.width;
      canvas.height = p.height;
      ctx.drawImage(p.image, 0, 0);
      drawLabel(ctx, p.title, 16, 24);
      break;
    }

    case LAYOUT_MODES.SPLIT_H: {
      const p1 = panes[0]?.image ? panes[0] : validPanes[0];
      const p2 = panes[1]?.image ? panes[1] : (validPanes[1] || p1);
      const targetH = Math.max(p1.height, p2.height);
      const w1 = Math.round((p1.width / p1.height) * targetH);
      const w2 = Math.round((p2.width / p2.height) * targetH);
      canvas.width = w1 + w2;
      canvas.height = targetH;

      ctx.drawImage(p1.image, 0, 0, w1, targetH);
      ctx.drawImage(p2.image, w1, 0, w2, targetH);
      drawLabel(ctx, p1.title, 16, 24);
      drawLabel(ctx, p2.title, w1 + 16, 24);
      break;
    }

    case LAYOUT_MODES.SPLIT_V: {
      const p1 = panes[0]?.image ? panes[0] : validPanes[0];
      const p2 = panes[1]?.image ? panes[1] : (validPanes[1] || p1);
      const targetW = Math.max(p1.width, p2.width);
      const h1 = Math.round((p1.height / p1.width) * targetW);
      const h2 = Math.round((p2.height / p2.width) * targetW);
      canvas.width = targetW;
      canvas.height = h1 + h2;

      ctx.drawImage(p1.image, 0, 0, targetW, h1);
      ctx.drawImage(p2.image, 0, h1, targetW, h2);
      drawLabel(ctx, p1.title, 16, 24);
      drawLabel(ctx, p2.title, 16, h1 + 24);
      break;
    }

    case LAYOUT_MODES.TRIPLE_H: {
      const p1 = panes[0]?.image || validPanes[0];
      const p2 = panes[1]?.image || p1;
      const p3 = panes[2]?.image || p2;
      const targetH = Math.max(p1.height, p2.height, p3.height);
      const w1 = Math.round((p1.width / p1.height) * targetH);
      const w2 = Math.round((p2.width / p2.height) * targetH);
      const w3 = Math.round((p3.width / p3.height) * targetH);
      canvas.width = w1 + w2 + w3;
      canvas.height = targetH;

      ctx.drawImage(p1.image, 0, 0, w1, targetH);
      ctx.drawImage(p2.image, w1, 0, w2, targetH);
      ctx.drawImage(p3.image, w1 + w2, 0, w3, targetH);
      drawLabel(ctx, p1.title, 16, 24);
      drawLabel(ctx, p2.title, w1 + 16, 24);
      drawLabel(ctx, p3.title, w1 + w2 + 16, 24);
      break;
    }

    case LAYOUT_MODES.TRIPLE_L: {
      const p1 = panes[0]?.image || validPanes[0];
      const p2 = panes[1]?.image || p1;
      const p3 = panes[2]?.image || p2;
      const targetH = Math.max(p1.height, p2.height + p3.height);
      const rightH = Math.round(targetH / 2);
      const w1 = Math.round((p1.width / p1.height) * targetH);
      const w2 = Math.round((p2.width / p2.height) * rightH);
      const w3 = Math.round((p3.width / p3.height) * rightH);
      const rightW = Math.max(w2, w3);

      canvas.width = w1 + rightW;
      canvas.height = targetH;

      ctx.drawImage(p1.image, 0, 0, w1, targetH);
      ctx.drawImage(p2.image, w1, 0, rightW, rightH);
      ctx.drawImage(p3.image, w1, rightH, rightW, targetH - rightH);

      drawLabel(ctx, p1.title, 16, 24);
      drawLabel(ctx, p2.title, w1 + 16, 24);
      drawLabel(ctx, p3.title, w1 + 16, rightH + 24);
      break;
    }

    case LAYOUT_MODES.TRIPLE_T: {
      const p1 = panes[0]?.image || validPanes[0];
      const p2 = panes[1]?.image || p1;
      const p3 = panes[2]?.image || p2;
      const targetW = Math.max(p1.width, p2.width + p3.width);
      const topH = Math.round((p1.height / p1.width) * targetW);
      const bottomW = Math.round(targetW / 2);
      const h2 = Math.round((p2.height / p2.width) * bottomW);
      const h3 = Math.round((p3.height / p3.width) * (targetW - bottomW));
      const bottomH = Math.max(h2, h3);

      canvas.width = targetW;
      canvas.height = topH + bottomH;

      ctx.drawImage(p1.image, 0, 0, targetW, topH);
      ctx.drawImage(p2.image, 0, topH, bottomW, bottomH);
      ctx.drawImage(p3.image, bottomW, topH, targetW - bottomW, bottomH);

      drawLabel(ctx, p1.title, 16, 24);
      drawLabel(ctx, p2.title, 16, topH + 24);
      drawLabel(ctx, p3.title, bottomW + 16, topH + 24);
      break;
    }

    case LAYOUT_MODES.QUAD:
    default: {
      // 2x2 Grid
      const p1 = panes[0]?.image || validPanes[0];
      const p2 = panes[1]?.image || p1;
      const p3 = panes[2]?.image || p1;
      const p4 = panes[3]?.image || p2;

      const cellW = Math.max(p1.width, p2.width, p3.width, p4.width);
      const cellH = Math.max(p1.height, p2.height, p3.height, p4.height);
      let totalW = cellW * 2;
      let totalH = cellH * 2;
      let cw = cellW;
      let ch = cellH;
      const MAX_CANVAS_DIM = 8192;
      if (totalW > MAX_CANVAS_DIM || totalH > MAX_CANVAS_DIM) {
        const scale = Math.min(MAX_CANVAS_DIM / totalW, MAX_CANVAS_DIM / totalH);
        cw = Math.round(cellW * scale);
        ch = Math.round(cellH * scale);
        totalW = cw * 2;
        totalH = ch * 2;
      }
      canvas.width = totalW;
      canvas.height = totalH;

      ctx.drawImage(p1.image, 0, 0, cw, ch);
      ctx.drawImage(p2.image, cw, 0, cw, ch);
      ctx.drawImage(p3.image, 0, ch, cw, ch);
      ctx.drawImage(p4.image, cw, ch, cw, ch);

      drawLabel(ctx, p1.title, 16, 24);
      drawLabel(ctx, p2.title, cw + 16, 24);
      drawLabel(ctx, p3.title, 16, ch + 24);
      drawLabel(ctx, p4.title, cw + 16, ch + 24);
      break;
    }
  }

  return canvas;
}

/**
 * Exports composited comparison canvas to Blob.
 *
 * @param {Array<Object>} panes
 * @param {string} layout
 * @param {Object} [options]
 * @returns {Promise<Blob>}
 */
export function exportMergedComparisonBlob(panes, layout, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = composeMergedComparisonCanvas(panes, layout, options);
      const mime = options.format === 'image/webp' ? 'image/webp' : 'image/png';
      const quality = options.quality !== undefined ? options.quality : 0.95;
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      }, mime, quality);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Downloads composited comparison image to user device.
 *
 * @param {Array<Object>} panes
 * @param {string} layout
 * @param {Object} [options]
 */
export async function downloadComparisonImage(panes, layout, options = {}) {
  const blob = await exportMergedComparisonBlob(panes, layout, options);
  const ext = options.format === 'image/webp' ? 'webp' : 'png';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viewsplit-comparison-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Copies composited comparison image to clipboard as PNG.
 *
 * @param {Array<Object>} panes
 * @param {string} layout
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
export async function copyComparisonImageToClipboard(panes, layout, options = {}) {
  const blob = await exportMergedComparisonBlob(panes, layout, { ...options, format: 'image/png' });

  if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof window.ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    } catch (err) {
      console.warn('[ViewSplitCompositor] Clipboard API write failed:', err);
    }
  }

  return false;
}
