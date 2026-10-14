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
import time
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
    - 693471767 (mã số thuần)
    """
    if not url or not isinstance(url, str):
        return None
    raw = url.strip()

    # 1. URL pattern match
    match = re.search(r'/(?:document|doc|presentation|embeds)/(\d{6,15})', raw, re.IGNORECASE)
    if match:
        return match.group(1)

    # 2. Query param or direct numeric ID match (handling underscores and boundaries)
    num_match = re.search(r'(?:^|\D)(\d{6,15})(?:\D|$)', raw)
    if num_match:
        return num_match.group(1)

    return None


def sanitize_filename(name: str, max_length: int = 100) -> str:
    """Tạo tên tệp tin an toàn từ tiêu đề tài liệu."""
    if not name:
        return "scribd_document"
    clean = re.sub(r'[\\/*?:"<>|#@$%^&*]', '_', name)
    clean = re.sub(r'\s+', '_', clean).strip('._ ')
    return clean[:max_length] if clean else "scribd_document"


class ScribdArchiver:
    """Bộ kết xuất tài liệu Scribd sang PDF qua Playwright Embed Reader và PyMuPDF."""

    def __init__(
        self,
        url_or_id: str,
        output_dir: Optional[Path] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None,
        log_callback: Optional[Callable[[str], None]] = None,
        timeout_seconds: int = 180,
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
        """Hủy tiến trình kết xuất ngay lập tức."""
        self.is_cancelled = True
        self._log("🛑 Nhận lệnh hủy: Đang đóng trình duyệt kết xuất...")
        if self._browser:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None

    def find_cached_file(self) -> Optional[Path]:
        """Tìm file đã kết xuất trước đó trong thư mục downloads theo doc_id."""
        for p in self.output_dir.glob(f"*_{self.doc_id}.pdf"):
            if p.is_file() and p.stat().st_size > 50000:
                return p
        return None

    def archive(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        Thực hiện toàn bộ quy trình:
        1. Kiểm tra cache nếu không force_reload.
        2. Mở Playwright Chromium tại Embed Reader View.
        3. Cuộn tuần tự để kích hoạt lazy loading tất cả các trang.
        4. Đồng bộ thuộc tính orig sang src trên các thẻ ảnh absimg.
        5. Áp dụng bảng kiểu CSS chuẩn hóa in ấn @media print.
        6. Kết xuất PDF chất lượng cao.
        7. PyMuPDF hậu xử lý, kiểm tra số trang và lưu tệp.
        """
        # 1. Kiểm tra cache
        if not force_reload:
            cached = self.find_cached_file()
            if cached:
                self._log(f"⚡ Đã tìm thấy tài liệu trong kho lưu trữ: {cached.name}")
                self._progress(100, "Đã lấy từ bộ nhớ đệm (Cache)")
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

        self._progress(5, "Đang khởi tạo trình duyệt kết xuất...")
        self._log(f"🚀 Mở tài liệu Scribd Embed ID {self.doc_id}: {self.embed_url}")

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

            try:
                # 2. Mở giao diện đọc nhúng
                self._progress(10, "Đang tải giao diện đọc nhúng Scribd...")
                page.goto(self.embed_url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(2000)

                if self.is_cancelled:
                    raise RuntimeError("Tiến trình bị hủy bởi người dùng")

                # Lấy tiêu đề tài liệu
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

                # 3. Đếm số trang thực tế
                total_pages = page.evaluate("""() => {
                    const outerPages = document.querySelectorAll('.outer_page_container .outer_page, [id^="outer_page_"]');
                    return outerPages.length;
                }""")
                if not total_pages or total_pages <= 0:
                    total_pages = 1
                self._log(f"📚 Phát hiện tổng số trang: {total_pages}")
                self._progress(15, f"Bắt đầu nạp {total_pages} trang tài liệu...")

                # 4. Cuộn tuần tự qua từng trang để kích hoạt lazy-load
                for idx in range(1, total_pages + 1):
                    if self.is_cancelled:
                        raise RuntimeError("Tiến trình bị hủy bởi người dùng")

                    pct = 15 + int((idx / total_pages) * 65)  # 15% -> 80%
                    self._progress(pct, f"Đang xử lý trang {idx}/{total_pages}...")
                    if idx % 5 == 0 or idx == total_pages or idx == 1:
                        self._log(f"  ⏳ Đang nạp nội dung trang {idx}/{total_pages}...")

                    # Cuộn trang vào giữa màn hình
                    page.evaluate(f"""(idx) => {{
                        const el = document.getElementById('outer_page_' + idx) || document.querySelectorAll('.outer_page')[idx - 1];
                        if (el) {{
                            el.scrollIntoView({{ behavior: 'instant', block: 'center' }});
                            // Đồng bộ ảnh thuộc tính orig sang src nếu chưa nạp
                            el.querySelectorAll('img[orig], .absimg').forEach(img => {{
                                const orig = img.getAttribute('orig');
                                if (orig && (!img.src || img.src !== orig)) {{
                                    img.src = orig;
                                }}
                            }});
                        }}
                    }}""", idx)

                    # Độ trễ ngắn cho các thành phần DOM và network nạp
                    page.wait_for_timeout(300)

                # 5. Quét bảo đảm lần cuối toàn bộ ảnh
                self._progress(82, "Đang đồng bộ hóa toàn bộ hình ảnh và phông chữ...")
                page.evaluate("""() => {
                    document.querySelectorAll('img[orig], .absimg').forEach(img => {
                        const orig = img.getAttribute('orig');
                        if (orig && (!img.src || img.src !== orig)) {
                            img.src = orig;
                        }
                    });
                }""")
                page.wait_for_timeout(1500)

                # 6. Đo kích thước chuẩn của trang đầu tiên
                dims = page.evaluate("""() => {
                    const p1 = document.getElementById('outer_page_1') || document.querySelector('.outer_page');
                    return {
                        widthPx: (p1 && p1.offsetWidth) ? p1.offsetWidth : 1000,
                        heightPx: (p1 && p1.offsetHeight) ? p1.offsetHeight : 1416
                    };
                }""")
                width_px = dims.get("widthPx", 1000)
                height_px = dims.get("heightPx", 1416)
                self._log(f"📐 Kích thước trang gốc: {width_px}px × {height_px}px")

                # 7. Áp dụng chuẩn hóa CSS in ấn @media print
                self._progress(88, "Chuẩn hóa bảng kiểu in ấn (@media print)...")
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
                                overflow-x: visible !important;
                                overflow-y: visible !important;
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

                # 8. Kết xuất file PDF qua Chromium CDP
                self._progress(92, "Đang kết xuất PDF vector qua Chromium Engine...")
                self._log("🖨️ Đang in PDF vector (printBackground=True)...")

                pdf_raw_bytes = page.pdf(
                    prefer_css_page_size=True,
                    print_background=True,
                    display_header_footer=False,
                    margin={"top": "0px", "bottom": "0px", "left": "0px", "right": "0px"},
                )

                # 9. PyMuPDF hậu xử lý & kiểm chứng
                self._progress(96, "Đang tối ưu hóa và kiểm chứng bằng PyMuPDF...")
                target_filename = f"{clean_title}_{self.doc_id}.pdf"
                final_pdf_path = self.output_dir / target_filename

                doc = pymupdf.open(stream=pdf_raw_bytes, filetype="pdf")
                final_pages = doc.page_count

                # Loại bỏ trang trắng cuối nếu bị thừa do page-break
                if final_pages > total_pages:
                    last_page = doc[final_pages - 1]
                    if len(last_page.get_text().strip()) == 0:
                        self._log(f"✂️ Loại bỏ trang trắng thứ {final_pages} thừa ở cuối")
                        doc.delete_page(final_pages - 1)
                        final_pages = doc.page_count

                # Ghi metadata tài liệu
                meta = doc.metadata or {}
                meta["title"] = doc_title
                meta["author"] = "Scribd Archiver"
                meta["creator"] = "DuyDev Studio - Scribd Document Archiver"
                doc.set_metadata(meta)

                # Lưu PDF hoàn chỉnh
                doc.save(str(final_pdf_path), garbage=4, deflate=True)
                doc.close()

                final_size = final_pdf_path.stat().st_size
                final_size_mb = round(final_size / (1024 * 1024), 2)
                self._progress(100, f"Hoàn tất! ({final_pages} trang, {final_size_mb} MB)")
                self._log(f"✅ Kết xuất PDF thành công: {target_filename} ({final_pages} trang, {final_size_mb} MB)")

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
