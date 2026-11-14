import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  peekPendingSharedPayload,
  consumePendingSharedPayload
} from '../../../src/utilities/shareTargetHelper.js';
import { detectSmartRoute } from '../../../src/utilities/smartUrlRouter.js';
import { renderHeader, syncHeaderUserProfile } from '../../../src/components/layout/Header.js';

describe('Task 1.2 — Atomic Share Queue, Hydration Watchdog & Non-Blocking Onboarding', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const appJsPath = path.join(rootDir, 'src/app.js');
  const indexPath = path.join(rootDir, 'index.html');
  const shareModalPath = path.join(rootDir, 'src/components/common/ShareTargetModal.js');
  const headerPath = path.join(rootDir, 'src/components/layout/Header.js');

  let originalWindow: any;
  let originalDocument: any;
  let originalLocalStorage: any;
  let originalSessionStorage: any;

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    originalLocalStorage = global.localStorage;
    originalSessionStorage = global.sessionStorage;

    const storageMap = new Map<string, string>();
    const mockStorage = {
      getItem: vi.fn((key: string) => storageMap.get(key) || null),
      setItem: vi.fn((key: string, val: string) => { storageMap.set(key, String(val)); }),
      removeItem: vi.fn((key: string) => { storageMap.delete(key); }),
      clear: vi.fn(() => { storageMap.clear(); })
    };

    // @ts-ignore
    global.localStorage = mockStorage;
    // @ts-ignore
    global.sessionStorage = mockStorage;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
    global.sessionStorage = originalSessionStorage;
    vi.restoreAllMocks();
  });

  describe('1. Atomic peekPendingSharedPayload() without clearing', () => {
    it('reads payload WITHOUT calling clearSharedPayload() and assigns deterministic payloadId', async () => {
      const clearMock = vi.fn();
      const mockPayload = {
        title: 'Quantum Physics Paper',
        url: 'https://academia.edu/12345/quantum-physics',
        text: 'Shared from browser'
      };

      // @ts-ignore
      global.window = {
        AndroidBridge: {
          getSharedPayload: vi.fn(() => JSON.stringify(mockPayload)),
          clearSharedPayload: clearMock
        }
      };

      const peekResult = await peekPendingSharedPayload();

      expect(peekResult).not.toBeNull();
      expect(peekResult?.url).toBe('https://academia.edu/12345/quantum-physics');
      expect(peekResult?.title).toBe('Quantum Physics Paper');
      expect(peekResult?.payloadId).toBeDefined();
      expect(typeof peekResult?.payloadId).toBe('string');
      expect(peekResult?.payloadId.length).toBeGreaterThan(0);
      expect(clearMock).not.toHaveBeenCalled();
    });
  });

  describe('2. Idempotent consumePendingSharedPayload(payloadId)', () => {
    it('double call to consumePendingSharedPayload(payloadId) only invokes clearSharedPayload() once', async () => {
      const clearMock = vi.fn();
      const payloadId = 'test_payload_id_12345';
      const mockPayload = {
        payloadId,
        title: 'ResearchGate Paper',
        url: 'https://researchgate.net/publication/99999_paper',
        text: 'Shared paper'
      };

      // @ts-ignore
      global.window = {
        AndroidBridge: {
          getSharedPayload: vi.fn(() => JSON.stringify(mockPayload)),
          clearSharedPayload: clearMock
        }
      };

      // First call consumes and clears
      const firstResult = await consumePendingSharedPayload(payloadId);
      expect(firstResult).not.toBeNull();
      expect(clearMock).toHaveBeenCalledTimes(1);

      // Second call with same payloadId must be a no-op / not call clearSharedPayload again
      const secondResult = await consumePendingSharedPayload(payloadId);
      expect(clearMock).toHaveBeenCalledTimes(1);
      expect(secondResult).toBeNull();
    });
  });

  describe('3. Smart Route Detection & Query Dispatch for Academia and ResearchGate', () => {
    it('detectSmartRoute resolves academia.edu to #tool/academia', () => {
      const res = detectSmartRoute('https://www.academia.edu/98765/Sample_Paper');
      expect(res).not.toBeNull();
      expect(res?.toolId).toBe('academia');
      expect(res?.route).toBe('#tool/academia');
      expect(res?.url).toBe('https://www.academia.edu/98765/Sample_Paper');
      expect(res?.autoStart).toBe(true);
    });

    it('detectSmartRoute resolves researchgate.net to #tool/researchgate', () => {
      const res = detectSmartRoute('https://www.researchgate.net/publication/123456789_Study');
      expect(res).not.toBeNull();
      expect(res?.toolId).toBe('researchgate');
      expect(res?.route).toBe('#tool/researchgate');
      expect(res?.url).toBe('https://www.researchgate.net/publication/123456789_Study');
      expect(res?.autoStart).toBe(true);
    });

    it('app.js contains ?url= auto-fill dispatcher hooks for academia and researchgate', () => {
      const appJs = fs.readFileSync(appJsPath, 'utf-8');
      expect(appJs).toMatch(/acUrlInput/);
      expect(appJs).toMatch(/rgUrlInput/);
      expect(appJs).toContain('window.__dsAlivePing');
      expect(appJs).toContain('window.__DS_APP_HYDRATED');
    });

    it('app.js handles replaced payload on ds:native-share-arrived when modal is open', () => {
      const appJs = fs.readFileSync(appJsPath, 'utf-8');
      expect(appJs).toContain('ds:native-share-arrived');
      // Must not silently bail out on shareTargetPanel when a new native share arrives
      expect(appJs).toMatch(/ds:native-share-arrived[\s\S]*?(?:peekPendingSharedPayload|openShareTargetModal)/);
    });
  });

  describe('4. Non-Blocking Onboarding & Profile Dot Indicator', () => {
    it('checkAndPromptOnboardingProfile skips modal auto-open during share / APK launch and flags header dot', () => {
      const appJs = fs.readFileSync(appJsPath, 'utf-8');
      expect(appJs).toContain('ds_profile_needs_onboarding');
      expect(appJs).toMatch(/checkAndPromptOnboardingProfile[\s\S]*?ds_profile_needs_onboarding/);
    });

    it('Header.js renders subtle indicator dot on profile button when onboarding is incomplete and dot flag is set', () => {
      // Set onboarding needed flag
      global.localStorage.setItem('ds_profile_needs_onboarding', '1');
      const headerHtml = renderHeader();

      expect(headerHtml).toContain('id="headerProfileDot"');
      expect(headerHtml).toContain('w-2 h-2 rounded-full bg-indigo-500');
      expect(headerHtml).toContain('ring-2 ring-white dark:ring-[#121215]');
      // Must not contain AI marketing buzzwords
      expect(headerHtml).not.toContain('Chưa hoàn tất');
      expect(headerHtml).not.toContain('(Khuyên dùng)');
    });

    it('index.html emergency boot watchdog checks !window.__DS_APP_HYDRATED within 7000ms', () => {
      const indexHtml = fs.readFileSync(indexPath, 'utf-8');
      expect(indexHtml).toMatch(/setTimeout\(\s*function\(\)\s*\{[\s\S]*?!window\.__DS_APP_HYDRATED[\s\S]*?\},?\s*7000\)/);
    });
  });
});
