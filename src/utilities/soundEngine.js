/**
 * DuyDev Studio - Procedural Acoustic Sound Engine (`SoundEngine.js`)
 * 
 * Apple / Linear-Grade Procedural Web Audio Sound System
 * Zero-Asset, Warm Acoustic Shaping with Zero-Battery Idle Governance (KI-FIX-023 Compliance)
 * 
 * Timbre Design:
 * - Master Biquad lowpass filtering (2200Hz, Q: 0.7) eliminates digital harshness
 * - Smooth attack (8ms-15ms) prevents click/pop artifacts
 * - Exponential decay curves model natural acoustic dissipation
 * 
 * Power & Autoplay Governance:
 * - Lazy Gesture Unlock: AudioContext instantiates/resumes only on valid user interactions
 * - Auto-Suspend: 2500ms after last scheduled note ends, calls audioCtx.suspend()
 * - Page Visibility Governor: Suspends immediately on document.hidden, ds:visibility-change,
 *   or ds:native-app-paused to release OS audio mixer threads (0% battery drain in background).
 */

const STORAGE_KEY = 'ds_sound_enabled';
const IDLE_SUSPEND_DELAY_MS = 2500;

class SoundEngine {
  constructor() {
    if (typeof window !== 'undefined' && window.__ds_soundEngine) {
      return window.__ds_soundEngine;
    }

    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {BiquadFilterNode|null} */
    this.masterFilter = null;
    /** @type {GainNode|null} */
    this.masterGain = null;

    /** @type {boolean} */
    this.unlocked = false;
    /** @type {number|null} */
    this.idleTimer = null;
    /** @type {number} */
    this.lastScheduledEndTime = 0;

    /** @type {Set<string>} */
    this.completedTaskIds = new Set();
    /** @type {Set<string>} */
    this.failedTaskIds = new Set();

    // Load initial mute state from localStorage (default: enabled / unmuted)
    this.enabled = true;
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      this.enabled = stored === null ? true : stored === 'true';
    }

    if (typeof window !== 'undefined') {
      window.__ds_soundEngine = this;
      this._bindLifecycleGovernance();
    }
  }

  /**
   * Binds user interaction gesture unlocks and page visibility lifecycle governors.
   * @private
   */
  _bindLifecycleGovernance() {
    if (typeof window === 'undefined') return;

    // 1. Lazy Gesture Unlock: register one-time pointer/keyboard listeners
    const unlockHandler = () => {
      this.unlockAudioContext();
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
    };

    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });

    // 2. KI-FIX-023 Page Visibility & Native App Lifecycle Governor
    const suspendHandler = () => {
      this.suspendNow();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        suspendHandler();
      }
    });

    window.addEventListener('ds:visibility-change', (e) => {
      if (e.detail?.hidden) {
        suspendHandler();
      }
    });

    window.addEventListener('ds:native-app-paused', suspendHandler);
  }

  /**
   * Unlocks the Web Audio AudioContext upon genuine user interaction.
   */
  unlockAudioContext() {
    if (this.unlocked && this.ctx && this.ctx.state === 'running') return;
    this.unlocked = true;
    const ctx = this._ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Lazy-initializes the AudioContext, master low-pass filter and master gain stage.
   * @private
   * @returns {AudioContext|null}
   */
  _ensureContext() {
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioContextClass();

        // Master Low-pass Filter (Warm acoustic shaping, 2200Hz, Q: 0.7)
        this.masterFilter = this.ctx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
        this.masterFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

        // Master Gain Stage (Gentle volume <= 0.18 peak)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.16, this.ctx.currentTime);

        // Route: Nodes -> masterGain -> masterFilter -> destination
        this.masterGain.connect(this.masterFilter);
        this.masterFilter.connect(this.ctx.destination);
      } catch (err) {
        console.warn('[SoundEngine] Failed to initialize AudioContext:', err);
        return null;
      }
    }

    return this.ctx;
  }

  /**
   * Schedules an automatic suspend after sounds finish playing to release OS audio threads.
   * @private
   * @param {number} durationSec Sound duration in seconds
   */
  _scheduleIdleSuspend(durationSec = 0.5) {
    if (!this.ctx) return;

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const waitMs = Math.max(100, Math.round(durationSec * 1000) + IDLE_SUSPEND_DELAY_MS);
    this.idleTimer = setTimeout(() => {
      this.suspendNow();
    }, waitMs);
  }

  /**
   * Immediately suspends AudioContext and cleans up idle timers (0% battery drain).
   */
  suspendNow() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.suspend().catch(() => {});
      } catch (_) {}
    }
  }

  /**
   * Resumes AudioContext safely if needed before playing a scheduled sound.
   * @private
   * @returns {AudioContext|null}
   */
  _prepareForPlayback() {
    if (!this.enabled) return null;
    if (typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden')) {
      return null;
    }

    const ctx = this._ensureContext();
    if (!ctx) return null;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // =========================================================================
  // Preference & Mute State Governance
  // =========================================================================

  /**
   * Returns whether sound is currently enabled.
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Returns whether sound is currently muted.
   * @returns {boolean}
   */
  isMuted() {
    return !this.enabled;
  }

  /**
   * Sets mute state and persists to localStorage.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.enabled = !muted;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(this.enabled));
      } catch (_) {}
    }
    if (muted) {
      this.suspendNow();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ds:sound-state-change', { detail: { enabled: this.enabled } }));
    }
  }

  /**
   * Toggles sound on/off and returns the new enabled state.
   * @returns {boolean}
   */
  toggleMute() {
    this.setMuted(this.enabled);
    return this.enabled;
  }

  // =========================================================================
  // Curated Signature Sound Palette (6 Distinct Procedural Cues)
  // =========================================================================

  /**
   * Cue 1: `playSuccess()` / `playJobComplete()` (Flagship Job Done Chime)
   * A lush, ascending 4-note warm glass chord arpeggio:
   * C5 [523.25Hz] -> E5 [659.25Hz] -> G5 [783.99Hz] -> B5 [987.77Hz] staggered by 65ms
   * Layered sine + soft octave triangle harmonics with a 650ms silky tail.
   */
  playJobComplete() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0.000 }, // C5
      { freq: 659.25, time: 0.065 }, // E5
      { freq: 783.99, time: 0.130 }, // G5
      { freq: 987.77, time: 0.195 }  // B5
    ];
    const tailSec = 0.650;

    notes.forEach((note) => {
      const noteStart = now + note.time;
      const noteStop = noteStart + tailSec;

      // Note Gain with smooth 12ms attack & silky exponential decay
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.linearRampToValueAtTime(0.14, noteStart + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStop);
      noteGain.connect(this.masterGain);

      // Primary Glass Body (Pure Sine)
      const oscPrimary = ctx.createOscillator();
      oscPrimary.type = 'sine';
      oscPrimary.frequency.setValueAtTime(note.freq, noteStart);
      oscPrimary.connect(noteGain);

      // Warm Octave Harmonics (Soft Triangle)
      const oscHarmonic = ctx.createOscillator();
      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(note.freq, noteStart);

      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(0.035, noteStart);
      oscHarmonic.connect(harmGain);
      harmGain.connect(noteGain);

      oscPrimary.start(noteStart);
      oscHarmonic.start(noteStart);

      oscPrimary.stop(noteStop);
      oscHarmonic.stop(noteStop);

      oscPrimary.onended = () => {
        try {
          oscPrimary.disconnect();
          oscHarmonic.disconnect();
          harmGain.disconnect();
          noteGain.disconnect();
        } catch (_) {}
      };
    });

    const totalDuration = 0.195 + tailSec;
    this._scheduleIdleSuspend(totalDuration);
  }

  /**
   * Alias for playJobComplete
   */
  playSuccess() {
    this.playJobComplete();
  }

  /**
   * Plays job complete chime strictly once per task ID.
   * @param {string} [taskId]
   * @returns {boolean} Whether the chime was played
   */
  playJobCompleteOnce(taskId) {
    if (taskId) {
      if (this.completedTaskIds.has(taskId)) return false;
      this.completedTaskIds.add(taskId);
    }
    this.playJobComplete();
    return true;
  }

  /**
   * Plays error alert strictly once per task ID.
   * @param {string} [taskId]
   * @returns {boolean} Whether the alert was played
   */
  playErrorOnce(taskId) {
    if (taskId) {
      if (this.failedTaskIds.has(taskId)) return false;
      this.failedTaskIds.add(taskId);
    }
    this.playError();
    return true;
  }

  /**
   * Cue 2: `playStart()` / `playPaste()` (Task Initiated / Smart Paste)
   * Soft, tactile upward woodblock/water-drop pop:
   * 320Hz -> 580Hz pitch envelope over 75ms with subtle mobile haptic pulse.
   */
  playStart() {
    const ctx = this._prepareForPlayback();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch (_) {}
    }
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.085;
    const stopTime = now + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.connect(this.masterGain);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.075);
    osc.connect(gain);

    osc.start(now);
    osc.stop(stopTime);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Alias for playStart
   */
  playPaste() {
    this.playStart();
  }

  /**
   * Cue 3: `playNotification()` (Subtle Toast / Info)
   * A gentle, single resonant bell droplet:
   * A5 [880Hz] with a soft 440Hz warm undertone, 280ms decay.
   */
  playNotification() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.280;
    const stopTime = now + duration;

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(0.12, now + 0.008);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    noteGain.connect(this.masterGain);

    // Primary Bell Droplet (A5 = 880Hz)
    const bellOsc = ctx.createOscillator();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(880, now);
    bellOsc.connect(noteGain);

    // Warm Undertone (A4 = 440Hz)
    const undertoneOsc = ctx.createOscillator();
    undertoneOsc.type = 'sine';
    undertoneOsc.frequency.setValueAtTime(440, now);

    const undertoneGain = ctx.createGain();
    undertoneGain.gain.setValueAtTime(0.04, now);
    undertoneOsc.connect(undertoneGain);
    undertoneGain.connect(noteGain);

    bellOsc.start(now);
    undertoneOsc.start(now);

    bellOsc.stop(stopTime);
    undertoneOsc.stop(stopTime);

    bellOsc.onended = () => {
      try {
        bellOsc.disconnect();
        undertoneOsc.disconnect();
        undertoneGain.disconnect();
        noteGain.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Cue 4: `playError()` (Non-Jarring Low Wooden Double-Tap)
   * 220Hz -> 174.61Hz [F3], warm triangle wave filtered at 900Hz, 220ms.
   */
  playError() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const totalDuration = 0.220;

    // Local warm lowpass filter (900Hz) for muted acoustic feel
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(0.6, now);
    filter.connect(this.masterGain);

    // Tap 1: 220Hz (A3)
    const t1Start = now;
    const t1Stop = now + 0.075;
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.0001, t1Start);
    gain1.gain.linearRampToValueAtTime(0.14, t1Start + 0.006);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t1Stop);
    gain1.connect(filter);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(220, t1Start);
    osc1.connect(gain1);

    // Tap 2: 174.61Hz (F3)
    const t2Start = now + 0.090;
    const t2Stop = now + totalDuration;
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, t2Start);
    gain2.gain.linearRampToValueAtTime(0.12, t2Start + 0.006);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2Stop);
    gain2.connect(filter);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(174.61, t2Start);
    osc2.connect(gain2);

    osc1.start(t1Start);
    osc1.stop(t1Stop);

    osc2.start(t2Start);
    osc2.stop(t2Stop);

    osc2.onended = () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        gain1.disconnect();
        gain2.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(totalDuration);
  }

  /**
   * Cue 5: `playWarning()` (Gentle Cautionary Muted Cue)
   * Warm, subtle descending interval (349.23Hz F4 -> 293.66Hz D4, 180ms).
   */
  playWarning() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.180;
    const stopTime = now + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.connect(this.masterGain);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(349.23, now); // F4
    osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.120); // D4
    osc.connect(gain);

    osc.start(now);
    osc.stop(stopTime);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Cue 6: `playToggle()` / `playSnap()` (UI Switch / Tab / Copy)
   * Ultra-short, crisp micro-click:
   * 12ms filtered sine impulse at 1100Hz at 0.06 gain.
   */
  playToggle() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.012;
    const stopTime = now + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.connect(this.masterGain);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.connect(gain);

    osc.start(now);
    osc.stop(stopTime);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Alias for playToggle
   */
  playSnap() {
    this.playToggle();
  }
}

export const soundEngine = new SoundEngine();
