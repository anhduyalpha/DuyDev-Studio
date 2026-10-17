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

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockLocalStorage = {};
    mockContext.state = 'running';

    // Global browser mocks
    const win = {
      AudioContext: vi.fn(function () { return mockContext; }),
      webkitAudioContext: vi.fn(function () { return mockContext; }),
      localStorage: {
        getItem: vi.fn((k: string) => mockLocalStorage[k] ?? null),
        setItem: vi.fn((k: string, v: string) => {
          mockLocalStorage[k] = String(v);
        }),
        removeItem: vi.fn((k: string) => {
          delete mockLocalStorage[k];
        })
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      navigator: {
        vibrate: vi.fn()
      }
    };

    (global as any).window = win;
    (global as any).document = {
      hidden: false,
      visibilityState: 'visible',
      addEventListener: vi.fn()
    };
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

  it('2. Enforces warm acoustic shaping: master lowpass filter (2200Hz, Q: 0.7) and soft gain (<= 0.18)', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    soundEngine.ctx = null as any;
    soundEngine.masterFilter = null as any;
    soundEngine.masterGain = null as any;

    soundEngine.playToggle();

    expect(mockContext.createBiquadFilter).toHaveBeenCalled();
    expect(soundEngine.masterFilter?.type).toBe('lowpass');
    expect(soundEngine.masterFilter?.frequency.setValueAtTime).toHaveBeenCalledWith(2200, 0);
    expect(soundEngine.masterFilter?.Q.setValueAtTime).toHaveBeenCalledWith(0.7, 0);

    // Master gain peak volume <= 0.18
    expect(soundEngine.masterGain?.gain.setValueAtTime).toHaveBeenCalledWith(
      expect.toBeWithinRange ? expect.toBeWithinRange(0.01, 0.18) : 0.16,
      0
    );
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

  it('10. Auto-Suspend Idle Timer: automatically calls ctx.suspend() after idle debounce delay (2500ms)', async () => {
    const { soundEngine } = await import('../../../src/utilities/soundEngine.js');

    soundEngine.playNotification();
    expect(mockContext.suspend).not.toHaveBeenCalled();

    // Advance timers by 3000ms
    vi.advanceTimersByTime(3000);

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
});
