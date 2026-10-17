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
      // Tier 3: Uncommon / Lục Bảo - Double border, corner ticks, emerald mist + Soft Corner Emerald Glow
      return `
        <div class="tier-inner-frame tier-inner-frame-c pointer-events-none" aria-hidden="true"></div>
        <div class="tier-corner-ticks pointer-events-none" aria-hidden="true">
          <span class="tick-tl"></span>
          <span class="tick-tr"></span>
          <span class="tick-bl"></span>
          <span class="tick-br"></span>
        </div>
        <div class="tier-emerald-mist pointer-events-none" aria-hidden="true"></div>
        <div class="tier-emerald-corner-glow pointer-events-none" aria-hidden="true">
          <span class="glow-dot glow-tl"></span>
          <span class="glow-dot glow-tr"></span>
          <span class="glow-dot glow-bl"></span>
          <span class="glow-dot glow-br"></span>
        </div>
      `.trim();

    case 'B':
      // Tier 4: Rare / Lam Ngọc Tinh Luyện - Full-perimeter inner frame + 48px filled sapphire plates + Elemental Sapphire Arcs
      return `
        <div class="tier-inner-frame tier-inner-frame-b pointer-events-none" aria-hidden="true"></div>
        <div class="tier-blade-sheen pointer-events-none" aria-hidden="true"></div>
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
      `.trim();

    case 'A':
      // Tier 5: Epic / Sử Thi Hoàng Kim - Full-perimeter inner frame + Keystones + 48px gold armor + Golden Sunbeams
      return `
        <div class="tier-inner-frame tier-inner-frame-a pointer-events-none" aria-hidden="true"></div>
        <div class="tier-top-gold-bar pointer-events-none" aria-hidden="true"></div>
        <div class="tier-blade-sheen pointer-events-none" aria-hidden="true"></div>

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
        <div class="tier-amethyst-spotlight pointer-events-none" aria-hidden="true"></div>
        
        <!-- 4 Harmonic Arcane Rune Nodes at midpoints -->
        <div class="tier-rune-nodes-s pointer-events-none" aria-hidden="true">
          <div class="rune-node node-top">
            <svg viewBox="0 0 16 16" fill="none"><polygon points="8,1 15,8 8,15 1,8" fill="#581C87" stroke="#F59E0B" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#E9D5FF"/></svg>
          </div>
          <div class="rune-node node-bottom">
            <svg viewBox="0 0 16 16" fill="none"><polygon points="8,1 15,8 8,15 1,8" fill="#581C87" stroke="#F59E0B" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#E9D5FF"/></svg>
          </div>
          <div class="rune-node node-left">
            <svg viewBox="0 0 16 16" fill="none"><polygon points="8,1 15,8 8,15 1,8" fill="#581C87" stroke="#F59E0B" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#E9D5FF"/></svg>
          </div>
          <div class="rune-node node-right">
            <svg viewBox="0 0 16 16" fill="none"><polygon points="8,1 15,8 8,15 1,8" fill="#581C87" stroke="#F59E0B" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#E9D5FF"/></svg>
          </div>
        </div>

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
        
        <!-- Bottom-Up Rising Hellfire Flame Crown -->
        <svg class="tier-hellfire-flames pointer-events-none" viewBox="0 0 300 110" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="flameLayer1" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#881337" stop-opacity="0.8"/>
              <stop offset="60%" stop-color="#E11D48" stop-opacity="0.45"/>
              <stop offset="100%" stop-color="#F43F5E" stop-opacity="0"/>
            </linearGradient>
            <linearGradient id="flameLayer2" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#9F1239" stop-opacity="0.85"/>
              <stop offset="50%" stop-color="#FB7185" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#FDA4AF" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path class="flame-tongue flame-back" d="M 0 110 L 0 50 Q 20 20 40 55 Q 60 10 80 60 Q 105 5 130 50 Q 155 15 180 55 Q 205 10 230 60 Q 255 20 275 55 Q 290 30 300 50 L 300 110 Z" fill="url(#flameLayer1)"/>
          <path class="flame-tongue flame-front" d="M 0 110 L 0 65 Q 25 40 50 70 Q 75 35 100 70 Q 125 30 150 65 Q 175 40 200 70 Q 225 35 250 70 Q 275 45 300 65 L 300 110 Z" fill="url(#flameLayer2)"/>
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
        
        <!-- Seamless 360° Iridescent Dichroic Frame -->
        <div class="tier-prismatic-perimeter-ur pointer-events-none" aria-hidden="true"></div>

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

        <!-- 4 Diamond Lens Flare Glints -->
        <div class="tier-diamond-glints-ur pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="diamond-flare flare-tl" fill="none"><path d="M12 0L13.5 9.5L24 12L13.5 14.5L12 24L10.5 14.5L0 12L10.5 9.5Z" fill="#FFFFFF"/><circle cx="12" cy="12" r="3" fill="#F472B6"/></svg>
          <svg viewBox="0 0 24 24" class="diamond-flare flare-tr" fill="none"><path d="M12 0L13.5 9.5L24 12L13.5 14.5L12 24L10.5 14.5L0 12L10.5 9.5Z" fill="#FFFFFF"/><circle cx="12" cy="12" r="3" fill="#38BDF8"/></svg>
          <svg viewBox="0 0 24 24" class="diamond-flare flare-bl" fill="none"><path d="M12 0L13.5 9.5L24 12L13.5 14.5L12 24L10.5 14.5L0 12L10.5 9.5Z" fill="#FFFFFF"/><circle cx="12" cy="12" r="3" fill="#FBBF24"/></svg>
          <svg viewBox="0 0 24 24" class="diamond-flare flare-br" fill="none"><path d="M12 0L13.5 9.5L24 12L13.5 14.5L12 24L10.5 14.5L0 12L10.5 9.5Z" fill="#FFFFFF"/><circle cx="12" cy="12" r="3" fill="#A855F7"/></svg>
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
        
        <!-- Radiating Sunburst Corona God-Rays & Rising Light Pillars -->
        <div class="tier-solar-sunburst pointer-events-none" aria-hidden="true"></div>
        <div class="tier-solar-pillars pointer-events-none" aria-hidden="true"></div>

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

        <!-- Real Strobe-Flash Branched High-Voltage Lightning Bolts (Instantaneous Snap) -->
        <svg class="tier-strobe-lightning-ex pointer-events-none" viewBox="0 0 300 360" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <g class="strobe-lightning-tl">
            <!-- Main jagged bolt -->
            <path d="M 10 115 L 24 80 L 14 60 L 36 38 L 58 32 L 80 16 L 115 12 L 145 20 L 180 10" stroke="#67E8F9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 10 115 L 24 80 L 14 60 L 36 38 L 58 32 L 80 16 L 115 12 L 145 20 L 180 10" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Branches -->
            <path d="M 36 38 L 48 58 L 62 62" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M 80 16 L 90 28 L 104 26" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M 145 20 L 154 34 L 168 36" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/>
          </g>
          <g class="strobe-lightning-br">
            <!-- Main jagged bolt -->
            <path d="M 290 245 L 276 280 L 286 300 L 264 322 L 242 328 L 220 344 L 185 348 L 155 340 L 120 350" stroke="#67E8F9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 290 245 L 276 280 L 286 300 L 264 322 L 242 328 L 220 344 L 185 348 L 155 340 L 120 350" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Branches -->
            <path d="M 264 322 L 252 302 L 238 298" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M 220 344 L 210 332 L 196 334" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M 155 340 L 146 326 L 132 324" stroke="#38BDF8" stroke-width="1.4" stroke-linecap="round"/>
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
