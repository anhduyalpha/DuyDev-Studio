---
id: KI-FIX-003-studocu-paywalled-blurred-pages-bypass
title: "Bypassing Studocu Blurred Paywalled Pages via Selective Active Session Reset"
type: troubleshoot
status: verified
domain: backend
tags: [paywall, blur, cloaking, cookies, cloudfront, studocu, guest-quota]
created_at: 2026-09-19
updated_at: 2026-09-19
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Document pages beyond preview limit (e.g. pages 3, 6, 7...) are blurred with WebP artifacts, missing text layers, or covered by Premium paywall overlays"
search_queries:
  - "studocu blurred pages fix bypass"
  - "studocu download paywall blur removal"
  - "hasBlurredPages true studocu bypass"
  - "replace blurred webp with unblurred png studocu"
related_kis:
  - KI-FIX-001-persistent-browser-session-cloudflare
  - KI-FIX-002-studocu-blank-pages-virtual-scroll
  - KI-FIX-004-missing-pages-chunk-capture-pipeline
---

# [KI-FIX-003] Bypassing Studocu Blurred Paywalled Pages via Selective Active Session Reset

## 1. Context & Purpose
Studocu provides free guests with full access to a limited number of pages. Once a guest's browser has viewed a few documents or pages, Studocu flags the session with `hasBlurredPages: true`. For subsequent or paywalled pages, Studocu does not render the text layer (`.t`) in the DOM and instead serves an obfuscated low-resolution WebP image (`blurred/page{n}.webp`) covered with a "Premium" upsell banner.

This Knowledge Item documents the root cause and the dual-layer solution: (1) an active clean session mechanism that resets guest quotas while maintaining Cloudflare clearance, and (2) a client-side DOM fallback that replaces obfuscated WebP assets with authentic high-resolution CloudFront PNGs.

## 2. Prerequisites & Root Cause Analysis
- **Target Platform**: Studocu Web Document Viewer.
- **Server State**: `window.__NEXT_DATA__.props.pageProps.documentAccess`.
- **Root Causes Identified**:
  1. **Client Quota Tracking**: Studocu tracks viewing history via specific browser cookies (`sd_docs`, `sd_views`, `fdisi`, `laravel_session`) and `localStorage` keys. When these tracking tokens accumulate, the server enforces the paywall.
  2. **Selective DOM Suppression**: When `hasBlurredPages` is active, Studocu's Next.js renderer intentionally strips `.t` text spans from the virtual DOM for restricted pages, rendering pure CSS blur removal ineffective because the underlying vector text was never sent to the client.
  3. **CloudFront CDN Wildcard Token**: When a document is accessed under an unblurred session (`hasBlurredPages: false`), the signed query parameter (`signedQueryParams.global` or `signedQueryParams.png`) is valid for all pages (`bg1.png` through `bgN.png`). Under a blurred session, the server only signs URLs for `blurred/page{n}.webp`.

## 3. Core Instructions / Solution

### Step 1: Active Clean Session Preparation (Cookie & Storage Scrub)
Before navigating to any document (or whenever `hasBlurredPages: true` is detected), purge Studocu tracking cookies while strictly preserving Cloudflare clearance:

```python
# studocu_dl/engine.py
async def _prepare_clean_studocu_session(self, page_client: StudocuCDPClient):
    """Purge Studocu tracking cookies to grant unblurred guest access.
    Preserve Cloudflare tokens (cf_clearance, __cf_bm, _cfuvid) to avoid Turnstile challenges."""
    try:
        cookies = (await page_client.send("Network.getCookies")).get("cookies", [])
        for ck in cookies:
            name = ck.get("name", "")
            if "cf" in name.lower():
                continue  # PRESERVE CLOUDFLARE TOKENS
            domain = ck.get("domain", "")
            path = ck.get("path", "/")
            await page_client.send("Network.deleteCookies", {
                "name": name,
                "domain": domain,
                "path": path
            })

        await page_client.eval("""(() => {
            try { localStorage.clear(); } catch (_) {}
            try { sessionStorage.clear(); } catch (_) {}
        })()""")
    except Exception as e:
        pass
```

### Step 2: Auto-Detection & Reload Gate in Download Lifecycle
In `studocu_dl/engine.py`, inspect `window.__NEXT_DATA__` during initial navigation. If a blurred state is encountered on a guest session, trigger an immediate reset and reload:

```python
# studocu_dl/engine.py
has_blur = await page_client.eval(
    "!!window.__NEXT_DATA__?.props?.pageProps?.documentAccess?.hasBlurredPages"
)
if has_blur and not self.cookie:
    self._log("  ⚠️ Phát hiện tài liệu bị giới hạn xem trước (làm mờ). Đang tự động kích hoạt phiên sạch...")
    await self._prepare_clean_studocu_session(page_client)
    await page_client.eval("document.title = '__STD_NAV__'")
    await page_client.send("Page.navigate", {"url": self.url})
    await asyncio.sleep(1.0)
    return await self._wait_for_page_ready(page_client)
```

Upon reload with clean guest cookies, Studocu responds with `hasBlurredPages: false`, transmitting the complete text layer and clean background PNGs for the entire document.

### Step 3: DOM-Level De-Cloaking and Asset Swap Fallback
In `studocu_dl/dom_scripts.py`, ensure that if any blurred asset persists in the DOM, it is dynamically replaced with the signed CloudFront original:

```javascript
// studocu_dl/dom_scripts.py
window.__std_deCloak = function() {
    // 1. Remove all overlay and paywall banners
    document.querySelectorAll(
        '#onetrust-consent-sdk, #onetrust-banner-sdk, #upgrade-overlay, ' +
        '[class*="paywall" i], [class*="Paywall" i], [class*="PremiumBanner" i], ' +
        '[class*="InlineBanner" i], [class*="inlineBanner" i], ' +
        '[class*="upsell" i], [class*="banner-wrapper" i], [class*="blurred-container" i], ' +
        '[class*="blur-overlay" i], [data-test-selector*="paywall" i], [id*="paywall" i]'
    ).forEach(el => {
        if (!el.matches('.pf, .pc, div[data-page-index]')) el.remove();
    });

    // 2. Remove blur filters and restore opacity
    document.querySelectorAll('[class*="blurred" i], [class*="blur" i]').forEach(el => {
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('-webkit-filter', 'none', 'important');
        el.style.setProperty('backdrop-filter', 'none', 'important');
        el.style.setProperty('opacity', '1', 'important');
    });

    // 3. Swap blurred WebP with authentic CloudFront PNG if signed params exist
    try {
        const pd = window.__NEXT_DATA__?.props?.pageProps;
        const baseUrl = pd?.documentAccess?.url;
        const signedParams = pd?.documentAccess?.signedQueryParams;
        const query = signedParams?.global || signedParams?.png || '';
        if (baseUrl && query) {
            document.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src') || img.src || '';
                if (src.includes('blurred') || src.includes('blur')) {
                    const pageEl = img.closest('div[data-page-index], [data-page-number], .pf');
                    const idx = parseInt(pageEl?.getAttribute('data-page-index') || '-1', 10);
                    if (idx >= 0) {
                        img.src = `${baseUrl}bg${idx + 1}.png${query}`;
                        img.removeAttribute('srcset');
                    }
                }
            });
        }
    } catch (_) {}
};
```

## 4. Gotchas & Edge Cases
- > [!IMPORTANT]
  > **User-Provided Premium Cookies**: If the user explicitly passes their own session cookie (`--cookie`), do **NOT** run `_prepare_clean_studocu_session()`, as this would log the user out. The engine only runs automatic clean session resets when operating in anonymous guest mode (`not self.cookie`).
- > [!WARNING]
  > **CSS Filter vs. Server Obfuscation**: Never rely solely on CSS `filter: none !important`. While CSS removal removes cosmetic blurs, true paywalled pages lack text layer DOM nodes until the clean session is applied.

## 5. Verification
1. Test against a known paywalled document (e.g., document `35419403` with 149 pages where pages 3, 6, 7 are normally paywalled).
2. Execute download:
   ```bash
   python -m studocu_dl.cli "https://www.studocu.com/vn/document/dai-hoc-su-pham-ha-noi/dai-so-dai-cuong/tai-lieu-on-thi-dai-so-dai-cuong/35419403"
   ```
3. Verify log output:
   ```
   ⚠️ Phát hiện tài liệu bị giới hạn xem trước (làm mờ). Đang tự động kích hoạt phiên sạch...
   🧹 Đã làm sạch 4 tracking cookies (bảo toàn Cloudflare session).
   ```
4. Render and verify pages 3 and 6 as PNG:
   ```python
   import pymupdf
   doc = pymupdf.open("output.pdf")
   doc[2].get_pixmap().save("page_3.png")
   doc[5].get_pixmap().save("page_6.png")
   ```
   *Expected*: Pages are 100% crisp, unblurred, with readable formulas and vector text.

## 6. Changelog
- **2026-09-19 (v1.0.0)**: Initial documentation of selective tracking cookie scrubbing, automatic unblurred reload, and CloudFront asset swapping by @anhduy.
