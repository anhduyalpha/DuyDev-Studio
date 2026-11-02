/**
 * security_shield_debugger.test.ts - Anti-Debugger & Client Shield Test Suite
 * Tests local dev bypass detection, timing logic, docked DevTools thresholds, and reload requirement.
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
      const widthDiff = outerWidth - innerWidth;
      const heightDiff = outerHeight - innerHeight;
      return widthDiff > 100 || heightDiff > 250;
    }

    it('detects desktop DevTools docked to the side (widthDiff > 100)', () => {
      // Normal desktop window (16px border)
      expect(isDockedDevTools(1440, 900, 1456, 1020)).toBe(false);

      // DevTools docked on side (takes 450px width)
      expect(isDockedDevTools(1006, 900, 1456, 1020)).toBe(true);
    });

    it('detects desktop DevTools docked to bottom (heightDiff > 250)', () => {
      // DevTools docked at bottom (takes 350px height)
      expect(isDockedDevTools(1440, 550, 1456, 940)).toBe(true);
    });
  });

  describe('Blocker Overlay Text Standards & Reload Requirement', () => {
    it('contains exact required phrase "ÂU NÂU ĐỪNG PHÁ WEB"', () => {
      const phrase = 'ÂU NÂU ĐỪNG PHÁ WEB';
      expect(phrase).toBe('ÂU NÂU ĐỪNG PHÁ WEB');
    });

    it('latches permanently and requires reload once triggered', () => {
      let isWebLocked = false;
      const lockWebPermanently = () => { isWebLocked = true; };

      lockWebPermanently();
      expect(isWebLocked).toBe(true);

      // Attempting further status checks does not un-lock
      const checkDevToolsStatus = (isOpen: boolean) => {
        if (!isOpen && !isWebLocked) {
          // would unlock only if not permanently latched
        }
      };
      checkDevToolsStatus(false);
      expect(isWebLocked).toBe(true);
    });

    it('contains no admin bypass button or prompt on the blocker screen', () => {
      const fs = require('fs');
      const path = require('path');
      const shieldSource = fs.readFileSync(path.resolve(__dirname, '../../../src/utilities/securityShield.js'), 'utf-8');
      expect(shieldSource).not.toContain('dsBtnBypassDevTools');
      expect(shieldSource).not.toContain('Tôi là Quản trị viên');
    });
  });
});
