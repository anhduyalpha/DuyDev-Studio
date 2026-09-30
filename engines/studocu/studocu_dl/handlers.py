# -*- coding: utf-8 -*-
"""
studocu_dl.handlers
===================
Bộ định tuyến và xử lý các yêu cầu HTTP (HTTP Request Handlers) cho Web UI và REST API.
"""

import json
import os
import shutil
import threading
import time
import urllib.parse
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

from .browser_manager import BrowserSessionManager
from .config import DOWNLOADS_DIR, PDFJS_DIR, SESSION_DIR, STATIC_DIR, TEMPLATES_DIR, TRASH_DIR
from .job_worker import JOBS, run_download_job, cancel_job
from .storage import DocumentStore, parse_device_info
from .stream_utils import (
    get_doc_id,
    parse_byte_range,
    resolve_file_from_request,
)


class StudocuHTTPRequestHandler(SimpleHTTPRequestHandler):
    """Xử lý các HTTP request cho Web UI và REST API."""

    def log_message(self, format, *args):
        # In log truy cập HTTP ra console để theo dõi request thời gian thực
        print(f"[HTTP] {self.address_string()} - {format % args}", flush=True)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")

    def send_no_cache_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_cors_headers()
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_HEAD(self):
        self._handle_get_or_head(is_head=True)

    def do_GET(self):
        self._handle_get_or_head(is_head=False)

    def _handle_get_or_head(self, is_head: bool):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Trang chủ Web UI
        if path in ("/", "/index.html"):
            index_path = TEMPLATES_DIR / "index.html"
            if index_path.is_file():
                encoded = index_path.read_bytes()
            else:
                encoded = b"<h1>Studocu Downloader</h1><p>index.html not found</p>"
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 2. Redirect Viewer
        if path == "/viewer":
            query_params = urllib.parse.parse_qs(parsed.query)
            doc_id = query_params.get("id", [""])[0].strip()
            file_param = query_params.get("file", [""])[0].strip()
            if doc_id:
                stream_target = f"/api/document-stream?id={doc_id}"
                dest = f"/pdfjs/web/viewer.html?file={urllib.parse.quote(stream_target, safe='')}"
            elif file_param:
                clean_param = (
                    file_param.replace("/view/", "")
                    .replace("/downloads/", "")
                    .replace("/api/pdf-stream?file=", "")
                    .replace("/api/document-stream?file=", "")
                )
                clean_param = urllib.parse.unquote(clean_param)
                did = get_doc_id(clean_param)
                stream_target = f"/api/document-stream?id={did}"
                dest = f"/pdfjs/web/viewer.html?file={urllib.parse.quote(stream_target, safe='')}"
            else:
                dest = "/pdfjs/web/viewer.html"
            self.send_response(HTTPStatus.FOUND)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Location", dest)
            self.end_headers()
            return

        # 3. Static Files (/static/*)
        if path.startswith("/static/"):
            clean_name = path.replace("/static/", "").split("?")[0]
            filename = urllib.parse.unquote(clean_name)
            file_path = STATIC_DIR / filename
            try:
                file_path.resolve().relative_to(STATIC_DIR.resolve())
            except ValueError:
                self.send_error(HTTPStatus.FORBIDDEN, "Access denied")
                return
            if file_path.is_file():
                ext = file_path.suffix.lower()
                if ext == ".js":
                    content_type = "application/javascript"
                elif ext in (".wav", ".wave"):
                    content_type = "audio/wav"
                elif ext == ".mp3":
                    content_type = "audio/mpeg"
                elif ext == ".css":
                    content_type = "text/css"
                elif ext in (".png", ".jpg", ".jpeg"):
                    content_type = f"image/{ext.replace('.', '')}"
                elif ext == ".svg":
                    content_type = "image/svg+xml"
                else:
                    content_type = "application/octet-stream"
                data = file_path.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=31536000")
                self.end_headers()
                if not is_head:
                    self.wfile.write(data)
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                return

        # 4. PDF.js Files (/pdfjs/*)
        if path.startswith("/pdfjs/"):
            clean_name = path.replace("/pdfjs/", "").split("?")[0]
            filename = urllib.parse.unquote(clean_name)
            file_path = PDFJS_DIR / filename
            try:
                file_path.resolve().relative_to(PDFJS_DIR.resolve())
            except ValueError:
                self.send_error(HTTPStatus.FORBIDDEN, "Access denied")
                return
            if file_path.is_file():
                ext = file_path.suffix.lower()
                if ext == ".html":
                    content_type = "text/html; charset=utf-8"
                elif ext in (".js", ".mjs"):
                    content_type = "application/javascript"
                elif ext == ".css":
                    content_type = "text/css"
                elif ext == ".svg":
                    content_type = "image/svg+xml"
                elif ext == ".png":
                    content_type = "image/png"
                elif ext in (".json", ".properties", ".ftl"):
                    content_type = "text/plain; charset=utf-8"
                else:
                    content_type = "application/octet-stream"

                data = file_path.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                if not is_head:
                    self.wfile.write(data)
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                return

        # 5. REST API: Job Status (/api/status/<job_id>, /api/job-status, /api/status?id=...)
        if (
            path.startswith("/api/status/")
            or path.startswith("/api/job-status/")
            or path in ("/api/status", "/api/job-status")
        ):
            job_id = ""
            if path.startswith("/api/status/"):
                job_id = path.replace("/api/status/", "").strip()
            elif path.startswith("/api/job-status/"):
                job_id = path.replace("/api/job-status/", "").strip()

            if not job_id:
                query_params = urllib.parse.parse_qs(parsed.query)
                job_id = query_params.get("id", [""])[0].strip() or query_params.get("job_id", [""])[0].strip()

            job = JOBS.get(job_id) if job_id else None
            if job:
                safe_job = {k: v for k, v in job.items() if k != "downloader"}
                encoded = json.dumps(safe_job, default=str).encode("utf-8")
            else:
                encoded = json.dumps({"error": "Job not found"}).encode("utf-8")
            self.send_response(HTTPStatus.OK if job else HTTPStatus.NOT_FOUND)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 6. REST API: Document Stream (/api/document-stream, /api/pdf-stream)
        if path in ("/api/document-stream", "/api/pdf-stream"):
            query_params = urllib.parse.parse_qs(parsed.query)
            file_path = resolve_file_from_request(query_params, DOWNLOADS_DIR)
            if not file_path:
                self.send_error(HTTPStatus.NOT_FOUND, "Document not found")
                return

            file_size = file_path.stat().st_size
            range_header = self.headers.get("Range")
            range_tuple = None
            if range_header:
                range_tuple = parse_byte_range(range_header, file_size)
                if range_tuple is None and range_header.startswith("bytes="):
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{file_size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return

            if range_tuple:
                start, end = range_tuple
                content_length = end - start + 1
                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            else:
                start, end = 0, file_size - 1
                content_length = file_size
                self.send_response(HTTPStatus.OK)

            self.send_cors_headers()
            # HARDENED LOCK: Always send application/pdf and pure inline disposition.
            # Never use application/x-viewer-data (which causes browsers to auto-download the stream).
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(content_length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "public, max-age=86400")
            self.send_header("Content-Disposition", "inline")
            self.end_headers()

            if not is_head:
                try:
                    with open(file_path, "rb") as f:
                        f.seek(start)
                        remaining = content_length
                        while remaining > 0:
                            chunk_size = min(65536, remaining)
                            chunk = f.read(chunk_size)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            remaining -= len(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            return

        # 7. REST API: Danh sách files (/api/files) qua DocumentStore
        if path == "/api/files":
            files = DocumentStore.get_instance().list_documents()
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

        # 7b. REST API: Danh sách files trong Thùng rác (/api/trash) qua DocumentStore
        if path == "/api/trash":
            trashed = DocumentStore.get_instance().list_trash()
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

        # 8. REST API: Reset Browser Session (/api/reset-session)
        if path == "/api/reset-session":
            browser_manager = BrowserSessionManager.get_instance(
                port=9222,
                profile_dir=str(SESSION_DIR),
            )
            try:
                browser_manager.reset_session()
                msg = "Đã dọn sạch session và khởi động lại trình duyệt sạch thành công."
            except Exception as e:
                msg = f"Đã dọn dẹp với thông báo: {e}"

            encoded = json.dumps({"ok": True, "message": msg}, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            if not is_head:
                self.wfile.write(encoded)
            return

        # 9. Tự động chuyển hướng yêu cầu xem file PDF trực tiếp sang bộ đọc Anti-IDM
        if path.startswith("/view/"):
            clean_name = path.replace("/view/", "").split("?")[0]
            filename = urllib.parse.unquote(clean_name)
            if filename.lower().endswith(".pdf"):
                doc_id = get_doc_id(filename)
                dest = f"/pdfjs/web/viewer.html?file={urllib.parse.quote(f'/api/document-stream?id={doc_id}', safe='')}"
                self.send_response(HTTPStatus.FOUND)
                self.send_cors_headers()
                self.send_no_cache_headers()
                self.send_header("Location", dest)
                self.end_headers()
                return

        # 10. File downloads và view thô
        if path.startswith("/downloads/") or path.startswith("/view/"):
            is_view = path.startswith("/view/")
            clean_name = path.replace("/view/", "").replace("/downloads/", "").split("?")[0]
            filename = urllib.parse.unquote(clean_name)
            file_path = DOWNLOADS_DIR / filename
            try:
                file_path.resolve().relative_to(DOWNLOADS_DIR.resolve())
            except ValueError:
                self.send_error(HTTPStatus.FORBIDDEN, "Access denied")
                return

            if not file_path.is_file():
                filename_double = urllib.parse.unquote(filename)
                if (DOWNLOADS_DIR / filename_double).is_file():
                    file_path = DOWNLOADS_DIR / filename_double
                    filename = filename_double
                else:
                    self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                    return

            file_size = file_path.stat().st_size

            if filename.lower().endswith(".pdf"):
                content_type = "application/pdf"
            elif filename.lower().endswith(".md"):
                content_type = "text/plain; charset=utf-8"
            else:
                content_type = "application/octet-stream"

            range_header = self.headers.get("Range")
            range_tuple = None
            if range_header:
                range_tuple = parse_byte_range(range_header, file_size)
                if range_tuple is None and range_header.startswith("bytes="):
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{file_size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return

            if range_tuple:
                start, end = range_tuple
                content_length = end - start + 1
                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            else:
                start, end = 0, file_size - 1
                content_length = file_size
                self.send_response(HTTPStatus.OK)

            self.send_cors_headers()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(content_length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "public, max-age=86400")

            if is_view:
                self.send_header("Content-Disposition", "inline")
            else:
                quoted = urllib.parse.quote(filename)
                ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or "document"
                self.send_header(
                    "Content-Disposition",
                    f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quoted}',
                )

            self.end_headers()

            if not is_head:
                try:
                    with open(file_path, "rb") as f:
                        f.seek(start)
                        remaining = content_length
                        while remaining > 0:
                            chunk_size = min(65536, remaining)
                            chunk = f.read(chunk_size)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            remaining -= len(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/download":
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(raw_body)
            except Exception:
                self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
                return

            url = (data.get("url") or "").strip()
            if not url:
                self.send_response(HTTPStatus.BAD_REQUEST)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "URL không được để trống"}).encode("utf-8"))
                return

            fmt = data.get("format") or data.get("fmt", "pdf")
            timeout = int(data.get("timeout", 60))
            raw_cookie = data.get("cookie") or None
            force_reload = bool(data.get("force_reload", False) or data.get("bypass_cache", False))

            # Rút trích thông tin người tải (IP, Thiết bị, Tên tuỳ chọn)
            client_ip = self.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            if not client_ip:
                client_ip = self.client_address[0] if self.client_address else "127.0.0.1"
            user_agent = self.headers.get("User-Agent", "")
            device_summary = parse_device_info(user_agent)
            raw_user_name = (data.get("user_name") or data.get("downloaded_by") or "").strip()
            if not raw_user_name:
                display_name = "Máy khách" if client_ip in ("127.0.0.1", "localhost", "::1") else client_ip
            else:
                display_name = raw_user_name

            downloaded_by = {
                "name": display_name,
                "ip": client_ip,
                "device": device_summary,
            }

            cookie = None
            initial_logs = [
                f"🚀 Tiếp nhận yêu cầu tải: {url}",
                f"🎯 Định dạng: {fmt.upper()} • Người tải: {downloaded_by['name']} ({device_summary})"
            ]
            if force_reload:
                initial_logs.append("🔄 Chế độ tải mới (Bỏ qua bộ nhớ đệm Cache)")

            if raw_cookie:
                has_auth = (
                    "cf_clearance=" in raw_cookie
                    or "studocu_session=" in raw_cookie
                    or "laravel_session=" in raw_cookie
                )
                if has_auth:
                    cookie = raw_cookie
                    initial_logs.append("🔑 Nhận diện bộ Cookie xác thực từ người dùng!")
                else:
                    initial_logs.append("🤖 Bỏ qua cookie thiếu HttpOnly, chạy chế độ AI Auto-Solver tự động hoàn toàn!")

            job_id = uuid.uuid4().hex[:8]
            JOBS[job_id] = {
                "id": job_id,
                "status": "running",
                "logs": initial_logs,
                "progress": {
                    "phase": "init",
                    "current_page": 0,
                    "total_pages": 0,
                    "percent": 5,
                    "message": "Đang kết nối tới máy chủ...",
                },
                "result": None,
                "error": None,
                "created_at": time.time(),
                "downloaded_by": downloaded_by,
            }

            # Khởi động luồng tải ngầm
            t = threading.Thread(
                target=run_download_job,
                args=(job_id, url, fmt, timeout, cookie, DOWNLOADS_DIR, force_reload, downloaded_by),
                daemon=True,
            )
            t.start()

            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"job_id": job_id}).encode("utf-8"))
            return

        elif path.startswith("/api/cancel/") or path in ("/api/cancel", "/api/cancel/"):
            job_id = ""
            if path.startswith("/api/cancel/"):
                job_id = path.replace("/api/cancel/", "").split("?")[0].strip()

            if not job_id:
                length = int(self.headers.get("Content-Length", 0))
                if length > 0:
                    try:
                        raw_body = self.rfile.read(length).decode("utf-8")
                        cdata = json.loads(raw_body)
                        job_id = cdata.get("job_id") or cdata.get("id", "")
                    except Exception:
                        pass

            if not job_id:
                qp = urllib.parse.parse_qs(parsed.query)
                job_id = qp.get("id", [""])[0].strip() or qp.get("job_id", [""])[0].strip()

            ok = cancel_job(job_id) if job_id else False
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": ok, "job_id": job_id, "status": "cancelled" if ok else "not_found"}).encode("utf-8"))
            return

        elif path == "/api/reset-session":
            browser_manager = BrowserSessionManager.get_instance(
                port=9222,
                profile_dir=str(SESSION_DIR),
            )
            try:
                browser_manager.reset_session()
                msg = "Đã dọn sạch session và khởi động lại trình duyệt sạch thành công."
            except Exception as e:
                msg = f"Đã dọn dẹp với thông báo: {e}"

            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "message": msg}, ensure_ascii=False).encode("utf-8"))
            return

        elif path.startswith("/api/trash/restore/"):
            filename = urllib.parse.unquote(path.replace("/api/trash/restore/", ""))
            ok = DocumentStore.get_instance().restore_from_trash(filename)
            if ok:
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.send_no_cache_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "action": "restored", "file": filename}, ensure_ascii=False).encode("utf-8"))
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "File not found in trash")
                return

        elif path == "/api/trash/empty":
            count = DocumentStore.get_instance().empty_trash()
            self.send_response(HTTPStatus.OK)
            self.send_cors_headers()
            self.send_no_cache_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "action": "emptied", "count": count}, ensure_ascii=False).encode("utf-8"))
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Soft delete: Chuyển file vào Thùng rác (.trash) qua DocumentStore
        if path.startswith("/api/files/"):
            filename = urllib.parse.unquote(path.replace("/api/files/", ""))
            client_ip = self.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (self.client_address[0] if self.client_address else "127.0.0.1")
            ok = DocumentStore.get_instance().move_to_trash(filename, deleted_by=client_ip)
            if ok:
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.send_no_cache_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "action": "trashed", "file": filename}, ensure_ascii=False).encode("utf-8"))
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                return

        # 2. Xóa vĩnh viễn file trong Thùng rác hoặc Dọn sạch thùng rác
        if path.startswith("/api/trash/"):
            filename = urllib.parse.unquote(path.replace("/api/trash/", ""))
            if not filename or filename == "empty":
                count = DocumentStore.get_instance().empty_trash()
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.send_no_cache_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "action": "emptied", "count": count}, ensure_ascii=False).encode("utf-8"))
                return

            ok = DocumentStore.get_instance().delete_permanent(filename)
            if ok:
                self.send_response(HTTPStatus.OK)
                self.send_cors_headers()
                self.send_no_cache_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "action": "deleted_permanently", "file": filename}, ensure_ascii=False).encode("utf-8"))
                return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "File not found in trash")
                return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")
