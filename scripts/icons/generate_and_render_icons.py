"""
DuyDev Studio - Luxury Icon Suite Generator & Renderer
Generates SVG vector source files and renders ultra-high-resolution PNG assets
matching the Stitch 'Obsidian Precision Spec' luxury dark monochrome design system.
Features:
- Obsidian black & white luxury aesthetic with subtle hairline chrome borders.
- Signature glowing, blurred status orb on all icons (multi-layered SVG bloom + specular reflection).
- Pixel-perfect typography and vector iconography.
"""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'src', 'assets')

icons = {
    'icon-512.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient (Obsidian Void) -->
    <linearGradient id="chassisBg512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="45%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>

    <!-- Hairline Chrome Border Gradient -->
    <linearGradient id="chromeBorder512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="35%" stop-color="#E4E4E7" stop-opacity="0.18" />
      <stop offset="70%" stop-color="#71717A" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.22" />
    </linearGradient>

    <!-- Top Specular Rim Reflection -->
    <linearGradient id="innerRim512" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.14" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>

    <!-- Monogram Typography Gradient (Pure White to Titanium Silver) -->
    <linearGradient id="monogramGrad512" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="65%" stop-color="#F4F4F6" />
      <stop offset="100%" stop-color="#A1A1AA" />
    </linearGradient>

    <!-- Ambient Center Spotlight Behind Monogram -->
    <radialGradient id="centerGlow512" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.08" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.02" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Status Orb Radial Glow Gradients -->
    <radialGradient id="orbCore512" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="35%" stop-color="#6EE7B7" />
      <stop offset="75%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </radialGradient>

    <radialGradient id="orbHalo512" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.85" />
      <stop offset="35%" stop-color="#10B981" stop-opacity="0.5" />
      <stop offset="70%" stop-color="#059669" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#10B981" stop-opacity="0" />
    </radialGradient>

    <!-- Filter: Monogram Subtle Depth -->
    <filter id="textShadow512" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.9" />
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.5" />
    </filter>

    <!-- Filter: Status Orb Blur & Glow -->
    <filter id="orbBloom512" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="12" result="blur1" />
      <feGaussianBlur stdDeviation="24" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2" />
        <feMergeNode in="blur1" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="diffuseGlow512" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur stdDeviation="28" />
    </filter>
  </defs>

  <!-- Outer Solid Mask Base -->
  <rect width="512" height="512" rx="128" fill="#070709" />

  <!-- Obsidian Precision Chassis with Hairline Chrome Stroke -->
  <rect x="14" y="14" width="484" height="484" rx="116" fill="url(#chassisBg512)" stroke="url(#chromeBorder512)" stroke-width="2.5" />

  <!-- Top Specular Rim Reflection -->
  <rect x="16" y="16" width="480" height="240" rx="114" fill="url(#innerRim512)" />

  <!-- Ambient Internal Spotlight -->
  <ellipse cx="256" cy="280" rx="190" ry="170" fill="url(#centerGlow512)" />

  <!-- Precision Optical Reticle (Instrument Aesthetic) -->
  <line x1="236" y1="418" x2="276" y2="418" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round" />
  <line x1="256" y1="408" x2="256" y2="428" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round" />

  <!-- Flagship 'DS' Monogram -->
  <text x="256" y="322" 
        font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="204" 
        font-weight="900" 
        letter-spacing="-8" 
        text-anchor="middle" 
        fill="url(#monogramGrad512)" 
        filter="url(#textShadow512)">DS</text>

  <!-- Signature Status Orb (Dấu tròn trên icon chính có hiệu ứng blur và glow) -->
  <!-- Layer 1: Diffuse Ambient Atmosphere -->
  <circle cx="396" cy="116" r="48" fill="url(#orbHalo512)" filter="url(#diffuseGlow512)" />
  <!-- Layer 2: Mid-Intensity Radiance Halo -->
  <circle cx="396" cy="116" r="30" fill="url(#orbHalo512)" filter="url(#orbBloom512)" />
  <!-- Layer 3: Precision Dark Lens Bevel Frame -->
  <circle cx="396" cy="116" r="20" fill="#061A10" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
  <!-- Layer 4: Intense Glowing Emerald/White Core -->
  <circle cx="396" cy="116" r="16" fill="url(#orbCore512)" />
  <!-- Layer 5: Specular Optical Highlight -->
  <ellipse cx="392" cy="112" rx="5" ry="3" fill="#FFFFFF" opacity="0.9" />
</svg>''',

    'icon-192.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="chassisBg192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="45%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>

    <!-- Hairline Chrome Border Gradient -->
    <linearGradient id="chromeBorder192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="35%" stop-color="#E4E4E7" stop-opacity="0.18" />
      <stop offset="70%" stop-color="#71717A" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.22" />
    </linearGradient>

    <!-- Top Specular Rim Reflection -->
    <linearGradient id="innerRim192" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.14" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>

    <!-- Monogram Typography Gradient -->
    <linearGradient id="monogramGrad192" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="65%" stop-color="#F4F4F6" />
      <stop offset="100%" stop-color="#A1A1AA" />
    </linearGradient>

    <!-- Center Spotlight -->
    <radialGradient id="centerGlow192" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Status Orb Gradients -->
    <radialGradient id="orbCore192" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="35%" stop-color="#6EE7B7" />
      <stop offset="75%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </radialGradient>

    <radialGradient id="orbHalo192" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.85" />
      <stop offset="40%" stop-color="#10B981" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#10B981" stop-opacity="0" />
    </radialGradient>

    <!-- Filters -->
    <filter id="textShadow192" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.85" />
    </filter>

    <filter id="orbBloom192" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="diffuseGlow192" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur stdDeviation="11" />
    </filter>
  </defs>

  <rect width="192" height="192" rx="48" fill="#070709" />
  <rect x="5" y="5" width="182" height="182" rx="44" fill="url(#chassisBg192)" stroke="url(#chromeBorder192)" stroke-width="1.5" />
  <rect x="6" y="6" width="180" height="90" rx="43" fill="url(#innerRim192)" />
  <ellipse cx="96" cy="105" rx="72" ry="64" fill="url(#centerGlow192)" />

  <text x="96" y="122" 
        font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="76" 
        font-weight="900" 
        letter-spacing="-3" 
        text-anchor="middle" 
        fill="url(#monogramGrad192)" 
        filter="url(#textShadow192)">DS</text>

  <!-- Glowing Status Orb -->
  <circle cx="148" cy="44" r="18" fill="url(#orbHalo192)" filter="url(#diffuseGlow192)" />
  <circle cx="148" cy="44" r="11" fill="url(#orbHalo192)" filter="url(#orbBloom192)" />
  <circle cx="148" cy="44" r="7.5" fill="#061A10" stroke="rgba(255,255,255,0.35)" stroke-width="0.8" />
  <circle cx="148" cy="44" r="6" fill="url(#orbCore192)" />
  <ellipse cx="146.5" cy="42.5" rx="1.8" ry="1.2" fill="#FFFFFF" opacity="0.9" />
</svg>''',

    'icon-maskable.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="chassisBgMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="45%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>

    <!-- Hairline Chrome Border Gradient -->
    <linearGradient id="chromeBorderMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="35%" stop-color="#E4E4E7" stop-opacity="0.18" />
      <stop offset="70%" stop-color="#71717A" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.22" />
    </linearGradient>

    <!-- Top Specular Rim Reflection -->
    <linearGradient id="innerRimMask" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.14" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>

    <!-- Monogram Typography Gradient -->
    <linearGradient id="monogramGradMask" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="65%" stop-color="#F4F4F6" />
      <stop offset="100%" stop-color="#A1A1AA" />
    </linearGradient>

    <!-- Center Spotlight -->
    <radialGradient id="centerGlowMask" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.08" />
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.02" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Status Orb Gradients -->
    <radialGradient id="orbCoreMask" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="35%" stop-color="#6EE7B7" />
      <stop offset="75%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </radialGradient>

    <radialGradient id="orbHaloMask" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.85" />
      <stop offset="35%" stop-color="#10B981" stop-opacity="0.5" />
      <stop offset="70%" stop-color="#059669" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#10B981" stop-opacity="0" />
    </radialGradient>

    <!-- Filters -->
    <filter id="textShadowMask" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.9" />
    </filter>

    <filter id="orbBloomMask" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="diffuseGlowMask" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur stdDeviation="22" />
    </filter>
  </defs>

  <!-- Full Canvas Mask Fill for Android Safe Zone -->
  <rect width="512" height="512" fill="#070709" />

  <!-- Inner Elevated Precision Chassis (Safe Zone Compliant) -->
  <rect x="64" y="64" width="384" height="384" rx="92" fill="url(#chassisBgMask)" stroke="url(#chromeBorderMask)" stroke-width="2" />
  <rect x="66" y="66" width="380" height="190" rx="90" fill="url(#innerRimMask)" />
  <ellipse cx="256" cy="275" rx="150" ry="130" fill="url(#centerGlowMask)" />

  <!-- Precision Optical Crosshair -->
  <line x1="240" y1="384" x2="272" y2="384" stroke="rgba(255,255,255,0.18)" stroke-width="1.2" stroke-linecap="round" />
  <line x1="256" y1="376" x2="256" y2="392" stroke="rgba(255,255,255,0.18)" stroke-width="1.2" stroke-linecap="round" />

  <!-- Monogram -->
  <text x="256" y="308" 
        font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="156" 
        font-weight="900" 
        letter-spacing="-6" 
        text-anchor="middle" 
        fill="url(#monogramGradMask)" 
        filter="url(#textShadowMask)">DS</text>

  <!-- Glowing Status Orb (Safe Zone Position) -->
  <circle cx="366" cy="146" r="38" fill="url(#orbHaloMask)" filter="url(#diffuseGlowMask)" />
  <circle cx="366" cy="146" r="24" fill="url(#orbHaloMask)" filter="url(#orbBloomMask)" />
  <circle cx="366" cy="146" r="16" fill="#061A10" stroke="rgba(255,255,255,0.35)" stroke-width="1.2" />
  <circle cx="366" cy="146" r="13" fill="url(#orbCoreMask)" />
  <ellipse cx="363" cy="143" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.9" />
</svg>''',

    'logo-ds.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="50%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>
    <linearGradient id="logoBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#71717A" stop-opacity="0.10" />
    </linearGradient>
    <linearGradient id="logoText" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#A1A1AA" />
    </linearGradient>
    <radialGradient id="logoOrbCore" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="40%" stop-color="#34D399" />
      <stop offset="100%" stop-color="#059669" />
    </radialGradient>
    <filter id="logoOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect x="2" y="2" width="92" height="92" rx="26" fill="url(#logoBg)" stroke="url(#logoBorder)" stroke-width="1.5" />
  <text x="48" y="61" 
        font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="38" 
        font-weight="900" 
        letter-spacing="-1.5" 
        text-anchor="middle" 
        fill="url(#logoText)">DS</text>
  <!-- Glowing Status Orb -->
  <circle cx="74" cy="22" r="7" fill="#10B981" opacity="0.4" filter="url(#logoOrbGlow)" />
  <circle cx="74" cy="22" r="4.5" fill="#061A10" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" />
  <circle cx="74" cy="22" r="3.5" fill="url(#logoOrbCore)" />
  <circle cx="73" cy="21" r="1" fill="#FFFFFF" />
</svg>''',

    'shortcut-pdf.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="pdfChassisBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="50%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>
    <linearGradient id="pdfChromeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#71717A" stop-opacity="0.10" />
    </linearGradient>
    <linearGradient id="pdfBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="100%" stop-color="#BE123C" />
    </linearGradient>
    <filter id="pdfOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="192" height="192" rx="48" fill="#070709" />
  <rect x="5" y="5" width="182" height="182" rx="44" fill="url(#pdfChassisBg)" stroke="url(#pdfChromeBorder)" stroke-width="1.5" />

  <!-- Document Sheet Body -->
  <path d="M 58 42 L 106 42 L 134 70 L 134 150 C 134 153.3 131.3 156 128 156 L 64 156 C 60.7 156 58 153.3 58 150 Z" 
        fill="#18181D" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
  <!-- Folded Corner in Titanium -->
  <path d="M 106 42 L 106 68 C 106 69.1 106.9 70 108 70 L 134 70 Z" 
        fill="#2A2A32" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
  <!-- Horizontal Text Guidelines -->
  <rect x="70" y="80" width="38" height="3.5" rx="1.75" fill="#52525B" />
  <rect x="70" y="92" width="52" height="3.5" rx="1.75" fill="#52525B" />
  <rect x="70" y="104" width="44" height="3.5" rx="1.75" fill="#52525B" />
  <!-- Luxury PDF Badge -->
  <rect x="66" y="118" width="60" height="24" rx="6" fill="url(#pdfBadgeGrad)" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
  <text x="96" y="135" 
        font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" 
        font-size="13" 
        font-weight="900" 
        letter-spacing="0.5" 
        text-anchor="middle" 
        fill="#FFFFFF">PDF</text>

  <!-- Glowing Status Orb -->
  <circle cx="148" cy="44" r="16" fill="#F43F5E" opacity="0.35" filter="url(#pdfOrbGlow)" />
  <circle cx="148" cy="44" r="7.5" fill="#1C060B" stroke="rgba(255,255,255,0.35)" stroke-width="0.8" />
  <circle cx="148" cy="44" r="6" fill="#F43F5E" />
  <circle cx="146.5" cy="42.5" r="1.5" fill="#FFFFFF" />
</svg>''',

    'shortcut-archive.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="arcChassisBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="50%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>
    <linearGradient id="arcChromeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#71717A" stop-opacity="0.10" />
    </linearGradient>
    <linearGradient id="arcBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="arcOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="192" height="192" rx="48" fill="#070709" />
  <rect x="5" y="5" width="182" height="182" rx="44" fill="url(#arcChassisBg)" stroke="url(#arcChromeBorder)" stroke-width="1.5" />

  <!-- Archive Box Container -->
  <path d="M 54 54 C 54 49.6 57.6 46 62 46 L 82 46 L 90 52 L 126 52 C 130.4 52 134 55.6 134 60 L 134 144 C 134 148.4 130.4 152 126 152 L 62 152 C 57.6 152 54 148.4 54 144 Z" 
        fill="#18181D" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
  <line x1="54" y1="62" x2="134" y2="62" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />

  <!-- Precision Zipper Track -->
  <rect x="89" y="62" width="10" height="50" fill="#0E0E12" />
  <rect x="84" y="66" width="8" height="5.5" rx="1.5" fill="#E4E4E7" />
  <rect x="96" y="73" width="8" height="5.5" rx="1.5" fill="#F59E0B" />
  <rect x="84" y="80" width="8" height="5.5" rx="1.5" fill="#E4E4E7" />
  <rect x="96" y="87" width="8" height="5.5" rx="1.5" fill="#F59E0B" />
  <rect x="82" y="94" width="24" height="18" rx="4" fill="#2A2A32" stroke="#F59E0B" stroke-width="1.5" />
  <circle cx="94" cy="103" r="2" fill="#F59E0B" />

  <!-- Luxury ZIP Badge -->
  <rect x="66" y="122" width="60" height="22" rx="6" fill="url(#arcBadgeGrad)" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
  <text x="96" y="137" 
        font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" 
        font-size="12" 
        font-weight="900" 
        letter-spacing="0.5" 
        text-anchor="middle" 
        fill="#FFFFFF">ZIP</text>

  <!-- Glowing Status Orb -->
  <circle cx="148" cy="44" r="16" fill="#F59E0B" opacity="0.35" filter="url(#arcOrbGlow)" />
  <circle cx="148" cy="44" r="7.5" fill="#1C1204" stroke="rgba(255,255,255,0.35)" stroke-width="0.8" />
  <circle cx="148" cy="44" r="6" fill="#F59E0B" />
  <circle cx="146.5" cy="42.5" r="1.5" fill="#FFFFFF" />
</svg>''',

    'shortcut-qr.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="qrChassisBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16161B" />
      <stop offset="50%" stop-color="#0E0E12" />
      <stop offset="100%" stop-color="#070709" />
    </linearGradient>
    <linearGradient id="qrChromeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#71717A" stop-opacity="0.10" />
    </linearGradient>
    <filter id="qrOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="192" height="192" rx="48" fill="#070709" />
  <rect x="5" y="5" width="182" height="182" rx="44" fill="url(#qrChassisBg)" stroke="url(#qrChromeBorder)" stroke-width="1.5" />

  <!-- Optical QR Finder Eyes (Crisp White & Ice Cyan) -->
  <rect x="50" y="52" width="28" height="28" rx="6" fill="none" stroke="#FFFFFF" stroke-width="3.5" />
  <rect x="58" y="60" width="12" height="12" rx="2.5" fill="#38BDF8" />

  <rect x="106" y="52" width="28" height="28" rx="6" fill="none" stroke="#FFFFFF" stroke-width="3.5" />
  <rect x="114" y="60" width="12" height="12" rx="2.5" fill="#38BDF8" />

  <rect x="50" y="108" width="28" height="28" rx="6" fill="none" stroke="#FFFFFF" stroke-width="3.5" />
  <rect x="58" y="116" width="12" height="12" rx="2.5" fill="#38BDF8" />

  <!-- Matrix Data Pixels (Platinum & Ice Cyan) -->
  <rect x="86" y="54" width="8" height="8" rx="2" fill="#E4E4E7" />
  <rect x="86" y="72" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="86" y="90" width="8" height="8" rx="2" fill="#FFFFFF" />
  <rect x="86" y="108" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="86" y="126" width="8" height="8" rx="2" fill="#E4E4E7" />

  <rect x="106" y="90" width="8" height="8" rx="2" fill="#FFFFFF" />
  <rect x="126" y="90" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="106" y="108" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="126" y="108" width="8" height="8" rx="2" fill="#FFFFFF" />
  <rect x="106" y="126" width="8" height="8" rx="2" fill="#E4E4E7" />
  <rect x="126" y="126" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="68" y="90" width="8" height="8" rx="2" fill="#E4E4E7" />

  <!-- Glowing Status Orb -->
  <circle cx="148" cy="44" r="16" fill="#38BDF8" opacity="0.35" filter="url(#qrOrbGlow)" />
  <circle cx="148" cy="44" r="7.5" fill="#051824" stroke="rgba(255,255,255,0.35)" stroke-width="0.8" />
  <circle cx="148" cy="44" r="6" fill="#38BDF8" />
  <circle cx="146.5" cy="42.5" r="1.5" fill="#FFFFFF" />
</svg>'''
}

def main():
    os.makedirs(ASSETS, exist_ok=True)
    for name, content in icons.items():
        out_path = os.path.join(ASSETS, name)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(content.strip() + '\n')
        print(f"Generated SVG: {name}")

    render_tasks = [
        ('icon-192.svg', 'icon-192.png', 192, 192),
        ('icon-512.svg', 'icon-512.png', 512, 512),
        ('icon-maskable.svg', 'icon-maskable-192.png', 192, 192),
        ('icon-maskable.svg', 'icon-maskable-512.png', 512, 512),
        ('shortcut-pdf.svg', 'shortcut-pdf.png', 192, 192),
        ('shortcut-archive.svg', 'shortcut-archive.png', 192, 192),
        ('shortcut-qr.svg', 'shortcut-qr.png', 192, 192),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for svg_name, png_name, width, height in render_tasks:
            svg_file = os.path.join(ASSETS, svg_name)
            png_file = os.path.join(ASSETS, png_name)
            svg_content = open(svg_file, 'r', encoding='utf-8').read()
            html = f'''<!DOCTYPE html><html><head><meta charset="utf-8"><style>* {{ margin:0; padding:0; }} html, body {{ width:{width}px; height:{height}px; overflow:hidden; background:transparent; display:flex; }} svg {{ width:{width}px; height:{height}px; display:block; }}</style></head><body>{svg_content}</body></html>'''
            page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page.set_content(html)
            page.screenshot(path=png_file, omit_background=True)
            page.close()
            print(f"Rendered PNG: {png_name} ({width}x{height})")
        browser.close()
    print("All icons successfully generated and rendered!")

if __name__ == '__main__':
    main()
