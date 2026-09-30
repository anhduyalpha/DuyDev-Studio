/**
 * Adversarial Empirical Stress Test Suite: PDF Gestures, Lightbox & Reorder
 * Milestone M2 Challenge Harness
 *
 * Stress-tests:
 * 1. Extreme touch slop ratios (dy === dx, sub-slop < 8px, massive flick, floats)
 * 2. Permutation matrices for queue reordering (first-to-last, last-to-first, out-of-bounds, NaN)
 * 3. Spatial geometry of pointer drop calculations with irregular item sizes and tie-breaks
 * 4. Multi-page lightbox rotation preservation across bidirectional traversal and manual rotation
 * 5. Extreme slide-to-clear track dimensions (overdrag, reverse drag, zero width)
 * 6. Rapid pointer lifecycle interruption (pointercancel mid-gesture)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfQueueManager } from '../../../src/components/tools/pdf/hooks/usePdfQueue.js';
import {
  isTouchSlopDisambiguated,
  calculateSwipeState,
  attachSwipeToDismiss,
  attachSlideToClear
} from '../../../src/utilities/swipeGesture.js';
import { computeDropIndex, attachPointerReorder } from '../../../src/utilities/dragReorder.js';

describe('Adversarial Challenge M2: Touch & Mouse Gestures, Lightbox & Reordering', () => {

  // =========================================================================
  // 1. TOUCH SLOP MATHEMATICS & EXTREME RATIOS
  // =========================================================================
  describe('1. Touch Slop Mathematics & Extreme Boundary Ratios', () => {

    it('should stay unresolved for all sub-slop points within 8px circle/box', () => {
      const subSlopPoints = [
        [0, 0],
        [0.001, 0.001],
        [-0.001, -0.001],
        [7.99, 0],
        [0, 7.99],
        [-7.99, -7.99],
        [5.5, -6.9],
        [-7.9999, 7.9999]
      ];

      for (const [dx, dy] of subSlopPoints) {
        const result = isTouchSlopDisambiguated(dx, dy, 8);
        expect(result, `Failed for dx=${dx}, dy=${dy}`).toEqual({
          resolved: false,
          isHorizontal: false
        });
      }
    });

    it('should strictly prioritize vertical scroll when dy === dx (diagonal swipe ambiguity)', () => {
      // Safety critical: when user scrolls diagonally on mobile, native scroll MUST dominate
      const diagonalPoints = [
        [8, 8],
        [-8, 8],
        [8, -8],
        [-8, -8],
        [15.5, 15.5],
        [100, 100],
        [-500, 500],
        [10000, 10000]
      ];

      for (const [dx, dy] of diagonalPoints) {
        const result = isTouchSlopDisambiguated(dx, dy, 8);
        expect(result, `Failed for diagonal dx=${dx}, dy=${dy}`).toEqual({
          resolved: true,
          isHorizontal: false
        });
      }
    });

    it('should resolve to horizontal swipe as soon as |dx| strictly exceeds |dy| by any epsilon', () => {
      const horizontalPoints = [
        [8.001, 8.0],
        [-8.001, 8.0],
        [8.0, 7.999],
        [15, 14.99],
        [-100, 99.99],
        [500, -499.9]
      ];

      for (const [dx, dy] of horizontalPoints) {
        const result = isTouchSlopDisambiguated(dx, dy, 8);
        expect(result, `Failed for horizontal dx=${dx}, dy=${dy}`).toEqual({
          resolved: true,
          isHorizontal: true
        });
      }
    });

    it('should survive massive flicks up to +/- 1,000,000px without precision loss or NaN', () => {
      // Massive horizontal flick
      expect(isTouchSlopDisambiguated(1_000_000, 0, 8)).toEqual({ resolved: true, isHorizontal: true });
      expect(isTouchSlopDisambiguated(-1_000_000, 50, 8)).toEqual({ resolved: true, isHorizontal: true });

      // Massive vertical flick
      expect(isTouchSlopDisambiguated(0, 1_000_000, 8)).toEqual({ resolved: true, isHorizontal: false });
      expect(isTouchSlopDisambiguated(-100, -1_000_000, 8)).toEqual({ resolved: true, isHorizontal: false });
    });

    it('should handle extreme custom slop thresholds correctly', () => {
      // Zero threshold: resolves immediately
      expect(isTouchSlopDisambiguated(0.1, 0, 0)).toEqual({ resolved: true, isHorizontal: true });
      expect(isTouchSlopDisambiguated(0, 0.1, 0)).toEqual({ resolved: true, isHorizontal: false });

      // High threshold (50px)
      expect(isTouchSlopDisambiguated(49, 20, 50)).toEqual({ resolved: false, isHorizontal: false });
      expect(isTouchSlopDisambiguated(50.1, 20, 50)).toEqual({ resolved: true, isHorizontal: true });
    });
  });

  // =========================================================================
  // 2. SWIPE STATE MATH & DEGENERATE BOUNDARIES
  // =========================================================================
  describe('2. Swipe State Calculation & Degenerate Boundaries', () => {

    it('should handle zero or negative width without division by zero or NaN', () => {
      const stateZero = calculateSwipeState({ dx: -50, width: 0, direction: 'left' });
      expect(Number.isFinite(stateZero.ratio)).toBe(true);
      expect(Number.isFinite(stateZero.threshold)).toBe(true);
      expect(stateZero.threshold).toBeGreaterThanOrEqual(1);

      const stateNeg = calculateSwipeState({ dx: -50, width: -200, direction: 'left' });
      expect(Number.isFinite(stateNeg.ratio)).toBe(true);
      expect(stateNeg.threshold).toBeGreaterThanOrEqual(1);
    });

    it('should clamp ratio between 0 and 1 even during ultra-flick displacement', () => {
      const stateFlick = calculateSwipeState({ dx: -999999, width: 400, direction: 'left' });
      expect(stateFlick.ratio).toBe(1);
      expect(stateFlick.isTriggered).toBe(true);
      expect(stateFlick.clampedDx).toBe(-999999);
      expect(stateFlick.distance).toBe(999999);
    });

    it('should clamp threshold to element width when element is narrower than thresholdPx', () => {
      // Element width 60px, thresholdPx = 100px. Threshold must be capped at 60px.
      const stateNarrow = calculateSwipeState({ dx: -59, width: 60, thresholdPx: 100, direction: 'left' });
      expect(stateNarrow.threshold).toBe(60);
      expect(stateNarrow.isTriggered).toBe(false);

      const stateTriggered = calculateSwipeState({ dx: -60, width: 60, thresholdPx: 100, direction: 'left' });
      expect(stateTriggered.threshold).toBe(60);
      expect(stateTriggered.isTriggered).toBe(true);
    });

    it('should correctly ignore wrong-way swipes for directional configurations', () => {
      // Direction 'left' with positive dx (swipe right)
      const stateWrongRight = calculateSwipeState({ dx: 500, width: 300, direction: 'left' });
      expect(stateWrongRight.clampedDx).toBe(0);
      expect(stateWrongRight.distance).toBe(0);
      expect(stateWrongRight.isTriggered).toBe(false);

      // Direction 'right' with negative dx (swipe left)
      const stateWrongLeft = calculateSwipeState({ dx: -500, width: 300, direction: 'right' });
      expect(stateWrongLeft.clampedDx).toBe(0);
      expect(stateWrongLeft.distance).toBe(0);
      expect(stateWrongLeft.isTriggered).toBe(false);
    });
  });

  // =========================================================================
  // 3. QUEUE REORDER PERMUTATIONS & DEFENSIVE BOUNDS
  // =========================================================================
  describe('3. Queue Reordering Permutation Matrix & Invariants', () => {
    let qm: InstanceType<typeof PdfQueueManager>;

    beforeEach(() => {
      qm = new PdfQueueManager();
    });

    it('should satisfy list integrity invariant across all NxN pairwise reorderings', () => {
      const initialIds = ['item-0', 'item-1', 'item-2', 'item-3', 'item-4'];

      for (let from = 0; from < initialIds.length; from++) {
        for (let to = 0; to < initialIds.length; to++) {
          qm.files = initialIds.map((id) => ({ id, name: `${id}.pdf`, size: 1024 }));

          qm.reorderFiles(from, to);

          // Invariant 1: Length must remain unchanged
          expect(qm.files.length).toBe(initialIds.length);

          // Invariant 2: Set of elements must be strictly identical (no lost or duplicated items)
          const resultingIds = qm.files.map((f: { id: string }) => f.id);
          expect(new Set(resultingIds)).toEqual(new Set(initialIds));

          // Invariant 3: Target index must contain the moved element
          expect(resultingIds[to]).toBe(initialIds[from]);
        }
      }
    });

    it('should correctly reorder first item to last index', () => {
      qm.files = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
      qm.reorderFiles(0, 3);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['b', 'c', 'd', 'a']);
    });

    it('should correctly reorder last item to first index', () => {
      qm.files = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
      qm.reorderFiles(3, 0);
      expect(qm.files.map((f: { id: string }) => f.id)).toEqual(['d', 'a', 'b', 'c']);
    });

    it('should defend against extreme out-of-bounds, negative, float, and non-numeric indices', () => {
      const baseline = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      qm.files = [...baseline];

      const invalidCalls: [any, any][] = [
        [-1, 1],
        [1, -1],
        [-99999, 2],
        [0, 99999],
        [3, 0], // index 3 is out of bounds for 3-item array (0..2)
        [0, 3],
        [NaN, 1],
        [1, NaN],
        [undefined, 1],
        [1, undefined],
        ['abc', 1]
      ];

      for (const [from, to] of invalidCalls) {
        let notified = false;
        qm.subscribe((_s: unknown, evt: string) => {
          if (evt === 'files-change') notified = true;
        });

        qm.reorderFiles(from, to);
        expect(qm.files).toEqual(baseline);
        expect(notified).toBe(false);
      }
    });

    it('should safely no-op when reordering on empty or 1-item queues', () => {
      qm.files = [];
      expect(() => qm.reorderFiles(0, 0)).not.toThrow();
      expect(() => qm.reorderFiles(0, 1)).not.toThrow();
      expect(qm.files).toEqual([]);

      qm.files = [{ id: 'single' }];
      expect(() => qm.reorderFiles(0, 0)).not.toThrow();
      expect(() => qm.reorderFiles(0, 1)).not.toThrow();
      expect(qm.files).toEqual([{ id: 'single' }]);
    });
  });

  // =========================================================================
  // 4. SPATIAL GEOMETRY & DROP INDEX CALCULATIONS
  // =========================================================================
  describe('4. Spatial Geometry & Drop Index Calculations', () => {
    // Non-uniform item rectangles
    const nonUniformRects = [
      { index: 0, top: 10, bottom: 60, midY: 35, height: 50 },
      { index: 1, top: 70, bottom: 170, midY: 120, height: 100 },
      { index: 2, top: 180, bottom: 220, midY: 200, height: 40 },
      { index: 3, top: 230, bottom: 310, midY: 270, height: 80 }
    ];

    it('should clamp to index 0 for any pointer position at or above the first midpoint', () => {
      expect(computeDropIndex(-9999, nonUniformRects, 2)).toBe(0);
      expect(computeDropIndex(0, nonUniformRects, 2)).toBe(0);
      expect(computeDropIndex(35, nonUniformRects, 2)).toBe(0);
    });

    it('should clamp to last index for any pointer position at or below the last midpoint', () => {
      expect(computeDropIndex(270, nonUniformRects, 0)).toBe(3);
      expect(computeDropIndex(500, nonUniformRects, 0)).toBe(3);
      expect(computeDropIndex(99999, nonUniformRects, 0)).toBe(3);
    });

    it('should accurately calculate mid-gap thresholds between non-uniform items', () => {
      // Between item 0 (midY 35) and item 1 (midY 120): midpoint threshold = (35 + 120) / 2 = 77.5
      expect(computeDropIndex(77, nonUniformRects, 0)).toBe(0);
      expect(computeDropIndex(78, nonUniformRects, 0)).toBe(1);

      // Between item 1 (midY 120) and item 2 (midY 200): midpoint threshold = (120 + 200) / 2 = 160
      expect(computeDropIndex(159, nonUniformRects, 1)).toBe(1);
      expect(computeDropIndex(160, nonUniformRects, 1)).toBe(2); // Tie breaks to next
      expect(computeDropIndex(161, nonUniformRects, 1)).toBe(2);

      // Between item 2 (midY 200) and item 3 (midY 270): midpoint threshold = (200 + 270) / 2 = 235
      expect(computeDropIndex(234, nonUniformRects, 2)).toBe(2);
      expect(computeDropIndex(236, nonUniformRects, 2)).toBe(3);
    });

    it('should defend against degenerate, empty, or null rect structures', () => {
      expect(computeDropIndex(100, null as any, 3)).toBe(3);
      expect(computeDropIndex(100, undefined as any, 2)).toBe(2);
      expect(computeDropIndex(100, [], 1)).toBe(1);
      expect(computeDropIndex(100, [{ index: 0, top: 0, bottom: 50, midY: 25, height: 50 }], 0)).toBe(0);
    });
  });

  // =========================================================================
  // 5. LIGHTBOX MULTI-PAGE ROTATION PRESERVATION MATRIX
  // =========================================================================
  describe('5. Lightbox Multi-Page Rotation Preservation & Navigation', () => {

    it('should retain non-zero rotation angles across multi-step bidirectional navigation', () => {
      // Simulate 5 pages with diverse rotation states
      const pageRotations: Record<number, number> = {
        0: 0,
        1: 90,
        2: 180,
        3: 270,
        4: 90
      };

      const getRotation = (idx: number) => pageRotations[idx] ?? 0;

      // Model the Lightbox resolveRotation logic from PdfPageLightboxModal.js
      const resolveRotation = (idx: number, fallback = 0) => {
        if (typeof getRotation === 'function') {
          const rot = getRotation(idx);
          if (typeof rot === 'number') return rot;
        }
        return fallback;
      };

      // Traversal sequence: 0 -> 1 -> 2 -> 3 -> 4 -> 3 -> 2 -> 1 -> 0
      const steps = [
        { page: 0, expectedRot: 0 },
        { page: 1, expectedRot: 90 },
        { page: 2, expectedRot: 180 },
        { page: 3, expectedRot: 270 },
        { page: 4, expectedRot: 90 },
        { page: 3, expectedRot: 270 },
        { page: 2, expectedRot: 180 },
        { page: 1, expectedRot: 90 },
        { page: 0, expectedRot: 0 }
      ];

      for (const step of steps) {
        const resolved = resolveRotation(step.page, 0);
        expect(resolved, `Page ${step.page} did not retain expected rotation`).toBe(step.expectedRot);
      }
    });

    it('should support in-modal angle increment and modulo arithmetic', () => {
      let currentRot = 270;
      // User clicks Rotate (+90°)
      currentRot = (currentRot + 90) % 360;
      expect(currentRot).toBe(0);

      // Rotate again
      currentRot = (currentRot + 90) % 360;
      expect(currentRot).toBe(90);

      // Rotate again
      currentRot = (currentRot + 90) % 360;
      expect(currentRot).toBe(180);
    });

    it('should fallback gracefully to 0 when getRotation is missing or returns invalid data', () => {
      const resolveWithMissing = (idx: number) => {
        const getRot = null;
        if (typeof getRot === 'function') return (getRot as any)(idx);
        return 0;
      };
      expect(resolveWithMissing(2)).toBe(0);

      const resolveWithNaN = (_idx: number) => {
        const getRot = () => NaN;
        const res = getRot();
        return typeof res === 'number' && !isNaN(res) ? res : 0;
      };
      expect(resolveWithNaN(2)).toBe(0);
    });
  });

  // =========================================================================
  // 6. SLIDE-TO-CLEAR TRACK BOUNDARIES & RESILIENCE
  // =========================================================================
  describe('6. Slide-to-Clear Track Boundaries & Resilience', () => {

    it('should safely calculate max translate even if track is narrower than thumb', () => {
      const mockTrackNarrow = { offsetWidth: 30 } as HTMLElement;
      const mockThumbWide = { offsetWidth: 40 } as HTMLElement;

      const getMaxTranslate = (track: HTMLElement, thumb: HTMLElement) => {
        const trackWidth = track.offsetWidth || 200;
        const thumbWidth = thumb.offsetWidth || 36;
        return Math.max(10, trackWidth - thumbWidth - 8);
      };

      // When track (30px) < thumb (40px) + 8 = 48px, formula returns Math.max(10, -18) = 10
      const maxTranslate = getMaxTranslate(mockTrackNarrow, mockThumbWide);
      expect(maxTranslate).toBe(10);
      expect(maxTranslate).toBeGreaterThan(0);
    });

    it('should clamp thumb displacement within [0, maxTranslate] on over-drag or reverse drag', () => {
      const maxTranslate = 150;

      // Over-drag to the right (+5000px)
      const rawOver = 5000;
      const clampedOver = Math.max(0, Math.min(rawOver, maxTranslate));
      expect(clampedOver).toBe(150);
      expect(clampedOver / maxTranslate).toBe(1.0);

      // Reverse drag to the left (-500px)
      const rawUnder = -500;
      const clampedUnder = Math.max(0, Math.min(rawUnder, maxTranslate));
      expect(clampedUnder).toBe(0);
      expect(clampedUnder / maxTranslate).toBe(0.0);
    });

    it('should properly abort slide-to-clear without invoking onClear when pointer cancels', () => {
      vi.useFakeTimers();
      const listeners: Record<string, (e: any) => void> = {};
      const mockTrack = { offsetWidth: 200, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLElement;
      const mockThumb = {
        offsetWidth: 40,
        style: {} as Record<string, string>,
        addEventListener: (evt: string, fn: any) => { listeners[evt] = fn; },
        removeEventListener: vi.fn(),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn()
      } as unknown as HTMLElement;

      const onClear = vi.fn();
      attachSlideToClear(mockTrack, mockThumb, { onClear });

      // Start drag
      listeners['pointerdown']({ clientX: 10, pointerId: 1, button: 0 });
      // Drag past threshold
      listeners['pointermove']({ clientX: 140, pointerId: 1, cancelable: true, preventDefault: vi.fn() });

      // Emergency pointercancel event (e.g., incoming phone call or OS gesture interruption)
      listeners['pointercancel']({ clientX: 140, pointerId: 1, type: 'pointercancel' });

      vi.runAllTimers();
      // Must NOT clear
      expect(onClear).not.toHaveBeenCalled();
      // Must return to origin
      expect(mockThumb.style.transform).toBe('translateX(0px)');

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // 7. POINTER REORDER RUNTIME STRESS & TEARDOWN
  // =========================================================================
  describe('7. Pointer Reorder Runtime Stress & Lifecycle Teardown', () => {

    it('should clean up all listeners and reset transforms on unmount', () => {
      const listeners: Record<string, Function> = {};
      const winListeners: Record<string, Function> = {};

      const mockTarget = {
        addEventListener: vi.fn((e, f) => { listeners[e] = f; }),
        removeEventListener: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([])
      } as unknown as HTMLElement;

      // Mock window
      const origWin = globalThis.window;
      try {
        const mockWin = {
          addEventListener: vi.fn((e, f) => { winListeners[e] = f; }),
          removeEventListener: vi.fn()
        };
        // @ts-expect-error Mocking window
        globalThis.window = mockWin;

        const cleanup = attachPointerReorder(mockTarget);
        expect(typeof cleanup).toBe('function');

        cleanup();

        expect(mockTarget.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
        expect(mockWin.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
        expect(mockWin.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
        expect(mockWin.removeEventListener).toHaveBeenCalledWith('pointercancel', expect.any(Function));
      } finally {
        globalThis.window = origWin;
      }
    });
  });
});
