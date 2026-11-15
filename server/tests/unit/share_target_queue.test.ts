import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  peekPendingSharedPayload,
  consumePendingSharedPayload,
  _clearConsumedPayloadCache
} from '../../../src/utilities/shareTargetHelper.js';
import { detectSmartRoute } from '../../../src/utilities/smartUrlRouter.js';
import { renderHeader } from '../../../src/components/layout/Header.js';

describe('Task 1.2 — Atomic Share Queue, Hydration Watchdog & Non-Blocking Onboarding', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const appJsPath = path.join(rootDir, 'src/app.js');
  const indexPath = path.join(rootDir, 'index.html');
  const shareModalPath = path.join(rootDir, 'src/components/common/ShareTargetModal.js');
  const mainActivityPath = path.join(rootDir, 'android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt');

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

    _clearConsumedPayloadCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.window = originalWindow;
    global.document = originalDocument;
    global.localStorage = originalLocalStorage;
    global.sessionStorage = originalSessionStorage;
    vi.restoreAllMocks();
    _clearConsumedPayloadCache();
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

  describe('2. Idempotent consumePendingSharedPayload(payloadId) & Bounded Cache', () => {
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

    it('re-sharing the exact same URL with a fresh payloadId/timestamp succeeds immediately and calls clearSharedPayload() a second time', async () => {
      const clearMock = vi.fn();
      const sharedUrl = 'https://www.academia.edu/55555/sample-article';

      let currentPayload: any = {
        payloadId: 'sp_1700000000000_1111',
        timestamp: 1700000000000,
        url: sharedUrl,
        title: 'Article 1'
      };

      // @ts-ignore
      global.window = {
        AndroidBridge: {
          getSharedPayload: vi.fn(() => (currentPayload ? JSON.stringify(currentPayload) : '')),
          clearSharedPayload: vi.fn(() => {
            clearMock();
            currentPayload = null;
          })
        }
      };

      // Share 1: peek and consume
      const peek1 = await peekPendingSharedPayload();
      expect(peek1).not.toBeNull();
      expect(peek1?.payloadId).toBe('sp_1700000000000_1111');
      const consume1 = await consumePendingSharedPayload(peek1!.payloadId);
      expect(consume1).not.toBeNull();
      expect(clearMock).toHaveBeenCalledTimes(1);

      // Share 2: user re-shares the exact same URL from Android (within <1s) with fresh payloadId
      currentPayload = {
        payloadId: 'sp_1700000000500_2222',
        timestamp: 1700000000500,
        url: sharedUrl,
        title: 'Article 1'
      };

      const peek2 = await peekPendingSharedPayload();
      expect(peek2).not.toBeNull();
      expect(peek2?.payloadId).toBe('sp_1700000000500_2222');
      const consume2 = await consumePendingSharedPayload(peek2!.payloadId);
      expect(consume2).not.toBeNull();
      expect(clearMock).toHaveBeenCalledTimes(2);
    });

    it('re-sharing the exact same URL without payloadId/timestamp after the dedup TTL window succeeds instead of being permanently dropped', async () => {
      vi.useFakeTimers();
      const clearMock = vi.fn();
      const sharedUrl = 'https://www.tiktok.com/@creator/video/123456789';

      let currentPayload: any = {
        url: sharedUrl,
        text: 'Check this video'
      };

      // @ts-ignore
      global.window = {
        AndroidBridge: {
          getSharedPayload: vi.fn(() => (currentPayload ? JSON.stringify(currentPayload) : '')),
          clearSharedPayload: vi.fn(() => {
            clearMock();
            currentPayload = null;
          })
        }
      };

      // Share 1: peek and consume
      const peek1 = await peekPendingSharedPayload();
      expect(peek1).not.toBeNull();
      const consume1 = await consumePendingSharedPayload(peek1!.payloadId);
      expect(consume1).not.toBeNull();
      expect(clearMock).toHaveBeenCalledTimes(1);

      // Duplicate immediate arrival with same deterministic key within <10s is blocked
      currentPayload = { url: sharedUrl, text: 'Check this video' };
      const peekDuplicate = await peekPendingSharedPayload();
      expect(peekDuplicate).toBeNull();

      // Advance time beyond the 10s TTL window
      vi.advanceTimersByTime(11000);

      // After TTL window, re-sharing the exact same payload succeeds
      const peekAfterTtl = await peekPendingSharedPayload();
      expect(peekAfterTtl).not.toBeNull();
      const consumeAfterTtl = await consumePendingSharedPayload(peekAfterTtl!.payloadId);
      expect(consumeAfterTtl).not.toBeNull();
      expect(clearMock).toHaveBeenCalledTimes(2);
    });

    it('MainActivity.kt builds share JSON with per-intent timestamp and random payloadId', () => {
      const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');
      expect(mainActivityContent).toContain('val now = System.currentTimeMillis()');
      expect(mainActivityContent).toContain('put("timestamp", now)');
      expect(mainActivityContent).toContain('put("payloadId", "sp_${now}_');
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

    it('ShareTargetModal.js passes canonical #tool/academia and #tool/researchgate to handoffSmartUrl', () => {
      const shareModalContent = fs.readFileSync(shareModalPath, 'utf-8');
      expect(shareModalContent).toContain("handoffSmartUrl({ toolId: 'academia', route: '#tool/academia'");
      expect(shareModalContent).toContain("handoffSmartUrl({ toolId: 'researchgate', route: '#tool/researchgate'");
      expect(shareModalContent).toContain("case '#tool/academia-downloader':");
      expect(shareModalContent).toContain("case '#tool/researchgate-downloader':");
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
