/**
 * TierFrameAssets.js - Full-Perimeter RPG Armor, Dual-Scale Arcane Seals & Elemental Edge Perimeters (DuyDev-Studio)
 * Features:
 *  - Elemental Perimeter SVGs (Lightning, Solar Corona, Blood Flame, Arcane Thunder, Prismatic Wave)
 *  - Connected Inner Frame Tracks (inset: 5px)
 *  - Top & Bottom Center Keystones / Gem Crests
 *  - Symmetrical Side Energy Wings (left & right)
 *  - Multi-Layered Filled Metallic/Crystalline Corner Armor Plates (48px–56px)
 *  - Layer A: High-Contrast Rotating Icon Socket Rings (70px–74px)
 *  - Layer B: Giant Background Arcane/Celestial Watermark Seals (170px–180px)
 *  - Floating Particles & Multi-Tier Energy Emitters
 *
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
      // Tier 3: Uncommon / Lục Bảo - Double border, corner ticks, emerald mist + Elemental pulse
      return `
        <div class="tier-inner-frame tier-inner-frame-c pointer-events-none" aria-hidden="true"></div>
        <div class="tier-corner-ticks pointer-events-none" aria-hidden="true">
          <span class="tick-tl"></span>
          <span class="tick-tr"></span>
          <span class="tick-bl"></span>
          <span class="tick-br"></span>
        </div>
        <div class="tier-emerald-mist pointer-events-none" aria-hidden="true"></div>
        <!-- Elemental Edge: Emerald Pulse Track -->
        <svg class="tier-elemental-edges tier-edges-c pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <rect x="6" y="6" width="288" height="348" rx="14" stroke="#10B981" stroke-width="1.2" stroke-dasharray="16 32" class="emerald-pulse-track"/>
        </svg>
      `.trim();

    case 'B':
      // Tier 4: Rare / Lam Ngọc Tinh Luyện - Full-perimeter inner frame + 48px filled sapphire plates + Elemental Sapphire Arcs
      return `
        <div class="tier-inner-frame tier-inner-frame-b pointer-events-none" aria-hidden="true"></div>
        <!-- Elemental Edge: Sapphire Electric Arcs -->
        <svg class="tier-elemental-edges tier-edges-b pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path d="M 44 5 L 85 2 L 125 6 L 165 2 L 205 6 L 256 5" stroke="#93C5FD" stroke-width="1.5" stroke-linecap="round" class="sapphire-arc"/>
          <path d="M 295 44 L 298 105 L 294 175 L 298 245 L 295 316" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" class="sapphire-arc"/>
          <path d="M 5 44 L 2 105 L 6 175 L 2 245 L 5 316" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" class="sapphire-arc"/>
          <path d="M 44 355 L 85 358 L 125 354 L 165 358 L 205 354 L 256 355" stroke="#93C5FD" stroke-width="1.5" stroke-linecap="round" class="sapphire-arc"/>
        </svg>
        <div class="tier-corner-armor tier-corner-armor-b pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 48 48" class="corner-plate cp-tl" fill="none">
            <path d="M 4 36 V 16 A 12 12 0 0 1 16 4 H 36" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 6 28 V 16 A 10 10 0 0 1 16 6 H 28" stroke="#93C5FD" stroke-width="1.2"/>
            <polygon points="16,8 24,16 16,24 8,16" fill="#1D4ED8" stroke="#60A5FA" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="3.5" fill="#93C5FD"/>
            <circle cx="16" cy="16" r="1.5" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 48 48" class="corner-plate cp-tr" fill="none">
            <path d="M 44 36 V 16 A 12 12 0 0 0 32 4 H 12" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 42 28 V 16 A 10 10 0 0 0 32 6 H 20" stroke="#93C5FD" stroke-width="1.2"/>
            <polygon points="32,8 40,16 32,24 24,16" fill="#1D4ED8" stroke="#60A5FA" stroke-width="1.5"/>
            <circle cx="32" cy="16" r="3.5" fill="#93C5FD"/>
            <circle cx="32" cy="16" r="1.5" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 48 48" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 32 A 12 12 0 0 0 16 44 H 36" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 6 20 V 32 A 10 10 0 0 0 16 42 H 28" stroke="#93C5FD" stroke-width="1.2"/>
            <polygon points="16,24 24,32 16,40 8,32" fill="#1D4ED8" stroke="#60A5FA" stroke-width="1.5"/>
            <circle cx="16" cy="32" r="3.5" fill="#93C5FD"/>
            <circle cx="16" cy="32" r="1.5" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 48 48" class="corner-plate cp-br" fill="none">
            <path d="M 44 12 V 32 A 12 12 0 0 1 32 44 H 12" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 42 20 V 32 A 10 10 0 0 1 32 42 H 20" stroke="#93C5FD" stroke-width="1.2"/>
            <polygon points="32,24 40,32 32,40 24,32" fill="#1D4ED8" stroke="#60A5FA" stroke-width="1.5"/>
            <circle cx="32" cy="32" r="3.5" fill="#93C5FD"/>
            <circle cx="32" cy="32" r="1.5" fill="#FFFFFF"/>
          </svg>
        </div>
        <div class="tier-metallic-shimmer pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'A':
      // Tier 5: Epic / Sử Thi Hoàng Kim - Full-perimeter inner frame + Keystones + 48px gold armor + Golden Sunbeams
      return `
        <div class="tier-inner-frame tier-inner-frame-a pointer-events-none" aria-hidden="true"></div>
        <div class="tier-top-gold-bar pointer-events-none" aria-hidden="true"></div>
        
        <!-- Elemental Edge: Golden Sunbeams & Amber Sparks -->
        <svg class="tier-elemental-edges tier-edges-a pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <g class="golden-sunbeams">
            <path d="M 60 5 L 60 0 M 80 5 L 80 1 M 100 5 L 100 -1 M 120 5 L 120 1 M 140 5 L 140 0 M 160 5 L 160 0 M 180 5 L 180 1 M 200 5 L 200 -1 M 220 5 L 220 1 M 240 5 L 240 0" stroke="#FDE68A" stroke-width="1.6" stroke-linecap="round"/>
          </g>
          <path d="M 5 44 L 2 110 L 6 180 L 2 250 L 5 316" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round" class="amber-lightning"/>
          <path d="M 295 44 L 298 110 L 294 180 L 298 250 L 295 316" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round" class="amber-lightning"/>
          <path d="M 44 355 L 90 357 L 150 354 L 210 357 L 256 355" stroke="#FDE047" stroke-width="1.4" stroke-linecap="round" class="amber-lightning"/>
        </svg>

        <!-- Top Keystone Crest -->
        <div class="tier-keystone-top pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 96 18" class="keystone-svg" fill="none">
            <path d="M 6 9 Q 36 15 48 15 Q 60 15 90 9" stroke="#F59E0B" stroke-width="1.5"/>
            <path d="M 28 4 L 48 14 L 68 4" stroke="#FDE68A" stroke-width="1.2"/>
            <polygon points="48,2 55,9 48,16 41,9" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="48" cy="9" r="2.5" fill="#FEF08A"/>
          </svg>
        </div>
        <!-- Bottom Keystone Crest -->
        <div class="tier-keystone-bottom pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 72 14" class="keystone-svg" fill="none">
            <path d="M 4 9 Q 26 3 36 3 Q 46 3 68 9" stroke="#F59E0B" stroke-width="1.5"/>
            <polygon points="36,1 42,7 36,13 30,7" fill="#B45309" stroke="#FDE047" stroke-width="1.2"/>
          </svg>
        </div>

        <!-- 48px Filled Golden Corner Plates -->
        <div class="tier-corner-armor tier-corner-armor-a pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 48 48" class="corner-plate cp-tl" fill="none">
            <path d="M 4 36 V 16 A 12 12 0 0 1 16 4 H 36" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 8 28 V 16 A 8 8 0 0 1 16 8 H 28" stroke="#FDE68A" stroke-width="1.2"/>
            <polygon points="16,8 24,16 16,24 8,16" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="3.5" fill="#FBBF24"/>
            <circle cx="16" cy="16" r="1.5" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 48 48" class="corner-plate cp-tr" fill="none">
            <path d="M 44 36 V 16 A 12 12 0 0 0 32 4 H 12" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 40 28 V 16 A 8 8 0 0 0 32 8 H 20" stroke="#FDE68A" stroke-width="1.2"/>
            <polygon points="32,8 40,16 32,24 24,16" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="32" cy="16" r="3.5" fill="#FBBF24"/>
            <circle cx="32" cy="16" r="1.5" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 48 48" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 32 A 12 12 0 0 0 16 44 H 36" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 8 20 V 32 A 8 8 0 0 0 16 40 H 28" stroke="#FDE68A" stroke-width="1.2"/>
            <polygon points="16,24 24,32 16,40 8,32" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="16" cy="32" r="3.5" fill="#FBBF24"/>
            <circle cx="16" cy="32" r="1.5" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 48 48" class="corner-plate cp-br" fill="none">
            <path d="M 44 12 V 32 A 12 12 0 0 1 32 44 H 12" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 40 20 V 32 A 8 8 0 0 1 32 40 H 20" stroke="#FDE68A" stroke-width="1.2"/>
            <polygon points="32,24 40,32 32,40 24,32" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
            <circle cx="32" cy="32" r="3.5" fill="#FBBF24"/>
            <circle cx="32" cy="32" r="1.5" fill="#FFFFFF"/>
          </svg>
        </div>
      `.trim();

    case 'S':
      // Tier 6: Master / Tử Kim Siêu Việt - Full inner frame + Side Wings + Keystones + Amethyst Arcane Thunder
      return `
        <div class="tier-inner-frame tier-inner-frame-s pointer-events-none" aria-hidden="true"></div>
        <div class="tier-side-wings pointer-events-none" aria-hidden="true"></div>
        
        <!-- Elemental Edge: Amethyst Arcane Thunder Streams -->
        <svg class="tier-elemental-edges tier-edges-s pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path d="M 45 5 Q 85 1 120 6 Q 160 9 190 3 Q 225 1 255 5" stroke="#C084FC" stroke-width="2" stroke-linecap="round" class="amethyst-thunder-purple"/>
          <path d="M 295 45 Q 299 100 294 150 Q 289 200 296 250 Q 300 290 295 315" stroke="#C084FC" stroke-width="2" stroke-linecap="round" class="amethyst-thunder-purple"/>
          <path d="M 255 355 Q 220 359 185 353 Q 145 351 110 356 Q 75 359 45 355" stroke="#C084FC" stroke-width="2" stroke-linecap="round" class="amethyst-thunder-purple"/>
          <path d="M 5 315 Q 1 270 6 220 Q 10 170 4 120 Q 1 80 5 45" stroke="#C084FC" stroke-width="2" stroke-linecap="round" class="amethyst-thunder-purple"/>
          <path d="M 50 4 L 85 7 L 130 3 L 175 7 L 220 3 L 250 5" stroke="#FBBF24" stroke-width="1.4" stroke-linecap="round" class="amethyst-thunder-gold"/>
          <path d="M 296 50 L 293 110 L 297 180 L 292 245 L 296 310" stroke="#FBBF24" stroke-width="1.4" stroke-linecap="round" class="amethyst-thunder-gold"/>
          <path d="M 4 50 L 7 110 L 3 180 L 8 245 L 4 310" stroke="#FBBF24" stroke-width="1.4" stroke-linecap="round" class="amethyst-thunder-gold"/>
        </svg>

        <!-- Top Keystone Crest -->
        <div class="tier-keystone-top pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 96 18" class="keystone-svg" fill="none">
            <path d="M 8 8 Q 36 15 48 15 Q 60 15 88 8" stroke="#9333EA" stroke-width="1.8"/>
            <polygon points="48,2 56,9 48,16 40,9" fill="#6B21A8" stroke="#F59E0B" stroke-width="1.5"/>
            <circle cx="48" cy="9" r="2.5" fill="#E9D5FF"/>
          </svg>
        </div>
        <!-- Bottom Keystone Crest -->
        <div class="tier-keystone-bottom pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 72 14" class="keystone-svg" fill="none">
            <path d="M 6 9 Q 26 3 36 3 Q 46 3 66 9" stroke="#9333EA" stroke-width="1.5"/>
            <polygon points="36,1 42,7 36,13 30,7" fill="#6B21A8" stroke="#F59E0B" stroke-width="1.2"/>
          </svg>
        </div>

        <!-- 50px Filled Royal Amethyst & Gold Corner Plates -->
        <div class="tier-corner-armor tier-corner-armor-s pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 50 50" class="corner-plate cp-tl" fill="none">
            <path d="M 4 38 V 16 A 12 12 0 0 1 16 4 H 38" stroke="#9333EA" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 9 30 V 17 A 8 8 0 0 1 17 9 H 30" stroke="#F59E0B" stroke-width="1.5"/>
            <polygon points="17,9 25,17 17,25 9,17" fill="#581C87" stroke="#C084FC" stroke-width="1.5"/>
            <circle cx="17" cy="17" r="3.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
          <svg viewBox="0 0 50 50" class="corner-plate cp-tr" fill="none">
            <path d="M 46 38 V 16 A 12 12 0 0 0 34 4 H 12" stroke="#9333EA" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 41 30 V 17 A 8 8 0 0 0 33 9 H 20" stroke="#F59E0B" stroke-width="1.5"/>
            <polygon points="33,9 41,17 33,25 25,17" fill="#581C87" stroke="#C084FC" stroke-width="1.5"/>
            <circle cx="33" cy="17" r="3.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
          <svg viewBox="0 0 50 50" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 34 A 12 12 0 0 0 16 46 H 38" stroke="#9333EA" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 9 20 V 33 A 8 8 0 0 0 17 41 H 30" stroke="#F59E0B" stroke-width="1.5"/>
            <polygon points="17,25 25,33 17,41 9,33" fill="#581C87" stroke="#C084FC" stroke-width="1.5"/>
            <circle cx="17" cy="33" r="3.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
          <svg viewBox="0 0 50 50" class="corner-plate cp-br" fill="none">
            <path d="M 46 12 V 34 A 12 12 0 0 1 34 46 H 12" stroke="#9333EA" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 41 20 V 33 A 8 8 0 0 1 33 41 H 20" stroke="#F59E0B" stroke-width="1.5"/>
            <polygon points="33,25 41,33 33,41 25,33" fill="#581C87" stroke="#C084FC" stroke-width="1.5"/>
            <circle cx="33" cy="33" r="3.5" fill="#E9D5FF" stroke="#9333EA"/>
          </svg>
        </div>

        <!-- Layer B: Giant Background Arcane Seal (170px) -->
        <div class="tier-watermark-seal tier-watermark-seal-s pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 170 170" class="watermark-svg" fill="none">
            <circle cx="85" cy="85" r="80" stroke="#9333EA" stroke-width="1.5" stroke-dasharray="10 5"/>
            <circle cx="85" cy="85" r="68" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4 4"/>
            <polygon points="85,15 145,120 25,120" stroke="#9333EA" stroke-width="1.2"/>
            <polygon points="85,155 25,50 145,50" stroke="#9333EA" stroke-width="1.2"/>
            <circle cx="85" cy="85" r="42" stroke="#C084FC" stroke-width="1"/>
          </svg>
        </div>

        <!-- Layer A: Glowing Icon Socket Ring (72px) -->
        <div class="tier-icon-dual-halo pointer-events-none" aria-hidden="true">
          <div class="halo-pulsing-core"></div>
        </div>
      `.trim();

    case 'SS':
      // Tier 7: Grandmaster / Huyết Ma Đại Cao Thủ - Full inner frame + Keystones + Side Wings + Blood Flames & Crimson Lightning
      return `
        <div class="tier-inner-frame tier-inner-frame-ss pointer-events-none" aria-hidden="true"></div>
        <div class="tier-side-wings tier-side-wings-ss pointer-events-none" aria-hidden="true"></div>
        
        <!-- Elemental Edge: Blood Flames & Crimson Lightning -->
        <svg class="tier-elemental-edges tier-edges-ss pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="ssFlameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#E11D48"/>
              <stop offset="50%" stop-color="#FB7185"/>
              <stop offset="100%" stop-color="#FDA4AF"/>
            </linearGradient>
          </defs>
          <path d="M 5 310 Q 10 295 5 280 Q 1 265 6 250 Q 10 235 5 220 Q 1 205 6 190 Q 10 175 5 160 Q 1 145 6 130 Q 10 115 5 100 Q 1 85 5 70 Q 9 55 5 45" stroke="url(#ssFlameGrad)" stroke-width="2.5" fill="none" stroke-linecap="round" class="blood-flame-path"/>
          <path d="M 295 310 Q 290 295 295 280 Q 299 265 294 250 Q 290 235 295 220 Q 299 205 294 190 Q 290 175 295 160 Q 299 145 294 130 Q 290 115 295 100 Q 299 85 295 70 Q 291 55 295 45" stroke="url(#ssFlameGrad)" stroke-width="2.5" fill="none" stroke-linecap="round" class="blood-flame-path"/>
          <path d="M 50 355 Q 70 349 90 355 Q 110 347 130 355 Q 150 348 170 355 Q 190 347 210 355 Q 230 349 250 355" stroke="url(#ssFlameGrad)" stroke-width="2.2" fill="none" class="blood-flame-path"/>
          <path d="M 45 4 L 80 1 L 105 5 L 140 2 L 165 6 L 205 1 L 225 5 L 255 4" stroke="#FDA4AF" stroke-width="1.6" stroke-linecap="round" class="crimson-bolt"/>
        </svg>

        <!-- Top Keystone Crest -->
        <div class="tier-keystone-top pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 100 18" class="keystone-svg" fill="none">
            <path d="M 6 8 Q 36 16 50 16 Q 64 16 94 8" stroke="#E11D48" stroke-width="2"/>
            <polygon points="50,2 58,9 50,16 42,9" fill="#9F1239" stroke="#FDA4AF" stroke-width="1.5"/>
            <circle cx="50" cy="9" r="2.5" fill="#FB7185" filter="drop-shadow(0 0 6px #E11D48)"/>
          </svg>
        </div>
        <!-- Bottom Keystone Crest -->
        <div class="tier-keystone-bottom pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 80 14" class="keystone-svg" fill="none">
            <path d="M 6 10 Q 28 3 40 3 Q 52 3 74 10" stroke="#E11D48" stroke-width="1.8"/>
            <polygon points="40,1 46,7 40,13 34,7" fill="#9F1239" stroke="#FDA4AF" stroke-width="1.2"/>
          </svg>
        </div>

        <!-- 52px Filled Blood-Gem Winged Corner Plates -->
        <div class="tier-corner-armor tier-corner-armor-ss pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 52 52" class="corner-plate cp-tl" fill="none">
            <path d="M 4 40 V 16 A 12 12 0 0 1 16 4 H 40" stroke="#E11D48" stroke-width="3" stroke-linecap="round"/>
            <path d="M 5 15 L 15 5" stroke="#FDA4AF" stroke-width="2"/>
            <polygon points="16,8 24,16 16,24 8,16" fill="#881337" stroke="#FB7185" stroke-width="1.8"/>
            <circle cx="16" cy="16" r="4" fill="#F43F5E" filter="drop-shadow(0 0 6px #E11D48)"/>
            <circle cx="16" cy="16" r="1.5" fill="#FFF1F2"/>
          </svg>
          <svg viewBox="0 0 52 52" class="corner-plate cp-tr" fill="none">
            <path d="M 48 40 V 16 A 12 12 0 0 0 36 4 H 12" stroke="#E11D48" stroke-width="3" stroke-linecap="round"/>
            <path d="M 47 15 L 37 5" stroke="#FDA4AF" stroke-width="2"/>
            <polygon points="36,8 44,16 36,24 28,16" fill="#881337" stroke="#FB7185" stroke-width="1.8"/>
            <circle cx="36" cy="16" r="4" fill="#F43F5E" filter="drop-shadow(0 0 6px #E11D48)"/>
            <circle cx="36" cy="16" r="1.5" fill="#FFF1F2"/>
          </svg>
          <svg viewBox="0 0 52 52" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 36 A 12 12 0 0 0 16 48 H 40" stroke="#E11D48" stroke-width="3" stroke-linecap="round"/>
            <path d="M 5 37 L 15 47" stroke="#FDA4AF" stroke-width="2"/>
            <polygon points="16,28 24,36 16,44 8,36" fill="#881337" stroke="#FB7185" stroke-width="1.8"/>
            <circle cx="16" cy="36" r="4" fill="#F43F5E" filter="drop-shadow(0 0 6px #E11D48)"/>
            <circle cx="16" cy="36" r="1.5" fill="#FFF1F2"/>
          </svg>
          <svg viewBox="0 0 52 52" class="corner-plate cp-br" fill="none">
            <path d="M 48 12 V 36 A 12 12 0 0 1 36 48 H 12" stroke="#E11D48" stroke-width="3" stroke-linecap="round"/>
            <path d="M 47 37 L 37 47" stroke="#FDA4AF" stroke-width="2"/>
            <polygon points="36,28 44,36 36,44 28,36" fill="#881337" stroke="#FB7185" stroke-width="1.8"/>
            <circle cx="36" cy="36" r="4" fill="#F43F5E" filter="drop-shadow(0 0 6px #E11D48)"/>
            <circle cx="36" cy="36" r="1.5" fill="#FFF1F2"/>
          </svg>
        </div>

        <!-- Layer B: Giant Background Demonic Rune Watermark (175px) -->
        <div class="tier-watermark-seal tier-watermark-seal-ss pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 175 175" class="watermark-svg" fill="none">
            <circle cx="87" cy="87" r="82" stroke="#E11D48" stroke-width="1.5" stroke-dasharray="8 4"/>
            <circle cx="87" cy="87" r="70" stroke="#FB7185" stroke-width="1.2" stroke-dasharray="3 3"/>
            <polygon points="87,15 150,125 24,125" stroke="#E11D48" stroke-width="1.5"/>
            <polygon points="87,160 24,50 150,50" stroke="#E11D48" stroke-width="1.5"/>
            <circle cx="87" cy="87" r="45" stroke="#FDA4AF" stroke-width="1"/>
            <circle cx="87" cy="87" r="28" stroke="#E11D48" stroke-width="1.5" stroke-dasharray="6 3"/>
          </svg>
        </div>

        <!-- Layer A: High-Contrast Rotating Geometric Rune Ring (72px) -->
        <div class="tier-icon-rune-ss pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 72 72" class="rune-circle-svg" fill="none">
            <circle cx="36" cy="36" r="32" stroke="#E11D48" stroke-width="1.8" stroke-dasharray="5 3"/>
            <polygon points="36,8 60,50 12,50" stroke="#FB7185" stroke-width="1.2" stroke-dasharray="3 2"/>
            <polygon points="36,64 12,22 60,22" stroke="#FB7185" stroke-width="1.2" stroke-dasharray="3 2"/>
            <circle cx="36" cy="36" r="20" stroke="#FDA4AF" stroke-width="1"/>
          </svg>
        </div>

        <!-- 10 Floating Crimson Embers -->
        <div class="tier-particles-wrap pointer-events-none" aria-hidden="true">
          <span class="particle ember ember-1"></span>
          <span class="particle ember ember-2"></span>
          <span class="particle ember ember-3"></span>
          <span class="particle ember ember-4"></span>
          <span class="particle ember ember-5"></span>
          <span class="particle ember ember-6"></span>
          <span class="particle ember ember-7"></span>
          <span class="particle ember ember-8"></span>
          <span class="particle ember ember-9"></span>
          <span class="particle ember ember-10"></span>
        </div>
      `.trim();

    case 'UR':
      // Tier 8: Ultra Rare / Thần Thoại Lăng Kính - Full inner frame + Keystones + Prismatic Starlight Waves
      return `
        <div class="tier-inner-frame tier-inner-frame-ur pointer-events-none" aria-hidden="true"></div>
        <div class="tier-side-wings tier-side-wings-ur pointer-events-none" aria-hidden="true"></div>
        
        <!-- Elemental Edge: Prismatic Starlight Waves & Twinkling Sparks -->
        <svg class="tier-elemental-edges tier-edges-ur pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="urWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#F472B6"/>
              <stop offset="25%" stop-color="#C084FC"/>
              <stop offset="50%" stop-color="#38BDF8"/>
              <stop offset="75%" stop-color="#34D399"/>
              <stop offset="100%" stop-color="#FACC15"/>
            </linearGradient>
          </defs>
          <path d="M 48 5 Q 85 1 125 5 Q 165 9 205 4 Q 230 2 252 5" stroke="url(#urWaveGrad)" stroke-width="2" stroke-linecap="round" class="prismatic-wave"/>
          <path d="M 295 48 Q 299 105 294 165 Q 289 225 296 280 Q 298 300 295 312" stroke="url(#urWaveGrad)" stroke-width="2" stroke-linecap="round" class="prismatic-wave"/>
          <path d="M 252 355 Q 215 359 175 354 Q 135 351 95 356 Q 70 358 48 355" stroke="url(#urWaveGrad)" stroke-width="2" stroke-linecap="round" class="prismatic-wave"/>
          <path d="M 5 312 Q 1 260 6 200 Q 10 140 4 80 Q 2 60 5 48" stroke="url(#urWaveGrad)" stroke-width="2" stroke-linecap="round" class="prismatic-wave"/>
          <g class="prismatic-sparks">
            <path d="M 85 5 L 85 0 M 83 2.5 L 87 2.5" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M 215 5 L 215 0 M 213 2.5 L 217 2.5" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M 295 140 L 300 140 M 297.5 138 L 297.5 142" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M 295 220 L 300 220 M 297.5 218 L 297.5 222" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M 150 355 L 150 360 M 147.5 357.5 L 152.5 357.5" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M 5 140 L 0 140 M 2.5 138 L 2.5 142" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M 5 220 L 0 220 M 2.5 218 L 2.5 222" stroke="#FFFFFF" stroke-width="1.5"/>
          </g>
        </svg>

        <!-- Top Keystone Crest -->
        <div class="tier-keystone-top pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 100 18" class="keystone-svg" fill="none">
            <path d="M 6 8 Q 36 16 50 16 Q 64 16 94 8" stroke="#EC4899" stroke-width="2"/>
            <polygon points="50,2 58,9 50,16 42,9" fill="#DB2777" stroke="#38BDF8" stroke-width="1.5"/>
            <circle cx="50" cy="9" r="2.5" fill="#FFFFFF" filter="drop-shadow(0 0 6px #EC4899)"/>
          </svg>
        </div>
        <!-- Bottom Keystone Crest -->
        <div class="tier-keystone-bottom pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 80 14" class="keystone-svg" fill="none">
            <path d="M 6 10 Q 28 3 40 3 Q 52 3 74 10" stroke="#EC4899" stroke-width="1.8"/>
            <polygon points="40,1 46,7 40,13 34,7" fill="#DB2777" stroke="#38BDF8" stroke-width="1.2"/>
          </svg>
        </div>

        <!-- Inset Twinkling Starbursts -->
        <div class="tier-starbursts-ur pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 20 20" class="star-svg star-tl" fill="none"><path d="M10 0L12 7.5L19.5 10L12 12.5L10 20L8 12.5L0.5 10L8 7.5Z" fill="#F472B6"/><circle cx="10" cy="10" r="2" fill="#FFFFFF"/></svg>
          <svg viewBox="0 0 20 20" class="star-svg star-tr" fill="none"><path d="M10 0L12 7.5L19.5 10L12 12.5L10 20L8 12.5L0.5 10L8 7.5Z" fill="#38BDF8"/><circle cx="10" cy="10" r="2" fill="#FFFFFF"/></svg>
          <svg viewBox="0 0 20 20" class="star-svg star-bl" fill="none"><path d="M10 0L12 7.5L19.5 10L12 12.5L10 20L8 12.5L0.5 10L8 7.5Z" fill="#FBBF24"/><circle cx="10" cy="10" r="2" fill="#FFFFFF"/></svg>
          <svg viewBox="0 0 20 20" class="star-svg star-br" fill="none"><path d="M10 0L12 7.5L19.5 10L12 12.5L10 20L8 12.5L0.5 10L8 7.5Z" fill="#A855F7"/><circle cx="10" cy="10" r="2" fill="#FFFFFF"/></svg>
        </div>

        <!-- 52px Crystalline Corner Plates -->
        <div class="tier-corner-armor tier-corner-armor-ur pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 52 52" class="corner-plate cp-tl" fill="none">
            <path d="M 4 40 V 16 A 12 12 0 0 1 16 4 H 40" stroke="#EC4899" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 6 16 L 16 6" stroke="#38BDF8" stroke-width="2"/>
            <circle cx="16" cy="16" r="4.5" fill="#F472B6" stroke="#FFFFFF" stroke-width="1.2" filter="drop-shadow(0 0 8px #EC4899)"/>
            <circle cx="16" cy="16" r="1.8" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 52 52" class="corner-plate cp-tr" fill="none">
            <path d="M 48 40 V 16 A 12 12 0 0 0 36 4 H 12" stroke="#EC4899" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 46 16 L 36 6" stroke="#38BDF8" stroke-width="2"/>
            <circle cx="36" cy="16" r="4.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.2" filter="drop-shadow(0 0 8px #38BDF8)"/>
            <circle cx="36" cy="16" r="1.8" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 52 52" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 36 A 12 12 0 0 0 16 48 H 40" stroke="#EC4899" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 6 36 L 16 46" stroke="#38BDF8" stroke-width="2"/>
            <circle cx="16" cy="36" r="4.5" fill="#FBBF24" stroke="#FFFFFF" stroke-width="1.2" filter="drop-shadow(0 0 8px #FBBF24)"/>
            <circle cx="16" cy="36" r="1.8" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 52 52" class="corner-plate cp-br" fill="none">
            <path d="M 48 12 V 36 A 12 12 0 0 1 36 48 H 12" stroke="#EC4899" stroke-width="2.8" stroke-linecap="round"/>
            <path d="M 46 36 L 36 46" stroke="#38BDF8" stroke-width="2"/>
            <circle cx="36" cy="36" r="4.5" fill="#A855F7" stroke="#FFFFFF" stroke-width="1.2" filter="drop-shadow(0 0 8px #A855F7)"/>
            <circle cx="36" cy="36" r="1.8" fill="#FFFFFF"/>
          </svg>
        </div>

        <!-- Layer B: Giant Background Mythic Mandala Seal (175px) -->
        <div class="tier-watermark-seal tier-watermark-seal-ur pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 175 175" class="watermark-svg" fill="none">
            <circle cx="87" cy="87" r="82" stroke="#EC4899" stroke-width="1.5" stroke-dasharray="10 5"/>
            <circle cx="87" cy="87" r="72" stroke="#38BDF8" stroke-width="1.2" stroke-dasharray="4 4"/>
            <circle cx="87" cy="87" r="60" stroke="#FBBF24" stroke-width="1" stroke-dasharray="2 4"/>
            <polygon points="87,15 100,74 159,87 100,100 87,159 74,100 15,87 74,74" stroke="#EC4899" stroke-width="1.5"/>
            <polygon points="87,35 96,78 139,87 96,96 87,139 78,96 35,87 78,78" stroke="#38BDF8" stroke-width="1"/>
            <circle cx="87" cy="87" r="30" stroke="#A855F7" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- Layer A: Glowing Rotating Holographic Ring (72px) -->
        <div class="tier-icon-halo-ur pointer-events-none" aria-hidden="true">
          <div class="ur-halo-ring"></div>
        </div>

        <!-- Seamless Soft Holographic Foil Sheen (400% with feathered stops, zero cut lines) -->
        <div class="tier-holo-foil-sheen pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'LR':
      // Tier 9: Legend Rare / Thần Khí Thái Dương Chí Tôn - Solar Keystones + Solar Corona Sunbeams & Golden Thunder
      return `
        <div class="tier-inner-frame tier-inner-frame-lr pointer-events-none" aria-hidden="true"></div>
        <div class="tier-side-wings tier-side-wings-lr pointer-events-none" aria-hidden="true"></div>
        
        <!-- Elemental Edge: Solar Corona Sunbeams & Golden Thunder -->
        <svg class="tier-elemental-edges tier-edges-lr pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <g class="solar-sunbeams">
            <path d="M 55 5 L 55 0 M 75 5 L 75 -2 M 95 5 L 95 0 M 115 5 L 115 -3 M 135 5 L 135 0 M 150 6 L 150 -4 M 165 5 L 165 0 M 185 5 L 185 -3 M 205 5 L 205 0 M 225 5 L 225 -2 M 245 5 L 245 0" stroke="#FDE047" stroke-width="2" stroke-linecap="round"/>
            <path d="M 5 60 L 0 60 M 5 90 L -2 90 M 5 120 L 0 120 M 5 150 L -3 150 M 5 180 L -1 180 M 5 210 L -3 210 M 5 240 L 0 240 M 5 270 L -2 270 M 5 300 L 0 300" stroke="#FDE047" stroke-width="2" stroke-linecap="round"/>
            <path d="M 295 60 L 300 60 M 295 90 L 302 90 M 295 120 L 300 120 M 295 150 L 303 150 M 295 180 L 301 180 M 295 210 L 303 210 M 295 240 L 300 240 M 295 270 L 302 270 M 295 300 L 300 300" stroke="#FDE047" stroke-width="2" stroke-linecap="round"/>
            <path d="M 70 355 L 70 360 M 110 355 L 110 362 M 150 354 L 150 364 M 190 355 L 190 362 M 230 355 L 230 360" stroke="#FDE047" stroke-width="2" stroke-linecap="round"/>
          </g>
          <path d="M 50 4 L 90 1 L 120 5 L 165 2 L 200 6 L 235 1 L 250 4" stroke="#FACC15" stroke-width="1.8" stroke-linecap="round" class="solar-lightning"/>
          <path d="M 296 50 L 299 95 L 294 140 L 298 185 L 293 230 L 297 275 L 295 310" stroke="#FACC15" stroke-width="1.8" stroke-linecap="round" class="solar-lightning"/>
          <path d="M 4 310 L 1 275 L 6 230 L 2 185 L 7 140 L 2 95 L 5 50" stroke="#FACC15" stroke-width="1.8" stroke-linecap="round" class="solar-lightning"/>
          <path d="M 250 356 L 210 359 L 175 354 L 135 358 L 95 354 L 50 356" stroke="#FEF08A" stroke-width="1.8" stroke-linecap="round" class="solar-lightning"/>
        </svg>

        <!-- Top Keystone Crest (Solar Crown) -->
        <div class="tier-keystone-top pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 100 20" class="keystone-svg" fill="none">
            <path d="M 6 10 Q 36 18 50 18 Q 64 18 94 10" stroke="#FACC15" stroke-width="2.2"/>
            <circle cx="50" cy="10" r="6" fill="#B45309" stroke="#FDE047" stroke-width="1.8"/>
            <circle cx="50" cy="10" r="3" fill="#FEF08A" filter="drop-shadow(0 0 8px #FACC15)"/>
            <path d="M 50 2 V 6M 42 4 L 45 7M 58 4 L 55 7" stroke="#FEF08A" stroke-width="1.5"/>
          </svg>
        </div>
        <!-- Bottom Keystone Crest -->
        <div class="tier-keystone-bottom pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 80 14" class="keystone-svg" fill="none">
            <path d="M 6 10 Q 28 3 40 3 Q 52 3 74 10" stroke="#FACC15" stroke-width="2"/>
            <polygon points="40,1 46,7 40,13 34,7" fill="#B45309" stroke="#FDE047" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- 54px Filled Sovereign Gold Corner Plates -->
        <div class="tier-corner-armor tier-corner-armor-lr pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 54 54" class="corner-plate cp-tl" fill="none">
            <path d="M 4 42 V 16 A 12 12 0 0 1 16 4 H 42" stroke="#FACC15" stroke-width="3" stroke-linecap="round"/>
            <path d="M 6 16 L 16 6" stroke="#FEF08A" stroke-width="2.2"/>
            <polygon points="16,8 24,16 16,24 8,16" fill="#78350F" stroke="#FDE047" stroke-width="1.8"/>
            <circle cx="16" cy="16" r="4.5" fill="#FACC15" filter="drop-shadow(0 0 8px #FDE047)"/>
            <circle cx="16" cy="16" r="2" fill="#FEF08A"/>
          </svg>
          <svg viewBox="0 0 54 54" class="corner-plate cp-tr" fill="none">
            <path d="M 50 42 V 16 A 12 12 0 0 0 38 4 H 12" stroke="#FACC15" stroke-width="3" stroke-linecap="round"/>
            <path d="M 48 16 L 38 6" stroke="#FEF08A" stroke-width="2.2"/>
            <polygon points="38,8 46,16 38,24 30,16" fill="#78350F" stroke="#FDE047" stroke-width="1.8"/>
            <circle cx="38" cy="16" r="4.5" fill="#FACC15" filter="drop-shadow(0 0 8px #FDE047)"/>
            <circle cx="38" cy="16" r="2" fill="#FEF08A"/>
          </svg>
          <svg viewBox="0 0 54 54" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 38 A 12 12 0 0 0 16 50 H 42" stroke="#FACC15" stroke-width="3" stroke-linecap="round"/>
            <path d="M 6 38 L 16 48" stroke="#FEF08A" stroke-width="2.2"/>
            <polygon points="16,30 24,38 16,46 8,38" fill="#78350F" stroke="#FDE047" stroke-width="1.8"/>
            <circle cx="16" cy="38" r="4.5" fill="#FACC15" filter="drop-shadow(0 0 8px #FDE047)"/>
            <circle cx="16" cy="38" r="2" fill="#FEF08A"/>
          </svg>
          <svg viewBox="0 0 54 54" class="corner-plate cp-br" fill="none">
            <path d="M 50 12 V 38 A 12 12 0 0 1 38 50 H 12" stroke="#FACC15" stroke-width="3" stroke-linecap="round"/>
            <path d="M 48 38 L 38 48" stroke="#FEF08A" stroke-width="2.2"/>
            <polygon points="38,30 46,38 38,46 30,38" fill="#78350F" stroke="#FDE047" stroke-width="1.8"/>
            <circle cx="38" cy="38" r="4.5" fill="#FACC15" filter="drop-shadow(0 0 8px #FDE047)"/>
            <circle cx="38" cy="38" r="2" fill="#FEF08A"/>
          </svg>
        </div>

        <!-- Layer B: Giant Background Sovereign Solar Astrolabe (180px) -->
        <div class="tier-watermark-seal tier-watermark-seal-lr pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 180 180" class="watermark-svg" fill="none">
            <circle cx="90" cy="90" r="85" stroke="#FACC15" stroke-width="1.8" stroke-dasharray="12 6"/>
            <circle cx="90" cy="90" r="74" stroke="#FDE047" stroke-width="1.2" stroke-dasharray="4 4"/>
            <circle cx="90" cy="90" r="60" stroke="#CA8A04" stroke-width="1.5"/>
            <path d="M 90 5 V 175M 5 90 H 175M 30 30 L 150 150M 30 150 L 150 30" stroke="#FACC15" stroke-width="1" stroke-dasharray="6 4"/>
            <circle cx="90" cy="90" r="38" stroke="#FEF08A" stroke-width="1.5" stroke-dasharray="8 4"/>
            <circle cx="90" cy="90" r="20" stroke="#FACC15" stroke-width="2"/>
          </svg>
        </div>

        <!-- Layer A: High-Contrast Rotating Solar Halo (74px) -->
        <div class="tier-icon-solar-lr pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 74 74" class="solar-ring-svg" fill="none">
            <circle cx="37" cy="37" r="33" stroke="#FACC15" stroke-width="2" stroke-dasharray="6 3"/>
            <circle cx="37" cy="37" r="24" stroke="#CA8A04" stroke-width="1.5" stroke-dasharray="3 3"/>
            <path d="M37 2V8M37 66V72M2 37H8M66 37H72M12 12L17 17M57 57L62 62M12 62L17 57M57 17L62 12" stroke="#FEF08A" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- 10 Floating Golden Sparks -->
        <div class="tier-particles-wrap pointer-events-none" aria-hidden="true">
          <span class="particle spark spark-1"></span>
          <span class="particle spark spark-2"></span>
          <span class="particle spark spark-3"></span>
          <span class="particle spark spark-4"></span>
          <span class="particle spark spark-5"></span>
          <span class="particle spark spark-6"></span>
          <span class="particle spark spark-7"></span>
          <span class="particle spark spark-8"></span>
          <span class="particle spark spark-9"></span>
          <span class="particle spark spark-10"></span>
        </div>
        <div class="tier-molten-plasma pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'EX':
      // Tier 10: Celestial Singularity / Đẳng Cấp Vũ Trụ - Conic Plasma + High-Voltage Aurora Lightning Arcs
      return `
        <!-- Supercharged 360° Conic Plasma Border (Stationary Masked Container) -->
        <div class="tier-plasma-perimeter-ex pointer-events-none" aria-hidden="true"></div>
        <div class="tier-inner-frame tier-inner-frame-ex pointer-events-none" aria-hidden="true"></div>
        <div class="tier-side-wings tier-side-wings-ex pointer-events-none" aria-hidden="true"></div>

        <!-- Elemental Edge: High-Voltage Aurora Lightning Arcs -->
        <svg class="tier-elemental-edges tier-edges-ex pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="exLightningGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#06B6D4"/>
              <stop offset="35%" stop-color="#38BDF8"/>
              <stop offset="70%" stop-color="#8B5CF6"/>
              <stop offset="100%" stop-color="#EC4899"/>
            </linearGradient>
          </defs>
          <g class="lightning-glow">
            <path d="M 45 4 L 80 1 L 100 6 L 135 2 L 155 7 L 185 2 L 210 6 L 240 1 L 255 4" stroke="url(#exLightningGlow)" stroke-width="3" stroke-linecap="round"/>
            <path d="M 296 45 L 299 90 L 294 115 L 298 160 L 293 190 L 298 235 L 294 275 L 297 315" stroke="url(#exLightningGlow)" stroke-width="3" stroke-linecap="round"/>
            <path d="M 255 356 L 220 359 L 195 354 L 160 358 L 135 353 L 105 358 L 80 354 L 45 356" stroke="url(#exLightningGlow)" stroke-width="3" stroke-linecap="round"/>
            <path d="M 4 315 L 1 275 L 6 235 L 2 190 L 7 160 L 2 115 L 6 90 L 4 45" stroke="url(#exLightningGlow)" stroke-width="3" stroke-linecap="round"/>
          </g>
          <g class="lightning-core">
            <path d="M 45 4 L 80 1 L 100 6 L 135 2 L 155 7 L 185 2 L 210 6 L 240 1 L 255 4" stroke="#E0F2FE" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M 296 45 L 299 90 L 294 115 L 298 160 L 293 190 L 298 235 L 294 275 L 297 315" stroke="#E0F2FE" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M 255 356 L 220 359 L 195 354 L 160 358 L 135 353 L 105 358 L 80 354 L 45 356" stroke="#E0F2FE" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M 4 315 L 1 275 L 6 235 L 2 190 L 7 160 L 2 115 L 6 90 L 4 45" stroke="#E0F2FE" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M 135 2 L 140 9 M 210 6 L 216 -1 M 298 160 L 289 166 M 160 358 L 154 351 M 2 190 L 11 183" stroke="#E0F2FE" stroke-width="1.2" stroke-linecap="round"/>
          </g>
        </svg>

        <!-- Top Keystone Crest (Cosmic Nova Core) -->
        <div class="tier-keystone-top pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 100 20" class="keystone-svg" fill="none">
            <path d="M 6 10 Q 36 18 50 18 Q 64 18 94 10" stroke="#22D3EE" stroke-width="2.2"/>
            <polygon points="50,2 60,10 50,18 40,10" fill="#0891B2" stroke="#67E8F9" stroke-width="1.8"/>
            <circle cx="50" cy="10" r="3.5" fill="#E0F2FE" filter="drop-shadow(0 0 10px #06B6D4)"/>
            <circle cx="50" cy="10" r="1.5" fill="#FFFFFF"/>
          </svg>
        </div>
        <!-- Bottom Keystone Crest -->
        <div class="tier-keystone-bottom pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 80 14" class="keystone-svg" fill="none">
            <path d="M 6 10 Q 28 3 40 3 Q 52 3 74 10" stroke="#22D3EE" stroke-width="2"/>
            <polygon points="40,1 46,7 40,13 34,7" fill="#0891B2" stroke="#67E8F9" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- 56px Crystalline Winged Corner Plates -->
        <div class="tier-corner-armor tier-corner-armor-ex pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 56 56" class="corner-plate cp-tl" fill="none">
            <path d="M 4 44 V 16 A 12 12 0 0 1 16 4 H 44" stroke="#22D3EE" stroke-width="3.2" stroke-linecap="round"/>
            <path d="M 6 16 L 16 6" stroke="#67E8F9" stroke-width="2.5"/>
            <path d="M 10 24 L 24 10" stroke="#C084FC" stroke-width="1.8"/>
            <polygon points="16,8 24,16 16,24 8,16" fill="#0891B2" stroke="#22D3EE" stroke-width="1.8"/>
            <circle cx="16" cy="16" r="4.5" fill="#E0F2FE" filter="drop-shadow(0 0 10px #06B6D4)"/>
            <circle cx="16" cy="16" r="2" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 56 56" class="corner-plate cp-tr" fill="none">
            <path d="M 52 44 V 16 A 12 12 0 0 0 40 4 H 12" stroke="#22D3EE" stroke-width="3.2" stroke-linecap="round"/>
            <path d="M 50 16 L 40 6" stroke="#67E8F9" stroke-width="2.5"/>
            <path d="M 46 24 L 32 10" stroke="#C084FC" stroke-width="1.8"/>
            <polygon points="40,8 48,16 40,24 32,16" fill="#0891B2" stroke="#22D3EE" stroke-width="1.8"/>
            <circle cx="40" cy="16" r="4.5" fill="#E0F2FE" filter="drop-shadow(0 0 10px #06B6D4)"/>
            <circle cx="40" cy="16" r="2" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 56 56" class="corner-plate cp-bl" fill="none">
            <path d="M 4 12 V 40 A 12 12 0 0 0 16 52 H 44" stroke="#22D3EE" stroke-width="3.2" stroke-linecap="round"/>
            <path d="M 6 40 L 16 50" stroke="#67E8F9" stroke-width="2.5"/>
            <path d="M 10 32 L 24 46" stroke="#C084FC" stroke-width="1.8"/>
            <polygon points="16,32 24,40 16,48 8,40" fill="#0891B2" stroke="#22D3EE" stroke-width="1.8"/>
            <circle cx="16" cy="40" r="4.5" fill="#E0F2FE" filter="drop-shadow(0 0 10px #06B6D4)"/>
            <circle cx="16" cy="40" r="2" fill="#FFFFFF"/>
          </svg>
          <svg viewBox="0 0 56 56" class="corner-plate cp-br" fill="none">
            <path d="M 52 12 V 40 A 12 12 0 0 1 40 52 H 12" stroke="#22D3EE" stroke-width="3.2" stroke-linecap="round"/>
            <path d="M 50 40 L 40 50" stroke="#67E8F9" stroke-width="2.5"/>
            <path d="M 46 32 L 32 46" stroke="#C084FC" stroke-width="1.8"/>
            <polygon points="40,32 48,40 40,48 32,40" fill="#0891B2" stroke="#22D3EE" stroke-width="1.8"/>
            <circle cx="40" cy="40" r="4.5" fill="#E0F2FE" filter="drop-shadow(0 0 10px #06B6D4)"/>
            <circle cx="40" cy="40" r="2" fill="#FFFFFF"/>
          </svg>
        </div>

        <!-- Layer B: Giant Background Celestial Galaxy Astrolabe (180px) -->
        <div class="tier-watermark-seal tier-watermark-seal-ex pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 180 180" class="watermark-svg" fill="none">
            <circle cx="90" cy="90" r="85" stroke="#22D3EE" stroke-width="1.8" stroke-dasharray="14 7"/>
            <circle cx="90" cy="90" r="74" stroke="#818CF8" stroke-width="1.2" stroke-dasharray="4 4"/>
            <circle cx="90" cy="90" r="58" stroke="#C084FC" stroke-width="1.5" stroke-dasharray="6 3"/>
            <path d="M 90 5 V 175M 5 90 H 175M 30 30 L 150 150M 30 150 L 150 30" stroke="#22D3EE" stroke-width="1" stroke-dasharray="4 4"/>
            <circle cx="90" cy="90" r="38" stroke="#67E8F9" stroke-width="1.8"/>
            <circle cx="90" cy="90" r="22" stroke="#C084FC" stroke-width="2"/>
            <circle cx="90" cy="90" r="8" fill="#E0F2FE"/>
          </svg>
        </div>

        <!-- Layer A: High-Contrast Rotating Dual Astrolabe Rings (74px) -->
        <div class="tier-astrolabe-ex pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 74 74" class="astrolabe-outer" fill="none">
            <circle cx="37" cy="37" r="33" stroke="#22D3EE" stroke-width="2" stroke-dasharray="7 4 2 4"/>
            <circle cx="37" cy="37" r="26" stroke="#818CF8" stroke-width="1.2" stroke-dasharray="3 3"/>
            <circle cx="37" cy="4" r="2.2" fill="#67E8F9"/>
            <circle cx="37" cy="70" r="2.2" fill="#67E8F9"/>
            <circle cx="4" cy="37" r="2.2" fill="#67E8F9"/>
            <circle cx="70" cy="37" r="2.2" fill="#67E8F9"/>
          </svg>
          <svg viewBox="0 0 74 74" class="astrolabe-inner" fill="none">
            <circle cx="37" cy="37" r="20" stroke="#C084FC" stroke-width="1.5" stroke-dasharray="5 3"/>
            <polygon points="37,18 52,44 22,44" stroke="#38BDF8" stroke-width="1"/>
            <polygon points="37,56 22,30 52,30" stroke="#38BDF8" stroke-width="1"/>
          </svg>
        </div>

        <!-- 12 Floating Cosmic Stardust -->
        <div class="tier-particles-wrap pointer-events-none" aria-hidden="true">
          <span class="particle star star-1"></span>
          <span class="particle star star-2"></span>
          <span class="particle star star-3"></span>
          <span class="particle star star-4"></span>
          <span class="particle star star-5"></span>
          <span class="particle star star-6"></span>
          <span class="particle star star-7"></span>
          <span class="particle star star-8"></span>
          <span class="particle star star-9"></span>
          <span class="particle star star-10"></span>
          <span class="particle star star-11"></span>
          <span class="particle star star-12"></span>
        </div>

        <div class="tier-cosmic-grid pointer-events-none" aria-hidden="true"></div>
      `.trim();

    default:
      return '';
  }
}

// Backward-compatible alias
export const renderTierOrnaments = renderTierStructuralLayers;
