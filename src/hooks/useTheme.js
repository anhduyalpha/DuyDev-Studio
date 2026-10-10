/**
 * useTheme Hook - Dynamic Light & Dark Theme Controller
 */

export function getStoredTheme() {
  const saved = localStorage.getItem('ds_theme');
  return saved === 'dark' ? 'dark' : 'light';
}

export function updateThemeUI(theme) {
  const isDark = theme === 'dark';

  // 1. Header theme toggle button
  const btnHeader = document.getElementById('btnThemeToggle');
  if (btnHeader) {
    btnHeader.innerHTML = isDark
      ? '<i data-lucide="sun" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>'
      : '<i data-lucide="moon" class="w-4 h-4 sm:w-4.5 sm:h-4.5"></i>';
    btnHeader.title = isDark ? 'Giao diện sáng' : 'Giao diện tối';
    btnHeader.setAttribute('aria-label', isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  }

  // 2. Settings page theme toggle button
  const btnServer = document.getElementById('btnServerThemeToggle');
  if (btnServer) {
    btnServer.innerHTML = isDark
      ? '<i data-lucide="sun" class="w-4 h-4"></i> <span>Chuyển sang giao diện sáng</span>'
      : '<i data-lucide="moon" class="w-4 h-4"></i> <span>Chuyển sang giao diện tối</span>';
  }

  const statusText = document.getElementById('serverThemeStatus');
  if (statusText) {
    statusText.textContent = isDark ? 'Giao diện tối' : 'Giao diện sáng';
  }

  // 3. Refresh Lucide icons if available
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

export function applyTheme(theme) {
  const isDark = theme === 'dark';

  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#09090B');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#F4F4F6');
  }

  localStorage.setItem('ds_theme', theme);
  updateThemeUI(theme);

  // Sync native Android system bar colors
  if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.setTheme === 'function') {
    try { window.AndroidBridge.setTheme(isDark); } catch (_) {}
  }

  // Notify listeners
  window.dispatchEvent(new CustomEvent('ds-theme-change', { detail: { theme, isDark } }));
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}

export function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

