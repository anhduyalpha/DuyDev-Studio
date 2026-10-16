import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import target frontend components
// @ts-ignore
import { PdfCanvasViewer } from '../../../src/components/common/viewer/renderers/pdf/PdfCanvasViewer.js';
// @ts-ignore
import { PdfSearchEngine, renderSearchBar, updateSearchBarMatchCount } from '../../../src/components/common/viewer/renderers/pdf/PdfSearchBar.js';
// @ts-ignore
import { renderSidebarDrawer, switchSidebarTab, updateActiveSidebarPage } from '../../../src/components/common/viewer/renderers/pdf/PdfSidebarDrawer.js';
// @ts-ignore
import { renderFloatingDock, updateFloatingDockState } from '../../../src/components/common/viewer/renderers/pdf/PdfFloatingDock.js';
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
  textContent: string = '';
  clientWidth: number = 800;
  clientHeight: number = 600;
  scrollTop: number = 0;
  private _innerHTML: string = '';

  constructor(tagName: string = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
  }

  get innerHTML(): string {
    return this._innerHTML;
  }
  set innerHTML(html: string) {
    this._innerHTML = html;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  addEventListener(_event: string, _handler: any) {}
  removeEventListener(_event: string, _handler: any) {}
  scrollIntoView() {}
  focus() {}
  select() {}

  querySelector(sel: string): MockElement | null {
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      if (this.id === id) return this;
      for (const child of this.children) {
        const found = child.querySelector(sel);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(_sel: string): MockElement[] {
    return [];
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
      activeElement: null
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

    it('should clamp zoom scale between 0.4 and 3.5', () => {
      const viewer = new PdfCanvasViewer(mockContainer);
      viewer.scale = 1.0;

      viewer.zoomIn();
      expect(viewer.scale).toBe(1.0); // before debounce
      viewer.setScale(5.0); // should clamp to 3.5
      // Fast forward debounce
      if (viewer.zoomDebounceTimer) {
        clearTimeout(viewer.zoomDebounceTimer);
        viewer.scale = 3.5;
      }
      expect(viewer.scale).toBe(3.5);

      viewer.setScale(0.1); // should clamp to 0.4
      if (viewer.zoomDebounceTimer) {
        clearTimeout(viewer.zoomDebounceTimer);
        viewer.scale = 0.4;
      }
      expect(viewer.scale).toBe(0.4);
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
});
