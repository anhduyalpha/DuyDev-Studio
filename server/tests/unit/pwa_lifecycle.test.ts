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
  getCurrentVersion,
  showUpdateCapsule
} from '../../../src/utilities/pwa.js';

describe('PWA Lifecycle & Skip-Waiting Protection Suite', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const swPath = path.join(rootDir, 'sw.js');
  const indexPath = path.join(rootDir, 'index.html');
  const swContent = fs.readFileSync(swPath, 'utf-8');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  describe('1. sw.js Architecture & Skip-Waiting Safety', () => {
    it('sw.js CACHE_NAME must be a valid versioned name', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
      expect(match).not.toBeNull();
      expect(match![1]).toMatch(/^duydev-studio-v\d+\.\d+$/);
    });

    it('sw.js install event must call self.skipWaiting() automatically for seamless deployment', () => {
      const installIdx = swContent.indexOf("addEventListener('install'");
      expect(installIdx).toBeGreaterThan(-1);
      const installBlock = swContent.slice(installIdx);
      const nextListenerIdx = installBlock.indexOf("addEventListener('activate'");
      const installBody = installBlock.slice(0, nextListenerIdx);
      expect(installBody).toContain('self.skipWaiting()');
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

    it('sw.js ASSETS_TO_PRECACHE must reference current version query for core assets', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]duydev-studio-v(\d+\.\d+)['"]/);
      const v = match ? match[1] : '20.0';
      expect(swContent).toContain(`'./src/styles/stitch-tokens.css?v=${v}'`);
      expect(swContent).toContain(`'./src/styles/studocu.css?v=${v}'`);
      expect(swContent).toContain(`'./src/styles/highlight-theme.css?v=${v}'`);
      expect(swContent).toContain(`'./src/app.js?v=${v}'`);
    });

    it('sw.js navigation handler must be Network-First with Cache Fallback to eliminate double loading', () => {
      expect(swContent).toContain("if (event.request.mode === 'navigate')");
      expect(swContent).toContain("fetch(event.request, { cache: 'no-cache' })");
      expect(swContent).toContain("cache.match(event.request, { ignoreSearch: true })");
    });
  });

  describe('2. Version Alignment between sw.js, pwa.js, and index.html', () => {
    it('CURRENT_PWA_VERSION in pwa.js must match CACHE_NAME in sw.js', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
      expect(CURRENT_PWA_VERSION).toBe(match![1]);
    });

    it('index.html must reference the matching version for all core css and script bundles', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]duydev-studio-v(\d+\.\d+)['"]/);
      const v = match ? match[1] : '20.0';
      expect(indexContent).toContain(`href="src/styles/stitch-tokens.css?v=${v}"`);
      expect(indexContent).toContain(`href="src/styles/studocu.css?v=${v}"`);
      expect(indexContent).toContain(`href="src/styles/highlight-theme.css?v=${v}"`);
      expect(indexContent).toContain(`src="src/app.js?v=${v}"`);
    });

    it('index.html fast-path share script must define search properly without ReferenceError', () => {
      expect(indexContent).toContain('const search = window.location.search || \'\';');
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
        matchMedia: () => ({ matches: false }),
        addEventListener: (evt: string, cb: Function) => {
          listeners[evt] = listeners[evt] || [];
          listeners[evt].push(cb);
        }
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

    it('controllerchange must NOT trigger reload when userRequestedReload is false (zero double loading)', () => {
      registerServiceWorker();
      expect(listeners['controllerchange']).toBeDefined();

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

      setUserRequestedReload(true);
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

    it('promptUserToApplyUpdate posts SKIP_WAITING immediately without toast prompt', async () => {
      const mockPostMessage = vi.fn();
      const mockWaitingWorker: any = { postMessage: mockPostMessage };

      const toastMod = await import('../../../src/utilities/toast.js');
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast');

      promptUserToApplyUpdate(mockWaitingWorker);

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(toastSpy).not.toHaveBeenCalled();

      toastSpy.mockRestore();
    });

    it('listenForWaitingWorker activates pre-existing waiting worker immediately without toast', async () => {
      const mockPostMessage = vi.fn();
      const mockReg: any = {
        waiting: { postMessage: mockPostMessage },
        addEventListener: vi.fn()
      };

      const toastMod = await import('../../../src/utilities/toast.js');
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast');

      listenForWaitingWorker(mockReg);

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(toastSpy).not.toHaveBeenCalled();
      toastSpy.mockRestore();
    });

    it('listenForWaitingWorker does not crash on first install without controller', async () => {
      (globalThis as any).navigator.serviceWorker.controller = null;
      const mockReg: any = {
        waiting: { postMessage: vi.fn() },
        addEventListener: vi.fn()
      };

      const toastMod = await import('../../../src/utilities/toast.js');
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast');

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

    it('listenForWaitingWorker monitors reg.installing and activates immediately upon install without toast', async () => {
      let stateChangeCb: Function | null = null;
      const mockPostMessage = vi.fn();
      const mockInstalling: any = {
        state: 'installing',
        postMessage: mockPostMessage,
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
      const toastSpy = vi.spyOn(toastMod, 'showActionableToast');

      listenForWaitingWorker(mockReg);
      expect(mockInstalling.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));

      // Simulate transition to installed
      mockInstalling.state = 'installed';
      expect(stateChangeCb).toBeTypeOf('function');
      stateChangeCb!();

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(toastSpy).not.toHaveBeenCalled();
      toastSpy.mockRestore();
    });

    it('controllerchange triggers reload even if lastReload occurred within 10s when user explicitly commanded reload', () => {
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

  describe('5. PWA Update Capsule & Interactive Refresh Flow', () => {
    let elementsById: Record<string, any>;
    let removeCalls: string[];
    let fakeDoc: any;
    let mockSessionStore: Record<string, string>;
    let mockLocalStore: Record<string, string>;
    let mockWin: any;

    let originalDocProp: any;
    let originalWinProp: any;
    let originalSession: any;
    let originalLocal: any;

    function createEl(tag: string): any {
      const el: any = {
        tagName: tag,
        id: '',
        innerHTML: '',
        style: {},
        listeners: {} as Record<string, Function[]>,
        setAttribute: vi.fn(),
        addEventListener: (evt: string, cb: Function) => {
          el.listeners[evt] = el.listeners[evt] || [];
          el.listeners[evt].push(cb);
        },
        trigger: (evt: string) => {
          (el.listeners[evt] || []).forEach((cb: Function) => cb());
        },
        remove: vi.fn(() => {
          if (el.id) removeCalls.push(el.id);
        }),
        querySelector: (selector: string) => {
          const cleanId = selector.replace(/^#/, '');
          return elementsById[cleanId] || null;
        }
      };
      return el;
    }

    beforeEach(() => {
      elementsById = {};
      removeCalls = [];
      mockSessionStore = {};
      mockLocalStore = {};

      fakeDoc = {
        body: {
          appendChild: vi.fn((el) => {
            if (el.id) elementsById[el.id] = el;
            if (el.innerHTML) {
              if (el.innerHTML.includes('id="ds-update-reload-btn"')) {
                const reloadBtn = createEl('button');
                reloadBtn.id = 'ds-update-reload-btn';
                elementsById['ds-update-reload-btn'] = reloadBtn;
              }
              if (el.innerHTML.includes('id="ds-update-dismiss-btn"')) {
                const dismissBtn = createEl('button');
                dismissBtn.id = 'ds-update-dismiss-btn';
                elementsById['ds-update-dismiss-btn'] = dismissBtn;
              }
            }
          })
        },
        createElement: (tag: string) => createEl(tag),
        getElementById: (id: string) => elementsById[id] || null
      };

      const mockSession = {
        getItem: vi.fn((k: string) => mockSessionStore[k] || null),
        setItem: vi.fn((k: string, v: string) => { mockSessionStore[k] = v; }),
        removeItem: vi.fn((k: string) => { delete mockSessionStore[k]; })
      };

      const mockLocal = {
        getItem: vi.fn((k: string) => mockLocalStore[k] || null),
        setItem: vi.fn((k: string, v: string) => { mockLocalStore[k] = v; }),
        removeItem: vi.fn((k: string) => { delete mockLocalStore[k]; })
      };

      mockWin = {
        location: { reload: vi.fn() },
        sessionStorage: mockSession,
        localStorage: mockLocal,
        document: fakeDoc
      };

      originalDocProp = Object.getOwnPropertyDescriptor(globalThis, 'document');
      originalWinProp = Object.getOwnPropertyDescriptor(globalThis, 'window');
      originalSession = (globalThis as any).sessionStorage;
      originalLocal = (globalThis as any).localStorage;

      Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true, writable: true });
      Object.defineProperty(globalThis, 'window', { value: mockWin, configurable: true, writable: true });
      (globalThis as any).sessionStorage = mockSession;
      (globalThis as any).localStorage = mockLocal;
      setUserRequestedReload(false);
    });

    afterEach(() => {
      if (originalDocProp) Object.defineProperty(globalThis, 'document', originalDocProp);
      else delete (globalThis as any).document;

      if (originalWinProp) Object.defineProperty(globalThis, 'window', originalWinProp);
      else delete (globalThis as any).window;

      (globalThis as any).sessionStorage = originalSession;
      (globalThis as any).localStorage = originalLocal;
    });

    it('showUpdateCapsule renders Sequoia glass pill with reload & dismiss buttons', () => {
      const mockWorker = { postMessage: vi.fn() };
      showUpdateCapsule(mockWorker as any);

      expect(fakeDoc.body.appendChild).toHaveBeenCalledTimes(1);
      const capsule = elementsById['ds-update-capsule'];
      expect(capsule).toBeDefined();
      expect(capsule.innerHTML).toContain('Đã có bản cập nhật mới');
      expect(capsule.innerHTML).toContain('Làm mới');
      expect(capsule.innerHTML).toContain('✕');
    });

    it('showUpdateCapsule respects sessionStorage dismissal', () => {
      mockSessionStore['ds_update_capsule_dismissed'] = 'true';

      showUpdateCapsule(null);
      expect(fakeDoc.body.appendChild).not.toHaveBeenCalled();
    });

    it('clicking [Làm mới] sets userRequestedReload, sends SKIP_WAITING to waiting worker and removes capsule', () => {
      const mockWorker = { postMessage: vi.fn() };
      showUpdateCapsule(mockWorker as any);

      const reloadBtn = elementsById['ds-update-reload-btn'];
      expect(reloadBtn).toBeDefined();

      reloadBtn.trigger('click');

      expect(getUserRequestedReload()).toBe(true);
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(removeCalls).toContain('ds-update-capsule');
    });

    it('clicking [Làm mới] is blocked when in-flight tasks exist', () => {
      mockWin.__ds_taskCoordinator = {
        getActiveTasks: () => [{ id: 'active-1' }]
      };

      const mockWorker = { postMessage: vi.fn() };
      showUpdateCapsule(mockWorker as any);

      const reloadBtn = elementsById['ds-update-reload-btn'];
      reloadBtn.trigger('click');

      expect(getUserRequestedReload()).toBe(false);
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
      expect(removeCalls).not.toContain('ds-update-capsule');
    });

    it('clicking [Làm mới] is blocked when ds_studocu_active_job is active in localStorage', () => {
      mockLocalStore['ds_studocu_active_job'] = 'job-active-doc';

      const mockWorker = { postMessage: vi.fn() };
      showUpdateCapsule(mockWorker as any);

      const reloadBtn = elementsById['ds-update-reload-btn'];
      reloadBtn.trigger('click');

      expect(getUserRequestedReload()).toBe(false);
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
      expect(removeCalls).not.toContain('ds-update-capsule');
    });

    it('clicking [✕] sets ds_update_capsule_dismissed in sessionStorage and removes capsule', () => {
      showUpdateCapsule(null);

      const dismissBtn = elementsById['ds-update-dismiss-btn'];
      expect(dismissBtn).toBeDefined();

      dismissBtn.trigger('click');

      expect(mockSessionStore['ds_update_capsule_dismissed']).toBe('true');
      expect(removeCalls).toContain('ds-update-capsule');
    });

    it('showUpdateCapsule does not render duplicates if capsule is already mounted', () => {
      showUpdateCapsule(null);
      expect(fakeDoc.body.appendChild).toHaveBeenCalledTimes(1);

      showUpdateCapsule(null);
      expect(fakeDoc.body.appendChild).toHaveBeenCalledTimes(1);
    });
  });
});
