# -*- coding: utf-8 -*-
"""
studocu_dl.storage
==================
Hệ thống quản lý lưu trữ tệp tin chuyên nghiệp (DocumentStore).
- Tách biệt rõ ràng tệp tài liệu (.pdf, .md), cache (.cache), session (.session), thùng rác (.trash).
- Quản lý siêu dữ liệu tập trung (.metadata.json) đồng bộ, thread-safe, atomic write.
- Cơ chế tự phục hồi (Self-Healing): tự động lập chỉ mục tệp mới và dọn tệp mồ côi.
- Lưu trữ và truy vấn thông tin người tải (Tên / IP / Thiết bị).
"""

import json
import os
import shutil
import tempfile
import threading
import time
import unicodedata
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import CACHE_DIR, DOWNLOADS_DIR, SESSION_DIR, TRASH_DIR
from .stream_utils import get_doc_id

METADATA_FILE = DOWNLOADS_DIR / ".metadata.json"
TRASH_META_FILE = TRASH_DIR / ".trash_meta.json"

STORE_LOCK = threading.RLock()


def format_bytes(size_bytes: int) -> str:
    """Định dạng kích thước byte sang KB hoặc MB."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    size_kb = size_bytes / 1024
    if size_kb >= 1024:
        return f"{size_kb / 1024:.2f} MB"
    return f"{size_kb:.1f} KB"


def parse_device_info(user_agent: str) -> str:
    """Rút trích thông tin thiết bị và trình duyệt gọn gàng từ User-Agent."""
    if not user_agent:
        return "Trình duyệt Web"
    ua = user_agent.lower()

    # OS detection
    os_name = "Thiết bị"
    if "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "android" in ua:
        os_name = "Android"
    elif "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"

    # Browser detection
    browser_name = "Web"
    if "edg/" in ua or "edge/" in ua:
        browser_name = "Edge"
    elif "chrome/" in ua:
        browser_name = "Chrome"
    elif "safari/" in ua and "chrome" not in ua:
        browser_name = "Safari"
    elif "firefox/" in ua:
        browser_name = "Firefox"
    elif "crios/" in ua:
        browser_name = "Chrome"

    return f"{os_name} • {browser_name}"


class DocumentStore:
    """Lớp quản lý lưu trữ và siêu dữ liệu tài liệu."""

    _instance = None

    @classmethod
    def get_instance(cls) -> "DocumentStore":
        with STORE_LOCK:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def __init__(self, root_dir: Path = DOWNLOADS_DIR):
        self.root_dir = root_dir
        self.trash_dir = TRASH_DIR
        self.cache_dir = CACHE_DIR
        self.session_dir = SESSION_DIR
        self.metadata_file = METADATA_FILE

        self._ensure_dirs()
        self._load_metadata()

    def _ensure_dirs(self):
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.trash_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.session_dir.mkdir(parents=True, exist_ok=True)

    def _load_metadata(self) -> Dict[str, Any]:
        """Đọc file metadata master an toàn."""
        if not self.metadata_file.exists():
            return {"files": {}, "version": 2}
        try:
            with open(self.metadata_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    return {"files": {}, "version": 2}
                if "files" not in data:
                    data["files"] = {}
                return data
        except Exception as e:
            print(f"[DocumentStore] Lỗi đọc {self.metadata_file}: {e}, khởi tạo mới.", flush=True)
            return {"files": {}, "version": 2}

    def _save_metadata(self, data: Dict[str, Any]):
        """Ghi metadata atomic để chống hỏng file khi mất điện hoặc ghi đồng thời."""
        try:
            temp_path = self.metadata_file.with_suffix(".tmp")
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(temp_path, self.metadata_file)
        except Exception as e:
            print(f"[DocumentStore] Lỗi lưu {self.metadata_file}: {e}", flush=True)

    def _sync_and_heal(self, data: Dict[str, Any]) -> bool:
        """
        Cơ chế tự phục hồi (Self-Healing):
        - Quét đĩa để bổ sung các file chưa có trong metadata.
        - Xóa khỏi metadata các file không còn tồn tại trên đĩa.
        """
        changed = False
        files_map = data.setdefault("files", {})

        # 1. Quét các file thực tế trên đĩa
        actual_files = set()
        for item in self.root_dir.glob("*.*"):
            if item.is_file() and not item.name.startswith(".") and item.suffix.lower() in (".pdf", ".md"):
                actual_files.add(item.name)
                if item.name not in files_map:
                    # Tự động nạp file mới tìm thấy
                    stat = item.stat()
                    size_bytes = stat.st_size
                    mtime_epoch = stat.st_mtime
                    mod_time = time.strftime("%d/%m/%Y %H:%M", time.localtime(mtime_epoch))
                    is_pdf = item.suffix.lower() == ".pdf"
                    doc_id = get_doc_id(item.name)

                    files_map[item.name] = {
                        "id": doc_id,
                        "name": item.name,
                        "format": "pdf" if is_pdf else "md",
                        "size_bytes": size_bytes,
                        "size_mb": round(size_bytes / (1024 * 1024), 2),
                        "size": format_bytes(size_bytes),
                        "pages": None,
                        "url": "",
                        "mtime": mtime_epoch,
                        "time": mod_time,
                        "downloaded_by": {
                            "name": "Hệ thống",
                            "ip": "127.0.0.1",
                            "device": "Máy chủ",
                        },
                        "status": "active",
                    }
                    changed = True

        # 2. Xóa các file active trong metadata nếu không còn trên đĩa
        for fname in list(files_map.keys()):
            if files_map[fname].get("status") == "active" and fname not in actual_files:
                del files_map[fname]
                changed = True

        return changed

    def register_document(
        self,
        file_path: Path,
        url: str = "",
        title: str = "",
        pages: Optional[int] = None,
        downloaded_by: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Đăng ký tài liệu mới tải về vào hệ thống lưu trữ và metadata master."""
        with STORE_LOCK:
            data = self._load_metadata()
            filename = file_path.name
            stat = file_path.stat()
            size_bytes = stat.st_size
            now = time.time()
            try:
                os.utime(file_path, (now, now))
                mtime_epoch = now
            except Exception:
                mtime_epoch = stat.st_mtime
            mod_time = time.strftime("%d/%m/%Y %H:%M", time.localtime(mtime_epoch))
            is_pdf = file_path.suffix.lower() == ".pdf"
            doc_id = get_doc_id(filename)

            downloader_payload = downloaded_by or {
                "name": "Hệ thống",
                "ip": "127.0.0.1",
                "device": "Máy chủ",
            }

            entry = {
                "id": doc_id,
                "name": filename,
                "title": title or filename,
                "format": "pdf" if is_pdf else "md",
                "size_bytes": size_bytes,
                "size_mb": round(size_bytes / (1024 * 1024), 2),
                "size": format_bytes(size_bytes),
                "pages": pages,
                "url": url or "",
                "mtime": mtime_epoch,
                "time": mod_time,
                "downloaded_by": downloader_payload,
                "status": "active",
            }

            data["files"][filename] = entry
            self._save_metadata(data)
            return entry

    def list_documents(self) -> List[Dict[str, Any]]:
        """Lấy danh sách toàn bộ tài liệu đang hoạt động kèm thông tin người tải."""
        with STORE_LOCK:
            data = self._load_metadata()
            if self._sync_and_heal(data):
                self._save_metadata(data)

            active_docs = []
            for fname, meta in data.get("files", {}).items():
                if meta.get("status") != "active":
                    continue
                quoted_name = urllib.parse.quote(fname)
                is_pdf = meta.get("format") == "pdf"
                stream_url = f"/api/document-stream?id={meta.get('id', '')}"
                viewer_url = f"/pdfjs/web/viewer.html?file={urllib.parse.quote(stream_url, safe='')}"

                doc_copy = dict(meta)
                sb = doc_copy.get("size_bytes", 0)
                orig_url = meta.get("url", "")
                doc_copy.update({
                    "size_mb": doc_copy.get("size_mb") or round(sb / (1024 * 1024), 2),
                    "original_url": orig_url,
                    "source_url": orig_url,
                    "download_url": f"/downloads/{quoted_name}",
                    "url": f"/downloads/{quoted_name}",
                    "view_url": viewer_url if is_pdf else f"/view/{quoted_name}",
                    "stream_url": stream_url,
                    "viewer_url": viewer_url,
                    "is_pdf": is_pdf,
                })
                active_docs.append(doc_copy)

            # Sắp xếp mặc định: mới nhất lên trước
            active_docs.sort(key=lambda x: x.get("mtime", 0), reverse=True)
            return active_docs

    def _find_in_dir(self, directory: Path, filename: str) -> Optional[Path]:
        """Tìm file trong thư mục với fallback URL-unquote, NFC/NFD unicode, và metadata ID/Title."""
        if not filename:
            return None
        # 1. Exact match
        p = directory / filename
        if p.exists() and p.is_file():
            return p
        # 2. URL-unquoted match
        unquoted = urllib.parse.unquote(filename)
        p = directory / unquoted
        if p.exists() and p.is_file():
            return p
        double_unquoted = urllib.parse.unquote(unquoted)
        p = directory / double_unquoted
        if p.exists() and p.is_file():
            return p

        # 3. Unicode normalization (NFC & NFD) & Metadata matching
        norm_nfc = unicodedata.normalize('NFC', filename)
        norm_nfd = unicodedata.normalize('NFD', filename)
        norm_unq_nfc = unicodedata.normalize('NFC', unquoted)
        norm_unq_nfd = unicodedata.normalize('NFD', unquoted)

        data = self._load_metadata()
        files_map = data.get("files", {})

        for item in directory.glob("*.*"):
            if not item.is_file():
                continue
            item_nfc = unicodedata.normalize('NFC', item.name)
            item_nfd = unicodedata.normalize('NFD', item.name)
            meta = files_map.get(item.name, {})

            if (item_nfc in (norm_nfc, norm_unq_nfc) or
                item_nfd in (norm_nfd, norm_unq_nfd) or
                meta.get("id") == filename or
                meta.get("title") == filename or
                item.name.lower() in (filename.lower(), unquoted.lower())):
                return item
        return None

    def move_to_trash(self, filename: str, deleted_by: Optional[str] = None) -> bool:
        """Chuyển tài liệu vào Thùng rác (.trash)."""
        with STORE_LOCK:
            src = self._find_in_dir(self.root_dir, filename)
            if not src or not src.is_file():
                return False

            actual_filename = src.name
            dst = self.trash_dir / actual_filename
            shutil.move(str(src), str(dst))

            data = self._load_metadata()
            if actual_filename in data.get("files", {}):
                data["files"][actual_filename]["status"] = "trashed"
                data["files"][actual_filename]["trashed_at"] = time.time()
                data["files"][actual_filename]["trashed_time"] = time.strftime("%d/%m/%Y %H:%M")
                data["files"][actual_filename]["trashed_by"] = deleted_by or "Người dùng"
                self._save_metadata(data)

            return True

    def restore_from_trash(self, filename: str) -> bool:
        """Khôi phục tài liệu từ Thùng rác về thư mục chính."""
        with STORE_LOCK:
            src = self._find_in_dir(self.trash_dir, filename)
            if not src or not src.is_file():
                return False

            actual_filename = src.name
            dst = self.root_dir / actual_filename
            shutil.move(str(src), str(dst))

            data = self._load_metadata()
            if actual_filename in data.get("files", {}):
                data["files"][actual_filename]["status"] = "active"
                data["files"][actual_filename].pop("trashed_at", None)
                data["files"][actual_filename].pop("trashed_time", None)
                data["files"][actual_filename].pop("trashed_by", None)
            else:
                stat = dst.stat()
                data.setdefault("files", {})[actual_filename] = {
                    "id": get_doc_id(actual_filename),
                    "name": actual_filename,
                    "title": actual_filename,
                    "format": "pdf" if dst.suffix.lower() == ".pdf" else "md",
                    "size_bytes": stat.st_size,
                    "size": format_bytes(stat.st_size),
                    "mtime": stat.st_mtime,
                    "time": time.strftime("%d/%m/%Y %H:%M", time.localtime(stat.st_mtime)),
                    "downloaded_by": {"name": "Đã khôi phục", "ip": "127.0.0.1", "device": "Hệ thống"},
                    "status": "active",
                }

            self._save_metadata(data)
            return True

    def delete_permanent(self, filename: str) -> bool:
        """Xóa vĩnh viễn tệp tin khỏi đĩa và khỏi metadata."""
        with STORE_LOCK:
            deleted = False
            for d in (self.trash_dir, self.root_dir):
                target = self._find_in_dir(d, filename)
                if target and target.is_file():
                    try:
                        target.unlink()
                        deleted = True
                    except Exception:
                        pass

            data = self._load_metadata()
            for k in list(data.get("files", {}).keys()):
                meta = data["files"][k]
                if k == filename or meta.get("id") == filename or meta.get("title") == filename:
                    del data["files"][k]
                    deleted = True
            if deleted:
                self._save_metadata(data)

            return deleted

    def list_trash(self) -> List[Dict[str, Any]]:
        """Lấy danh sách các tệp đang nằm trong Thùng rác kèm metadata."""
        with STORE_LOCK:
            data = self._load_metadata()
            files_map = data.get("files", {})

            trashed = []
            for item in self.trash_dir.glob("*.*"):
                if item.is_file() and not item.name.startswith(".") and item.suffix.lower() in (".pdf", ".md"):
                    meta = files_map.get(item.name, {})
                    stat = item.stat()
                    size_bytes = stat.st_size
                    is_pdf = item.suffix.lower() == ".pdf"

                    trashed.append({
                        "id": meta.get("id") or get_doc_id(item.name),
                        "name": item.name,
                        "title": meta.get("title") or item.name,
                        "format": meta.get("format") or ("pdf" if is_pdf else "md"),
                        "size": format_bytes(size_bytes),
                        "size_bytes": size_bytes,
                        "size_mb": round(size_bytes / (1024 * 1024), 2),
                        "mtime": meta.get("trashed_at") or stat.st_mtime,
                        "time": meta.get("trashed_time") or time.strftime("%d/%m/%Y %H:%M", time.localtime(stat.st_mtime)),
                        "downloaded_by": meta.get("downloaded_by", {"name": "Không rõ", "ip": "", "device": ""}),
                        "is_pdf": is_pdf,
                    })

            trashed.sort(key=lambda x: x.get("mtime", 0), reverse=True)
            return trashed

    def empty_trash(self) -> int:
        """Dọn sạch toàn bộ tệp tin trong Thùng rác."""
        with STORE_LOCK:
            count = 0
            for item in self.trash_dir.glob("*.*"):
                if item.is_file():
                    try:
                        item.unlink()
                        count += 1
                    except Exception:
                        pass

            data = self._load_metadata()
            files_map = data.get("files", {})
            to_delete = [fname for fname, m in files_map.items() if m.get("status") == "trashed"]
            for fname in to_delete:
                del files_map[fname]
            self._save_metadata(data)

            return count
