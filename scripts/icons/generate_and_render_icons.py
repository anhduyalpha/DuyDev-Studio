"""
DuyDev Studio - Icon Suite Generator & Renderer
Generates SVG vector source files and renders ultra-high-resolution PNG assets
matching the Stitch 'Deep Tech Utility' design theme.
"""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'src', 'assets')

icons = {
    'icon-192.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="grad192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="50%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="text192" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#CFFAFE" />
    </linearGradient>
    <filter id="glow192" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="192" height="192" rx="48" fill="#0B0F17" />
  <rect x="8" y="8" width="176" height="176" rx="42" fill="#111827" stroke="url(#grad192)" stroke-width="6" filter="url(#glow192)" />
  <rect x="10" y="10" width="172" height="172" rx="40" fill="#111827" />
  <text x="96" y="118" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="72" 
        font-weight="900" 
        letter-spacing="-2" 
        text-anchor="middle" 
        fill="url(#text192)">DS</text>
  <circle cx="146" cy="46" r="8" fill="#10B981" />
  <circle cx="146" cy="46" r="14" fill="#10B981" opacity="0.3" />
</svg>''',

    'icon-512.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="50%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="text512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#CFFAFE" />
    </linearGradient>
    <filter id="glow512" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="#0B0F17" />
  <rect x="20" y="20" width="472" height="472" rx="112" fill="#111827" stroke="url(#grad512)" stroke-width="14" filter="url(#glow512)" />
  <rect x="24" y="24" width="464" height="464" rx="108" fill="#111827" />
  <text x="256" y="316" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="192" 
        font-weight="900" 
        letter-spacing="-6" 
        text-anchor="middle" 
        fill="url(#text512)">DS</text>
  <circle cx="392" cy="120" r="22" fill="#10B981" />
  <circle cx="392" cy="120" r="38" fill="#10B981" opacity="0.3" />
</svg>''',

    'icon-maskable.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="mgrad512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="50%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
    <linearGradient id="mtext512" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#CFFAFE" />
    </linearGradient>
    <filter id="mglow512" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" fill="#0B0F17" />
  <rect x="68" y="68" width="376" height="376" rx="88" fill="#111827" stroke="url(#mgrad512)" stroke-width="10" filter="url(#mglow512)" />
  <rect x="72" y="72" width="368" height="368" rx="84" fill="#111827" />
  <text x="256" y="306" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="154" 
        font-weight="900" 
        letter-spacing="-5" 
        text-anchor="middle" 
        fill="url(#mtext512)">DS</text>
  <circle cx="366" cy="146" r="18" fill="#10B981" />
  <circle cx="366" cy="146" r="30" fill="#10B981" opacity="0.3" />
</svg>''',

    'shortcut-pdf.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="pdfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F43F5E" />
      <stop offset="100%" stop-color="#BE123C" />
    </linearGradient>
    <filter id="pdfGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="192" height="192" rx="48" fill="#0B0F17" />
  <rect x="8" y="8" width="176" height="176" rx="42" fill="#111827" stroke="url(#pdfGrad)" stroke-width="5" filter="url(#pdfGlow)" />
  <rect x="10" y="10" width="172" height="172" rx="40" fill="#111827" />
  <path d="M 58 42 L 106 42 L 134 70 L 134 150 C 134 153.3 131.3 156 128 156 L 64 156 C 60.7 156 58 153.3 58 150 Z" 
        fill="#1E293B" stroke="#334155" stroke-width="2.5" />
  <path d="M 106 42 L 106 68 C 106 69.1 106.9 70 108 70 L 134 70 Z" 
        fill="#334155" />
  <rect x="70" y="80" width="38" height="4" rx="2" fill="#475569" />
  <rect x="70" y="92" width="52" height="4" rx="2" fill="#475569" />
  <rect x="70" y="104" width="44" height="4" rx="2" fill="#475569" />
  <rect x="66" y="118" width="60" height="24" rx="5" fill="#E11D48" />
  <text x="96" y="135" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="13" 
        font-weight="900" 
        letter-spacing="0.5" 
        text-anchor="middle" 
        fill="#FFFFFF">PDF</text>
  <circle cx="146" cy="46" r="7" fill="#F43F5E" />
  <circle cx="146" cy="46" r="12" fill="#F43F5E" opacity="0.3" />
</svg>''',

    'shortcut-archive.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="archiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <filter id="archiveGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="192" height="192" rx="48" fill="#0B0F17" />
  <rect x="8" y="8" width="176" height="176" rx="42" fill="#111827" stroke="url(#archiveGrad)" stroke-width="5" filter="url(#archiveGlow)" />
  <rect x="10" y="10" width="172" height="172" rx="40" fill="#111827" />
  <path d="M 54 54 C 54 49.6 57.6 46 62 46 L 82 46 L 90 52 L 126 52 C 130.4 52 134 55.6 134 60 L 134 144 C 134 148.4 130.4 152 126 152 L 62 152 C 57.6 152 54 148.4 54 144 Z" 
        fill="#1E293B" stroke="#334155" stroke-width="2.5" />
  <line x1="54" y1="62" x2="134" y2="62" stroke="#334155" stroke-width="1.5" />
  <rect x="89" y="62" width="10" height="50" fill="#0F172A" />
  <rect x="84" y="66" width="8" height="6" rx="1.5" fill="#F59E0B" />
  <rect x="96" y="73" width="8" height="6" rx="1.5" fill="#FBBF24" />
  <rect x="84" y="80" width="8" height="6" rx="1.5" fill="#F59E0B" />
  <rect x="96" y="87" width="8" height="6" rx="1.5" fill="#FBBF24" />
  <rect x="82" y="94" width="24" height="18" rx="4" fill="#F59E0B" stroke="#D97706" stroke-width="1.5" />
  <path d="M 89 110 L 99 110 L 97 119 C 97 120.5 91 120.5 91 119 Z" fill="#FDE68A" />
  <circle cx="94" cy="115" r="1.5" fill="#0B0F17" />
  <rect x="66" y="122" width="60" height="22" rx="5" fill="#D97706" />
  <text x="96" y="137" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="12" 
        font-weight="900" 
        letter-spacing="0.5" 
        text-anchor="middle" 
        fill="#FFFFFF">ZIP</text>
  <circle cx="146" cy="46" r="7" fill="#F59E0B" />
  <circle cx="146" cy="46" r="12" fill="#F59E0B" opacity="0.3" />
</svg>''',

    'shortcut-qr.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="50%" stop-color="#0EA5E9" />
      <stop offset="100%" stop-color="#6366F1" />
    </linearGradient>
    <filter id="qrGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="192" height="192" rx="48" fill="#0B0F17" />
  <rect x="8" y="8" width="176" height="176" rx="42" fill="#111827" stroke="url(#qrGrad)" stroke-width="5" filter="url(#qrGlow)" />
  <rect x="10" y="10" width="172" height="172" rx="40" fill="#111827" />
  <rect x="50" y="52" width="28" height="28" rx="5" fill="none" stroke="#22D3EE" stroke-width="4" />
  <rect x="58" y="60" width="12" height="12" rx="2" fill="#22D3EE" />
  <rect x="106" y="52" width="28" height="28" rx="5" fill="none" stroke="#22D3EE" stroke-width="4" />
  <rect x="114" y="60" width="12" height="12" rx="2" fill="#22D3EE" />
  <rect x="50" y="108" width="28" height="28" rx="5" fill="none" stroke="#22D3EE" stroke-width="4" />
  <rect x="58" y="116" width="12" height="12" rx="2" fill="#22D3EE" />
  <rect x="86" y="54" width="8" height="8" rx="2" fill="#06B6D4" />
  <rect x="86" y="72" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="86" y="90" width="8" height="8" rx="2" fill="#22D3EE" />
  <rect x="86" y="108" width="8" height="8" rx="2" fill="#06B6D4" />
  <rect x="86" y="126" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="106" y="90" width="8" height="8" rx="2" fill="#6366F1" />
  <rect x="126" y="90" width="8" height="8" rx="2" fill="#818CF8" />
  <rect x="106" y="108" width="8" height="8" rx="2" fill="#38BDF8" />
  <rect x="126" y="108" width="8" height="8" rx="2" fill="#22D3EE" />
  <rect x="106" y="126" width="8" height="8" rx="2" fill="#6366F1" />
  <rect x="126" y="126" width="8" height="8" rx="2" fill="#818CF8" />
  <rect x="68" y="90" width="8" height="8" rx="2" fill="#06B6D4" />
  <circle cx="146" cy="46" r="7" fill="#06B6D4" />
  <circle cx="146" cy="46" r="12" fill="#06B6D4" opacity="0.3" />
</svg>'''
}

def main():
    os.makedirs(ASSETS, exist_ok=True)
    for name, content in icons.items():
        with open(os.path.join(ASSETS, name), 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated {name}")

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
            print(f"Rendered {png_name} ({width}x{height})")
        browser.close()

if __name__ == '__main__':
    main()
