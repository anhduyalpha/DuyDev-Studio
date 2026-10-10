/**
 * Footer Component (Dark Professional Minimalism)
 */

export function renderFooter() {
  return `
    <footer class="w-full border-t border-zinc-200 dark:border-white/5 px-4 lg:px-8 py-6 mt-auto text-sm text-zinc-600 dark:text-zinc-400 mb-16 md:mb-0">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div class="flex items-center gap-2">
          <span class="font-bold text-zinc-900 dark:text-zinc-200">DuyDev Studio</span>
          <span>•</span>
          <span>Studio riêng của Anh Duy</span>
        </div>

        <div class="flex items-center gap-4 text-zinc-700 dark:text-zinc-300 font-medium">
          <a href="#terms" class="hover:text-black dark:hover:text-white transition">Điều khoản</a>
          <span>•</span>
          <a href="#settings" class="hover:text-black dark:hover:text-white transition">Cài đặt</a>
          <span>•</span>
          <a href="#admin" class="hover:text-orange-500 dark:hover:text-orange-400 transition">Quản trị</a>
        </div>
      </div>
    </footer>
  `;
}
