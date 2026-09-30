/**
 * AudioRenderer Component (< 150 lines)
 * Feature-rich Audio player with speed control, loop, scrubber, and resilient blob fallback
 */

import { formatBytes } from '../../../../utilities/formatters.js';

function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function renderAudioViewer(state) {
  return `
    <div class="py-8 px-4 sm:px-8 max-w-lg mx-auto w-full space-y-6 text-center">
      <div class="w-20 h-20 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
        <i data-lucide="music" class="w-10 h-10"></i>
      </div>

      <div>
        <h3 class="font-semibold text-base text-zinc-900 dark:text-white truncate">${state.name}</h3>
        <p class="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">
          ${state.size > 0 ? formatBytes(state.size) : 'Âm thanh'} • ${state.mimeType || 'audio/stream'}
        </p>
      </div>

      <!-- Native Audio Hidden Element -->
      <audio id="corePreviewAudio" preload="auto" src="${state.viewUrl}"></audio>

      <!-- Player Controls Card -->
      <div class="bg-zinc-50 dark:bg-white/[0.03] p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-white/[0.06] space-y-4 shadow-sm">
        <!-- Progress Scrubber -->
        <div class="space-y-1.5">
          <input id="audioScrubber" type="range" min="0" max="100" value="0" step="0.1" class="w-full h-1.5 bg-zinc-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
          <div class="flex justify-between text-[11px] font-mono text-zinc-400">
            <span id="audioCurrentTime">00:00</span>
            <span id="audioTotalDuration">00:00</span>
          </div>
        </div>

        <!-- Buttons Bar -->
        <div class="flex items-center justify-between gap-2">
          <!-- Loop Toggle -->
          <button id="btnToggleLoop" type="button" class="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition" title="Lặp lại">
            <i data-lucide="repeat" class="w-4 h-4"></i>
          </button>

          <!-- Main Play / Pause -->
          <button id="btnAudioPlayPause" type="button" class="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 active:scale-95 transition cursor-pointer">
            <i id="iconAudioPlay" data-lucide="play" class="w-5 h-5 fill-current translate-x-0.5"></i>
            <i id="iconAudioPause" data-lucide="pause" class="w-5 h-5 fill-current hidden"></i>
          </button>

          <!-- Speed Switcher -->
          <button id="btnAudioSpeed" type="button" class="px-2.5 py-1.5 rounded-xl bg-zinc-200/60 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-700 dark:text-zinc-200 text-xs font-mono font-semibold transition" title="Tốc độ">
            1.0x
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachAudioListeners(state, registerCleanup) {
  const audio = document.getElementById('corePreviewAudio');
  const playBtn = document.getElementById('btnAudioPlayPause');
  const iconPlay = document.getElementById('iconAudioPlay');
  const iconPause = document.getElementById('iconAudioPause');
  const scrubber = document.getElementById('audioScrubber');
  const currentTimeEl = document.getElementById('audioCurrentTime');
  const durationEl = document.getElementById('audioTotalDuration');
  const loopBtn = document.getElementById('btnToggleLoop');
  const speedBtn = document.getElementById('btnAudioSpeed');

  if (!audio) return;

  registerCleanup(() => {
    try { audio.pause(); audio.src = ''; } catch {}
  });

  const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  let speedIdx = 2; // 1.0x

  const setPlaying = (isPlaying) => {
    if (isPlaying) {
      iconPlay?.classList.add('hidden');
      iconPause?.classList.remove('hidden');
    } else {
      iconPlay?.classList.remove('hidden');
      iconPause?.classList.add('hidden');
    }
  };

  playBtn?.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
  });

  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => setPlaying(false));

  audio.addEventListener('loadedmetadata', () => {
    if (durationEl) durationEl.textContent = formatDuration(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (currentTimeEl) currentTimeEl.textContent = formatDuration(audio.currentTime);
    if (scrubber && audio.duration) {
      scrubber.value = ((audio.currentTime / audio.duration) * 100).toString();
    }
  });

  scrubber?.addEventListener('input', (e) => {
    if (audio.duration) {
      audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
    }
  });

  loopBtn?.addEventListener('click', () => {
    audio.loop = !audio.loop;
    loopBtn.classList.toggle('text-indigo-600', audio.loop);
    loopBtn.classList.toggle('dark:text-indigo-400', audio.loop);
  });

  speedBtn?.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    const speed = SPEEDS[speedIdx];
    audio.playbackRate = speed;
    if (speedBtn) speedBtn.textContent = `${speed}x`;
  });

  // Resilient blob recovery fallback if direct audio stream errors
  audio.addEventListener('error', async () => {
    try {
      const res = await fetch(state.viewUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        registerCleanup(() => URL.revokeObjectURL(blobUrl));
        audio.src = blobUrl;
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio fallback recovery failed:', e);
    }
  });
}
