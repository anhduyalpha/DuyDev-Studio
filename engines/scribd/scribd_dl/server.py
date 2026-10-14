# -*- coding: utf-8 -*-
"""
scribd_dl.server
================
Entry point for Scribd Document Archiver Web Server & REST API.
"""

from __future__ import annotations

import argparse
import sys
from http.server import ThreadingHTTPServer

from .config import DEFAULT_HOST, DEFAULT_PORT, DOWNLOADS_DIR, TRASH_DIR
from .handlers import ScribdHTTPRequestHandler


def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """Khởi chạy HTTP Server cho Scribd Archiver."""
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    TRASH_DIR.mkdir(parents=True, exist_ok=True)

    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, ScribdHTTPRequestHandler)
    print("==================================================", flush=True)
    print("  🚀 Scribd Document Archiver Engine Started", flush=True)
    print(f"  🌐 URL: http://{host}:{port}", flush=True)
    print("==================================================", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang dừng Scribd Archiver server...", flush=True)
        httpd.server_close()


def main() -> None:
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Scribd Document Archiver Engine Server")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Địa chỉ host bind (mặc định: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Cổng chạy server (mặc định: {DEFAULT_PORT})")
    args = parser.parse_args()
    run_server(args.host, args.port)


if __name__ == "__main__":
    main()
