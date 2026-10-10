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
  ViewSplitStore,
  LAYOUT_MODES,
  PANE_TITLES
} from '../../../src/components/tools/viewsplit/hooks/useViewSplit.js';
import { renderViewSplitPane } from '../../../src/components/tools/viewsplit/components/ViewSplitPane.js';
import { renderViewSplitToolbar } from '../../../src/components/tools/viewsplit/components/ViewSplitToolbar.js';
import { renderViewSplitSliderOverlay } from '../../../src/components/tools/viewsplit/components/ViewSplitSliderOverlay.js';

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
      // New viewport pos of (150, 100):
      // vx = 150 * 2.0 + panX = 300 + panX. If vx === 200 => panX === -100
      expect(panX).toBe(-100);
      // vy = 100 * 2.0 + panY = 200 + panY. If vy === 150 => panY === -50
      expect(panY).toBe(-50);
    });

    it('should respect MIN_ZOOM and MAX_ZOOM constraints', () => {
      const { zoom: minZ } = calculateZoomAroundAnchor(0.02, 0.1, { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(minZ).toBe(MIN_ZOOM);

      const { zoom: maxZ } = calculateZoomAroundAnchor(80.0, 2.0, { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(maxZ).toBe(MAX_ZOOM);
    });
  });

  describe('Normalized Center Synchronization', () => {
    it('should calculate normalized center correctly', () => {
      const viewW = 800;
      const viewH = 600;
      const imgW = 1000;
      const imgH = 1000;
      const zoom = 1.0;
      // Center of view is (400, 300). If pan is (0, 0), center of view falls on image at (400, 300)
      const center = getNormalizedCenter(0, 0, zoom, viewW, viewH, imgW, imgH);
      expect(center.x).toBeCloseTo(0.4, 4);
      expect(center.y).toBeCloseTo(0.3, 4);
    });

    it('should derive pan offsets from normalized center correctly', () => {
      const viewW = 800;
      const viewH = 600;
      const imgW = 1000;
      const imgH = 1000;
      const zoom = 1.0;
      const normCenter = { x: 0.5, y: 0.5 }; // Exactly center of image

      const { panX, panY } = panFromNormalizedCenter(normCenter, zoom, viewW, viewH, imgW, imgH);
      // Desired: (400 - 0.5 * 1000 * 1.0) = 400 - 500 = -100
      expect(panX).toBe(-100);
      // (300 - 0.5 * 1000 * 1.0) = 300 - 500 = -200
      expect(panY).toBe(-200);
    });
  });

  describe('calculateFitAll & calculateActualSize', () => {
    it('should calculate fit all zoom to fit within viewport padding', () => {
      const imgW = 1600;
      const imgH = 900;
      const viewW = 800;
      const viewH = 600;
      const padding = 20;

      const { zoom, panX, panY } = calculateFitAll(imgW, imgH, viewW, viewH, padding);
      // Avail width = 760, avail height = 560
      // ScaleX = 760 / 1600 = 0.475, ScaleY = 560 / 900 = 0.622... => zoom = 0.475
      expect(zoom).toBeCloseTo(0.475, 3);
      // Pan should center the scaled image
      expect(panX).toBeCloseTo((800 - 1600 * 0.475) / 2, 1);
      expect(panY).toBeCloseTo((600 - 900 * 0.475) / 2, 1);
    });

    it('should calculate 1:1 actual size centered in viewport', () => {
      const imgW = 500;
      const imgH = 400;
      const viewW = 800;
      const viewH = 600;

      const { zoom, panX, panY } = calculateActualSize(imgW, imgH, viewW, viewH);
      expect(zoom).toBe(1.0);
      expect(panX).toBe((800 - 500) / 2); // 150
      expect(panY).toBe((600 - 400) / 2); // 100
    });
  });

  describe('Coordinate Transforms and Pixel Extraction', () => {
    it('should map viewport to image coordinates and verify bounds', () => {
      const { x, y, isInside } = viewToImageCoordinates(150, 100, 50, 50, 2.0, 100, 100);
      // x = floor((150 - 50) / 2.0) = 50
      // y = floor((100 - 50) / 2.0) = 25
      expect(x).toBe(50);
      expect(y).toBe(25);
      expect(isInside).toBe(true);

      const out = viewToImageCoordinates(500, 500, 0, 0, 1.0, 100, 100);
      expect(out.isInside).toBe(false);
    });

    it('should convert RGB to Hex correctly', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
      expect(rgbToHex(16, 32, 48)).toBe('#102030');
    });

    it('should extract pixel color from ImageData buffer', () => {
      const width = 2;
      const height = 2;
      const buffer = new Uint8ClampedArray([
        255, 0, 0, 255, // (0, 0) Red
        0, 255, 0, 255, // (1, 0) Green
        0, 0, 255, 255, // (0, 1) Blue
        255, 255, 255, 255 // (1, 1) White
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

  it('should reset cursor across all panes via clearAllCursors()', () => {
    const pane1 = viewSplitStore.getPane(1);
    const pane2 = viewSplitStore.getPane(2);
    pane1.cursor.inside = true;
    pane2.cursor.inside = true;
    viewSplitStore.pixelInspectorState.isValid = true;

    viewSplitStore.clearAllCursors();

    expect(pane1.cursor.inside).toBe(false);
    expect(pane2.cursor.inside).toBe(false);
    expect(viewSplitStore.pixelInspectorState.isValid).toBe(false);
  });

  it('should clear pixel inspector when cursor is outside image boundary', () => {
    const pane1 = viewSplitStore.getPane(1);
    pane1.image = { naturalWidth: 100, naturalHeight: 100 } as any;
    pane1.width = 100;
    pane1.height = 100;
    pane1.zoom = 1.0;
    pane1.panX = 0;
    pane1.panY = 0;
    pane1.imageData = new Uint8ClampedArray(100 * 100 * 4);

    // Cursor placed at (500, 500) which is far outside (100x100)
    viewSplitStore.updateCursor(1, 500, 500, true);
    expect(viewSplitStore.pixelInspectorState.isValid).toBe(false);
  });

  it('should synchronize normalized centers across unequal resolution images', () => {
    // Pane 1: 1000x1000, Pane 2: 2000x2000
    const p1 = viewSplitStore.getPane(1);
    const p2 = viewSplitStore.getPane(2);
    p1.image = { width: 1000, height: 1000 } as any;
    p1.width = 1000;
    p1.height = 1000;

    p2.image = { width: 2000, height: 2000 } as any;
    p2.width = 2000;
    p2.height = 2000;

    const viewW = 800;
    const viewH = 600;
    const zoom = 2.0;

    // Pan p1 such that its center (500, 500) is centered in the viewport
    const { panX: p1PanX, panY: p1PanY } = panFromNormalizedCenter(
      { x: 0.5, y: 0.5 },
      zoom,
      viewW,
      viewH,
      p1.width,
      p1.height
    );

    viewSplitStore.setTransform(1, zoom, p1PanX, p1PanY, viewW, viewH);

    // Check that p2 was synchronized to also have normalized center at (0.5, 0.5)
    const normP2 = getNormalizedCenter(
      p2.panX,
      p2.panY,
      p2.zoom,
      viewW,
      viewH,
      p2.width,
      p2.height
    );
    expect(normP2.x).toBeCloseTo(0.5, 4);
    expect(normP2.y).toBeCloseTo(0.5, 4);
  });

  it('should clear other panes cursor when cursor leaves source pane or image bounds', () => {
    const p1 = viewSplitStore.getPane(1);
    const p2 = viewSplitStore.getPane(2);
    p1.image = { width: 500, height: 500 } as any;
    p1.width = 500;
    p1.height = 500;
    p2.image = { width: 500, height: 500 } as any;
    p2.width = 500;
    p2.height = 500;

    // Move cursor inside p1
    viewSplitStore.updateCursor(1, 250, 250, true);
    expect(p1.cursor.inside).toBe(true);
    expect(p2.cursor.inside).toBe(true);

    // Cursor exits p1
    viewSplitStore.updateCursor(1, 250, 250, false);
    expect(p1.cursor.inside).toBe(false);
    expect(p2.cursor.inside).toBe(false);
  });

  it('should clear other panes cursor when syncCursor is disabled', () => {
    const p1 = viewSplitStore.getPane(1);
    const p2 = viewSplitStore.getPane(2);
    p1.image = { width: 500, height: 500 } as any;
    p1.width = 500;
    p1.height = 500;
    p2.image = { width: 500, height: 500 } as any;
    p2.width = 500;
    p2.height = 500;

    viewSplitStore.updateCursor(1, 250, 250, true);
    expect(p2.cursor.inside).toBe(true);

    viewSplitStore.setSyncCursor(false);
    expect(p2.cursor.inside).toBe(false);
    expect(viewSplitStore.syncCursor).toBe(false);
  });

  it('should not fire cursor-cleared notification when clearAllCursors is called while already idle', () => {
    const listener = vi.fn();
    viewSplitStore.subscribe(listener);

    // Initial state: all cursors already outside
    viewSplitStore.clearAllCursors();
    expect(listener).not.toHaveBeenCalledWith(viewSplitStore, 'cursor-cleared');
  });
});

describe('ViewSplit Auto-Advancement & Click-To-Select', () => {
  describe('ViewSplitStore Core Methods', () => {
    it('initializes with default SPLIT_H layout and activePaneId 1', () => {
      const store = new ViewSplitStore();
      expect(store.layout).toBe(LAYOUT_MODES.SPLIT_H);
      expect(store.activePaneId).toBe(1);
      expect(store.mobileActiveTab).toBe(1);
      expect(store.panes).toHaveLength(4);
      expect(store.getVisiblePaneCount()).toBe(2);
    });

    it('getVisiblePaneCount returns correct count for all layouts', () => {
      const store = new ViewSplitStore();

      store.setLayout(LAYOUT_MODES.SINGLE);
      expect(store.getVisiblePaneCount()).toBe(1);

      store.setLayout(LAYOUT_MODES.SPLIT_H);
      expect(store.getVisiblePaneCount()).toBe(2);

      store.setLayout(LAYOUT_MODES.SPLIT_V);
      expect(store.getVisiblePaneCount()).toBe(2);

      store.setLayout(LAYOUT_MODES.SLIDER);
      expect(store.getVisiblePaneCount()).toBe(2);

      store.setLayout(LAYOUT_MODES.DIFF);
      expect(store.getVisiblePaneCount()).toBe(2);

      store.setLayout(LAYOUT_MODES.TRIPLE_H);
      expect(store.getVisiblePaneCount()).toBe(3);

      store.setLayout(LAYOUT_MODES.TRIPLE_L);
      expect(store.getVisiblePaneCount()).toBe(3);

      store.setLayout(LAYOUT_MODES.TRIPLE_T);
      expect(store.getVisiblePaneCount()).toBe(3);

      store.setLayout(LAYOUT_MODES.QUAD);
      expect(store.getVisiblePaneCount()).toBe(4);

      // Unknown layout fallback
      (store as any).layout = 'custom_unknown';
      expect(store.getVisiblePaneCount()).toBe(2);
    });

    it('setActivePane updates activePaneId and mobileActiveTab, and triggers notification', () => {
      const store = new ViewSplitStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.setActivePane(2);
      expect(store.activePaneId).toBe(2);
      expect(store.mobileActiveTab).toBe(2);
      expect(listener).toHaveBeenCalledWith(store, 'active-pane');

      // Invalid pane IDs should be safely ignored
      store.setActivePane(0);
      expect(store.activePaneId).toBe(2);

      store.setActivePane(5);
      expect(store.activePaneId).toBe(2);

      store.setActivePane(-1);
      expect(store.activePaneId).toBe(2);
    });
  });

  describe('getNextTargetPaneId Smart Auto-Advancement', () => {
    it('targets unfilled pane in 2-pane layout (Pane 1 filled -> Pane 2)', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SPLIT_H);

      // Mock image on pane 1
      store.panes[0].image = {} as any;
      store.panes[1].image = null;

      expect(store.getNextTargetPaneId(1)).toBe(2);
    });

    it('targets unfilled pane in 2-pane layout when starting at Pane 2 (Pane 2 filled -> Pane 1 empty)', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SPLIT_H);

      store.panes[0].image = null;
      store.panes[1].image = {} as any;

      expect(store.getNextTargetPaneId(2)).toBe(1);
    });

    it('skips already filled panes in 4-pane layout to find first empty slot', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.QUAD);

      // Pane 1 and 2 filled, Pane 3 empty, Pane 4 filled
      store.panes[0].image = {} as any;
      store.panes[1].image = {} as any;
      store.panes[2].image = null;
      store.panes[3].image = {} as any;

      expect(store.getNextTargetPaneId(1)).toBe(3);
    });

    it('cycles back to Pane 1 when starting at Pane 4 with Pane 1 empty', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.QUAD);

      store.panes[0].image = null;
      store.panes[1].image = {} as any;
      store.panes[2].image = {} as any;
      store.panes[3].image = {} as any;

      expect(store.getNextTargetPaneId(4)).toBe(1);
    });

    it('progresses cyclically when all visible panes are filled', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SPLIT_H);

      // Both panes filled
      store.panes[0].image = {} as any;
      store.panes[1].image = {} as any;

      expect(store.getNextTargetPaneId(1)).toBe(2);
      expect(store.getNextTargetPaneId(2)).toBe(1);

      // 4-pane layout with all 4 filled
      store.setLayout(LAYOUT_MODES.QUAD);
      store.panes[2].image = {} as any;
      store.panes[3].image = {} as any;

      expect(store.getNextTargetPaneId(1)).toBe(2);
      expect(store.getNextTargetPaneId(2)).toBe(3);
      expect(store.getNextTargetPaneId(3)).toBe(4);
      expect(store.getNextTargetPaneId(4)).toBe(1);
    });

    it('always returns 1 in SINGLE layout mode', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SINGLE);

      store.panes[0].image = {} as any;
      expect(store.getNextTargetPaneId(1)).toBe(1);
      expect(store.getNextTargetPaneId(2)).toBe(1);
    });

    it('clamps currentPaneId gracefully when switching from large to small layout', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SPLIT_H); // 2 panes visible

      // activePaneId was previously 4
      expect(store.getNextTargetPaneId(4)).toBe(1);
    });

    it('advanceToNextPane automatically updates activePaneId', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SPLIT_H);
      store.activePaneId = 1;
      store.panes[0].image = {} as any;

      const next = store.advanceToNextPane();
      expect(next).toBe(2);
      expect(store.activePaneId).toBe(2);
    });
  });

  describe('UI & Visual Feedback Markup Standards', () => {
    it('renderViewSplitPane renders active border ring and pulse badge when isActive is true', () => {
      const pane = {
        id: 1,
        title: 'Ảnh A',
        image: null,
        name: '',
        width: 0,
        height: 0,
        zoom: 1.0
      };

      const html = renderViewSplitPane(pane as any, true, 'bilinear');

      expect(html).toContain('border-cyan-500/80');
      expect(html).toContain('ring-2 ring-cyan-500/30');
      expect(html).toContain('ĐANG CHỌN');
      expect(html).toContain('data-pane-id="1"');
    });

    it('renderViewSplitPane renders clickable styling when isActive is false', () => {
      const pane = {
        id: 2,
        title: 'Ảnh B',
        image: null,
        name: '',
        width: 0,
        height: 0,
        zoom: 1.0
      };

      const html = renderViewSplitPane(pane as any, false, 'bilinear');

      expect(html).toContain('cursor-pointer');
      expect(html).toContain('Bấm để chọn khung hình này');
      expect(html).not.toContain('ĐANG CHỌN');
    });

    it('renderViewSplitToolbar renders active pane segmented buttons matching visibleCount', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SPLIT_H); // 2 visible panes
      store.activePaneId = 1;

      const html = renderViewSplitToolbar(store);

      expect(html).toContain('data-action="select-pane"');
      expect(html).toContain('data-pane-id="1"');
      expect(html).toContain('data-pane-id="2"');
      // Should not have Pane 3 button in 2H layout
      expect(html).not.toContain('data-pane-id="3"');

      // Now switch to QUAD layout (4 visible panes)
      store.setLayout(LAYOUT_MODES.QUAD);
      const htmlQuad = renderViewSplitToolbar(store);
      expect(htmlQuad).toContain('data-pane-id="1"');
      expect(htmlQuad).toContain('data-pane-id="2"');
      expect(htmlQuad).toContain('data-pane-id="3"');
      expect(htmlQuad).toContain('data-pane-id="4"');
    });

    it('renderViewSplitSliderOverlay renders clickable header pills and selectable slot cards', () => {
      const store = new ViewSplitStore();
      store.setLayout(LAYOUT_MODES.SLIDER);
      store.activePaneId = 1;

      const html = renderViewSplitSliderOverlay(store);

      // Header pills
      expect(html).toContain('data-action="select-pane"');
      expect(html).toContain('data-pane-id="1"');
      expect(html).toContain('data-pane-id="2"');

      // Slot cards
      expect(html).toContain('Ảnh Trước • Ảnh A');
      expect(html).toContain('Ảnh Sau • Ảnh B');
      expect(html).toContain('border-cyan-500/80'); // Active Slot A ring
    });
  });
});
