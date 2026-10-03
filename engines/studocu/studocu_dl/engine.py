# -*- coding: utf-8 -*-
"""
studocu_dl.engine
=================
Engine chính điều phối toàn bộ quy trình:
Bypass Cloudflare -> Khởi tạo CDP -> Bóc tách Virtual DOM -> Ráp layout A4 -> Xuất PDF/Markdown.
"""

import asyncio
import base64
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, Optional, Tuple

try:
    import pymupdf
except ImportError:
    pymupdf = None

from .browser import BrowserProcess
from .cdp import (
    StudocuCDPClient,
    get_page_ws_url,
    create_tab,
    close_tab,
    create_browser_context,
    dispose_browser_context,
)
from .dom_scripts import (
    JS_EXTRACT_MARKDOWN,
    JS_INIT_CAPTURE,
    JS_MOUNT_AND_PRINT_CSS,
    get_chunk_capture_js,
    get_chunk_mount_js,
    get_clear_block_captures_js,
    get_chunk_extract_markdown_js,
    get_hybrid_mount_js,
    JS_WAIT_IMAGES_LOADED,
)
from .utils import find_free_port, normalize_url, sanitize_filename


class StudocuDownloader:
    """Bộ engine chính tải tài liệu Studocu chất lượng cao."""

    def __init__(
        self,
        url: str,
        output_dir: str = "downloads",
        fmt: str = "pdf",
        browser_path: Optional[str] = None,
        timeout: int = 50,
        show_browser: bool = False,
        verbose: bool = False,
        cookie: Optional[str] = None,
        profile_dir: Optional[str] = None,
        progress_callback: Optional[any] = None,
        port: int = 0,
        keep_browser_alive: bool = False,
    ):
        self.url = normalize_url(url)
        self.output_dir = Path(output_dir)
        self.fmt = fmt.lower()
        self.timeout = timeout
        self.show_browser = show_browser
        self.verbose = verbose
        self.cookie = cookie
        self.progress_callback = progress_callback
        self.port = port if port > 0 else find_free_port()
        self.keep_browser_alive = keep_browser_alive
        self.is_cancelled = False
        self.created_target_id = None
        self.browser_context_id = None
        self.current_page_client = None

        if not self.keep_browser_alive:
            self.browser = BrowserProcess(
                url=self.url,
                port=self.port,
                browser_path=browser_path,
                show_browser=self.show_browser,
                profile_dir=profile_dir,
            )
        else:
            self.browser = None

    def cancel(self) -> None:
        """Hủy toàn bộ tiến trình tải và đóng tab ảo lập tức."""
        self.is_cancelled = True
        self._log("🛑 Nhận lệnh hủy tiến trình: Đang đóng tab ảo và ngắt kết nối...")
        if self.created_target_id:
            try:
                close_tab(self.port, self.created_target_id)
                self.created_target_id = None
            except Exception:
                pass
        if self.browser_context_id:
            try:
                dispose_browser_context(self.port, self.browser_context_id)
                self.browser_context_id = None
            except Exception:
                pass
        if self.current_page_client:
            try:
                # Schedule closing page client
                loop = None
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    pass
                if loop and loop.is_running():
                    asyncio.run_coroutine_threadsafe(self.current_page_client.close(), loop)
            except Exception:
                pass
        if not self.keep_browser_alive and self.browser:
            try:
                self.browser.stop()
            except Exception:
                pass

    def _log(self, msg: str, progress: Optional[dict] = None) -> None:
        """Ghi nhật ký ra console và gọi progress callback nếu có."""
        print(msg, flush=True)
        if self.progress_callback:
            try:
                self.progress_callback(msg, progress=progress)
            except TypeError:
                try:
                    self.progress_callback(msg)
                except Exception:
                    pass
            except Exception:
                pass

    async def _inject_cookies(self, page_client: StudocuCDPClient) -> None:
        """Nạp cookie hoặc clearance token vào phiên trình duyệt để vượt Cloudflare."""
        if not self.cookie:
            return

        cookie_text = self.cookie
        p = Path(cookie_text)
        if p.is_file():
            cookie_text = p.read_text(encoding="utf-8")

        # Kiểm tra tính hợp lệ của cookies
        has_clearance = "cf_clearance=" in cookie_text
        has_session = any(k in cookie_text for k in ("studocu_session=", "studocu=", "laravel_session="))

        # Nếu chỉ copy từ document.cookie (thiếu HttpOnly cf_clearance và session), Cloudflare WAF sẽ kích hoạt Access Blocked!
        if not has_clearance and not has_session:
            self._log(
                "  💡 Chuỗi cookie nhập vào thiếu mã xác thực HttpOnly (cf_clearance).\n"
                "     Tự động bỏ qua cookie này để kích hoạt AI Auto-Solver sạch, tránh bị Cloudflare Access Blocked!"
            )
            return

        domains = [".studocu.vn", ".studocu.com", "www.studocu.vn", "www.studocu.com"]

        await page_client.send("Network.enable")
        cookies_to_set = []
        for item in cookie_text.split(";"):
            item = item.strip()
            if "=" in item:
                k, v = item.split("=", 1)
                k = k.strip()
                v = v.strip()
                for d in domains:
                    cookies_to_set.append({
                        "name": k,
                        "value": v,
                        "domain": d,
                        "path": "/",
                        "secure": True,
                    })
        if cookies_to_set:
            self._log(f"  🍪 Đã nạp {len(cookies_to_set)//len(domains)} cookies hợp lệ vào phiên trình duyệt!")
            await page_client.send("Network.setCookies", {"cookies": cookies_to_set})
            cur_url = await page_client.eval("window.location.href")
            if cur_url and not cur_url.startswith("about:"):
                await page_client.send("Page.reload")

    async def _prepare_clean_studocu_session(self, page_client: StudocuCDPClient):
        """Xóa tracking cookies và storage của Studocu để luôn nhận tài liệu không bị làm mờ (unblurred).
        Tuyệt đối bảo toàn Cloudflare clearance cookies (cf_clearance, __cf_bm, _cfuvid) để giữ session ấm, không bị Turnstile."""
        try:
            cookies = (await page_client.send("Network.getCookies")).get("cookies", [])
            removed = 0
            for ck in cookies:
                name = ck.get("name", "")
                name_lower = name.lower()
                if "cf" in name_lower or "clearance" in name_lower:
                    continue # BẢO TOÀN CLOUDFLARE SESSION
                domain = ck.get("domain", "")
                path = ck.get("path", "/")
                await page_client.send("Network.deleteCookies", {"name": name, "domain": domain, "path": path})
                removed += 1

            await page_client.eval("""(() => {
                try { localStorage.clear(); } catch (_) {}
                try { sessionStorage.clear(); } catch (_) {}
            })()""")
            if removed > 0 and self.verbose:
                self._log(f"     🧹 Đã làm sạch {removed} tracking cookies (bảo toàn Cloudflare session).")
        except Exception as e:
            if self.verbose:
                self._log(f"     Lỗi dọn tracking state: {e}")

    async def _clear_document_tracking_storage(self, page_client: StudocuCDPClient):
        """Dọn dẹp LocalStorage, SessionStorage và reset biến paywall sau khi nạp trang tài liệu."""
        try:
            await page_client.eval("""(() => {
                try { localStorage.clear(); } catch (_) {}
                try { sessionStorage.clear(); } catch (_) {}
                try {
                    if (window.indexedDB && indexedDB.databases) {
                        indexedDB.databases().then(dbs => {
                            dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); });
                        }).catch(() => {});
                    }
                } catch (_) {}
            })()""")
        except Exception:
            pass

    async def _try_solve_turnstile(self, page_client: StudocuCDPClient, attempt: int = 1) -> bool:
        """Tự động phát hiện và mô phỏng nhấp chuột giải Turnstile checkbox trên màn hình ảo."""
        try:
            # Tọa độ chuẩn của checkbox Turnstile từ phân tích ảnh chụp thực tế Xvfb 1280x900
            if attempt == 2:
                target_x, target_y = 516, 218
            elif attempt >= 3:
                target_x, target_y = 512, 214
            else:
                target_x, target_y = 514, 216

            self._log(f"     🤖 Phát hiện Cloudflare Turnstile, đang tự động nhấp xác minh ({target_x}, {target_y})...")

            for step in range(5):
                cur_x = 400 + step * int((target_x - 400) / 5)
                cur_y = 150 + step * int((target_y - 150) / 5)
                await page_client.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": cur_x, "y": cur_y})
                await asyncio.sleep(0.04)

            await page_client.send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": target_x, "y": target_y})
            await asyncio.sleep(0.08)
            await page_client.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": target_x, "y": target_y, "button": "left", "clickCount": 1})
            await asyncio.sleep(0.12)
            await page_client.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": target_x, "y": target_y, "button": "left", "clickCount": 1})
            return True
        except Exception as e:
            if self.verbose:
                self._log(f"     Lỗi auto-click Turnstile: {e}")
            return False

    async def _wait_for_page_ready(self, page_client: StudocuCDPClient) -> str:
        """Chờ Cloudflare verification và kiểm tra DOM tài liệu xuất hiện."""
        self._log("  ⏳ Đang kết nối nền và kiểm tra xác minh Cloudflare...")
        start = time.time()
        last_title = ""
        cloudflare_passed = False
        last_click_time = 0.0
        click_count = 0

        while time.time() - start < self.timeout:
            if self.is_cancelled:
                raise asyncio.CancelledError("Tiến trình đã bị người dùng hủy.")
            try:
                title = await page_client.eval("document.title") or ""
            except Exception:
                if self.is_cancelled:
                    raise asyncio.CancelledError("Tiến trình đã bị người dùng hủy.")
                await asyncio.sleep(0.5)
                continue

            if not title or title == "__STD_NAV__":
                await asyncio.sleep(0.5)
                continue

            if title and title != last_title:
                last_title = title
                self._log(f"     Trạng thái trang: '{title}'")

            if title:
                if "Access Blocked" in title:
                    try:
                        if self.browser and self.browser.profile_dir.exists():
                            import shutil
                            shutil.rmtree(self.browser.profile_dir, ignore_errors=True)
                        elif self.keep_browser_alive:
                            from .browser_manager import BrowserSessionManager
                            BrowserSessionManager.get_instance().reset_session()
                    except Exception:
                        pass
                    raise RuntimeError(
                        f"Studocu/Cloudflare đã chặn truy cập (Access Blocked).\n"
                        f"     Nguyên nhân: Cookies nhập vào không đầy đủ (thiếu HttpOnly/cf_clearance) hoặc IP bị WAF nghi ngờ.\n"
                        f"     Hệ thống đã tự động dọn sạch session rác. Bạn hãy thử lại ngay mà không cần nhập cookie (hệ thống sẽ tự giải Turnstile)."
                    )

                if "Just a moment" in title or "Bot Verification" in title:
                    now = time.time()
                    if (now - start >= 4.0) and (now - last_click_time >= 9.0) and click_count < 4:
                        last_click_time = now
                        click_count += 1
                        await self._try_solve_turnstile(page_client, attempt=click_count)
                else:
                    cloudflare_passed = True
                    break

            await asyncio.sleep(1.0)

        if not cloudflare_passed:
            try:
                current_url = await page_client.eval("window.location.href") or "N/A"
            except Exception:
                current_url = "N/A"
            raise TimeoutError(
                f"Quá thời gian chờ xác minh Cloudflare ({self.timeout}s).\n"
                f"     Trạng thái dừng lại ở: '{last_title}'\n"
                f"     URL hiện tại: {current_url}\n"
                f"     Giải pháp gợi ý: Chạy lại kèm tham số --show-browser để xem giao diện giải captcha, hoặc tăng --timeout 90."
            )

        # Chờ DOM tài liệu xuất hiện các phần tử trang
        dom_start = time.time()
        while time.time() - dom_start < 15.0:
            check_js = """
            (() => {
                const isLogin = window.location.href.includes('/login') || window.location.href.includes('/registration') || !!document.querySelector('form[action*="login"]');
                const is404 = document.title.includes('404') || !!document.querySelector('[class*="NotFound"]');
                const pageCount = document.querySelectorAll('div[data-page-index], .pf, [data-page-number]').length;
                return { isLogin, is404, pageCount };
            })()
            """
            try:
                diag = await page_client.eval(check_js) or {}
            except Exception:
                await asyncio.sleep(0.5)
                continue

            if diag.get("isLogin"):
                raise RuntimeError("Tài liệu yêu cầu đăng nhập tài khoản trước khi xem.")
            if diag.get("is404"):
                raise RuntimeError("Tài liệu không tồn tại hoặc đã bị gỡ bỏ (404 Not Found).")
            if diag.get("pageCount", 0) > 0:
                # Kiểm tra tài liệu có bị giới hạn preview (làm mờ) hay không
                try:
                    has_blur = await page_client.eval("!!window.__NEXT_DATA__?.props?.pageProps?.documentAccess?.hasBlurredPages")
                    if has_blur:
                        self._log("     ℹ️ Nhận diện tài liệu có trang giới hạn xem trước. Bộ lọc tự động gỡ mờ & trích xuất CDN sẽ được kích hoạt.")
                except Exception:
                    pass
                return last_title

            await asyncio.sleep(0.8)

        return last_title

    async def _run_hybrid_cdn_pipeline(
        self, page_client: StudocuCDPClient, r_init: dict
    ) -> Tuple[Dict[str, any], str]:
        """Luồng siêu tốc Hybrid Direct CDN:
        - Tải song song CDN images & HTML text vector trực tiếp từ CloudFront (ThreadPoolExecutor max_workers=20).
        - Chromium chỉ mount và in 1 mẻ duy nhất các trang vector và webp.
        - PyMuPDF C-Engine lắp ráp trực tiếp các trang ảnh sắc nét chuẩn A4 (595x842 pt).
        - Ép nén deflate=True, garbage=3 giảm dung lượng từ 80MB xuống 5-20MB.
        - Hoàn tất toàn bộ tài liệu dài chỉ trong 8 - 15 giây.
        """
        t_start_pipeline = time.time()
        total_pages = r_init.get("totalPages", 1)
        doc_title = r_init.get("docTitle", "Studocu Document")
        scoping_class = r_init.get("scopingClass", "p2hv")
        da = r_init.get("documentAccess", {})
        base_url = da.get("url", "")
        object_key = da.get("objectKey", "")
        signed_params = da.get("signedQueryParams", {}) or {}
        png_query = signed_params.get("png") or signed_params.get("global") or ""
        blurred_query = signed_params.get("blurredPage") or ""
        pages_meta = signed_params.get("pages", []) or []

        # Tự động rút trích object_key từ Resource Policy của trang đầu hoặc base_url
        if not object_key and pages_meta:
            try:
                first_q = pages_meta[0].get("signedQueryParams", "")
                if "Policy=" in first_q:
                    pol_part = first_q.split("Policy=")[1].split("&")[0]
                    pol_part = pol_part.replace("-", "+").replace("_", "/")
                    pol_part += "=" * (-len(pol_part) % 4)
                    pol_json = base64.b64decode(pol_part).decode("utf-8", errors="ignore")
                    pol_obj = json.loads(pol_json)
                    res_url = pol_obj.get("Statement", [{}])[0].get("Resource", "")
                    p1_num = str(pages_meta[0].get("pageNumber", 1))
                    filename_part = res_url.rstrip("/").split("/")[-1]
                    if filename_part.endswith(f"{p1_num}.page"):
                        object_key = filename_part[:-len(f"{p1_num}.page")]
            except Exception:
                pass
        if not object_key and base_url:
            parts = [p for p in base_url.strip("/").split("/") if p]
            if len(parts) >= 2 and parts[-1] == "html" and len(parts[-2]) == 32:
                object_key = parts[-2]

        # Giai đoạn 1 (0% - 25%): Bảo mật & Trích xuất khóa tài liệu
        self._log(
            f"  📄 Nhận diện tài liệu: '{doc_title}' | Tổng số: {total_pages} trang",
            progress={
                "phase": "init",
                "current_page": 0,
                "total_pages": total_pages,
                "percent": 15,
                "message": f"Bảo mật & Trích xuất khóa tài liệu: {doc_title} ({total_pages} trang)",
            },
        )

        if self.is_cancelled:
            raise asyncio.CancelledError("Tiến trình đã bị người dùng hủy.")

        # Giai đoạn 2 (25% - 75%): Tải siêu tốc dữ liệu CDN
        self._log(
            f"  ⚡ Đang tải siêu tốc dữ liệu CDN cho {total_pages} trang qua ThreadPoolExecutor...",
            progress={
                "phase": "downloading",
                "current_page": 0,
                "total_pages": total_pages,
                "percent": 25,
                "message": f"Tải siêu tốc dữ liệu CDN: 0/{total_pages} trang (25%)",
            },
        )

        pages_html_map = {}
        for item in r_init.get("pageDataList", []):
            p_idx = item.get("index", 0)
            p_html = item.get("pageHtml")
            if p_html:
                pages_html_map[p_idx + 1] = p_html

        def fetch_page_html(p_info):
            if self.is_cancelled:
                return (None, None)
            p_num = p_info.get("pageNumber")
            q = p_info.get("signedQueryParams", "")
            url = f"{base_url}{object_key}{p_num}.page{q}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    return (p_num, resp.read().decode("utf-8", errors="ignore"))
            except Exception:
                try:
                    pol_part = q.split("Policy=")[1].split("&")[0]
                    pol_part = pol_part.replace("-", "+").replace("_", "/")
                    pol_part += "=" * (-len(pol_part) % 4)
                    pol_json = base64.b64decode(pol_part).decode("utf-8", errors="ignore")
                    pol_obj = json.loads(pol_json)
                    res_url = pol_obj["Statement"][0]["Resource"]
                    req = urllib.request.Request(f"{res_url}{q}", headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=6) as resp:
                        return (p_num, resp.read().decode("utf-8", errors="ignore"))
                except Exception:
                    return (p_num, None)

        def fetch_png(p_num):
            if self.is_cancelled:
                return (p_num, None)
            url = f"{base_url}bg{p_num}.png{png_query}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    return (p_num, resp.read())
            except urllib.error.HTTPError:
                return (p_num, None)
            except Exception:
                return (p_num, None)

        loop = asyncio.get_running_loop()

        def execute_parallel_io():
            html_map = dict(pages_html_map)
            if pages_meta:
                with ThreadPoolExecutor(max_workers=min(20, len(pages_meta))) as ex:
                    fetched_html = dict(ex.map(fetch_page_html, pages_meta))
                    for k, v in fetched_html.items():
                        if k and v:
                            html_map[k] = v

            preview_set = set(html_map.keys())
            non_preview_pages = [p for p in range(1, total_pages + 1) if p not in preview_set]

            png_results = {}
            done_count = len(preview_set)

            if non_preview_pages:
                with ThreadPoolExecutor(max_workers=20) as ex:
                    futures = {ex.submit(fetch_png, p): p for p in non_preview_pages}
                    for fut in futures:
                        if self.is_cancelled:
                            break
                        p_num, data = fut.result()
                        png_results[p_num] = data
                        done_count += 1
                        pct = 25 + int((done_count / total_pages) * 50)
                        if done_count % 10 == 0 or done_count == total_pages:
                            self._log(
                                f"     ⚡ Tải dữ liệu CDN: {done_count}/{total_pages} trang ({pct}%)...",
                                progress={
                                    "phase": "downloading",
                                    "current_page": done_count,
                                    "total_pages": total_pages,
                                    "percent": min(75, pct),
                                    "message": f"Tải siêu tốc dữ liệu CDN: {done_count}/{total_pages} trang ({pct}%)",
                                },
                            )

            return html_map, png_results

        pages_html_map, png_results = await loop.run_in_executor(None, execute_parallel_io)

        if self.is_cancelled:
            raise asyncio.CancelledError("Tiến trình đã bị người dùng hủy.")

        non_png_pages = [
            p for p in range(1, total_pages + 1)
            if p not in pages_html_map and not png_results.get(p)
        ]

        # Giai đoạn 3 (75% - 95%): Ghép nối vector & nén tối ưu PDF
        self._log(
            f"  🖨️  Ghép nối vector & nén tối ưu PDF cho {total_pages} trang...",
            progress={
                "phase": "rendering",
                "current_page": total_pages,
                "total_pages": total_pages,
                "percent": 80,
                "message": f"Ghép nối vector & nén tối ưu PDF...",
            },
        )

        chrome_pdf_bytes = b""
        total_chrome_sheets = len(pages_html_map) + len(non_png_pages)
        all_md_items = []

        if total_chrome_sheets > 0:
            try:
                mount_js = get_hybrid_mount_js(
                    pages_html_map=pages_html_map,
                    non_png_pages=non_png_pages,
                    base_url=base_url,
                    png_query=png_query,
                    blurred_query=blurred_query,
                    scoping_class=scoping_class,
                )
                await page_client.eval(mount_js)
                await page_client.eval(JS_WAIT_IMAGES_LOADED, await_promise=True)
                await page_client.eval("document.fonts?.ready", await_promise=True)

                pdf_res = await page_client.send(
                    "Page.printToPDF",
                    {
                        "printBackground": True,
                        "paperWidth": 8.27,
                        "paperHeight": 11.69,
                        "marginTop": 0,
                        "marginBottom": 0,
                        "marginLeft": 0,
                        "marginRight": 0,
                        "preferCSSPageSize": True,
                        "transferMode": "ReturnAsBase64",
                    },
                )
                chrome_pdf_bytes = base64.b64decode(pdf_res["data"])

                if self.fmt in ("md", "both"):
                    all_md_items = await page_client.eval(JS_EXTRACT_MARKDOWN) or []
            finally:
                try:
                    await page_client.eval("""
                    (() => {
                        document.getElementById('clean-viewer-container')?.remove();
                        document.getElementById('std-clean-print-css')?.remove();
                    })()
                    """)
                except Exception:
                    pass

        master_doc = pymupdf.open()
        chrome_doc = pymupdf.open("pdf", chrome_pdf_bytes) if chrome_pdf_bytes else None

        preview_count = len(pages_html_map)
        sorted_preview_pages = sorted(pages_html_map.keys())
        chrome_page_map = {}
        for idx, p in enumerate(sorted_preview_pages):
            chrome_page_map[p] = idx
        for idx, p in enumerate(non_png_pages):
            chrome_page_map[p] = preview_count + idx

        for p in range(1, total_pages + 1):
            if chrome_doc and p in chrome_page_map and chrome_page_map[p] < len(chrome_doc):
                c_idx = chrome_page_map[p]
                master_doc.insert_pdf(chrome_doc, from_page=c_idx, to_page=c_idx)
            elif p in png_results and png_results[p]:
                page = master_doc.new_page(width=595, height=842)
                page.insert_image(page.rect, stream=png_results[p])
            else:
                master_doc.new_page(width=595, height=842)

        if chrome_doc:
            chrome_doc.close()

        opt_pdf_bytes = master_doc.tobytes(deflate=True, garbage=3)
        actual_pages = len(master_doc)
        master_doc.close()

        clean_filename = sanitize_filename(doc_title)
        results = {"pages": actual_pages}

        if self.fmt in ("pdf", "both"):
            pdf_path = self.output_dir / f"{clean_filename}.pdf"
            pdf_path.write_bytes(opt_pdf_bytes)
            try:
                pdf_path.chmod(0o666)
            except Exception:
                pass

            pdf_size_mb = len(opt_pdf_bytes) / (1024 * 1024)
            render_sec = round(time.time() - t_start_pipeline, 2)
            results["pdf"] = {
                "path": str(pdf_path.resolve()),
                "size_mb": round(pdf_size_mb, 2),
                "pages": actual_pages,
                "render_sec": render_sec,
            }

        if self.fmt in ("md", "both"):
            lines = [f"# {doc_title}", "", "> Tải tự động từ Studocu bằng studocu-dl", ""]
            preview_text_map = {item.get("page", 0): item.get("text", "") for item in all_md_items}
            for p in range(1, total_pages + 1):
                p_text = preview_text_map.get(p, "")
                lines.append("---")
                lines.append(f"## Trang {p}")
                lines.append("")
                lines.append(p_text if p_text else "*(Trang này không có văn bản hoặc là ảnh scan)*")
                lines.append("")
            md_content = "\n".join(lines)
            md_path = self.output_dir / f"{clean_filename}.md"
            md_path.write_text(md_content, encoding="utf-8")
            results["md"] = {
                "path": str(md_path.resolve()),
                "size_kb": round(len(md_content.encode("utf-8")) / 1024, 2),
            }

        # Giai đoạn 4 (100%): Hoàn tất
        total_time = round(time.time() - t_start_pipeline, 2)
        self._log(
            f"  🎉 Tải hoàn tất ({actual_pages} trang) trong {total_time}s!",
            progress={
                "phase": "completed",
                "current_page": actual_pages,
                "total_pages": actual_pages,
                "percent": 100,
                "message": f"Tải hoàn tất ({actual_pages} trang)",
            },
        )

        return results, doc_title

    async def _process_interleaved_blocks(
        self, page_client: StudocuCDPClient, r_init: Optional[dict] = None
    ) -> Tuple[Dict[str, any], str]:
        """Quy trình cào & in ấn PDF gối đầu (Interleaved Block Streaming) theo từng cụm 25 trang:
        Cào xong khối nào -> Gắn DOM và in PDF khối đó -> Ghép nối bằng PyMuPDF -> Giải phóng RAM khối đó.
        Đảm bảo 100% Vector PDF, tốc độ tối đa và RAM luôn dưới 250MB."""
        # Dọn dẹp sạch sẽ DOM container rác nếu luồng hybrid trước đó gặp lỗi
        try:
            await page_client.eval("""
            (() => {
                document.getElementById('clean-viewer-container')?.remove();
                document.getElementById('std-clean-print-css')?.remove();
            })()
            """)
        except Exception:
            pass

        if r_init is None:
            r_init = await page_client.eval(JS_INIT_CAPTURE) or {}
        total_pages = r_init.get("totalPages", 1)
        doc_title = r_init.get("docTitle", "Studocu Document")

        self._log(
            f"  📄 Nhận diện tài liệu: '{doc_title}' | Tổng số: {total_pages} trang",
            progress={
                "phase": "init",
                "current_page": 0,
                "total_pages": total_pages,
                "percent": 5,
                "message": f"Nhận diện: {doc_title} ({total_pages} trang)",
            },
        )

        concurrent_jobs = 1
        try:
            from .job_worker import ACTIVE_JOB_IDS
            concurrent_jobs = len(ACTIVE_JOB_IDS)
        except Exception:
            pass

        base_block = 15 if concurrent_jobs > 1 else 25
        BLOCK_SIZE = base_block if pymupdf else total_pages
        if concurrent_jobs > 1 and pymupdf:
            self._log(
                f"  ⚡ Tự động điều chỉnh kích thước khối: {BLOCK_SIZE} trang/khối ({concurrent_jobs} tác vụ đang chạy đồng thời để bảo vệ bộ nhớ RAM)..."
            )
        master_pdf_doc = pymupdf.open() if pymupdf else None
        single_pdf_bytes = b""
        all_md_items = []
        total_captured_count = 0
        t_start_processing = time.time()

        for b_start in range(0, total_pages, BLOCK_SIZE):
            if self.is_cancelled:
                if master_pdf_doc is not None:
                    master_pdf_doc.close()
                raise asyncio.CancelledError("Tiến trình đã bị người dùng hủy.")

            b_end = min(b_start + BLOCK_SIZE, total_pages)

            # Giai đoạn 1: Cào nội dung DOM khối này
            self._log(
                f"  🔄 Đang thu thập nội dung: Trang {b_start + 1} - {b_end}/{total_pages}...",
                progress={
                    "phase": "capturing",
                    "current_page": b_start + 1,
                    "total_pages": total_pages,
                    "percent": max(5, int((b_start / total_pages) * 85)),
                    "message": f"Thu thập nội dung: {b_start + 1}-{b_end}/{total_pages} trang",
                },
            )
            chunk_js = get_chunk_capture_js(b_start, b_end, total_pages)
            await page_client.eval(chunk_js, await_promise=True)

            # Healing nhanh cục bộ cho riêng khối này nếu bị thiếu
            missing_in_block = await page_client.eval(f"""
            (() => {{
                const missing = [];
                for (let idx = {b_start}; idx < {b_end}; idx++) {{
                    const sheet = window.__STD_CAPTURES__?.get(idx);
                    if (!sheet) {{ missing.push(idx); continue; }}
                    const textLen = sheet.textContent.trim().length;
                    const imgs = Array.from(sheet.querySelectorAll('img'));
                    const hasValidImg = imgs.some(img => img.naturalWidth > 0 || (img.src && !img.src.includes('blurred') && img.src.length > 0));
                    const canvases = sheet.querySelectorAll('canvas').length;
                    if (textLen === 0 && !hasValidImg && canvases === 0) {{
                        missing.push(idx);
                    }}
                }}
                return missing;
            }})()
            """) or []

            if missing_in_block:
                for idx in missing_in_block:
                    if self.is_cancelled:
                        break
                    heal_js = f"""
                    (async () => {{
                        const sleep = ms => new Promise(r => setTimeout(r, ms));
                        const scrollContainer = document.getElementById('viewer-wrapper') ||
                                               document.getElementById('document-wrapper') ||
                                               document.scrollingElement ||
                                               document.documentElement;
                        let pageEl = document.querySelector(`div[data-page-index="{idx}"]`) ||
                                     document.querySelector(`[data-page-number="{idx + 1}"]`) ||
                                     document.querySelectorAll('.pf')[{idx}];
                        if (!pageEl && {total_pages} > 1) {{
                            const maxScroll = Math.max(0, (scrollContainer.scrollHeight || document.documentElement.scrollHeight) - scrollContainer.clientHeight);
                            const targetScroll = Math.round(maxScroll * ({idx} / ({total_pages} - 1)));
                            if (scrollContainer.scrollTop !== undefined) scrollContainer.scrollTop = targetScroll;
                            window.scrollTo(0, targetScroll);
                            try {{ scrollContainer.dispatchEvent(new Event('scroll', {{ bubbles: true }})); }} catch (_) {{}}
                            await sleep(100);
                            pageEl = document.querySelector(`div[data-page-index="{idx}"]`) ||
                                     document.querySelector(`[data-page-number="{idx + 1}"]`) ||
                                     document.querySelectorAll('.pf')[{idx}];
                        }}
                        if (pageEl) {{
                            try {{ pageEl.scrollIntoView({{ block: 'center', inline: 'nearest' }}); }} catch (_) {{}}
                        }}
                        let pf = pageEl ? (pageEl.querySelector('.pf') || pageEl) : null;
                        for (let w = 0; w < 30; w++) {{
                            if (pageEl) pf = pageEl.querySelector('.pf') || pageEl;
                            if (pf) {{
                                const textCount = pf.querySelectorAll('.t, .textLayer span, [class*="textLayer"] span').length;
                                const imgs = pf.querySelectorAll('img');
                                if (textCount > 0 || imgs.length > 0) break;
                            }}
                            await sleep(60);
                        }}
                        if (pf) {{
                            pf.querySelectorAll('.banner-wrapper, [class*="InlineBanner"], [class*="PremiumBanner"], [class*="banner"], [class*="paywall" i]').forEach(el => el.remove());
                            if (window.__STD_BASE_URL__ && window.__STD_QUERY__) {{
                                const img = pf.querySelector('img');
                                if (img) {{
                                    const src = img.getAttribute('src') || img.src || '';
                                    if (src.includes('blurred') || src.includes('blur') || !src) {{
                                        img.src = window.__STD_BASE_URL__ + 'bg' + ({idx} + 1) + '.png' + window.__STD_QUERY__;
                                        img.removeAttribute('srcset');
                                        img.setAttribute('fetchpriority', 'high');
                                        img.removeAttribute('loading');
                                        img.setAttribute('decoding', 'sync');
                                    }}
                                }}
                            }}
                            const sheet = window.__std_buildA4Sheet(pf, {idx});
                            window.__STD_CAPTURES__.set({idx}, sheet);
                            return true;
                        }}
                        return false;
                    }})()
                    """
                    await page_client.eval(heal_js, await_promise=True)

            block_captured = await page_client.eval(f"""
            (() => {{
                let count = 0;
                for (let i = {b_start}; i < {b_end}; i++) {{
                    if (window.__STD_CAPTURES__?.has(i)) count++;
                }}
                return count;
            }})()
            """) or 0
            total_captured_count += block_captured

            # Giai đoạn 2: Trích xuất Markdown nếu cần
            if self.fmt in ("md", "both"):
                md_items = await page_client.eval(get_chunk_extract_markdown_js(b_start, b_end)) or []
                all_md_items.extend(md_items)

            # Giai đoạn 3: Xuất PDF Vector cho khối này
            if self.fmt in ("pdf", "both"):
                self._log(
                    f"     🖨️  Đang xuất & gộp PDF: Trang {b_start + 1} - {b_end}/{total_pages}...",
                    progress={
                        "phase": "rendering",
                        "current_page": b_end,
                        "total_pages": total_pages,
                        "percent": min(95, int((b_end / total_pages) * 95)),
                        "message": f"Xuất & gộp PDF: {b_end}/{total_pages} trang ({int(b_end/total_pages*100)}%)",
                    },
                )
                await page_client.eval(get_chunk_mount_js(b_start, b_end))
                await page_client.eval("document.fonts?.ready", await_promise=True)
                # Đảm bảo 100% hình ảnh nền và ảnh vector giải mã xong hoàn toàn (Zero Blank Pages)
                await page_client.eval(JS_WAIT_IMAGES_LOADED, await_promise=True)
                pdf_res = await page_client.send(
                    "Page.printToPDF",
                    {
                        "printBackground": True,
                        "paperWidth": 8.27,  # A4 inches
                        "paperHeight": 11.69,
                        "marginTop": 0,
                        "marginBottom": 0,
                        "marginLeft": 0,
                        "marginRight": 0,
                        "preferCSSPageSize": True,
                        "transferMode": "ReturnAsBase64",
                    },
                )
                chunk_bytes = base64.b64decode(pdf_res["data"])
                if master_pdf_doc is not None:
                    sub_doc = pymupdf.open("pdf", chunk_bytes)
                    master_pdf_doc.insert_pdf(sub_doc)
                    sub_doc.close()
                else:
                    single_pdf_bytes = chunk_bytes

            # Giai đoạn 4: Giải phóng triệt để RAM DOM của khối vừa in
            await page_client.eval(get_clear_block_captures_js(b_start, b_end))

        if total_captured_count == 0:
            if master_pdf_doc is not None:
                master_pdf_doc.close()
            raise RuntimeError("Không thu thập được trang tài liệu nào hợp lệ để xuất.")

        # Hoàn tất xuất file
        results = {}
        clean_filename = sanitize_filename(doc_title)

        if self.fmt in ("pdf", "both"):
            if master_pdf_doc is not None:
                pdf_bytes = master_pdf_doc.tobytes(deflate=True)
                actual_pages = len(master_pdf_doc)
                master_pdf_doc.close()
            else:
                pdf_bytes = single_pdf_bytes
                actual_pages = total_captured_count

            pdf_path = self.output_dir / f"{clean_filename}.pdf"
            pdf_path.write_bytes(pdf_bytes)
            try:
                pdf_path.chmod(0o666)
            except Exception:
                pass

            pdf_size_mb = len(pdf_bytes) / (1024 * 1024)
            results["pdf"] = {
                "path": str(pdf_path.resolve()),
                "size_mb": round(pdf_size_mb, 2),
                "pages": actual_pages,
                "render_sec": round(time.time() - t_start_processing, 2),
            }

        if self.fmt in ("md", "both"):
            lines = [f"# {doc_title}", "", "> Tải tự động từ Studocu bằng studocu-dl", ""]
            for item in all_md_items:
                p_num = item.get("page", 1)
                p_text = item.get("text", "")
                lines.append("---")
                lines.append(f"## Trang {p_num}")
                lines.append("")
                lines.append(p_text if p_text else "*(Trang này không có văn bản hoặc là ảnh scan)*")
                lines.append("")
            md_content = "\n".join(lines)
            md_path = self.output_dir / f"{clean_filename}.md"
            md_path.write_text(md_content, encoding="utf-8")
            results["md"] = {
                "path": str(md_path.resolve()),
                "size_kb": round(len(md_content.encode("utf-8")) / 1024, 2),
            }

        return results, doc_title

    async def run(self) -> Dict[str, any]:
        """Quy trình thực thi chính."""
        t_start = time.time()
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self._log(f"\n🚀 Khởi chạy Studocu Downloader...")
        self._log(f"  🔗 URL: {self.url}")
        self._log(f"  📂 Output: {self.output_dir.resolve()}")
        self._log(f"  🎯 Định dạng: {self.fmt.upper()}")

        created_target_id = None
        self.browser_context_id = None
        if self.keep_browser_alive:
            try:
                # Tạo BrowserContext ẩn danh riêng cho job này để cách ly hoàn toàn session/storage
                try:
                    self.browser_context_id = create_browser_context(self.port)
                    self._log(f"  🔒 Đã khởi tạo Incognito BrowserContext ({self.browser_context_id[:8]}...)")
                except Exception as ctx_err:
                    self._log(f"  ⚠️ Không thể tạo Incognito Context ({ctx_err}), fallback Default Profile...")
                    self.browser_context_id = None

                created_target_id, page_ws_url = create_tab(
                    self.port,
                    "about:blank",
                    browser_context_id=self.browser_context_id,
                )
                self.created_target_id = created_target_id
                self._log(f"  📑 Đã khởi tạo Tab ảo độc lập (Target ID: {created_target_id[:8]}...)")
            except Exception as e:
                self._log(f"  ⚠️ Mở tab mới thất bại ({e}), dùng tab hiện có...")
                page_ws_url = await get_page_ws_url(self.port)
        else:
            if self.browser:
                self.browser.start()
            page_ws_url = await get_page_ws_url(self.port)

        page_client = StudocuCDPClient(page_ws_url)
        self.current_page_client = page_client
        await page_client.connect()

        try:
            await page_client.send("Page.enable")
            await page_client.send("DOM.enable")

            # Chặn 100% request rác, tracking, analytics, media video/gif
            await page_client.block_unwanted_resources()

            # Nạp cookies người dùng nếu có, hoặc chuẩn bị Active Clean Session
            if self.cookie:
                await self._inject_cookies(page_client)
            else:
                await self._prepare_clean_studocu_session(page_client)

            # Điều hướng đến trang tài liệu với cấu hình stealth và cookies đã sẵn sàng
            try:
                cur_url = await page_client.eval("window.location.href")
            except Exception:
                cur_url = ""

            if not cur_url or cur_url.startswith("about:") or cur_url != self.url:
                try:
                    await page_client.eval("document.title = '__STD_NAV__'")
                except Exception:
                    pass
                await page_client.send("Page.navigate", {"url": self.url})

            # 1. Chờ Cloudflare và nạp trang
            await self._wait_for_page_ready(page_client)

            # Dọn dẹp tracking state trên trang tài liệu vừa nạp
            await self._clear_document_tracking_storage(page_client)

            # 2. Khởi tạo capture và chạy trực tiếp cơ chế Interleaved Block Streaming ổn định
            r_init = await page_client.eval(JS_INIT_CAPTURE) or {}
            self._log("  ℹ️ Sử dụng cơ chế Interleaved Block Streaming (bảo toàn 100% Vector & hình ảnh)...")
            results, final_title = await self._process_interleaved_blocks(page_client, r_init=r_init)

            # 3. Dọn dẹp bộ nhớ chủ động trước khi hoàn thành
            await page_client.purge_memory()

            total_elapsed = round(time.time() - t_start, 2)
            results["elapsed_sec"] = total_elapsed
            results["title"] = final_title
            return results

        finally:
            self.current_page_client = None
            try:
                await self._prepare_clean_studocu_session(page_client)
            except Exception:
                pass
            try:
                await page_client.purge_memory()
            except Exception:
                pass
            try:
                await page_client.close()
            except Exception:
                pass

            # Tiêu hủy Tab ảo vừa dùng để giải phóng 100% DOM, ảnh, canvas khỏi RAM
            if created_target_id:
                try:
                    close_tab(self.port, created_target_id)
                    self._log(f"  🧹 Đã đóng Tab ảo (Target ID: {created_target_id[:8]}...), giải phóng toàn bộ RAM!")
                except Exception:
                    pass
                self.created_target_id = None

            # Giải phóng BrowserContext để xóa bỏ toàn bộ Isolated Cache & Storage
            if self.browser_context_id:
                try:
                    dispose_browser_context(self.port, self.browser_context_id)
                    self._log(f"  🛡️ Đã hủy Incognito BrowserContext ({self.browser_context_id[:8]}...), dọn sạch RAM session!")
                except Exception:
                    pass
                self.browser_context_id = None

            if not self.keep_browser_alive and self.browser:
                self.browser.stop()
