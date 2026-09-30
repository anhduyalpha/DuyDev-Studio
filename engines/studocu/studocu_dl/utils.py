# -*- coding: utf-8 -*-
"""
studocu_dl.utils
================
Các hàm tiện ích dùng chung: chuẩn hóa URL, làm sạch tên file, cấp phát port.
"""

import re
import socket


def normalize_url(raw_url: str) -> str:
    """Đảm bảo URL có tiền tố giao thức http:// hoặc https://."""
    url = raw_url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
    return url


def sanitize_filename(name: str, max_length: int = 150) -> str:
    """Làm sạch tên file để lưu trữ hợp lệ trên Windows/Linux/macOS."""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = name.rstrip(". ")
    if not name:
        name = "studocu_document"
    return name[:max_length]


def find_free_port() -> int:
    """Tìm một cổng TCP khả dụng trên localhost cho CDP."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
