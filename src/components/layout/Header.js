/**
 * Global Header Component (Dark Professional Minimalism)
 */

import { toggleTheme, getStoredTheme, updateThemeUI } from '../../hooks/useTheme.js';
import { storage } from '../../utilities/storage.js';
import { getCurrentHighway, switchHighway, probeHighway, HIGHWAYS } from '../../utilities/connectionHighway.js';

export function updateHeaderTrashIndicator() {
  const dot = document.getElementById('headerTrashDot');
  if (dot) {
    const count = storage.getLocalTrash().length;
    dot.classList.toggle('hidden', count <= 0);
  }
}

export function renderHeader() {
  const isDark = getStoredTheme() === 'dark';
  const trashCount = storage.getLocalTrash().length;
  const currentHighway = getCurrentHighway();
  const isDirect = currentHighway.id !== 'cloudflare';

  return `
    <header class="sticky top-0 z-40 w-full glass-panel px-3 sm:px-4 lg:px-8 py-2 sm:py-3">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        <!-- Left: Clean Branding -->
        <div class="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none shrink-0" onclick="window.location.hash = ''">
          <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-zinc-200/80 dark:bg-white/[0.06] border border-zinc-300 dark:border-white/[0.12] flex items-center justify-center transition hover:bg-zinc-300 dark:hover:bg-white/[0.1]">
            <span class="font-bold text-xs sm:text-sm tracking-wider text-zinc-900 dark:text-white">DS</span>
          </div>
          <span class="font-bold text-sm sm:text-base lg:text-lg tracking-tight text-zinc-900 dark:text-[#FAFAFA] whitespace-nowrap">DuyDev Studio</span>
        </div>

        <!-- Center: Minimalist Search Bar (Desktop) -->
        <div class="hidden md:flex flex-1 max-w-md mx-6">
          <div class="relative w-full">
            <i data-lucide="search" class="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="globalSearchInput"
              placeholder="Tìm kiếm công cụ..." 
              class="w-full bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] rounded-xl pl-10 pr-12 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-white/25 transition font-sans shadow-xs"
            >
            <kbd class="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.04] rounded border border-zinc-200 dark:border-white/[0.08]">⌘K</kbd>
          </div>
        </div>

        <!-- Right: Controls -->
        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          ${isDirect ? `
            <span class="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              ${currentHighway.badge}
            </span>
          ` : `
            <span id="highwayHeaderContainer">
              <button id="btnSwitchHighway" style="display: none;" title="Chuyển kết nối" class="items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs cursor-pointer whitespace-nowrap">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i> <span id="btnSwitchHighwayLabel">Tailscale (250 Mbps)</span>
              </button>
            </span>
          `}

          <!-- Storage Drive Link (Desktop/Tablet - Mobile has Tiện ích in BottomNav) -->
          <a href="#storage" title="Bộ nhớ lưu trữ" class="hidden sm:inline-flex p-2 sm:p-2.5 text-zinc-700 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer">
            <i data-lucide="hard-drive" class="w-4 h-4"></i>
          </a>

          <!-- History Link -->
          <a href="#history" title="Lịch sử tác vụ" class="hidden sm:inline-flex p-2 sm:p-2.5 text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition">
            <i data-lucide="clock" class="w-4 h-4"></i>
          </a>

          <!-- Trash Bin Link (Placed immediately next to Theme Toggle) -->
          <a href="#trash" id="headerTrashBtn" title="Thùng rác" class="relative inline-flex items-center justify-center p-1.5 sm:p-2.5 text-zinc-700 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span id="headerTrashDot" class="${trashCount > 0 ? '' : 'hidden'} absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
          </a>

          <!-- Theme Toggle Button -->
          <button id="btnThemeToggle" title="${isDark ? 'Giao diện sáng' : 'Giao diện tối'}" class="p-1.5 sm:p-2.5 text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer">
            <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
          </button>

          <!-- User Profile Avatar (Desktop/Tablet - Mobile has Cài đặt in BottomNav) -->
          <div onclick="window.location.hash = '#settings'" title="Cài đặt" class="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-200 dark:bg-white/[0.06] border border-zinc-300 dark:border-white/[0.12] items-center justify-center font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer hover:border-zinc-400 dark:hover:border-white/30 transition">
            D
          </div>

        </div>

      </div>
    </header>
  `;
}

export function attachHeaderListeners(onSearch) {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => onSearch(e.target.value));
  }

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

  // Probe direct highway (Tailscale or LAN) if on remote domain
  probeHighwayAvailability();

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
}

async function probeHighwayAvailability() {
  if (typeof window === 'undefined') return;
  const current = getCurrentHighway();
  if (current.id !== 'cloudflare') return;

  const btn = document.getElementById('btnSwitchHighway');
  const label = document.getElementById('btnSwitchHighwayLabel');
  if (!btn) return;

  // 1. Probe Tailscale Direct first (highest priority for 4G WAN)
  const tailscale = HIGHWAYS.find(h => h.id === 'tailscale');
  if (tailscale) {
    const tsRes = await probeHighway(tailscale, 400);
    if (tsRes.reachable) {
      if (label) label.textContent = 'Tailscale (250 Mbps)';
      btn.onclick = () => switchHighway(tailscale.url);
      btn.className = 'inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-xs cursor-pointer whitespace-nowrap';
      btn.style.display = 'inline-flex';
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      return;
    }
  }

  // 2. Probe LAN (Home Wi-Fi)
  const lan = HIGHWAYS.find(h => h.id === 'lan');
  if (lan) {
    const lanRes = await probeHighway(lan, 300);
    if (lanRes.reachable) {
      if (label) label.textContent = 'LAN (1 Gbps)';
      btn.onclick = () => switchHighway(lan.url);
      btn.className = 'inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer whitespace-nowrap';
      btn.style.display = 'inline-flex';
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
  }
}
