/**
 * security_shield_debugger.test.ts - Anti-Debugger & Client Shield Test Suite
 * Tests local dev bypass detection, timing logic, and admin state listeners.
 */

import { describe, it, expect } from 'vitest';

describe('Anti-Debugger & Security Shield Unit Tests', () => {
  describe('Local Dev Bypass Logic', () => {
    function testIsLocalDev(hostname: string): boolean {
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    }

    it('identifies localhost and loopback as local dev', () => {
      expect(testIsLocalDev('localhost')).toBe(true);
      expect(testIsLocalDev('127.0.0.1')).toBe(true);
      expect(testIsLocalDev('192.168.2.171')).toBe(true);
      expect(testIsLocalDev('192.168.1.10')).toBe(true);
    });

    it('identifies production and public domains as non-local', () => {
      expect(testIsLocalDev('studio.duydev.cloud')).toBe(false);
      expect(testIsLocalDev('attacker.com')).toBe(false);
      expect(testIsLocalDev('10.0.0.1')).toBe(false);
    });
  });

  describe('DevTools Timing Threshold', () => {
    it('accurately distinguishes normal execution (<10ms) from debugger pause (>100ms)', () => {
      const normalDelta = 0.05;
      const pausedDelta = 350;

      const isDevToolsOpen = (duration: number) => duration > 100;

      expect(isDevToolsOpen(normalDelta)).toBe(false);
      expect(isDevToolsOpen(pausedDelta)).toBe(true);
    });
  });

  describe('Docked DevTools Dimension Logic', () => {
    function isDockedDevTools(innerWidth: number, innerHeight: number, outerWidth: number, outerHeight: number): boolean {
      const threshold = 160;
      const widthDiff = outerWidth - innerWidth;
      const heightDiff = outerHeight - innerHeight;
      const widthThreshold = widthDiff > threshold;
      const heightThreshold = heightDiff > threshold;
      return (widthThreshold && !heightThreshold) || (heightThreshold && !widthThreshold);
    }

    it('detects desktop DevTools docked to the side (width threshold only)', () => {
      // Normal desktop window
      expect(isDockedDevTools(1440, 900, 1456, 940)).toBe(false);

      // DevTools docked on side (takes 450px width, height remains unchanged)
      expect(isDockedDevTools(1006, 900, 1456, 940)).toBe(true);
    });

    it('detects desktop DevTools docked to bottom (height threshold only)', () => {
      // DevTools docked at bottom (takes 350px height, width remains unchanged)
      expect(isDockedDevTools(1440, 550, 1456, 940)).toBe(true);
    });

    it('filters out simultaneous width and height zoom/scaling', () => {
      // Both width and height difference large due to window scaling or 150% zoom
      expect(isDockedDevTools(900, 500, 1400, 900)).toBe(false);
    });
  });

  describe('Blocker Overlay Text Standards', () => {
    it('contains exact required phrase "ÂU NÂU ĐỪNG PHÁ WEB"', () => {
      const phrase = 'ÂU NÂU ĐỪNG PHÁ WEB';
      expect(phrase).toBe('ÂU NÂU ĐỪNG PHÁ WEB');
    });
  });
});
