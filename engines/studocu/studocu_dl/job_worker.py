# -*- coding: utf-8 -*-
"""
studocu_dl.job_worker
=====================
Quản lý hàng đợi, worker pool song song (tối đa 2 tác vụ) và bộ nhớ đệm tài liệu cục bộ (Local Cache).
"""

import asyncio
import hashlib
import json
import re
import threading
import time
import urllib.parse
from pathlib import Path
from typing import Dict, Optional, Set

from .browser_manager import BrowserSessionManager
from .engine import StudocuDownloader
from .stream_utils import get_doc_id

JOBS: Dict[str, dict] = {}
ACTIVE_DOWNLOADERS: Dict[str, StudocuDownloader] = {}

# CẤU HÌNH CONCURRENCY WORKER POOL
MAX_CONCURRENT_DOWNLOADS = 3
DOWNLOAD_SEMAPHORE = threading.Semaphore(MAX_CONCURRENT_DOWNLOADS)
QUEUE_LOCK = threading.RLock()
ACTIVE_JOB_IDS: Set[str] = set()
WAITING_QUEUE: list[str] = []

# ĐIỀU PHỐI CHỐNG TẢI TRÙNG LẶP (IN-FLIGHT URL DEDUPLICATION)
IN_FLIGHT_LOCK = threading.RLock()
IN_FLIGHT_JOBS: Dict[str, str] = {}
IN_FLIGHT_EVENTS: Dict[str, threading.Event] = {}

CACHE_LOCK = threading.Lock()


def extract_studocu_doc_id(url: str) -> str:
    """Trích xuất ID tài liệu từ URL Studocu hoặc tạo hash duy nhất."""
    clean = url.strip()
    m = re.search(r"/(\d{5,15})(?:[/?#]|$)", clean)
    if m:
        return m.group(1)
    return hashlib.md5(clean.lower().encode("utf-8")).hexdigest()[:12]


def get_cached_document(url: str, downloads_dir: Path) -> Optional[dict]:
    """Kiểm tra xem tài liệu đã từng được tải và lưu trong thư mục downloads chưa."""
    cache_file = downloads_dir / ".cache" / ".doc_cache.json"
    if not cache_file.is_file():
        cache_file = downloads_dir / ".doc_cache.json"
    doc_id = extract_studocu_doc_id(url)
    if not cache_file.is_file():
        return None

    with CACHE_LOCK:
        try:
            cache_data = json.loads(cache_file.read_text(encoding="utf-8"))
            entry = cache_data.get(doc_id)
            if not entry:
                return None

            # Kiểm tra file PDF trên đĩa
            pdf_path = None
            pdf_info = entry.get("result", {}).get("pdf")
            if pdf_info:
                pdf_path = Path(pdf_info.get("path", ""))
                if not pdf_path.is_file():
                    pdf_path = downloads_dir / pdf_info.get("name", "")
            elif entry.get("file_path"):
                pdf_path = Path(entry.get("file_path"))
                if not pdf_path.is_file():
                    pdf_path = downloads_dir / entry.get("filename", "")

            if not pdf_path or not pdf_path.is_file():
                return None

            # Cập nhật đường dẫn stream hợp lệ
            pdf_name = pdf_path.name
            quoted_name = urllib.parse.quote(pdf_name)
            d_id = get_doc_id(pdf_name)
            stream_url = f"/api/document-stream?id={d_id}"
            viewer_url = f"/pdfjs/web/viewer.html?file={urllib.parse.quote(stream_url, safe='')}"

            res = dict(entry.get("result") or {})
            if "pdf" not in res:
                res["pdf"] = {}
            res["title"] = entry.get("title", pdf_path.stem)
            res["pdf"]["id"] = d_id
            res["pdf"]["name"] = pdf_name
            res["pdf"]["path"] = str(pdf_path.resolve())
            res["pdf"]["download_url"] = f"/downloads/{quoted_name}"
            res["pdf"]["view_url"] = f"/view/{quoted_name}"
            res["pdf"]["stream_url"] = stream_url
            res["pdf"]["viewer_url"] = viewer_url
            if not res["pdf"].get("size_mb"):
                res["pdf"]["size_mb"] = round(pdf_path.stat().st_size / (1024 * 1024), 2)
            res["is_cached"] = True
            return res
        except Exception:
            return None
    return None


def save_cached_document(url: str, res: dict, downloads_dir: Path) -> None:
    """Lưu thông tin tài liệu tải thành công vào bộ nhớ đệm cục bộ (.cache/.doc_cache.json)."""
    cache_dir = downloads_dir / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / ".doc_cache.json"
    doc_id = extract_studocu_doc_id(url)
    with CACHE_LOCK:
        try:
            cache_data = {}
            if cache_file.is_file():
                try:
                    cache_data = json.loads(cache_file.read_text(encoding="utf-8"))
                except Exception:
                    cache_data = {}

            cache_data[doc_id] = {
                "url": url,
                "title": res.get("title", ""),
                "result": res,
                "cached_at": time.time(),
            }
            cache_file.write_text(json.dumps(cache_data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass


def run_download_job(
    job_id: str,
    url: str,
    fmt: str,
    timeout: int,
    cookie: Optional[str],
    downloads_dir: Path,
    force_reload: bool = False,
    downloaded_by: Optional[dict] = None,
) -> None:
    """Thực thi tác vụ tải tài liệu qua Concurrency Worker Pool và Local Cache."""
    job = JOBS.get(job_id)
    if not job:
        return

    def on_progress(msg: str, progress: Optional[dict] = None):
        job["logs"].append(msg)
        if progress:
            job["progress"] = progress

    # 1. KIỂM TRA BỘ NHỚ ĐỆM CỤC BỘ (LOCAL CACHE CHECK)
    if not force_reload:
        cached_result = get_cached_document(url, downloads_dir)
        if cached_result:
            pages_count = cached_result.get("pdf", {}).get("pages", 0)
            job["status"] = "completed"
            job["result"] = cached_result
            job["from_cache"] = True
            job["downloaded_by"] = downloaded_by
            job["progress"] = {
                "phase": "completed",
                "current_page": pages_count,
                "total_pages": pages_count,
                "percent": 100,
                "message": "Tài liệu đã có sẵn trên máy chủ",
            }
            if downloaded_by:
                try:
                    from .storage import DocumentStore
                    store = DocumentStore.get_instance()
                    pdf_info = cached_result.get("pdf", {})
                    if pdf_info.get("name"):
                        store.register_document(
                            file_path=downloads_dir / pdf_info["name"],
                            url=url,
                            title=cached_result.get("title", ""),
                            pages=pdf_info.get("pages"),
                            downloaded_by=downloaded_by,
                        )
                except Exception:
                    pass
            job["logs"].append(f"Tài liệu đã có sẵn trên máy chủ: '{cached_result.get('title')}'")
            return

    # 2. CHỐNG TẢI TRÙNG LẶP (IN-FLIGHT URL DEDUPLICATION)
    doc_id = extract_studocu_doc_id(url)
    is_secondary = False
    primary_job_id = None
    completion_event = None

    if not force_reload:
        with IN_FLIGHT_LOCK:
            if doc_id in IN_FLIGHT_JOBS:
                primary_job_id = IN_FLIGHT_JOBS[doc_id]
                primary_job = JOBS.get(primary_job_id)
                # Chỉ gắn vào chờ nếu primary job vẫn đang chạy hoặc trong hàng đợi
                if primary_job and primary_job.get("status") in ("running", "queued", "init"):
                    is_secondary = True
                    completion_event = IN_FLIGHT_EVENTS.get(doc_id)
            if not is_secondary:
                IN_FLIGHT_JOBS[doc_id] = job_id
                completion_event = threading.Event()
                IN_FLIGHT_EVENTS[doc_id] = completion_event

    if is_secondary and primary_job_id and completion_event:
        job["status"] = "running"
        job["logs"].append(
            f"ℹ️ Phát hiện tài liệu đang được tải đồng thời bởi tác vụ [{primary_job_id}]. "
            "Đang liên kết chia sẻ luồng và tái sử dụng kết quả..."
        )
        # Chờ kết quả từ primary job
        while not completion_event.wait(timeout=0.5):
            if job.get("status") == "cancelled":
                job["logs"].append("🛑 Tiến trình đã bị người dùng hủy.")
                return
            primary_job = JOBS.get(primary_job_id)
            if not primary_job or primary_job.get("status") not in ("running", "queued", "init"):
                break
            if primary_job.get("progress"):
                job["progress"] = dict(primary_job["progress"])

        # Sau khi primary job hoàn thành
        primary_job = JOBS.get(primary_job_id)
        if primary_job and primary_job.get("status") == "completed":
            job["result"] = primary_job.get("result")
            job["status"] = "completed"
            job["from_cache"] = True
            job["progress"] = primary_job.get("progress")
            job["logs"].append(
                f"✅ Tải thành công từ luồng chia sẻ [{primary_job_id}]: '{primary_job.get('result', {}).get('title', '')}'!"
            )
            if downloaded_by:
                try:
                    from .storage import DocumentStore
                    store = DocumentStore.get_instance()
                    pdf_info = (job.get("result") or {}).get("pdf", {})
                    if pdf_info.get("name"):
                        store.register_document(
                            file_path=downloads_dir / pdf_info["name"],
                            url=url,
                            title=job.get("result", {}).get("title", ""),
                            pages=pdf_info.get("pages"),
                            downloaded_by=downloaded_by,
                        )
                except Exception:
                    pass
            return
        elif primary_job and primary_job.get("status") == "failed":
            job["status"] = "failed"
            job["error"] = primary_job.get("error", "Tiến trình gốc gặp lỗi")
            job["logs"].append(f"❌ THẤT BẠI: {job['error']}")
            return
        elif job.get("status") == "cancelled":
            return

        # Nếu primary job bị hủy hoặc kết thúc không trọn vẹn, tự mình tải độc lập
        job["logs"].append("⚠️ Tiến trình liên kết bị gián đoạn, tự động khởi tạo luồng tải độc lập...")
        with IN_FLIGHT_LOCK:
            IN_FLIGHT_JOBS[doc_id] = job_id
            completion_event = threading.Event()
            IN_FLIGHT_EVENTS[doc_id] = completion_event

    try:
        # 3. XẾP HÀNG ĐỢI NẾU HỆ THỐNG ĐANG BẬN
        with QUEUE_LOCK:
            if len(ACTIVE_JOB_IDS) >= MAX_CONCURRENT_DOWNLOADS:
                if job_id not in WAITING_QUEUE:
                    WAITING_QUEUE.append(job_id)
                queue_pos = WAITING_QUEUE.index(job_id) + 1
                job["status"] = "queued"
                job["progress"] = {
                    "phase": "queued",
                    "current_page": 0,
                    "total_pages": 0,
                    "percent": 0,
                    "message": f"Đang trong hàng đợi (#{queue_pos})",
                }
                job["logs"].append(
                    f"⏳ Tất cả luồng tải đang bận ({len(ACTIVE_JOB_IDS)}/{MAX_CONCURRENT_DOWNLOADS} tác vụ đang chạy). "
                    f"Bạn đang ở hàng đợi (Vị trí: #{queue_pos}), hệ thống sẽ tự động bắt đầu ngay khi có luồng trống..."
                )

        # 4. NHẬN LUỒNG VÀ THỰC THI (Tối đa 3 tác vụ song song)
        with DOWNLOAD_SEMAPHORE:
            with QUEUE_LOCK:
                if job_id in WAITING_QUEUE:
                    WAITING_QUEUE.remove(job_id)
                if job.get("status") == "cancelled":
                    return
                ACTIVE_JOB_IDS.add(job_id)

            job["status"] = "running"
            job["logs"].append("⚡ Đã nhận luồng tải từ hệ thống! Đang mở Tab ảo...")

            try:
                # Sử dụng singleton BrowserSessionManager để giữ kết nối và session Cloudflare sống mãi
                browser_manager = BrowserSessionManager.get_instance(
                    port=9222,
                    profile_dir=str(downloads_dir / ".session"),
                )

                try:
                    browser_manager.ensure_browser_running()
                except Exception as e:
                    job["status"] = "failed"
                    job["error"] = f"Không thể kết nối trình duyệt nền: {e}"
                    job["logs"].append(f"❌ LỖI KHỞI ĐỘNG TRÌNH DUYỆT: {e}")
                    return

                downloader = StudocuDownloader(
                    url=url,
                    output_dir=str(downloads_dir),
                    fmt=fmt,
                    timeout=timeout,
                    cookie=cookie,
                    progress_callback=on_progress,
                    port=browser_manager.port,
                    profile_dir=str(browser_manager.profile_dir),
                    keep_browser_alive=True,
                )
                ACTIVE_DOWNLOADERS[job_id] = downloader

                res = asyncio.run(downloader.run())

                # Tạo download URL cho từng file
                if "pdf" in res:
                    pdf_path = Path(res["pdf"]["path"])
                    pdf_name = pdf_path.name
                    quoted_name = urllib.parse.quote(pdf_name)
                    doc_id_val = get_doc_id(pdf_name)
                    stream_url = f"/api/document-stream?id={doc_id_val}"
                    viewer_url = f"/pdfjs/web/viewer.html?file={urllib.parse.quote(stream_url, safe='')}"
                    res["pdf"]["id"] = doc_id_val
                    res["pdf"]["name"] = pdf_name
                    res["pdf"]["download_url"] = f"/downloads/{quoted_name}"
                    res["pdf"]["view_url"] = f"/view/{quoted_name}"
                    res["pdf"]["stream_url"] = stream_url
                    res["pdf"]["viewer_url"] = viewer_url
                if "md" in res:
                    md_path = Path(res["md"]["path"])
                    md_name = md_path.name
                    quoted_md = urllib.parse.quote(md_name)
                    res["md"]["name"] = md_name
                    res["md"]["download_url"] = f"/downloads/{quoted_md}"
                    res["md"]["view_url"] = f"/view/{quoted_md}"

                # Lưu vào bộ nhớ đệm cục bộ
                save_cached_document(url, res, downloads_dir)

                # Đăng ký tài liệu vào hệ thống lưu trữ DocumentStore
                try:
                    from .storage import DocumentStore
                    store = DocumentStore.get_instance()
                    pages_val = res.get("pages")
                    if pages_val is None and "pdf" in res and isinstance(res["pdf"], dict):
                        pages_val = res["pdf"].get("pages")

                    if "pdf" in res and res["pdf"].get("path"):
                        store.register_document(
                            file_path=Path(res["pdf"]["path"]),
                            url=url,
                            title=res.get("title", ""),
                            pages=pages_val,
                            downloaded_by=downloaded_by,
                        )
                    if "md" in res and res["md"].get("path"):
                        store.register_document(
                            file_path=Path(res["md"]["path"]),
                            url=url,
                            title=res.get("title", ""),
                            pages=None,
                            downloaded_by=downloaded_by,
                        )
                except Exception as store_err:
                    print(f"[DocumentStore] Warning: Không thể đăng ký metadata: {store_err}", flush=True)

                job["result"] = res
                job["status"] = "completed"
                pages_final = res.get("pdf", {}).get("pages") or pages_val or 0
                job["progress"] = {
                    "phase": "completed",
                    "current_page": pages_final,
                    "total_pages": pages_final,
                    "percent": 100,
                    "message": f"Tải hoàn tất ({pages_final} trang)",
                }
                job["logs"].append(f"✅ Tải thành công tài liệu: '{res.get('title')}'!")
            except asyncio.CancelledError:
                job["status"] = "cancelled"
                job["progress"] = {
                    "phase": "cancelled",
                    "current_page": 0,
                    "total_pages": 0,
                    "percent": 0,
                    "message": "Tiến trình đã bị người dùng hủy",
                }
                job["logs"].append("🛑 Tiến trình đã hủy thành công.")
            except Exception as e:
                if job.get("status") == "cancelled" or (downloader and getattr(downloader, "is_cancelled", False)):
                    job["status"] = "cancelled"
                    job["progress"] = {
                        "phase": "cancelled",
                        "current_page": 0,
                        "total_pages": 0,
                        "percent": 0,
                        "message": "Tiến trình đã bị người dùng hủy",
                    }
                    job["logs"].append("🛑 Tiến trình đã hủy thành công.")
                else:
                    job["status"] = "failed"
                    job["error"] = str(e)
                    job["progress"] = {
                        "phase": "failed",
                        "current_page": 0,
                        "total_pages": 0,
                        "percent": 0,
                        "message": f"Lỗi: {e}",
                    }
                    job["logs"].append(f"❌ THẤT BẠI: {e}")
            finally:
                ACTIVE_DOWNLOADERS.pop(job_id, None)
                with QUEUE_LOCK:
                    ACTIVE_JOB_IDS.discard(job_id)
    finally:
        with IN_FLIGHT_LOCK:
            if IN_FLIGHT_JOBS.get(doc_id) == job_id:
                evt = IN_FLIGHT_EVENTS.pop(doc_id, None)
                if evt:
                    evt.set()
                IN_FLIGHT_JOBS.pop(doc_id, None)


def cancel_job(job_id: str) -> bool:
    """Hủy một tác vụ đang chạy hoặc đang chờ trong hàng đợi."""
    job = JOBS.get(job_id)
    if not job:
        return False
    job["status"] = "cancelled"
    job["logs"].append("🛑 Đã nhận yêu cầu hủy từ người dùng, đang giải phóng tài nguyên...")
    downloader = ACTIVE_DOWNLOADERS.get(job_id)
    if downloader:
        try:
            downloader.cancel()
        except Exception:
            pass
    with QUEUE_LOCK:
        if job_id in WAITING_QUEUE:
            try:
                WAITING_QUEUE.remove(job_id)
            except ValueError:
                pass
        ACTIVE_JOB_IDS.discard(job_id)
    return True
