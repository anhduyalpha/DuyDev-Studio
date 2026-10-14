# -*- coding: utf-8 -*-
"""
scribd_dl
=========
Scribd Document Archiver package for DuyDev Studio.
Uses Playwright Chromium Embed View rendering and PyMuPDF vector normalization.
"""

from .config import DOWNLOADS_DIR, TRASH_DIR
from .engine import ScribdArchiver, extract_scribd_doc_id
from .job_worker import JOBS, run_archive_job, cancel_job

__all__ = [
    "DOWNLOADS_DIR",
    "TRASH_DIR",
    "ScribdArchiver",
    "extract_scribd_doc_id",
    "JOBS",
    "run_archive_job",
    "cancel_job",
]
