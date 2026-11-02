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

  describe('Window Dimension Delta Logic', () => {
    function isDockedDevTools(innerWidth: number, innerHeight: number, outerWidth: number, outerHeight: number): boolean {
      if (innerWidth <= 640) return false;
      const widthDiff = outerWidth - innerWidth;
      const heightDiff = outerHeight - innerHeight;
      return widthDiff > 180 || heightDiff > 200;
    }

    it('ignores mobile viewports under 640px to prevent address-bar false positives', () => {
      expect(isDockedDevTools(390, 844, 390, 1100)).toBe(false);
    });

    it('detects desktop docked DevTools on side or bottom', () => {
      // Normal desktop window
      expect(isDockedDevTools(1440, 900, 1456, 940)).toBe(false);

      // DevTools docked on side (takes 400px width)
      expect(isDockedDevTools(1040, 900, 1456, 940)).toBe(true);

      // DevTools docked at bottom (takes 350px height)
      expect(isDockedDevTools(1440, 550, 1456, 940)).toBe(true);
    });
  });
});
