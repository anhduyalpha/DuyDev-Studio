/**
 * DuyDev Studio - Apple-Grade Proprietary Tool Icon System
 * 
 * Authored to macOS Sequoia / iOS 18 / visionOS design standards:
 * - 3-Tier Physical Depth & Optical Translucency
 * - Directional Specular Gradients (135° Apple Key Light)
 * - Tactile Layering with ambient depth and micro-reflections
 * - Dual-Mode dynamic response: Frosted porcelain & enamel in Light Mode,
 *   Smoked obsidian & luminous neon in Dark Mode.
 */

export const TOOL_ICONS = {
  // 1. PDF Studio (PyMuPDF Vector Engine: Dual frosted sheets, folded foil corner & precision Bézier pen)
  'pdf-studio': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-pdf-base" x1="4" y1="3" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#D97706" stop-opacity="0.10" />
        </linearGradient>
        <linearGradient id="ds-apple-pdf-sheet" x1="7" y1="6" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#F4F4F5" stop-opacity="0.80" />
        </linearGradient>
        <linearGradient id="ds-apple-pdf-curve" x1="8" y1="17" x2="16" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--accent-contrast, #B45309)" />
          <stop offset="100%" stop-color="var(--accent, #F59E0B)" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Under-sheet with Ambient Glow -->
      <rect x="3.5" y="3" width="11.5" height="15" rx="2.5" fill="url(#ds-apple-pdf-base)" class="stroke-amber-500/40 dark:stroke-amber-400/30 transition-colors duration-200" stroke-width="1.2" />

      <!-- Layer 2: Main Document Frame with Folded Corner -->
      <path d="M7.5 6.5h6.5l4.5 4.5v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-11.5a2 2 0 0 1 2-2z"
            fill="url(#ds-apple-pdf-sheet)"
            class="dark:fill-zinc-900/90 stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" stroke-linejoin="round" />
      
      <!-- Folded Flap with Specular Sheen -->
      <path d="M14 6.5v3.5a1 1 0 0 0 1 1h3.5"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 fill-zinc-200/70 dark:fill-zinc-800 transition-colors duration-200"
            stroke-width="1.4" stroke-linejoin="round" />

      <!-- Layer 3: Precision Bézier Vector Curve & Control Nodes -->
      <path d="M8.5 16.5c1.8-3.5 3.8 1.2 5.5-2.2"
            stroke="url(#ds-apple-pdf-curve)"
            stroke-width="1.8" stroke-linecap="round" />
      
      <!-- Tangent Guides & Anchor Diamonds -->
      <line x1="8.5" y1="16.5" x2="10" y2="13.5" class="stroke-amber-600/60 dark:stroke-amber-400/60" stroke-width="0.9" stroke-dasharray="1 1" />
      <circle cx="8.5" cy="16.5" r="1.3" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900 transition-colors duration-200" stroke-width="0.8" />
      <circle cx="14" cy="14.3" r="1.3" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900 transition-colors duration-200" stroke-width="0.8" />
      <rect x="10.8" y="11.8" width="1.6" height="1.6" rx="0.3" class="fill-[var(--accent)] dark:fill-amber-300" transform="rotate(45 11.6 12.6)" />
    </svg>
  `,

  // 2. Tạo Bài Tập Trắc Nghiệm (Apple Books/Notes Exam Blueprint & Agnes AI Holographic Spark)
  'quiz-generator': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-quiz-sheet" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#6D28D9" stop-opacity="0.04" />
        </linearGradient>
        <linearGradient id="ds-apple-quiz-check" x1="14" y1="11" x2="17" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--accent, #8B5CF6)" />
          <stop offset="100%" stop-color="var(--accent-contrast, #6D28D9)" />
        </linearGradient>
      </defs>

      <!-- Layer 1: A4 Exam Blueprint Canvas -->
      <rect x="4" y="3" width="16" height="18" rx="2.5"
            fill="url(#ds-apple-quiz-sheet)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      
      <!-- Top Title Bar -->
      <rect x="7" y="6" width="6" height="1.8" rx="0.9" class="fill-purple-600/30 dark:fill-purple-400/40" />

      <!-- Layer 2: Question Rows & Option Bubble Checks -->
      <line x1="7" y1="10" x2="12.5" y2="10" class="stroke-zinc-400/90 dark:stroke-zinc-500" stroke-width="1.4" stroke-linecap="round" />
      <line x1="7" y1="13.5" x2="12" y2="13.5" class="stroke-zinc-400/90 dark:stroke-zinc-500" stroke-width="1.4" stroke-linecap="round" />
      <line x1="7" y1="17" x2="14.5" y2="17" class="stroke-zinc-400/90 dark:stroke-zinc-500" stroke-width="1.4" stroke-linecap="round" />

      <!-- Unchecked Option Circle -->
      <circle cx="15.5" cy="10" r="1.5" class="stroke-zinc-400 dark:stroke-zinc-600" stroke-width="1" />

      <!-- Checked Option Enamel Badge -->
      <circle cx="15.5" cy="13.5" r="2" fill="url(#ds-apple-quiz-check)" class="stroke-white/80 dark:stroke-zinc-900" stroke-width="0.8" />
      <path d="M14.6 13.5l.6.6 1.4-1.4" class="stroke-white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Layer 3: Agnes AI 4-Point Holographic Neural Spark -->
      <path d="M18 4.2l.6 1.3 1.4.6-1.4.6-.6 1.3-.6-1.3-1.4-.6 1.4-.6z"
            class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
      <circle cx="18" cy="6.1" r="0.6" class="fill-white" />
    </svg>
  `,

  // 3. Soi Tệp Nén (Apple Archive Utility Vault with Optical Crystal Loupe)
  'archive-inspect': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-arch-body" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.16" />
          <stop offset="100%" stop-color="#0284C7" stop-opacity="0.05" />
        </linearGradient>
        <linearGradient id="ds-apple-arch-lens" x1="10" y1="8" x2="18" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#E0F2FE" stop-opacity="0.80" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Titanium Archive Cabinet Vault -->
      <rect x="3" y="4" width="18" height="16" rx="3"
            fill="url(#ds-apple-arch-body)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      
      <!-- Top Lid Seam & Fastener Ridge -->
      <line x1="3" y1="8" x2="21" y2="8" class="stroke-zinc-400/60 dark:stroke-zinc-600" stroke-width="1" />
      <rect x="9.5" y="7" width="5" height="2" rx="0.8" class="fill-zinc-300/80 dark:fill-zinc-700 stroke-zinc-600 dark:stroke-zinc-400" stroke-width="0.8" />

      <!-- Zipper Track Spine -->
      <path d="M6.5 8v12" class="stroke-sky-600/50 dark:stroke-sky-400/40" stroke-width="1.4" stroke-dasharray="1.5 1.5" />

      <!-- Layer 2 & 3: Optical Loupe with Specular Arc & Internal Tree -->
      <circle cx="14" cy="13.5" r="4.2"
              fill="url(#ds-apple-arch-lens)"
              class="dark:fill-zinc-900/90 stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
              stroke-width="1.8" />
      
      <!-- Lens Specular Glint Reflection Arc -->
      <path d="M11.5 11.2a3 3 0 0 1 3.5-.8" class="stroke-white dark:stroke-sky-300/60" stroke-width="1" stroke-linecap="round" />

      <!-- Directory Tree Branches inside Lens -->
      <path d="M12.5 12h3 M12.5 12v3 M14 15h1.5"
            class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200"
            stroke-width="1.3" stroke-linecap="round" />
      <circle cx="12.5" cy="12" r="0.8" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />
      <circle cx="15.5" cy="12" r="0.8" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />
      <circle cx="15.5" cy="15" r="0.8" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />

      <!-- Loupe Ergonomic Handle -->
      <path d="M17.2 16.7L20.5 20"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="2.2" stroke-linecap="round" />
    </svg>
  `,

  // 4. Nén Tệp ZIP (Hydraulic Compression Press & Sealed Container)
  'server-archive': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-clamp-jaw" x1="4" y1="3" x2="20" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.30" />
          <stop offset="100%" stop-color="#0369A1" stop-opacity="0.15" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Top & Bottom Heavy Hydraulic Plates -->
      <rect x="3.5" y="3" width="17" height="4" rx="1.8"
            fill="url(#ds-apple-clamp-jaw)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      <rect x="3.5" y="17" width="17" height="4" rx="1.8"
            fill="url(#ds-apple-clamp-jaw)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />

      <!-- Layer 2: Consolidated Archive Package -->
      <rect x="5.5" y="8.5" width="13" height="7" rx="1.8"
            class="fill-white/80 dark:fill-zinc-900/80 stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      
      <!-- Interlocking ZIP Center Latch -->
      <path d="M9.5 8.5v7 M14.5 8.5v7" class="stroke-zinc-400 dark:stroke-zinc-600" stroke-width="1" stroke-dasharray="1 1.5" />
      <rect x="10.5" y="10.5" width="3" height="3" rx="0.8" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900" stroke-width="0.8" />

      <!-- Layer 3: Symmetrical Inward Compression Force Chevrons -->
      <path d="M12 4.2v2.6 M10.2 5.6l1.8 1.4 1.8-1.4"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12 19.8v-2.6 M10.2 18.4l1.8-1.4 1.8 1.4"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,

  // 5. File Converter (Apple Compressor Dual Möbius Vortex & Refractive Prism Core)
  'universal-converter': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-conv-core" x1="9" y1="8" x2="15" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--accent, #6366F1)" />
          <stop offset="100%" stop-color="var(--accent-contrast, #4338CA)" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Ambient Orbit Velocity Halo -->
      <circle cx="12" cy="12" r="8.2" class="stroke-indigo-500/25 dark:stroke-indigo-400/20" stroke-width="1.2" stroke-dasharray="2 3" />

      <!-- Layer 2: Aerodynamic Transcode Vector Sweeps -->
      <path d="M19.2 12a7.2 7.2 0 0 1-7.2 7.2 7.2 7.2 0 0 1-5.6-2.7l-1.6 1.7"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.6" stroke-linecap="round" />
      <path d="M4.8 12a7.2 7.2 0 0 1 7.2-7.2 7.2 7.2 0 0 1 5.6 2.7l1.6-1.7"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.6" stroke-linecap="round" />

      <!-- Top & Bottom Precision Arrowheads -->
      <path d="M20.2 6.8v3.6h-3.6"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M3.8 17.2v-3.6h3.6"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Layer 3: Central 3D Faceted Diamond Prism -->
      <polygon points="12,8 15.5,12 12,16 8.5,12"
               fill="url(#ds-apple-conv-core)"
               class="stroke-white dark:stroke-zinc-900 shadow-sm"
               stroke-width="1" stroke-linejoin="round" />
      
      <!-- Optical Refraction Glint Facet -->
      <polygon points="12,8 15.5,12 12,12" class="fill-white/40" />
      <circle cx="12" cy="12" r="1.1" class="fill-white" />
    </svg>
  `,

  // 6. Văn Bản & Tài Liệu (Apple Pages Typographic Syntax Sheet)
  'markdown-docs': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-doc-sheet" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.04" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Document Foundation -->
      <rect x="4" y="3" width="16" height="18" rx="2.5"
            fill="url(#ds-apple-doc-sheet)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />

      <!-- Layer 2: Markdown Syntax Column (Left) -->
      <!-- Header Hash # -->
      <path d="M6.2 7.8h3.2 M6.2 10.2h3.2 M7 6.8v4.4 M8.6 6.8v4.4"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="1.3" stroke-linecap="round" />
      
      <!-- Blockquote Bar -->
      <path d="M6.2 13.8v4.2"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="2" stroke-linecap="round" />
      <line x1="8.5" y1="14.8" x2="10.8" y2="14.8" class="stroke-zinc-400 dark:stroke-zinc-500" stroke-width="1.2" stroke-linecap="round" />
      <line x1="8.5" y1="17.2" x2="10.2" y2="17.2" class="stroke-zinc-400 dark:stroke-zinc-500" stroke-width="1.2" stroke-linecap="round" />

      <!-- Subtle Column Dividing Rule -->
      <line x1="12" y1="5.5" x2="12" y2="18.5" class="stroke-zinc-300 dark:stroke-zinc-700" stroke-width="1" stroke-dasharray="1.5 2" />

      <!-- Layer 3: Rendered Typographic Hierarchy (Right) -->
      <rect x="13.8" y="7" width="4.8" height="2.2" rx="0.6" class="fill-zinc-800 dark:fill-zinc-200" />
      <line x1="13.8" y1="11.5" x2="18.2" y2="11.5" class="stroke-zinc-600 dark:stroke-zinc-400" stroke-width="1.4" stroke-linecap="round" />
      <line x1="13.8" y1="14" x2="17.2" y2="14" class="stroke-zinc-600 dark:stroke-zinc-400" stroke-width="1.4" stroke-linecap="round" />
      <line x1="13.8" y1="16.5" x2="18" y2="16.5" class="stroke-zinc-600 dark:stroke-zinc-400" stroke-width="1.4" stroke-linecap="round" />
    </svg>
  `,

  // 7. QR Studio (Apple Wallet Dynamic VietQR Matrix & Central Lightning Node)
  'qr-multi': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-qr-matrix" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#059669" stop-opacity="0.05" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Rounded Matrix Substrate -->
      <rect x="3" y="3" width="18" height="18" rx="3.5"
            fill="url(#ds-apple-qr-matrix)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />

      <!-- Layer 2: 3 Concentric Finder Targets -->
      <!-- Top-Left -->
      <rect x="5.2" y="5.2" width="4.8" height="4.8" rx="1.2" class="stroke-zinc-800 dark:stroke-zinc-100" stroke-width="1.4" />
      <rect x="6.8" y="6.8" width="1.6" height="1.6" rx="0.4" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />

      <!-- Top-Right -->
      <rect x="14" y="5.2" width="4.8" height="4.8" rx="1.2" class="stroke-zinc-800 dark:stroke-zinc-100" stroke-width="1.4" />
      <rect x="15.6" y="6.8" width="1.6" height="1.6" rx="0.4" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />

      <!-- Bottom-Left -->
      <rect x="5.2" y="14" width="4.8" height="4.8" rx="1.2" class="stroke-zinc-800 dark:stroke-zinc-100" stroke-width="1.4" />
      <rect x="6.8" y="15.6" width="1.6" height="1.6" rx="0.4" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />

      <!-- Timing Pattern Dots -->
      <circle cx="12" cy="7.6" r="0.9" class="fill-zinc-500 dark:fill-zinc-400" />
      <circle cx="12" cy="16.4" r="0.9" class="fill-zinc-500 dark:fill-zinc-400" />
      <circle cx="7.6" cy="12" r="0.9" class="fill-zinc-500 dark:fill-zinc-400" />

      <!-- Layer 3: Dynamic VietQR Payment Lightning Spark -->
      <path d="M16.5 12l-3 3.5h3l-1.2 4 4.2-4.8h-3z"
            class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900 transition-colors duration-200"
            stroke-width="0.8" stroke-linejoin="round" />
    </svg>
  `,

  // 8. Quét Mã QR (Apple LiDAR Camera Reticle & Holographic Laser Sweep)
  'qr-scan': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-laser-beam" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--accent, #10B981)" stop-opacity="0.1" />
          <stop offset="50%" stop-color="var(--accent-contrast, #047857)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--accent, #10B981)" stop-opacity="0.1" />
        </linearGradient>
      </defs>

      <!-- Layer 1: 4 VisionOS Viewfinder Precision L-Brackets -->
      <path d="M4 8.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3" class="stroke-zinc-700/80 dark:stroke-zinc-300" stroke-width="2" stroke-linecap="round" />
      <path d="M15.5 4h3a1.5 1.5 0 0 1 1.5 1.5v3" class="stroke-zinc-700/80 dark:stroke-zinc-300" stroke-width="2" stroke-linecap="round" />
      <path d="M4 15.5v3a1.5 1.5 0 0 0 1.5 1.5h3" class="stroke-zinc-700/80 dark:stroke-zinc-300" stroke-width="2" stroke-linecap="round" />
      <path d="M15.5 20h3a1.5 1.5 0 0 0 1.5-1.5v-3" class="stroke-zinc-700/80 dark:stroke-zinc-300" stroke-width="2" stroke-linecap="round" />

      <!-- Layer 2: Matrix Alignment Dots -->
      <rect x="7.8" y="7.2" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500" />
      <rect x="14.2" y="7.2" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500" />
      <rect x="7.8" y="14.8" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500" />
      <rect x="14.2" y="14.8" width="2" height="2" rx="0.5" class="fill-zinc-400 dark:fill-zinc-500" />

      <!-- Layer 3: Holographic Laser Sweep Beam with Core Optical Bead -->
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="url(#ds-apple-laser-beam)" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="12" cy="12" r="2.2" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900 transition-colors duration-200" stroke-width="1" />
      <circle cx="12" cy="12" r="0.8" class="fill-white" />
    </svg>
  `,

  // 9. ViewSplit (Apple Photos Split Canvas, Knurled Slider & OLED Pixel Inspector)
  'view-split': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-split-left" x1="3" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#0891B2" stop-opacity="0.08" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Dual Juxtaposed Comparison Frames -->
      <rect x="3" y="4" width="18" height="16" rx="3"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      <rect x="3" y="4" width="9" height="16" rx="2.5" fill="url(#ds-apple-split-left)" />

      <!-- Layer 2: Central Wipe Slider Bar -->
      <line x1="12" y1="2.8" x2="12" y2="21.2"
            class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"
            stroke-width="2" stroke-linecap="round" />

      <!-- Tactile Circular Knurled Wipe Thumb -->
      <circle cx="12" cy="12" r="3.2"
              class="fill-white dark:fill-zinc-900 stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] shadow-md transition-colors duration-200"
              stroke-width="1.6" />
      <path d="M10.8 11.2l-1 0.8 1 0.8 M13.2 11.2l1 0.8-1 0.8"
            class="stroke-zinc-700 dark:stroke-zinc-200"
            stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Layer 3: OLED Pixel Inspector Crosshair Loupe in Right Pane -->
      <circle cx="16.5" cy="7.8" r="2.2"
              class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] stroke-1 fill-white/80 dark:fill-zinc-900/80" />
      <line x1="16.5" y1="5" x2="16.5" y2="6.2" class="stroke-[var(--accent)]" stroke-width="0.8" />
      <line x1="16.5" y1="9.4" x2="16.5" y2="10.6" class="stroke-[var(--accent)]" stroke-width="0.8" />
      <rect x="15.8" y="7.1" width="1.4" height="1.4" rx="0.3"
            class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />
    </svg>
  `,

  // 10. Mã Băm & Base64 (Apple Security FileVault Crest & Verified Integrity Seal)
  'hash-checksum': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-hash-shield" x1="4" y1="2.5" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#64748B" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#334155" stop-opacity="0.06" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Beveled Security Shield Perimeter -->
      <path d="M12 2.5L4 6v6.2c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8V6l-8-3.5z"
            fill="url(#ds-apple-hash-shield)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.6" stroke-linejoin="round" />

      <!-- Inner Armor Bevel -->
      <path d="M12 4.6L6 7.2v4.8c0 3.8 2.5 7.4 6 8.5 3.5-1.1 6-4.7 6-8.5V7.2l-6-2.6z"
            class="stroke-zinc-400/40 dark:stroke-zinc-600/40" stroke-width="1" />

      <!-- Layer 2: Central Cryptographic Hash Grid # -->
      <path d="M9.2 9.5h5.6 M9.2 13.5h5.6 M10.8 8v7 M13.2 8v7"
            class="stroke-zinc-400 dark:stroke-zinc-500"
            stroke-width="1.3" stroke-linecap="round" />

      <!-- Layer 3: Verified Enamel Medallion with Checkmark -->
      <circle cx="12" cy="11.5" r="3"
              class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900 shadow-md transition-colors duration-200"
              stroke-width="1.2" />
      <path d="M10.8 11.5l.8.8 1.6-1.6" class="stroke-white" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,

  // 11. Studocu Downloader (Cloud Slide Stack & Downward Vector Extraction Stream)
  'studocu-dl': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-dl-stream" x1="12" y1="8" x2="12" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--accent, #6366F1)" />
          <stop offset="100%" stop-color="var(--accent-contrast, #4338CA)" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Top Academic Slide Deck Cards (Stratified) -->
      <rect x="6.5" y="2.8" width="11" height="4" rx="1.5" class="fill-indigo-500/10 stroke-zinc-400/50 dark:stroke-zinc-600" stroke-width="1" />
      <rect x="4.5" y="4.8" width="15" height="5" rx="1.8"
            class="fill-indigo-500/20 dark:fill-indigo-400/20 stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      <line x1="7.5" y1="7.3" x2="13.5" y2="7.3" class="stroke-zinc-500 dark:stroke-zinc-400" stroke-width="1.2" stroke-linecap="round" />

      <!-- Layer 2: Output PDF Binder Tray -->
      <path d="M5.5 15h13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"
            class="fill-white/85 dark:fill-zinc-900/85 stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      
      <!-- Tray Status Notch -->
      <path d="M9.5 15v1.5a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V15" class="stroke-zinc-400 dark:stroke-zinc-500" stroke-width="1" />

      <!-- Layer 3: Precision High-Velocity Downward Suction Stream -->
      <line x1="12" y1="8.5" x2="12" y2="16.5" stroke="url(#ds-apple-dl-stream)" stroke-width="2.2" stroke-linecap="round" />
      <path d="M8.8 13.8l3.2 3.2 3.2-3.2" stroke="url(#ds-apple-dl-stream)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,

  // 12. Bộ Nhớ Lưu Trữ (Mac Studio Dual NVMe Chassis & Optical Activity Diodes)
  'storage': (className = 'w-6 h-6') => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
      <defs>
        <linearGradient id="ds-apple-nvme-bay" x1="3" y1="4" x2="21" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#6366F1" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#4F46E5" stop-opacity="0.06" />
        </linearGradient>
      </defs>

      <!-- Layer 1: Top NVMe Drive Bay -->
      <rect x="3" y="3.8" width="18" height="6.8" rx="2.2"
            fill="url(#ds-apple-nvme-bay)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      <line x1="11.5" y1="7.2" x2="17.5" y2="7.2" class="stroke-zinc-400 dark:stroke-zinc-500" stroke-width="1.3" stroke-linecap="round" />
      
      <!-- Top Bay Optical Status LED with Bezel -->
      <circle cx="6.5" cy="7.2" r="1.6" class="fill-zinc-300 dark:fill-zinc-700 stroke-zinc-400 dark:stroke-zinc-600" stroke-width="0.6" />
      <circle cx="6.5" cy="7.2" r="1" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />

      <!-- Layer 2: Bottom NVMe Drive Bay -->
      <rect x="3" y="13.4" width="18" height="6.8" rx="2.2"
            fill="url(#ds-apple-nvme-bay)"
            class="stroke-zinc-700/80 dark:stroke-zinc-300 transition-colors duration-200"
            stroke-width="1.5" />
      <line x1="11.5" y1="16.8" x2="17.5" y2="16.8" class="stroke-zinc-400 dark:stroke-zinc-500" stroke-width="1.3" stroke-linecap="round" />
      
      <!-- Bottom Bay Optical Status LED with Bezel -->
      <circle cx="6.5" cy="16.8" r="1.6" class="fill-zinc-300 dark:fill-zinc-700 stroke-zinc-400 dark:stroke-zinc-600" stroke-width="0.6" />
      <circle cx="6.5" cy="16.8" r="1" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)]" />

      <!-- Layer 3: High-Speed PCIe Bus Interconnect Lines -->
      <line x1="9" y1="10.6" x2="9" y2="13.4" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)]" stroke-width="1.6" stroke-linecap="round" />
      <line x1="15" y1="10.6" x2="15" y2="13.4" class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)]" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  `
};

/**
 * Render an Apple-grade tool icon by ID with automatic dual-mode adaptation.
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
