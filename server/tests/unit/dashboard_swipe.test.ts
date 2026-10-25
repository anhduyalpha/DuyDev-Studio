import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import category navigation helpers directly
import { CATEGORIES, getAdjacentCategory } from '../../../src/components/dashboard/CategoryFilters.js';

describe('Dashboard Category Swipe & Gesture Navigation Suite', () => {
  describe('1. Category Adjacent Transition Invariants', () => {
    it('should have standard 8 categories in correct order', () => {
      expect(CATEGORIES.map(c => c.id)).toEqual([
        'all',
        'pdf',
        'convert',
        'archive',
        'qr',
        'media',
        'system',
        'advanced'
      ]);
    });

    it('should correctly advance to next category in order', () => {
      expect(getAdjacentCategory('all', 'next')).toBe('pdf');
      expect(getAdjacentCategory('pdf', 'next')).toBe('convert');
      expect(getAdjacentCategory('convert', 'next')).toBe('archive');
      expect(getAdjacentCategory('archive', 'next')).toBe('qr');
      expect(getAdjacentCategory('qr', 'next')).toBe('media');
      expect(getAdjacentCategory('media', 'next')).toBe('system');
      expect(getAdjacentCategory('system', 'next')).toBe('advanced');
    });

    it('should clamp boundary at the last category when swiping next', () => {
      expect(getAdjacentCategory('advanced', 'next')).toBeNull();
    });

    it('should correctly retreat to previous category in reverse order', () => {
      expect(getAdjacentCategory('advanced', 'prev')).toBe('system');
      expect(getAdjacentCategory('system', 'prev')).toBe('media');
      expect(getAdjacentCategory('media', 'prev')).toBe('qr');
      expect(getAdjacentCategory('qr', 'prev')).toBe('archive');
      expect(getAdjacentCategory('archive', 'prev')).toBe('convert');
      expect(getAdjacentCategory('convert', 'prev')).toBe('pdf');
      expect(getAdjacentCategory('pdf', 'prev')).toBe('all');
    });

    it('should clamp boundary at the first category when swiping prev', () => {
      expect(getAdjacentCategory('all', 'prev')).toBeNull();
    });

    it('should safely return null for invalid or unknown category', () => {
      expect(getAdjacentCategory('unknown-category', 'next')).toBeNull();
      expect(getAdjacentCategory('', 'prev')).toBeNull();
    });
  });

  describe('2. Gesture Physics & Angle Ratio Mathematical Verification', () => {
    const MIN_HORIZONTAL_THRESHOLD = 45;
    const VELOCITY_THRESHOLD = 0.18;
    const ANGLE_RATIO = 1.35;

    function evaluateGesture(dx: number, dy: number, elapsedMs: number) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Angle check
      const isHorizontal = absDx > absDy * ANGLE_RATIO;
      if (!isHorizontal) {
        return { isSwipe: false, reason: 'angle_vertical' };
      }

      const velocity = absDx / Math.max(1, elapsedMs);
      const isSwipe = (absDx >= MIN_HORIZONTAL_THRESHOLD && velocity >= VELOCITY_THRESHOLD) || absDx >= 80;

      return {
        isSwipe,
        direction: dx < 0 ? 'next' : 'prev',
        velocity,
        distance: absDx
      };
    }

    it('should recognize fast horizontal flick as valid swipe', () => {
      // 55px in 150ms -> velocity = 0.366 px/ms, minimal vertical drift (5px)
      const res = evaluateGesture(-55, 5, 150);
      expect(res.isSwipe).toBe(true);
      expect(res.direction).toBe('next');
    });

    it('should recognize rightward swipe as previous tab', () => {
      // +60px in 200ms -> velocity = 0.3 px/ms
      const res = evaluateGesture(60, 8, 200);
      expect(res.isSwipe).toBe(true);
      expect(res.direction).toBe('prev');
    });

    it('should reject predominantly vertical scroll gestures', () => {
      // dx = 40, dy = 70 (scrolling down page)
      const res = evaluateGesture(-40, 70, 200);
      expect(res.isSwipe).toBe(false);
      expect(res.reason).toBe('angle_vertical');
    });

    it('should reject ambiguous diagonal movement (e.g. 45-degree drag)', () => {
      // dx = 40, dy = 35 -> ratio = 1.14 (< 1.35)
      const res = evaluateGesture(-40, 35, 150);
      expect(res.isSwipe).toBe(false);
      expect(res.reason).toBe('angle_vertical');
    });

    it('should reject micro-jitters and tiny taps (< 45px with low velocity)', () => {
      // dx = 15, dy = 2 in 300ms
      const res = evaluateGesture(-15, 2, 300);
      expect(res.isSwipe).toBe(false);
    });

    it('should accept deliberate long drag even at lower velocity', () => {
      // dx = 95px in 600ms (velocity = 0.158, but distance >= 80px)
      const res = evaluateGesture(-95, 10, 600);
      expect(res.isSwipe).toBe(true);
      expect(res.direction).toBe('next');
    });
  });

  describe('3. CSS Design Tokens & Animation Validation', () => {
    it('should define keyframes and classes for smooth tab transitions in stitch-tokens.css', () => {
      const cssPath = path.resolve(__dirname, '../../..', 'src/styles/stitch-tokens.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('@keyframes tabSlideFromRight');
      expect(css).toContain('@keyframes tabSlideFromLeft');
      expect(css).toContain('.animate-tab-slide-right');
      expect(css).toContain('.animate-tab-slide-left');
      expect(css).toContain('translate3d'); // Hardware accelerated compositing
    });
  });

  describe('4. Android Bridge & Controller Integration', () => {
    it('should verify AndroidBridge has setSwipeRefreshEnabled', () => {
      const bridgePath = path.resolve(__dirname, '../../..', 'android/app/src/main/java/vn/alphadaniel/duydevstudio/AndroidBridge.kt');
      const bridgeCode = fs.readFileSync(bridgePath, 'utf8');

      expect(bridgeCode).toContain('fun setSwipeRefreshEnabled(enabled: Boolean)');
      expect(bridgeCode).toContain('@JavascriptInterface');
    });

    it('should verify DashboardPage integrates initDashboardSwipe and touch-pan-y', () => {
      const pagePath = path.resolve(__dirname, '../../..', 'src/pages/DashboardPage.js');
      const pageCode = fs.readFileSync(pagePath, 'utf8');

      expect(pageCode).toContain('initDashboardSwipe');
      expect(pageCode).toContain('touch-pan-y');
      expect(pageCode).toContain('stopSwipe()');
    });
  });
});
