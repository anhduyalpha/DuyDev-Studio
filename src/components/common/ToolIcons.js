/**
 * DuyDev Studio - Proprietary Tool Icon System (DS Dual-Mode Vector Glyphs)
 * 
 * Handcrafted 24x24 vector glyphs designed specifically for DuyDev Studio tool suites.
 * Each icon enforces a 3-tier depth hierarchy:
 * 1. Base Silhouette / Surface Plane (Soft tint duotone fill)
 * 2. Structural Line Anatomy (Crisp contours: stroke-zinc-700 in light, stroke-zinc-200 in dark)
 * 3. Chromatic Engine Spark (Dynamic accent highlight: var(--accent-contrast) in light, var(--accent) in dark)
 */

export const TOOL_ICONS = {
  // 1. PDF Studio (PyMuPDF Vector Engine: Dual documents with bezier curve & control nodes)
  'pdf-studio': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Under-sheet Surface -->
      <rect x="4" y="3" width="11" height="15" rx="2" class="fill-amber-500/10 dark:fill-amber-400/15 stroke-amber-600/30 dark:stroke-amber-400/30 transition-colors duration-200" stroke-width="1.2" />
      <!-- Layer 2: Main Document Frame with Folded Corner -->
      <path d="M8 7h6l4 4v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" class="fill-white/80 dark:fill-zinc-900/80 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M14 7v4h4" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Layer 3: Vector Bezier Curve & Anchor Nodes -->
      <path d="M9 17c1.5-3 3.5 1 5-2" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="9" cy="17" r="1.2" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <circle cx="14" cy="15" r="1.2" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <rect x="10.5" y="11" width="1.5" height="1.5" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
    </svg>
  `,

  // 2. Tạo Bài Tập Trắc Nghiệm (A4 Blueprint & Agnes AI Neural Spark)
  'quiz-generator': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: A4 Exam Sheet Surface -->
      <rect x="4" y="3" width="16" height="18" rx="2" class="fill-purple-500/10 dark:fill-purple-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <!-- Layer 2: Question Rows -->
      <path d="M8 8h5 M8 12h4 M8 16h6" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.5" stroke-linecap="round" />
      <!-- Calibrated Choice Radio Check -->
      <circle cx="15.5" cy="12" r="1.75" class="stroke-purple-600 dark:stroke-purple-400 stroke-1 fill-purple-500/20 transition-colors duration-200" />
      <path d="M14.7 12l.6.6 1.4-1.4" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Layer 3: Agnes AI Neural Spark -->
      <path d="M18 4.5l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
    </svg>
  `,

  // 3. Soi Tệp Nén (Zero-Extraction Vault with Optical Directory Tree Loupe)
  'archive-inspect': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Archive Cabinet Vault -->
      <rect x="3" y="4" width="18" height="16" rx="2.5" class="fill-sky-500/10 dark:fill-sky-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <!-- Layer 2: Compression Zipper Spine -->
      <path d="M7 4v16" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.4" stroke-dasharray="2 2" />
      <rect x="5.5" y="8" width="3" height="4" rx="1" class="fill-zinc-200 dark:fill-zinc-700 stroke-zinc-700 dark:stroke-zinc-300 transition-colors duration-200" stroke-width="1.2" />
      <!-- Layer 3: Zero-Extraction Optical Loupe with Internal Tree Nodes -->
      <circle cx="14.5" cy="11.5" r="4" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] fill-white/90 dark:fill-zinc-900/90 transition-colors duration-200" stroke-width="1.8" />
      <path d="M17.5 14.5L20.5 17.5" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="2" stroke-linecap="round" />
      <path d="M13 10h3 M13 10v3 M14.5 13h1.5" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `,

  // 4. Nén Tệp ZIP (Inward Mechanical Compression Jaws & Consolidator)
  'server-archive': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Compression Base Plates -->
      <rect x="4" y="3" width="16" height="4" rx="1.5" class="fill-sky-500/15 dark:fill-sky-400/20 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.5" />
      <rect x="4" y="17" width="16" height="4" rx="1.5" class="fill-sky-500/15 dark:fill-sky-400/20 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.5" />
      <!-- Layer 2: Consolidated Archive Bundle -->
      <rect x="6" y="9" width="12" height="6" rx="1.5" class="fill-white/60 dark:fill-zinc-900/60 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <path d="M10 9v6 M14 9v6" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.2" stroke-dasharray="1 1.5" />
      <!-- Layer 3: Dual Inward Force Chevrons -->
      <path d="M12 4.5v3 M10 6l2 2 2-2" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12 19.5v-3 M10 18l2-2 2 2" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,

  // 5. File Converter (Aerodynamic Transcode Vortex with Core Conversion Crystal)
  'universal-converter': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Ambient Orbit Trace -->
      <circle cx="12" cy="12" r="8" class="stroke-indigo-500/20 dark:stroke-indigo-400/20 transition-colors duration-200" stroke-width="1.2" stroke-dasharray="2 3" />
      <!-- Layer 2: Vector Transcode Sweeps -->
      <path d="M19 12a7 7 0 0 1-7 7 7.05 7.05 0 0 1-5.5-2.6l-1.5 1.6" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linecap="round" />
      <path d="M5 12a7 7 0 0 1 7-7 7.05 7.05 0 0 1 5.5 2.6l1.5-1.6" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linecap="round" />
      <path d="M20 7v3.5h-3.5" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M4 17v-3.5h3.5" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Layer 3: Central Conversion Prism Diamond -->
      <polygon points="12,8.5 15,12 12,15.5 9,12" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200 opacity-90" />
    </svg>
  `,

  // 6. Văn Bản & Tài Liệu (Markdown Syntax Partition to Formatted Document)
  'markdown-docs': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Base Sheet -->
      <rect x="4" y="3" width="16" height="18" rx="2" class="fill-purple-500/10 dark:fill-purple-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <!-- Layer 2: Markdown Syntax Column (Left) -->
      <path d="M6.5 8h3 M6.5 10.5h3 M7.2 6.8v4.8 M8.8 6.8v4.8" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
      <path d="M6.5 14v4" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
      <path d="M8.5 14.5h2.5 M8.5 17h2" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
      <!-- Morph Partition Line -->
      <path d="M12 5v14" class="stroke-zinc-300 dark:stroke-zinc-600 transition-colors duration-200" stroke-width="1" stroke-dasharray="1.5 2" />
      <!-- Layer 3: Styled Typographic Sheet (Right) -->
      <rect x="14" y="7" width="4.5" height="2" rx="0.5" class="fill-zinc-800 dark:fill-zinc-200 transition-colors duration-200" />
      <path d="M14 11.5h4 M14 14h3 M14 16.5h3.5" class="stroke-zinc-600 dark:stroke-zinc-300 transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `,

  // 7. QR Studio (Concentric Matrix Targets with Central VietQR Lightning Node)
  'qr-multi': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Substrate Matrix Frame -->
      <rect x="3" y="3" width="18" height="18" rx="3" class="fill-emerald-500/10 dark:fill-emerald-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <!-- Layer 2: 3 Concentric Finder Targets -->
      <rect x="5.5" y="5.5" width="4.5" height="4.5" rx="1" class="stroke-zinc-800 dark:stroke-zinc-100 transition-colors duration-200" stroke-width="1.4" />
      <rect x="7" y="7" width="1.5" height="1.5" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <rect x="14" y="5.5" width="4.5" height="4.5" rx="1" class="stroke-zinc-800 dark:stroke-zinc-100 transition-colors duration-200" stroke-width="1.4" />
      <rect x="15.5" y="7" width="1.5" height="1.5" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <rect x="5.5" y="14" width="4.5" height="4.5" rx="1" class="stroke-zinc-800 dark:stroke-zinc-100 transition-colors duration-200" stroke-width="1.4" />
      <rect x="7" y="15.5" width="1.5" height="1.5" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <!-- Layer 3: VietQR Payment Lightning Spark -->
      <path d="M16 12.5l-2.5 3h2.5l-1 3.5 3.5-4h-2.5z" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
    </svg>
  `,

  // 8. Quét Mã QR (Optical Viewfinder Bracket Reticle & Laser Sweep Emitter)
  'qr-scan': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Optical Corner Viewfinder Brackets -->
      <path d="M4 8V5a1 1 0 0 1 1-1h3" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
      <path d="M16 4h3a1 1 0 0 1 1 1v3" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
      <path d="M16 20h3a1 1 0 0 0 1-1v-3" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
      <!-- Layer 2: Matrix Data Targets -->
      <rect x="8" y="7" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500 transition-colors duration-200" />
      <rect x="14" y="7" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500 transition-colors duration-200" />
      <rect x="8" y="15" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500 transition-colors duration-200" />
      <rect x="14" y="15" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500 transition-colors duration-200" />
      <!-- Layer 3: High-Intensity Laser Line with Center Emitter -->
      <line x1="3" y1="12" x2="21" y2="12" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="12" r="2" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
    </svg>
  `,

  // 9. ViewSplit (Multi-Pane Split Canvas, Center Wipe Gripper & Pixel Loupe)
  'view-split': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Split Viewport Canvas -->
      <rect x="3" y="4" width="18" height="16" rx="2.5" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <rect x="3" y="4" width="9" height="16" rx="2" class="fill-cyan-500/15 dark:fill-cyan-400/20 transition-colors duration-200" />
      <!-- Layer 2: Wipe Divider Line & Gripper -->
      <line x1="12" y1="3" x2="12" y2="21" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="12" r="2.8" class="fill-white dark:fill-zinc-900 stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.6" />
      <path d="M11 11l-1 1 1 1 M13 11l1 1-1 1" class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Layer 3: Right Pane Pixel Inspector Loupe -->
      <circle cx="16.5" cy="7.5" r="2" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.2" />
      <rect x="16" y="7" width="1" height="1" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
    </svg>
  `,

  // 10. Mã Băm & Base64 (Cryptographic Integrity Shield with Hash Matrix & Verified Seal)
  'hash-checksum': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Cryptographic Shield Perimeter -->
      <path d="M12 2.5L4 6v6.2c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8V6l-8-3.5z" class="fill-slate-500/10 dark:fill-slate-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linejoin="round" />
      <!-- Layer 2: Central Hash Grid # -->
      <path d="M9.5 9.5h5 M9.5 13.5h5 M11 8v7 M13 8v7" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
      <!-- Layer 3: Verified Integrity Seal -->
      <circle cx="12" cy="11.5" r="2.8" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900 transition-colors duration-200" stroke-width="1.2" />
      <path d="M10.8 11.5l.8.8 1.6-1.6" class="stroke-white dark:stroke-zinc-900 transition-colors duration-200" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,

  // 11. Studocu Downloader (Academic Deck Slide Extractor & Downward Stream)
  'studocu-dl': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Source Document Deck / Slide Stack -->
      <rect x="5" y="3" width="14" height="6" rx="1.5" class="fill-indigo-500/15 dark:fill-indigo-400/20 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.5" />
      <path d="M7 6h6" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.2" stroke-linecap="round" />
      <!-- Layer 2: Output Document Tray -->
      <path d="M6 15h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z" class="fill-white/80 dark:fill-zinc-900/80 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <!-- Layer 3: High-Speed Downward Stream Arrow -->
      <line x1="12" y1="8" x2="12" y2="16" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="2" stroke-linecap="round" />
      <path d="M9 13.5l3 3 3-3" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,

  // 12. Bộ Nhớ Lưu Trữ (Solid Dual-Bay NVMe Storage Enclosure & Optical Activity LED)
  'storage': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <!-- Layer 1: Top NVMe Bay -->
      <rect x="3" y="4" width="18" height="6.5" rx="2" class="fill-indigo-500/10 dark:fill-indigo-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <line x1="12" y1="7.25" x2="17" y2="7.25" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
      <circle cx="6.5" cy="7.25" r="1.2" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <!-- Layer 2: Bottom NVMe Bay -->
      <rect x="3" y="13.5" width="18" height="6.5" rx="2" class="fill-indigo-500/10 dark:fill-indigo-400/15 stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" />
      <line x1="12" y1="16.75" x2="17" y2="16.75" class="stroke-zinc-400 dark:stroke-zinc-500 transition-colors duration-200" stroke-width="1.3" stroke-linecap="round" />
      <circle cx="6.5" cy="16.75" r="1.2" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <!-- Layer 3: Active Device Bus Connector -->
      <path d="M9 10.5v3" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  `
};

/**
 * Render a tool icon by ID with automatic dual-mode adaptation.
 * Gracefully falls back to Lucide if the tool is not in the custom catalog.
 * 
 * @param {string} toolId - Unique identifier of the tool
 * @param {string} fallbackLucideIcon - Fallback Lucide icon name
 * @param {string} className - Tailwind sizing & utility classes
 * @returns {string} SVG HTML string
 */
export function renderToolIcon(toolId, fallbackLucideIcon = 'box', className = 'w-6 h-6') {
  const iconRenderer = TOOL_ICONS[toolId];
  if (iconRenderer) {
    return iconRenderer(className);
  }
  return `<i data-lucide="${fallbackLucideIcon}" class="${className}"></i>`;
}
