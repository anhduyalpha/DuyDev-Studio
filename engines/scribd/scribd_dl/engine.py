# -*- coding: utf-8 -*-
"""
scribd_dl.engine
================
High-performance Scribd Document Archiver engine powered by Playwright & PyMuPDF.
Renders standard embed view (https://www.scribd.com/embeds/{doc_id}/content),
sequentially hydrates all lazy-loaded pages, unconstrains scroll viewports,
normalizes @media print CSS, prints to vector PDF and verifies with PyMuPDF.
"""

from __future__ import annotations

import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, Optional, Dict, Any

from playwright.sync_api import sync_playwright, Browser, Page
import pymupdf

from .config import DOWNLOADS_DIR


def extract_scribd_doc_id(url: str) -> Optional[str]:
    """
    Rút trích mã số tài liệu Scribd (doc_id) từ URL hoặc chuỗi văn bản.
    Hỗ trợ các định dạng:
    - https://www.scribd.com/document/693471767/...
    - https://www.scribd.com/doc/693471767/...
    - https://www.scribd.com/presentation/693471767/...
    - https://www.scribd.com/embeds/693471767/content
    - https://www.scribd.com/d/693471767
    - 693471767 (mã số thuần)
    """
    if not url or not isinstance(url, str):
        return None
    raw = url.strip()

    # Từ chối trang tìm kiếm hoặc URL không phải tài liệu
    if "scribd.com/search" in raw.lower():
        return None

    # 1. URL pattern match cho tài liệu chuẩn
    match = re.search(r'/(?:document|doc|presentation|embeds|d)/(\d{6,15})', raw, re.IGNORECASE)
    if match:
        return match.group(1)

    # 2. Mã số thuần (toàn bộ chuỗi chỉ gồm 6-15 chữ số)
    if re.fullmatch(r'\d{6,15}', raw):
        return raw

    return None


def sanitize_filename(name: str, max_length: int = 100) -> str:
    """Tạo tên tệp tin an toàn từ tiêu đề tài liệu."""
    if not name:
        return "scribd_document"
    clean = re.sub(r'[\\/*?:"<>|#@$%^&*]', '_', name)
    clean = re.sub(r'\s+', '_', clean).strip('._ ')
    return clean[:max_length] if clean else "scribd_document"


class ScribdArchiver:
    """Bộ tải tài liệu Scribd sang PDF qua Playwright Embed Reader và PyMuPDF."""

    def __init__(
        self,
        url_or_id: str,
        output_dir: Optional[Path] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None,
        log_callback: Optional[Callable[[str], None]] = None,
        timeout_seconds: int = 360,
    ):
        self.doc_id = extract_scribd_doc_id(url_or_id)
        if not self.doc_id:
            raise ValueError(f"Không nhận diện được mã tài liệu Scribd từ: {url_or_id}")

        self.embed_url = f"https://www.scribd.com/embeds/{self.doc_id}/content"
        self.output_dir = Path(output_dir or DOWNLOADS_DIR)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.progress_callback = progress_callback
        self.log_callback = log_callback
        self.timeout_seconds = timeout_seconds
        self.is_cancelled = False
        self._browser: Optional[Browser] = None

    def _log(self, message: str) -> None:
        if self.log_callback:
            try:
                self.log_callback(message)
            except Exception:
                pass

    def _progress(self, percent: int, stage: str) -> None:
        if self.progress_callback:
            try:
                self.progress_callback(percent, stage)
            except Exception:
                pass

    def cancel(self) -> None:
        """Hủy tiến trình tải ngay lập tức."""
        self.is_cancelled = True
        self._log("🛑 Nhận lệnh hủy: Đang dừng trình duyệt...")
        if self._browser:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None

    def find_cached_file(self) -> Optional[Path]:
        """Tìm file đã tải trước đó trong thư mục downloads theo doc_id."""
        for p in self.output_dir.glob("*.pdf"):
            if not p.is_file() or p.stat().st_size <= 50000:
                continue
            stem = p.stem
            if stem.endswith(f"_{self.doc_id}") or stem.startswith(f"{self.doc_id}_") or f"_{self.doc_id}_" in stem or stem == str(self.doc_id):
                return p
        return None

    def archive(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        Thực hiện toàn bộ quy trình tải tài liệu Scribd với Dual-Engine Router:
        1. Kiểm tra cache nếu không force_reload.
        2. Mở Playwright Chromium tại Embed Reader View với Bộ lọc Ad/Tracker Shield.
        3. Phân tích cấu trúc tài liệu và kích hoạt Parallel Hydration qua window.docManager.
        4. Dual-Engine Pipeline Router:
           - PIPELINE 1 (Tài liệu thuần ảnh / scanned slides): Tải song song stream ảnh JPEG từ CDN
             rồi đóng gói qua PyMuPDF (siêu tốc, chỉ mất vài giây cho hàng trăm trang).
           - PIPELINE 2 (Tài liệu văn bản vector): Chuẩn hóa @media print, xuất qua Chromium page.pdf
             để giữ nguyên 100% vector text layer có thể bôi đen và tìm kiếm được.
        5. PyMuPDF hậu xử lý, kiểm tra số trang, ghi metadata và lưu tệp.
        """
        # 1. Kiểm tra cache
        if not force_reload:
            cached = self.find_cached_file()
            if cached:
                self._log(f"⚡ Đã tìm thấy tài liệu trong kho lưu trữ: {cached.name}")
                self._progress(100, "Đã có sẵn trên máy chủ")
                try:
                    with pymupdf.open(cached) as doc:
                        page_count = doc.page_count
                except Exception:
                    page_count = 1
                size_bytes = cached.stat().st_size
                return {
                    "id": self.doc_id,
                    "name": cached.name,
                    "title": cached.stem.replace(f"_{self.doc_id}", "").replace("_", " "),
                    "pages": page_count,
                    "size_bytes": size_bytes,
                    "size_mb": round(size_bytes / (1024 * 1024), 2),
                    "from_cache": True,
                    "path": str(cached),
                }

        self._progress(5, "Đang khởi tạo trình duyệt...")
        self._log(f"🚀 Mở tài liệu Scribd Embed ID {self.doc_id}: {self.embed_url}")

        TRACKER_DOMAINS = [
            "google-analytics.com",
            "googletagmanager.com",
            "googlesyndication.com",
            "doubleclick.net",
            "googleads.g.doubleclick.net",
            "adservice.google",
            "facebook.net",
            "facebook.com",
            "branch.io",
            "segment.io",
            "segment.com",
            "datadoghq.com",
            "sentry.io",
            "scorecardresearch.com",
            "quantserve.com",
            "adroll.com",
            "criteo.com",
            "hotjar.com",
            "moatads.com",
            "rubiconproject.com",
            "pubmatic.com",
            "amazon-adsystem.com",
            "advertising.com",
            "onetrust.com",
            "optimizely.com",
            "cookielaw.org",
            "chartbeat.com",
            "newrelic.com",
            "nr-data.net",
            "clarity.ms",
            "mouseflow.com",
            "crazyegg.com",
        ]

        with sync_playwright() as p:
            launch_args = [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ]
            launch_kwargs = {
                "headless": True,
                "args": launch_args,
            }
            if sys.platform != "win32":
                for chrome_path in ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]:
                    if os.path.exists(chrome_path):
                        launch_kwargs["executable_path"] = chrome_path
                        break

            self._browser = p.chromium.launch(**launch_kwargs)
            context = self._browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            )
            page = context.new_page()

            # Ad & Tracker Interception Shield: Loại bỏ 30+ tracker/ads làm chậm kết nối
            def handle_route(route):
                req = route.request
                url_lower = req.url.lower()

                # Critical whitelist: NEVER block scribd core assets, fonts, absimg, or jsonp fragments
                if req.resource_type == "font" or any(k in url_lower for k in [
                    "scribd.com",
                    "scribdassets.com",
                    ".absimg",
                    "jsonp",
                    ".woff",
                    ".woff2",
                    ".ttf",
                    ".otf",
                ]):
                    route.continue_()
                    return

                if req.resource_type in ["media", "beacon"] or any(domain in url_lower for domain in TRACKER_DOMAINS):
                    route.abort()
                else:
                    route.continue_()

            page.route("**/*", handle_route)

            try:
                # 2. Mở giao diện đọc nhúng
                self._progress(10, f"Đang kết nối tài liệu Scribd {self.doc_id}...")
                page.goto(self.embed_url, wait_until="domcontentloaded", timeout=45000)
                self._progress(18, "Đang phân tích cấu trúc trang tài liệu...")
                page.wait_for_timeout(800)

                if self.is_cancelled:
                    raise RuntimeError("Tiến trình bị hủy bởi người dùng")

                # Kiểm tra trạng thái lỗi (Not Found, Private, Removed)
                error_state = page.evaluate("""() => {
                    const text = document.body ? document.body.innerText : '';
                    if (text.includes('Document Not Found') || 
                        text.includes("Sorry, we can't display this document") ||
                        text.includes("Sorry, we cannot display this document") ||
                        text.includes("This document is private") ||
                        text.includes("This document has been removed")) {
                        return 'Document Not Found';
                    }
                    return null;
                }""")
                if error_state:
                    raise RuntimeError(f"Tài liệu không khả dụng trên Scribd: {error_state}")

                # Tiêu đề tài liệu
                doc_title = page.evaluate("""() => {
                    let title = '';
                    const titleEl = document.querySelector('.document_title, a.title, .doc_title, .title, .header_title');
                    if (titleEl && titleEl.innerText) title = titleEl.innerText.trim();
                    if (!title) {
                        for (let s of document.querySelectorAll('script')) {
                            const text = s.innerText || '';
                            const match = text.match(/"title":\\s*"([^"]+)"/) || text.match(/'title':\\s*'([^']+)'/);
                            if (match) { title = match[1]; break; }
                        }
                    }
                    return title || document.title || 'Scribd_Document';
                }""")
                clean_title = sanitize_filename(doc_title)
                self._log(f"📄 Tiêu đề tài liệu: {doc_title}")

                # 3. Kích hoạt Parallel Hydration qua window.docManager
                self._progress(25, "Đang kích hoạt nạp trang song song...")
                page.evaluate("""() => {
                    if (window.docManager && window.docManager.pages) {
                        const pagesObj = window.docManager.pages;
                        const pageList = Array.isArray(pagesObj) ? pagesObj : Object.values(pagesObj);
                        pageList.forEach(p => {
                            try {
                                if (p && !p.loadHasStarted && typeof p.load === 'function') {
                                    p.load();
                                }
                            } catch (e) {}
                        });
                    }
                    document.querySelectorAll('img[orig], .absimg').forEach(img => {
                        const orig = img.getAttribute('orig');
                        if (orig && (!img.src || img.src !== orig)) {
                            img.src = orig;
                        }
                    });
                }""")

                # Chờ ngắn để các trang khởi tạo DOM & Image URLs
                page.wait_for_timeout(1500)

                # Phân tích loại tài liệu (Vector Text vs Pure Image) và trích xuất danh sách trang
                doc_analysis = page.evaluate("""() => {
                    let totalTextChars = 0;
                    document.querySelectorAll('.text_layer').forEach(tl => {
                        totalTextChars += (tl.innerText || tl.textContent || '').trim().length;
                    });

                    const outerPages = document.querySelectorAll('.outer_page_container .outer_page, [id^="outer_page_"]');
                    const totalOuter = outerPages.length || 1;
                    const avgCharsPerPage = totalTextChars / totalOuter;

                    // Tài liệu vector chuẩn khi có văn bản thực chất (> 20 ký tự/trang và > 100 ký tự tổng).
                    // Các tài liệu thuần scan/ảnh thường có 0 ký tự hoặc chỉ có con dấu watermark ngắn (< 15 ký tự/trang).
                    const hasVectorText = totalTextChars > 100 && avgCharsPerPage > 20;

                    const pages = [];
                    let missingImgs = 0;

                    for (let i = 0; i < outerPages.length; i++) {
                        const pEl = outerPages[i];
                        const img = pEl.querySelector('img.absimg, img[orig], img');
                        const imgUrl = img ? (img.getAttribute('orig') || img.src || '') : '';
                        if (!imgUrl || !imgUrl.startsWith('http')) {
                            missingImgs++;
                        }
                        pages.push({
                            pageNum: i + 1,
                            imgUrl: imgUrl,
                            width: (pEl.offsetWidth && pEl.offsetWidth > 100) ? pEl.offsetWidth : 1000,
                            height: (pEl.offsetHeight && pEl.offsetHeight > 100) ? pEl.offsetHeight : 1416
                        });
                    }

                    return {
                        hasVectorText: hasVectorText,
                        totalTextChars: totalTextChars,
                        avgCharsPerPage: avgCharsPerPage,
                        totalPages: outerPages.length,
                        missingImgs: missingImgs,
                        pages: pages
                    };
                }""")

                total_pages = doc_analysis.get("totalPages", 0)
                if not total_pages or total_pages <= 0:
                    raise RuntimeError("Không tìm thấy trang tài liệu hợp lệ trong giao diện đọc nhúng")

                has_vector_text = doc_analysis.get("hasVectorText", False)
                missing_imgs = doc_analysis.get("missingImgs", 0)
                page_items = doc_analysis.get("pages", [])

                # Nếu còn thiếu một vài ảnh, cho thêm 1.5s chờ
                if missing_imgs > 0 and missing_imgs < total_pages:
                    page.wait_for_timeout(1500)
                    doc_analysis = page.evaluate("""() => {
                        const outerPages = document.querySelectorAll('.outer_page_container .outer_page, [id^="outer_page_"]');
                        const pages = [];
                        let missingImgs = 0;
                        for (let i = 0; i < outerPages.length; i++) {
                            const pEl = outerPages[i];
                            const img = pEl.querySelector('img.absimg, img[orig], img');
                            const imgUrl = img ? (img.getAttribute('orig') || img.src || '') : '';
                            if (!imgUrl || !imgUrl.startsWith('http')) missingImgs++;
                            pages.push({
                                pageNum: i + 1,
                                imgUrl: imgUrl,
                                width: (pEl.offsetWidth && pEl.offsetWidth > 100) ? pEl.offsetWidth : 1000,
                                height: (pEl.offsetHeight && pEl.offsetHeight > 100) ? pEl.offsetHeight : 1416
                            });
                        }
                        return { totalPages: outerPages.length, missingImgs: missingImgs, pages: pages };
                    }""")
                    missing_imgs = doc_analysis.get("missingImgs", 0)
                    page_items = doc_analysis.get("pages", [])

                self._log(f"📚 Phát hiện tổng số {total_pages} trang | Loại tài liệu: {'Văn bản Vector' if has_vector_text else 'Hình ảnh scan/Slide'}")

                target_filename = f"{clean_title}_{self.doc_id}.pdf"
                final_pdf_path = self.output_dir / target_filename

                # 4. DUAL-ENGINE PIPELINE ROUTER
                if not has_vector_text and missing_imgs == 0 and len(page_items) == total_pages:
                    # ==========================================================
                    # PIPELINE 1: FAST DIRECT IMAGE STREAM + PYMUPDF ASSEMBLY
                    # ==========================================================
                    self._log("⚡ Kích hoạt Pipeline 1: Tải song song CDN JPEGs & Ghép PyMuPDF siêu tốc...")
                    # Đóng browser ngay để giải phóng RAM/CPU
                    try:
                        self._browser.close()
                    except Exception:
                        pass
                    self._browser = None

                    downloaded_images: Dict[int, bytes] = {}
                    dl_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

                    def fetch_page_img(p_info: Dict[str, Any]) -> tuple[int, bytes]:
                        p_num = p_info["pageNum"]
                        url = p_info["imgUrl"]
                        req = urllib.request.Request(url, headers=dl_headers)
                        for attempt in range(3):
                            if self.is_cancelled:
                                raise RuntimeError("Tiến trình bị hủy bởi người dùng")
                            try:
                                with urllib.request.urlopen(req, timeout=15) as resp:
                                    return p_num, resp.read()
                            except Exception as err:
                                if attempt == 2:
                                    raise RuntimeError(f"Lỗi tải ảnh trang {p_num}: {err}")
                                time.sleep(0.3 * (attempt + 1))
                        raise RuntimeError(f"Không thể tải ảnh trang {p_num}")

                    max_workers = min(16, total_pages)
                    self._progress(35, f"Đang tải song song {total_pages} trang từ CDN...")

                    with ThreadPoolExecutor(max_workers=max_workers) as pool:
                        future_map = {pool.submit(fetch_page_img, p_info): p_info["pageNum"] for p_info in page_items}
                        completed_count = 0
                        for future in as_completed(future_map):
                            if self.is_cancelled:
                                raise RuntimeError("Tiến trình bị hủy bởi người dùng")
                            p_num, img_bytes = future.result()
                            downloaded_images[p_num] = img_bytes
                            completed_count += 1
                            pct = 35 + int((completed_count / total_pages) * 50)  # 35% -> 85%
                            self._progress(pct, f"Đang nạp ảnh {completed_count}/{total_pages}...")

                    # Ghép PDF nguyên bản không tái nén bằng PyMuPDF
                    self._progress(90, "Đang đóng gói file PDF qua PyMuPDF...")
                    self._log("📄 Đang tổng hợp các trang vào file PDF hoàn chỉnh...")
                    doc = pymupdf.open()
                    for idx in range(1, total_pages + 1):
                        img_bytes = downloaded_images[idx]
                        pix = pymupdf.Pixmap(img_bytes)
                        pw, ph = pix.width, pix.height
                        pix = None
                        pdf_page = doc.new_page(width=pw, height=ph)
                        pdf_page.insert_image(pymupdf.Rect(0, 0, pw, ph), stream=img_bytes)

                    final_pages = doc.page_count
                    meta = doc.metadata or {}
                    meta["title"] = doc_title
                    meta["author"] = "Scribd Archiver"
                    meta["creator"] = "DuyDev Studio - Scribd Fast Image Pipeline"
                    doc.set_metadata(meta)
                    doc.save(str(final_pdf_path), garbage=1, deflate=False)
                    doc.close()

                else:
                    # ==========================================================
                    # PIPELINE 2: VECTOR TEXT PRESERVATION (CHROMIUM PRINT)
                    # ==========================================================
                    self._log("📝 Kích hoạt Pipeline 2: Giữ nguyên 100% lớp văn bản Vector qua Chromium CDP...")
                    self._progress(40, "Đang đồng bộ hóa phông chữ và lớp văn bản...")

                    # Đồng bộ hóa bảo đảm toàn bộ ảnh
                    page.evaluate("""() => {
                        document.querySelectorAll('img[orig], .absimg').forEach(img => {
                            const orig = img.getAttribute('orig');
                            if (orig && (!img.src || img.src !== orig)) {
                                img.src = orig;
                            }
                        });
                    }""")
                    page.wait_for_timeout(1000)

                    # Kích thước trang
                    p1_info = page_items[0] if page_items else {"width": 1000, "height": 1416}
                    width_px = p1_info.get("width", 1000)
                    height_px = p1_info.get("height", 1416)

                    # Chuẩn hóa CSS in ấn @media print & loại bỏ DOM thừa
                    self._progress(65, "Chuẩn hóa bảng kiểu in ấn (@media print)...")
                    page.evaluate(f"""() => {{
                        const style = document.createElement('style');
                        style.id = 'scribd-print-normalization-style';
                        style.textContent = `
                            @page {{
                                size: {width_px}px {height_px}px;
                                margin: 0;
                            }}
                            @media print {{
                                html, body, .auto__embeds_new_show, .document_scroller, .document_container, .outer_page_container {{
                                    height: auto !important;
                                    min-height: 100% !important;
                                    max-height: none !important;
                                    overflow: visible !important;
                                    position: static !important;
                                    transform: none !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                    background: #ffffff !important;
                                }}
                                .toolbar_drop,
                                .mobile_overlay,
                                .between_page_ads,
                                .promo,
                                [class*="promo"],
                                .navigation_container,
                                .doc_header,
                                .document_toolbar,
                                .sticky_menu {{
                                    display: none !important;
                                    visibility: hidden !important;
                                    height: 0 !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                }}
                                .outer_page {{
                                    page-break-after: always !important;
                                    break-after: page !important;
                                    page-break-inside: avoid !important;
                                    break-inside: avoid !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                    border: none !important;
                                    box-shadow: none !important;
                                    filter: none !important;
                                    opacity: 1 !important;
                                    position: relative !important;
                                    display: block !important;
                                    overflow: hidden !important;
                                    width: {width_px}px !important;
                                    height: {height_px}px !important;
                                }}
                                .outer_page:last-of-type {{
                                    page-break-after: auto !important;
                                    break-after: auto !important;
                                }}
                                .text_layer, .absimg, .page_missing, .newpage {{
                                    filter: none !important;
                                    opacity: 1 !important;
                                }}
                            }}
                        `;
                        document.head.appendChild(style);
                    }}""")

                    self._progress(85, "Đang đóng gói file PDF qua Chromium Engine...")
                    self._log("🖨️ Đang tạo file PDF vector...")

                    pdf_raw_bytes = page.pdf(
                        prefer_css_page_size=True,
                        print_background=True,
                        display_header_footer=False,
                        margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"},
                    )

                    self._progress(92, "Đang tối ưu hóa và kiểm chứng bằng PyMuPDF...")
                    doc = pymupdf.open(stream=pdf_raw_bytes, filetype="pdf")
                    final_pages = doc.page_count

                    # Kiểm tra tài liệu lỗi
                    if final_pages == 1:
                        first_text = doc[0].get_text() or ""
                        if "Document Not Found" in first_text or "can't display this document" in first_text or "cannot display this document" in first_text:
                            doc.close()
                            raise RuntimeError("Tài liệu không khả dụng trên Scribd (Document Not Found)")

                    # Loại bỏ trang trắng cuối nếu bị thừa do page-break
                    if final_pages > total_pages:
                        last_page = doc[final_pages - 1]
                        if len(last_page.get_text().strip()) == 0:
                            self._log(f"✂️ Loại bỏ trang trắng thứ {final_pages} thừa ở cuối")
                            doc.delete_page(final_pages - 1)
                            final_pages = doc.page_count

                    meta = doc.metadata or {}
                    meta["title"] = doc_title
                    meta["author"] = "Scribd Archiver"
                    meta["creator"] = "DuyDev Studio - Scribd Vector Pipeline"
                    doc.set_metadata(meta)
                    doc.save(str(final_pdf_path), garbage=4, deflate=True)
                    doc.close()

                final_size = final_pdf_path.stat().st_size
                final_size_mb = round(final_size / (1024 * 1024), 2)
                self._progress(100, f"Hoàn tất! ({final_pages} trang, {final_size_mb} MB)")
                self._log(f"✅ Đã tải xong file PDF: {target_filename} ({final_pages} trang, {final_size_mb} MB)")

                return {
                    "id": self.doc_id,
                    "name": target_filename,
                    "title": doc_title,
                    "pages": final_pages,
                    "size_bytes": final_size,
                    "size_mb": final_size_mb,
                    "from_cache": False,
                    "path": str(final_pdf_path),
                }

            finally:
                if self._browser:
                    try:
                        self._browser.close()
                    except Exception:
                        pass
                    self._browser = None
