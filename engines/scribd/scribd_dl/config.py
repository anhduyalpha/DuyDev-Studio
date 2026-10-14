# -*- coding: utf-8 -*-
"""
scribd_dl.config
================
Configuration & directory paths for Scribd Document Archiver.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DOWNLOADS_DIR = BASE_DIR / "downloads"
TRASH_DIR = DOWNLOADS_DIR / ".trash"

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
TRASH_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PORT = int(os.environ.get("SCRIBD_PORT", 8091))
DEFAULT_HOST = os.environ.get("SCRIBD_HOST", "0.0.0.0")
