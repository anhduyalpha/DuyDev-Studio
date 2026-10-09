/**
 * useViewSplitSync.js - Pure Mathematical Synchronization & Coordinate Engine
 * Provides deterministic transformations, cursor-anchored zoom,
 * normalized viewport synchronization, loupe neighborhood extraction, and difference metrics.
 */

export const MIN_ZOOM = 0.01; // 1%
export const MAX_ZOOM = 100.0; // 10,000%
export const DEFAULT_ZOOM = 1.0; // 100%

/**
 * Clamps numeric value to [min, max] range.
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes new zoom and pan offsets anchored at the cursor's viewport position.
 * The point on the image under the cursor stays at the exact same screen position.
 *
 * @param {number} currentZoom
 * @param {number} zoomDelta - Multiplier (e.g. 1.15 for zoom in, 1/1.15 for zoom out)
 * @param {{ x: number, y: number }} anchorViewPos - Viewport coordinates (mouse cursor)
 * @param {{ x: number, y: number }} currentPan - Current pan offset (top-left translation)
 * @param {number} [minZoom=MIN_ZOOM]
 * @param {number} [maxZoom=MAX_ZOOM]
 * @returns {{ zoom: number, panX: number, panY: number }}
 */
export function calculateZoomAroundAnchor(
  currentZoom,
  zoomDelta,
  anchorViewPos,
  currentPan,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM
) {
  const vx = anchorViewPos.x;
  const vy = anchorViewPos.y;

  // Find image coordinates under anchor before zoom
  const ix = (vx - currentPan.x) / currentZoom;
  const iy = (vy - currentPan.y) / currentZoom;

  const newZoom = clamp(currentZoom * zoomDelta, minZoom, maxZoom);

  // Derive new pan such that (ix, iy) maps back to (vx, vy)
  const newPanX = vx - ix * newZoom;
  const newPanY = vy - iy * newZoom;

  return {
    zoom: newZoom,
    panX: newPanX,
    panY: newPanY
  };
}

/**
 * Calculates normalized center coordinates [0, 1] of the visible viewport area relative to the image.
 *
 * @param {number} panX
 * @param {number} panY
 * @param {number} zoom
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{ x: number, y: number }}
 */
export function getNormalizedCenter(
  panX,
  panY,
  zoom,
  viewWidth,
  viewHeight,
  imageWidth,
  imageHeight
) {
  if (imageWidth <= 0 || imageHeight <= 0 || zoom <= 0) {
    return { x: 0.5, y: 0.5 };
  }

  const centerX = (viewWidth / 2 - panX) / zoom;
  const centerY = (viewHeight / 2 - panY) / zoom;

  return {
    x: clamp(centerX / imageWidth, 0, 1),
    y: clamp(centerY / imageHeight, 0, 1)
  };
}

/**
 * Calculates pan offsets needed to place a normalized image center at the center of the viewport.
 *
 * @param {{ x: number, y: number }} normalizedCenter
 * @param {number} zoom
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{ panX: number, panY: number }}
 */
export function panFromNormalizedCenter(
  normalizedCenter,
  zoom,
  viewWidth,
  viewHeight,
  imageWidth,
  imageHeight
) {
  const targetImageX = clamp(normalizedCenter.x, 0, 1) * imageWidth;
  const targetImageY = clamp(normalizedCenter.y, 0, 1) * imageHeight;

  const panX = viewWidth / 2 - targetImageX * zoom;
  const panY = viewHeight / 2 - targetImageY * zoom;

  return { panX, panY };
}

/**
 * Computes fit-to-screen zoom and centered pan offsets with padding.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @param {number} [padding=16]
 * @returns {{ zoom: number, panX: number, panY: number }}
 */
export function calculateFitAll(
  imageWidth,
  imageHeight,
  viewWidth,
  viewHeight,
  padding = 16
) {
  if (imageWidth <= 0 || imageHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return { zoom: 1.0, panX: 0, panY: 0 };
  }

  const availW = Math.max(10, viewWidth - padding * 2);
  const availH = Math.max(10, viewHeight - padding * 2);

  const scaleW = availW / imageWidth;
  const scaleH = availH / imageHeight;
  const zoom = clamp(Math.min(scaleW, scaleH), MIN_ZOOM, MAX_ZOOM);

  const panX = (viewWidth - imageWidth * zoom) / 2;
  const panY = (viewHeight - imageHeight * zoom) / 2;

  return { zoom, panX, panY };
}

/**
 * Computes 1:1 actual size zoom centered in the viewport.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} viewWidth
 * @param {number} viewHeight
 * @returns {{ zoom: number, panX: number, panY: number }}
 */
export function calculateActualSize(
  imageWidth,
  imageHeight,
  viewWidth,
  viewHeight
) {
  const zoom = 1.0;
  const panX = (viewWidth - imageWidth) / 2;
  const panY = (viewHeight - imageHeight) / 2;

  return { zoom, panX, panY };
}

/**
 * Converts viewport mouse coordinates to source image pixel coordinates.
 *
 * @param {number} viewX
 * @param {number} viewY
 * @param {number} panX
 * @param {number} panY
 * @param {number} zoom
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{ x: number, y: number, isInside: boolean }}
 */
export function viewToImageCoordinates(
  viewX,
  viewY,
  panX,
  panY,
  zoom,
  imageWidth,
  imageHeight
) {
  if (zoom <= 0) return { x: 0, y: 0, isInside: false };

  const ix = Math.floor((viewX - panX) / zoom);
  const iy = Math.floor((viewY - panY) / zoom);
  const isInside = ix >= 0 && ix < imageWidth && iy >= 0 && iy < imageHeight;

  return { x: ix, y: iy, isInside };
}

/**
 * Converts source image pixel coordinates to viewport canvas coordinates.
 *
 * @param {number} imageX
 * @param {number} imageY
 * @param {number} panX
 * @param {number} panY
 * @param {number} zoom
 * @returns {{ x: number, y: number }}
 */
export function imageToViewCoordinates(imageX, imageY, panX, panY, zoom) {
  return {
    x: imageX * zoom + panX,
    y: imageY * zoom + panY
  };
}

/**
 * Converts RGB components to uppercase HEX string (#RRGGBB).
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts RGBA & HEX information for a single pixel from an RGBA buffer.
 *
 * @param {Uint8ClampedArray|Uint8Array} pixelData
 * @param {number} imageX
 * @param {number} imageY
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, r: number, g: number, b: number, a: number, hex: string, isValid: boolean }}
 */
export function extractPixelInfo(pixelData, imageX, imageY, width, height) {
  if (!pixelData || imageX < 0 || imageX >= width || imageY < 0 || imageY >= height) {
    return {
      x: imageX,
      y: imageY,
      r: 0,
      g: 0,
      b: 0,
      a: 0,
      hex: '#000000',
      isValid: false
    };
  }

  const idx = (imageY * width + imageX) * 4;
  const r = pixelData[idx];
  const g = pixelData[idx + 1];
  const b = pixelData[idx + 2];
  const a = pixelData[idx + 3];

  return {
    x: imageX,
    y: imageY,
    r,
    g,
    b,
    a,
    hex: rgbToHex(r, g, b),
    isValid: true
  };
}

/**
 * Extracts a 9x9 pixel neighborhood centered around (centerX, centerY).
 * Returns an array of 81 cell objects for the Loupe Inspector.
 *
 * @param {Uint8ClampedArray|Uint8Array} pixelData
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} width
 * @param {number} height
 * @returns {Array<{ x: number, y: number, r: number, g: number, b: number, a: number, hex: string, isCenter: boolean, isValid: boolean }>}
 */
export function extract9x9Neighborhood(pixelData, centerX, centerY, width, height) {
  const neighborhood = [];
  const radius = 4; // -4 to +4 produces 9 items

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = centerX + dx;
      const py = centerY + dy;
      const isCenter = dx === 0 && dy === 0;

      if (px >= 0 && px < width && py >= 0 && py < height && pixelData) {
        const idx = (py * width + px) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];
        const a = pixelData[idx + 3];
        neighborhood.push({
          x: px,
          y: py,
          r,
          g,
          b,
          a,
          hex: rgbToHex(r, g, b),
          isCenter,
          isValid: true
        });
      } else {
        // Out of image bounds
        neighborhood.push({
          x: px,
          y: py,
          r: 0,
          g: 0,
          b: 0,
          a: 0,
          hex: '#000000',
          isCenter,
          isValid: false
        });
      }
    }
  }

  return neighborhood;
}

/**
 * Calculates absolute pixel difference |A - B| with optional amplification multiplier.
 *
 * @param {number} rA
 * @param {number} gA
 * @param {number} bA
 * @param {number} rB
 * @param {number} gB
 * @param {number} bB
 * @param {number} [multiplier=1]
 * @returns {{ r: number, g: number, b: number, diffMagnitude: number }}
 */
export function calculateDifferencePixel(rA, gA, bA, rB, gB, bB, multiplier = 1) {
  const dR = Math.min(255, Math.abs(rA - rB) * multiplier);
  const dG = Math.min(255, Math.abs(gA - gB) * multiplier);
  const dB = Math.min(255, Math.abs(bA - bB) * multiplier);
  const diffMagnitude = Math.round((Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB)) / 3);

  return {
    r: Math.round(dR),
    g: Math.round(dG),
    b: Math.round(dB),
    diffMagnitude
  };
}
