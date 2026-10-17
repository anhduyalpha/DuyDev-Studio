/**
 * TierFrameAssets.js - RPG Item Rarity Escalation Assets (DuyDev-Studio)
 * Generates layered architectural & RPG structural assets for the 10-tier system:
 * - Corner Armor Plates & Geometric Filigrees (SVG)
 * - Rotating Icon Runes & Solar/Cosmic Astrolabe Halos (SVG)
 * - Floating Embers & Cosmic Particles
 * - Animated Plasma & Holographic Shimmer Overlays
 *
 * All ornaments strictly hug the 1rem rounded card chassis with zero external clip-art protrusion.
 * 100% GPU composited and stops when `html.app-backgrounded` is present (KI-FIX-023).
 */

export function renderTierStructuralLayers(tierCode) {
  if (!tierCode) return '';
  const code = String(tierCode).toUpperCase();

  switch (code) {
    case 'E':
      // Tier 1: Common / Phổ thông - Flat single-layer border, zero ornaments
      return '';

    case 'D':
      // Tier 2: Standard / Tiêu chuẩn - Cool steel specular highlight at top
      return '<div class="tier-inner-specular pointer-events-none" aria-hidden="true"></div>';

    case 'C':
      // Tier 3: Uncommon / Lục Bảo - Double border, metallic corner chamfer ticks, green mist
      return `
        <div class="tier-corner-ticks pointer-events-none" aria-hidden="true">
          <span class="tick-tl"></span>
          <span class="tick-tr"></span>
          <span class="tick-bl"></span>
          <span class="tick-br"></span>
        </div>
        <div class="tier-emerald-mist pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'B':
      // Tier 4: Rare / Lam Ngọc Tinh Luyện - Silver-blue corner clasps + sweeping metallic shimmer
      return `
        <div class="tier-corner-clasps-b pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 28 28" class="clasp-svg clasp-tl" fill="none"><path d="M2 18V8a6 6 0 0 1 6-6h10" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="8" r="2.5" fill="#3B82F6" stroke="#93C5FD"/></svg>
          <svg viewBox="0 0 28 28" class="clasp-svg clasp-tr" fill="none"><path d="M26 18V8a6 6 0 0 0-6-6H10" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="8" r="2.5" fill="#3B82F6" stroke="#93C5FD"/></svg>
          <svg viewBox="0 0 28 28" class="clasp-svg clasp-bl" fill="none"><path d="M2 10v10a6 6 0 0 0 6 6h10" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="20" r="2.5" fill="#3B82F6" stroke="#93C5FD"/></svg>
          <svg viewBox="0 0 28 28" class="clasp-svg clasp-br" fill="none"><path d="M26 10v10a6 6 0 0 1-6 6H10" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="20" r="2.5" fill="#3B82F6" stroke="#93C5FD"/></svg>
        </div>
        <div class="tier-metallic-shimmer pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'A':
      // Tier 5: Epic / Sử Thi Hoàng Kim - Golden Corner Filigree with amber gem + double gold bezel
      return `
        <div class="tier-gold-filigree-a pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 34 34" class="filigree-svg fil-tl" fill="none">
            <path d="M2 20V8a6 6 0 0 1 6-6h12" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <polygon points="8,8 13,3 18,8 13,13" fill="#B45309" stroke="#FDE68A" stroke-width="1.2"/>
            <circle cx="13" cy="8" r="2" fill="#FBBF24"/>
          </svg>
          <svg viewBox="0 0 34 34" class="filigree-svg fil-tr" fill="none">
            <path d="M32 20V8a6 6 0 0 0-6-6H14" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <polygon points="26,8 21,3 16,8 21,13" fill="#B45309" stroke="#FDE68A" stroke-width="1.2"/>
            <circle cx="21" cy="8" r="2" fill="#FBBF24"/>
          </svg>
          <svg viewBox="0 0 34 34" class="filigree-svg fil-bl" fill="none">
            <path d="M2 14v12a6 6 0 0 0 6 6h12" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <polygon points="8,26 13,21 18,26 13,31" fill="#B45309" stroke="#FDE68A" stroke-width="1.2"/>
            <circle cx="13" cy="26" r="2" fill="#FBBF24"/>
          </svg>
          <svg viewBox="0 0 34 34" class="filigree-svg fil-br" fill="none">
            <path d="M32 14v12a6 6 0 0 1-6 6H14" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <polygon points="26,26 21,21 16,26 21,31" fill="#B45309" stroke="#FDE68A" stroke-width="1.2"/>
            <circle cx="21" cy="26" r="2" fill="#FBBF24"/>
          </svg>
        </div>
        <div class="tier-top-gold-bar pointer-events-none" aria-hidden="true"></div>
        <div class="tier-inner-hairline pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'S':
      // Tier 6: Master / Tử Kim Siêu Việt - Dual Royal Amethyst & Gold corner armor + side energy rails + icon dual halo
      return `
        <div class="tier-corner-armor-s pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 36 36" class="armor-svg arm-tl" fill="none">
            <path d="M2 22V8a6 6 0 0 1 6-6h14" stroke="#9333EA" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M6 22V10a4 4 0 0 1 4-4h12" stroke="#F59E0B" stroke-width="1.5"/>
            <circle cx="8" cy="8" r="2.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
          <svg viewBox="0 0 36 36" class="armor-svg arm-tr" fill="none">
            <path d="M34 22V8a6 6 0 0 0-6-6H14" stroke="#9333EA" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M30 22V10a4 4 0 0 0-4-4H14" stroke="#F59E0B" stroke-width="1.5"/>
            <circle cx="28" cy="8" r="2.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
          <svg viewBox="0 0 36 36" class="armor-svg arm-bl" fill="none">
            <path d="M2 14v14a6 6 0 0 0 6 6h14" stroke="#9333EA" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M6 14v12a4 4 0 0 0 4 4h12" stroke="#F59E0B" stroke-width="1.5"/>
            <circle cx="8" cy="28" r="2.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
          <svg viewBox="0 0 36 36" class="armor-svg arm-br" fill="none">
            <path d="M34 14v14a6 6 0 0 1-6 6H14" stroke="#9333EA" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M30 14v12a4 4 0 0 1-4 4H14" stroke="#F59E0B" stroke-width="1.5"/>
            <circle cx="28" cy="28" r="2.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
        </div>
        <div class="tier-side-rails pointer-events-none" aria-hidden="true"></div>
        <div class="tier-icon-dual-halo pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'SS':
      // Tier 7: Grandmaster / Huyết Ma Đại Cao Thủ - Crimson blood-gem corner armor + rotating rune ring + floating embers
      return `
        <div class="tier-bloodgem-armor-ss pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 40 40" class="blood-svg bld-tl" fill="none">
            <path d="M2 26V10a8 8 0 0 1 8-8h16" stroke="#E11D48" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M2 10L10 2" stroke="#FB7185" stroke-width="2"/>
            <polygon points="10,10 16,6 20,10 16,14" fill="#9F1239" stroke="#FDA4AF" stroke-width="1.2"/>
            <circle cx="10" cy="10" r="2.5" fill="#F43F5E" filter="drop-shadow(0 0 4px #E11D48)"/>
          </svg>
          <svg viewBox="0 0 40 40" class="blood-svg bld-tr" fill="none">
            <path d="M38 26V10a8 8 0 0 0-8-8H14" stroke="#E11D48" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M38 10L30 2" stroke="#FB7185" stroke-width="2"/>
            <polygon points="30,10 24,6 20,10 24,14" fill="#9F1239" stroke="#FDA4AF" stroke-width="1.2"/>
            <circle cx="30" cy="10" r="2.5" fill="#F43F5E" filter="drop-shadow(0 0 4px #E11D48)"/>
          </svg>
          <svg viewBox="0 0 40 40" class="blood-svg bld-bl" fill="none">
            <path d="M2 14v16a8 8 0 0 0 8 8h16" stroke="#E11D48" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M2 30L10 38" stroke="#FB7185" stroke-width="2"/>
            <polygon points="10,30 16,26 20,30 16,34" fill="#9F1239" stroke="#FDA4AF" stroke-width="1.2"/>
            <circle cx="10" cy="30" r="2.5" fill="#F43F5E" filter="drop-shadow(0 0 4px #E11D48)"/>
          </svg>
          <svg viewBox="0 0 40 40" class="blood-svg bld-br" fill="none">
            <path d="M38 14v16a8 8 0 0 1-8 8H14" stroke="#E11D48" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M38 30L30 38" stroke="#FB7185" stroke-width="2"/>
            <polygon points="30,30 24,26 20,30 24,34" fill="#9F1239" stroke="#FDA4AF" stroke-width="1.2"/>
            <circle cx="30" cy="30" r="2.5" fill="#F43F5E" filter="drop-shadow(0 0 4px #E11D48)"/>
          </svg>
        </div>
        <!-- Rotating Geometric Rune Ring behind Icon -->
        <div class="tier-icon-rune-ss pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 80 80" class="rune-circle-svg" fill="none">
            <circle cx="40" cy="40" r="35" stroke="#E11D48" stroke-width="1.5" stroke-dasharray="5 3"/>
            <polygon points="40,8 68,56 12,56" stroke="#FB7185" stroke-width="1" stroke-dasharray="2 3"/>
            <polygon points="40,72 12,24 68,24" stroke="#FB7185" stroke-width="1" stroke-dasharray="2 3"/>
            <circle cx="40" cy="40" r="22" stroke="#FDA4AF" stroke-width="1"/>
          </svg>
        </div>
        <!-- Floating Crimson Embers -->
        <div class="tier-particles-wrap pointer-events-none" aria-hidden="true">
          <span class="particle ember ember-1"></span>
          <span class="particle ember ember-2"></span>
          <span class="particle ember ember-3"></span>
          <span class="particle ember ember-4"></span>
        </div>
        <div class="tier-energy-pulse-ss pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'UR':
      // Tier 8: Ultra Rare / Thần Thoại Lăng Kính - Rainbow hologram frame + twinkling starbursts + holographic foil sheen
      return `
        <div class="tier-starbursts-ur pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="star-svg star-tl" fill="none"><path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" fill="#F472B6"/><circle cx="12" cy="12" r="2" fill="#FFFFFF"/></svg>
          <svg viewBox="0 0 24 24" class="star-svg star-tr" fill="none"><path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" fill="#38BDF8"/><circle cx="12" cy="12" r="2" fill="#FFFFFF"/></svg>
          <svg viewBox="0 0 24 24" class="star-svg star-bl" fill="none"><path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" fill="#FBBF24"/><circle cx="12" cy="12" r="2" fill="#FFFFFF"/></svg>
          <svg viewBox="0 0 24 24" class="star-svg star-br" fill="none"><path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" fill="#A855F7"/><circle cx="12" cy="12" r="2" fill="#FFFFFF"/></svg>
        </div>
        <!-- Rotating Holographic Halo behind Icon -->
        <div class="tier-icon-halo-ur pointer-events-none" aria-hidden="true">
          <div class="ur-halo-ring"></div>
        </div>
        <div class="tier-holo-foil-sheen pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'LR':
      // Tier 9: Legend Rare / Thần Khí Thái Dương Chí Tôn - Royal Obsidian & Molten Gold chassis + ancient golden runic filigrees + rotating Solar Halo + floating golden sparks
      return `
        <div class="tier-solar-filigree-lr pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 44 44" class="solar-corner-svg slr-tl" fill="none">
            <path d="M2 30V10a8 8 0 0 1 8-8h20" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M4 14L14 4" stroke="#FEF08A" stroke-width="1.8"/>
            <rect x="8" y="8" width="8" height="8" transform="rotate(45 12 12)" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="2" fill="#FEF08A"/>
          </svg>
          <svg viewBox="0 0 44 44" class="solar-corner-svg slr-tr" fill="none">
            <path d="M42 30V10a8 8 0 0 0-8-8H14" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M40 14L30 4" stroke="#FEF08A" stroke-width="1.8"/>
            <rect x="28" y="8" width="8" height="8" transform="rotate(45 32 12)" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="32" cy="12" r="2" fill="#FEF08A"/>
          </svg>
          <svg viewBox="0 0 44 44" class="solar-corner-svg slr-bl" fill="none">
            <path d="M2 14v20a8 8 0 0 0 8 8h20" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M4 30L14 40" stroke="#FEF08A" stroke-width="1.8"/>
            <rect x="8" y="28" width="8" height="8" transform="rotate(45 12 32)" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="12" cy="32" r="2" fill="#FEF08A"/>
          </svg>
          <svg viewBox="0 0 44 44" class="solar-corner-svg slr-br" fill="none">
            <path d="M42 14v20a8 8 0 0 1-8 8H14" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M40 30L30 40" stroke="#FEF08A" stroke-width="1.8"/>
            <rect x="28" y="28" width="8" height="8" transform="rotate(45 32 32)" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="32" cy="32" r="2" fill="#FEF08A"/>
          </svg>
        </div>
        <!-- Rotating Solar Halo behind Icon -->
        <div class="tier-icon-solar-lr pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 88 88" class="solar-ring-svg" fill="none">
            <circle cx="44" cy="44" r="38" stroke="#EAB308" stroke-width="1.5" stroke-dasharray="6 3"/>
            <circle cx="44" cy="44" r="28" stroke="#CA8A04" stroke-width="1" stroke-dasharray="2 4"/>
            <path d="M44 2V10M44 78V86M2 44H10M78 44H86M14 14L20 20M68 68L74 74M14 74L20 68M68 20L74 14" stroke="#FDE047" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <!-- Floating Golden Sparks -->
        <div class="tier-particles-wrap pointer-events-none" aria-hidden="true">
          <span class="particle spark spark-1"></span>
          <span class="particle spark spark-2"></span>
          <span class="particle spark spark-3"></span>
          <span class="particle spark spark-4"></span>
          <span class="particle spark spark-5"></span>
        </div>
        <div class="tier-molten-plasma pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'EX':
      // Tier 10: Celestial Singularity / Đẳng Cấp Vũ Trụ - Deep Cosmic Nebula + 360° aurora plasma stream + crystalline winged frames + dual astrolabe rings + stardust
      return `
        <!-- 360° Conic Aurora Plasma Border -->
        <div class="tier-plasma-perimeter-ex pointer-events-none" aria-hidden="true"></div>
        
        <!-- Crystalline Winged Corner Frames -->
        <div class="tier-crystal-corners-ex pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 48 48" class="crystal-corner-svg cry-tl" fill="none">
            <path d="M2 34V12a10 10 0 0 1 10-10h22" stroke="#22D3EE" stroke-width="3" stroke-linecap="round"/>
            <path d="M2 18L18 2" stroke="#67E8F9" stroke-width="2"/>
            <path d="M8 26L26 8" stroke="#A855F7" stroke-width="1.5"/>
            <polygon points="12,12 18,6 24,12 18,18" fill="#0891B2" stroke="#22D3EE" stroke-width="1.5"/>
            <circle cx="18" cy="12" r="2.5" fill="#E0F2FE" filter="drop-shadow(0 0 6px #06B6D4)"/>
          </svg>
          <svg viewBox="0 0 48 48" class="crystal-corner-svg cry-tr" fill="none">
            <path d="M46 34V12a10 10 0 0 0-10-10H14" stroke="#22D3EE" stroke-width="3" stroke-linecap="round"/>
            <path d="M46 18L30 2" stroke="#67E8F9" stroke-width="2"/>
            <path d="M40 26L22 8" stroke="#A855F7" stroke-width="1.5"/>
            <polygon points="36,12 30,6 24,12 30,18" fill="#0891B2" stroke="#22D3EE" stroke-width="1.5"/>
            <circle cx="30" cy="12" r="2.5" fill="#E0F2FE" filter="drop-shadow(0 0 6px #06B6D4)"/>
          </svg>
          <svg viewBox="0 0 48 48" class="crystal-corner-svg cry-bl" fill="none">
            <path d="M2 14v22a10 10 0 0 0 10 10h22" stroke="#22D3EE" stroke-width="3" stroke-linecap="round"/>
            <path d="M2 30L18 46" stroke="#67E8F9" stroke-width="2"/>
            <path d="M8 22L26 40" stroke="#A855F7" stroke-width="1.5"/>
            <polygon points="12,36 18,30 24,36 18,42" fill="#0891B2" stroke="#22D3EE" stroke-width="1.5"/>
            <circle cx="18" cy="36" r="2.5" fill="#E0F2FE" filter="drop-shadow(0 0 6px #06B6D4)"/>
          </svg>
          <svg viewBox="0 0 48 48" class="crystal-corner-svg cry-br" fill="none">
            <path d="M46 14v22a10 10 0 0 1-10 10H14" stroke="#22D3EE" stroke-width="3" stroke-linecap="round"/>
            <path d="M46 30L30 46" stroke="#67E8F9" stroke-width="2"/>
            <path d="M40 22L22 40" stroke="#A855F7" stroke-width="1.5"/>
            <polygon points="36,36 30,30 24,36 30,42" fill="#0891B2" stroke="#22D3EE" stroke-width="1.5"/>
            <circle cx="30" cy="36" r="2.5" fill="#E0F2FE" filter="drop-shadow(0 0 6px #06B6D4)"/>
          </svg>
        </div>

        <!-- Dual Counter-Rotating Astrolabe Rings behind Icon -->
        <div class="tier-astrolabe-ex pointer-events-none" aria-hidden="true">
          <!-- Outer Astrolabe Ring (Clockwise) -->
          <svg viewBox="0 0 92 92" class="astrolabe-outer" fill="none">
            <circle cx="46" cy="46" r="41" stroke="#22D3EE" stroke-width="1.5" stroke-dasharray="8 4 2 4"/>
            <circle cx="46" cy="46" r="34" stroke="#818CF8" stroke-width="1" stroke-dasharray="3 3"/>
            <circle cx="46" cy="5" r="2.5" fill="#67E8F9"/>
            <circle cx="46" cy="87" r="2.5" fill="#67E8F9"/>
            <circle cx="5" cy="46" r="2.5" fill="#67E8F9"/>
            <circle cx="87" cy="46" r="2.5" fill="#67E8F9"/>
          </svg>
          <!-- Inner Astrolabe Ring (Counter-Clockwise) -->
          <svg viewBox="0 0 92 92" class="astrolabe-inner" fill="none">
            <circle cx="46" cy="46" r="26" stroke="#C084FC" stroke-width="1.5" stroke-dasharray="5 3"/>
            <polygon points="46,24 64,56 28,56" stroke="#38BDF8" stroke-width="1"/>
            <polygon points="46,68 28,36 64,36" stroke="#38BDF8" stroke-width="1"/>
          </svg>
        </div>

        <!-- Floating Cosmic Stardust -->
        <div class="tier-particles-wrap pointer-events-none" aria-hidden="true">
          <span class="particle star star-1"></span>
          <span class="particle star star-2"></span>
          <span class="particle star star-3"></span>
          <span class="particle star star-4"></span>
          <span class="particle star star-5"></span>
          <span class="particle star star-6"></span>
        </div>

        <div class="tier-cosmic-grid pointer-events-none" aria-hidden="true"></div>
      `.trim();

    default:
      return '';
  }
}

// Deprecated backward-compatible alias
export const renderTierOrnaments = renderTierStructuralLayers;
