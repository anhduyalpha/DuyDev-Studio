# -*- coding: utf-8 -*-
"""
studocu_dl.config
=================
Cấu hình hệ thống, đường dẫn thư mục và môi trường thực thi.
"""

import os
import time
from pathlib import Path

# Thiết lập múi giờ Việt Nam
if hasattr(time, "tzset"):
    if "TZ" not in os.environ:
        os.environ["TZ"] = "Asia/Ho_Chi_Minh"
    try:
        time.tzset()
    except Exception:
        pass

BASE_DIR = Path(__file__).parent.resolve()

DOWNLOADS_DIR = (
    Path("/app/downloads").resolve()
    if Path("/app/downloads").exists()
    else (BASE_DIR.parent / "downloads").resolve()
)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

TRASH_DIR = DOWNLOADS_DIR / ".trash"
TRASH_DIR.mkdir(parents=True, exist_ok=True)

CACHE_DIR = DOWNLOADS_DIR / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SESSION_DIR = DOWNLOADS_DIR / ".session"
SESSION_DIR.mkdir(parents=True, exist_ok=True)

STATIC_DIR = (
    (BASE_DIR / "static").resolve()
    if (BASE_DIR / "static").exists()
    else Path("/app/static").resolve()
)
STATIC_DIR.mkdir(parents=True, exist_ok=True)

TEMPLATES_DIR = (
    (BASE_DIR / "templates").resolve()
    if (BASE_DIR / "templates").exists()
    else Path("/app/templates").resolve()
)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

PDFJS_DIR = (
    (BASE_DIR / "pdfjs").resolve()
    if (BASE_DIR / "pdfjs").exists()
    else Path("/app/pdfjs").resolve()
)
