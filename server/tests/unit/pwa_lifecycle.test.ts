import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CURRENT_PWA_VERSION,
  getUserRequestedReload,
  setUserRequestedReload,
  resetUpdateToastShown,
  promptUserToApplyUpdate,
  listenForWaitingWorker,
  registerServiceWorker,
  checkForAppUpdate,
  getCurrentVersion
} from '../../../src/utilities/pwa.js';

describe('PWA Lifecycle & Skip-Waiting Protection Suite', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const swPath = path.join(rootDir, 'sw.js');
  const indexPath = path.join(rootDir, 'index.html');
  const swContent = fs.readFileSync(swPath, 'utf-8');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  describe('1. sw.js Architecture & Skip-Waiting Safety', () => {
    it('sw.js CACHE_NAME must be duydev-studio-v18.9', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('duydev-studio-v18.9');
    });

    it('sw.js install event must NOT call self.skipWaiting() automatically', () => {
      const installIdx = swContent.indexOf("addEventListener('install'");
      expect(installIdx).toBeGreaterThan(-1);
      const installBlock = swContent.slice(installIdx);
      const nextListenerIdx = installBlock.indexOf("addEventListener('activate'");
      const installBody = installBlock.slice(0, nextListenerIdx);
      expect(installBody).not.toContain('self.skipWaiting()');
    });

    it('sw.js message handler must listen for SKIP_WAITING and call self.skipWaiting()', () => {
      const messageIdx = swContent.indexOf("addEventListener('message'");
      expect(messageIdx).toBeGreaterThan(-1);
      const messageBlock = swContent.slice(messageIdx);
      const nextListenerIdx = messageBlock.indexOf("addEventListener('install'");
      const messageBody = messageBlock.slice(0, nextListenerIdx);
      expect(messageBody).toContain("event.data?.type === 'SKIP_WAITING'");
      expect(messageBody).toContain('self.skipWaiting()');
    });

    it('sw.js ASSETS_TO_PRECACHE must reference v18.9 query versions for core assets', () => {
      expect(swContent).toContain("'./src/styles/stitch-tokens.css?v=18.9'");
      expect(swContent).toContain("'./src/styles/studocu.css?v=18.9'");
      expect(swContent).toContain("'./src/styles/highlight-theme.css?v=18.9'");
      expect(swContent).toContain("'./src/app.js?v=18.9'");
      expect(swContent).not.toContain("?v=18.8");
    });
  });

  describe('2. Version Alignment between sw.js, pwa.js, and index.html', () => {
    it('CURRENT_PWA_VERSION in pwa.js must match CACHE_NAME in sw.js', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
      expect(CURRENT_PWA_VERSION).toBe(match![1]);
      expect(CURRENT_PWA_VERSION).toBe('duydev-studio-v18.9');
    });

    it('index.html must reference v18.9 for all core css and script bundles', () => {
      expect(indexContent).toContain('href="src/styles/stitch-tokens.css?v=18.9"');
      expect(indexContent).toContain('href="src/styles/studocu.css?v=18.9"');
      expect(indexContent).toContain('href="src/styles/highlight-theme.css?v=18.9"');
      expect(indexContent).toContain('src="src/app.js?v=18.9"');

      // Stale versions must not remain on core files
      expect(indexContent).not.toContain('href="src/styles/stitch-tokens.css?v=17.4"');
      expect(indexContent).not.toContain('href="src/styles/studocu.css?v=17.4"');
      expect(indexContent).not.toContain('href="src/styles/highlight-theme.css?v=17.4"');
      expect(indexContent).not.toContain('src="src/app.js?v=18.0"');
    });
  });

  describe('3. pwa.js Update Flow & Controlled Reload Logic', () => {
    const originalNavigatorProp = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalWindowProp = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalDocumentProp = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const originalSessionStorage = (globalThis as any).sessionStorage;
    const originalLocalStorage = (globalThis as any).localStorage;

    let reloadMock: ReturnType<typeof vi.fn>;
    let listeners: Record<string, Function[]> = {};

    beforeEach(() => {
      setUserRequestedReload(false);
      resetUpdateToastShown();
      listeners = {};

      reloadMock = vi.fn();

      const mockSessionStore: Record<string, string> = {};
      const mockLocalStore: Record<string, string> = {};

      const mockSession = {
        getItem: (k: string) => mockSessionStore[k] || null,
        setItem: (k: string, v: string) => { mockSessionStore[k] = v; },
        removeItem: (k: string) => { delete mockSessionStore[k]; }
      };

      const mockLocal = {
        getItem: (k: string) => mockLocalStore[k] || null,
        setItem: (k: string, v: string) => { mockLocalStore[k] = v; },
        removeItem: (k: string) => { delete mockLocalStore[k]; }
      };

      (globalThis as any).sessionStorage = mockSession;
      (globalThis as any).localStorage = mockLocal;

      const mockDoc = {
        readyState: 'complete',
        addEventListener: (evt: string, cb: Function) => {
          listeners[evt] = listeners[evt] || [];
          listeners[evt].push(cb);
        }
      };

      const mockWin = {
        location: { reload: reloadMock },
        sessionStorage: mockSession,
        localStorage: mockLocal,
        document: mockDoc,
        matchMedia: () => ({ matches: false })
      };

      const mockNav = {
        serviceWorker: {
          controller: { state: 'activated' } as any,
          addEventListener: (evt: string, cb: Function) => {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(cb);
          },
          register: vi.fn().mockResolvedValue({
            scope: '/',
            waiting: null,
            installing: null,
            update: vi.fn().mockResolvedValue(undefined),
            addEventListener: vi.fn()
          })
        }
      };

      Object.defineProperty(globalThis, 'window', {
        value: mockWin,
        configurable: true,
        writable: true
      });

      Object.defineProperty(globalThis, 'document', {
        value: mockDoc,
        configurable: true,
        writable: true
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: mockNav,
        configurable: true,
        writable: true
      });
    });

    afterEach(() => {
      if (originalNavigatorProp) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorProp);
      } else {
        delete (globalThis as any).navigator;
      }

      if (originalWindowProp) {
        Object.defineProperty(globalThis, 'window', originalWindowProp);
      } else {
        delete (globalThis as any).window;
      }

      if (originalDocumentProp) {
        Object.defineProperty(globalThis, 'document', originalDocumentProp);
      } else {
        delete (globalThis as any).document;
      }

      (globalThis as any).sessionStorage = originalSessionStorage;
      (globalThis as any).localStorage = originalLocalStorage;
    });

    it('controllerchange must NOT trigger reload when userRequestedReload is false', () => {
      registerServiceWorker();
      expect(listeners['controllerchange']).toBeDefined();

      // Trigger controllerchange without user confirmation
      const controllerChangeCb = listeners['controllerchange'][0];
      controllerChangeCb();

      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('controllerchange must trigger safe reload when userRequestedReload is true', () => {
      registerServiceWorker();
      expect(listeners['controllerchange']).toBeDefined();

      setUserRequestedReload(true);
      const controllerChangeCb = listeners['controllerchange'][0];
      controllerChangeCb();

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('controllerchange must NOT reload if there was no prior controller (first install)', () => {
      // First visit: no controller present prior to registration
      (globalThis as any).navigator.serviceWorker.controller = null;
      registerServiceWorker();

      setUserRequestedReload(true); // even if true
      const controllerChangeCb = listeners['controllerchange'][0];
      controllerChangeCb();

      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('controllerchange must NOT reload if in-flight tasks or active jobs exist', () => {
      registerServiceWorker();
      setUserRequestedReload(true);

      // Active task coordinator check
      (globalThis as any).window.__ds_taskCoordinator = {
        getActiveTasks: () => [{ id: 'task-1', running: true }]
      };

      const controllerChangeCb = listeners['controllerchange'][0];
      controllerChangeCb();
      expect(reloadMock).not.toHaveBeenCalled();

      // Active studocu job check
      delete (globalThis as any).window.__ds_taskCoordinator;
      (globalThis as any).localStorage.setItem('ds_studocu_active_job', 'job-999');
      controllerChangeCb();
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('promptUserToApplyUpdate posts SKIP_WAITING when action is triggered', async () => {
      const mockPostMessage = vi.fn();
      const mockWaitingWorker: any = { postMessage: mockPostMessage };

      // Spy on showActionableToast from toast.js
      const toastMod = await import('../../../src/utilities/toast.js');
      let capturedOnAction: (() => void) | null = null;
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast').mockImplementation((_msg, opts: any) => {
        capturedOnAction = opts?.onAction;
      });

      promptUserToApplyUpdate(mockWaitingWorker);

      // Allow dynamic import to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(toastSpy).toHaveBeenCalledWith(
        'Đã có bản cập nhật mới',
        expect.objectContaining({
          type: 'info',
          actionText: 'Cập nhật'
        })
      );
      expect(getUserRequestedReload()).toBe(false);

      // User clicks "Cập nhật" action
      expect(capturedOnAction).toBeTypeOf('function');
      capturedOnAction!();

      expect(getUserRequestedReload()).toBe(true);
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

      toastSpy.mockRestore();
    });

    it('listenForWaitingWorker handles pre-existing waiting worker', async () => {
      const mockPostMessage = vi.fn();
      const mockReg: any = {
        waiting: { postMessage: mockPostMessage },
        addEventListener: vi.fn()
      };

      const toastMod = await import('../../../src/utilities/toast.js');
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast').mockImplementation(() => {});

      listenForWaitingWorker(mockReg);
      await new Promise((r) => setTimeout(r, 50));

      expect(toastSpy).toHaveBeenCalled();
      toastSpy.mockRestore();
    });

    it('listenForWaitingWorker does not prompt on first install without controller', async () => {
      (globalThis as any).navigator.serviceWorker.controller = null;
      const mockReg: any = {
        waiting: { postMessage: vi.fn() },
        addEventListener: vi.fn()
      };

      const toastMod = await import('../../../src/utilities/toast.js');
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast').mockImplementation(() => {});

      listenForWaitingWorker(mockReg);
      await new Promise((r) => setTimeout(r, 50));

      expect(toastSpy).not.toHaveBeenCalled();
      toastSpy.mockRestore();
    });

    it('listenForWaitingWorker STILL registers updatefound listener even if reg.waiting is present', async () => {
      const mockPostMessage = vi.fn();
      const mockAddEventListener = vi.fn();
      const mockReg: any = {
        waiting: { postMessage: mockPostMessage },
        addEventListener: mockAddEventListener
      };

      listenForWaitingWorker(mockReg);
      expect(mockAddEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function));
    });

    it('listenForWaitingWorker monitors reg.installing if already present during registration', async () => {
      let stateChangeCb: Function | null = null;
      const mockInstalling: any = {
        state: 'installing',
        addEventListener: vi.fn((evt: string, cb: Function) => {
          if (evt === 'statechange') stateChangeCb = cb;
        })
      };
      const mockReg: any = {
        waiting: null,
        installing: mockInstalling,
        addEventListener: vi.fn()
      };

      const toastMod = await import('../../../src/utilities/toast.js');
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast').mockImplementation(() => {});

      listenForWaitingWorker(mockReg);
      expect(mockInstalling.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));

      // Simulate transition to installed
      mockInstalling.state = 'installed';
      expect(stateChangeCb).toBeTypeOf('function');
      stateChangeCb!();

      await new Promise((r) => setTimeout(r, 50));
      expect(toastSpy).toHaveBeenCalled();
      toastSpy.mockRestore();
    });

    it('controllerchange triggers reload even if lastReload occurred within 10s when user explicitly requested reload', () => {
      registerServiceWorker();
      setUserRequestedReload(true);

      // Simulate a recent reload 2 seconds ago
      (globalThis as any).sessionStorage.setItem('ds_sw_just_reloaded', String(Date.now() - 2000));

      const controllerChangeCb = listeners['controllerchange'][0];
      controllerChangeCb();

      // Must NOT be blocked by 10s cooldown because user explicitly commanded the reload
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it('getCurrentVersion returns CURRENT_PWA_VERSION if present or newest version from cache keys', async () => {
      // Mock CacheStorage with multiple versions
      (globalThis as any).caches = {
        keys: vi.fn().mockResolvedValue(['duydev-studio-v17.4', 'duydev-studio-v18.7', 'duydev-studio-v18.8'])
      };

      const ver1 = await getCurrentVersion();
      expect(ver1).toBe('duydev-studio-v18.8');

      // When CURRENT_PWA_VERSION not yet present, returns newest
      (globalThis as any).caches = {
        keys: vi.fn().mockResolvedValue(['duydev-studio-v16.0', 'duydev-studio-v17.4', 'duydev-studio-v18.7'])
      };

      const ver2 = await getCurrentVersion();
      expect(ver2).toBe('duydev-studio-v18.7');
    });
  });

  describe('4. checkForAppUpdate Cache Invariant', () => {
    it('checkForAppUpdate must NOT clear caches synchronously during update check', () => {
      const pwaFileContent = fs.readFileSync(path.join(rootDir, 'src/utilities/pwa.js'), 'utf-8');
      const checkUpdateMatch = pwaFileContent.match(/export async function checkForAppUpdate\(\)\s*\{([\s\S]*?)\n\}/);
      expect(checkUpdateMatch).not.toBeNull();
      const body = checkUpdateMatch![1];

      // Must not delete cache keys inside checkForAppUpdate
      expect(body).not.toMatch(/caches\.delete/);
    });
  });
});
