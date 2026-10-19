/**
 * AdminSoundControlCard.js - Web Audio Mission Control & Procedural Sound Studio (#admin)
 * Dedicated administrative console for deep acoustic shaping, amplification (0.0x - 2.5x),
 * live sound palette testing, and hardware AudioContext diagnostics.
 * Fully restricted to administrator owner.
 */

import { soundEngine } from '../../utilities/soundEngine.js';

export function renderAdminSoundControlCard() {
  const currentVolume = soundEngine.getVolume();
  const soundVolumePercent = Math.round(currentVolume * 100);
  const isSoundEnabled = soundEngine.isEnabled();
  const audioDiag = soundEngine.getAudioDiagnostics();

  return `
    <div class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xl space-y-5">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-white/5 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <i data-lucide="sliders" class="w-5 h-5 text-orange-500"></i>
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Tuỳ Biến & Kiểm Thử Âm Thanh
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                ADMIN EXCLUSIVE
              </span>
            </h3>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Điều chỉnh khuếch đại master gain (0.0x – 2.5x), kiểm thử 11 âm hiệu và giám sát phần cứng Web Audio API
            </p>
          </div>
        </div>

        <!-- Master Sound Switch -->
        <button 
          type="button" 
          id="btnAdminSoundToggleMute" 
          class="min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer shrink-0 ${isSoundEnabled ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 border-zinc-200 dark:border-white/10' : 'bg-orange-600 hover:bg-orange-500 text-white border-transparent'}"
        >
          <i data-lucide="${isSoundEnabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4"></i>
          <span id="adminSoundToggleText">${isSoundEnabled ? 'Tắt âm hệ thống' : 'Bật âm hệ thống'}</span>
        </button>
      </div>

      <!-- Gain Staging & Amplification Slider -->
      <div class="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 space-y-3.5">
        <div class="flex items-center justify-between">
          <label for="adminSoundVolumeSlider" class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <span>Khuếch đại Master Gain (Gain Staging)</span>
            <span id="adminSoundMultiplierLabel" class="text-[11px] font-mono text-zinc-400">
              (${(soundVolumePercent / 100).toFixed(2)}x)
            </span>
          </label>
          <span id="adminSoundVolumeVal" class="text-xs font-mono font-bold text-orange-600 dark:text-orange-400">
            ${soundVolumePercent}%
          </span>
        </div>

        <input 
          type="range" 
          id="adminSoundVolumeSlider" 
          min="0" 
          max="250" 
          step="5" 
          value="${soundVolumePercent}" 
          class="w-full h-2 bg-zinc-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />

        <!-- Preset Amplification Pills -->
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <button type="button" data-preset="50" class="btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${soundVolumePercent === 50 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
            50%
          </button>
          <button type="button" data-preset="100" class="btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${soundVolumePercent === 100 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
            100% (Tiêu chuẩn)
          </button>
          <button type="button" data-preset="150" class="btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${soundVolumePercent === 150 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
            150% (Lớn)
          </button>
          <button type="button" data-preset="200" class="btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${soundVolumePercent === 200 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
            200% (Khuếch đại cao)
          </button>
          <button type="button" data-preset="250" class="btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${soundVolumePercent === 250 ? 'bg-orange-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
            250% (Tối đa)
          </button>
        </div>
      </div>

      <!-- Live Sound Palette Testing -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <i data-lucide="music" class="w-3.5 h-3.5 text-orange-500"></i>
            <span>Nghe thử bảng âm thanh trực tiếp (Live Sound Palette):</span>
          </p>
          <span class="text-[11px] font-mono text-zinc-400">11 âm hiệu quy chuẩn</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          <button type="button" data-test="jobComplete" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-50 dark:bg-white/[0.05] dark:hover:bg-orange-500/10 text-zinc-800 dark:text-zinc-200 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="bell-ring" class="w-3.5 h-3.5 text-indigo-500"></i>
            <span>Hoàn thành</span>
          </button>
          <button type="button" data-test="start" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-50 dark:bg-white/[0.05] dark:hover:bg-orange-500/10 text-zinc-800 dark:text-zinc-200 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="play" class="w-3.5 h-3.5 text-emerald-500"></i>
            <span>Bắt đầu</span>
          </button>
          <button type="button" data-test="notification" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-50 dark:bg-white/[0.05] dark:hover:bg-orange-500/10 text-zinc-800 dark:text-zinc-200 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="message-square" class="w-3.5 h-3.5 text-blue-500"></i>
            <span>Thông báo</span>
          </button>
          <button type="button" data-test="error" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-rose-50 dark:bg-white/[0.05] dark:hover:bg-rose-500/10 text-zinc-800 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-500"></i>
            <span>Báo lỗi</span>
          </button>
          <button type="button" data-test="toggle" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-50 dark:bg-white/[0.05] dark:hover:bg-orange-500/10 text-zinc-800 dark:text-zinc-200 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="toggle-right" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Micro-Click</span>
          </button>
          <button type="button" data-test="themeLight" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-amber-50 dark:bg-white/[0.05] dark:hover:bg-amber-500/10 text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="sun" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Theme Sáng</span>
          </button>
          <button type="button" data-test="themeDark" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-400 dark:hover:text-indigo-300 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="moon" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span>Theme Tối</span>
          </button>
          <button type="button" data-test="appUpdate" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-cyan-50 dark:bg-white/[0.05] dark:hover:bg-cyan-500/10 text-zinc-800 dark:text-zinc-200 hover:text-cyan-600 dark:hover:text-cyan-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-cyan-500"></i>
            <span>Cập nhật Web</span>
          </button>
          <button type="button" data-test="urStudocu" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-500"></i>
            <span>Studocu UR</span>
          </button>
          <button type="button" data-test="urScribd" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-50 dark:bg-white/[0.05] dark:hover:bg-orange-500/10 text-zinc-800 dark:text-zinc-200 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
            <i data-lucide="flame" class="w-3.5 h-3.5 text-orange-500"></i>
            <span>Scribd UR</span>
          </button>
          <button type="button" data-test="sovereignBlade" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-amber-50 dark:bg-white/[0.05] dark:hover:bg-amber-500/10 text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer col-span-2 sm:col-span-1">
            <i data-lucide="sun-medium" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Gươm Ánh Sáng</span>
          </button>
        </div>
      </div>

      <!-- Hardware & Diagnostics Telemetry -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs py-2.5 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-white/5 text-zinc-500 dark:text-zinc-400">
        <div class="flex flex-wrap items-center gap-3">
          <span class="flex items-center gap-1.5 font-medium">
            <span class="w-2 h-2 rounded-full ${audioDiag.state === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            Audio Engine: <strong class="uppercase font-mono text-zinc-800 dark:text-zinc-200">${audioDiag.state}</strong>
          </span>
          <span class="font-mono text-[11px] text-zinc-400">
            · Profile: ${audioDiag.isMobile ? 'Mobile APK/Browser' : 'Desktop Browser'}
          </span>
          <span class="font-mono text-[11px] text-zinc-400">
            · DynamicsCompressor: ${audioDiag.hasCompressor ? 'ON' : 'OFF'}
          </span>
        </div>
        <button 
          id="btnAdminSoundUnlock" 
          type="button" 
          class="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
        >
          Mở khóa AudioContext
        </button>
      </div>
    </div>
  `;
}

export function attachAdminSoundControlListeners(onRerender) {
  const soundSlider = document.getElementById('adminSoundVolumeSlider');
  const soundVal = document.getElementById('adminSoundVolumeVal');
  const soundMult = document.getElementById('adminSoundMultiplierLabel');

  const updateSoundVolumeUI = (pct) => {
    if (soundVal) soundVal.textContent = `${pct}%`;
    if (soundMult) soundMult.textContent = `(${(pct / 100).toFixed(2)}x)`;
    document.querySelectorAll('.btn-admin-sound-preset').forEach((btn) => {
      const p = parseInt(btn.getAttribute('data-preset'), 10);
      if (p === pct) {
        btn.className = 'btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer bg-orange-600 text-white';
      } else {
        btn.className = 'btn-admin-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5';
      }
    });
  };

  // Slider change
  if (soundSlider) {
    soundSlider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      soundEngine.setVolume(pct / 100);
      updateSoundVolumeUI(pct);
    });
  }

  // Preset buttons
  document.querySelectorAll('.btn-admin-sound-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.getAttribute('data-preset'), 10);
      if (soundSlider) soundSlider.value = String(pct);
      soundEngine.setVolume(pct / 100);
      updateSoundVolumeUI(pct);
      soundEngine.testSound('toggle');
    });
  });

  // Sound test buttons
  document.querySelectorAll('.btn-admin-test-sound').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cue = btn.getAttribute('data-test');
      soundEngine.testSound(cue);
    });
  });

  // Master sound toggle
  const btnMute = document.getElementById('btnAdminSoundToggleMute');
  const toggleText = document.getElementById('adminSoundToggleText');
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      const newEnabled = soundEngine.toggleMute();
      if (newEnabled) {
        soundEngine.testSound('toggle');
      }
      if (toggleText) {
        toggleText.textContent = newEnabled ? 'Tắt âm hệ thống' : 'Bật âm hệ thống';
      }
      btnMute.className = `min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer shrink-0 ${newEnabled ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200 border-zinc-200 dark:border-white/10' : 'bg-orange-600 hover:bg-orange-500 text-white border-transparent'}`;
      btnMute.innerHTML = `<i data-lucide="${newEnabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4"></i><span>${newEnabled ? 'Tắt âm hệ thống' : 'Bật âm hệ thống'}</span>`;
      if (window.lucide) window.lucide.createIcons({ root: btnMute });
    });
  }

  // Force unlock AudioContext
  document.getElementById('btnAdminSoundUnlock')?.addEventListener('click', () => {
    soundEngine.unlockAudioContext();
    soundEngine.testSound('toggle');
    if (typeof onRerender === 'function') {
      onRerender();
    }
  });
}
