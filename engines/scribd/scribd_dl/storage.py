# -*- coding: utf-8 -*-
"""
scribd_dl.storage
=================
Storage & metadata management for Scribd Document Archiver.
Tracks authentic downloader identities (name, IP, device) across active files and trash.
Thread-safe, atomic write with self-healing fallback.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from .config import DOWNLOADS_DIR, TRASH_DIR

METADATA_FILE = DOWNLOADS_DIR / ".metadata.json"
TRASH_META_FILE = TRASH_DIR / ".trash_meta.json"

STORE_LOCK = threading.RLock()


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"files": {}}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                if "files" not in data:
                    data["files"] = {}
                return data
            return {"files": {}}
    except Exception:
        return {"files": {}}


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
    except Exception as e:
        print(f"[Scribd Storage] Lỗi lưu {path}: {e}", flush=True)


def compute_fallback_downloader(seed: str) -> Dict[str, str]:
    """Tạo thông tin người tải mặc định định danh theo hash nếu thiếu metadata."""
    if not seed:
        seed = "scribd_guest"
    h = hashlib.md5(seed.encode("utf-8")).hexdigest()[:6]
    return {
        "name": f"Khách #{h}",
        "ip": "127.0.0.1",
        "device": "Web",
    }


def save_file_metadata(
    filename: str,
    doc_id: str = "",
    title: str = "",
    size_bytes: int = 0,
    pages: Optional[int] = None,
    downloaded_by: Optional[Dict[str, str]] = None,
) -> None:
    """Lưu metadata người tải và thuộc tính tệp vào .metadata.json."""
    with STORE_LOCK:
        data = _read_json(METADATA_FILE)
        files = data.setdefault("files", {})

        now = time.time()
        mod_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))

        dl = downloaded_by or compute_fallback_downloader(doc_id or filename)
        # Chuẩn hóa nếu name trống hoặc là IP Docker ảo
        if not dl.get("name") or dl.get("name") in ("172.18.0.1", "127.0.0.1", "localhost", "Scribd Archiver"):
            dl["name"] = compute_fallback_downloader(doc_id or filename)["name"]

        files[filename] = {
            "id": doc_id,
            "name": filename,
            "title": title or filename,
            "format": "pdf",
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / (1024 * 1024), 2) if size_bytes else 0,
            "pages": pages,
            "mtime": now,
            "time": mod_time,
            "downloaded_by": dl,
            "status": "active",
        }
        _write_json(METADATA_FILE, data)


def get_file_downloader(filename: str, doc_id: str = "") -> Dict[str, str]:
    """Truy vấn thông tin người tải của tệp active."""
    with STORE_LOCK:
        data = _read_json(METADATA_FILE)
        files = data.get("files", {})
        entry = files.get(filename)
        if entry and isinstance(entry.get("downloaded_by"), dict):
            dl = dict(entry["downloaded_by"])
            if dl.get("name") and dl["name"] not in ("172.18.0.1", "127.0.0.1", "localhost", "Scribd Archiver"):
                return dl
        return compute_fallback_downloader(doc_id or filename)


def get_trash_downloader(filename: str, doc_id: str = "") -> Dict[str, str]:
    """Truy vấn thông tin người tải của tệp trong thùng rác."""
    with STORE_LOCK:
        data = _read_json(TRASH_META_FILE)
        files = data.get("files", {})
        entry = files.get(filename)
        if entry and isinstance(entry.get("downloaded_by"), dict):
            dl = dict(entry["downloaded_by"])
            if dl.get("name") and dl["name"] not in ("172.18.0.1", "127.0.0.1", "localhost", "Scribd Archiver"):
                return dl
        return compute_fallback_downloader(doc_id or filename)


def move_to_trash_metadata(filename: str) -> None:
    """Chuyển metadata của tệp từ .metadata.json sang .trash_meta.json."""
    with STORE_LOCK:
        active_data = _read_json(METADATA_FILE)
        active_files = active_data.get("files", {})

        trash_data = _read_json(TRASH_META_FILE)
        trash_files = trash_data.setdefault("files", {})

        entry = active_files.pop(filename, None)
        if entry:
            entry["status"] = "trashed"
            entry["trashed_at"] = time.time()
            trash_files[filename] = entry
        else:
            trash_files[filename] = {
                "name": filename,
                "status": "trashed",
                "trashed_at": time.time(),
                "downloaded_by": compute_fallback_downloader(filename),
            }

        _write_json(METADATA_FILE, active_data)
        _write_json(TRASH_META_FILE, trash_data)


def move_all_to_trash_metadata() -> None:
    """Chuyển toàn bộ metadata active sang .trash_meta.json."""
    with STORE_LOCK:
        active_data = _read_json(METADATA_FILE)
        active_files = active_data.get("files", {})

        trash_data = _read_json(TRASH_META_FILE)
        trash_files = trash_data.setdefault("files", {})

        now = time.time()
        for fname, entry in list(active_files.items()):
            entry["status"] = "trashed"
            entry["trashed_at"] = now
            trash_files[fname] = entry

        active_data["files"] = {}
        _write_json(METADATA_FILE, active_data)
        _write_json(TRASH_META_FILE, trash_data)


def restore_from_trash_metadata(filename: str) -> None:
    """Khôi phục metadata từ .trash_meta.json về .metadata.json."""
    with STORE_LOCK:
        trash_data = _read_json(TRASH_META_FILE)
        trash_files = trash_data.get("files", {})

        active_data = _read_json(METADATA_FILE)
        active_files = active_data.setdefault("files", {})

        entry = trash_files.pop(filename, None)
        if entry:
            entry["status"] = "active"
            entry["restored_at"] = time.time()
            active_files[filename] = entry

        _write_json(TRASH_META_FILE, trash_data)
        _write_json(METADATA_FILE, active_data)


def delete_permanent_metadata(filename: str) -> None:
    """Xóa vĩnh viễn metadata của tệp."""
    with STORE_LOCK:
        trash_data = _read_json(TRASH_META_FILE)
        trash_files = trash_data.get("files", {})
        if filename in trash_files:
            del trash_files[filename]
            _write_json(TRASH_META_FILE, trash_data)


def empty_trash_metadata() -> None:
    """Dọn sạch toàn bộ metadata trong thùng rác."""
    with STORE_LOCK:
        trash_data = {"files": {}}
        _write_json(TRASH_META_FILE, trash_data)
