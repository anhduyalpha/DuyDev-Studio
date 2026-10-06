/**
 * PDF Studio Pro - Semantic Tool Theming System
 * Centralized theme definitions matching each of the 9 specialized PDF tools.
 * 
 * 1. Split (Tách trang): Amber (#f59e0b)
 * 2. Organize (Sắp xếp): Violet (#8b5cf6)
 * 3. Rotate (Xoay trang): Sky (#0284c7)
 * 4. Merge (Ghép PDF): Indigo (#6366f1)
 * 5. Compress (Nén PDF): Emerald (#10b981)
 * 6. Images to PDF (Ảnh sang PDF): Rose (#f43f5e)
 * 7. Extract Images (Trích ảnh): Cyan (#06b6d4)
 * 8. Watermark (Watermark): Gold / Yellow (#eab308)
 * 9. Security (Bảo mật): Crimson / Red (#ef4444)
 * + PDF to DOCX: Blue (#3b82f6)
 */

export const PDF_THEMES = {
  split: {
    id: 'split',
    label: 'Tách trang',
    color: 'amber',
    hex: '#f59e0b',
    icon: 'scissors',
    bgSoft: 'bg-amber-500/10 dark:bg-amber-500/15',
    textSoft: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500/25 dark:border-amber-500/30',
    borderActive: 'border-amber-500 dark:border-amber-500/90',
    ringColor: 'ring-amber-500/30',
    ringTab: 'ring-amber-500/40',
    iconActive: 'text-amber-400 dark:text-amber-600',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
    ctaGradient: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-lg shadow-amber-500/25',
    ctaProgress: 'bg-amber-500/80 text-zinc-950'
  },
  organize: {
    id: 'organize',
    label: 'Sắp xếp',
    color: 'violet',
    hex: '#8b5cf6',
    icon: 'layout-grid',
    bgSoft: 'bg-violet-500/10 dark:bg-violet-500/15',
    textSoft: 'text-violet-600 dark:text-violet-400',
    borderColor: 'border-violet-500/25 dark:border-violet-500/30',
    borderActive: 'border-violet-500 dark:border-violet-500/90',
    ringColor: 'ring-violet-500/30',
    ringTab: 'ring-violet-500/40',
    iconActive: 'text-violet-400 dark:text-violet-600',
    badgeBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25',
    ctaGradient: 'bg-gradient-to-r from-violet-600 via-violet-500 to-violet-600 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25',
    ctaProgress: 'bg-violet-600/80 text-white'
  },
  rotate: {
    id: 'rotate',
    label: 'Xoay trang',
    color: 'sky',
    hex: '#0284c7',
    icon: 'rotate-cw',
    bgSoft: 'bg-sky-500/10 dark:bg-sky-500/15',
    textSoft: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-500/25 dark:border-sky-500/30',
    borderActive: 'border-sky-500 dark:border-sky-500/90',
    ringColor: 'ring-sky-500/30',
    ringTab: 'ring-sky-500/40',
    iconActive: 'text-sky-400 dark:text-sky-600',
    badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25',
    ctaGradient: 'bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500 hover:from-sky-400 hover:to-sky-300 text-zinc-950 shadow-lg shadow-sky-500/25',
    ctaProgress: 'bg-sky-500/80 text-zinc-950'
  },
  merge: {
    id: 'merge',
    label: 'Ghép PDF',
    color: 'indigo',
    hex: '#6366f1',
    icon: 'layers',
    bgSoft: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    textSoft: 'text-indigo-600 dark:text-indigo-400',
    borderColor: 'border-indigo-500/25 dark:border-indigo-500/30',
    borderActive: 'border-indigo-500 dark:border-indigo-500/90',
    ringColor: 'ring-indigo-500/30',
    ringTab: 'ring-indigo-500/40',
    iconActive: 'text-indigo-400 dark:text-indigo-600',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25',
    ctaGradient: 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25',
    ctaProgress: 'bg-indigo-600/80 text-white'
  },
  compress: {
    id: 'compress',
    label: 'Nén PDF',
    color: 'emerald',
    hex: '#10b981',
    icon: 'minimize-2',
    bgSoft: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    textSoft: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500/25 dark:border-emerald-500/30',
    borderActive: 'border-emerald-500 dark:border-emerald-500/90',
    ringColor: 'ring-emerald-500/30',
    ringTab: 'ring-emerald-500/40',
    iconActive: 'text-emerald-400 dark:text-emerald-600',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
    ctaGradient: 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25',
    ctaProgress: 'bg-emerald-600/80 text-white'
  },
  images_to_pdf: {
    id: 'images_to_pdf',
    label: 'Ảnh sang PDF',
    color: 'rose',
    hex: '#f43f5e',
    icon: 'image',
    bgSoft: 'bg-rose-500/10 dark:bg-rose-500/15',
    textSoft: 'text-rose-600 dark:text-rose-400',
    borderColor: 'border-rose-500/25 dark:border-rose-500/30',
    borderActive: 'border-rose-500 dark:border-rose-500/90',
    ringColor: 'ring-rose-500/30',
    ringTab: 'ring-rose-500/40',
    iconActive: 'text-rose-400 dark:text-rose-600',
    badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25',
    ctaGradient: 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white shadow-lg shadow-rose-500/25',
    ctaProgress: 'bg-rose-600/80 text-white'
  },
  extract_images: {
    id: 'extract_images',
    label: 'Trích ảnh',
    color: 'cyan',
    hex: '#06b6d4',
    icon: 'images',
    bgSoft: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    textSoft: 'text-cyan-600 dark:text-cyan-400',
    borderColor: 'border-cyan-500/25 dark:border-cyan-500/30',
    borderActive: 'border-cyan-500 dark:border-cyan-500/90',
    ringColor: 'ring-cyan-500/30',
    ringTab: 'ring-cyan-500/40',
    iconActive: 'text-cyan-400 dark:text-cyan-600',
    badgeBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25',
    ctaGradient: 'bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 hover:from-cyan-400 hover:to-cyan-300 text-zinc-950 shadow-lg shadow-cyan-500/25',
    ctaProgress: 'bg-cyan-500/80 text-zinc-950'
  },
  watermark: {
    id: 'watermark',
    label: 'Watermark',
    color: 'yellow',
    hex: '#eab308',
    icon: 'stamp',
    bgSoft: 'bg-yellow-500/10 dark:bg-yellow-500/15',
    textSoft: 'text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-500/25 dark:border-yellow-500/30',
    borderActive: 'border-yellow-500 dark:border-yellow-500/90',
    ringColor: 'ring-yellow-500/30',
    ringTab: 'ring-yellow-500/40',
    iconActive: 'text-yellow-400 dark:text-yellow-600',
    badgeBg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25',
    ctaGradient: 'bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 hover:from-yellow-400 hover:to-yellow-300 text-zinc-950 shadow-lg shadow-yellow-500/25',
    ctaProgress: 'bg-yellow-500/80 text-zinc-950'
  },
  security: {
    id: 'security',
    label: 'Bảo mật',
    color: 'red',
    hex: '#ef4444',
    icon: 'shield',
    bgSoft: 'bg-red-500/10 dark:bg-red-500/15',
    textSoft: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-500/25 dark:border-red-500/30',
    borderActive: 'border-red-500 dark:border-red-500/90',
    ringColor: 'ring-red-500/30',
    ringTab: 'ring-red-500/40',
    iconActive: 'text-red-400 dark:text-red-600',
    badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25',
    ctaGradient: 'bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/25',
    ctaProgress: 'bg-red-600/80 text-white'
  },
  pdf_to_docx: {
    id: 'pdf_to_docx',
    label: 'PDF sang Word',
    color: 'blue',
    hex: '#3b82f6',
    icon: 'file-text',
    bgSoft: 'bg-blue-500/10 dark:bg-blue-500/15',
    textSoft: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500/25 dark:border-blue-500/30',
    borderActive: 'border-blue-500 dark:border-blue-500/90',
    ringColor: 'ring-blue-500/30',
    ringTab: 'ring-blue-500/40',
    iconActive: 'text-blue-400 dark:text-blue-600',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25',
    ctaGradient: 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25',
    ctaProgress: 'bg-blue-600/80 text-white'
  }
};

/**
 * Returns the semantic theme config for a given PDF tool mode.
 * Falls back to emerald theme if mode is unrecognized.
 * 
 * @param {string} mode
 * @returns {typeof PDF_THEMES.compress}
 */
export function getToolTheme(mode = 'compress') {
  return PDF_THEMES[mode] || PDF_THEMES.compress;
}
