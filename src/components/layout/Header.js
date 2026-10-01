/**
 * Global Header Component (Dark Professional Minimalism)
 */

import { toggleTheme, getStoredTheme, updateThemeUI } from '../../hooks/useTheme.js';
import { storage } from '../../utilities/storage.js';

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

  return `
    <header class="sticky top-0 z-40 w-full glass-panel px-2.5 sm:px-4 lg:px-8 py-2 sm:py-2.5">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-4 min-w-0">
        
        <!-- Left: Clean Branding -->
        <div class="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer select-none shrink-0" onclick="window.location.hash = ''">
          <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-zinc-200/80 dark:bg-white/[0.06] border border-zinc-300 dark:border-white/[0.12] flex items-center justify-center transition hover:bg-zinc-300 dark:hover:bg-white/[0.1]">
            <span class="font-bold text-[10px] sm:text-xs tracking-wider text-zinc-900 dark:text-white">DS</span>
          </div>
          <span class="font-bold text-xs sm:text-base lg:text-lg tracking-tight text-zinc-900 dark:text-[#FAFAFA] whitespace-nowrap">DuyDev Studio</span>
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

        <!-- Right: Controls (All visible, compact on mobile to never overflow) -->
        <div class="flex items-center gap-1 sm:gap-2 shrink-0">

          <!-- Storage Drive Link -->
          <a href="#storage" title="Bộ nhớ lưu trữ" class="inline-flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center text-zinc-700 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-lg sm:rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer">
            <i data-lucide="hard-drive" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
          </a>

          <!-- History Link (Desktop only) -->
          <a href="#history" title="Lịch sử tác vụ" class="hidden sm:inline-flex w-8 h-8 items-center justify-center text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition">
            <i data-lucide="clock" class="w-4 h-4"></i>
          </a>

          <!-- Trash Bin Link -->
          <a href="#trash" id="headerTrashBtn" title="Thùng rác" class="relative inline-flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center text-zinc-700 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg sm:rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
            <span id="headerTrashDot" class="${trashCount > 0 ? '' : 'hidden'} absolute top-0.5 right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500"></span>
          </a>

          <!-- Theme Toggle Button -->
          <button id="btnThemeToggle" title="${isDark ? 'Giao diện sáng' : 'Giao diện tối'}" class="inline-flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-lg sm:rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition cursor-pointer">
            <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
          </button>

          <!-- User Profile Avatar -->
          <div onclick="window.location.hash = '#settings'" title="Cài đặt" class="flex w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-zinc-200 dark:bg-white/[0.06] border border-zinc-300 dark:border-white/[0.12] items-center justify-center font-bold text-[11px] sm:text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer hover:border-zinc-400 dark:hover:border-white/30 transition shrink-0">
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
