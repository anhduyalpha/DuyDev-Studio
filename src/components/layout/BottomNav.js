/**
 * PWA Tactile Bottom Navigation Dock (Mobile Adaptive)
 */

export function renderBottomNav(activeRoute = '') {
  const isDashboard = !activeRoute || activeRoute === '' || activeRoute === '#' || activeRoute === '#dashboard';
  const isUtility = activeRoute.startsWith('#storage') || activeRoute.startsWith('#tool/storage') || activeRoute.startsWith('#tool/studocu') || activeRoute.startsWith('#tool/hash');
  const isPdf = activeRoute.startsWith('#tool/pdf');
  const isArchive = activeRoute === '#archive';
  const isSettings = activeRoute === '#settings' || activeRoute === '#server' || activeRoute === '#trash' || activeRoute === '#history';

  const navItem = (href, icon, label, isActive) => `
    <a href="${href}" class="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl flex-1 transition-all duration-150 active:scale-95 ${
      isActive 
        ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/90 dark:bg-white/[0.08] shadow-2xs' 
        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white font-medium'
    }">
      <i data-lucide="${icon}" class="w-5 h-5"></i>
      <span class="text-[11px] font-semibold mt-1 tracking-tight">${label}</span>
    </a>
  `;

  return `
    <nav class="md:hidden fixed bottom-3 left-3 right-3 z-40 max-w-md mx-auto rounded-2xl p-1.5 flex items-center justify-around shadow-[0_12px_32px_rgba(0,0,0,0.45)] border border-zinc-200/90 dark:border-white/[0.14] bg-white/95 dark:bg-[#131317]/95 backdrop-blur-2xl safe-bottom">
      ${navItem('#', 'layout-grid', 'Trang chủ', isDashboard)}
      ${navItem('#storage', 'hard-drive', 'Tiện ích', isUtility)}
      ${navItem('#tool/pdf-studio', 'file-text', 'PDF', isPdf)}
      ${navItem('#archive', 'archive', 'File nén', isArchive)}
      ${navItem('#settings', 'settings', 'Cài đặt', isSettings)}
    </nav>
  `;


}
