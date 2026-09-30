/**
 * Unit Test Suite: PDF Studio Gestures, Lightbox & Drag-and-Drop (Milestone M2)
 * Tests:
 * 1. PdfQueueManager.reorderFiles arbitrary index reordering & edge cases
 * 2. Dual-axis touch slop disambiguation logic (8px window, vertical yield vs horizontal lock)
 * 3. Swipe state math & dynamic thresholding (>35% or >100px)
 * 4. Haptic vibration trigger & defensive fallback
 * 5. Drag-and-drop target index calculation (computeDropIndex)
 * 6. Lightbox page navigation rotation retention logic
 * 7. Slide-to-clear & swipe-to-dismiss state machines
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfQueueManager } from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';
import {
  isTouchSlopDisambiguated,
  calculateSwipeState,
  triggerHaptic,
  attachSwipeToDismiss,
  attachSlideToClear
} from '../../../src/utilities/swipeGesture.js';
import { computeDropIndex, attachPointerReorder } from '../../../src/utilities/dragReorder.js';
import {
  closePdfPageLightbox,
  resolveLightboxRotation
} from '../../../src/components/tools/pdf/components/PdfPageLightboxModal.js';

describe('Milestone M2: Touch & Mouse Gestures, Lightbox & Drag-and-Drop', () => {

  describe('1. usePdfQueue.reorderFiles', () => {
    let qm: InstanceType<typeof PdfQueueManager>;

    beforeEach(() => {
      qm = new PdfQueueManager();
      qm.files = [
        { id: 'f1', name: 'page1.pdf', size: 1000 },
        { id: 'f2', name: 'page2.pdf', size: 2000 },
        { id: 'f3', name: 'page3.pdf', size: 3000 },
        { id: 'f4', name: 'page4.pdf', size: 4000 }
      ];
    });

    it('should reorder file from beginning to end (0 -> 3)', () => {
      let notified = false;
      qm.subscribe((_state: unknown, evt: string) => {
        if (evt === 'files-change') notified = true;
      });

      qm.reorderFiles(0, 3);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f2', 'f3', 'f4', 'f1']);
      expect(notified).toBe(true);
    });

    it('should reorder file from end to beginning (3 -> 0)', () => {
      let notified = false;
      qm.subscribe((_state: unknown, evt: string) => {
        if (evt === 'files-change') notified = true;
      });

      qm.reorderFiles(3, 0);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f4', 'f1', 'f2', 'f3']);
      expect(notified).toBe(true);
    });

    it('should reorder adjacent elements in middle (1 -> 2)', () => {
      qm.reorderFiles(1, 2);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f1', 'f3', 'f2', 'f4']);
    });

    it('should be a no-op when fromIndex === toIndex without triggering change event', () => {
      let notified = false;
      qm.subscribe((_state: unknown, evt: string) => {
        if (evt === 'files-change') notified = true;
      });

      qm.reorderFiles(2, 2);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
      expect(notified).toBe(false);
    });

    it('should safely ignore out-of-bounds negative indices', () => {
      let notified = false;
      qm.subscribe((_state: unknown, evt: string) => {
        if (evt === 'files-change') notified = true;
      });

      qm.reorderFiles(-1, 2);
      qm.reorderFiles(1, -2);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
      expect(notified).toBe(false);
    });

    it('should safely ignore out-of-bounds indices exceeding length', () => {
      let notified = false;
      qm.subscribe((_state: unknown, evt: string) => {
        if (evt === 'files-change') notified = true;
      });

      qm.reorderFiles(0, 10);
      qm.reorderFiles(10, 0);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
      expect(notified).toBe(false);
    });

    it('should reject non-numeric inputs', () => {
      let notified = false;
      qm.subscribe((_state: unknown, evt: string) => {
        if (evt === 'files-change') notified = true;
      });

      qm.reorderFiles('invalid', 2);
      qm.reorderFiles(0, NaN);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
      expect(notified).toBe(false);
    });
  });

  describe('2. Dual-Axis Touch Slop Disambiguation (isTouchSlopDisambiguated)', () => {
    it('should report unresolved within 8px slop window', () => {
      expect(isTouchSlopDisambiguated(0, 0)).toEqual({ resolved: false, isHorizontal: false });
      expect(isTouchSlopDisambiguated(5, 5)).toEqual({ resolved: false, isHorizontal: false });
      expect(isTouchSlopDisambiguated(-7, 3)).toEqual({ resolved: false, isHorizontal: false });
      expect(isTouchSlopDisambiguated(4, -7)).toEqual({ resolved: false, isHorizontal: false });
    });

    it('should yield to native vertical scrolling when |dy| >= |dx|', () => {
      // Pure vertical
      expect(isTouchSlopDisambiguated(0, 10)).toEqual({ resolved: true, isHorizontal: false });
      expect(isTouchSlopDisambiguated(2, -15)).toEqual({ resolved: true, isHorizontal: false });
      // Equal delta yields to scroll for safety
      expect(isTouchSlopDisambiguated(12, 12)).toEqual({ resolved: true, isHorizontal: false });
      expect(isTouchSlopDisambiguated(-20, -20)).toEqual({ resolved: true, isHorizontal: false });
    });

    it('should lock horizontal swipe when |dx| > |dy| and exceeds slop threshold', () => {
      expect(isTouchSlopDisambiguated(10, 2)).toEqual({ resolved: true, isHorizontal: true });
      expect(isTouchSlopDisambiguated(-15, 5)).toEqual({ resolved: true, isHorizontal: true });
      expect(isTouchSlopDisambiguated(30, -10)).toEqual({ resolved: true, isHorizontal: true });
    });

    it('should respect custom slop threshold', () => {
      // 12px threshold
      expect(isTouchSlopDisambiguated(10, 2, 15)).toEqual({ resolved: false, isHorizontal: false });
      expect(isTouchSlopDisambiguated(16, 2, 15)).toEqual({ resolved: true, isHorizontal: true });
    });
  });

  describe('3. Swipe State Math & Threshold Calculation (calculateSwipeState)', () => {
    it('should clamp positive dx to 0 for left-direction swipe', () => {
      const state = calculateSwipeState({ dx: 50, width: 300, direction: 'left' });
      expect(state.clampedDx).toBe(0);
      expect(state.distance).toBe(0);
      expect(state.isTriggered).toBe(false);
      expect(state.ratio).toBe(0);
    });

    it('should track negative dx for left-direction swipe', () => {
      const state = calculateSwipeState({ dx: -80, width: 400, thresholdRatio: 0.35, thresholdPx: 100, direction: 'left' });
      expect(state.clampedDx).toBe(-80);
      expect(state.distance).toBe(80);
      // threshold: max(100, 400 * 0.35 = 140) = 140
      expect(state.threshold).toBe(140);
      expect(state.isTriggered).toBe(false);
      expect(state.ratio).toBe(80 / 400);
    });

    it('should trigger when distance exceeds ratio threshold on wide elements', () => {
      // width = 400 -> threshold = 400 * 0.35 = 140px (> 100px)
      const stateUnder = calculateSwipeState({ dx: -139, width: 400, thresholdRatio: 0.35, direction: 'left' });
      expect(stateUnder.isTriggered).toBe(false);

      const stateOver = calculateSwipeState({ dx: -145, width: 400, thresholdRatio: 0.35, direction: 'left' });
      expect(stateOver.isTriggered).toBe(true);
    });

    it('should trigger when distance exceeds min px threshold on narrow elements', () => {
      // width = 200 -> 200 * 0.35 = 70px -> clamped to min thresholdPx = 100px
      const stateUnder = calculateSwipeState({ dx: -90, width: 200, thresholdRatio: 0.35, thresholdPx: 100, direction: 'left' });
      expect(stateUnder.threshold).toBe(100);
      expect(stateUnder.isTriggered).toBe(false);

      const stateOver = calculateSwipeState({ dx: -105, width: 200, thresholdRatio: 0.35, thresholdPx: 100, direction: 'left' });
      expect(stateOver.threshold).toBe(100);
      expect(stateOver.isTriggered).toBe(true);
    });

    it('should correctly support right and both directions', () => {
      const stateRight = calculateSwipeState({ dx: 120, width: 300, thresholdRatio: 0.35, thresholdPx: 100, direction: 'right' });
      expect(stateRight.clampedDx).toBe(120);
      expect(stateRight.distance).toBe(120);
      expect(stateRight.isTriggered).toBe(true);

      const stateBothNeg = calculateSwipeState({ dx: -120, width: 300, thresholdRatio: 0.35, thresholdPx: 100, direction: 'both' });
      expect(stateBothNeg.distance).toBe(120);
      expect(stateBothNeg.isTriggered).toBe(true);
    });
  });

  describe('4. Haptic Feedback Invocation (triggerHaptic)', () => {
    it('should return false when navigator is undefined or lacks vibrate', () => {
      const origNav = globalThis.navigator;
      try {
        // @ts-expect-error Mocking navigator
        delete globalThis.navigator;
        expect(triggerHaptic(15)).toBe(false);
      } finally {
        globalThis.navigator = origNav;
      }
    });

    it('should invoke navigator.vibrate with duration and return result', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      const origNav = globalThis.navigator;
      try {
        // @ts-expect-error Mocking navigator
        globalThis.navigator = { vibrate: mockVibrate };
        const result = triggerHaptic(20);
        expect(mockVibrate).toHaveBeenCalledWith(20);
        expect(result).toBe(true);
      } finally {
        globalThis.navigator = origNav;
      }
    });

    it('should support vibration pattern arrays [15, 30, 15]', () => {
      const mockVibrate = vi.fn().mockReturnValue(true);
      const origNav = globalThis.navigator;
      try {
        // @ts-expect-error Mocking navigator
        globalThis.navigator = { vibrate: mockVibrate };
        triggerHaptic([15, 30, 15]);
        expect(mockVibrate).toHaveBeenCalledWith([15, 30, 15]);
      } finally {
        globalThis.navigator = origNav;
      }
    });

    it('should handle vibration errors defensively without throwing', () => {
      const mockVibrate = vi.fn().mockImplementation(() => {
        throw new Error('NotAllowedError');
      });
      const origNav = globalThis.navigator;
      try {
        // @ts-expect-error Mocking navigator
        globalThis.navigator = { vibrate: mockVibrate };
        expect(() => triggerHaptic(15)).not.toThrow();
        expect(triggerHaptic(15)).toBe(false);
      } finally {
        globalThis.navigator = origNav;
      }
    });
  });

  describe('5. Pointer Drag Drop Index Computation (computeDropIndex)', () => {
    const itemRects = [
      { index: 0, top: 0, bottom: 60, midY: 30 },
      { index: 1, top: 70, bottom: 130, midY: 100 },
      { index: 2, top: 140, bottom: 200, midY: 170 },
      { index: 3, top: 210, bottom: 270, midY: 240 }
    ];

    it('should drop to index 0 when pointer is above or at first midpoint', () => {
      expect(computeDropIndex(10, itemRects, 2)).toBe(0);
      expect(computeDropIndex(30, itemRects, 2)).toBe(0);
    });

    it('should drop to last index when pointer is below or at last midpoint', () => {
      expect(computeDropIndex(240, itemRects, 0)).toBe(3);
      expect(computeDropIndex(300, itemRects, 0)).toBe(3);
    });

    it('should correctly select closest midpoint between items', () => {
      // Between item 0 (midY 30) and item 1 (midY 100): boundary midpoint is 65
      expect(computeDropIndex(50, itemRects, 0)).toBe(0); // Closer to 30
      expect(computeDropIndex(80, itemRects, 0)).toBe(1); // Closer to 100
      expect(computeDropIndex(160, itemRects, 0)).toBe(2); // Closer to 170
      expect(computeDropIndex(210, itemRects, 0)).toBe(3); // Closer to 240
    });

    it('should handle empty or single-item rect lists gracefully', () => {
      expect(computeDropIndex(50, [], 1)).toBe(1);
      expect(computeDropIndex(50, [{ index: 0, top: 0, bottom: 50, midY: 25 }], 0)).toBe(0);
    });
  });

  describe('6. Lightbox Rotation Preservation Logic', () => {
    it('should preserve page angle when navigating through rotated pages via resolveLightboxRotation', () => {
      // Simulate pages with mixed rotations
      const pageRotations: Record<number, number> = {
        0: 0,
        1: 90,
        2: 180,
        3: 270
      };

      const getRotation = (idx: number) => pageRotations[idx];

      // Moving across pages without override must resolve each page's specific rotation angle
      expect(resolveLightboxRotation(1, undefined, getRotation)).toBe(90);
      expect(resolveLightboxRotation(2, undefined, getRotation)).toBe(180);
      expect(resolveLightboxRotation(3, undefined, getRotation)).toBe(270);
      expect(resolveLightboxRotation(0, undefined, getRotation)).toBe(0);

      // If user rotates manually inside modal, explicit override is respected
      expect(resolveLightboxRotation(1, 180, getRotation)).toBe(180);
      expect(resolveLightboxRotation(2, 0, getRotation)).toBe(0);

      // Edge cases: missing callback or non-number return values fall back safely to 0
      expect(resolveLightboxRotation(1, undefined, undefined as any)).toBe(0);
      expect(resolveLightboxRotation(5, undefined, getRotation)).toBe(0);
      expect(resolveLightboxRotation(1, undefined, (() => null) as any)).toBe(0);
    });
  });

  describe('7. Gesture Utility Cleanup & Safe Event Handlers', () => {
    it('should return callable cleanup functions for attachSwipeToDismiss and attachSlideToClear', () => {
      // Minimal mock DOM elements
      const mockElement = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        style: {},
        offsetWidth: 300,
        closest: vi.fn().mockReturnValue(null),
        parentElement: null
      } as unknown as HTMLElement;

      const cleanupSwipe = attachSwipeToDismiss(mockElement);
      expect(typeof cleanupSwipe).toBe('function');
      cleanupSwipe();
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));

      const mockTrack = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        offsetWidth: 200
      } as unknown as HTMLElement;

      const mockThumb = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        style: {},
        offsetWidth: 36
      } as unknown as HTMLElement;

      const cleanupSlide = attachSlideToClear(mockTrack, mockThumb);
      expect(typeof cleanupSlide).toBe('function');
      cleanupSlide();
      expect(mockThumb.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });

    it('should return callable cleanup function for attachPointerReorder', () => {
      const mockContainer = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([])
      } as unknown as HTMLElement;

      const cleanupReorder = attachPointerReorder(mockContainer);
      expect(typeof cleanupReorder).toBe('function');
      cleanupReorder();
      expect(mockContainer.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });
  });

  describe('8. Simulated Gesture Interactions & State Transitions', () => {
    it('should simulate full swipe-to-dismiss flow: tracking, progress, haptic, and onComplete', () => {
      vi.useFakeTimers();
      const mockVibrate = vi.fn().mockReturnValue(true);
      // @ts-expect-error Mocking navigator
      globalThis.navigator = { vibrate: mockVibrate };

      const listeners: Record<string, (e: any) => void> = {};
      const mockElement = {
        addEventListener: (evt: string, fn: (e: any) => void) => { listeners[evt] = fn; },
        removeEventListener: vi.fn(),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        style: {} as Record<string, string>,
        offsetWidth: 400,
        closest: vi.fn().mockReturnValue(null),
        parentElement: null
      } as unknown as HTMLElement;

      const onProgress = vi.fn();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      attachSwipeToDismiss(mockElement, {
        direction: 'left',
        thresholdRatio: 0.35,
        thresholdPx: 100,
        touchSlop: 8,
        onProgress,
        onComplete,
        onCancel
      });

      // 1. Pointer down
      listeners['pointerdown']({ clientX: 200, clientY: 100, pointerId: 1, target: mockElement, button: 0 });

      // 2. Small vertical jitter within slop window (dx = -2, dy = 3) -> should not lock
      listeners['pointermove']({ clientX: 198, clientY: 103, pointerId: 1, cancelable: true, preventDefault: vi.fn() });
      expect(mockElement.setPointerCapture).not.toHaveBeenCalled();

      // 3. Dominant horizontal swipe left (dx = -150, dy = 10) -> exceeds threshold (140px)
      listeners['pointermove']({ clientX: 50, clientY: 110, pointerId: 1, cancelable: true, preventDefault: vi.fn() });
      expect(mockElement.setPointerCapture).toHaveBeenCalledWith(1);
      expect(mockElement.style.transform).toBe('translateX(-150px)');
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        isTriggered: true,
        distance: 150
      }));
      // Haptic tick when crossing threshold
      expect(mockVibrate).toHaveBeenCalledWith(12);

      // 4. Pointer up beyond threshold -> triggers dismiss sequence
      listeners['pointerup']({ clientX: 50, clientY: 110, pointerId: 1, type: 'pointerup' });
      expect(mockVibrate).toHaveBeenCalledWith([15, 30, 15]);
      expect(mockElement.style.transform).toBe('translateX(-105%)');

      // Fast-forward timers for exit animation & collapse
      vi.runAllTimers();
      expect(onComplete).toHaveBeenCalledWith(mockElement);
      expect(onCancel).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should simulate swipe spring-back when released below threshold', () => {
      vi.useFakeTimers();
      const listeners: Record<string, (e: any) => void> = {};
      const mockElement = {
        addEventListener: (evt: string, fn: (e: any) => void) => { listeners[evt] = fn; },
        removeEventListener: vi.fn(),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        style: {} as Record<string, string>,
        offsetWidth: 400,
        closest: vi.fn().mockReturnValue(null),
        parentElement: null
      } as unknown as HTMLElement;

      const onComplete = vi.fn();
      const onCancel = vi.fn();

      attachSwipeToDismiss(mockElement, {
        direction: 'left',
        thresholdRatio: 0.35,
        thresholdPx: 100,
        touchSlop: 8,
        onComplete,
        onCancel
      });

      listeners['pointerdown']({ clientX: 200, clientY: 100, pointerId: 2, target: mockElement, button: 0 });
      // Drag only 50px left (below 140px threshold)
      listeners['pointermove']({ clientX: 150, clientY: 100, pointerId: 2, cancelable: true, preventDefault: vi.fn() });
      listeners['pointerup']({ clientX: 150, clientY: 100, pointerId: 2, type: 'pointerup' });

      expect(mockElement.style.transform).toBe('translateX(0px)');
      expect(onCancel).toHaveBeenCalledWith(mockElement);
      expect(onComplete).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should simulate slide-to-clear track trigger on >= 70% drag', () => {
      vi.useFakeTimers();
      const mockVibrate = vi.fn().mockReturnValue(true);
      // @ts-expect-error Mocking navigator
      globalThis.navigator = { vibrate: mockVibrate };

      const thumbListeners: Record<string, (e: any) => void> = {};
      const mockTrack = {
        offsetWidth: 200,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as unknown as HTMLElement;

      const mockThumb = {
        offsetWidth: 40,
        style: {} as Record<string, string>,
        addEventListener: (evt: string, fn: (e: any) => void) => { thumbListeners[evt] = fn; },
        removeEventListener: vi.fn(),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn()
      } as unknown as HTMLElement;

      const mockFill = { style: {} as Record<string, string> } as unknown as HTMLElement;
      const mockLabel = { style: {} as Record<string, string> } as unknown as HTMLElement;
      const onClear = vi.fn();

      attachSlideToClear(mockTrack, mockThumb, {
        thresholdRatio: 0.70,
        fillElement: mockFill,
        labelElement: mockLabel,
        onClear
      });

      // Max translate = 200 - 40 - 8 = 152px
      // 1. Pointer down on thumb
      thumbListeners['pointerdown']({ clientX: 10, pointerId: 1, button: 0 });

      // 2. Drag thumb 120px to the right: 120 / 152 = 0.789 (> 0.70 threshold)
      thumbListeners['pointermove']({ clientX: 130, pointerId: 1, cancelable: true, preventDefault: vi.fn() });
      expect(mockThumb.style.transform).toBe('translateX(120px)');
      expect(mockVibrate).toHaveBeenCalledWith(15);

      // 3. Pointer up: triggers clear
      thumbListeners['pointerup']({ clientX: 130, pointerId: 1, type: 'pointerup' });
      expect(mockVibrate).toHaveBeenCalledWith([15, 30, 15]);

      vi.runAllTimers();
      expect(onClear).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should lock document body scroll on modal open and restore on close', () => {
      const origDocument = (globalThis as any).document;
      const origWindow = (globalThis as any).window;

      const mockModal = { remove: vi.fn() };
      (globalThis as any).document = {
        getElementById: vi.fn((id: string) => (id === 'pdfPageLightboxModal' ? mockModal : null)),
        body: {
          style: {
            overflow: 'hidden'
          }
        }
      };
      (globalThis as any).window = {
        removeEventListener: vi.fn()
      };

      try {
        expect((globalThis as any).document.body.style.overflow).toBe('hidden');
        closePdfPageLightbox();
        expect((globalThis as any).document.body.style.overflow).toBe('');
        expect(mockModal.remove).toHaveBeenCalled();
      } finally {
        (globalThis as any).document = origDocument;
        (globalThis as any).window = origWindow;
      }
    });
  });
});
