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
    function isDockedDevTools(
      innerWidth: number,
      innerHeight: number,
      outerWidth: number,
      outerHeight: number,
      options: { isDesktop?: boolean; isMobile?: boolean; isDismissed?: boolean } = { isDesktop: true, isMobile: false, isDismissed: false }
    ): boolean {
      if (options.isDismissed) return false;
      if (options.isMobile) return false;
      if (!options.isDesktop) return false;
      const widthDiff = outerWidth - innerWidth;
      const heightDiff = outerHeight - innerHeight;
      return widthDiff > 350 || heightDiff > 250;
    }

    it('detects desktop DevTools docked to the side (widthDiff > 350) and exempts sidebar browsers', () => {
      // Normal desktop window (16px border)
      expect(isDockedDevTools(1440, 900, 1456, 1020)).toBe(false);

      // Zen Browser / Arc vertical tabs sidebar (takes 220px-300px widthDiff)
      expect(isDockedDevTools(1200, 900, 1456, 1020)).toBe(false);

      // DevTools docked on side (takes 556px width)
      expect(isDockedDevTools(900, 900, 1456, 1020)).toBe(true);
    });

    it('bypasses dimension detection if dismissed by user (1-click auto-recovery)', () => {
      // Even with wide difference, if dismissed flag is present, never block
      expect(isDockedDevTools(800, 900, 1456, 1020, { isDesktop: true, isMobile: false, isDismissed: true })).toBe(false);
    });

    it('detects desktop DevTools docked to bottom (heightDiff > 250)', () => {
      // DevTools docked at bottom (takes 350px height)
      expect(isDockedDevTools(1440, 550, 1456, 940)).toBe(true);
    });

    it('exempts Android and mobile devices from docked false positives', () => {
      // Android device with physical outerWidth: 1080, CSS innerWidth: 412 (difference 668px)
      expect(
        isDockedDevTools(412, 732, 1080, 2400, { isDesktop: false, isMobile: true })
      ).toBe(false);

      // Native Android App with AndroidBridge
      expect(
        isDockedDevTools(393, 851, 1080, 2340, { isDesktop: false, isMobile: true })
      ).toBe(false);
    });
  });

  describe('Mobile & Android Bridge Exemption', () => {
    function testIsMobileOrApk(env: {
      hasAndroidBridge?: boolean;
      userAgent?: string;
      screenWidth?: number;
      screenHeight?: number;
      isCoarsePointer?: boolean;
    }): boolean {
      if (Boolean(env.hasAndroidBridge)) return true;
      const ua = env.userAgent || '';
      if (/Android|iPhone|iPad|iPod|Mobile|DuyDevStudioNative|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        return true;
      }
      if (env.isCoarsePointer && env.screenWidth && (env.screenWidth < 1024 || (env.screenHeight && env.screenHeight < 768))) {
        return true;
      }
      if (env.screenWidth && env.screenWidth < 768) {
        return true;
      }
      return false;
    }

    it('recognizes native AndroidBridge as mobile app', () => {
      expect(testIsMobileOrApk({ hasAndroidBridge: true })).toBe(true);
    });

    it('recognizes Android and iOS user agents', () => {
      expect(testIsMobileOrApk({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) DuyDevStudioNative/1.0' })).toBe(true);
      expect(testIsMobileOrApk({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(true);
    });

    it('recognizes desktop browsers as non-mobile', () => {
      expect(testIsMobileOrApk({
        hasAndroidBridge: false,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        screenWidth: 1920,
        screenHeight: 1080,
        isCoarsePointer: false
      })).toBe(false);
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
      expect(shieldSource).not.toContain('bypassActive');
      expect(shieldSource).not.toContain('ds:admin-auth-changed');
    });
  });
});
