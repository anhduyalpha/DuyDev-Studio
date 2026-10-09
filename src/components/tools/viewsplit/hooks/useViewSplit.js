/**
 * useViewSplit.js - Reactive State Management Store for ViewSplit
 * Manages multi-pane layouts, synchronized transforms, pixel inspector cache, and image documents.
 */

import {
  DEFAULT_ZOOM,
  calculateFitAll,
  calculateActualSize,
  getNormalizedCenter,
  panFromNormalizedCenter,
  viewToImageCoordinates,
  extractPixelInfo,
  extract9x9Neighborhood,
  clamp
} from './useViewSplitSync.js';

export const PANE_TITLES = ['Ảnh A', 'Ảnh B', 'Ảnh C', 'Ảnh D'];
export const MAX_PANES = 4;

export const LAYOUT_MODES = {
  SINGLE: '1',
  SPLIT_H: '2H',
  SPLIT_V: '2V',
  TRIPLE_H: '3H',
  TRIPLE_L: '3L',
  TRIPLE_T: '3T',
  QUAD: '4Grid',
  SLIDER: 'slider',
  DIFF: 'diff'
};

function createInitialPane(id) {
  return {
    id,
    title: PANE_TITLES[id - 1] || `Ảnh ${id}`,
    image: null,
    imageData: null, // Cached Uint8ClampedArray for 0ms pixel sampling
    name: '',
    width: 0,
    height: 0,
    size: 0,
    zoom: DEFAULT_ZOOM,
    panX: 0,
    panY: 0,
    cursor: {
      viewX: 0,
      viewY: 0,
      imageX: 0,
      imageY: 0,
      normalizedX: 0.5,
      normalizedY: 0.5,
      inside: false
    }
  };
}

class ViewSplitStore {
  constructor() {
    this.layout = LAYOUT_MODES.SPLIT_H;
    this.activePaneId = 1;
    this.syncView = true;
    this.syncCursor = true;
    this.filter = 'bilinear'; // 'bilinear' | 'nearest'
    this.sliderPos = 0.5; // 0.0 - 1.0
    this.diffMultiplier = 3; // 1 - 10
    this.inspectorOpen = true;
    this.mobileActiveTab = 1;

    this.panes = [
      createInitialPane(1),
      createInitialPane(2),
      createInitialPane(3),
      createInitialPane(4)
    ];

    this.pixelInspectorState = {
      paneId: 1,
      x: 0,
      y: 0,
      r: 0,
      g: 0,
      b: 0,
      a: 0,
      hex: '#000000',
      isValid: false,
      neighborhood: []
    };

    this.isUrlModalOpen = false;
    this.urlModalTargetPaneId = 1;

    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = 'state-change') {
    this.listeners.forEach((fn) => {
      try {
        fn(this, event);
      } catch (err) {
        console.error('[ViewSplitStore] Listener error:', err);
      }
    });
  }

  getPane(id) {
    return this.panes.find((p) => p.id === id) || this.panes[0];
  }

  getActivePane() {
    return this.getPane(this.activePaneId);
  }

  setActivePane(id) {
    if (this.activePaneId !== id && id >= 1 && id <= MAX_PANES) {
      this.activePaneId = id;
      this.mobileActiveTab = id;
      this.notify('active-pane');
    }
  }

  setLayout(layout) {
    if (this.layout !== layout) {
      this.layout = layout;
      this.notify('layout');
    }
  }

  setFilter(filter) {
    if (this.filter !== filter) {
      this.filter = filter;
      this.notify('filter');
    }
  }

  toggleFilter() {
    this.setFilter(this.filter === 'bilinear' ? 'nearest' : 'bilinear');
  }

  setSyncView(enabled) {
    this.syncView = Boolean(enabled);
    this.notify('sync-view');
  }

  toggleSyncView() {
    this.setSyncView(!this.syncView);
  }

  setSyncCursor(enabled) {
    this.syncCursor = Boolean(enabled);
    this.notify('sync-cursor');
  }

  toggleSyncCursor() {
    this.setSyncCursor(!this.syncCursor);
  }

  setInspectorOpen(isOpen) {
    this.inspectorOpen = Boolean(isOpen);
    this.notify('inspector');
  }

  toggleInspector() {
    this.setInspectorOpen(!this.inspectorOpen);
  }

  setSliderPos(pos) {
    this.sliderPos = clamp(pos, 0, 1);
    this.notify('slider');
  }

  setDiffMultiplier(mult) {
    this.diffMultiplier = clamp(mult, 1, 10);
    this.notify('diff-multiplier');
  }

  setMobileActiveTab(id) {
    this.mobileActiveTab = id;
    this.activePaneId = id;
    this.notify('mobile-tab');
  }

  openUrlModal(paneId = this.activePaneId) {
    this.isUrlModalOpen = true;
    this.urlModalTargetPaneId = paneId;
    this.notify('url-modal');
  }

  closeUrlModal() {
    this.isUrlModalOpen = false;
    this.notify('url-modal');
  }

  /**
   * Sets image for a specific pane, caches ImageData in offscreen canvas for instantaneous pixel sampling.
   */
  setImageForPane(paneId, imgElement, { name = '', size = 0 } = {}) {
    const pane = this.getPane(paneId);
    if (!pane || !imgElement) return;

    pane.image = imgElement;
    pane.name = name || 'Ảnh đã nạp';
    pane.width = imgElement.naturalWidth || imgElement.width;
    pane.height = imgElement.naturalHeight || imgElement.height;
    pane.size = size;

    // Cache image pixel buffer via an OffscreenCanvas or regular Canvas
    try {
      const offscreen = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(pane.width, pane.height)
        : document.createElement('canvas');
      offscreen.width = pane.width;
      offscreen.height = pane.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgElement, 0, 0);
        const imgData = ctx.getImageData(0, 0, pane.width, pane.height);
        pane.imageData = imgData.data;
      }
    } catch (err) {
      console.warn('[ViewSplitStore] Failed to cache pixel buffer for sampling:', err);
      pane.imageData = null;
    }

    // Default 100% or fit-all
    pane.zoom = DEFAULT_ZOOM;
    pane.panX = 0;
    pane.panY = 0;

    this.notify('image-loaded');
  }

  clearPane(paneId) {
    const pane = this.getPane(paneId);
    if (!pane) return;

    pane.image = null;
    pane.imageData = null;
    pane.name = '';
    pane.width = 0;
    pane.height = 0;
    pane.size = 0;
    pane.zoom = DEFAULT_ZOOM;
    pane.panX = 0;
    pane.panY = 0;
    pane.cursor.inside = false;

    if (this.pixelInspectorState.paneId === paneId) {
      this.clearPixelInspector();
    }

    this.notify('image-cleared');
  }

  /**
   * Updates transform for a pane, and broadcasts to other panes if syncView is enabled.
   */
  setTransform(sourcePaneId, zoom, panX, panY, viewWidth, viewHeight) {
    const sourcePane = this.getPane(sourcePaneId);
    if (!sourcePane) return;

    sourcePane.zoom = zoom;
    sourcePane.panX = panX;
    sourcePane.panY = panY;

    if (this.syncView && sourcePane.width > 0 && sourcePane.height > 0) {
      const normCenter = getNormalizedCenter(
        panX,
        panY,
        zoom,
        viewWidth,
        viewHeight,
        sourcePane.width,
        sourcePane.height
      );

      this.panes.forEach((otherPane) => {
        if (otherPane.id !== sourcePaneId && otherPane.image) {
          otherPane.zoom = zoom;
          const { panX: newPanX, panY: newPanY } = panFromNormalizedCenter(
            normCenter,
            zoom,
            viewWidth,
            viewHeight,
            otherPane.width,
            otherPane.height
          );
          otherPane.panX = newPanX;
          otherPane.panY = newPanY;
        }
      });
    }

    this.notify('transform');
  }

  /**
   * Fits all panes or single pane to screen.
   */
  fitAll(sourcePaneId = this.activePaneId, viewWidth = 800, viewHeight = 600) {
    const targetPanes = this.syncView
      ? this.panes.filter((p) => p.image)
      : [this.getPane(sourcePaneId)];

    targetPanes.forEach((pane) => {
      if (pane.image && pane.width > 0 && pane.height > 0) {
        const { zoom, panX, panY } = calculateFitAll(
          pane.width,
          pane.height,
          viewWidth,
          viewHeight,
          24
        );
        pane.zoom = zoom;
        pane.panX = panX;
        pane.panY = panY;
      }
    });

    this.notify('transform');
  }

  /**
   * Resets view to 1:1 Actual Size.
   */
  actualSize(sourcePaneId = this.activePaneId, viewWidth = 800, viewHeight = 600) {
    const targetPanes = this.syncView
      ? this.panes.filter((p) => p.image)
      : [this.getPane(sourcePaneId)];

    targetPanes.forEach((pane) => {
      if (pane.image && pane.width > 0 && pane.height > 0) {
        const { zoom, panX, panY } = calculateActualSize(
          pane.width,
          pane.height,
          viewWidth,
          viewHeight
        );
        pane.zoom = zoom;
        pane.panX = panX;
        pane.panY = panY;
      }
    });

    this.notify('transform');
  }

  /**
   * Resets pan and zoom to initial state.
   */
  resetView(sourcePaneId = this.activePaneId) {
    const targetPanes = this.syncView ? this.panes : [this.getPane(sourcePaneId)];
    targetPanes.forEach((pane) => {
      pane.zoom = DEFAULT_ZOOM;
      pane.panX = 0;
      pane.panY = 0;
    });
    this.notify('transform');
  }

  /**
   * Updates cursor position on source pane and extracts pixel info for HUD.
   */
  updateCursor(sourcePaneId, viewX, viewY, isInside) {
    const sourcePane = this.getPane(sourcePaneId);
    if (!sourcePane) return;

    sourcePane.cursor.viewX = viewX;
    sourcePane.cursor.viewY = viewY;
    sourcePane.cursor.inside = isInside;

    if (!isInside || !sourcePane.image) {
      if (this.pixelInspectorState.paneId === sourcePaneId) {
        this.clearPixelInspector();
      }
      return;
    }

    const { x: imageX, y: imageY, isInside: isImagePixel } = viewToImageCoordinates(
      viewX,
      viewY,
      sourcePane.panX,
      sourcePane.panY,
      sourcePane.zoom,
      sourcePane.width,
      sourcePane.height
    );

    if (!isImagePixel) {
      if (this.pixelInspectorState.paneId === sourcePaneId) {
        this.clearPixelInspector();
      }
      return;
    }

    sourcePane.cursor.imageX = imageX;
    sourcePane.cursor.imageY = imageY;
    sourcePane.cursor.normalizedX = sourcePane.width > 0 ? clamp(imageX / sourcePane.width, 0, 1) : 0.5;
    sourcePane.cursor.normalizedY = sourcePane.height > 0 ? clamp(imageY / sourcePane.height, 0, 1) : 0.5;

    // Sync cursor crosshair to other panes if enabled
    if (this.syncCursor) {
      this.panes.forEach((other) => {
        if (other.id !== sourcePaneId && other.image) {
          other.cursor.inside = isInside;
          other.cursor.imageX = Math.floor(sourcePane.cursor.normalizedX * other.width);
          other.cursor.imageY = Math.floor(sourcePane.cursor.normalizedY * other.height);
          other.cursor.viewX = other.cursor.imageX * other.zoom + other.panX;
          other.cursor.viewY = other.cursor.imageY * other.zoom + other.panY;
        }
      });
    }

    // Update Pixel Inspector
    if (sourcePane.imageData) {
      const pixelInfo = extractPixelInfo(
        sourcePane.imageData,
        imageX,
        imageY,
        sourcePane.width,
        sourcePane.height
      );
      const neighborhood = extract9x9Neighborhood(
        sourcePane.imageData,
        imageX,
        imageY,
        sourcePane.width,
        sourcePane.height
      );

      this.pixelInspectorState = {
        paneId: sourcePaneId,
        ...pixelInfo,
        neighborhood
      };
      this.notify('pixel-update');
    }
  }

  clearAllCursors() {
    this.panes.forEach((p) => {
      p.cursor.inside = false;
    });
    this.clearPixelInspector();
    this.notify('cursor-cleared');
  }

  clearPixelInspector() {
    this.pixelInspectorState = {
      paneId: this.activePaneId,
      x: 0,
      y: 0,
      r: 0,
      g: 0,
      b: 0,
      a: 0,
      hex: '#000000',
      isValid: false,
      neighborhood: []
    };
    this.notify('pixel-update');
  }

  /**
   * Resets entire store to initial state.
   */
  resetAll() {
    this.panes.forEach((p) => this.clearPane(p.id));
    this.layout = LAYOUT_MODES.SPLIT_H;
    this.activePaneId = 1;
    this.syncView = true;
    this.syncCursor = true;
    this.filter = 'bilinear';
    this.sliderPos = 0.5;
    this.diffMultiplier = 3;
    this.notify('reset-all');
  }
}

export const viewSplitStore = new ViewSplitStore();
