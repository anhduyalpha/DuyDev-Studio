# -*- coding: utf-8 -*-
"""
scribd_dl.handlers
==================
HTTP Request Handler for Scribd Document Archiver REST API & SSE streaming.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
import unicodedata
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Optional, Tuple

from .config import DOWNLOADS_DIR, TRASH_DIR
from .engine import extract_scribd_doc_id
from .job_worker import JOBS, create_job, run_archive_job, cancel_job


def extract_doc_id_from_filename(name: str) -> Optional[str]:
    """Rút trích mã số tài liệu từ tên file PDF."""
    if not name:
        return None
    stem = Path(name).stem
    m = re.search(r'[_.-](\d{6,15})$', stem)
    if m:
        return m.group(1)
    m = re.search(r'(\d{6,15})', stem)
    return m.group(1) if m else None


def extract_title_from_filename(name: str, doc_id: Optional[str] = None) -> str:
    """Tạo tiêu đề hiển thị từ tên file."""
    if not name:
        return "Tài liệu Scribd"
    stem = Path(name).stem
    clean = stem
    if doc_id and clean.endswith(f"_{doc_id}"):
        clean = clean[:-len(f"_{doc_id}")]
    elif doc_id and f"_{doc_id}" in clean:
        clean = clean.replace(f"_{doc_id}", "")
    clean = clean.replace("_", " ").strip()
    return clean or stem


def find_file_in_dir(directory: Path, target: str) -> Optional[Path]:
    """Tìm file trên đĩa với cơ chế giải mã URL, Unicode NFC/NFD và doc_id."""
    if not target or not directory.is_dir():
        return None
    raw = target.strip()
    unq1 = urllib.parse.unquote(raw).strip()
    unq2 = urllib.parse.unquote(unq1).strip()

    # 1. Khớp đường dẫn trực tiếp
    for cand_name in (raw, unq1, unq2):
        cand = directory / cand_name
        if cand.is_file():
            return cand

    # 2. Khớp Unicode và doc_id
    target_nfc = unicodedata.normalize('NFC', unq1).strip()
    target_nfd = unicodedata.normalize('NFD', unq1).strip()
    doc_id = extract_scribd_doc_id(unq1) or extract_doc_id_from_filename(unq1)

    for p in directory.glob("*.pdf"):
        if not p.is_file():
            continue
        p_name = p.name
        p_nfc = unicodedata.normalize('NFC', p_name).strip()
        p_nfd = unicodedata.normalize('NFD', p_name).strip()

        if p_nfc in (target_nfc, raw) or p_nfd in (target_nfd, raw):
            return p
        if p.stem.lower() in (target_nfc.lower(), unq1.lower()):
            return p
        if doc_id and (p.name.endswith(f"_{doc_id}.pdf") or f"_{doc_id}." in p.name or p.stem == doc_id):
            return p

    return None


def parse_byte_range(header_val: str, file_size: int) -> Optional[Tuple[int, int]]:
    """Phân tích cú pháp Range Header (Range: bytes=start-end)."""
    if not header_val or not header_val.startswith("bytes="):
        return None
    try:
        raw = header_val.replace("bytes=", "").strip()
        parts = raw.split("-")
        if len(parts) != 2:
            return None
        start_str, end_str = parts[0].strip(), parts[1].strip()
        if start_str and end_str:
            start = int(start_str)
            end = int(end_str)
        elif start_str:
            start = int(start_str)
            end = file_size - 1
        elif end_str:
            suffix = int(end_str)
            start = max(0, file_size - suffix)
            end = file_size - 1
        else:
            return None
        if start < 0 or start >= file_size or end < start:
            return None
        end = min(end, file_size - 1)
        return (start, end)
    except Exception:
        return None


class ScribdHTTPRequestHandler(BaseHTTPRequestHandler):
    """Xử lý các yêu cầu REST API, SSE Streaming và truyền tải tập tin PDF."""

    server_version = "ScribdArchiver/1.0"

    def log_message(self, format, *args):
        # Giảm ồn terminal (RTK Protocol)
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, X-Device-Id")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, Content-Disposition")

    def send_no_cache_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_cors_headers()
        self.end_headers()

    def do_HEAD(self):
        self._handle_get_or_head(is_head=True)

    def do_GET(self):
        self._handle_get_or_head(is_head=False)

    def _handle_get_or_head(self, is_head: bool):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Health check & status chung
        if path in ("/api/status", "/health"):
            data = {
                "success": True,
                "engine": "scribd-archiver",
                "active_jobs": sum(1 for j in JOBS.values() if j.get("status") == "running"),
                "total_jobs": len(JOBS),
                "timestamp": time.time(),
            }
            encoded = json.dumps(data).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 2. Lấy trạng thái Job cụ thể: /api/status/<job_id>
        if path.startswith("/api/status/"):
            job_id = path.replace("/api/status/", "").strip()
            job = JOBS.get(job_id)
            if not job:
                self.send_response(HTTPStatus.NOT_FOUND)
                self.send_cors_headers()
                self.end_headers()
                if not is_head:
                    self.wfile.write(json.dumps({"error": "Job not found"}).encode("utf-8"))
                return

            safe_job = {k: v for k, v in job.items() if k != "archiver"}
            encoded = json.dumps(safe_job, default=str).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 3. Server-Sent Events (SSE) luồng log thời gian thực: /api/events/<job_id>
        if path.startswith("/api/events/"):
            job_id = path.replace("/api/events/", "").strip()
            job = JOBS.get(job_id)
            if not job:
                self.send_response(HTTPStatus.NOT_FOUND)
                self.send_cors_headers()
                self.end_headers()
                return

            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            last_log_idx = 0
            while True:
                curr_status = job.get("status")
                curr_progress = job.get("progress", 0)
                curr_label = job.get("step_label", "")
                logs = job.get("logs", [])
                new_logs = logs[last_log_idx:]
                last_log_idx = len(logs)

                payload = {
                    "id": job_id,
                    "status": curr_status,
                    "progress": curr_progress,
                    "step_label": curr_label,
                    "logs": new_logs,
                    "result": job.get("result"),
                    "error": job.get("error"),
                }
                msg = f"data: {json.dumps(payload, default=str)}\n\n"
                try:
                    self.wfile.write(msg.encode("utf-8"))
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    break

                if curr_status in ("completed", "failed", "cancelled"):
                    break

                time.sleep(0.5)
            return

        # 4. Danh sách tệp đã lưu: /api/files
        if path == "/api/files":
            files = []
            for p in sorted(DOWNLOADS_DIR.glob("*.pdf"), key=lambda x: x.stat().st_mtime, reverse=True):
                if p.is_file():
                    st = p.stat()
                    # Loại bỏ tệp lỗi rác kích thước quá nhỏ (< 12KB) nếu có
                    if st.st_size < 12000 and "Scribd_" in p.name:
                        continue
                    doc_id = extract_doc_id_from_filename(p.name) or extract_scribd_doc_id(p.name) or ""
                    title = extract_title_from_filename(p.name, doc_id)
                    files.append({
                        "id": doc_id,
                        "name": p.name,
                        "title": title,
                        "format": "pdf",
                        "is_pdf": True,
                        "size_bytes": st.st_size,
                        "size_mb": round(st.st_size / (1024 * 1024), 2),
                        "time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
                        "download_url": f"/downloads/{urllib.parse.quote(p.name)}",
                        "stream_url": f"/api/document-stream?file={urllib.parse.quote(p.name)}",
                        "downloaded_by": {"name": "Scribd Archiver"},
                    })
            encoded = json.dumps(files, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 5. Danh sách thùng rác: /api/trash
        if path == "/api/trash":
            trashed = []
            if TRASH_DIR.is_dir():
                for p in sorted(TRASH_DIR.glob("*.pdf"), key=lambda x: x.stat().st_mtime, reverse=True):
                    if p.is_file():
                        st = p.stat()
                        doc_id = extract_doc_id_from_filename(p.name) or extract_scribd_doc_id(p.name) or ""
                        title = extract_title_from_filename(p.name, doc_id)
                        trashed.append({
                            "id": doc_id,
                            "name": p.name,
                            "title": title,
                            "format": "pdf",
                            "is_pdf": True,
                            "size_bytes": st.st_size,
                            "size_mb": round(st.st_size / (1024 * 1024), 2),
                            "time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
                            "download_url": f"/downloads/{urllib.parse.quote(p.name)}",
                        })
            encoded = json.dumps(trashed, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 6. Stream PDF có hỗ trợ Range: /api/document-stream
        if path == "/api/document-stream":
            qs = urllib.parse.parse_qs(parsed.query)
            doc_id = qs.get("id", [""])[0].strip()
            file_name = qs.get("file", [""])[0].strip()

            target_file: Optional[Path] = None
            if file_name:
                target_file = find_file_in_dir(DOWNLOADS_DIR, file_name)
            if not target_file and doc_id:
                target_file = find_file_in_dir(DOWNLOADS_DIR, doc_id)

            if not target_file or not target_file.is_file():
                self.send_response(HTTPStatus.NOT_FOUND)
                self.send_cors_headers()
                self.end_headers()
                if not is_head:
                    self.wfile.write(b"File not found")
                return

            file_size = target_file.stat().st_size
            range_header = self.headers.get("Range")
            range_tuple = parse_byte_range(range_header, file_size) if range_header else None

            if range_tuple:
                start, end = range_tuple
                content_len = end - start + 1
                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            else:
                start, end = 0, file_size - 1
                content_len = file_size
                self.send_response(HTTPStatus.OK)

            self.send_cors_headers()
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(content_len))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Disposition", "inline")
            self.end_headers()

            if not is_head:
                try:
                    with open(target_file, "rb") as f:
                        f.seek(start)
                        rem = content_len
                        while rem > 0:
                            chunk = f.read(min(65536, rem))
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            rem -= len(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            return

        # 7. Tải file attachment: /downloads/<filename>
        if path.startswith("/downloads/"):
            raw_dl_name = path.replace("/downloads/", "").split("?")[0]
            file_path = find_file_in_dir(DOWNLOADS_DIR, raw_dl_name)
            if not file_path or not file_path.is_file():
                self.send_response(HTTPStatus.NOT_FOUND)
                self.send_cors_headers()
                self.end_headers()
                return

            file_size = file_path.stat().st_size
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            quoted = urllib.parse.quote(filename)
            ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "document.pdf"
            self.send_header("Content-Disposition", f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quoted}')
            self.end_headers()

            if not is_head:
                try:
                    with open(file_path, "rb") as f:
                        shutil.copyfileobj(f, self.wfile)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            return

        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Bắt đầu tải tài liệu: /api/download
        if path == "/api/download":
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                data = json.loads(raw_body)
            except Exception:
                data = {}

            url = (data.get("url") or "").strip()
            if not url:
                self.send_response(HTTPStatus.BAD_REQUEST)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "URL không được để trống"}).encode("utf-8"))
                return

            doc_id = extract_scribd_doc_id(url)
            if not doc_id:
                err_msg = "Đây là link tìm kiếm. Vui lòng mở tài liệu cụ thể trên Scribd rồi sao chép link!" if "scribd.com/search" in url.lower() else "URL hoặc mã Scribd không hợp lệ"
                self.send_response(HTTPStatus.BAD_REQUEST)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": err_msg}).encode("utf-8"))
                return

            force_reload = bool(data.get("force_reload", False) or data.get("bypass_cache", False))
            user_name = data.get("user_name") or "Máy khách"

            # Kiểm tra tài liệu đã tồn tại trong downloads (< 100ms instant cache hit)
            if not force_reload:
                for p in DOWNLOADS_DIR.glob("*.pdf"):
                    if not p.is_file() or p.stat().st_size <= 50000:
                        continue
                    stem = p.stem
                    if stem.endswith(f"_{doc_id}") or stem.startswith(f"{doc_id}_") or f"_{doc_id}_" in stem or stem == str(doc_id):
                        size_bytes = p.stat().st_size
                        page_count = 1
                        try:
                            import pymupdf
                            with pymupdf.open(p) as doc:
                                page_count = doc.page_count
                        except Exception:
                            pass
                        cached_result = {
                            "id": doc_id,
                            "name": p.name,
                            "title": p.stem.replace(f"_{doc_id}", "").replace("_", " "),
                            "pages": page_count,
                            "size_bytes": size_bytes,
                            "size_mb": round(size_bytes / (1024 * 1024), 2),
                            "from_cache": True,
                        }
                        cached_job_id = f"cached_{doc_id}"
                        JOBS[cached_job_id] = {
                            "id": cached_job_id,
                            "status": "completed",
                            "progress": 100,
                            "step_label": f"Tài liệu đã có sẵn trên máy chủ ({page_count} trang)",
                            "logs": [f"⚡ Tài liệu đã có sẵn trong kho lưu trữ: {p.name}"],
                            "result": cached_result,
                        }
                        self.send_response(HTTPStatus.OK)
                        self.send_cors_headers()
                        self.send_header("Content-Type", "application/json; charset=utf-8")
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            "success": True,
                            "from_cache": True,
                            "job_id": cached_job_id,
                            "status": "completed",
                            "result": cached_result,
                        }).encode("utf-8"))
                        return

            job_id = create_job(url, user_name)
            run_archive_job(job_id, url, force_reload=force_reload, user_name=user_name)

            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "job_id": job_id}).encode("utf-8"))
            return

        # 2. Hủy job: /api/cancel/<job_id>
        if path.startswith("/api/cancel/"):
            job_id = path.replace("/api/cancel/", "").strip()
            ok = cancel_job(job_id)
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": ok}).encode("utf-8"))
            return

        # 3. Phục hồi từ thùng rác: /api/trash/restore/<filename>
        if path.startswith("/api/trash/restore/"):
            raw_param = path.replace("/api/trash/restore/", "").strip()
            trash_path = find_file_in_dir(TRASH_DIR, raw_param)
            if trash_path and trash_path.is_file():
                DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
                dest = DOWNLOADS_DIR / trash_path.name
                if dest.exists():
                    dest.unlink()
                shutil.move(str(trash_path), str(dest))
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "restored": trash_path.name}).encode("utf-8"))
                return
            self.send_response(HTTPStatus.NOT_FOUND)
            self.send_cors_headers()
            self.end_headers()
            return

        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_cors_headers()
        self.end_headers()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Chuyển vào thùng rác: /api/files/<filename>
        if path.startswith("/api/files/"):
            raw_param = path.replace("/api/files/", "").strip()
            # Hỗ trợ chuyển tất cả tài liệu vào thùng rác
            if raw_param in ("all", "trash-all"):
                TRASH_DIR.mkdir(parents=True, exist_ok=True)
                trashed_count = 0
                if DOWNLOADS_DIR.is_dir():
                    for f in list(DOWNLOADS_DIR.glob("*.pdf")):
                        try:
                            dest = TRASH_DIR / f.name
                            if dest.exists():
                                dest.unlink()
                            shutil.move(str(f), str(dest))
                            trashed_count += 1
                        except Exception:
                            pass
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "count": trashed_count, "message": "Đã chuyển tất cả vào thùng rác"}).encode("utf-8"))
                return

            file_path = find_file_in_dir(DOWNLOADS_DIR, raw_param)
            if file_path and file_path.is_file():
                TRASH_DIR.mkdir(parents=True, exist_ok=True)
                dest = TRASH_DIR / file_path.name
                if dest.exists():
                    dest.unlink()
                shutil.move(str(file_path), str(dest))
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "trashed": file_path.name}).encode("utf-8"))
                return
            self.send_response(HTTPStatus.NOT_FOUND)
            self.send_cors_headers()
            self.end_headers()
            return

        # 2. Xóa vĩnh viễn: /api/trash/<filename>
        if path.startswith("/api/trash/"):
            raw_param = path.replace("/api/trash/", "").strip()
            if raw_param in ("empty", ""):
                if TRASH_DIR.is_dir():
                    for f in TRASH_DIR.glob("*.pdf"):
                        try:
                            f.unlink()
                        except Exception:
                            pass
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Thùng rác đã được dọn sạch"}).encode("utf-8"))
                return

            trash_path = find_file_in_dir(TRASH_DIR, raw_param)
            if trash_path and trash_path.is_file():
                deleted_name = trash_path.name
                trash_path.unlink()
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "deleted": deleted_name}).encode("utf-8"))
                return

            self.send_response(HTTPStatus.NOT_FOUND)
            self.send_cors_headers()
            self.end_headers()
            return

        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_cors_headers()
        self.end_headers()
