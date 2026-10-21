/**
 * AdminSoundControlCard.js - Web Audio Mission Control & Procedural Sound Studio (#admin)
 * Dedicated administrative console for deep acoustic shaping, amplification (0.0x - 2.5x),
 * per-cue independent gain staging, live sound palette testing, and hardware AudioContext diagnostics.
 * Fully restricted to administrator owner.
 */

import { soundEngine } from '../../utilities/soundEngine.js';
import { showToast } from '../../utilities/toast.js';

export const SOUND_CUES_CATALOG = [
  { id: 'jobComplete', label: 'Hoàn thành', subLabel: 'Tam cung C5-E5-G5', icon: 'bell-ring', color: 'indigo' },
  { id: 'start', label: 'Bắt đầu', subLabel: 'Tam cung C4-F4-A4', icon: 'play', color: 'emerald' },
  { id: 'notification', label: 'Thông báo', subLabel: 'Song âm A4-C5', icon: 'message-square', color: 'blue' },
  { id: 'error', label: 'Báo lỗi', subLabel: 'Bình hòa F4-B3', icon: 'alert-circle', color: 'rose' },
  { id: 'toggle', label: 'Micro-Click', subLabel: 'Tactile Click', icon: 'toggle-right', color: 'amber' },
  { id: 'delete', label: 'Xóa mục', subLabel: 'Hút xả đơn lẻ', icon: 'trash-2', color: 'rose' },
  { id: 'deleteAll', label: 'Xóa tất cả', subLabel: 'Chổi quét cộng hưởng', icon: 'trash', color: 'red' },
  { id: 'themeLight', label: 'Theme Sáng', subLabel: 'Bình minh C4-G4-C5', icon: 'sun', color: 'amber' },
  { id: 'themeDark', label: 'Theme Tối', subLabel: 'Hoàng hôn C5-F4-C4', icon: 'moon', color: 'indigo' },
  { id: 'appUpdate', label: 'Cập nhật Web', subLabel: 'Lấp lánh C5-G5-C6', icon: 'sparkles', color: 'cyan' },
  { id: 'urStudocu', label: 'Studocu UR', subLabel: 'Thần thoại UR', icon: 'sparkles', color: 'indigo' },
  { id: 'urScribd', label: 'Scribd UR', subLabel: 'Ngọn lửa UR', icon: 'flame', color: 'orange' },
  { id: 'sovereignBlade', label: 'Gươm Ánh Sáng', subLabel: 'Huyền thoại LR', icon: 'sun-medium', color: 'amber' }
];

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
              Điều chỉnh khuếch đại master gain, cân chỉnh riêng 13 âm hiệu và giám sát phần cứng Web Audio API
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

      <!-- Master Gain Staging & Amplification Slider -->
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

      <!-- Per-Cue Gain Staging Mixer (Adjustable amplification per individual sound 0% to 250%) -->
      <div class="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 dark:border-white/5 pb-3">
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <i data-lucide="sliders-horizontal" class="w-4 h-4 text-orange-500"></i>
              <span>Khuếch đại từng âm hiệu (Per-Sound Gain Mixer)</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                13 KÊNH ĐỘC LẬP
              </span>
            </h4>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Tùy chỉnh độ lớn khuếch đại riêng (0% – 250%) cho từng loại âm hiệu. Bấm icon để nghe thử tức thì.
            </p>
          </div>
          <button 
            type="button" 
            id="btnAdminResetAllCueGains" 
            class="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 bg-white dark:bg-white/[0.05] hover:bg-orange-50 dark:hover:bg-orange-500/10 border border-zinc-200 dark:border-white/10 transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto shadow-2xs active:scale-95"
          >
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Đặt lại 13 âm về 100%</span>
          </button>
        </div>

        <!-- 13 Channel Strips Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          ${SOUND_CUES_CATALOG.map((cue) => {
            const cueGain = soundEngine.getCueGain(cue.id);
            const cuePct = Math.round(cueGain * 100);
            const isCustom = cuePct !== 100;
            return `
              <div class="p-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-white/5 hover:border-orange-500/30 transition space-y-2.5 shadow-2xs">
                <!-- Channel Header: Test Button + Label + Gain Badge -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <button 
                      type="button" 
                      data-test="${cue.id}" 
                      class="btn-admin-test-sound w-8 h-8 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 transition cursor-pointer active:scale-95" 
                      title="Nghe thử âm ${cue.label}"
                      aria-label="Nghe thử âm ${cue.label}"
                    >
                      <i data-lucide="${cue.icon}" class="w-4 h-4 text-${cue.color}-500"></i>
                    </button>
                    <div class="min-w-0">
                      <span class="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">${cue.label}</span>
                      <span class="block text-[10px] text-zinc-400 font-mono truncate">${cue.subLabel}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <span id="cueGainVal_${cue.id}" class="text-xs font-mono font-bold ${isCustom ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-600 dark:text-zinc-400'}">
                      ${cuePct}%
                    </span>
                    <button 
                      type="button" 
                      data-reset-cue="${cue.id}" 
                      class="btn-admin-reset-cue w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-orange-500 transition cursor-pointer ${isCustom ? 'opacity-100' : 'opacity-0 pointer-events-none'}" 
                      title="Đặt lại về 100%"
                      aria-label="Đặt lại về 100%"
                    >
                      <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
                    </button>
                  </div>
                </div>

                <!-- Channel Slider -->
                <div class="space-y-1">
                  <input 
                    type="range" 
                    data-cue-slider="${cue.id}" 
                    min="0" 
                    max="250" 
                    step="5" 
                    value="${cuePct}" 
                    class="cue-gain-slider w-full h-1.5 bg-zinc-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500" 
                    aria-label="Khuếch đại âm ${cue.label}"
                  />
                  <div class="flex justify-between text-[9px] font-mono text-zinc-400 px-0.5">
                    <span>0%</span>
                    <span class="${cuePct === 100 ? 'text-orange-500 font-bold' : ''}">100%</span>
                    <span>250%</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Live Sound Palette Testing -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <i data-lucide="music" class="w-3.5 h-3.5 text-orange-500"></i>
            <span>Nghe thử bảng âm thanh trực tiếp (Live Sound Palette):</span>
          </p>
          <span class="text-[11px] font-mono text-zinc-400">13 âm hiệu quy chuẩn</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          ${SOUND_CUES_CATALOG.map((cue) => `
            <button type="button" data-test="${cue.id}" class="btn-admin-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-orange-50 dark:bg-white/[0.05] dark:hover:bg-orange-500/10 text-zinc-800 dark:text-zinc-200 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="${cue.icon}" class="w-3.5 h-3.5 text-${cue.color}-500"></i>
              <span>${cue.label}</span>
            </button>
          `).join('')}
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

  // Master Gain Slider change
  if (soundSlider) {
    soundSlider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      soundEngine.setVolume(pct / 100);
      updateSoundVolumeUI(pct);
    });
  }

  // Master Gain Preset buttons
  document.querySelectorAll('.btn-admin-sound-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.getAttribute('data-preset'), 10);
      if (soundSlider) soundSlider.value = String(pct);
      soundEngine.setVolume(pct / 100);
      updateSoundVolumeUI(pct);
      soundEngine.testSound('toggle');
    });
  });

  // Sound test buttons (delegated for both Live Palette & Channel Mixer buttons)
  document.querySelectorAll('.btn-admin-test-sound').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cue = btn.getAttribute('data-test');
      soundEngine.testSound(cue);
    });
  });

  // Per-cue Gain Sliders (Individual Channel Adjustments 0% to 250%)
  document.querySelectorAll('.cue-gain-slider').forEach((slider) => {
    const cueId = slider.getAttribute('data-cue-slider');
    const valBadge = document.getElementById(`cueGainVal_${cueId}`);
    const resetBtn = document.querySelector(`.btn-admin-reset-cue[data-reset-cue="${cueId}"]`);

    slider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      soundEngine.setCueGain(cueId, pct / 100);
      if (valBadge) {
        valBadge.textContent = `${pct}%`;
        valBadge.className = `text-xs font-mono font-bold ${pct !== 100 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-600 dark:text-zinc-400'}`;
      }
      if (resetBtn) {
        resetBtn.classList.toggle('opacity-0', pct === 100);
        resetBtn.classList.toggle('pointer-events-none', pct === 100);
        resetBtn.classList.toggle('opacity-100', pct !== 100);
      }
    });

    slider.addEventListener('change', () => {
      soundEngine.testSound(cueId);
    });
  });

  // Individual cue reset buttons (snaps cue back to 100%)
  document.querySelectorAll('.btn-admin-reset-cue').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cueId = btn.getAttribute('data-reset-cue');
      soundEngine.setCueGain(cueId, 1.0);
      const slider = document.querySelector(`.cue-gain-slider[data-cue-slider="${cueId}"]`);
      if (slider) slider.value = '100';
      const valBadge = document.getElementById(`cueGainVal_${cueId}`);
      if (valBadge) {
        valBadge.textContent = '100%';
        valBadge.className = 'text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400';
      }
      btn.classList.add('opacity-0', 'pointer-events-none');
      btn.classList.remove('opacity-100');
      soundEngine.testSound(cueId);
    });
  });

  // Reset all 13 cue gains button
  const btnResetAll = document.getElementById('btnAdminResetAllCueGains');
  if (btnResetAll) {
    btnResetAll.addEventListener('click', () => {
      soundEngine.resetCueGains();
      document.querySelectorAll('.cue-gain-slider').forEach((slider) => {
        slider.value = '100';
      });
      document.querySelectorAll('[id^="cueGainVal_"]').forEach((valBadge) => {
        valBadge.textContent = '100%';
        valBadge.className = 'text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400';
      });
      document.querySelectorAll('.btn-admin-reset-cue').forEach((btn) => {
        btn.classList.add('opacity-0', 'pointer-events-none');
        btn.classList.remove('opacity-100');
      });
      soundEngine.testSound('toggle');
      showToast('Đã đặt lại khuếch đại 13 âm hiệu về chuẩn 100%', 'info');
    });
  }

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
