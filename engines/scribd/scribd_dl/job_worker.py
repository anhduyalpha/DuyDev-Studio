# -*- coding: utf-8 -*-
"""
scribd_dl.job_worker
====================
Manages asynchronous background jobs and execution state for Scribd Archiver.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Dict, Any, Optional

from .engine import ScribdArchiver, extract_scribd_doc_id
from .config import DOWNLOADS_DIR
from .storage import save_file_metadata

JOBS: Dict[str, Dict[str, Any]] = {}


def create_job(url: str, user_name: Optional[str] = None, downloaded_by: Optional[Dict[str, str]] = None) -> str:
    """Tạo một mã công việc mới."""
    job_id = f"scribd_{uuid.uuid4().hex[:10]}"
    dl = downloaded_by or {"name": user_name or "Máy khách", "ip": "127.0.0.1", "device": "Web"}
    initial_logs = [f"🚀 Đang xử lý liên kết: {url}"]
    if dl.get("name"):
        initial_logs.append(f"🎯 Định dạng: PDF • Người tải: {dl['name']} ({dl.get('device', 'Web')})")

    JOBS[job_id] = {
        "id": job_id,
        "url": url,
        "doc_id": extract_scribd_doc_id(url),
        "status": "pending",
        "progress": 0,
        "step_label": "Đang khởi tạo...",
        "logs": initial_logs,
        "user_name": dl["name"],
        "downloaded_by": dl,
        "start_time": time.time(),
        "archiver": None,
        "result": None,
        "error": None,
    }
    return job_id


def run_archive_job(job_id: str, url: str, force_reload: bool = False, user_name: Optional[str] = None, downloaded_by: Optional[Dict[str, str]] = None) -> None:
    """Chạy công việc tải trong một luồng nền."""
    if job_id not in JOBS:
        create_job(url, user_name, downloaded_by)
    elif downloaded_by:
        JOBS[job_id]["downloaded_by"] = downloaded_by
        JOBS[job_id]["user_name"] = downloaded_by.get("name", user_name or "Máy khách")

    job = JOBS[job_id]

    def _worker():
        job["status"] = "running"
        job["progress"] = 5
        job["step_label"] = "Đang kết nối máy chủ xử lý..."

        def on_progress(pct: int, label: str):
            job["progress"] = pct
            job["step_label"] = label

        def on_log(msg: str):
            job["logs"].append(msg)
            # Giữ tối đa 200 dòng logs mới nhất
            if len(job["logs"]) > 200:
                job["logs"] = job["logs"][-200:]

        try:
            archiver = ScribdArchiver(
                url_or_id=url,
                output_dir=DOWNLOADS_DIR,
                progress_callback=on_progress,
                log_callback=on_log,
            )
            job["archiver"] = archiver
            res = archiver.archive(force_reload=force_reload)

            try:
                save_file_metadata(
                    filename=res["name"],
                    doc_id=str(res.get("id") or job.get("doc_id") or ""),
                    title=res.get("title") or "",
                    size_bytes=res.get("size_bytes", 0),
                    pages=res.get("pages"),
                    downloaded_by=job.get("downloaded_by"),
                )
            except Exception as meta_err:
                print(f"[Scribd] Lỗi lưu metadata người tải: {meta_err}", flush=True)

            job["status"] = "completed"
            job["progress"] = 100
            job["step_label"] = f"Hoàn tất ({res['pages']} trang)"
            job["result"] = res
            job["logs"].append(f"🎉 Tài liệu đã sẵn sàng: {res['name']}")

        except Exception as e:
            if getattr(job.get("archiver"), "is_cancelled", False):
                job["status"] = "cancelled"
                job["step_label"] = "Tiến trình đã bị hủy"
                job["logs"].append("🛑 Tác vụ đã được hủy theo yêu cầu")
            else:
                job["status"] = "failed"
                job["error"] = str(e)
                job["step_label"] = f"Lỗi: {e}"
                job["logs"].append(f"❌ Lỗi xử lý: {e}")
        finally:
            job["archiver"] = None

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def cancel_job(job_id: str) -> bool:
    """Hủy một công việc đang chạy."""
    job = JOBS.get(job_id)
    if not job:
        return False

    archiver: Optional[ScribdArchiver] = job.get("archiver")
    if archiver:
        archiver.cancel()

    job["status"] = "cancelled"
    job["step_label"] = "Đã hủy bởi người dùng"
    job["logs"].append("🛑 Nhận lệnh hủy từ người dùng")
    return True
