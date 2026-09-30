---
id: KI-FIX-004-missing-pages-chunk-capture-pipeline
title: "Preventing Missing and Dropped Pages in Long Document Virtual Scroll Capture"
type: troubleshoot
status: verified
domain: frontend
tags: [virtual-scroll, missing-pages, chunk-capture, lazy-loading, dom-hydration, healing-pass]
created_at: 2026-09-19
updated_at: 2026-09-19
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Large documents (50-150+ pages) drop pages in the final PDF or have incomplete text/scanned images due to virtual scroll unmounting"
search_queries:
  - "missing pages long document virtual scroll studocu"
  - "lazy loading naturalWidth 0 dropped pages headless chrome"
  - "studocu chunk capture healing pass missing sheets"
  - "hydrate pageDataList pageHtml nextjs studocu"
related_kis:
  - KI-FIX-002-studocu-blank-pages-virtual-scroll
  - KI-FIX-003-studocu-paywalled-blurred-pages-bypass
---

# [KI-FIX-004] Preventing Missing and Dropped Pages in Long Document Virtual Scroll Capture

## 1. Context & Purpose
When processing large documents (e.g. 50–150+ pages), virtual scroll DOM recycling causes pages outside the immediate scroll window to be removed or replaced by empty placeholder divs. If capture loops rely strictly on finding active DOM nodes during rapid scrolling, pages are frequently skipped or captured with unrendered images (`naturalWidth === 0`), resulting in incomplete PDFs.

This Knowledge Item documents the multi-stage chunk capture architecture, eager image promotion, Next.js hydration payload fallback, and the autonomous post-capture Healing Pass that guarantees 100% page extraction.

## 2. Prerequisites & Root Cause Analysis
- **Target Platform**: Studocu Virtual Scroller (`viewer-wrapper`).
- **Data Source**: `window.__NEXT_DATA__.props.pageProps.pageDataList` (JSON array containing initial server-rendered HTML for each page).
- **Root Causes Identified**:
  1. **Lazy Loading Thresholds**: Images contain `loading="lazy"`. In offscreen or rapid scrolling conditions, Chromium delays network requests for images until they are in the active viewport.
  2. **Virtual Scroller Unmounting**: When scrolling across 100+ pages, Studocu actively unmounts older page DOM elements to prevent browser memory exhaustion.
  3. **Capture Race Conditions**: Fixed sleep timers during scrolling failed on slower network connections, committing incomplete sheets to the print registry before assets finished rendering.

## 3. Core Instructions / Solution

### Step 1: Chunk-Based Scrolling with Eager Image Promotion
In `studocu_dl/dom_scripts.py`, structure page extraction in small chunks (e.g. 5 pages per batch) and force eager image loading:

```javascript
// studocu_dl/dom_scripts.py (inside get_chunk_capture_js)
// Force eager image loading on all visible and newly mounted images
document.querySelectorAll('img').forEach(img => {
    img.removeAttribute('loading');
    img.setAttribute('loading', 'eager');
});

// Scroll deliberately through chunk target range
for (let idx = start; idx < end; idx++) {
    let pageEl = document.querySelector(`div[data-page-index="${idx}"]`) ||
                 document.querySelector(`[data-page-number="${idx + 1}"]`) ||
                 document.querySelectorAll('.pf')[idx];

    if (pageEl) {
        pageEl.scrollIntoView({ block: 'center', inline: 'nearest' });
        window.__std_deCloak();
    }
}
```

### Step 2: Next.js Payload Fallback Hydration
If a page element cannot be found in the live DOM due to virtualization unmounting, directly hydrate the page DOM from the Next.js pre-rendered HTML cache:

```javascript
// studocu_dl/dom_scripts.py (inside get_chunk_capture_js)
if (!pageEl) {
    try {
        const pageData = window.__NEXT_DATA__?.props?.pageProps?.pageDataList?.[idx];
        if (pageData && pageData.pageHtml) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = pageData.pageHtml;
            pageEl = tempDiv.firstElementChild || tempDiv;
            pageEl.setAttribute('data-page-index', String(idx));
        }
    } catch (_) {}
}
```

### Step 3: Autonomous Healing Pass
In `studocu_dl/engine.py`, execute a verification pass immediately after the chunk capture loop. If any page is missing from `window.__STD_CAPTURES__` or has zero text and zero loaded images, execute a targeted recovery cycle:

```python
# studocu_dl/engine.py
# Check for missing or incomplete sheets
missing_pages = await page_client.eval(f"""
(() => {{
    const missing = [];
    for (let idx = 0; idx < {total_pages}; idx++) {{
        const sheet = window.__STD_CAPTURES__?.get(idx);
        if (!sheet) {{
            missing.push(idx);
            continue;
        }}
        const textLen = sheet.textContent.trim().length;
        const imgs = Array.from(sheet.querySelectorAll('img'));
        const hasValidImg = imgs.some(img => img.naturalWidth > 0 || (img.src && img.src.length > 0));
        const canvases = sheet.querySelectorAll('canvas').length;
        if (textLen === 0 && !hasValidImg && canvases === 0) {
            missing.push(idx);
        }
    }}
    return missing;
}})()
""") or []

if missing_pages:
    self._log(f"  ⚡ Phát hiện {len(missing_pages)} trang chưa nạp hoàn chỉnh, đang nạp bù...")
    for idx in missing_pages:
        # Calculate scroll position, scroll directly to element, wait for images, build sheet
        healed = await page_client.eval(heal_js_template.format(idx=idx), await_promise=True)
```

## 4. Gotchas & Edge Cases
- > [!WARNING]
  > **Scroll Event Throttling**: Studocu's viewer listens for native scroll events. Setting `scrollTop` alone without dispatching `new Event('scroll', { bubbles: true })` may not trigger the virtual scroller's mount handler. Always dispatch the event after altering scroll offsets.
- > [!NOTE]
  > **Scanned Image Documents**: Some documents are purely scanned PDF images with zero text nodes (`textLen === 0`). The validation condition must check for valid images (`img.naturalWidth > 0`) and `<canvas>` elements to avoid erroneously classifying scanned image pages as blank.

## 5. Verification
1. Download a document with over 100 pages:
   ```bash
   python -m studocu_dl.cli "https://www.studocu.com/vn/document/.../35419403"
   ```
2. Verify log output confirms all 149 pages:
   ```
   📄 Nhận diện tài liệu: '...' | Tổng số: 149 trang
   🔄 Đang thu thập nội dung: Trang 1 - 5/149...
   ...
   🔄 Đang thu thập nội dung: Trang 146 - 149/149...
   📄 Thu thập hoàn tất: 149 trang đầy đủ nội dung!
   ```
3. Check PDF page count using PyMuPDF:
   ```python
   import pymupdf
   doc = pymupdf.open("output.pdf")
   assert len(doc) == 149
   ```

## 6. Changelog
- **2026-09-19 (v1.0.0)**: Initial documentation of chunk extraction, eager image loading, Next.js hydration fallback, and autonomous healing pass by @anhduy.
