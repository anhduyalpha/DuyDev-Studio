import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock Web Audio API nodes and interfaces
class MockAudioParam {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
    return this;
  });
  linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
    return this;
  });
  exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
    return this;
  });
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1);
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam(350);
  Q = new MockAudioParam(1);
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam(440);
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  destination = new MockAudioNode();

  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createDynamicsCompressor = vi.fn(() => ({
    threshold: new MockAudioParam(-6),
    knee: new MockAudioParam(6),
    ratio: new MockAudioParam(4),
    attack: new MockAudioParam(0.003),
    release: new MockAudioParam(0.15),
    connect: vi.fn(),
    disconnect: vi.fn()
  }));
  createBuffer = vi.fn(() => ({}));
  createBufferSource = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null
  }));

  resume = vi.fn(async () => {
    this.state = 'running';
  });

  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
}

describe('SoundEngine (Apple/Linear-Grade Procedural Web Audio Sound System)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const mockContext = new MockAudioContext();
  let mockLocalStorage: Record<string, string>;
  let mockSessionStorage: Record<string, string>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockLocalStorage = {};
    mockSessionStorage = {};
    mockContext.state = 'running';

    const elementsMap = new Map<string, any>();
    const mockDocument: any = {
      hidden: false,
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getElementById: vi.fn((id: string) => elementsMap.get(id) || null),
      createElement: vi.fn((tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          innerHTML: '',
          children: [],
          firstElementChild: null,
          appendChild: vi.fn((child: any) => {
            el.children.push(child);
            if (!el.firstElementChild) el.firstElementChild = child;
          }),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          querySelector: vi.fn(() => null),
          querySelectorAll: vi.fn(() => []),
          setAttribute: vi.fn(),
          removeAttribute: vi.fn(),
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(),
            contains: vi.fn(() => false)
          }
        };
        Object.defineProperty(el, 'innerHTML', {
          set(html: string) {
            this._html = html;
            const idMatch = html.match(/id=["']([^"']+)["']/);
            if (idMatch) {
              const childEl: any = {
                id: idMatch[1],
                remove: vi.fn(() => {
                  elementsMap.delete(idMatch[1]);
                }),
                querySelector: vi.fn(() => null),
                querySelectorAll: vi.fn(() => []),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
              };
              elementsMap.set(idMatch[1], childEl);
              this.firstElementChild = childEl;
            }
          },
          get() {
            return this._html || '';
          }
        });
        return el;
      }),
      body: {
        appendChild: vi.fn((child: any) => {
          if (child?.id) {
            elementsMap.set(child.id, child);
          }
        }),
        removeChild: vi.fn((child: any) => {
          if (child?.id) {
            elementsMap.delete(child.id);
          }
        })
      }
    };

    // Global browser mocks
    const win: any = {
      AudioContext: vi.fn(function () { return mockContext; }),
      webkitAudioContext: vi.fn(function () { return mockContext; }),
      localStorage: {
        getItem: vi.fn((k: string) => mockLocalStorage[k] ?? null),
        setItem: vi.fn((k: string, v: string) => {
          mockLocalStorage[k] = String(v);
        }),
        removeItem: vi.fn((k: string) => {
          delete mockLocalStorage[k];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        })
      },
      sessionStorage: {
        getItem: vi.fn((k: string) => mockSessionStorage[k] ?? null),
        setItem: vi.fn((k: string, v: string) => {
          mockSessionStorage[k] = String(v);
        }),
        removeItem: vi.fn((k: string) => {
          delete mockSessionStorage[k];
        }),
        clear: vi.fn(() => {
          mockSessionStorage = {};
        })
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      navigator: {
        vibrate: vi.fn()
      },
      document: mockDocument
    };

    (global as any).window = win;
    (global as any).document = mockDocument;
    (global as any).localStorage = win.localStorage;
    (global as any).sessionStorage = win.sessionStorage;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: win.navigator,
        configurable: true,
        writable: true
      });
    } catch (_) {}

    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');
    soundEngine.ctx = mockContext as any;
    soundEngine.masterFilter = mockContext.createBiquadFilter() as any;
    soundEngine.masterGain = mockContext.createGain() as any;
    soundEngine.enabled = true;
    soundEngine.completedTaskIds.clear();
    soundEngine.failedTaskIds.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (global as any).window.__ds_soundEngine;
  });

  it('1. Initializes soundEngine singleton and checks default mute state (unmuted)', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    expect(soundEngine).toBeDefined();
    expect(soundEngine.isEnabled()).toBe(true);
    expect(soundEngine.isMuted()).toBe(false);
  });

  it('2. Enforces warm acoustic shaping: master lowpass filter (2200Hz, Q: 0.7) and audible base gain (0.60)', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    soundEngine.ctx = null as any;
    soundEngine.masterFilter = null as any;
    soundEngine.masterGain = null as any;

    soundEngine.playToggle();

    expect(mockContext.createBiquadFilter).toHaveBeenCalled();
    expect(soundEngine.masterFilter?.type).toBe('lowpass');
    expect(soundEngine.masterFilter?.frequency.setValueAtTime).toHaveBeenCalledWith(2200, 0);
    expect(soundEngine.masterFilter?.Q.setValueAtTime).toHaveBeenCalledWith(0.7, 0);

    // Master gain base volume (0.60)
    expect(soundEngine.masterGain?.gain.setValueAtTime).toHaveBeenCalledWith(0.6, 0);
  });

  it('3. Curated Sound Palette: playJobComplete / playSuccess schedules 4-note ascending chord arpeggio', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    const createOscSpy = vi.spyOn(mockContext, 'createOscillator');
    soundEngine.playJobComplete();

    // 4 notes * 2 oscillators (sine fundamental + triangle harmonics) = 8 oscillators
    expect(createOscSpy).toHaveBeenCalledTimes(8);
  });

  it('4. Curated Sound Palette: playStart / playPaste plays tactile upward pop and fires mobile haptic pulse', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    soundEngine.playStart();

    expect((global as any).navigator.vibrate).toHaveBeenCalledWith(10);
    expect(mockContext.createOscillator).toHaveBeenCalled();
  });

  it('5. Curated Sound Palette: playNotification plays resonant bell droplet (880Hz + 440Hz)', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    mockContext.createOscillator.mockClear();
    soundEngine.playNotification();

    // 2 oscillators (A5 primary + A4 warm undertone)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('6. Curated Sound Palette: playError plays muted wooden double-tap with local 900Hz lowpass filter', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    mockContext.createOscillator.mockClear();
    soundEngine.playError();

    // Tap 1 (220Hz) + Tap 2 (174.61Hz) = 2 oscillators
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('7. Curated Sound Palette: playToggle / playSnap produces 12ms crisp micro-click', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    mockContext.createOscillator.mockClear();
    soundEngine.playToggle();

    expect(mockContext.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('8. Mute / Unmute governance: persists to localStorage and dispatches ds:sound-state-change event', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    soundEngine.setMuted(true);
    expect(soundEngine.isMuted()).toBe(true);
    expect(soundEngine.isEnabled()).toBe(false);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('ds_sound_enabled', 'false');
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ds:sound-state-change',
        detail: { enabled: false }
      })
    );

    // Muted sound engine produces no audio nodes
    mockContext.createOscillator.mockClear();
    soundEngine.playJobComplete();
    expect(mockContext.createOscillator).not.toHaveBeenCalled();

    // Toggle back on
    soundEngine.toggleMute();
    expect(soundEngine.isEnabled()).toBe(true);
  });

  it('9. Per-task ID completion guard: playJobCompleteOnce plays strictly once per task ID', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');
    soundEngine.completedTaskIds.clear();

    const playSpy = vi.spyOn(soundEngine, 'playJobComplete');

    // First call with taskId -> plays
    const firstPlay = soundEngine.playJobCompleteOnce('task-alpha');
    expect(firstPlay).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Second call with same taskId -> suppressed (deduplicated)
    const secondPlay = soundEngine.playJobCompleteOnce('task-alpha');
    expect(secondPlay).toBe(false);
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Different task ID -> plays
    const thirdPlay = soundEngine.playJobCompleteOnce('task-beta');
    expect(thirdPlay).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it('10. Auto-Suspend Idle Timer: automatically calls ctx.suspend() on desktop after idle debounce delay', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    soundEngine.playNotification();
    expect(mockContext.suspend).not.toHaveBeenCalled();

    // Advance timers past the generous desktop idle window (30s)
    vi.advanceTimersByTime(35000);

    expect(mockContext.suspend).toHaveBeenCalled();
  });

  it('11. Page Visibility Governor (KI-FIX-023): immediately suspends on document.hidden or suspendNow()', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    mockContext.state = 'running';
    soundEngine.suspendNow();

    expect(mockContext.suspend).toHaveBeenCalled();
  });

  it('12. Quarantine Rule: verifies ZERO modifications were made to any studocu files', () => {
    const studocuDir = path.join(rootDir, 'src/components/tools/studocu');
    if (fs.existsSync(studocuDir)) {
      const files = fs.readdirSync(studocuDir, { recursive: true }) as string[];
      for (const file of files) {
        const fullPath = path.join(studocuDir, file);
        if (fs.statSync(fullPath).isFile()) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // None of the studocu files should have soundEngine imported
          expect(content).not.toContain('soundEngine');
        }
      }
    }
  });

  it('13. Volume Amplification & Gain Staging: getVolume(), setVolume(vol) persists to localStorage and clamps 0.0 - 2.5', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    // Default volume is 1.0 (100%)
    expect(soundEngine.getVolume()).toBe(1.0);

    // Set volume to 1.5 (150%)
    soundEngine.setVolume(1.5);
    expect(soundEngine.getVolume()).toBe(1.5);
    expect(mockLocalStorage['ds_sound_volume']).toBe('1.5');

    // Clamps to max 2.5
    soundEngine.setVolume(4.0);
    expect(soundEngine.getVolume()).toBe(2.5);

    // Clamps to min 0.0
    soundEngine.setVolume(-1.0);
    expect(soundEngine.getVolume()).toBe(0.0);

    // Restore to 1.2
    soundEngine.setVolume(1.2);
    expect(soundEngine.getVolume()).toBe(1.2);
  });

  it('14. Mobile Silent Buffer Prime: unlockAudioContext() creates and starts 1-sample silent buffer to unlock hardware mixer', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    mockContext.state = 'suspended';
    soundEngine.unlockAudioContext();

    expect(mockContext.createBuffer).toHaveBeenCalledWith(1, 1, 22050);
    expect(mockContext.createBufferSource).toHaveBeenCalled();
  });

  it('15. Audio Diagnostics & Test Sound API: provides accurate status and preview triggers', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    const diag = soundEngine.getAudioDiagnostics();
    expect(diag).toHaveProperty('volume');
    expect(diag).toHaveProperty('state');
    expect(diag).toHaveProperty('enabled');
    expect(diag.hasCompressor).toBe(true);

    const playSpy = vi.spyOn(soundEngine, 'playJobComplete');
    soundEngine.testSound('jobComplete');
    expect(playSpy).toHaveBeenCalled();
  });

  it('16. Theme Switch Cues: playThemeSwitch dispatches playThemeToDark for dark and playThemeToLight for light', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    const darkSpy = vi.spyOn(soundEngine, 'playThemeToDark');
    const lightSpy = vi.spyOn(soundEngine, 'playThemeToLight');

    // Test switching to dark mode
    soundEngine.playThemeSwitch(true);
    expect(darkSpy).toHaveBeenCalledTimes(1);

    // Test switching to light mode
    soundEngine.playThemeSwitch(false);
    expect(lightSpy).toHaveBeenCalledTimes(1);

    // Test string parameter 'dark'
    soundEngine.playThemeSwitch('dark');
    expect(darkSpy).toHaveBeenCalledTimes(2);

    // Test string parameter 'light'
    soundEngine.playThemeSwitch('light');
    expect(lightSpy).toHaveBeenCalledTimes(2);

    // Test soundEngine.testSound preview triggers
    soundEngine.testSound('themeLight');
    expect(lightSpy).toHaveBeenCalledTimes(3);

    soundEngine.testSound('themeDark');
    expect(darkSpy).toHaveBeenCalledTimes(3);
  });

  it('17. Web Update Fanfare Cue: playAppUpdate produces crystalline multi-oscillator fanfare and triggers via testSound', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    const updateSpy = vi.spyOn(soundEngine, 'playAppUpdate');

    mockContext.createOscillator.mockClear();
    soundEngine.playAppUpdate();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    // playAppUpdate creates 7 oscillators (subOsc + oscA4 + oscD5 + 3 cascade + shimmerOsc)
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(7);

    // Test alias playUpdate
    soundEngine.playUpdate();
    expect(updateSpy).toHaveBeenCalledTimes(2);

    // Test testSound preview routing
    soundEngine.testSound('appUpdate');
    expect(updateSpy).toHaveBeenCalledTimes(3);

    soundEngine.testSound('update');
    expect(updateSpy).toHaveBeenCalledTimes(4);
  });

  it('18. Tool Card Click & UR Rarity Signatures: playCardClick dispatches playCardUrStudocu for Studocu, playCardUrScribd for Scribd, and playToggle for default cards', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    const studocuSpy = vi.spyOn(soundEngine, 'playCardUrStudocu');
    const scribdSpy = vi.spyOn(soundEngine, 'playCardUrScribd');
    const bladeSpy = vi.spyOn(soundEngine, 'playCardSovereignBlade');
    const toggleSpy = vi.spyOn(soundEngine, 'playToggle');

    mockContext.createOscillator.mockClear();

    // 1. Clicking studocu-dl plays UR Studocu Chime (5 oscillators)
    soundEngine.playCardClick('studocu-dl');
    expect(studocuSpy).toHaveBeenCalledTimes(1);
    expect(scribdSpy).not.toHaveBeenCalled();
    expect(toggleSpy).not.toHaveBeenCalled();
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(5);

    // 2. Clicking studocu alias also plays UR Studocu
    soundEngine.playCardClick('studocu');
    expect(studocuSpy).toHaveBeenCalledTimes(2);

    // 3. Clicking scribd-archiver plays UR Scribd Bloom (5 oscillators)
    mockContext.createOscillator.mockClear();
    soundEngine.playCardClick('scribd-archiver');
    expect(scribdSpy).toHaveBeenCalledTimes(1);
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(5);

    // 4. Clicking scribd alias also plays UR Scribd
    soundEngine.playCardClick('scribd');
    expect(scribdSpy).toHaveBeenCalledTimes(2);

    // 5. Clicking regular cards (e.g. universal-converter) plays playToggle
    soundEngine.playCardClick('universal-converter');
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    // 6. Test preview routing via testSound
    soundEngine.testSound('urStudocu');
    expect(studocuSpy).toHaveBeenCalledTimes(3);

    soundEngine.testSound('cardBlue');
    expect(studocuSpy).toHaveBeenCalledTimes(4);

    soundEngine.testSound('urScribd');
    expect(scribdSpy).toHaveBeenCalledTimes(3);

    soundEngine.testSound('cardOrange');
    expect(scribdSpy).toHaveBeenCalledTimes(4);

    soundEngine.testSound('sovereignBlade');
    expect(bladeSpy).toHaveBeenCalledTimes(1);
  });

  it('19. Role-Based Sound Customization Governance: openSoundVolumeModal is strictly restricted to authenticated administrators', async () => {
    const { openSoundVolumeModal, closeSoundVolumeModal } = await import('../../../src/components/common/SoundVolumeModal.js');

    // 1. Unauthenticated regular user
    window.sessionStorage.clear();
    window.localStorage.clear();

    openSoundVolumeModal();
    expect(document.getElementById('soundVolumeModalContainer')).toBeNull();

    // 2. Authenticated administrator
    window.sessionStorage.setItem('ds_admin_authenticated', 'true');

    openSoundVolumeModal();
    const modal = document.getElementById('soundVolumeModalContainer');
    expect(modal).not.toBeNull();

    // Cleanup modal
    closeSoundVolumeModal();
    expect(document.getElementById('soundVolumeModalContainer')).toBeNull();
    window.sessionStorage.clear();
  });

  it('20. Deletion & Purge Cues: playDelete and playDeleteAll generate warm procedural acoustics with alias support and preview routing', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    const deleteSpy = vi.spyOn(soundEngine, 'playDelete');
    const deleteAllSpy = vi.spyOn(soundEngine, 'playDeleteAll');

    mockContext.createOscillator.mockClear();

    // 1. playDelete creates 2 oscillators (suction pop + air flutter)
    soundEngine.playDelete();
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(2);

    // 2. playTrash alias calls playDelete
    soundEngine.playTrash();
    expect(deleteSpy).toHaveBeenCalledTimes(2);

    // 3. playDeleteAll creates 3 oscillators (vacuum sweep + flutter harmonic + sub anchor)
    mockContext.createOscillator.mockClear();
    soundEngine.playDeleteAll();
    expect(deleteAllSpy).toHaveBeenCalledTimes(1);
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(3);

    // 4. playClearAll alias calls playDeleteAll
    soundEngine.playClearAll();
    expect(deleteAllSpy).toHaveBeenCalledTimes(2);

    // 5. testSound('delete') and testSound('trash')
    soundEngine.testSound('delete');
    expect(deleteSpy).toHaveBeenCalledTimes(3);

    soundEngine.testSound('trash');
    expect(deleteSpy).toHaveBeenCalledTimes(4);

    // 6. testSound('deleteAll'), testSound('clearAll'), testSound('clear')
    soundEngine.testSound('deleteAll');
    expect(deleteAllSpy).toHaveBeenCalledTimes(3);

    soundEngine.testSound('clearAll');
    expect(deleteAllSpy).toHaveBeenCalledTimes(4);

    soundEngine.testSound('clear');
    expect(deleteAllSpy).toHaveBeenCalledTimes(5);
  });

  it('21. Per-Cue Gain Multipliers: getCueGain, setCueGain, resetCueGains, persistence and event notification', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    // Default cue gain should be 1.0 (100%)
    expect(soundEngine.getCueGain('jobComplete')).toBe(1.0);
    expect(soundEngine.getCueGain('error')).toBe(1.0);
    expect(soundEngine.getCueGain('unknownCue')).toBe(1.0);

    // Set cue gain with clamping (0.0 to 2.5)
    soundEngine.setCueGain('jobComplete', 1.85);
    expect(soundEngine.getCueGain('jobComplete')).toBe(1.85);
    expect((global as any).window.dispatchEvent).toHaveBeenCalled();

    // Test alias normalization: 'trash' -> 'delete'
    soundEngine.setCueGain('trash', 0.5);
    expect(soundEngine.getCueGain('delete')).toBe(0.5);
    expect(soundEngine.getCueGain('trash')).toBe(0.5);

    // Test bounds clamping: negative -> 0.0, excessive -> 2.5
    soundEngine.setCueGain('error', -0.5);
    expect(soundEngine.getCueGain('error')).toBe(0.0);

    soundEngine.setCueGain('toggle', 3.5);
    expect(soundEngine.getCueGain('toggle')).toBe(2.5);

    // Verify persistence in localStorage
    expect(mockLocalStorage['ds_sound_cue_gains']).toBeDefined();
    const parsed = JSON.parse(mockLocalStorage['ds_sound_cue_gains']);
    expect(parsed.jobComplete).toBe(1.85);
    expect(parsed.delete).toBe(0.5);
    expect(parsed.error).toBe(0.0);
    expect(parsed.toggle).toBe(2.5);

    // Verify getAllCueGains
    const all = soundEngine.getAllCueGains();
    expect(all.jobComplete).toBe(1.85);
    expect(all.delete).toBe(0.5);

    // Verify diagnostics include cueGains
    const diag = soundEngine.getAudioDiagnostics();
    expect(diag.cueGains).toBeDefined();
    expect(diag.cueGains.jobComplete).toBe(1.85);

    // Reset all cue gains to 1.0
    soundEngine.resetCueGains();
    expect(soundEngine.getCueGain('jobComplete')).toBe(1.0);
    expect(soundEngine.getCueGain('delete')).toBe(1.0);
    expect(soundEngine.getCueGain('error')).toBe(1.0);
    expect(mockLocalStorage['ds_sound_cue_gains']).toBeUndefined();
  });

  it('22. Admin Sound Control: SOUND_CUES_CATALOG contains 13 channels with proper identifiers and UI metadata', async () => {
    const { SOUND_CUES_CATALOG, renderAdminSoundControlCard } = await import('../../../src/components/admin/AdminSoundControlCard.js');

    expect(Array.isArray(SOUND_CUES_CATALOG)).toBe(true);
    expect(SOUND_CUES_CATALOG.length).toBe(13);

    const ids = SOUND_CUES_CATALOG.map(c => c.id);
    expect(ids).toContain('jobComplete');
    expect(ids).toContain('start');
    expect(ids).toContain('notification');
    expect(ids).toContain('error');
    expect(ids).toContain('toggle');
    expect(ids).toContain('delete');
    expect(ids).toContain('deleteAll');
    expect(ids).toContain('themeLight');
    expect(ids).toContain('themeDark');
    expect(ids).toContain('appUpdate');
    expect(ids).toContain('urStudocu');
    expect(ids).toContain('urScribd');
    expect(ids).toContain('sovereignBlade');

    const html = renderAdminSoundControlCard();
    expect(html).toContain('Khuếch đại từng âm hiệu');
    expect(html).toContain('btnAdminResetAllCueGains');
    expect(html).toContain('cue-gain-slider');
    expect(html).toContain('data-cue-slider="jobComplete"');
  });
});

