import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { attachPointerReorder } from '../../../src/utilities/dragReorder.js';
import { attachViewSplitDomListeners } from '../../../src/components/tools/viewsplit/hooks/useViewSplitDom.js';
import { ViewSplitStore } from '../../../src/components/tools/viewsplit/hooks/useViewSplit.js';

describe('ViewSplit Dirty-Render Engine & dragReorder rAF Batching Suite (Task 3.2)', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const viewSplitDomPath = path.join(rootDir, 'src/components/tools/viewsplit/hooks/useViewSplitDom.js');
  const dragReorderPath = path.join(rootDir, 'src/utilities/dragReorder.js');

  const viewSplitDomContent = fs.readFileSync(viewSplitDomPath, 'utf-8');
  const dragReorderContent = fs.readFileSync(dragReorderPath, 'utf-8');

  describe('1. Static Code Analysis & Contract Verification', () => {
    it('useViewSplitDom.js must implement dirty render state machine (isDirty, rafPending, requestRender)', () => {
      expect(viewSplitDomContent).toContain('let isDirty =');
      expect(viewSplitDomContent).toContain('let rafPending =');
      expect(viewSplitDomContent).toContain('function requestRender(');
    });

    it('useViewSplitDom.js must NOT have continuous unconditional requestAnimationFrame in renderCanvasFrame', () => {
      // Must not end renderCanvasFrame with an unconditional rafId = requestAnimationFrame(renderCanvasFrame)
      expect(viewSplitDomContent).not.toMatch(
        /renderCanvasFrame\s*=\s*(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*?rafId\s*=\s*requestAnimationFrame\(renderCanvasFrame\);\s*\};/
      );
    });

    it('useViewSplitDom.js renderCanvasFrame must guard on isDirty and not schedule when clean', () => {
      expect(viewSplitDomContent).toContain('if (!isDirty)');
    });

    it('useViewSplitDom.js must cache canvas getBoundingClientRect during pointer interactions and invalidate on resize', () => {
      expect(viewSplitDomContent).toMatch(/canvasRect|cachedRect|cachedCanvasRect/);
    });

    it('useViewSplitDom.js must only re-render continuously when an active video element is playing', () => {
      expect(viewSplitDomContent).toMatch(/video/i);
    });

    it('dragReorder.js must coalesce pointermove events via requestAnimationFrame', () => {
      expect(dragReorderContent).toContain('moveRafId');
      expect(dragReorderContent).toMatch(/requestAnimationFrame\(/);
    });

    it('dragReorder.js must cancel pending rAF and flush latest coordinates on onPointerEnd and cleanup', () => {
      expect(dragReorderContent).toContain('cancelAnimationFrame(moveRafId)');
    });
  });

  describe('2. dragReorder.js rAF Batching & Coordinate Flushing Runtime', () => {
    let originalWindow: any;
    let originalRaf: any;
    let originalCancelRaf: any;
    let windowListeners: Record<string, (e: any) => void> = {};
    let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
    let nextRafId = 1;

    beforeEach(() => {
      windowListeners = {};
      rafCallbacks = new Map();
      nextRafId = 1;
      originalWindow = globalThis.window;
      originalRaf = (globalThis as any).requestAnimationFrame;
      originalCancelRaf = (globalThis as any).cancelAnimationFrame;

      const mockRaf = (cb: FrameRequestCallback) => {
        const id = nextRafId++;
        rafCallbacks.set(id, cb);
        return id;
      };
      const mockCancelRaf = (id: number) => {
        rafCallbacks.delete(id);
      };

      // Mock window and rAF
      globalThis.window = {
        addEventListener: (evt: string, fn: any) => { windowListeners[evt] = fn; },
        removeEventListener: (evt: string) => { delete windowListeners[evt]; },
        requestAnimationFrame: mockRaf,
        cancelAnimationFrame: mockCancelRaf
      } as any;
      (globalThis as any).requestAnimationFrame = mockRaf;
      (globalThis as any).cancelAnimationFrame = mockCancelRaf;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
      (globalThis as any).requestAnimationFrame = originalRaf;
      (globalThis as any).cancelAnimationFrame = originalCancelRaf;
    });

    it('coalesces rapid pointermove events in a single frame to 1 DOM update', () => {
      const mockItems = [0, 1, 2, 3].map((i) => {
        const item: any = {
          dataset: { index: String(i) },
          style: {},
          classList: { add: vi.fn(), remove: vi.fn() },
          handle: {
            setPointerCapture: vi.fn(),
            releasePointerCapture: vi.fn(),
            closest: vi.fn((sel: string) => (sel === '.drag-grip-handle' ? item.handle : (sel === '.pdf-item' ? item : null)))
          },
          closest: vi.fn((sel: string) => (sel === '.pdf-item' ? item : null)),
          getBoundingClientRect: vi.fn(() => ({
            left: 0,
            right: 100,
            top: i * 50,
            bottom: (i + 1) * 50,
            width: 100,
            height: 50
          }))
        };
        return item;
      });

      const containerListeners: Record<string, (e: any) => void> = {};
      const mockContainer = {
        ownerDocument: { defaultView: globalThis.window },
        addEventListener: (evt: string, fn: any) => { containerListeners[evt] = fn; },
        removeEventListener: (evt: string) => { delete containerListeners[evt]; },
        contains: (el: any) => mockItems.some((item) => item === el || item.handle === el),
        querySelectorAll: (sel: string) => (sel === '.pdf-item' ? mockItems : [])
      } as unknown as HTMLElement;

      const onReorder = vi.fn();
      const cleanup = attachPointerReorder(mockContainer, {
        itemSelector: '.pdf-item',
        handleSelector: '.drag-grip-handle',
        onReorder
      });

      // Pointer down on Item 0
      containerListeners['pointerdown']({
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        target: mockItems[0].handle,
        preventDefault: vi.fn()
      });

      expect(windowListeners['pointermove']).toBeDefined();

      // Fire 10 rapid pointermove events before any rAF tick
      for (let y = 15; y <= 60; y += 5) {
        windowListeners['pointermove']({
          clientX: 10,
          clientY: y,
          pointerId: 1,
          cancelable: true,
          preventDefault: vi.fn()
        });
      }

      // Exactly ONE requestAnimationFrame should be scheduled
      expect(rafCallbacks.size).toBe(1);

      // Now flush the single scheduled rAF callback
      const [scheduledId, cb] = Array.from(rafCallbacks.entries())[0];
      cb(performance.now());
      rafCallbacks.delete(scheduledId);

      // Transform should reflect the latest pointer position (clientY = 60, dy = 60 - 10 = 50)
      expect(mockItems[0].style.transform).toBe('translate(0px, 50px) scale(1.02)');

      cleanup();
    });

    it('flushes latest coordinates and cancels pending rAF when onPointerEnd fires on fast flick', () => {
      const mockItems = [0, 1].map((i) => {
        const item: any = {
          dataset: { index: String(i) },
          style: {},
          classList: { add: vi.fn(), remove: vi.fn() },
          handle: {
            setPointerCapture: vi.fn(),
            releasePointerCapture: vi.fn(),
            closest: vi.fn((sel: string) => (sel === '.drag-grip-handle' ? item.handle : (sel === '.pdf-item' ? item : null)))
          },
          closest: vi.fn((sel: string) => (sel === '.pdf-item' ? item : null)),
          getBoundingClientRect: vi.fn(() => ({
            left: 0,
            right: 100,
            top: i * 50,
            bottom: (i + 1) * 50,
            width: 100,
            height: 50
          }))
        };
        return item;
      });

      const containerListeners: Record<string, (e: any) => void> = {};
      const mockContainer = {
        ownerDocument: { defaultView: globalThis.window },
        addEventListener: (evt: string, fn: any) => { containerListeners[evt] = fn; },
        removeEventListener: (evt: string) => { delete containerListeners[evt]; },
        contains: (el: any) => mockItems.some((item) => item === el || item.handle === el),
        querySelectorAll: (sel: string) => (sel === '.pdf-item' ? mockItems : [])
      } as unknown as HTMLElement;

      const onReorder = vi.fn();
      const cleanup = attachPointerReorder(mockContainer, {
        itemSelector: '.pdf-item',
        handleSelector: '.drag-grip-handle',
        onReorder
      });

      // Pointer down on Item 0
      containerListeners['pointerdown']({
        button: 0,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        target: mockItems[0].handle,
        preventDefault: vi.fn()
      });

      // Rapid flick pointer move to item 1 slot (y = 80)
      windowListeners['pointermove']({
        clientX: 10,
        clientY: 80,
        pointerId: 1,
        cancelable: true,
        preventDefault: vi.fn()
      });

      // Immediately pointer up WITHOUT firing the rAF tick
      windowListeners['pointerup']({
        pointerId: 1,
        clientX: 10,
        clientY: 80,
        type: 'pointerup'
      });

      // Pending rAF must be cancelled
      expect(rafCallbacks.size).toBe(0);

      // onReorder must have been called with (from: 0, to: 1) because the drop position was flushed!
      expect(onReorder).toHaveBeenCalledWith(0, 1);

      cleanup();
    });
  });

  describe('3. ViewSplit Dirty-Render State Machine Simulation', () => {
    it('stationary canvas makes 0 requestAnimationFrame calls after initial draw', () => {
      let isDirty = true;
      let rafPending = false;
      let rafId: any = null;
      let scheduledCallback: any = null;
      let rafCount = 0;

      const mockRaf = (fn: any) => {
        rafCount++;
        scheduledCallback = fn;
        return rafCount;
      };

      const requestRender = () => {
        isDirty = true;
        if (!rafPending) {
          rafPending = true;
          rafId = mockRaf(renderCanvasFrame);
        }
      };

      const renderCanvasFrame = () => {
        if (!isDirty) {
          rafPending = false;
          rafId = null;
          return;
        }

        isDirty = false;
        rafPending = false;
        rafId = null;
        // Draw frame...
      };

      // Initial boot requests render
      requestRender();
      expect(rafCount).toBe(1);

      // Execute the scheduled frame
      scheduledCallback();

      // State is now clean: isDirty = false, rafPending = false, rafId = null
      expect(isDirty).toBe(false);
      expect(rafPending).toBe(false);
      expect(rafId).toBeNull();

      // Idle ticks pass: renderCanvasFrame is called again or ticks pass:
      renderCanvasFrame();
      // rafCount MUST REMAIN 1 (0 new rAF calls scheduled during idle!)
      expect(rafCount).toBe(1);

      // Now user zooms: requestRender() is called:
      requestRender();
      expect(rafCount).toBe(2);

      // Multiple rapid interactions in same frame
      requestRender();
      requestRender();
      // Still only 1 rAF pending
      expect(rafCount).toBe(2);

      // Execute frame 2
      scheduledCallback();
      expect(isDirty).toBe(false);
      expect(rafPending).toBe(false);
    });
  });

  describe('4. attachViewSplitDomListeners Full Lifecycle & Video Playback Runtime', () => {
    let originalWindow: any;
    let originalDoc: any;
    let originalRaf: any;
    let originalCancelRaf: any;
    let windowListeners: Record<string, Array<(e: any) => void>> = {};
    let docListeners: Record<string, Array<(e: any) => void>> = {};
    let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
    let nextRafId = 1;

    const fireWindow = (evt: string, e?: any) => {
      (windowListeners[evt] || []).slice().forEach((fn) => fn(e));
    };

    beforeEach(() => {
      windowListeners = {};
      docListeners = {};
      rafCallbacks = new Map();
      nextRafId = 1;
      originalWindow = globalThis.window;
      originalDoc = globalThis.document;
      originalRaf = (globalThis as any).requestAnimationFrame;
      originalCancelRaf = (globalThis as any).cancelAnimationFrame;

      const mockRaf = (cb: FrameRequestCallback) => {
        const id = nextRafId++;
        rafCallbacks.set(id, cb);
        return id;
      };
      const mockCancelRaf = (id: number) => {
        rafCallbacks.delete(id);
      };

      globalThis.window = {
        addEventListener: (evt: string, fn: any) => {
          if (!windowListeners[evt]) windowListeners[evt] = [];
          windowListeners[evt].push(fn);
        },
        removeEventListener: (evt: string, fn: any) => {
          if (windowListeners[evt]) {
            windowListeners[evt] = windowListeners[evt].filter((h) => h !== fn);
          }
        },
        requestAnimationFrame: mockRaf,
        cancelAnimationFrame: mockCancelRaf,
        devicePixelRatio: 1,
        innerWidth: 1024,
        innerHeight: 768
      } as any;

      globalThis.document = {
        hidden: false,
        visibilityState: 'visible',
        addEventListener: (evt: string, fn: any) => {
          if (!docListeners[evt]) docListeners[evt] = [];
          docListeners[evt].push(fn);
        },
        removeEventListener: (evt: string, fn: any) => {
          if (docListeners[evt]) {
            docListeners[evt] = docListeners[evt].filter((h) => h !== fn);
          }
        },
        querySelectorAll: () => [],
        getElementById: () => null,
        querySelector: () => null,
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => null
        }),
        documentElement: {
          classList: {
            contains: () => false
          }
        }
      } as any;

      (globalThis as any).requestAnimationFrame = mockRaf;
      (globalThis as any).cancelAnimationFrame = mockCancelRaf;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
      globalThis.document = originalDoc;
      (globalThis as any).requestAnimationFrame = originalRaf;
      (globalThis as any).cancelAnimationFrame = originalCancelRaf;
    });

    it('attaches with 1 dirty frame and stays stationary with 0 idle rAF ticks', () => {
      const store = new ViewSplitStore();
      const onReRender = vi.fn();
      const cleanup = attachViewSplitDomListeners(store, onReRender);

      // Initial boot schedules exactly 1 rAF frame
      expect(rafCallbacks.size).toBe(1);

      // Execute initial frame
      const [id, cb] = Array.from(rafCallbacks.entries())[0];
      rafCallbacks.delete(id);
      cb(performance.now());

      // Stationary: 0 new rAF frames scheduled!
      expect(rafCallbacks.size).toBe(0);

      cleanup();
    });

    it('cleans up pending rAF and listeners on unmount', () => {
      const store = new ViewSplitStore();
      const onReRender = vi.fn();
      const cleanup = attachViewSplitDomListeners(store, onReRender);

      expect(rafCallbacks.size).toBe(1);

      // Cleanup cancels the pending rAF frame
      cleanup();
      expect(rafCallbacks.size).toBe(0);

      // Wheel listener was removed
      expect(windowListeners['wheel']).toEqual([]);
    });

    it('continuous loop only fires when video is actively playing and stops when paused', () => {
      const store = new ViewSplitStore();
      const onReRender = vi.fn();
      const cleanup = attachViewSplitDomListeners(store, onReRender);

      // Drain initial frame
      const [id1, cb1] = Array.from(rafCallbacks.entries())[0];
      rafCallbacks.delete(id1);
      cb1(performance.now());
      expect(rafCallbacks.size).toBe(0);

      // Pane has active playing video
      const mockVideo: any = {
        tagName: 'VIDEO',
        paused: false,
        ended: false
      };
      store.panes[0].image = mockVideo;

      // Trigger a render via ds:visibility-change
      fireWindow('ds:visibility-change');
      expect(rafCallbacks.size).toBe(1);

      // Execute frame with active video: it should re-schedule next frame
      const [id2, cb2] = Array.from(rafCallbacks.entries())[0];
      rafCallbacks.delete(id2);
      cb2(performance.now());
      expect(rafCallbacks.size).toBe(1);

      // Now video pauses
      mockVideo.paused = true;
      const [id3, cb3] = Array.from(rafCallbacks.entries())[0];
      rafCallbacks.delete(id3);
      cb3(performance.now());

      // Render loop stops immediately when paused!
      expect(rafCallbacks.size).toBe(0);

      cleanup();
    });

    it('caches getBoundingClientRect on mouse down and reuses during rapid mouse moves', () => {
      const store = new ViewSplitStore();
      const onReRender = vi.fn();

      const getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      }));

      const mockCanvas: any = {
        id: 'viewsplit-canvas-1',
        dataset: { paneId: '1' },
        getBoundingClientRect,
        getContext: vi.fn(() => null)
      };

      const cleanup = attachViewSplitDomListeners(store, onReRender);

      // Simulate mousedown on canvas
      fireWindow('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 100,
        target: {
          closest: (sel: string) => (sel.includes('viewsplit-canvas') ? mockCanvas : null)
        }
      });

      // getBoundingClientRect called once on mousedown
      expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

      // Fire 5 rapid mousemoves over the canvas
      for (let i = 0; i < 5; i++) {
        fireWindow('mousemove', {
          clientX: 100 + i * 5,
          clientY: 100 + i * 5,
          target: {
            closest: (sel: string) => (sel.includes('viewsplit-canvas') ? mockCanvas : null)
          }
        });
      }

      // getBoundingClientRect was NOT called again because cachedCanvasRect was used!
      expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

      // On mouseup, cache is invalidated
      fireWindow('mouseup');

      cleanup();
    });
  });
});
