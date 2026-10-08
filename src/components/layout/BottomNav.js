/**
 * PWA Tactile Bottom Navigation Dock (Mobile Adaptive)
 */

export function renderBottomNav(activeRoute = '') {
  const isDashboard = !activeRoute || activeRoute === '' || activeRoute === '#' || activeRoute === '#dashboard';
  const isConverter = activeRoute.startsWith('#tool/universal-converter') || activeRoute.startsWith('#tool/converter') || activeRoute.startsWith('#tool/markdown-docs');
  const isPdf = activeRoute.startsWith('#tool/pdf') || activeRoute.startsWith('#view/pdf') || activeRoute.startsWith('#preview/pdf') || activeRoute.startsWith('#reader/pdf');
  const isArchive = activeRoute === '#archive' || activeRoute.startsWith('#server-archive');
  const isQr = activeRoute.startsWith('#tool/qr');

  const navItem = (href, icon, label, isActive) => `
    <a href="${href}" onclick="if(window.navigator?.vibrate)window.navigator.vibrate(8);" class="flex flex-col items-center justify-center py-1.5 px-1 sm:px-1.5 rounded-xl flex-1 transition-all duration-150 active:scale-95 touch-manipulation select-none min-w-0 ${
      isActive 
        ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/90 dark:bg-white/[0.08] shadow-2xs' 
        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white font-medium'
    }">
      <i data-lucide="${icon}" class="w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}"></i>
      <span class="text-[10px] sm:text-[11px] font-semibold mt-0.5 tracking-tight truncate max-w-[68px] leading-tight text-center">${label}</span>
    </a>
  `;

  return `
    <nav class="md:hidden fixed bottom-3 left-3 right-3 z-40 max-w-md mx-auto rounded-2xl p-1.5 flex items-center justify-around glass-dock safe-bottom">
      ${navItem('#', 'layout-grid', 'Trang chủ', isDashboard)}
      ${navItem('#tool/universal-converter', 'refresh-cw', 'Converter', isConverter)}
      ${navItem('#tool/pdf-studio', 'file-text', 'PDF', isPdf)}
      ${navItem('#archive', 'archive', 'File nén', isArchive)}
      ${navItem('#tool/qr-multi', 'qr-code', 'Mã QR', isQr)}
    </nav>
  `;
}
