import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clamp,
  calculateZoomAroundAnchor,
  getNormalizedCenter,
  panFromNormalizedCenter,
  calculateFitAll,
  calculateActualSize,
  viewToImageCoordinates,
  imageToViewCoordinates,
  rgbToHex,
  extractPixelInfo,
  extract9x9Neighborhood,
  calculateDifferencePixel,
  MIN_ZOOM,
  MAX_ZOOM
} from '../../../src/components/tools/viewsplit/hooks/useViewSplitSync.js';
import {
  viewSplitStore,
  LAYOUT_MODES,
  PANE_TITLES
} from '../../../src/components/tools/viewsplit/hooks/useViewSplit.js';

describe('ViewSplit Synchronizer & Coordinate Math (useViewSplitSync)', () => {
  describe('clamp helper', () => {
    it('should clamp numbers properly', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('calculateZoomAroundAnchor', () => {
    it('should preserve image coordinate under cursor anchor before and after zoom', () => {
      const currentZoom = 1.0;
      const currentPan = { x: 50, y: 50 };
      const anchorViewPos = { x: 200, y: 150 }; // Viewport cursor pos

      // Image coord before zoom:
      // ix = (200 - 50) / 1.0 = 150
      // iy = (150 - 50) / 1.0 = 100
      const zoomDelta = 2.0;
      const { zoom, panX, panY } = calculateZoomAroundAnchor(
        currentZoom,
        zoomDelta,
        anchorViewPos,
        currentPan
      );

      expect(zoom).toBe(2.0);

      // Verify that (150, 100) on the image maps back to (200, 150) in view:
      // vx = 150 * 2.0 + panX = 300 + panX = 200 => panX = -100
      // vy = 100 * 2.0 + panY = 200 + panY = 150 => panY = -50
      expect(panX).toBe(-100);
      expect(panY).toBe(-50);

      const mappedVx = 150 * zoom + panX;
      const mappedVy = 100 * zoom + panY;
      expect(mappedVx).toBe(anchorViewPos.x);
      expect(mappedVy).toBe(anchorViewPos.y);
    });

    it('should respect MIN_ZOOM and MAX_ZOOM clamping', () => {
      const anchor = { x: 100, y: 100 };
      const pan = { x: 0, y: 0 };

      // Zoom out excessively
      const zoomedOut = calculateZoomAroundAnchor(0.02, 0.1, anchor, pan, MIN_ZOOM, MAX_ZOOM);
      expect(zoomedOut.zoom).toBe(MIN_ZOOM);

      // Zoom in excessively
      const zoomedIn = calculateZoomAroundAnchor(50.0, 10.0, anchor, pan, MIN_ZOOM, MAX_ZOOM);
      expect(zoomedIn.zoom).toBe(MAX_ZOOM);
    });
  });

  describe('Normalized Center & Pan Sync', () => {
    it('should round-trip normalizedCenter to pan and back', () => {
      const imageW = 1920;
      const imageH = 1080;
      const viewW = 800;
      const viewH = 600;
      const zoom = 1.5;

      // Center of image is (0.5, 0.5)
      const normCenter = { x: 0.5, y: 0.5 };
      const { panX, panY } = panFromNormalizedCenter(
        normCenter,
        zoom,
        viewW,
        viewH,
        imageW,
        imageH
      );

      const calculatedNorm = getNormalizedCenter(
        panX,
        panY,
        zoom,
        viewW,
        viewH,
        imageW,
        imageH
      );

      expect(calculatedNorm.x).toBeCloseTo(0.5, 4);
      expect(calculatedNorm.y).toBeCloseTo(0.5, 4);
    });

    it('should clamp normalized coordinates to [0, 1] when panned far outside bounds', () => {
      const normCenter = getNormalizedCenter(
        -99999,
        -99999,
        1.0,
        800,
        600,
        1920,
        1080
      );
      expect(normCenter.x).toBe(1.0);
      expect(normCenter.y).toBe(1.0);

      const normCenterFarLeft = getNormalizedCenter(
        99999,
        99999,
        1.0,
        800,
        600,
        1920,
        1080
      );
      expect(normCenterFarLeft.x).toBe(0.0);
      expect(normCenterFarLeft.y).toBe(0.0);
    });
  });

  describe('calculateFitAll & calculateActualSize', () => {
    it('should compute centered fit-all transform for landscape images', () => {
      const { zoom, panX, panY } = calculateFitAll(1920, 1080, 800, 600, 0);
      // aspect: 1920 / 1080 = 1.777
      // 800 / 1920 = 0.4166
      // 600 / 1080 = 0.5555
      // scale = 800 / 1920 = 0.416666...
      expect(zoom).toBeCloseTo(800 / 1920, 3);
      expect(panX).toBeCloseTo(0, 1);
      // Vertically centered: (600 - 1080 * (800/1920)) / 2 = (600 - 450) / 2 = 75
      expect(panY).toBeCloseTo(75, 1);
    });

    it('should compute centered 1:1 actual size transform', () => {
      const { zoom, panX, panY } = calculateActualSize(400, 300, 800, 600);
      expect(zoom).toBe(1.0);
      expect(panX).toBe((800 - 400) / 2); // 200
      expect(panY).toBe((600 - 300) / 2); // 150
    });
  });

  describe('Coordinate Mapping (viewToImage & imageToView)', () => {
    it('should map between viewport coordinates and source image pixels', () => {
      const panX = 100;
      const panY = 50;
      const zoom = 2.0;
      const imageW = 500;
      const imageH = 500;

      // Viewport coordinate (300, 250)
      const { x: imgX, y: imgY, isInside } = viewToImageCoordinates(
        300,
        250,
        panX,
        panY,
        zoom,
        imageW,
        imageH
      );

      // (300 - 100) / 2 = 100
      // (250 - 50) / 2 = 100
      expect(imgX).toBe(100);
      expect(imgY).toBe(100);
      expect(isInside).toBe(true);

      const viewCoords = imageToViewCoordinates(imgX, imgY, panX, panY, zoom);
      expect(viewCoords.x).toBe(300);
      expect(viewCoords.y).toBe(250);
    });

    it('should detect when viewport coordinate is outside image bounds', () => {
      const { isInside } = viewToImageCoordinates(
        10,
        10,
        500, // image offset starts at 500
        500,
        1.0,
        200,
        200
      );
      expect(isInside).toBe(false);
    });
  });

  describe('Pixel Inspector & Loupe Math', () => {
    it('should convert RGB to uppercase HEX', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(6, 182, 212)).toBe('#06B6D4');
      expect(rgbToHex(255, 0, 128)).toBe('#FF0080');
    });

    it('should extract correct pixel info from RGBA buffer', () => {
      const width = 2;
      const height = 2;
      // 2x2 image buffer: Red, Green, Blue, White
      const buffer = new Uint8ClampedArray([
        255, 0, 0, 255,     // (0, 0) Red
        0, 255, 0, 255,     // (1, 0) Green
        0, 0, 255, 255,     // (0, 1) Blue
        255, 255, 255, 255  // (1, 1) White
      ]);

      const redPixel = extractPixelInfo(buffer, 0, 0, width, height);
      expect(redPixel.isValid).toBe(true);
      expect(redPixel.r).toBe(255);
      expect(redPixel.g).toBe(0);
      expect(redPixel.b).toBe(0);
      expect(redPixel.hex).toBe('#FF0000');

      const greenPixel = extractPixelInfo(buffer, 1, 0, width, height);
      expect(greenPixel.hex).toBe('#00FF00');

      const bluePixel = extractPixelInfo(buffer, 0, 1, width, height);
      expect(bluePixel.hex).toBe('#0000FF');

      const outOfBounds = extractPixelInfo(buffer, 5, 5, width, height);
      expect(outOfBounds.isValid).toBe(false);
    });

    it('should extract 9x9 neighborhood with center marked at index 40', () => {
      const width = 10;
      const height = 10;
      const buffer = new Uint8ClampedArray(width * height * 4);
      // Fill (5, 5) with yellow (255, 255, 0, 255)
      const centerIdx = (5 * width + 5) * 4;
      buffer[centerIdx] = 255;
      buffer[centerIdx + 1] = 255;
      buffer[centerIdx + 2] = 0;
      buffer[centerIdx + 3] = 255;

      const neighborhood = extract9x9Neighborhood(buffer, 5, 5, width, height);
      expect(neighborhood.length).toBe(81);

      // Center is at index 40 (row 4, col 4: 4 * 9 + 4 = 40)
      const centerCell = neighborhood[40];
      expect(centerCell.isCenter).toBe(true);
      expect(centerCell.x).toBe(5);
      expect(centerCell.y).toBe(5);
      expect(centerCell.hex).toBe('#FFFF00');
      expect(centerCell.isValid).toBe(true);
    });

    it('should calculate difference pixel with amplification', () => {
      // Small difference of 10 in Red channel
      const diff1 = calculateDifferencePixel(100, 100, 100, 110, 100, 100, 1);
      expect(diff1.r).toBe(10);
      expect(diff1.g).toBe(0);
      expect(diff1.b).toBe(0);

      // Amplified by 5x => 50
      const diff5 = calculateDifferencePixel(100, 100, 100, 110, 100, 100, 5);
      expect(diff5.r).toBe(50);

      // Clamped at 255
      const diffClamped = calculateDifferencePixel(0, 0, 0, 200, 0, 0, 2);
      expect(diffClamped.r).toBe(255);
    });
  });
});

describe('ViewSplit Reactive Store (useViewSplit)', () => {
  beforeEach(() => {
    viewSplitStore.resetAll();
  });

  it('should initialize with 4 panes and default configurations', () => {
    expect(viewSplitStore.panes.length).toBe(4);
    expect(viewSplitStore.activePaneId).toBe(1);
    expect(viewSplitStore.syncView).toBe(true);
    expect(viewSplitStore.syncCursor).toBe(true);
    expect(viewSplitStore.filter).toBe('bilinear');
    expect(viewSplitStore.layout).toBe(LAYOUT_MODES.SPLIT_H);
  });

  it('should switch layouts and notify listeners', () => {
    const listener = vi.fn();
    const unsubscribe = viewSplitStore.subscribe(listener);

    viewSplitStore.setLayout(LAYOUT_MODES.QUAD);
    expect(viewSplitStore.layout).toBe(LAYOUT_MODES.QUAD);
    expect(listener).toHaveBeenCalledWith(viewSplitStore, 'layout');

    viewSplitStore.setLayout(LAYOUT_MODES.SLIDER);
    expect(viewSplitStore.layout).toBe(LAYOUT_MODES.SLIDER);

    unsubscribe();
  });

  it('should toggle filter between bilinear and nearest', () => {
    expect(viewSplitStore.filter).toBe('bilinear');
    viewSplitStore.toggleFilter();
    expect(viewSplitStore.filter).toBe('nearest');
    viewSplitStore.toggleFilter();
    expect(viewSplitStore.filter).toBe('bilinear');
  });

  it('should toggle sync view and sync cursor', () => {
    expect(viewSplitStore.syncView).toBe(true);
    viewSplitStore.toggleSyncView();
    expect(viewSplitStore.syncView).toBe(false);

    expect(viewSplitStore.syncCursor).toBe(true);
    viewSplitStore.toggleSyncCursor();
    expect(viewSplitStore.syncCursor).toBe(false);
  });

  it('should switch active pane within bounds', () => {
    viewSplitStore.setActivePane(3);
    expect(viewSplitStore.activePaneId).toBe(3);
    expect(viewSplitStore.mobileActiveTab).toBe(3);

    // Invalid pane ID ignored
    viewSplitStore.setActivePane(10);
    expect(viewSplitStore.activePaneId).toBe(3);
  });

  it('should clear pane state on clearPane()', () => {
    const pane1 = viewSplitStore.getPane(1);
    pane1.image = {} as any;
    pane1.name = 'test.png';
    pane1.width = 1920;
    pane1.height = 1080;
    pane1.zoom = 2.5;

    viewSplitStore.clearPane(1);
    expect(pane1.image).toBeNull();
    expect(pane1.name).toBe('');
    expect(pane1.width).toBe(0);
    expect(pane1.zoom).toBe(1.0);
  });
});
