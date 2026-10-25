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
const STORAGE_KEY_VOLUME = 'ds_sound_volume';
const STORAGE_KEY_CUE_GAINS = 'ds_sound_cue_gains';
const IDLE_SUSPEND_DELAY_MS = 30000; // 30s generous idle on desktop
const BASE_MASTER_GAIN = 0.60; // Clean, audible base gain staging

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
    /** @type {DynamicsCompressorNode|null} */
    this.compressor = null;

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
    // Load initial volume / amplification (range: 0.0 to 2.5, default: 1.0 = 100%)
    this.volume = 1.0;
    // Load per-cue gain multipliers from localStorage (default: 1.0 = 100%)
    this.cueGains = {};
    /** @type {Record<string, GainNode>} */
    this.cueGainNodes = {};

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedMute = window.localStorage.getItem(STORAGE_KEY);
      this.enabled = storedMute === null ? true : storedMute === 'true';

      const storedVol = parseFloat(window.localStorage.getItem(STORAGE_KEY_VOLUME) || '1.0');
      if (!isNaN(storedVol) && storedVol >= 0) {
        this.volume = Math.max(0.0, Math.min(2.5, storedVol));
      }

      try {
        const storedCueGains = window.localStorage.getItem(STORAGE_KEY_CUE_GAINS);
        if (storedCueGains) {
          const parsed = JSON.parse(storedCueGains);
          if (parsed && typeof parsed === 'object') {
            this.cueGains = parsed;
          }
        }
      } catch (_) {}
    }

    if (typeof window !== 'undefined') {
      window.__ds_soundEngine = this;
      this._bindLifecycleGovernance();
    }
  }

  /**
   * Helper to detect mobile or touch-driven environments (iOS, Android, Tablets, WebView).
   * @private
   * @returns {boolean}
   */
  _isMobileDevice() {
    if (typeof window === 'undefined') return false;
    return Boolean(
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    );
  }

  /**
   * Binds user interaction gesture unlocks and page visibility lifecycle governors.
   * @private
   */
  _bindLifecycleGovernance() {
    if (typeof window === 'undefined') return;

    // 1. Bulletproof Mobile Gesture Unlock: listen to common user interaction events
    const gestureEvents = ['click', 'touchstart', 'touchend', 'pointerup', 'keydown'];
    const unlockHandler = () => {
      this.unlockAudioContext();
    };

    gestureEvents.forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { passive: true, capture: true });
    });

    // 2. KI-FIX-023 Page Visibility & Native App Lifecycle Governor
    const suspendHandler = () => {
      this.suspendNow();
    };

    const resumeHandler = () => {
      if (this.enabled) {
        this.unlockAudioContext();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        suspendHandler();
      } else {
        resumeHandler();
      }
    });

    window.addEventListener('ds:visibility-change', (e) => {
      if (e.detail?.hidden) {
        suspendHandler();
      } else {
        resumeHandler();
      }
    });

    window.addEventListener('ds:native-app-paused', suspendHandler);
    window.addEventListener('ds:native-app-resumed', resumeHandler);
  }

  /**
   * Unlocks the Web Audio AudioContext upon genuine user interaction.
   * Plays a 1-sample silent buffer to unlock the mobile audio hardware pipeline on iOS/Android.
   */
  unlockAudioContext() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      ctx.resume().catch(() => {});
    }

    // Play 1-sample silent buffer to prime mobile OS mixer pipeline
    try {
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(ctx.destination);
      src.start(0);
      src.onended = () => {
        try { src.disconnect(); } catch (_) {}
      };
    } catch (_) {}

    if (ctx.state === 'running') {
      this.unlocked = true;
    }
  }

  /**
   * Lazy-initializes the AudioContext, master low-pass filter, dynamics compressor, and master gain stage.
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
        this.cueGainNodes = {};

        // 1. Master Low-pass Filter (Warm acoustic shaping, 2200Hz, Q: 0.7)
        this.masterFilter = this.ctx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
        this.masterFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

        // 2. Dynamics Compressor Node (Analog Limiting & Saturation Protection)
        // Prevents any harsh digital clipping even under 2.5x volume amplification
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

        // 3. Master Gain Stage (Adjustable Volume Amplification 0.0x to 2.5x)
        this.masterGain = this.ctx.createGain();
        this._updateMasterGain();

        // Route: Nodes -> masterGain -> masterFilter (2200Hz) -> compressor -> destination
        this.masterGain.connect(this.masterFilter);
        this.masterFilter.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      } catch (err) {
        console.warn('[SoundEngine] Failed to initialize AudioContext:', err);
        return null;
      }
    }

    return this.ctx;
  }

  /**
   * Updates master gain node according to enabled state and volume multiplier.
   * @private
   */
  _updateMasterGain() {
    if (this.masterGain && this.ctx) {
      const targetGain = this.enabled ? (BASE_MASTER_GAIN * this.volume) : 0.0001;
      try {
        this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      } catch (_) {
        this.masterGain.gain.value = targetGain;
      }
    }
  }

  /**
   * Schedules an automatic suspend after sounds finish playing to release OS audio threads on desktop.
   * On mobile devices, does NOT suspend in foreground to preserve async notification capability.
   * @private
   * @param {number} durationSec Sound duration in seconds
   */
  _scheduleIdleSuspend(durationSec = 0.5) {
    if (!this.ctx) return;

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // On mobile devices, keep context ready while foregrounded so async task completion sounds can play
    if (this._isMobileDevice()) {
      return;
    }

    // On desktop, use a generous idle window
    const waitMs = Math.max(1000, Math.round(durationSec * 1000) + IDLE_SUSPEND_DELAY_MS);
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
  // Volume & Amplification Management (Admin Configurable 0.0x to 2.5x)
  // =========================================================================

  /**
   * Returns current sound volume multiplier (0.0 to 2.5).
   * @returns {number}
   */
  getVolume() {
    return this.volume;
  }

  // =========================================================================
  // Per-Cue Gain Staging (Independent Sound Multipliers 0.0x to 2.5x)
  // =========================================================================

  /**
   * Normalizes cue aliases to standard canonical IDs.
   * @private
   * @param {string} cueId
   * @returns {string}
   */
  _normalizeCueId(cueId) {
    if (!cueId) return 'jobComplete';
    switch (cueId) {
      case 'trash': return 'delete';
      case 'clearAll':
      case 'clear': return 'deleteAll';
      case 'snap': return 'toggle';
      case 'paste': return 'start';
      case 'light': return 'themeLight';
      case 'dark': return 'themeDark';
      case 'update': return 'appUpdate';
      case 'studocu':
      case 'cardBlue': return 'urStudocu';
      case 'scribd':
      case 'cardOrange': return 'urScribd';
      case 'cardGold':
      case 'blade': return 'sovereignBlade';
      default: return cueId;
    }
  }

  /**
   * Returns the dedicated GainNode destination for a given cue.
   * Lazily instantiates the cue's GainNode and connects it to masterGain.
   * @private
   * @param {string} cueId
   * @returns {AudioNode|null}
   */
  _getCueDestination(cueId) {
    if (!this.ctx || !this.masterGain) return null;
    const norm = this._normalizeCueId(cueId);
    if (!this.cueGainNodes) this.cueGainNodes = {};
    if (!this.cueGainNodes[norm]) {
      const node = this.ctx.createGain();
      const val = this.getCueGain(norm);
      try {
        node.gain.setValueAtTime(val, this.ctx.currentTime);
      } catch (_) {
        node.gain.value = val;
      }
      node.connect(this.masterGain);
      this.cueGainNodes[norm] = node;
    }
    return this.cueGainNodes[norm];
  }

  /**
   * Returns the gain multiplier for a specific sound cue (default: 1.0 = 100%).
   * @param {string} cueId
   * @returns {number}
   */
  getCueGain(cueId) {
    const norm = this._normalizeCueId(cueId);
    if (typeof this.cueGains[norm] === 'number') {
      return this.cueGains[norm];
    }
    return 1.0;
  }

  /**
   * Sets the gain multiplier for a specific sound cue (range: 0.0 to 2.5).
   * Persists setting in localStorage, updates live AudioContext GainNode immediately,
   * and dispatches change notification event.
   * @param {string} cueId
   * @param {number|string} multiplier
   * @returns {number}
   */
  setCueGain(cueId, multiplier) {
    const norm = this._normalizeCueId(cueId);
    const parsed = parseFloat(multiplier);
    const clamped = isNaN(parsed) ? 1.0 : Math.max(0.0, Math.min(2.5, Math.round(parsed * 100) / 100));

    this.cueGains[norm] = clamped;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_CUE_GAINS, JSON.stringify(this.cueGains));
      } catch (_) {}
    }

    if (this.cueGainNodes && this.cueGainNodes[norm] && this.ctx) {
      try {
        this.cueGainNodes[norm].gain.setValueAtTime(clamped, this.ctx.currentTime);
      } catch (_) {
        this.cueGainNodes[norm].gain.value = clamped;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ds:sound-cue-gain-change', {
        detail: { cue: norm, gain: clamped, percent: Math.round(clamped * 100) }
      }));
    }

    return clamped;
  }

  /**
   * Resets all per-cue gain multipliers back to default 1.0 (100%).
   */
  resetCueGains() {
    this.cueGains = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY_CUE_GAINS);
      } catch (_) {}
    }

    if (this.cueGainNodes && this.ctx) {
      Object.keys(this.cueGainNodes).forEach((norm) => {
        try {
          this.cueGainNodes[norm].gain.setValueAtTime(1.0, this.ctx.currentTime);
        } catch (_) {
          this.cueGainNodes[norm].gain.value = 1.0;
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ds:sound-cue-gains-reset'));
    }
  }

  /**
   * Returns a copy of all configured per-cue gain multipliers.
   * @returns {Record<string, number>}
   */
  getAllCueGains() {
    return { ...this.cueGains };
  }

  /**
   * Sets volume multiplier, updates master gain, persists to localStorage, and notifies listeners.
   * @param {number|string} vol Multiplier from 0.0 (0%) to 2.5 (250%)
   * @returns {number}
   */
  setVolume(vol) {
    const parsed = parseFloat(vol);
    if (isNaN(parsed)) return this.volume;

    // Clamp volume safely between 0.0 (mute) and 2.5 (250% maximum amplification)
    this.volume = Math.max(0.0, Math.min(2.5, Math.round(parsed * 100) / 100));

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_VOLUME, String(this.volume));
      } catch (_) {}
    }

    this._updateMasterGain();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ds:sound-volume-change', {
        detail: { volume: this.volume, percent: Math.round(this.volume * 100) }
      }));
    }

    return this.volume;
  }

  /**
   * Returns diagnostic telemetry of the Web Audio subsystem.
   * @returns {{unlocked: boolean, state: string, enabled: boolean, volume: number, volumePercent: number, isMobile: boolean, hasCompressor: boolean}}
   */
  getAudioDiagnostics() {
    return {
      unlocked: this.unlocked,
      state: this.ctx ? this.ctx.state : 'uninitialized',
      enabled: this.enabled,
      volume: this.volume,
      volumePercent: Math.round(this.volume * 100),
      isMobile: this._isMobileDevice(),
      hasCompressor: Boolean(this.compressor),
      cueGains: this.getAllCueGains()
    };
  }

  /**
   * Plays a requested sound cue immediately for real-time volume adjustment preview.
   * @param {'jobComplete'|'start'|'notification'|'error'|'warning'|'toggle'} [cue='jobComplete']
   */
  testSound(cue = 'jobComplete') {
    switch (cue) {
      case 'start':
      case 'paste':
        this.playStart();
        break;
      case 'notification':
        this.playNotification();
        break;
      case 'error':
        this.playError();
        break;
      case 'warning':
        this.playWarning();
        break;
      case 'click':
      case 'toggle':
      case 'snap':
        this.playToggle();
        break;
      case 'delete':
      case 'trash':
        this.playDelete();
        break;
      case 'deleteAll':
      case 'clearAll':
      case 'clear':
        this.playDeleteAll();
        break;
      case 'themeLight':
      case 'light':
        this.playThemeToLight();
        break;
      case 'themeDark':
      case 'dark':
        this.playThemeToDark();
        break;
      case 'appUpdate':
      case 'update':
        this.playAppUpdate();
        break;
      case 'urStudocu':
      case 'studocu':
      case 'cardBlue':
        this.playCardUrStudocu();
        break;
      case 'urScribd':
      case 'scribd':
      case 'cardOrange':
        this.playCardUrScribd();
        break;
      case 'cardGold':
      case 'sovereignBlade':
      case 'blade':
        this.playCardSovereignBlade();
        break;
      case 'jobComplete':
      case 'success':
      default:
        this.playJobComplete();
        break;
    }
  }

  /**
   * Safe generic dispatcher for playing procedural audio cues by name.
   * @param {string} [cue='toggle']
   */
  play(cue = 'toggle') {
    try {
      this.testSound(cue);
    } catch (_) {}
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
      noteGain.gain.linearRampToValueAtTime(0.28, noteStart + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStop);
      const dest = this._getCueDestination('jobComplete') || this.masterGain;
      noteGain.connect(dest);

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
      harmGain.gain.setValueAtTime(0.06, noteStart);
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
    gain.gain.linearRampToValueAtTime(0.30, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.connect(this._getCueDestination('start') || this.masterGain);

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
    noteGain.gain.linearRampToValueAtTime(0.28, now + 0.008);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    noteGain.connect(this._getCueDestination('notification') || this.masterGain);

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
    undertoneGain.gain.setValueAtTime(0.07, now);
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
    filter.connect(this._getCueDestination('error') || this.masterGain);

    // Tap 1: 220Hz (A3)
    const t1Start = now;
    const t1Stop = now + 0.075;
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.0001, t1Start);
    gain1.gain.linearRampToValueAtTime(0.30, t1Start + 0.006);
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
    gain2.gain.linearRampToValueAtTime(0.26, t2Start + 0.006);
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
    gain.gain.linearRampToValueAtTime(0.25, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.connect(this._getCueDestination('error') || this.masterGain);

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
   * 12ms filtered sine impulse at 1100Hz at 0.18 gain.
   */
  playToggle() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.012;
    const stopTime = now + duration;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gain.connect(this._getCueDestination('toggle') || this.masterGain);

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

  /**
   * Alias for playToggle / subtle tactile action cue
   */
  playAction() {
    this.playToggle();
  }

  // =========================================================================
  // Deletion & Purge Cues (Tactile Discard & Sweeping Clean-Slate)
  // =========================================================================

  /**
   * Cue 6B: `playDelete()` / `playTrash()` (Single Item Discard / Soft Suction Pop)
   * Organic, subtle paper swoosh & crisp downward suction pop:
   * 1. Dynamic lowpass damping filter (sweeping 1600Hz -> 450Hz over 120ms, Q: 0.8).
   * 2. Primary suction sine glide (340Hz -> 140Hz over 70ms with 5ms attack and 110ms decay).
   * 3. Air flutter transient (warm triangle 520Hz -> 220Hz over 60ms, gain: 0.09).
   * 4. Subtle mobile haptic pulse (10ms).
   */
  playDelete() {
    const ctx = this._prepareForPlayback();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch (_) {}
    }
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.130;
    const stopTime = now + duration;

    // 1. Dynamic lowpass acoustic damping filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(450, now + 0.120);
    filter.Q.setValueAtTime(0.8, now);
    filter.connect(this._getCueDestination('delete') || this.masterGain);

    // 2. Primary Tactile Suction Pop (Sine glide: 340Hz -> 140Hz)
    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.0001, now);
    popGain.gain.linearRampToValueAtTime(0.26, now + 0.005);
    popGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    popGain.connect(filter);

    const popOsc = ctx.createOscillator();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(340, now);
    popOsc.frequency.exponentialRampToValueAtTime(140, now + 0.070);
    popOsc.connect(popGain);

    // 3. Air Flutter Transient (Subtle warm triangle flutter: 520Hz -> 220Hz)
    const flutterStart = now + 0.008;
    const flutterGain = ctx.createGain();
    flutterGain.gain.setValueAtTime(0.0001, flutterStart);
    flutterGain.gain.linearRampToValueAtTime(0.09, flutterStart + 0.006);
    flutterGain.gain.exponentialRampToValueAtTime(0.0001, flutterStart + 0.060);
    flutterGain.connect(filter);

    const flutterOsc = ctx.createOscillator();
    flutterOsc.type = 'triangle';
    flutterOsc.frequency.setValueAtTime(520, flutterStart);
    flutterOsc.frequency.exponentialRampToValueAtTime(220, flutterStart + 0.060);
    flutterOsc.connect(flutterGain);

    popOsc.start(now);
    flutterOsc.start(flutterStart);

    popOsc.stop(stopTime);
    flutterOsc.stop(flutterStart + 0.060);

    popOsc.onended = () => {
      try {
        popOsc.disconnect();
        flutterOsc.disconnect();
        popGain.disconnect();
        flutterGain.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Alias for `playDelete()`
   */
  playTrash() {
    this.playDelete();
  }

  /**
   * Cue 6C: `playDeleteAll()` / `playClearAll()` (Dual-Stage Vacuum Sweep & Resonant Clean Slate)
   * A satisfying, sweeping wipe effect that signifies total reset / clean slate:
   * 1. Resonant sweeping lowpass filter (2400Hz -> 350Hz over 260ms, Q: 1.2).
   * 2. Stage 1: Sweeping vacuum whoosh glide (A4 [440Hz] -> C4 [261.63Hz] -> E3 [164.81Hz] over 160ms).
   * 3. Stage 2: Secondary air flutter harmonic (E5 [659.25Hz] -> E4 [329.63Hz] over 140ms).
   * 4. Stage 3: Deep clean-slate sub anchor (C3 [130.81Hz] -> E2 [82.41Hz] over 280ms).
   * 5. Dual mobile haptic vibration pulse ([15, 30, 25]).
   */
  playDeleteAll() {
    const ctx = this._prepareForPlayback();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([15, 30, 25]); } catch (_) {}
    }
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.320;
    const stopTime = now + duration;

    // Resonant Sweeping Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + 0.260);
    filter.Q.setValueAtTime(1.2, now);
    filter.connect(this._getCueDestination('deleteAll') || this.masterGain);

    // 1. Vacuum Whoosh Glide (440Hz -> 261.63Hz -> 164.81Hz)
    const sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(0.0001, now);
    sweepGain.gain.linearRampToValueAtTime(0.28, now + 0.010);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    sweepGain.connect(filter);

    const sweepOsc = ctx.createOscillator();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(440, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(261.63, now + 0.070);
    sweepOsc.frequency.exponentialRampToValueAtTime(164.81, now + 0.160);
    sweepOsc.connect(sweepGain);

    // 2. Harmonic Air Flutter (E5 659.25Hz -> E4 329.63Hz)
    const flutterStart = now + 0.020;
    const flutterGain = ctx.createGain();
    flutterGain.gain.setValueAtTime(0.0001, flutterStart);
    flutterGain.gain.linearRampToValueAtTime(0.12, flutterStart + 0.012);
    flutterGain.gain.exponentialRampToValueAtTime(0.0001, flutterStart + 0.140);
    flutterGain.connect(filter);

    const flutterOsc = ctx.createOscillator();
    flutterOsc.type = 'triangle';
    flutterOsc.frequency.setValueAtTime(659.25, flutterStart);
    flutterOsc.frequency.exponentialRampToValueAtTime(329.63, flutterStart + 0.140);
    flutterOsc.connect(flutterGain);

    // 3. Deep Clean-Slate Sub Anchor (C3 130.81Hz -> E2 82.41Hz)
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    subGain.connect(filter);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(130.81, now);
    subOsc.frequency.exponentialRampToValueAtTime(82.41, now + 0.280);
    subOsc.connect(subGain);

    sweepOsc.start(now);
    flutterOsc.start(flutterStart);
    subOsc.start(now);

    sweepOsc.stop(stopTime);
    flutterOsc.stop(flutterStart + 0.140);
    subOsc.stop(stopTime);

    subOsc.onended = () => {
      try {
        sweepOsc.disconnect();
        flutterOsc.disconnect();
        subOsc.disconnect();
        sweepGain.disconnect();
        flutterGain.disconnect();
        subGain.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Alias for `playDeleteAll()`
   */
  playClearAll() {
    this.playDeleteAll();
  }

  // =========================================================================
  // Theme Switch Cues (Light Mode Dawn vs Dark Mode Velvety Dusk)
  // =========================================================================

  /**
   * Cue 7: `playThemeSwitch(isDark)` (Theme Switch Transition Chimes)
   * Dispatches tailored acoustic palettes for Light vs Dark theme changes.
   * @param {boolean|string} isDark True if switching to dark mode, false if switching to light mode
   */
  playThemeSwitch(isDark) {
    const targetDark = typeof isDark === 'boolean' ? isDark : isDark === 'dark';
    if (targetDark) {
      this.playThemeToDark();
    } else {
      this.playThemeToLight();
    }
  }

  /**
   * Cue 7A: `playThemeToLight()` (Morning Dawn / Uplifting Crystal Shimmer)
   * Staggered ascending chime (C5 [523Hz] -> G5 [784Hz] -> C6 [1047Hz] sparkle):
   * Pure airy sine with bright crystalline harmonics and silk 240ms decay.
   */
  playThemeToLight() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.240;
    const stopTime = now + duration;

    // Primary Ascending Shimmer Note (523.25Hz -> 783.99Hz)
    const primaryGain = ctx.createGain();
    primaryGain.gain.setValueAtTime(0.0001, now);
    primaryGain.gain.linearRampToValueAtTime(0.24, now + 0.012);
    primaryGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    const dest = this._getCueDestination('themeLight') || this.masterGain;
    primaryGain.connect(dest);

    const primaryOsc = ctx.createOscillator();
    primaryOsc.type = 'sine';
    primaryOsc.frequency.setValueAtTime(523.25, now);
    primaryOsc.frequency.exponentialRampToValueAtTime(783.99, now + 0.080);
    primaryOsc.connect(primaryGain);

    // Sparkle Crystalline Overtone (1046.5Hz C6 sliding toward 1318.5Hz E6)
    const sparkleStart = now + 0.045;
    const sparkleGain = ctx.createGain();
    sparkleGain.gain.setValueAtTime(0.0001, sparkleStart);
    sparkleGain.gain.linearRampToValueAtTime(0.16, sparkleStart + 0.010);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    sparkleGain.connect(dest);

    const sparkleOsc = ctx.createOscillator();
    sparkleOsc.type = 'sine';
    sparkleOsc.frequency.setValueAtTime(1046.5, sparkleStart);
    sparkleOsc.frequency.exponentialRampToValueAtTime(1318.51, sparkleStart + 0.090);
    sparkleOsc.connect(sparkleGain);

    primaryOsc.start(now);
    sparkleOsc.start(sparkleStart);

    primaryOsc.stop(stopTime);
    sparkleOsc.stop(stopTime);

    sparkleOsc.onended = () => {
      try {
        primaryOsc.disconnect();
        sparkleOsc.disconnect();
        primaryGain.disconnect();
        sparkleGain.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Cue 7B: `playThemeToDark()` (Velvety Dusk / Deep Warm Resonance)
   * Descending warm glide from A4 (440Hz) down to C4 (261.6Hz) with a gentle C3 (130.8Hz) sub-tone:
   * Warm triangle wave with cozy acoustic damping over 280ms.
   */
  playThemeToDark() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.280;
    const stopTime = now + duration;

    // Local warm lowpass filter (1100Hz -> 650Hz) to accentuate velvety depth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + duration);
    filter.Q.setValueAtTime(0.8, now);
    filter.connect(this._getCueDestination('themeDark') || this.masterGain);

    // Primary Descending Body (440Hz -> 261.63Hz)
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.28, now + 0.010);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    bodyGain.connect(filter);

    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(440, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(261.63, now + 0.140);
    bodyOsc.connect(bodyGain);

    // Warm Sub Undertone (130.81Hz C3) for cozy physical presence
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.12, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    subGain.connect(filter);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(130.81, now);
    subOsc.connect(subGain);

    bodyOsc.start(now);
    subOsc.start(now);

    bodyOsc.stop(stopTime);
    subOsc.stop(stopTime);

    bodyOsc.onended = () => {
      try {
        bodyOsc.disconnect();
        subOsc.disconnect();
        bodyGain.disconnect();
        subGain.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  // =========================================================================
  // Web Application Update Cues (Triumphant Prismatic Fanfare & Sparkle)
  // =========================================================================

  /**
   * Cue 8: `playAppUpdate()` / `playUpdate()` (Web Update Fanfare & Crystalline Shimmer)
   * A modern, triumphant, sparkling system upgrade sound:
   * 1. Warm Analog Sub-Base: D3 [146.83Hz] anchor sine with 10ms attack and 380ms decay.
   * 2. Resonant Dual Foundation Chime: A4 [440Hz] + D5 [587.33Hz] twin glass chime.
   * 3. Ascending Prismatic Cascade: F#5 [739.99Hz] (+65ms) -> A5 [880Hz] (+130ms) -> D6 [1174.66Hz] (+195ms).
   * 4. Silky Ethereal Shimmer: F#6 [1479.98Hz] (+240ms) with airy overtone and 720ms silk decay.
   */
  playAppUpdate() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.720;
    const stopTime = now + duration;

    // Filter to keep the high sparkle smooth and silky, zero harshness
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.Q.setValueAtTime(0.7, now);
    filter.connect(this._getCueDestination('appUpdate') || this.masterGain);

    // 1. Deep Analog Sub-Anchor (D3: 146.83Hz)
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.20, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.400);
    subGain.connect(filter);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(146.83, now);
    subOsc.connect(subGain);

    // 2. Twin Foundation Chime (A4: 440Hz + D5: 587.33Hz)
    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.0001, now);
    chimeGain.gain.linearRampToValueAtTime(0.24, now + 0.010);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    chimeGain.connect(filter);

    const oscA4 = ctx.createOscillator();
    oscA4.type = 'sine';
    oscA4.frequency.setValueAtTime(440.00, now);
    oscA4.connect(chimeGain);

    const oscD5 = ctx.createOscillator();
    oscD5.type = 'triangle';
    oscD5.frequency.setValueAtTime(587.33, now);
    oscD5.connect(chimeGain);

    // 3. Ascending Prismatic Cascade (F#5: 739.99Hz, A5: 880Hz, D6: 1174.66Hz)
    const cascadeNotes = [
      { freq: 739.99, delay: 0.065, gain: 0.22 },  // F#5
      { freq: 880.00, delay: 0.130, gain: 0.22 },  // A5
      { freq: 1174.66, delay: 0.195, gain: 0.20 }  // D6
    ];

    const cascadeOscs = [];
    const cascadeGains = [];

    cascadeNotes.forEach(note => {
      const noteStart = now + note.delay;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.0001, noteStart);
      cGain.gain.linearRampToValueAtTime(note.gain, noteStart + 0.010);
      cGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
      cGain.connect(filter);

      const cOsc = ctx.createOscillator();
      cOsc.type = 'sine';
      cOsc.frequency.setValueAtTime(note.freq, noteStart);
      cOsc.connect(cGain);

      cascadeOscs.push(cOsc);
      cascadeGains.push(cGain);
    });

    // 4. Silky Ethereal Shimmer (F#6: 1479.98Hz)
    const shimmerStart = now + 0.240;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, shimmerStart);
    shimmerGain.gain.linearRampToValueAtTime(0.16, shimmerStart + 0.012);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    shimmerGain.connect(filter);

    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(1479.98, shimmerStart);
    shimmerOsc.connect(shimmerGain);

    // Start all oscillators
    subOsc.start(now);
    oscA4.start(now);
    oscD5.start(now);
    cascadeOscs[0].start(now + 0.065);
    cascadeOscs[1].start(now + 0.130);
    cascadeOscs[2].start(now + 0.195);
    shimmerOsc.start(shimmerStart);

    // Stop all oscillators
    subOsc.stop(now + 0.400);
    oscA4.stop(stopTime);
    oscD5.stop(stopTime);
    cascadeOscs.forEach(o => o.stop(stopTime));
    shimmerOsc.stop(stopTime);

    // Cleanup nodes
    shimmerOsc.onended = () => {
      try {
        subOsc.disconnect();
        oscA4.disconnect();
        oscD5.disconnect();
        cascadeOscs.forEach(o => o.disconnect());
        shimmerOsc.disconnect();

        subGain.disconnect();
        chimeGain.disconnect();
        cascadeGains.forEach(g => g.disconnect());
        shimmerGain.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Alias for `playAppUpdate()`
   */
  playUpdate() {
    this.playAppUpdate();
  }

  // =========================================================================
  // Tool Card Custom Signatures (Sovereign Gold / Radiant Blade Gleam)
  // =========================================================================

  /**
   * Dispatches tailored acoustic feedback when clicking a dashboard tool card.
   * Special high-tier cards (e.g. Studocu Downloader UR, Scribd Downloader UR)
   * trigger custom thematic signatures tailored to card color and rarity.
   * @param {string} toolId Tool identifier (e.g. 'studocu-dl', 'scribd-archiver', etc.)
   */
  playCardClick(toolId) {
    if (!this.isEnabled()) return;
    if (toolId === 'studocu-dl' || toolId === 'studocu') {
      this.playCardUrStudocu();
    } else if (toolId === 'scribd-archiver' || toolId === 'scribd') {
      this.playCardUrScribd();
    } else {
      this.playToggle();
    }
  }

  /**
   * Cue 9a: `playCardUrStudocu()` (Lam Ngọc Vô Cực / Crystalline Cosmic Indigo-Blue Hologram Chime)
   * Tailored for Studocu Downloader (Tier UR Prismatic, Indigo-Blue #6366F1):
   * 1. Indigo Sub-Anchor: D#3 (155.56Hz) deep resonant sine anchor (240ms).
   * 2. Holographic Glissando Sweep: Pure sine gliding D#5 (622.25Hz) -> G#5 (830.61Hz) -> C6 (1046.50Hz).
   * 3. Twin Crystal Chime: D#6 (1244.51Hz) sine + G6 (1567.98Hz) soft triangle harmonic.
   * 4. Ethereal Prism Shimmer: D#7 (2489.02Hz) stardust glint with 480ms silk decay.
   * 5. Resonant dynamic lowpass filter sweeping 1200Hz -> 4200Hz -> 2800Hz (Q: 1.4).
   */
  playCardUrStudocu() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([12, 30, 15]);
      }
    } catch (_) {}

    const now = ctx.currentTime;
    const duration = 0.480;
    const stopTime = now + duration;

    // Crystalline Indigo Hologram Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + 0.060);
    filter.frequency.exponentialRampToValueAtTime(2800, stopTime);
    filter.Q.setValueAtTime(1.4, now);
    filter.connect(this._getCueDestination('urStudocu') || this.masterGain);

    // 1. Indigo Sub-Anchor (D#3: 155.56Hz)
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.240);
    subGain.connect(filter);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(155.56, now);
    subOsc.connect(subGain);

    // 2. Holographic Glissando Sweep (D#5: 622.25Hz -> G#5: 830.61Hz -> C6: 1046.50Hz)
    const glissGain = ctx.createGain();
    const glissStart = now + 0.008;
    glissGain.gain.setValueAtTime(0.0001, glissStart);
    glissGain.gain.linearRampToValueAtTime(0.24, glissStart + 0.018);
    glissGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    glissGain.connect(filter);

    const glissOsc = ctx.createOscillator();
    glissOsc.type = 'sine';
    glissOsc.frequency.setValueAtTime(622.25, glissStart);
    glissOsc.frequency.exponentialRampToValueAtTime(830.61, glissStart + 0.060);
    glissOsc.frequency.exponentialRampToValueAtTime(1046.50, glissStart + 0.160);
    glissOsc.connect(glissGain);

    // 3. Twin Crystal Chime 1 (D#6: 1244.51Hz)
    const crystalGain1 = ctx.createGain();
    const chimeStart = now + 0.025;
    crystalGain1.gain.setValueAtTime(0.0001, chimeStart);
    crystalGain1.gain.linearRampToValueAtTime(0.20, chimeStart + 0.012);
    crystalGain1.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    crystalGain1.connect(filter);

    const crystalOsc1 = ctx.createOscillator();
    crystalOsc1.type = 'sine';
    crystalOsc1.frequency.setValueAtTime(1244.51, chimeStart);
    crystalOsc1.connect(crystalGain1);

    // 4. Twin Crystal Chime 2 (G6: 1567.98Hz)
    const crystalGain2 = ctx.createGain();
    crystalGain2.gain.setValueAtTime(0.0001, chimeStart);
    crystalGain2.gain.linearRampToValueAtTime(0.16, chimeStart + 0.012);
    crystalGain2.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    crystalGain2.connect(filter);

    const crystalOsc2 = ctx.createOscillator();
    crystalOsc2.type = 'triangle';
    crystalOsc2.frequency.setValueAtTime(1567.98, chimeStart);
    crystalOsc2.connect(crystalGain2);

    // 5. Ethereal Prism Shimmer (D#7: 2489.02Hz stardust glint)
    const shimmerGain = ctx.createGain();
    const shimmerStart = now + 0.045;
    shimmerGain.gain.setValueAtTime(0.0001, shimmerStart);
    shimmerGain.gain.linearRampToValueAtTime(0.14, shimmerStart + 0.010);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    shimmerGain.connect(filter);

    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(2489.02, shimmerStart);
    shimmerOsc.connect(shimmerGain);

    // Start oscillators
    subOsc.start(now);
    glissOsc.start(glissStart);
    crystalOsc1.start(chimeStart);
    crystalOsc2.start(chimeStart);
    shimmerOsc.start(shimmerStart);

    // Stop oscillators
    subOsc.stop(now + 0.240);
    glissOsc.stop(stopTime);
    crystalOsc1.stop(stopTime);
    crystalOsc2.stop(stopTime);
    shimmerOsc.stop(stopTime);

    // Node cleanup
    shimmerOsc.onended = () => {
      try {
        subOsc.disconnect();
        glissOsc.disconnect();
        crystalOsc1.disconnect();
        crystalOsc2.disconnect();
        shimmerOsc.disconnect();

        subGain.disconnect();
        glissGain.disconnect();
        crystalGain1.disconnect();
        crystalGain2.disconnect();
        shimmerGain.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Cue 9b: `playCardUrScribd()` (San Hô Hoàng Kim / Solar Amber-Terracotta Bloom)
   * Tailored for Scribd Downloader (Tier UR Prismatic, Terracotta Amber #EA580C):
   * 1. Solar Low Hearth Anchor: F3 (174.61Hz) warm triangle wave (260ms).
   * 2. Fifth Foundation Anchor: C4 (261.63Hz) pure sine foundation (300ms).
   * 3. Warm Amber Swell Glissando: Sine glide A4 (440.00Hz) -> C#5 (554.37Hz) -> E5 (659.25Hz).
   * 4. Coral Sunset Bloom: A5 (880.00Hz) resonant sine overtone.
   * 5. Amber Hearth Shimmer: C#7 (2217.46Hz) warm golden shimmer with 480ms silk decay.
   * 6. Warm solar lowpass filter sweeping 700Hz -> 3200Hz -> 2200Hz (Q: 1.0).
   */
  playCardUrScribd() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([15, 25, 35]);
      }
    } catch (_) {}

    const now = ctx.currentTime;
    const duration = 0.480;
    const stopTime = now + duration;

    // Solar Amber Warm Lowpass Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.070);
    filter.frequency.exponentialRampToValueAtTime(2200, stopTime);
    filter.Q.setValueAtTime(1.0, now);
    filter.connect(this._getCueDestination('urScribd') || this.masterGain);

    // 1. Solar Low Hearth Anchor (F3: 174.61Hz)
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.20, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.260);
    subGain.connect(filter);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(174.61, now);
    subOsc.connect(subGain);

    // 2. Fifth Foundation Anchor (C4: 261.63Hz)
    const fifthGain = ctx.createGain();
    fifthGain.gain.setValueAtTime(0.0001, now);
    fifthGain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    fifthGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.300);
    fifthGain.connect(filter);

    const fifthOsc = ctx.createOscillator();
    fifthOsc.type = 'sine';
    fifthOsc.frequency.setValueAtTime(261.63, now);
    fifthOsc.connect(fifthGain);

    // 3. Warm Amber Swell Glissando (A4: 440Hz -> C#5: 554.37Hz -> E5: 659.25Hz)
    const swellGain = ctx.createGain();
    const swellStart = now + 0.010;
    swellGain.gain.setValueAtTime(0.0001, swellStart);
    swellGain.gain.linearRampToValueAtTime(0.24, swellStart + 0.018);
    swellGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    swellGain.connect(filter);

    const swellOsc = ctx.createOscillator();
    swellOsc.type = 'sine';
    swellOsc.frequency.setValueAtTime(440.00, swellStart);
    swellOsc.frequency.exponentialRampToValueAtTime(554.37, swellStart + 0.065);
    swellOsc.frequency.exponentialRampToValueAtTime(659.25, swellStart + 0.170);
    swellOsc.connect(swellGain);

    // 4. Coral Sunset Bloom (A5: 880.00Hz)
    const bloomGain = ctx.createGain();
    const bloomStart = now + 0.030;
    bloomGain.gain.setValueAtTime(0.0001, bloomStart);
    bloomGain.gain.linearRampToValueAtTime(0.20, bloomStart + 0.012);
    bloomGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    bloomGain.connect(filter);

    const bloomOsc = ctx.createOscillator();
    bloomOsc.type = 'sine';
    bloomOsc.frequency.setValueAtTime(880.00, bloomStart);
    bloomOsc.connect(bloomGain);

    // 5. Amber Hearth Shimmer (C#7: 2217.46Hz warm golden sheen)
    const shimmerGain = ctx.createGain();
    const shimmerStart = now + 0.050;
    shimmerGain.gain.setValueAtTime(0.0001, shimmerStart);
    shimmerGain.gain.linearRampToValueAtTime(0.14, shimmerStart + 0.012);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    shimmerGain.connect(filter);

    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(2217.46, shimmerStart);
    shimmerOsc.connect(shimmerGain);

    // Start oscillators
    subOsc.start(now);
    fifthOsc.start(now);
    swellOsc.start(swellStart);
    bloomOsc.start(bloomStart);
    shimmerOsc.start(shimmerStart);

    // Stop oscillators
    subOsc.stop(now + 0.260);
    fifthOsc.stop(now + 0.300);
    swellOsc.stop(stopTime);
    bloomOsc.stop(stopTime);
    shimmerOsc.stop(stopTime);

    // Node cleanup
    shimmerOsc.onended = () => {
      try {
        subOsc.disconnect();
        fifthOsc.disconnect();
        swellOsc.disconnect();
        bloomOsc.disconnect();
        shimmerOsc.disconnect();

        subGain.disconnect();
        fifthGain.disconnect();
        swellGain.disconnect();
        bloomGain.disconnect();
        shimmerGain.disconnect();
        filter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }

  /**
   * Cue 9: `playCardSovereignBlade()` (Lưỡi Gươm Ánh Sáng / Radiant Solar Light Blade)
   * A pure, ethereal sword of radiant light & solar plasma ignition:
   * 1. Sub-Energy Core: 110Hz (A2) smooth sine pulse for power heft (200ms).
   * 2. Plasma Ignition Sweep: Pure sine surging 220Hz -> 580Hz -> 440Hz with animated filter.
   * 3. Searing Light Glissando: Pure sine gliding E5 (659Hz) -> E6 (1318Hz) -> B6 (1975Hz).
   * 4. Resonant Crystal Singing: Dual crystal overtone at B5 (987.8Hz) & F#6 (1480Hz) with 450ms silk decay.
   * 5. Luminous Crown Shimmer: E7 (2637Hz) stardust glint decaying over 480ms.
   * 6. Zero harsh sawtooth buzz — 100% warm organic light harmonics.
   */
  playCardSovereignBlade() {
    const ctx = this._prepareForPlayback();
    if (!ctx) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([15, 35, 20]);
      }
    } catch (_) {}

    const now = ctx.currentTime;
    const duration = 0.480;
    const stopTime = now + duration;

    // Dynamic light beam filter: opens rapidly from 800Hz to 3600Hz then smooths out
    const beamFilter = ctx.createBiquadFilter();
    beamFilter.type = 'lowpass';
    beamFilter.frequency.setValueAtTime(800, now);
    beamFilter.frequency.exponentialRampToValueAtTime(3600, now + 0.060);
    beamFilter.frequency.exponentialRampToValueAtTime(2200, stopTime);
    beamFilter.Q.setValueAtTime(1.2, now);
    beamFilter.connect(this._getCueDestination('sovereignBlade') || this.masterGain);

    // 1. Sub-Energy Core (110Hz A2) - gives the light blade deep energy heft
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.220);
    subGain.connect(beamFilter);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.exponentialRampToValueAtTime(82.4, now + 0.220);
    subOsc.connect(subGain);

    // 2. Plasma Ignition Sweep (220Hz -> 580Hz -> 440Hz)
    const plasmaGain = ctx.createGain();
    plasmaGain.gain.setValueAtTime(0.0001, now);
    plasmaGain.gain.linearRampToValueAtTime(0.24, now + 0.018);
    plasmaGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.320);
    plasmaGain.connect(beamFilter);

    const plasmaOsc = ctx.createOscillator();
    plasmaOsc.type = 'sine';
    plasmaOsc.frequency.setValueAtTime(220, now);
    plasmaOsc.frequency.exponentialRampToValueAtTime(587.33, now + 0.050);
    plasmaOsc.frequency.exponentialRampToValueAtTime(440, now + 0.200);
    plasmaOsc.connect(plasmaGain);

    // 3. Searing Light Glissando (E5: 659.25Hz -> E6: 1318.5Hz -> B6: 1975.5Hz)
    const beamGain = ctx.createGain();
    const beamStart = now + 0.010;
    beamGain.gain.setValueAtTime(0.0001, beamStart);
    beamGain.gain.linearRampToValueAtTime(0.26, beamStart + 0.020);
    beamGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    beamGain.connect(beamFilter);

    const beamSweepOsc = ctx.createOscillator();
    beamSweepOsc.type = 'sine';
    beamSweepOsc.frequency.setValueAtTime(659.25, beamStart);
    beamSweepOsc.frequency.exponentialRampToValueAtTime(1318.51, beamStart + 0.065);
    beamSweepOsc.frequency.exponentialRampToValueAtTime(1975.53, beamStart + 0.160);
    beamSweepOsc.connect(beamGain);

    // 4. Resonant Crystal Singing (B5: 987.77Hz)
    const singGain1 = ctx.createGain();
    const chordStart = now + 0.025;
    singGain1.gain.setValueAtTime(0.0001, chordStart);
    singGain1.gain.linearRampToValueAtTime(0.20, chordStart + 0.015);
    singGain1.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    singGain1.connect(beamFilter);

    const singOsc1 = ctx.createOscillator();
    singOsc1.type = 'triangle';
    singOsc1.frequency.setValueAtTime(987.77, chordStart);
    singOsc1.connect(singGain1);

    // 5. Golden Radiant Harmonic (F#6: 1479.98Hz)
    const singGain2 = ctx.createGain();
    singGain2.gain.setValueAtTime(0.0001, chordStart);
    singGain2.gain.linearRampToValueAtTime(0.18, chordStart + 0.015);
    singGain2.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    singGain2.connect(beamFilter);

    const singOsc2 = ctx.createOscillator();
    singOsc2.type = 'sine';
    singOsc2.frequency.setValueAtTime(1479.98, chordStart);
    singOsc2.connect(singGain2);

    // 6. Luminous Crown Shimmer (E7: 2637.02Hz) - ethereal stardust glint
    const shimmerGain = ctx.createGain();
    const shimmerStart = now + 0.040;
    shimmerGain.gain.setValueAtTime(0.0001, shimmerStart);
    shimmerGain.gain.linearRampToValueAtTime(0.14, shimmerStart + 0.012);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    shimmerGain.connect(beamFilter);

    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(2637.02, shimmerStart);
    shimmerOsc.connect(shimmerGain);

    // Start all oscillators
    subOsc.start(now);
    plasmaOsc.start(now);
    beamSweepOsc.start(beamStart);
    singOsc1.start(chordStart);
    singOsc2.start(chordStart);
    shimmerOsc.start(shimmerStart);

    // Stop all oscillators
    subOsc.stop(now + 0.220);
    plasmaOsc.stop(now + 0.320);
    beamSweepOsc.stop(stopTime);
    singOsc1.stop(stopTime);
    singOsc2.stop(stopTime);
    shimmerOsc.stop(stopTime);

    // Node cleanup
    shimmerOsc.onended = () => {
      try {
        subOsc.disconnect();
        plasmaOsc.disconnect();
        beamSweepOsc.disconnect();
        singOsc1.disconnect();
        singOsc2.disconnect();
        shimmerOsc.disconnect();

        subGain.disconnect();
        plasmaGain.disconnect();
        beamGain.disconnect();
        singGain1.disconnect();
        singGain2.disconnect();
        shimmerGain.disconnect();
        beamFilter.disconnect();
      } catch (_) {}
    };

    this._scheduleIdleSuspend(duration);
  }
}

export const soundEngine = new SoundEngine();
