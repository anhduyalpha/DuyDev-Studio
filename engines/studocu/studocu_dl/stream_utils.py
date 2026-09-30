# -*- coding: utf-8 -*-
"""
studocu_dl.stream_utils
=======================
Tiện ích xử lý streaming tài liệu, băm ID định danh chống IDM và phân tích HTTP Range.
"""

import hashlib
import urllib.parse
from pathlib import Path
from typing import Dict, Optional, Tuple

DOC_ID_MAP: Dict[str, str] = {}


def get_doc_id(filename: str) -> str:
    """Tạo hoặc lấy ID rút gọn 16 ký tự hexa đại diện cho tài liệu (chống IDM bắt nhầm URL .pdf)."""
    doc_id = hashlib.sha256(filename.encode("utf-8")).hexdigest()[:16]
    DOC_ID_MAP[doc_id] = filename
    return doc_id


def resolve_filename_by_doc_id(doc_id: str, downloads_dir: Path) -> Optional[str]:
    """Tìm tên file thực tế từ doc_id. Nếu chưa có trong DOC_ID_MAP, tự động quét DOWNLOADS_DIR."""
    if not doc_id:
        return None
    if doc_id in DOC_ID_MAP:
        return DOC_ID_MAP[doc_id]
    downloads_dir.mkdir(parents=True, exist_ok=True)
    for p in downloads_dir.glob("*.*"):
        if p.is_file():
            calculated = hashlib.sha256(p.name.encode("utf-8")).hexdigest()[:16]
            DOC_ID_MAP[calculated] = p.name
            if calculated == doc_id:
                return p.name
    return None


def resolve_file_from_request(query_params: dict, downloads_dir: Path) -> Optional[Path]:
    """
    Xác định đường dẫn file an toàn từ query params (?id=... hoặc ?file=...).
    Hỗ trợ cả hash doc_id lẫn tên file trực tiếp, chống Directory Traversal.
    """
    doc_id = query_params.get("id", [""])[0].strip()
    filename = None
    if doc_id:
        filename = resolve_filename_by_doc_id(doc_id, downloads_dir)

    if not filename:
        file_param = query_params.get("file", [""])[0].strip()
        if file_param:
            filename = urllib.parse.unquote(file_param)

    if not filename:
        return None

    file_path = downloads_dir / filename
    try:
        file_path.resolve().relative_to(downloads_dir.resolve())
    except ValueError:
        return None

    if file_path.is_file():
        return file_path

    # Thử unquote lần 2 nếu bị double encoding
    unquoted = urllib.parse.unquote(filename)
    if (downloads_dir / unquoted).is_file():
        return downloads_dir / unquoted

    return None


def parse_byte_range(range_header: str, file_size: int) -> Optional[Tuple[int, int]]:
    """Phân tích cú pháp header Range HTTP (hỗ trợ bytes=start-end, bytes=start-, bytes=-suffix)."""
    if not range_header or not range_header.startswith("bytes="):
        return None
    range_val = range_header[6:].strip()
    if "," in range_val:
        range_val = range_val.split(",")[0].strip()
    parts = range_val.split("-")
    if len(parts) != 2:
        return None
    start_str, end_str = parts[0].strip(), parts[1].strip()
    try:
        if start_str and end_str:
            start = int(start_str)
            end = int(end_str)
        elif start_str:
            start = int(start_str)
            end = file_size - 1
        elif end_str:
            suffix_len = int(end_str)
            if suffix_len <= 0:
                return None
            start = max(0, file_size - suffix_len)
            end = file_size - 1
        else:
            return None

        if 0 <= start <= end < file_size:
            return (start, end)
        return None
    except ValueError:
        return None
