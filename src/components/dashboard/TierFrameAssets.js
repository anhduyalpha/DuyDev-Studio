/**
 * TierFrameAssets.js - Architectural Structural Layers (DuyDev-Studio)
 * Implements razor-sharp precision engineering layers across 10 card tiers.
 * Zero clip-art crowns or external protruding stickers.
 */

export function renderTierStructuralLayers(tierCode) {
  if (!tierCode) return '';
  const code = String(tierCode).toUpperCase();

  switch (code) {
    case 'E':
      // Stage 1 - Tier 1: Pure single-layer matte border, zero ornaments
      return '';

    case 'D':
      // Stage 1 - Tier 2: Top inner specular hairline highlight
      return '<div class="tier-inner-specular pointer-events-none" aria-hidden="true"></div>';

    case 'C':
      // Stage 1 - Tier 3: 6px L-shaped micro-ticks inside 4 corners
      return `
        <div class="tier-micro-ticks pointer-events-none" aria-hidden="true">
          <span class="tick-tl"></span>
          <span class="tick-tr"></span>
          <span class="tick-bl"></span>
          <span class="tick-br"></span>
        </div>
      `.trim();

    case 'B':
      // Stage 2 - Tier 4: Double-bezel recessed track
      return '<div class="tier-double-bezel pointer-events-none" aria-hidden="true"></div>';

    case 'A':
      // Stage 2 - Tier 5: Luminous gold laser bar embedded flush + double-bezel
      return `
        <div class="tier-top-laser-bar pointer-events-none" aria-hidden="true"></div>
        <div class="tier-double-bezel pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'S':
      // Stage 2 - Tier 6: Diagonal brushed-silk texture + illuminated icon pedestal
      return `
        <div class="tier-silk-texture pointer-events-none" aria-hidden="true"></div>
        <div class="tier-double-bezel pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'SS':
      // Stage 3 - Tier 7: Precision CAD corner brackets + dot matrix + icon spotlight
      return `
        <div class="tier-cad-brackets pointer-events-none" aria-hidden="true">
          <span class="cad-tl"></span>
          <span class="cad-tr"></span>
          <span class="cad-bl"></span>
          <span class="cad-br"></span>
        </div>
        <div class="tier-dot-matrix pointer-events-none" aria-hidden="true"></div>
        <div class="tier-icon-spotlight pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'UR':
      // Stage 3 - Tier 8: Iridescent dichroic border + 1px corner filigrees + holographic foil shimmer
      return `
        <div class="tier-filigree-corners pointer-events-none" aria-hidden="true">
          <span class="filigree-tl"></span>
          <span class="filigree-tr"></span>
          <span class="filigree-bl"></span>
          <span class="filigree-br"></span>
        </div>
        <div class="tier-holo-sheen pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'LR':
      // Stage 4 - Tier 9: Triple-layered frame + corner nodes + light-beam horizon + foil sheen
      return `
        <div class="tier-triple-frame pointer-events-none" aria-hidden="true">
          <span class="node-tl"></span>
          <span class="node-tr"></span>
          <span class="node-bl"></span>
          <span class="node-br"></span>
        </div>
        <div class="tier-horizon-beam pointer-events-none" aria-hidden="true"></div>
        <div class="tier-holo-sheen pointer-events-none" aria-hidden="true"></div>
      `.trim();

    case 'EX':
      // Stage 4 - Tier 10: 360° rotating conic-gradient perimeter mask + astral glow + laser sightlines
      return `
        <div class="tier-conic-perimeter pointer-events-none" aria-hidden="true"></div>
        <div class="tier-astral-glow pointer-events-none" aria-hidden="true"></div>
        <div class="tier-laser-sightlines pointer-events-none" aria-hidden="true">
          <span class="sight-tl"></span>
          <span class="sight-tr"></span>
          <span class="sight-bl"></span>
          <span class="sight-br"></span>
        </div>
        <div class="tier-holo-sheen pointer-events-none" aria-hidden="true"></div>
      `.trim();

    default:
      return '';
  }
}

// Deprecated backward-compatible alias
export const renderTierOrnaments = renderTierStructuralLayers;
