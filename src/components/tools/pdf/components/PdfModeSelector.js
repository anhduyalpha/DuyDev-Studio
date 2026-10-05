/**
 * PdfModeSelector Component (< 100 lines)
 * Segmented mode tabs for PDF Studio Pro
 */

export const PDF_MODE_GROUPS = [
  {
    name: 'Tối ưu & Chuyển đổi',
    modes: [
      { id: 'images_to_pdf', label: 'Ảnh sang PDF', icon: 'image' },
      { id: 'compress', label: 'Nén PDF', icon: 'minimize-2' },
      { id: 'extract_images', label: 'Trích ảnh', icon: 'images' }
    ]
  },
  {
    name: 'Thao tác trang',
    modes: [
      { id: 'merge', label: 'Ghép PDF', icon: 'layers' },
      { id: 'split', label: 'Tách trang', icon: 'scissors' },
      { id: 'rotate', label: 'Xoay trang', icon: 'rotate-cw' },
      { id: 'organize', label: 'Sắp xếp', icon: 'layout-grid' }
    ]
  },
  {
    name: 'Bảo mật',
    modes: [
      { id: 'watermark', label: 'Watermark', icon: 'stamp' },
      { id: 'security', label: 'Bảo mật', icon: 'shield' }
    ]
  }
];

export const PDF_MODES = PDF_MODE_GROUPS.flatMap(g => g.modes);

export function renderPdfModeSelector(activeMode = 'compress', isProcessing = false) {
  return `
    <div class="p-1.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/90 dark:border-white/[0.08] overflow-x-auto custom-scrollbar shadow-xs">
      <div class="flex items-center gap-1.5 min-w-max">
        ${PDF_MODE_GROUPS.map((group, gIdx) => `
          ${gIdx > 0 ? '<div class="w-px h-5 bg-zinc-300 dark:bg-white/10 mx-1 shrink-0"></div>' : ''}
          ${group.modes.map((m) => {
            const isActive = activeMode === m.id;
            return `
              <button type="button" data-mode="${m.id}" ${isProcessing ? 'disabled' : ''}
                class="btn-pdf-mode flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                  isProcessing
                    ? 'opacity-40 cursor-not-allowed pointer-events-none text-zinc-400 dark:text-zinc-600'
                    : 'cursor-pointer ' + (isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm font-bold'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]')
                }">
                <i data-lucide="${m.icon}" class="w-4 h-4 ${isActive ? 'text-amber-400 dark:text-amber-500' : ''}"></i>
                <span>${m.label}</span>
              </button>
            `;
          }).join('')}
        `).join('')}
      </div>
    </div>
  `.trim();
}
