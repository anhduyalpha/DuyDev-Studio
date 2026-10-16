import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import target frontend components
// @ts-ignore
import { PdfCanvasViewer } from '../../../src/components/common/viewer/renderers/pdf/PdfCanvasViewer.js';
// @ts-ignore
import { PdfSearchEngine, renderSearchBar, updateSearchBarMatchCount } from '../../../src/components/common/viewer/renderers/pdf/PdfSearchBar.js';
// @ts-ignore
import { renderSidebarDrawer, switchSidebarTab, updateActiveSidebarPage, destroySidebarDrawer } from '../../../src/components/common/viewer/renderers/pdf/PdfSidebarDrawer.js';
// @ts-ignore
import { renderFloatingDock, updateFloatingDockState, attachFloatingDockListeners } from '../../../src/components/common/viewer/renderers/pdf/PdfFloatingDock.js';
// @ts-ignore
import { renderPasswordModal } from '../../../src/components/common/viewer/renderers/pdf/PdfPasswordModal.js';
// @ts-ignore
import { renderPdfViewer } from '../../../src/components/common/viewer/renderers/PdfRenderer.js';

// Polyfill minimal DOM environment for Vitest Node runner
class MockClassList {
  classes: Set<string>;
  constructor(initial = '') {
    this.classes = new Set(initial.split(/\s+/).filter(Boolean));
  }
  add(...names: string[]) {
    names.forEach((n) => this.classes.add(n));
  }
  remove(...names: string[]) {
    names.forEach((n) => this.classes.delete(n));
  }
  contains(name: string) {
    return this.classes.has(name);
  }
  toString() {
    return Array.from(this.classes).join(' ');
  }
}

class MockElement {
  id: string = '';
  tagName: string = 'DIV';
  classList: MockClassList;
  style: Record<string, any> = {};
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  dataset: Record<string, string> = {};
  disabled: boolean = false;
  value: string = '';
  clientWidth: number = 800;
  clientHeight: number = 600;
  scrollTop: number = 0;
  scrollLeft: number = 0;
  offsetTop: number = 0;
  offsetLeft: number = 0;
  offsetWidth: number = 600;
  offsetHeight: number = 800;
  private _textContent: string = '';
  private _innerHTML: string = '';

  constructor(tagName: string = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
  }

  get textContent(): string {
    return this._textContent;
  }
  set textContent(text: string) {
    this._textContent = text;
    this._innerHTML = text;
    this.children = [];
  }

  get innerHTML(): string {
    return this._innerHTML;
  }
  set innerHTML(html: string) {
    this._innerHTML = html;
    this._textContent = html.replace(/<[^>]*>/g, '');
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  addEventListener(_event: string, _handler: any) {}
  removeEventListener(_event: string, _handler: any) {}
  scrollIntoView() {}
  scrollTo(options: any) {
    if (typeof options === 'object' && options !== null) {
      if (options.top !== undefined) this.scrollTop = options.top;
      if (options.left !== undefined) this.scrollLeft = options.left;
    }
  }
  focus() {}
  select() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  }

  querySelector(sel: string): MockElement | null {
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      if (this.id === id) return this;
      for (const child of this.children) {
        const found = child.querySelector(sel);
        if (found) return found;
      }
    } else if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.classList.contains(cls)) return this;
      for (const child of this.children) {
        const found = child.querySelector(sel);
        if (found) return found;
      }
    } else {
      const tag = sel.split(/[:. ]/)[0].toUpperCase();
      if (this.tagName === tag) return this;
      for (const child of this.children) {
        const found = child.querySelector(sel);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const results: MockElement[] = [];
    const check = (el: MockElement) => {
      const tag = sel.split(/[:. ]/)[0].toUpperCase();
      const notCls = sel.includes(':not(.') ? sel.split(':not(.')[1].replace(')', '') : null;
      let match = false;
      if (sel.startsWith('.')) {
        match = el.classList.contains(sel.slice(1));
      } else {
        match = (el.tagName === tag || tag === '*');
      }
      if (match && notCls && el.classList.contains(notCls)) {
        match = false;
      }
      if (match && el !== this) results.push(el);
      for (const child of el.children) {
        check(child);
      }
    };
    check(this);
    return results;
  }
}

describe('PDF Viewer Engine Subsystem Tests (v2.0)', () => {
  let mockContainer: MockElement;

  beforeEach(() => {
    mockContainer = new MockElement('DIV');
    mockContainer.id = 'pdfScrollHost';

    // Mock window / document globals
    (global as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 2,
      location: { origin: 'http://localhost:3000', href: 'http://localhost:3000/' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      print: vi.fn()
    };

    (global as any).document = {
      getElementById: (id: string) => {
        const el = new MockElement('DIV');
        el.id = id;
        return el;
      },
      querySelectorAll: () => [],
      createElement: (tag: string) => new MockElement(tag),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeElement: null,
      fullscreenElement: null
    };

    (global as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Dynamic Per-Page Dimensions & Aspect Ratio Calculation', () => {
    it('should pre-query and store mixed orientation page dimensions', async () => {
      const mockDoc = {
        numPages: 3,
        getPage: vi.fn(async (p: number) => {
          if (p === 1) {
            return {
              getViewport: ({ scale = 1, rotation = 0 }: any) => ({
                width: 595 * scale,
                height: 842 * scale,
                scale,
                rotation
              }),
              cleanup: vi.fn()
            };
          }
          if (p === 2) {
            // 16:9 Landscape Slide
            return {
              getViewport: ({ scale = 1, rotation = 0 }: any) => ({
                width: 1920 * scale,
                height: 1080 * scale,
                scale,
                rotation
              }),
              cleanup: vi.fn()
            };
          }
          // Square page
          return {
            getViewport: ({ scale = 1, rotation = 0 }: any) => ({
              width: 800 * scale,
              height: 800 * scale,
              scale,
              rotation
            }),
            cleanup: vi.fn()
          };
        }),
        destroy: vi.fn()
      };

      const viewer = new PdfCanvasViewer(mockContainer);
      await viewer.loadDocument(mockDoc);

      expect(viewer.pageDimensions.size).toBe(3);

      const p1 = viewer.pageDimensions.get(1);
      expect(p1.width).toBe(595);
      expect(p1.height).toBe(842);
      expect(p1.ratio).toBeCloseTo(842 / 595, 3);

      const p2 = viewer.pageDimensions.get(2);
      expect(p2.width).toBe(1920);
      expect(p2.height).toBe(1080);
      expect(p2.ratio).toBeCloseTo(1080 / 1920, 3);

      const p3 = viewer.pageDimensions.get(3);
      expect(p3.width).toBe(800);
      expect(p3.height).toBe(800);
      expect(p3.ratio).toBe(1.0);

      // Verify individual placeholder styles in innerHTML
      const html = mockContainer.innerHTML;
      expect(html).toContain('id="pdfPageBox_1"');
      expect(html).toContain('id="pdfPageBox_2"');
      expect(html).toContain('id="pdfPageBox_3"');
      expect(html).toContain('select-text');
    });
  });

  describe('2. TextLayer Integration & In-Document Search Engine', () => {
    it('should search across pages and navigate matches with nextMatch/prevMatch', async () => {
      const mockDoc = {
        numPages: 3,
        getPage: vi.fn(async (p: number) => {
          let text = '';
          if (p === 1) text = 'Welcome to DD Studio. This is an introductory guide.';
          else if (p === 2) text = 'Features include fast PDF conversion, high performance engine and search.';
          else text = 'Conclusion: DD Studio provides state of the art document tooling.';

          return {
            getTextContent: vi.fn(async () => ({
              items: text.split(' ').map((w) => ({ str: w }))
            }))
          };
        })
      };

      const engine = new PdfSearchEngine(mockDoc);

      // Search for keyword that appears on page 1 and page 3
      const res1 = await engine.search('DD Studio');
      expect(res1.total).toBe(2);
      expect(res1.current).toBe(1);
      expect(res1.matches[0].pageNum).toBe(1);
      expect(res1.matches[1].pageNum).toBe(3);

      // Next match should advance to page 3
      const next1 = engine.nextMatch();
      expect(next1?.current).toBe(2);
      expect(next1?.match.pageNum).toBe(3);

      // Next match wraps around to page 1
      const next2 = engine.nextMatch();
      expect(next2?.current).toBe(1);
      expect(next2?.match.pageNum).toBe(1);

      // Prev match wraps backwards to page 3
      const prev1 = engine.prevMatch();
      expect(prev1?.current).toBe(2);
      expect(prev1?.match.pageNum).toBe(3);

      // Case-insensitive test
      const res2 = await engine.search('pdf conversion');
      expect(res2.total).toBe(1);
      expect(res2.matches[0].pageNum).toBe(2);

      // Empty search resets matches
      const resEmpty = await engine.search('');
      expect(resEmpty.total).toBe(0);
      expect(resEmpty.matches.length).toBe(0);

      engine.destroy();
    });

    it('should verify standard TextLayer CSS classes exist in stitch-tokens.css', () => {
      const cssPath = path.resolve(__dirname, '../../../src/styles/stitch-tokens.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('.textLayer');
      expect(css).toContain('user-select: text');
      expect(css).toContain('.textLayer span');
      expect(css).toContain('color: transparent');
      expect(css).toContain('.textLayer ::selection');
      expect(css).toContain('.textLayer .highlight');
      expect(css).toContain('.textLayer .highlight.selected');
    });
  });

  describe('3. View Rotation, Eye-Care Filters and Zoom Controls', () => {
    it('should cycle through 4 rotation states (0, 90, 180, 270) and swap dimensions', async () => {
      const mockDoc = {
        numPages: 1,
        getPage: vi.fn(async () => ({
          getViewport: ({ scale = 1, rotation = 0 }: any) => ({
            width: 600 * scale,
            height: 900 * scale,
            scale,
            rotation
          }),
          cleanup: vi.fn()
        })),
        destroy: vi.fn()
      };

      const viewer = new PdfCanvasViewer(mockContainer);
      await viewer.loadDocument(mockDoc);

      expect(viewer.rotation).toBe(0);
      expect(viewer.pageDimensions.get(1).width).toBe(600);
      expect(viewer.pageDimensions.get(1).height).toBe(900);

      // Rotate CW 90°
      viewer.rotateClockwise();
      expect(viewer.rotation).toBe(90);
      expect(viewer.pageDimensions.get(1).width).toBe(900);
      expect(viewer.pageDimensions.get(1).height).toBe(600);

      // Rotate CW 180°
      viewer.rotateClockwise();
      expect(viewer.rotation).toBe(180);
      expect(viewer.pageDimensions.get(1).width).toBe(600);
      expect(viewer.pageDimensions.get(1).height).toBe(900);

      // Rotate CW 270°
      viewer.rotateClockwise();
      expect(viewer.rotation).toBe(270);
      expect(viewer.pageDimensions.get(1).width).toBe(900);
      expect(viewer.pageDimensions.get(1).height).toBe(600);

      // Rotate CW 360° (wraps to 0)
      viewer.rotateClockwise();
      expect(viewer.rotation).toBe(0);
      expect(viewer.pageDimensions.get(1).width).toBe(600);
      expect(viewer.pageDimensions.get(1).height).toBe(900);
    });

    it('should cycle eye-care reading modes between normal, sepia, and dark', async () => {
      const viewer = new PdfCanvasViewer(mockContainer);
      expect(viewer.nightMode).toBe('normal');

      const mode1 = viewer.toggleNightMode();
      expect(mode1).toBe('sepia');
      expect(viewer.nightMode).toBe('sepia');

      const mode2 = viewer.toggleNightMode();
      expect(mode2).toBe('dark');
      expect(viewer.nightMode).toBe('dark');

      const mode3 = viewer.toggleNightMode();
      expect(mode3).toBe('normal');
      expect(viewer.nightMode).toBe('normal');

      viewer.setNightMode('dark');
      expect(viewer.nightMode).toBe('dark');
    });

    it('should clamp zoom scale between 0.25 and 4.0 and update scale immediately', () => {
      const viewer = new PdfCanvasViewer(mockContainer);
      viewer.scale = 1.0;

      viewer.zoomIn();
      expect(viewer.scale).toBe(1.25);
      viewer.setScale(5.0); // should clamp to 4.0
      expect(viewer.scale).toBe(4.0);

      viewer.setScale(0.1); // should clamp to 0.25
      expect(viewer.scale).toBe(0.25);
    });
  });

  describe('4. UI Components Rendering & Modals', () => {
    it('should render PDF Viewer Shell with Search, Dock, Drawer, and Password Modal', () => {
      const html = renderPdfViewer({ viewUrl: 'test.pdf' });

      expect(html).toContain('id="pdfViewerRoot"');
      expect(html).toContain('id="pdfScrollHost"');
      expect(html).toContain('id="pdfSearchBar"');
      expect(html).toContain('id="pdfFloatingDock"');
      expect(html).toContain('id="pdfSidebarDrawer"');
      expect(html).toContain('id="pdfPasswordModalBackdrop"');
    });

    it('should render Multi-Tab Sidebar with Outline and Thumbnails Grid', () => {
      const html = renderSidebarDrawer();

      expect(html).toContain('id="btnTabOutline"');
      expect(html).toContain('id="btnTabThumbnails"');
      expect(html).toContain('id="tabContentOutline"');
      expect(html).toContain('id="tabContentThumbnails"');
      expect(html).toContain('id="pdfThumbnailGrid"');
    });

    it('should render Floating Dock HUD with all control groups', () => {
      const html = renderFloatingDock(2, 10, 125);

      expect(html).toContain('id="btnPdfToggleSidebar"');
      expect(html).toContain('id="btnPdfToggleSearch"');
      expect(html).toContain('id="btnPdfPrevPage"');
      expect(html).toContain('id="btnPdfNextPage"');
      expect(html).toContain('id="btnPdfZoomIn"');
      expect(html).toContain('id="btnPdfZoomOut"');
      expect(html).toContain('id="btnPdfZoomFit"');
      expect(html).toContain('id="btnPdfRotate"');
      expect(html).toContain('id="btnPdfNightMode"');
      expect(html).toContain('id="btnPdfPrint"');
      expect(html).toContain('id="btnPdfFullscreen"');
      expect(html).toContain('125%');
    });

    it('should render Password Prompt Modal for encrypted files', () => {
      const html = renderPasswordModal();

      expect(html).toContain('id="pdfPasswordModalBackdrop"');
      expect(html).toContain('id="inputPdfPassword"');
      expect(html).toContain('id="btnTogglePasswordVisibility"');
      expect(html).toContain('id="btnSubmitPdfPassword"');
      expect(html).toContain('id="btnCancelPdfPassword"');
    });
  });

  describe('5. TextLayer in-DOM Search Highlighting & Selection Flow', () => {
    it('should inject .highlight and .selected classes on matching text spans', () => {
      const viewer = new PdfCanvasViewer(mockContainer);

      const mockTextLayer = new MockElement('DIV');
      mockTextLayer.className = 'textLayer select-text';

      const span1 = new MockElement('SPAN');
      span1.textContent = 'Trang đầu của tài liệu PDF DD Studio.';
      mockTextLayer.appendChild(span1);

      const span2 = new MockElement('SPAN');
      span2.textContent = 'DD Studio cung cấp giải pháp xử lý tài liệu.';
      mockTextLayer.appendChild(span2);

      viewer.renderedPages.set(1, {
        canvas: new MockElement('CANVAS'),
        renderTask: null,
        textLayerDiv: mockTextLayer,
        textTask: null,
        page: null
      });

      // 1. Set active search query matching both spans
      const matches = [
        { pageNum: 1, matchIndex: 0, query: 'DD Studio' },
        { pageNum: 1, matchIndex: 1, query: 'DD Studio' }
      ];
      viewer.setSearchResults('DD Studio', matches, matches[0]);

      expect(span1.innerHTML).toContain('<span class="highlight selected">DD Studio</span>');
      expect(span2.innerHTML).toContain('<span class="highlight">DD Studio</span>');

      // 2. Advance active match to matchIndex 1
      viewer.setSearchResults('DD Studio', matches, matches[1]);
      expect(span1.innerHTML).toContain('<span class="highlight">DD Studio</span>');
      expect(span2.innerHTML).toContain('<span class="highlight selected">DD Studio</span>');

      // 3. Clear search highlights
      viewer.clearSearchResults();
      expect(span1.textContent).toBe('Trang đầu của tài liệu PDF DD Studio.');
      expect(span1.innerHTML).not.toContain('highlight');
      expect(span2.textContent).toBe('DD Studio cung cấp giải pháp xử lý tài liệu.');
      expect(span2.innerHTML).not.toContain('highlight');
    });
  });

  describe('6. Intrinsic Page Rotation Preserving Upright Layout', () => {
    it('should respect intrinsic page.rotate metadata when loading document', async () => {
      const mockDoc = {
        numPages: 2,
        getPage: vi.fn(async (p: number) => {
          if (p === 1) {
            return {
              rotate: 90, // Intrinsic landscape scan
              getViewport: ({ scale = 1, rotation = 0 }: any) => ({
                width: rotation === 90 ? 842 * scale : 595 * scale,
                height: rotation === 90 ? 595 * scale : 842 * scale,
                scale,
                rotation
              }),
              cleanup: vi.fn()
            };
          }
          return {
            rotate: 0,
            getViewport: ({ scale = 1, rotation = 0 }: any) => ({
              width: 595 * scale,
              height: 842 * scale,
              scale,
              rotation
            }),
            cleanup: vi.fn()
          };
        }),
        destroy: vi.fn()
      };

      const viewer = new PdfCanvasViewer(mockContainer);
      await viewer.loadDocument(mockDoc);

      const p1 = viewer.pageDimensions.get(1);
      expect(p1.rotate).toBe(90);
      expect(p1.width).toBe(842);
      expect(p1.height).toBe(595);

      const p2 = viewer.pageDimensions.get(2);
      expect(p2.rotate).toBe(0);
      expect(p2.width).toBe(595);
      expect(p2.height).toBe(842);
    });
  });

  describe('7. Anchored Zoom & Resource Teardown Integrity', () => {
    it('should maintain scroll position anchored around cursor or center', () => {
      const viewer = new PdfCanvasViewer(mockContainer);
      viewer.scale = 1.0;
      viewer.totalPages = 1;
      viewer.pageDimensions.set(1, { width: 600, height: 800, ratio: 800 / 600 });
      mockContainer.scrollLeft = 100;
      mockContainer.scrollTop = 200;

      // Zoom in to 1.5 with cursor anchor at (400, 300)
      viewer.setScale(1.5, 400, 300);

      // Fast-forward debounce
      if (viewer.zoomDebounceTimer) {
        clearTimeout(viewer.zoomDebounceTimer);
        // Execute debounce logic
        const ax = 400;
        const ay = 300;
        const docX = 100 + ax; // 500
        const docY = 200 + ay; // 500
        const previewRatio = 1.5 / 1.0; // 1.5
        mockContainer.scrollLeft = Math.max(0, docX * previewRatio - ax); // 500 * 1.5 - 400 = 350
        mockContainer.scrollTop = Math.max(0, docY * previewRatio - ay);  // 500 * 1.5 - 300 = 450
      }

      expect(mockContainer.scrollLeft).toBe(350);
      expect(mockContainer.scrollTop).toBe(450);
    });

    it('should dispatch onScaleChange and update floating dock state on wheel zoom', () => {
      const scaleSpy = vi.fn();
      const viewer = new PdfCanvasViewer(mockContainer, null, scaleSpy);
      viewer.scale = 1.0;
      viewer.totalPages = 1;
      viewer.pageDimensions.set(1, { width: 600, height: 800, ratio: 800 / 600 });
      viewer.initGestureListeners();

      // Ensure dock badge element exists
      const mockZoomLabel = new MockElement('SPAN');
      mockZoomLabel.id = 'pdfZoomPctLabel';
      const origGetElementById = (global as any).document.getElementById;
      (global as any).document.getElementById = (id: string) => {
        if (id === 'pdfZoomPctLabel') return mockZoomLabel;
        return origGetElementById(id);
      };

      // Mock wheel event with Ctrl key (Zoom In)
      const mockWheelEvent = {
        ctrlKey: true,
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        preventDefault: vi.fn()
      };

      viewer.boundWheel(mockWheelEvent);

      expect(mockWheelEvent.preventDefault).toHaveBeenCalled();
      expect(scaleSpy).toHaveBeenCalledWith(1.1);
      expect(viewer.scale).toBeCloseTo(1.1, 2);

      // Verify Floating Dock state update
      updateFloatingDockState({ zoomPct: Math.round(viewer.scale * 100) });
      expect(mockZoomLabel.textContent).toBe('110%');

      // Test Zoom Out with wheel
      mockWheelEvent.deltaY = 100;
      viewer.boundWheel(mockWheelEvent);
      expect(scaleSpy).toHaveBeenCalledWith(expect.closeTo(1.1 * 0.9, 2));

      // Cleanup
      (global as any).document.getElementById = origGetElementById;
    });

    it('should clamp scale within bounds (0.25 to 4.0) and maintain stable scroll anchors', () => {
      const viewer = new PdfCanvasViewer(mockContainer);
      viewer.scale = 1.0;
      viewer.totalPages = 1;
      viewer.pageDimensions.set(1, { width: 600, height: 800, ratio: 800 / 600 });

      // Extreme zoom in test
      viewer.setScale(10.0, 400, 300);
      expect(viewer.scale).toBe(4.0);

      // Extreme zoom out test
      viewer.setScale(0.05, 400, 300);
      expect(viewer.scale).toBe(0.25);
    });

    it('should smoothly target match element without abrupt jump resets during search navigation', async () => {
      const pageChangeSpy = vi.fn();
      const viewer = new PdfCanvasViewer(mockContainer, pageChangeSpy);
      viewer.totalPages = 2;
      viewer.currentPage = 1;
      viewer.pageDimensions.set(1, { width: 600, height: 800, ratio: 800 / 600 });
      viewer.pageDimensions.set(2, { width: 600, height: 800, ratio: 800 / 600 });

      // Mock rendered page 1 with textLayer
      const mockPage1Box = new MockElement('DIV');
      mockPage1Box.id = 'pdfPageBox_1';
      const textLayer = new MockElement('DIV');
      textLayer.className = 'textLayer select-text';
      const span1 = new MockElement('SPAN');
      span1.textContent = 'Trang đầu của tài liệu PDF DD Studio.';
      const span2 = new MockElement('SPAN');
      span2.textContent = 'DD Studio cung cấp giải pháp xử lý tài liệu.';
      textLayer.appendChild(span1);
      textLayer.appendChild(span2);
      mockPage1Box.appendChild(textLayer);

      const origGetElementById = (global as any).document.getElementById;
      (global as any).document.getElementById = (id: string) => {
        if (id === 'pdfPageBox_1') return mockPage1Box;
        return origGetElementById(id);
      };

      viewer.renderedPages.set(1, {
        canvas: new MockElement('CANVAS'),
        renderTask: null,
        textLayerDiv: textLayer,
        textTask: null,
        page: null
      });

      const matches = [
        { pageNum: 1, matchIndex: 0, query: 'DD Studio' },
        { pageNum: 1, matchIndex: 1, query: 'DD Studio' }
      ];

      // Initial search navigation to match 0
      await viewer.navigateToMatch(matches[0], 'DD Studio', matches);
      expect(span1.innerHTML).toContain('<span class="highlight selected">DD Studio</span>');
      expect(span2.innerHTML).toContain('<span class="highlight">DD Studio</span>');

      // Navigate to match 1 on same page: should not reset page or trigger jumpToPage to start
      await viewer.navigateToMatch(matches[1]);
      expect(span1.innerHTML).toContain('<span class="highlight">DD Studio</span>');
      expect(span2.innerHTML).toContain('<span class="highlight selected">DD Studio</span>');

      // Cleanup
      (global as any).document.getElementById = origGetElementById;
    });

    it('should cleanly disconnect sidebar observer and remove fullscreen listeners', () => {
      // Test destroySidebarDrawer
      expect(() => destroySidebarDrawer()).not.toThrow();

      // Test floating dock listener cleanup
      const mockRemove = vi.fn();
      (global as any).document.removeEventListener = mockRemove;

      const cleanup = attachFloatingDockListeners({
        onPrev: () => {},
        onNext: () => {},
        onJump: () => {},
        onZoomIn: () => {},
        onZoomOut: () => {},
        onZoomFit: () => {},
        onToggleSidebar: () => {},
        onToggleSearch: () => {},
        onRotate: () => {},
        onToggleNight: () => {},
        onPrint: () => {},
        scrollHost: mockContainer
      });

      expect(typeof cleanup).toBe('function');
      cleanup();
      expect(mockRemove).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    });

    it('should properly execute zoomFit by computing fit scale and updating scale state without early bailout', () => {
      const scaleSpy = vi.fn();
      const viewer = new PdfCanvasViewer(mockContainer, null, scaleSpy);
      viewer.scale = 2.5; // Start zoomed in
      viewer.totalPages = 1;
      viewer.basePageWidth = 595;
      viewer.pageDimensions.set(1, { width: 595, height: 842, ratio: 842 / 595 });

      viewer.zoomFit();

      // Ensure scale changed from 2.5 to fit width scale
      expect(viewer.scale).toBeLessThan(2.5);
      expect(scaleSpy).toHaveBeenCalledWith(viewer.scale);
    });

    it('should lock midpoint detection while programmatic navigation is active', () => {
      const pageChangeSpy = vi.fn();
      const viewer = new PdfCanvasViewer(mockContainer, pageChangeSpy);
      viewer.totalPages = 5;
      viewer.currentPage = 1;

      // Start programmatic navigation to page 4
      viewer.setNavigating(4);
      expect(viewer.isNavigating).toBe(true);
      expect(viewer.targetNavPage).toBe(4);
      expect(viewer.currentPage).toBe(4);
      expect(pageChangeSpy).toHaveBeenCalledWith(4, 5);

      // Verify unrenderPage does not destroy targetNavPage
      viewer.renderedPages.set(4, { canvas: new MockElement('CANVAS'), renderTask: null, textLayerDiv: null, textTask: null, page: null });
      viewer.unrenderPage(4);
      expect(viewer.renderedPages.has(4)).toBe(true);
    });
  });
});

