# -*- coding: utf-8 -*-
"""
studocu_dl
==========
Studocu Downloader - Thư viện và CLI tải tài liệu Studocu chất lượng cao sang PDF A4 Vector & Markdown.
"""

__version__ = "2.2.0"

from .engine import StudocuDownloader
from .cli import main
from .browser_manager import BrowserSessionManager

__all__ = ["StudocuDownloader", "main", "BrowserSessionManager", "__version__"]
