# -*- coding: utf-8 -*-
"""
studocu_dl.server
==================
Điểm khởi động máy chủ Web UI và REST API cho Studocu Downloader.
Kiến trúc mô-đun: nạp cấu hình từ .config, handlers từ .handlers, job worker từ .job_worker.
"""

import argparse
import sys
from http.server import ThreadingHTTPServer

from .browser_manager import BrowserSessionManager
from .config import DOWNLOADS_DIR, PDFJS_DIR, STATIC_DIR, TEMPLATES_DIR
from .handlers import StudocuHTTPRequestHandler
from .job_worker import JOBS, run_download_job, cancel_job
from .stream_utils import (
    DOC_ID_MAP,
    get_doc_id,
    parse_byte_range,
    resolve_file_from_request,
    resolve_filename_by_doc_id,
)

__all__ = [
    "run_server",
    "main",
    "StudocuHTTPRequestHandler",
    "DOWNLOADS_DIR",
    "STATIC_DIR",
    "TEMPLATES_DIR",
    "PDFJS_DIR",
    "JOBS",
    "run_download_job",
    "cancel_job",
    "get_doc_id",
    "resolve_filename_by_doc_id",
    "resolve_file_from_request",
    "parse_byte_range",
    "DOC_ID_MAP",
]


def run_server(host: str = "0.0.0.0", port: int = 8090) -> None:
    """Khởi chạy HTTP Server."""
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, StudocuHTTPRequestHandler)
    print("==================================================", flush=True)
    print("  🚀 Studocu Downloader Web UI & Server Started", flush=True)
    print(f"  🌐 URL: http://{host}:{port}", flush=True)
    print("==================================================", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang dừng server...", flush=True)
        httpd.server_close()
        try:
            BrowserSessionManager.get_instance().stop_all()
        except Exception:
            pass


def main() -> None:
    """Điểm vào thực thi khi chạy: python -m studocu_dl.server"""
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="Studocu Downloader Web Server")
    parser.add_argument("--host", default="0.0.0.0", help="Địa chỉ host bind (mặc định: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8090, help="Cổng chạy web server (mặc định: 8090)")
    args = parser.parse_args()
    run_server(args.host, args.port)


if __name__ == "__main__":
    main()
