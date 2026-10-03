# -*- coding: utf-8 -*-
"""
studocu_dl.dom_scripts
======================
Tập hợp toàn bộ các kịch bản JavaScript được tiêm vào DOM của Studocu
để gỡ bỏ paywall, thu thập từng trang vào A4 và trích xuất Markdown.
"""

JS_INIT_CAPTURE = """
(() => {
    window.__STD_CAPTURES__ = new Map();

    // 1. Chấp nhận cookie OneTrust & xóa các banner overlay
    document.getElementById('onetrust-accept-btn-handler')?.click();
    document.querySelectorAll('#onetrust-consent-sdk, #onetrust-banner-sdk, [class*="paywall" i], [class*="Paywall" i], [class*="PremiumBanner" i], #upgrade-overlay').forEach(el => el.remove());

    // 2. Hàm gỡ bỏ bộ lọc làm mờ, xóa paywall overlays và ép hiển thị text layer
    window.__std_deCloak = function() {
        // Gỡ bỏ triệt để các lớp overlay che chắn paywall xuất hiện khi cuộn
        document.querySelectorAll(
            '#onetrust-consent-sdk, #onetrust-banner-sdk, #upgrade-overlay, ' +
            '[class*="paywall" i], [class*="Paywall" i], [class*="PremiumBanner" i], ' +
            '[class*="InlineBanner" i], [class*="inlineBanner" i], ' +
            '[class*="upsell" i], [class*="banner-wrapper" i], [class*="blurred-container" i], ' +
            '[class*="blur-overlay" i], [class*="Shapes-module" i], [class*="PremiumBannerBlobWrapper" i], ' +
            '[data-test-selector*="paywall" i], [id*="paywall" i]'
        ).forEach(el => {
            if (!el.matches('.pf, .pc, div[data-page-index]')) {
                el.remove();
            }
        });

        // BẮT BUỘC: Ép hiển thị mọi page-content, pf, pc để ngăn tuyệt đối tình trạng trắng trang
        document.querySelectorAll('.page-content, [class*="page-content"], .pf, .pc, div[data-page-index]').forEach(el => {
            el.style.setProperty('display', 'block', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('filter', 'none', 'important');
            el.style.setProperty('-webkit-filter', 'none', 'important');
            el.style.setProperty('backdrop-filter', 'none', 'important');
        });

        document.querySelectorAll('[class*="blurred" i], [class*="blur" i]').forEach(el => {
            el.style.setProperty('filter', 'none', 'important');
            el.style.setProperty('-webkit-filter', 'none', 'important');
            el.style.setProperty('backdrop-filter', 'none', 'important');
            el.style.setProperty('opacity', '1', 'important');
        });
        document.querySelectorAll('.t, .textLayer span, [class*="textLayer"] span, [class*="text-layer"] span').forEach(el => {
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('filter', 'none', 'important');
            el.style.setProperty('-webkit-filter', 'none', 'important');
            el.style.setProperty('user-select', 'text', 'important');
        });

        // Tự động thay thế ảnh mờ (blurred) bằng asset bg sạch nếu có URL CloudFront
        try {
            const pd = window.__NEXT_DATA__?.props?.pageProps;
            const baseUrl = pd?.documentAccess?.url;
            const signedParams = pd?.documentAccess?.signedQueryParams;
            const query = signedParams?.global || signedParams?.png || '';
            if (baseUrl && query) {
                document.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src') || img.src || '';
                    if (src.includes('blurred') || src.includes('blur') || !src) {
                        const pageEl = img.closest('div[data-page-index], [data-page-number], .pf');
                        const idx = parseInt(pageEl?.getAttribute('data-page-index') || '-1', 10);
                        if (idx >= 0) {
                            img.src = `${baseUrl}bg${idx + 1}.png${query}`;
                            img.removeAttribute('srcset');
                            img.setAttribute('fetchpriority', 'high');
                            img.removeAttribute('loading');
                            img.setAttribute('decoding', 'sync');
                        }
                    }
                });
            }
        } catch (_) {}
    };

    // 3. Nhận diện CSS Scoping class của pdf2htmlEX (ví dụ: .p2hv)
    let scopingClass = 'p2hv';
    try {
        const pcw = document.getElementById('page-container-wrapper');
        if (pcw && pcw.className) {
            const match = pcw.className.split(' ').find(cls => !cls.includes('-') && !cls.includes('__') && cls.length >= 2);
            if (match) scopingClass = match;
        }
    } catch (_) {}
    window.__STD_SCOPING_CLASS__ = scopingClass;

    // 4. Trích xuất CloudFront base url và signed query params nếu có
    try {
        const pd = window.__NEXT_DATA__?.props?.pageProps;
        window.__STD_BASE_URL__ = pd?.documentAccess?.url || '';
        const sp = pd?.documentAccess?.signedQueryParams;
        window.__STD_QUERY__ = sp?.global || sp?.png || '';
    } catch (_) {}

    // 5. Đóng gói thành section chuẩn A4 với tốc độ tối đa (cloneNode + scoped container)
    window.__std_buildA4Sheet = function(pageRoot, index) {
        // Gỡ bỏ triệt để overlay paywall bên trong pageRoot trước khi clone
        pageRoot.querySelectorAll(
            '#onetrust-consent-sdk, #onetrust-banner-sdk, #upgrade-overlay, ' +
            '[class*="paywall" i], [class*="Paywall" i], [class*="banner" i], ' +
            '[class*="Banner" i], [class*="upgrade" i], [class*="upsell" i], ' +
            '[class*="blurred-overlay" i], [class*="blur-overlay" i], ' +
            '[class*="blurred-container" i], [class*="InlineBanner" i], [class*="inlineBanner" i], ' +
            '[class*="PremiumBanner" i], [class*="banner-wrapper" i], [class*="Shapes-module" i], ' +
            '[class*="PremiumBannerBlobWrapper" i], [data-test-selector*="paywall" i], ' +
            '[id*="paywall" i], [id*="banner" i], [id*="overlay" i], iframe'
        ).forEach(el => el.remove());

        const A4_WIDTH_PX = 794;
        const A4_HEIGHT_PX = 1123;
        const width = pageRoot.offsetWidth || 595;
        const height = pageRoot.offsetHeight || 842;

        const clone = pageRoot.cloneNode(true);

        // Quét sạch triệt để mọi phần tử banner hoặc overlay còn sót trong bản clone
        clone.querySelectorAll(
            '#onetrust-consent-sdk, #onetrust-banner-sdk, #upgrade-overlay, ' +
            '[class*="paywall" i], [class*="Paywall" i], [class*="banner" i], ' +
            '[class*="Banner" i], [class*="upgrade" i], [class*="upsell" i], ' +
            '[class*="blurred-overlay" i], [class*="blur-overlay" i], ' +
            '[class*="blurred-container" i], [class*="InlineBanner" i], [class*="inlineBanner" i], ' +
            '[class*="PremiumBanner" i], [class*="banner-wrapper" i], [class*="Shapes-module" i], ' +
            '[class*="PremiumBannerBlobWrapper" i], [data-test-selector*="paywall" i], ' +
            '[id*="paywall" i], [id*="banner" i], [id*="overlay" i], iframe'
        ).forEach(el => el.remove());

        // Sao chép canvas sang cloneCanvas bằng GPU drawImage cực nhanh thay vì base64 DataURL
        const canvases = pageRoot.querySelectorAll('canvas');
        const cloneCanvases = clone.querySelectorAll('canvas');
        for (let i = 0; i < canvases.length && i < cloneCanvases.length; i++) {
            try {
                cloneCanvases[i].width = canvases[i].width;
                cloneCanvases[i].height = canvases[i].height;
                const ctx = cloneCanvases[i].getContext('2d');
                if (ctx) ctx.drawImage(canvases[i], 0, 0);
            } catch (_) {}
        }

        // Đảm bảo tất cả page-content, pf, pc, t trong clone hiển thị 100% không mờ
        [clone, ...clone.querySelectorAll('.page-content, [class*="page-content"], .pc, .pf, [class*="blur"]')].forEach(el => {
            el.style.setProperty('display', 'block', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('filter', 'none', 'important');
            el.style.setProperty('-webkit-filter', 'none', 'important');
            el.style.setProperty('backdrop-filter', 'none', 'important');
        });
        clone.querySelectorAll('.t, .textLayer span, [class*="textLayer"] span, [class*="text-layer"] span').forEach(el => {
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('filter', 'none', 'important');
            el.style.setProperty('-webkit-filter', 'none', 'important');
            el.style.setProperty('user-select', 'text', 'important');
        });
        clone.querySelectorAll('img').forEach(img => {
            if (window.__STD_BASE_URL__ && window.__STD_QUERY__) {
                const src = img.getAttribute('src') || img.src || '';
                if (src.includes('blurred') || src.includes('blur') || !src) {
                    img.src = window.__STD_BASE_URL__ + 'bg' + (index + 1) + '.png' + window.__STD_QUERY__;
                    img.removeAttribute('srcset');
                }
            }
            img.style.setProperty('display', 'block', 'important');
            img.style.setProperty('visibility', 'visible', 'important');
            img.style.setProperty('opacity', '1', 'important');
            img.style.setProperty('filter', 'none', 'important');
            img.setAttribute('fetchpriority', 'high');
            img.removeAttribute('loading');
            img.setAttribute('decoding', 'sync');
        });

        clone.style.setProperty('position', 'absolute', 'important');
        clone.style.setProperty('left', '0', 'important');
        clone.style.setProperty('top', '0', 'important');
        clone.style.setProperty('margin', '0', 'important');
        clone.style.setProperty('transform', 'none', 'important');

        const sheet = document.createElement('section');
        sheet.className = 'std-a4-sheet ' + (window.__STD_SCOPING_CLASS__ || 'p2hv');
        sheet.dataset.pageNumber = String(index + 1);

        const stage = document.createElement('div');
        stage.className = 'std-a4-stage';
        stage.style.width = `${width}px`;
        stage.style.height = `${height}px`;

        const scale = Math.min(A4_WIDTH_PX / width, A4_HEIGHT_PX / height);
        const x = (A4_WIDTH_PX - (width * scale)) / 2;
        const y = (A4_HEIGHT_PX - (height * scale)) / 2;
        stage.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        stage.style.transformOrigin = '0 0';

        const wrapper = document.createElement('div');
        wrapper.className = 'std-scope-wrapper ' + (window.__STD_SCOPING_CLASS__ || 'p2hv');
        wrapper.style.setProperty('opacity', '1', 'important');
        wrapper.style.setProperty('visibility', 'visible', 'important');
        wrapper.style.setProperty('display', 'block', 'important');
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.position = 'relative';
        wrapper.appendChild(clone);

        stage.appendChild(wrapper);
        sheet.appendChild(stage);
        return sheet;
    };

    // 7. Nhận diện tổng số trang từ nhiều nguồn đa dạng
    let detectedTotal = 0;
    try {
        const state = window.__INITIAL_STATE__ || window.__viewerState__;
        detectedTotal = Number(state?.document?.pages || state?.documentViewer?.numberOfPages || state?.viewer?.pages?.length || 0);
    } catch (_) {}

    if (!detectedTotal) {
        try {
            const controls = document.querySelectorAll('[class*="PageControl"], [class*="page-control"], [data-test-selector*="page-count"], [class*="Pagination"]');
            for (const el of controls) {
                const m = (el.textContent || '').match(/(?:of|\\/)\\s*(\\d+)/i);
                if (m) {
                    detectedTotal = parseInt(m[1], 10);
                    if (detectedTotal > 0) break;
                }
            }
        } catch (_) {}
    }

    if (!detectedTotal) {
        let maxIdx = -1;
        document.querySelectorAll('div[data-page-index], [data-page-number]').forEach(el => {
            const idx = parseInt(el.getAttribute('data-page-index') || el.getAttribute('data-page-number'), 10);
            if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
        });
        if (maxIdx >= 0) detectedTotal = maxIdx + 1;
    }

    if (!detectedTotal) {
        detectedTotal = Math.max(
            document.querySelectorAll('div[data-page-index]').length,
            document.querySelectorAll('.pf').length,
            1
        );
    }

    let docTitle = document.querySelector('h1')?.textContent?.trim() ||
                   document.title.replace(/ - Studocu$/i, '').trim() ||
                   'Studocu Document';

    const pd = (typeof window !== 'undefined') ? window.__NEXT_DATA__?.props?.pageProps : null;
    return {
        totalPages: detectedTotal,
        docTitle: docTitle,
        scopingClass: scopingClass,
        documentAccess: pd?.documentAccess || null,
        pageDataList: (pd?.pageDataList && Array.isArray(pd.pageDataList)) ? pd.pageDataList.map((item, idx) => ({
            index: idx,
            pageHtml: item?.pageHtml || null
        })).filter(x => x.pageHtml) : []
    };
})()
"""

def get_chunk_capture_js(start_idx: int, end_idx: int, total_pages: int) -> str:
    """Tạo mã JS thu thập một phân đoạn trang từ start_idx đến end_idx với tốc độ tối đa."""
    return f"""
    (async () => {{
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const scrollContainer = document.getElementById('viewer-wrapper') ||
                               document.getElementById('document-wrapper') ||
                               document.scrollingElement ||
                               document.documentElement;

        const capturedInChunk = [];
        const pdList = window.__NEXT_DATA__?.props?.pageProps?.pageDataList;

        for (let idx = {start_idx}; idx < {end_idx} && idx < {total_pages}; idx++) {{
            // 1. Tận dụng Next.js Pre-rendered Data (0ms DOM scroll cho các trang có sẵn trong SSR cache)
            if (pdList && pdList[idx] && pdList[idx].pageHtml) {{
                try {{
                    const tDiv = document.createElement('div');
                    tDiv.innerHTML = pdList[idx].pageHtml;
                    const pEl = tDiv.firstElementChild || tDiv;
                    if (window.__STD_BASE_URL__ && window.__STD_QUERY__) {{
                        const img = pEl.querySelector('img');
                        if (img && (img.src.includes('blurred') || img.src.includes('blur') || !img.src)) {{
                            img.src = window.__STD_BASE_URL__ + 'bg' + (idx + 1) + '.png' + window.__STD_QUERY__;
                            img.removeAttribute('srcset');
                        }}
                    }}
                    const sheet = window.__std_buildA4Sheet(pEl, idx);
                    window.__STD_CAPTURES__.set(idx, sheet);
                    capturedInChunk.push(idx + 1);
                    continue;
                }} catch (_) {{}}
            }}

            // 2. Định vị trang trong DOM
            let pageEl = document.querySelector(`div[data-page-index="${{idx}}"]`) ||
                         document.querySelector(`[data-page-number="${{idx + 1}}"]`) ||
                         document.querySelectorAll('.pf')[idx];

            if (!pageEl && {total_pages} > 1) {{
                const maxScroll = Math.max(0, (scrollContainer.scrollHeight || document.documentElement.scrollHeight) - scrollContainer.clientHeight);
                const targetScroll = Math.round(maxScroll * (idx / ({total_pages} - 1)));
                if (scrollContainer.scrollTop !== undefined) scrollContainer.scrollTop = targetScroll;
                window.scrollTo(0, targetScroll);
                try {{ scrollContainer.dispatchEvent(new Event('scroll', {{ bubbles: true }})); }} catch (_) {{}}
                try {{ window.dispatchEvent(new Event('scroll')); }} catch (_) {{}}
                await sleep(60);
                pageEl = document.querySelector(`div[data-page-index="${{idx}}"]`) ||
                         document.querySelector(`[data-page-number="${{idx + 1}}"]`) ||
                         document.querySelectorAll('.pf')[idx];
            }}

            if (pageEl) {{
                try {{ pageEl.scrollIntoView({{ block: 'center', inline: 'nearest' }}); }} catch (_) {{}}
            }}

            let pf = pageEl ? (pageEl.querySelector('.pf') || pageEl) : null;

            // Zero-Delay Ready Check: kiểm tra sẵn sàng, nếu chưa có nội dung thì chờ tối đa 2.1s (chống trắng trang virtual-scroll)
            const checkReady = () => {{
                if (!pf) return false;
                const textNodes = pf.querySelectorAll('.t, .textLayer span, [class*="textLayer"] span').length;
                const imgs = Array.from(pf.querySelectorAll('img'));
                const hasImg = imgs.length > 0;
                const canvases = pf.querySelectorAll('canvas').length;
                return textNodes > 0 || hasImg || canvases > 0;
            }};

            let waits = 0;
            while (!checkReady() && waits < 35) {{
                await sleep(60);
                if (pageEl) {{
                    try {{ pageEl.scrollIntoView({{ block: 'center', inline: 'nearest' }}); }} catch (_) {{}}
                    pf = pageEl.querySelector('.pf') || pageEl;
                }} else {{
                    pageEl = document.querySelector(`div[data-page-index="${{idx}}"]`) ||
                             document.querySelector(`[data-page-number="${{idx + 1}}"]`) ||
                             document.querySelectorAll('.pf')[idx];
                    if (pageEl) pf = pageEl.querySelector('.pf') || pageEl;
                }}
                waits++;
            }}

            // [NEW] Cấp 300ms buffer để PDF.js kịp hoàn tất vẽ vector lên Canvas
            await sleep(300);
            
            // [NEW] Kích hoạt load font sơ bộ ngay tại lúc capture (nếu có)
            try {{ await document.fonts.ready; }} catch (_) {{}}

            // 3. Tự động gỡ bỏ banner rác và thay thế ảnh mờ bằng asset bg sạch nếu có CloudFront signed URL
            if (pf) {{
                pf.querySelectorAll('.banner-wrapper, [class*="InlineBanner"], [class*="PremiumBanner"], [class*="banner"], [class*="paywall" i]').forEach(el => el.remove());
                if (window.__STD_BASE_URL__ && window.__STD_QUERY__) {{
                    const img = pf.querySelector('img');
                    if (img) {{
                        const src = img.getAttribute('src') || img.src || '';
                        if (src.includes('blurred') || src.includes('blur') || !src) {{
                            img.src = window.__STD_BASE_URL__ + 'bg' + (idx + 1) + '.png' + window.__STD_QUERY__;
                            img.removeAttribute('srcset');
                            img.setAttribute('fetchpriority', 'high');
                            img.removeAttribute('loading');
                            img.setAttribute('decoding', 'sync');
                        }}
                    }}
                }}
                const sheet = window.__std_buildA4Sheet(pf, idx);
                window.__STD_CAPTURES__.set(idx, sheet);
                capturedInChunk.push(idx + 1);
            }}
        }}
        return {{
            capturedCount: capturedInChunk.length,
            totalCaptured: window.__STD_CAPTURES__.size
        }};
    }})()
    """

def get_clear_block_captures_js(c_start: int, c_end: int) -> str:
    """Xóa phân đoạn trang đã xuất PDF khỏi bộ nhớ DOM để duy trì RAM máy chủ ở mức sàn."""
    return f"""
    (() => {{
        for (let i = {c_start}; i < {c_end}; i++) {{
            window.__STD_CAPTURES__?.delete(i);
        }}
        document.getElementById('clean-viewer-container')?.remove();
        document.getElementById('std-clean-print-css')?.remove();
        return true;
    }})()
    """

def get_chunk_mount_js(c_start: int, c_end: int) -> str:
    """Tạo mã JS mount một phân đoạn các sheet vào container sạch chuẩn bị cho Page.printToPDF."""
    return f"""
    (() => {{
        document.getElementById('clean-viewer-container')?.remove();
        const container = document.createElement('div');
        container.id = 'clean-viewer-container';
        container.className = window.__STD_SCOPING_CLASS__ || 'p2hv';

        for (let i = {c_start}; i < {c_end}; i++) {{
            const sheet = window.__STD_CAPTURES__.get(i);
            if (sheet) container.appendChild(sheet);
        }}
        document.body.appendChild(container);

        document.getElementById('std-clean-print-css')?.remove();
        const style = document.createElement('style');
        style.id = 'std-clean-print-css';
        style.textContent = `
            @page {{
                size: A4 portrait;
                margin: 0 !important;
            }}
            @media screen {{
                #clean-viewer-container {{
                    display: block !important;
                    position: fixed !important;
                    left: -99999px !important;
                    top: 0 !important;
                    width: 210mm !important;
                    opacity: 0.01 !important;
                    pointer-events: none !important;
                    z-index: -9999 !important;
                }}
            }}
            @media print {{
                html, body {{
                    width: 210mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }}
                body > *:not(#clean-viewer-container) {{
                    display: none !important;
                }}
                #clean-viewer-container {{
                    display: block !important;
                    position: static !important;
                    width: 210mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                }}
                .std-a4-sheet {{
                    display: block !important;
                    width: 210mm !important;
                    height: 297mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    position: relative !important;
                    overflow: hidden !important;
                    background: #ffffff !important;
                }}
                .std-a4-sheet:last-child {{
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }}
            }}
        `;
        document.head.appendChild(style);
        return container.children.length;
    }})()
    """

JS_MOUNT_AND_PRINT_CSS = """
(() => {
    document.getElementById('clean-viewer-container')?.remove();
    const container = document.createElement('div');
    container.id = 'clean-viewer-container';
    container.className = window.__STD_SCOPING_CLASS__ || 'p2hv';

    const sortedEntries = Array.from(window.__STD_CAPTURES__.entries()).sort((a, b) => a[0] - b[0]);
    sortedEntries.forEach(([, sheet]) => container.appendChild(sheet));
    document.body.appendChild(container);

    document.getElementById('std-clean-print-css')?.remove();
    const style = document.createElement('style');
    style.id = 'std-clean-print-css';
    style.textContent = `
        @page {
            size: A4 portrait;
            margin: 0 !important;
        }
        @media screen {
            #clean-viewer-container {
                display: block !important;
                position: fixed !important;
                left: -99999px !important;
                top: 0 !important;
                width: 210mm !important;
                opacity: 0.01 !important;
                pointer-events: none !important;
                z-index: -9999 !important;
            }
        }
        @media print {
            html, body {
                width: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body > *:not(#clean-viewer-container) {
                display: none !important;
            }
            #clean-viewer-container {
                display: block !important;
                position: static !important;
                width: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
            }
            .std-a4-sheet {
                display: block !important;
                width: 210mm !important;
                height: 297mm !important;
                page-break-after: always !important;
                break-after: page !important;
                position: relative !important;
                overflow: hidden !important;
                background: #ffffff !important;
            }
            .std-a4-sheet:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
        }
    `;
    document.head.appendChild(style);
    return sortedEntries.length;
})()
"""

JS_EXTRACT_MARKDOWN = """
(() => {
    const container = document.getElementById('clean-viewer-container');
    const sheets = (container && container.children.length > 0)
        ? Array.from(container.children)
        : Array.from(window.__STD_CAPTURES__.values());
    const results = [];
    sheets.forEach((sheet, idx) => {
        const textNodes = Array.from(sheet.querySelectorAll('.t, span, p, h1, h2, h3, h4, h5, h6'));
        let pageText = '';
        if (textNodes.length > 0) {
            pageText = textNodes.map(t => t.textContent.trim()).filter(Boolean).join(' ');
        } else {
            pageText = sheet.textContent.trim();
        }
        const pageNum = parseInt(sheet.dataset.pageNumber, 10) || (idx + 1);
        results.push({
            page: pageNum,
            text: pageText
        });
    });
    return results;
})()
"""

def get_chunk_extract_markdown_js(c_start: int, c_end: int) -> str:
    """Trích xuất markdown sạch của một phân đoạn trước khi giải phóng bộ nhớ."""
    return f"""
    (() => {{
        const results = [];
        for (let i = {c_start}; i < {c_end}; i++) {{
            const sheet = window.__STD_CAPTURES__?.get(i);
            if (!sheet) continue;
            const textNodes = Array.from(sheet.querySelectorAll('.t, span, p, h1, h2, h3, h4, h5, h6'));
            let pageText = '';
            if (textNodes.length > 0) {{
                pageText = textNodes.map(t => t.textContent.trim()).filter(Boolean).join(' ');
            }} else {{
                pageText = sheet.textContent.trim();
            }}
            pageText = pageText.replace(/\\s+/g, ' ').trim();
            results.push({{
                page: i + 1,
                text: pageText
            }});
        }}
        return results;
    }})()
    """

def get_hybrid_mount_js(
    pages_html_map: dict,
    non_png_pages: list,
    base_url: str,
    png_query: str,
    blurred_query: str,
    scoping_class: str = "p2hv",
) -> str:
    """Tạo mã JS mount phân đoạn trang Vector và ảnh non-PNG vào container sạch phục vụ batch Page.printToPDF."""
    import json
    return f"""
    ((pagesHtmlMap, nonPngList) => {{
        document.getElementById('clean-viewer-container')?.remove();
        const container = document.createElement('div');
        container.id = 'clean-viewer-container';
        container.className = {json.dumps(scoping_class)} || 'p2hv';
        
        const A4_WIDTH_PX = 794;
        const A4_HEIGHT_PX = 1123;
        
        // 1. Gắn các trang Vector có HTML text layer
        for (const [pStr, pHtml] of Object.entries(pagesHtmlMap)) {{
            const p = parseInt(pStr, 10);
            const sheet = document.createElement('section');
            sheet.className = 'std-a4-sheet ' + ({json.dumps(scoping_class)} || 'p2hv');
            sheet.dataset.pageNumber = String(p);
            
            const tDiv = document.createElement('div');
            tDiv.innerHTML = pHtml;
            const pEl = tDiv.firstElementChild || tDiv;
            const img = pEl.querySelector('img');
            if (img) {{
                img.src = {json.dumps(base_url)} + 'bg' + p + '.png' + {json.dumps(png_query)};
                img.removeAttribute('srcset');
            }}
            
            // Đảm bảo toàn bộ chữ vector hiển thị sắc nét và chọn được
            pEl.querySelectorAll('.t, .textLayer span, [class*="textLayer"] span, [class*="text-layer"] span').forEach(el => {{
                el.style.setProperty('opacity', '1', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.style.setProperty('filter', 'none', 'important');
                el.style.setProperty('-webkit-filter', 'none', 'important');
                el.style.setProperty('user-select', 'text', 'important');
            }});

            const stage = document.createElement('div');
            stage.className = 'std-a4-stage';
            const width = 595;
            const height = 842;
            stage.style.width = width + 'px';
            stage.style.height = height + 'px';
            const scale = Math.min(A4_WIDTH_PX / width, A4_HEIGHT_PX / height);
            const x = (A4_WIDTH_PX - (width * scale)) / 2;
            const y = (A4_HEIGHT_PX - (height * scale)) / 2;
            stage.style.transform = `translate3d(${{x}}px, ${{y}}px, 0) scale(${{scale}})`;
            stage.style.transformOrigin = '0 0';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'std-scope-wrapper ' + ({json.dumps(scoping_class)} || 'p2hv');
            wrapper.style.cssText = 'opacity:1!important;visibility:visible!important;display:block!important;position:relative;width:'+width+'px;height:'+height+'px;';
            pEl.style.cssText = 'position:absolute!important;left:0!important;top:0!important;margin:0!important;transform:none!important;display:block!important;visibility:visible!important;opacity:1!important;';
            
            wrapper.appendChild(pEl);
            stage.appendChild(wrapper);
            sheet.appendChild(stage);
            container.appendChild(sheet);
        }}
        
        // 2. Gắn các trang WebP hoặc non-PNG
        for (const p of nonPngList) {{
            const sheet = document.createElement('section');
            sheet.className = 'std-a4-sheet ' + ({json.dumps(scoping_class)} || 'p2hv');
            sheet.dataset.pageNumber = String(p);
            const img = document.createElement('img');
            img.src = {json.dumps(base_url)} + 'pages/blurred/page' + p + '.webp' + {json.dumps(blurred_query)};
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
            sheet.appendChild(img);
            container.appendChild(sheet);
        }}
        
        document.body.appendChild(container);
        
        document.getElementById('std-clean-print-css')?.remove();
        const style = document.createElement('style');
        style.id = 'std-clean-print-css';
        style.textContent = `
            @page {{ size: A4 portrait; margin: 0 !important; }}
            #clean-viewer-container {{
                position: fixed !important;
                left: -9999px !important;
                top: 0 !important;
                width: 210mm !important;
                background: #fff !important;
                z-index: -9999 !important;
            }}
            @media print {{
                body > *:not(#clean-viewer-container) {{ display: none !important; }}
                #clean-viewer-container {{ display: block !important; position: static !important; width: 210mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }}
                .std-a4-sheet {{ display: block !important; width: 210mm !important; height: 297mm !important; page-break-after: always !important; break-after: page !important; position: relative !important; overflow: hidden !important; background: #fff !important; }}
                .std-a4-sheet:last-child {{ page-break-after: avoid !important; break-after: avoid !important; }}
            }}
        `;
        document.head.appendChild(style);
        return container.children.length;
    }})({json.dumps(pages_html_map)}, {json.dumps(non_png_pages)})
    """

JS_WAIT_IMAGES_LOADED = """
(async () => {
    const imgs = Array.from(document.querySelectorAll('#clean-viewer-container img'));
    await Promise.all(imgs.map(async img => {
        if (img.complete && img.naturalWidth > 0) {
            try { await img.decode(); } catch (_) {}
            return;
        }
        await new Promise(r => {
            img.onload = async () => {
                try { await img.decode(); } catch (_) {}
                r();
            };
            img.onerror = r;
            setTimeout(r, 3500);
        });
    }));
    return imgs.length;
})()
"""
