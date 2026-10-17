/**
 * Global Header Component (Dark Professional Minimalism)
 */

import { toggleTheme, getStoredTheme, updateThemeUI } from '../../hooks/useTheme.js';
import { storage } from '../../utilities/storage.js';
import { soundEngine } from '../../utilities/soundEngine.js';
import { openSoundVolumeModal } from '../common/SoundVolumeModal.js';

export function updateHeaderTrashIndicator() {
  const dot = document.getElementById('headerTrashDot');
  if (dot) {
    const count = storage.getLocalTrash().length;
    dot.classList.toggle('hidden', count <= 0);
  }
}

export function renderHeader() {
  const isDark = getStoredTheme() === 'dark';
  const isSoundEnabled = soundEngine.isEnabled();
  const trashCount = storage.getLocalTrash().length;

  return `
    <header class="sticky top-0 z-40 w-full glass-panel px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        
        <!-- Left: Clean Branding -->
        <div class="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0 group" onclick="window.location.hash = ''">
          <img src="src/assets/logo-ds.svg?v=22.12" alt="DuyDev Studio" class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain transition-all duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-orange-500/30 group-hover:shadow-md group-hover:shadow-orange-500/10 shrink-0" />
          <span class="font-bold text-sm sm:text-base lg:text-lg tracking-tight text-zinc-900 dark:text-white whitespace-nowrap">DuyDev Studio</span>
        </div>

        <!-- Center: Minimalist Search Bar (Desktop - Apple Sequoia Frosted Glass) -->
        <div class="hidden md:flex flex-1 max-w-md mx-6">
          <div class="relative w-full group/search">
            <i data-lucide="search" class="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within/search:text-indigo-500 dark:group-focus-within/search:text-indigo-400"></i>
            <input 
              type="text" 
              id="globalSearchInput"
              role="searchbox"
              aria-label="Tìm kiếm công cụ (⌘K)"
              placeholder="Tìm kiếm công cụ..." 
              class="w-full glass-search rounded-xl pl-10 pr-12 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none transition font-sans"
            >
            <kbd class="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-mono text-zinc-600 dark:text-zinc-300 glass-pill rounded border border-zinc-200/90 dark:border-white/[0.12]">⌘K</kbd>
          </div>
        </div>

        <!-- Right: Controls (Ergonomic touch targets >= 38-44px) -->
        <div class="flex items-center gap-1 sm:gap-2 shrink-0">

          <!-- Storage Drive Link -->
          <a href="#storage" title="Bộ nhớ lưu trữ" aria-label="Bộ nhớ lưu trữ" class="inline-flex w-9 h-9 sm:w-9 sm:h-9 items-center justify-center text-zinc-700 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400 rounded-xl hover:bg-zinc-100/80 dark:hover:bg-white/[0.08] transition cursor-pointer">
            <i data-lucide="hard-drive" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>
          </a>

          <!-- History Link (Desktop only) -->
          <a href="#history" title="Lịch sử tác vụ" aria-label="Lịch sử tác vụ" class="hidden sm:inline-flex w-9 h-9 items-center justify-center text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white rounded-xl hover:bg-zinc-100/80 dark:hover:bg-white/[0.08] transition">
            <i data-lucide="clock" class="w-4.5 h-4.5"></i>
          </a>

          <!-- Trash Bin Link -->
          <a href="#trash" id="headerTrashBtn" title="Thùng rác" aria-label="Thùng rác" class="relative inline-flex w-9 h-9 sm:w-9 sm:h-9 items-center justify-center text-zinc-700 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 rounded-xl hover:bg-zinc-100/80 dark:hover:bg-white/[0.08] transition cursor-pointer">
            <i data-lucide="trash-2" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>
            <span id="headerTrashDot" class="${trashCount > 0 ? '' : 'hidden'} absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#121215]"></span>
          </a>

          <!-- Pure System Status Dot (Non-clickable, Indicator Only) -->
          <div id="headerSystemStatus" 
               role="status"
               aria-label="Trạng thái hệ thống"
               title="Trực tuyến" 
               class="inline-flex items-center justify-center w-6 h-6 select-none">
            <span id="headerSystemDot" class="specular-status-dot specular-status-dot-emerald"></span>
          </div>

          <!-- Sound Toggle & Amplification Button -->
          <button id="btnSoundToggle" 
                  title="${isSoundEnabled ? 'Bấm để bật/tắt, click đúp hoặc giữ để chỉnh khuếch đại âm lượng' : 'Bật âm thanh (Click đúp để chỉnh âm lượng)'}" 
                  aria-label="${isSoundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}" 
                  class="inline-flex w-9 h-9 sm:w-9 sm:h-9 items-center justify-center text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white rounded-xl hover:bg-zinc-100/80 dark:hover:bg-white/[0.08] transition cursor-pointer">
            <i data-lucide="${isSoundEnabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>
          </button>

          <!-- Theme Toggle Button -->
          <button id="btnThemeToggle" title="${isDark ? 'Giao diện sáng' : 'Giao diện tối'}" aria-label="${isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}" class="inline-flex w-9 h-9 sm:w-9 sm:h-9 items-center justify-center text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white rounded-xl hover:bg-zinc-100/80 dark:hover:bg-white/[0.08] transition cursor-pointer">
            <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>
          </button>

          <!-- User Profile Avatar -->
          <div onclick="window.location.hash = '#settings'" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.hash='#settings';}" role="button" tabindex="0" title="Cài đặt hệ thống" aria-label="Cài đặt hệ thống" class="flex w-9 h-9 sm:w-9 sm:h-9 rounded-full bg-zinc-200 dark:bg-white/[0.08] border border-zinc-300 dark:border-white/[0.15] items-center justify-center font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer hover:border-zinc-400 dark:hover:border-white/30 transition shrink-0 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            D
          </div>

        </div>

      </div>
    </header>
  `;
}

export async function syncHeaderSystemTelemetry() {
  const statusEl = document.getElementById('headerSystemStatus');
  const dotEl = document.getElementById('headerSystemDot');
  const labelEl = document.getElementById('headerSystemLabel');
  if (!statusEl || !dotEl) return;

  try {
    const res = await fetch('/api/v1/system/telemetry');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const data = body?.data;

    if (data?.gateway === 'online') {
      const activeJobs = data.queues?.totalActive || 0;
      const isDegraded = data.redis !== 'connected';

      if (activeJobs > 0) {
        dotEl.className = 'specular-status-dot specular-status-dot-amber';
        if (labelEl) {
          labelEl.textContent = `${activeJobs} TÁC VỤ`;
          labelEl.className = 'hidden lg:inline text-[10px] font-semibold tracking-wide text-amber-600 dark:text-amber-400';
        }
        statusEl.title = `Hệ thống: Đang xử lý (${activeJobs} tác vụ)`;
      } else if (isDegraded) {
        dotEl.className = 'specular-status-dot specular-status-dot-amber';
        if (labelEl) {
          labelEl.textContent = 'DEGRADED';
          labelEl.className = 'hidden lg:inline text-[10px] font-semibold tracking-wide text-amber-600 dark:text-amber-400';
        }
        statusEl.title = 'Hệ thống: Tải chậm';
      } else {
        dotEl.className = 'specular-status-dot specular-status-dot-emerald';
        if (labelEl) {
          labelEl.textContent = 'ONLINE';
          labelEl.className = 'hidden lg:inline text-[10px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400';
        }
        statusEl.title = 'Trực tuyến';
      }
    } else {
      throw new Error('Gateway not online');
    }
  } catch {
    dotEl.className = 'specular-status-dot specular-status-dot-rose';
    if (labelEl) {
      labelEl.textContent = 'OFFLINE';
      labelEl.className = 'hidden lg:inline text-[10px] font-semibold tracking-wide text-rose-600 dark:text-rose-400';
    }
    statusEl.title = 'Ngoại tuyến';
  }
}

export function attachHeaderListeners(onSearch) {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => onSearch(e.target.value));
  }

  // Sound toggle & amplification listeners
  const btnSound = document.getElementById('btnSoundToggle');
  const updateSoundUI = (enabled) => {
    if (!btnSound) return;
    btnSound.title = enabled 
      ? 'Bấm để bật/tắt, click đúp hoặc giữ để chỉnh khuếch đại âm lượng' 
      : 'Bật âm thanh (Click đúp để chỉnh âm lượng)';
    btnSound.setAttribute('aria-label', btnSound.title);
    btnSound.innerHTML = `<i data-lucide="${enabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>`;
    if (window.lucide) window.lucide.createIcons({ root: btnSound });
  };

  if (btnSound) {
    let pressTimer = null;
    let isLongPress = false;

    // Single click: toggle mute/unmute (unless long press fired)
    btnSound.addEventListener('click', () => {
      if (isLongPress) {
        isLongPress = false;
        return;
      }
      const newEnabled = soundEngine.toggleMute();
      if (newEnabled) {
        soundEngine.playToggle();
      }
      updateSoundUI(newEnabled);
    });

    // Double-click: open sound amplification modal
    btnSound.addEventListener('dblclick', (e) => {
      e.preventDefault();
      openSoundVolumeModal();
    });

    // Right-click: open sound amplification modal
    btnSound.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openSoundVolumeModal();
    });

    // Long press on mobile touch
    btnSound.addEventListener('touchstart', () => {
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        openSoundVolumeModal();
      }, 400);
    }, { passive: true });

    btnSound.addEventListener('touchend', () => {
      if (pressTimer) clearTimeout(pressTimer);
    });

    btnSound.addEventListener('touchcancel', () => {
      if (pressTimer) clearTimeout(pressTimer);
    });
  }

  // Sync sound state change if toggled elsewhere
  window.addEventListener('ds:sound-state-change', (e) => {
    if (e.detail?.enabled !== undefined) {
      updateSoundUI(e.detail.enabled);
    }
  });

  // Theme toggle listener
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      toggleTheme();
    });
  }

  // Ensure current theme icon is rendered
  updateThemeUI(getStoredTheme());

  // Sync trash indicator on load
  storage.fetchTrash().then(trash => updateHeaderTrashIndicator()).catch(() => {});

  // Keyboard shortcut Cmd/Ctrl + K
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  // Initial telemetry fetch
  syncHeaderSystemTelemetry();

  // Low-frequency background telemetry refresh (60s on mobile/APK, 30s on desktop when active)
  let telemetryInterval = null;
  let lastResumeFetchTime = Date.now();
  const isMobileOrApk = typeof window !== 'undefined' && (Boolean(window.AndroidBridge) || /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || ''));
  const telemetryIntervalMs = isMobileOrApk ? 60000 : 30000;

  const triggerDebouncedResumeSync = () => {
    const now = Date.now();
    if (now - lastResumeFetchTime >= 20000) {
      lastResumeFetchTime = now;
      syncHeaderSystemTelemetry();
    }
  };

  const startTelemetryTimer = () => {
    if (!telemetryInterval) {
      telemetryInterval = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden && document.visibilityState !== 'hidden') {
          syncHeaderSystemTelemetry();
        }
      }, telemetryIntervalMs);
    }
  };
  const stopTelemetryTimer = () => {
    if (telemetryInterval) {
      clearInterval(telemetryInterval);
      telemetryInterval = null;
    }
  };

  startTelemetryTimer();

  // Throttle timer on visibility change to preserve battery & avoid unnecessary wakeups
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || document.visibilityState === 'hidden') {
      stopTelemetryTimer();
    } else {
      triggerDebouncedResumeSync();
      startTelemetryTimer();
    }
  });

  // Handle native Android lifecycle pausing if dispatched
  window.addEventListener('ds:native-app-paused', stopTelemetryTimer);
  window.addEventListener('ds:native-app-resumed', () => {
    triggerDebouncedResumeSync();
    startTelemetryTimer();
  });
  window.addEventListener('ds:visibility-change', (e) => {
    if (e.detail?.hidden) {
      stopTelemetryTimer();
    } else {
      triggerDebouncedResumeSync();
      startTelemetryTimer();
    }
  });
}
