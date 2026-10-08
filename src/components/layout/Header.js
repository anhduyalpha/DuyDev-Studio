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
    <header class="sticky top-0 z-40 w-full glass-panel px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        
        <!-- Left: Clean Branding -->
        <div class="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0 group" onclick="window.location.hash = ''">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-white/90 to-zinc-100 dark:from-white/[0.12] dark:to-white/[0.04] backdrop-blur-md border border-zinc-300/80 dark:border-white/[0.18] flex items-center justify-center transition-all duration-200 group-hover:border-indigo-500/50 dark:group-hover:border-indigo-400/50 shadow-xs group-hover:scale-105">
            <span class="font-bold text-xs sm:text-sm tracking-wider text-zinc-900 dark:text-white font-mono">DS</span>
          </div>
          <span class="font-bold text-sm sm:text-base lg:text-lg tracking-tight text-zinc-900 dark:text-white whitespace-nowrap">DuyDev Studio</span>
        </div>

        <!-- Center: Minimalist Search Bar (Desktop) -->
        <div class="hidden md:flex flex-1 max-w-md mx-6">
          <div class="relative w-full group/search">
            <i data-lucide="search" class="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within/search:text-indigo-500 dark:group-focus-within/search:text-indigo-400"></i>
            <input 
              type="text" 
              id="globalSearchInput"
              role="searchbox"
              aria-label="Tìm kiếm công cụ (⌘K)"
              placeholder="Tìm kiếm công cụ..." 
              class="w-full bg-white/80 dark:bg-black/35 backdrop-blur-md border border-zinc-200/90 dark:border-white/[0.1] focus:border-indigo-500/60 dark:focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 rounded-xl pl-10 pr-12 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none transition font-sans shadow-xs"
            >
            <kbd class="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-white/[0.06] rounded border border-zinc-200 dark:border-white/[0.08]">⌘K</kbd>
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
