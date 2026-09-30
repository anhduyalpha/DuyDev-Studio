import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pdfPageCache } from '../../../src/components/tools/pdf/services/PdfPageCache.js';
import {
  renderPreviewCanvasBox,
  restoreCanvasFromCache,
  restoreThumbnailsSynchronously
} from '../../../src/components/tools/pdf/components/PdfPreviewCanvas.js';
import { renderPdfSplitWorkspace } from '../../../src/components/tools/pdf/components/PdfSplitWorkspace.js';
import { renderPdfRotateWorkspace } from '../../../src/components/tools/pdf/components/PdfRotateWorkspace.js';
import { renderConfigPanel } from '../../../src/components/tools/pdf/components/ConfigPanel.js';

// Setup minimal browser polyfills for headless testing
class MockClassList {
  private classes: Set<string>;
  constructor(initialClass: string = '') {
    this.classes = new Set(initialClass.split(/\s+/).filter(Boolean));
  }
  add(...names: string[]) {
    names.forEach((n) => this.classes.add(n));
  }
  remove(...names: string[]) {
    names.forEach((n) => this.classes.delete(n));
  }
  contains(name: string): boolean {
    return this.classes.has(name);
  }
  toggle(name: string, force?: boolean): boolean {
    if (force !== undefined) {
      if (force) this.add(name);
      else this.remove(name);
      return force;
    }
    if (this.contains(name)) {
      this.remove(name);
      return false;
    }
    this.add(name);
    return true;
  }
  toString(): string {
    return Array.from(this.classes).join(' ');
  }
}

class MockElement {
  id: string = '';
  tagName: string = 'DIV';
  classList: MockClassList;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  disabled: boolean = false;
  width: number = 0;
  height: number = 0;
  value: string = '';
  textContent: string = '';
  private _innerHTML: string = '';
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  drawCalls: Array<{ img: any; x: number; y: number }> = [];

  constructor(tagName: string = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
  }

  get className(): string {
    return this.classList.toString();
  }
  set className(val: string) {
    this.classList = new MockClassList(val);
  }

  get innerHTML(): string {
    return this._innerHTML;
  }
  set innerHTML(html: string) {
    this._innerHTML = html;
    this.children = [];
    parseHtmlToMockElement(html, this);
  }

  getContext(type: string) {
    if (type === '2d') {
      return {
        drawImage: (img: any, x: number, y: number) => {
          this.drawCalls.push({ img, x, y });
        }
      };
    }
    return null;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): MockElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const subSelectors = selector.split(',').map((s) => s.trim());
    const results: MockElement[] = [];
    const seen = new Set<MockElement>();

    for (const sub of subSelectors) {
      this._matchRecursive(this, sub, results, seen);
    }
    return results;
  }

  private _matches(el: MockElement, sel: string): boolean {
    if (!sel || el === this) return false;

    // Handle :not(...)
    const notMatch = sel.match(/^(.*?):not\((.*?)\)$/);
    if (notMatch) {
      const baseSel = notMatch[1];
      const notSel = notMatch[2];
      const basePass = !baseSel || this._matches(el, baseSel);
      const notPass = this._matches(el, notSel);
      return basePass && !notPass;
    }

    // Handle compound selectors with space (ancestor descendant)
    if (sel.includes(' ')) {
      const parts = sel.split(/\s+/);
      const target = parts[parts.length - 1];
      if (!this._matches(el, target)) return false;
      let curr = el.parentElement;
      for (let i = parts.length - 2; i >= 0; i--) {
        while (curr) {
          if (this._matches(curr, parts[i])) break;
          curr = curr.parentElement;
        }
        if (!curr) return false;
        curr = curr.parentElement;
      }
      return true;
    }

    // ID selector #id
    if (sel.startsWith('#')) {
      return el.id === sel.slice(1);
    }

    // Class selector .class
    if (sel.startsWith('.')) {
      return el.classList.contains(sel.slice(1));
    }

    // Attribute selector [attr] or [attr="val"] or [attr^="val"]
    const attrMatch = sel.match(/^\[([a-zA-Z0-9_-]+)([\^=]*)(.*?)\]$/);
    if (attrMatch) {
      const attrName = attrMatch[1];
      const op = attrMatch[2];
      const rawVal = attrMatch[3].replace(/['"]/g, '');
      const datasetKey = attrName.startsWith('data-')
        ? attrName.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase())
        : null;

      const val = datasetKey ? el.dataset[datasetKey] : (el as any)[attrName];
      if (val === undefined) return false;
      if (!op) return true;
      if (op === '=') return String(val) === rawVal;
      if (op === '^=') return String(val).startsWith(rawVal);
      return false;
    }

    // Tag name selector with optional classes or attributes: e.g. canvas.pdf-thumb-canvas or canvas[id^="pdfSplitCanvas_"]
    const tagMatch = sel.match(/^([a-zA-Z0-9]+)(\.[a-zA-Z0-9_-]+|\[.*?\])*$/);
    if (tagMatch) {
      const tag = tagMatch[1].toUpperCase();
      if (el.tagName !== tag) return false;

      // check attached classes
      const classes = sel.match(/\.([a-zA-Z0-9_-]+)/g);
      if (classes) {
        for (const c of classes) {
          if (!el.classList.contains(c.slice(1))) return false;
        }
      }

      // check attached attribute filters
      const attrs = sel.match(/\[([a-zA-Z0-9_-]+)([\^=]*)(.*?)\]/g);
      if (attrs) {
        for (const a of attrs) {
          if (!this._matches(el, a)) return false;
        }
      }
      return true;
    }

    return false;
  }

  private _matchRecursive(root: MockElement, sel: string, results: MockElement[], seen: Set<MockElement>) {
    for (const child of root.children) {
      if (this._matches(child, sel) && !seen.has(child)) {
        seen.add(child);
        results.push(child);
      }
      this._matchRecursive(child, sel, results, seen);
    }
  }
}

/**
 * Stack-based robust HTML parser into MockElement tree
 */
function parseHtmlToMockElement(html: string, parent: MockElement): void {
  const stack: MockElement[] = [parent];
  const tagRegex = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9_-]+)([^>]*?)(\/)?>|([^<]+)/g;
  const voidTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    if (match[0].startsWith('<!--')) continue; // Skip HTML comments

    const isClosing = match[1] === '/';
    const tagName = match[2];
    const attrsStr = match[3];
    const isSelfClosing = match[4] === '/' || (tagName && voidTags.has(tagName.toLowerCase()));
    const textContent = match[5];

    if (textContent) {
      const current = stack[stack.length - 1];
      if (current) {
        current.textContent += textContent.trim();
      }
      continue;
    }

    if (isClosing) {
      if (stack.length > 1) {
        const top = stack[stack.length - 1];
        if (top.tagName.toLowerCase() === tagName.toLowerCase()) {
          stack.pop();
        }
      }
      continue;
    }

    if (tagName) {
      const el = new MockElement(tagName);
      // Parse attributes
      const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        const name = attrMatch[1];
        const val = attrMatch[2] !== undefined ? attrMatch[2] : '';

        if (name === 'id') el.id = val;
        else if (name === 'class') el.className = val;
        else if (name === 'disabled') el.disabled = true;
        else if (name === 'value') el.value = val;
        else if (name.startsWith('data-')) {
          const camel = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
          el.dataset[camel] = val;
        } else if (name === 'style') {
          const parts = val.split(';').filter(Boolean);
          for (const p of parts) {
            const [k, v] = p.split(':').map((s) => s.trim());
            if (k && v) el.style[k] = v;
          }
        }
      }

      const current = stack[stack.length - 1];
      current.appendChild(el);

      if (!isSelfClosing) {
        stack.push(el);
      }
    }
  }
}

// In-place processing controller extracted from usePdfDom.js lines 46-77 for rigorous isolated probing
function setVisualWorkspaceProcessingState(isProcessing: boolean, dropEl: MockElement | null) {
  if (!dropEl) return;
  if (isProcessing) {
    dropEl.classList.add('pointer-events-none', 'opacity-85');
  } else {
    dropEl.classList.remove('pointer-events-none', 'opacity-85');
  }

  const buttonsToToggle = [
    '#btnChangeRotateFile', '#btnChangeSplitFile', '#btnChangeSingleFile',
    '#btnRotateAllCW', '#btnRotateAllCCW', '#btnResetRotations',
    '#btnSelectAllPages', '#btnSelectOddPages', '#btnSelectEvenPages', '#btnDeselectAllPages',
    '#btnPrevSplitPage', '#btnNextSplitPage', '#btnPrevRotatePage', '#btnNextRotatePage'
  ];
  buttonsToToggle.forEach((sel) => {
    const btn = dropEl.querySelector(sel);
    if (btn) {
      btn.disabled = isProcessing;
      if (isProcessing) {
        btn.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        btn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
  });

  const rangeInput = dropEl.querySelector('#inputPdfPages');
  if (rangeInput) {
    rangeInput.disabled = isProcessing;
  }
}

describe('Empirical Challenge: Milestone M1 Continuous Canvas & Hydration', () => {
  let mockDocument: {
    getElementById: (id: string) => MockElement | null;
    querySelector: (sel: string) => MockElement | null;
    querySelectorAll: (sel: string) => MockElement[];
  };
  let dropzoneContainer: MockElement;
  let configContainer: MockElement;
  let testCache: PdfPageCache;

  beforeEach(() => {
    dropzoneContainer = new MockElement('DIV');
    dropzoneContainer.id = 'pdfDropzoneContainer';

    configContainer = new MockElement('DIV');
    configContainer.id = 'pdfConfigContainer';

    const root = new MockElement('BODY');
    root.appendChild(dropzoneContainer);
    root.appendChild(configContainer);

    mockDocument = {
      getElementById: (id: string) => root.querySelector(`#${id}`),
      querySelector: (sel: string) => root.querySelector(sel),
      querySelectorAll: (sel: string) => root.querySelectorAll(sel)
    };

    (globalThis as any).document = mockDocument;
    (globalThis as any).window = {
      matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      addEventListener: vi.fn(),
      navigator: { standalone: false }
    };
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { standalone: false, userAgent: 'node' },
        configurable: true,
        writable: true
      });
    } catch {}

    pdfPageCache.clear();
  });

  describe('Probe 1: Fresh Canvas Elements Mounted with Previously Rendered Keys (Deadlock & Hydration Probe)', () => {
    const sampleFile = { id: 'doc_challenger_m1', name: 'sample.pdf', size: 1024 * 500, pages: 12 };

    it('should pre-hide skeletons in newly generated HTML markup when keys exist in cache', () => {
      // 1. Populate cache for pages 0..7
      for (let p = 0; p < 8; p++) {
        const key = pdfPageCache.buildKey(sampleFile, p, 0, 1);
        pdfPageCache.set(key, {
          bitmap: { width: 240, height: 340, close: vi.fn() },
          width: 240,
          height: 340
        });
      }

      // Render Split Workspace HTML with 8 visible pages
      const html = renderPdfSplitWorkspace({
        file: sampleFile,
        totalPages: 12,
        thumbnailPage: 0
      });

      // Verify all 8 skeletons have the 'hidden' class in the markup
      for (let p = 0; p < 8; p++) {
        expect(html).toContain(`id="pdfSplitSkeleton_${p}"`);
        // The skeleton markup must include 'hidden'
        expect(html).toMatch(new RegExp(`id="pdfSplitSkeleton_${p}"[^>]*class="[^"]*hidden[^"]*"`));
      }
    });

    it('should synchronously hydrate fresh canvas elements with 0ms latency without infinite spinner', () => {
      // 1. Populate cache
      for (let p = 0; p < 8; p++) {
        const key = pdfPageCache.buildKey(sampleFile, p, 0, 1);
        pdfPageCache.set(key, {
          bitmap: { width: 240, height: 340, close: vi.fn() },
          width: 240,
          height: 340
        });
      }

      // 2. Mount fresh HTML into dropzone container (simulating re-render on navigation)
      const html = renderPdfSplitWorkspace({
        file: sampleFile,
        totalPages: 12,
        thumbnailPage: 0
      });
      dropzoneContainer.innerHTML = html;

      // Check canvases before hydration: fresh DOM nodes do not have data-rendered yet
      const freshCanvases = dropzoneContainer.querySelectorAll('#pdfSplitGrid canvas.pdf-thumb-canvas');
      expect(freshCanvases.length).toBe(8);
      freshCanvases.forEach((c) => {
        expect(c.dataset.rendered).toBeUndefined();
        expect(c.drawCalls.length).toBe(0);
      });

      // 3. Execute synchronous hydration (exact call in usePdfDom.js / bindDropzone)
      const restoredCount = restoreThumbnailsSynchronously(dropzoneContainer, sampleFile);
      expect(restoredCount).toBe(8);

      // 4. Verify every fresh canvas is now fully hydrated:
      freshCanvases.forEach((c, idx) => {
        expect(c.dataset.rendered).toBe('true');
        expect(c.dataset.renderedKey).toBe(`doc_challenger_m1_p${idx}_r0_s1`);
        expect(c.width).toBe(240);
        expect(c.height).toBe(340);
        expect(c.drawCalls.length).toBe(1);

        const skeleton = dropzoneContainer.querySelector(`#pdfSplitSkeleton_${idx}`);
        expect(skeleton?.classList.contains('hidden')).toBe(true);
      });

      // 5. EMPIRICAL DEADLOCK CHECK:
      // Verify that unrendered selector returns NULL, guaranteeing no infinite spinner and no unnecessary PDF.js re-render
      const unrendered = dropzoneContainer.querySelector('#pdfSplitGrid canvas.pdf-thumb-canvas:not([data-rendered="true"])');
      expect(unrendered).toBeNull();
    });

    it('should survive 20 rapid remount cycles without spinner deadlocks or skipped hydration', () => {
      // Seed cache
      for (let p = 0; p < 8; p++) {
        pdfPageCache.set(pdfPageCache.buildKey(sampleFile, p, 0, 1), {
          bitmap: { width: 240, height: 340, close: vi.fn() },
          width: 240,
          height: 340
        });
      }

      // Simulate 20 rapid page navigation cycles: 0 -> 1 -> 0 -> 1 ...
      for (let cycle = 1; cycle <= 20; cycle++) {
        const thumbPage = cycle % 2;
        const html = renderPdfSplitWorkspace({
          file: sampleFile,
          totalPages: 16,
          thumbnailPage: thumbPage
        });
        dropzoneContainer.innerHTML = html;

        if (thumbPage === 0) {
          // Page 0 is fully in cache: all 8 canvases should be restored instantly
          const restored = restoreThumbnailsSynchronously(dropzoneContainer, sampleFile);
          expect(restored).toBe(8);

          const unrendered = dropzoneContainer.querySelector('#pdfSplitGrid canvas.pdf-thumb-canvas:not([data-rendered="true"])');
          expect(unrendered).toBeNull();

          // Skeletons must all be hidden
          for (let p = 0; p < 8; p++) {
            const sk = dropzoneContainer.querySelector(`#pdfSplitSkeleton_${p}`);
            expect(sk?.classList.contains('hidden')).toBe(true);
          }
        }
      }
    });

    it('should correctly handle partial cache misses by only hydrating cached canvases and keeping unrendered detectable', () => {
      // Clear cache and only seed pages 0..3 (pages 4..7 missing)
      pdfPageCache.clear();
      for (let p = 0; p < 4; p++) {
        pdfPageCache.set(pdfPageCache.buildKey(sampleFile, p, 0, 1), {
          bitmap: { width: 240, height: 340, close: vi.fn() },
          width: 240,
          height: 340
        });
      }

      const html = renderPdfSplitWorkspace({
        file: sampleFile,
        totalPages: 8,
        thumbnailPage: 0
      });
      dropzoneContainer.innerHTML = html;

      const restored = restoreThumbnailsSynchronously(dropzoneContainer, sampleFile);
      expect(restored).toBe(4);

      // Canvases 0..3 must be rendered
      for (let p = 0; p < 4; p++) {
        const c = dropzoneContainer.querySelector(`#pdfSplitCanvas_${p}`);
        expect(c?.dataset.rendered).toBe('true');
        const sk = dropzoneContainer.querySelector(`#pdfSplitSkeleton_${p}`);
        expect(sk?.classList.contains('hidden')).toBe(true);
      }

      // Canvases 4..7 must NOT be marked rendered and MUST be caught by unrendered query
      for (let p = 4; p < 8; p++) {
        const c = dropzoneContainer.querySelector(`#pdfSplitCanvas_${p}`);
        expect(c?.dataset.rendered).toBeUndefined();
      }

      const unrendered = dropzoneContainer.querySelector('#pdfSplitGrid canvas.pdf-thumb-canvas:not([data-rendered="true"])');
      expect(unrendered).not.toBeNull();
      expect(unrendered?.id).toBe('pdfSplitCanvas_4');
    });
  });

  describe('Probe 2: Visual Workspace Processing State (Action Buttons & Canvas Mutability)', () => {
    const sampleFile = { id: 'doc_freeze_test', name: 'freeze.pdf', size: 1024 * 200, pages: 8 };

    it('should properly disable action buttons and input in Split workspace without mutating canvas contents', () => {
      // Mount Split workspace
      dropzoneContainer.innerHTML = renderPdfSplitWorkspace({
        file: sampleFile,
        totalPages: 8,
        thumbnailPage: 0
      });

      // Simulate canvases already rendered
      for (let p = 0; p < 8; p++) {
        const c = dropzoneContainer.querySelector(`#pdfSplitCanvas_${p}`)!;
        c.dataset.rendered = 'true';
        c.dataset.renderedKey = `doc_freeze_test_p${p}_r0_s1`;
        c.width = 240;
        c.height = 340;
      }

      const btnChangeSplitFile = dropzoneContainer.querySelector('#btnChangeSplitFile')!;
      const btnSelectAllPages = dropzoneContainer.querySelector('#btnSelectAllPages')!;
      const btnSelectOddPages = dropzoneContainer.querySelector('#btnSelectOddPages')!;
      const btnSelectEvenPages = dropzoneContainer.querySelector('#btnSelectEvenPages')!;
      const inputPdfPages = dropzoneContainer.querySelector('#inputPdfPages')!;

      // Pre-condition: All action buttons and input are enabled
      expect(btnChangeSplitFile.disabled).toBe(false);
      expect(btnSelectAllPages.disabled).toBe(false);
      expect(inputPdfPages.disabled).toBe(false);
      expect(dropzoneContainer.classList.contains('pointer-events-none')).toBe(false);

      // ACT: Set visual workspace processing state to TRUE
      setVisualWorkspaceProcessingState(true, dropzoneContainer);

      // VERIFY: Container has pointer-events-none and opacity-85
      expect(dropzoneContainer.classList.contains('pointer-events-none')).toBe(true);
      expect(dropzoneContainer.classList.contains('opacity-85')).toBe(true);

      // VERIFY: Action buttons and inputs are strictly disabled
      expect(btnChangeSplitFile.disabled).toBe(true);
      expect(btnChangeSplitFile.classList.contains('opacity-40')).toBe(true);
      expect(btnChangeSplitFile.classList.contains('cursor-not-allowed')).toBe(true);

      expect(btnSelectAllPages.disabled).toBe(true);
      expect(btnSelectAllPages.classList.contains('opacity-40')).toBe(true);

      expect(btnSelectOddPages.disabled).toBe(true);
      expect(btnSelectEvenPages.disabled).toBe(true);
      expect(inputPdfPages.disabled).toBe(true);

      // VERIFY: Canvas contents are 100% UNMUTATED
      for (let p = 0; p < 8; p++) {
        const c = dropzoneContainer.querySelector(`#pdfSplitCanvas_${p}`)!;
        expect(c.dataset.rendered).toBe('true');
        expect(c.dataset.renderedKey).toBe(`doc_freeze_test_p${p}_r0_s1`);
        expect(c.width).toBe(240);
        expect(c.height).toBe(340);
        // Canvas has not been reset or cleared
        expect(c.drawCalls.length).toBe(0);
      }

      // ACT: Restore visual workspace processing state to FALSE (completed/error)
      setVisualWorkspaceProcessingState(false, dropzoneContainer);

      // VERIFY: Container and buttons restored
      expect(dropzoneContainer.classList.contains('pointer-events-none')).toBe(false);
      expect(dropzoneContainer.classList.contains('opacity-85')).toBe(false);
      expect(btnChangeSplitFile.disabled).toBe(false);
      expect(btnChangeSplitFile.classList.contains('opacity-40')).toBe(false);
      expect(btnSelectAllPages.disabled).toBe(false);
      expect(inputPdfPages.disabled).toBe(false);

      // Canvases still intact
      for (let p = 0; p < 8; p++) {
        const c = dropzoneContainer.querySelector(`#pdfSplitCanvas_${p}`)!;
        expect(c.dataset.rendered).toBe('true');
        expect(c.width).toBe(240);
        expect(c.height).toBe(340);
      }
    });

    it('should properly disable action buttons in Rotate workspace without mutating canvas contents', () => {
      // Mount Rotate workspace
      dropzoneContainer.innerHTML = renderPdfRotateWorkspace({
        file: sampleFile,
        pageRotations: { 0: 90 },
        totalPages: 8,
        thumbnailPage: 0
      });

      const btnChangeRotateFile = dropzoneContainer.querySelector('#btnChangeRotateFile')!;
      const btnRotateAllCW = dropzoneContainer.querySelector('#btnRotateAllCW')!;
      const btnRotateAllCCW = dropzoneContainer.querySelector('#btnRotateAllCCW')!;
      const btnResetRotations = dropzoneContainer.querySelector('#btnResetRotations')!;

      // Pre-condition
      expect(btnRotateAllCW.disabled).toBe(false);
      expect(btnRotateAllCCW.disabled).toBe(false);

      // ACT: Set processing state to TRUE
      setVisualWorkspaceProcessingState(true, dropzoneContainer);

      // VERIFY: Buttons disabled
      expect(btnChangeRotateFile.disabled).toBe(true);
      expect(btnRotateAllCW.disabled).toBe(true);
      expect(btnRotateAllCCW.disabled).toBe(true);
      expect(btnResetRotations.disabled).toBe(true);
      expect(dropzoneContainer.classList.contains('pointer-events-none')).toBe(true);

      // Canvases still retain rotation transform and dimensions
      const c0 = dropzoneContainer.querySelector('#pdfRotateCanvas_0')!;
      expect(c0.style.transform).toBe('rotate(90deg)');

      // ACT: Set processing state to FALSE
      setVisualWorkspaceProcessingState(false, dropzoneContainer);

      expect(btnRotateAllCW.disabled).toBe(false);
      expect(btnRotateAllCCW.disabled).toBe(false);
      expect(dropzoneContainer.classList.contains('pointer-events-none')).toBe(false);
      expect(c0.style.transform).toBe('rotate(90deg)');
    });

    it('should render ConfigPanel in disabled processing state with progress percentage', () => {
      const configHtml = renderConfigPanel({
        mode: 'split',
        files: [sampleFile],
        isProcessing: true,
        progress: 45
      });

      configContainer.innerHTML = configHtml;
      const btnStart = configContainer.querySelector('#btnStartProcess')!;

      expect(btnStart.disabled).toBe(true);
      expect(btnStart.classList.contains('cursor-not-allowed')).toBe(true);
      expect(configHtml).toContain('Đang xử lý (45%)...');
    });
  });
});
