/**
 * SoundVolumeModal.js
 * Admin & User Procedural Web Audio Amplification & Sound Tuning Modal
 * DuyDev Studio Impeccable Design Standards
 */

import { soundEngine } from '../../utilities/soundEngine.js';

let activeModalElement = null;

export function openSoundVolumeModal() {
  if (typeof document === 'undefined') return;

  // If already open, do not duplicate
  if (document.getElementById('soundVolumeModalContainer')) {
    return;
  }

  const currentVolume = soundEngine.getVolume();
  const currentPercent = Math.round(currentVolume * 100);
  const isEnabled = soundEngine.isEnabled();
  const diag = soundEngine.getAudioDiagnostics();

  const modalHtml = `
    <div id="soundVolumeModalContainer" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="soundModalTitle">
      <div id="soundVolumeModalCard" class="relative w-full max-w-lg bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col p-5 sm:p-6 space-y-5 animate-scaleUp">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <i data-lucide="sliders" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 id="soundModalTitle" class="font-bold text-base text-zinc-900 dark:text-white">Khuếch Đại Âm Thanh</h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Điều chỉnh âm lượng phản hồi hệ thống (Web & APK)</p>
            </div>
          </div>
          <button id="btnCloseSoundVolumeModal" type="button" class="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer" aria-label="Đóng">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Mute/Unmute Switch & Master Status -->
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.05]">
          <div class="flex items-center gap-3">
            <div id="soundModalStatusIcon" class="w-8 h-8 rounded-lg ${isEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-white/10 text-zinc-500'} flex items-center justify-center">
              <i data-lucide="${isEnabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-zinc-900 dark:text-white">Âm thanh phản hồi</p>
              <p id="soundModalStatusText" class="text-xs text-zinc-500 dark:text-zinc-400">${isEnabled ? 'Đang bật' : 'Đang tắt (Muted)'}</p>
            </div>
          </div>
          <button id="btnSoundModalToggleMute" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${isEnabled ? 'bg-zinc-200/80 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-800 dark:text-white border-zinc-300 dark:border-white/10' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'}">
            ${isEnabled ? 'Tắt âm' : 'Bật âm'}
          </button>
        </div>

        <!-- Volume Amplification Slider -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label for="soundVolumeSlider" class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span>Độ khuếch đại (Gain)</span>
              <span id="soundVolumeMultiplierLabel" class="text-[11px] font-mono text-zinc-400">(${(currentPercent / 100).toFixed(2)}x)</span>
            </label>
            <span id="soundVolumePercentBadge" class="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              ${currentPercent}%
            </span>
          </div>

          <div class="relative flex items-center">
            <input 
              type="range" 
              id="soundVolumeSlider" 
              min="0" 
              max="250" 
              step="5" 
              value="${currentPercent}" 
              class="w-full h-2 bg-zinc-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <!-- Quick Presets -->
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <button type="button" data-preset="50" class="btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${currentPercent === 50 ? 'bg-indigo-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
              50%
            </button>
            <button type="button" data-preset="100" class="btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${currentPercent === 100 ? 'bg-indigo-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
              100% (Tiêu chuẩn)
            </button>
            <button type="button" data-preset="150" class="btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${currentPercent === 150 ? 'bg-indigo-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
              150% (Lớn)
            </button>
            <button type="button" data-preset="200" class="btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${currentPercent === 200 ? 'bg-indigo-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
              200% (Khuếch đại cao)
            </button>
            <button type="button" data-preset="250" class="btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${currentPercent === 250 ? 'bg-indigo-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5'}">
              250% (Tối đa)
            </button>
          </div>
        </div>

        <!-- Live Sound Preview Buttons -->
        <div class="space-y-2 border-t border-zinc-100 dark:border-white/5 pt-3">
          <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nghe thử âm thanh trực tiếp:</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button type="button" data-test="jobComplete" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="bell-ring" class="w-3.5 h-3.5 text-indigo-500"></i>
              <span>Hoàn thành</span>
            </button>
            <button type="button" data-test="start" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="play" class="w-3.5 h-3.5 text-emerald-500"></i>
              <span>Bắt đầu</span>
            </button>
            <button type="button" data-test="notification" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="message-square" class="w-3.5 h-3.5 text-blue-500"></i>
              <span>Thông báo</span>
            </button>
            <button type="button" data-test="error" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-rose-50 dark:bg-white/[0.05] dark:hover:bg-rose-500/10 text-zinc-800 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-500"></i>
              <span>Báo lỗi</span>
            </button>
            <button type="button" data-test="toggle" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="toggle-right" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Micro-Click</span>
            </button>
            <button type="button" data-test="themeLight" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-amber-50 dark:bg-white/[0.05] dark:hover:bg-amber-500/10 text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="sun" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Theme Sáng</span>
            </button>
            <button type="button" data-test="themeDark" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-indigo-50 dark:bg-white/[0.05] dark:hover:bg-indigo-500/10 text-zinc-800 dark:text-zinc-200 hover:text-indigo-400 dark:hover:text-indigo-300 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="moon" class="w-3.5 h-3.5 text-indigo-400"></i>
              <span>Theme Tối</span>
            </button>
            <button type="button" data-test="appUpdate" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-cyan-50 dark:bg-white/[0.05] dark:hover:bg-cyan-500/10 text-zinc-800 dark:text-zinc-200 hover:text-cyan-600 dark:hover:text-cyan-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-cyan-500"></i>
              <span>Cập nhật Web</span>
            </button>
            <button type="button" data-test="sovereignBlade" class="btn-test-sound min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-amber-50 dark:bg-white/[0.05] dark:hover:bg-amber-500/10 text-zinc-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 border border-zinc-200/80 dark:border-white/5 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer col-span-2 sm:col-span-1">
              <i data-lucide="sun-medium" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Gươm Ánh Sáng (LR)</span>
            </button>
          </div>
        </div>

        <!-- Hardware & Mobile Diagnostics Footer -->
        <div class="p-3 rounded-xl bg-zinc-100/70 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/5 text-[11px] space-y-1.5 text-zinc-500 dark:text-zinc-400">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-2 h-2 rounded-full ${diag.state === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
              Audio Engine: <strong class="uppercase font-mono">${diag.state}</strong>
            </span>
            <button id="btnSoundModalUnlock" type="button" class="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-semibold">
              Kích hoạt ngay
            </button>
          </div>
          <p class="leading-relaxed text-[11px] text-zinc-400 dark:text-zinc-500">
            * Trên điện thoại & APK: Âm thanh chạy qua kênh Media. Hãy tăng âm lượng thiết bị để nghe rõ nhất.
          </p>
        </div>

      </div>
    </div>
  `.trim();

  const mount = document.createElement('div');
  mount.innerHTML = modalHtml;
  const modalEl = mount.firstElementChild;
  document.body.appendChild(modalEl);
  activeModalElement = modalEl;

  if (window.lucide) {
    window.lucide.createIcons({ root: modalEl });
  }

  // Attach Listeners
  const close = () => {
    modalEl.remove();
    activeModalElement = null;
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);

  document.getElementById('btnCloseSoundVolumeModal')?.addEventListener('click', close);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  // Slider change
  const slider = document.getElementById('soundVolumeSlider');
  const badge = document.getElementById('soundVolumePercentBadge');
  const multLabel = document.getElementById('soundVolumeMultiplierLabel');

  const updateSliderUI = (pct) => {
    if (badge) badge.textContent = `${pct}%`;
    if (multLabel) multLabel.textContent = `(${(pct / 100).toFixed(2)}x)`;
    // Update preset pills active state
    modalEl.querySelectorAll('.btn-sound-preset').forEach((btn) => {
      const presetVal = parseInt(btn.getAttribute('data-preset'), 10);
      if (presetVal === pct) {
        btn.className = 'btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer bg-indigo-600 text-white';
      } else {
        btn.className = 'btn-sound-preset px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5';
      }
    });
  };

  if (slider) {
    slider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      soundEngine.setVolume(pct / 100);
      updateSliderUI(pct);
    });
  }

  // Preset buttons
  modalEl.querySelectorAll('.btn-sound-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = parseInt(btn.getAttribute('data-preset'), 10);
      if (slider) slider.value = String(pct);
      soundEngine.setVolume(pct / 100);
      updateSliderUI(pct);
      soundEngine.testSound('toggle');
    });
  });

  // Sound test buttons
  modalEl.querySelectorAll('.btn-test-sound').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cue = btn.getAttribute('data-test');
      soundEngine.testSound(cue);
    });
  });

  // Mute toggle inside modal
  const btnMute = document.getElementById('btnSoundModalToggleMute');
  const statusIcon = document.getElementById('soundModalStatusIcon');
  const statusText = document.getElementById('soundModalStatusText');

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      const newEnabled = soundEngine.toggleMute();
      if (newEnabled) {
        soundEngine.testSound('toggle');
      }
      btnMute.textContent = newEnabled ? 'Tắt âm' : 'Bật âm';
      btnMute.className = `px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${newEnabled ? 'bg-zinc-200/80 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-800 dark:text-white border-zinc-300 dark:border-white/10' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'}`;
      if (statusText) statusText.textContent = newEnabled ? 'Đang bật' : 'Đang tắt (Muted)';
      if (statusIcon) {
        statusIcon.className = `w-8 h-8 rounded-lg ${newEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-white/10 text-zinc-500'} flex items-center justify-center`;
        statusIcon.innerHTML = `<i data-lucide="${newEnabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4"></i>`;
        if (window.lucide) window.lucide.createIcons({ root: statusIcon });
      }
    });
  }

  // Force unlock button
  document.getElementById('btnSoundModalUnlock')?.addEventListener('click', () => {
    soundEngine.unlockAudioContext();
    soundEngine.testSound('toggle');
    close();
  });
}

export function closeSoundVolumeModal() {
  if (activeModalElement) {
    activeModalElement.remove();
    activeModalElement = null;
  }
}

if (typeof window !== 'undefined') {
  window.openSoundVolumeModal = openSoundVolumeModal;
  window.closeSoundVolumeModal = closeSoundVolumeModal;
}
