---
id: KI-FIX-002-studocu-blank-pages-virtual-scroll
title: "Fixing Blank White Page 1 and Offscreen Page Renders in Studocu Virtual DOM"
type: troubleshoot
status: verified
domain: frontend
tags: [virtual-scroll, blank-page, dom-cloning, computed-style, studocu, pdf-export]
created_at: 2026-09-19
updated_at: 2026-09-19
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Exported PDF contains completely blank white pages on Page 1 (cover) or offscreen pages while other pages render normally"
search_queries:
  - "studocu page 1 blank white in exported pdf"
  - "virtual scroll page-content display none cloned dom"
  - "studocu downloader missing text cover page empty"
  - "fix blank white pages studocu headless chrome"
related_kis:
  - KI-FIX-003-studocu-paywalled-blurred-pages-bypass
  - KI-FIX-004-missing-pages-chunk-capture-pipeline
---

# [KI-FIX-002] Fixing Blank White Page 1 and Offscreen Page Renders in Studocu Virtual DOM

## 1. Context & Purpose
When downloading multi-page documents from Studocu using headless browser DOM extraction, Page 1 (the document cover) and several offscreen pages frequently rendered as completely blank white pages in the generated PDF, even though the total page count was correctly detected. 

This Knowledge Item documents the root cause analysis and resolution for virtual DOM virtualization artifacts where Studocu's client-side virtualizer unmounts or hides offscreen pages using inline `display: none;`, which inadvertently gets copied into the isolated A4 print DOM.

## 2. Prerequisites & Root Cause Analysis
- **Context**: Studocu Next.js reader frontend (`viewer-wrapper`).
- **Target Elements**: `.page-content`, `.pf` (page frame), `.pc` (page content container), `.t` (text layer spans), background `<img>` and `<canvas>`.
- **Root Causes Identified**:
  1. **Virtual DOM Offscreen Culling**: Studocu's virtual scroll observer monitors scroll positions. When a page exits the active viewport window (or before it enters), the framework applies `style="display: none;"` directly to `<div class="page-content">` to save GPU and layout memory.
  2. **Computed Style Freezing Bug**: The DOM cloning pipeline iterates through computed styles via `window.getComputedStyle(source)` and serializes them onto target elements using `!important`. Because Page 1 was scrolled past or offscreen pages were unmounted, `display: none` was computed and stamped onto `.page-content`, completely hiding the inner `.pc` container (which holds the text layer `.t` and background `bg1.png`).
  3. **Cover Page Specifics**: Page 1 often has distinct CSS classes and lazy-load thresholds, making it the most vulnerable to immediate culling once the scraper scrolls down to inspect subsequent pages.

## 3. Core Instructions / Solution

### Step 1: Override Display and Visibility in Style Cloner
Modify `window.__std_copyStyles` in `studocu_dl/dom_scripts.py` to prevent copying `display: none` or `visibility: hidden` for any element containing document content:

```javascript
// studocu_dl/dom_scripts.py
window.__std_copyStyles = function(source, target) {
    const computed = window.getComputedStyle(source);
    let css = '';
    const props = [
        'position', 'left', 'top', 'right', 'bottom', 'width', 'height',
        'min-width', 'min-height', 'max-width', 'max-height',
        'display', 'visibility', 'z-index', 'box-sizing',
        'margin', 'padding', 'transform', 'transform-origin',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'letter-spacing', 'word-spacing', 'white-space', 'text-align',
        'color', 'background', 'background-color', 'background-image',
        'background-size', 'background-position', 'background-repeat',
        'border', 'border-radius', 'overflow'
    ];
    for (const p of props) {
        let v = computed.getPropertyValue(p);
        if (!v) continue;

        // CRITICAL FIX: Never copy display: none or visibility: hidden to document containers
        if (p === 'display') {
            if (source.matches?.('.page-content, [class*="page-content"], .pf, .pc, div[data-page-index]') ||
                source.querySelector?.('.pc, .pf, img, canvas, .t')) {
                v = 'block';
            }
        }
        if (p === 'visibility') {
            if (source.matches?.('.page-content, [class*="page-content"], .pf, .pc, div[data-page-index]') ||
                source.querySelector?.('.pc, .pf, img, canvas, .t')) {
                v = 'visible';
            }
        }
        css += `${p}:${v}!important;`;
    }
    target.style.cssText += css;
};
```

### Step 2: Global De-Cloaking Display Enforcement
Ensure `window.__std_deCloak` forces active display on all potential page root containers:

```javascript
// studocu_dl/dom_scripts.py
window.__std_deCloak = function() {
    // Force visibility and block display across all page containers
    document.querySelectorAll('.page-content, [class*="page-content"], .pf, .pc, div[data-page-index]').forEach(el => {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('-webkit-filter', 'none', 'important');
        el.style.setProperty('backdrop-filter', 'none', 'important');
    });

    // Ensure text layer spans are selectable and fully opaque
    document.querySelectorAll('.t, .textLayer span, [class*="textLayer"] span, [class*="text-layer"] span').forEach(el => {
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('filter', 'none', 'important');
    });
};
```

### Step 3: Post-Clone Enforcement in Page Builder
In `window.__std_clonePageElement`, add a mandatory post-clone sweep to enforce block display on all cloned children:

```javascript
// studocu_dl/dom_scripts.py
window.__std_clonePageElement = function(source) {
    const clone = source.cloneNode(true);
    // ... copy styles and convert canvases to images ...

    // Guarantee that no cloned child container remains hidden
    clone.querySelectorAll('.page-content, [class*="page-content"], .pc, .pf').forEach(el => {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
    });

    return clone;
};
```

## 4. Gotchas & Edge Cases
- > [!NOTE]
  > **Canvas Formula Rendering**: Mathematical formulas and diagrams in Studocu are rendered via `<canvas>`. Cloning a canvas without converting its buffer produces a blank rectangle. The clone routine must convert every canvas to an `<img>` via `canvas.toDataURL('image/png')` before appending it to the print DOM.
- > [!WARNING]
  > **Viewer Background Artifacts**: Studocu applies light-gray or blue background colors (`#f5f5f5`, `rgba(0,0,0,0.05)`) to viewer containers. Ensure `__std_copyStyles` normalizes near-white background colors (`r > 220, g > 220, b > 220`) to `#ffffff` and translucent overlays to `transparent` to avoid dirty grey masks on the printed A4 page.

## 5. Verification
1. Export a known multi-page document (e.g. 20+ pages).
2. Inspect Page 1 and offscreen pages using PyMuPDF:
   ```python
   import pymupdf
   doc = pymupdf.open("output.pdf")
   page1 = doc[0]
   pix = page1.get_pixmap()
   pix.save("page_1.png")
   ```
3. Visually verify `page_1.png`:
   - Title, cover image, and metadata are 100% visible and crisp.
   - No blank white areas or missing background elements.

## 6. Changelog
- **2026-09-19 (v1.0.0)**: Initial documentation of virtual scroll offscreen display override and canvas preservation by @anhduy.
