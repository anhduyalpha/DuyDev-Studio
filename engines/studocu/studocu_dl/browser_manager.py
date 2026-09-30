# -*- coding: utf-8 -*-
"""
studocu_dl.browser_manager
==========================
Bộ quản lý phiên trình duyệt thường trực (Persistent Warm Browser Daemon & Session Pooling).
Duy trì một tiến trình Chromium duy nhất kèm hồ sơ phiên (user-data-dir) bền bỉ để
loại bỏ hoàn toàn việc phải giải lại Cloudflare Turnstile sau mỗi lần tải.
"""

import os
import shutil
import threading
import time
import urllib.request
import urllib.error
import json
from pathlib import Path
from typing import Optional

from .browser import BrowserProcess, find_browser_executable
from .cdp import get_page_ws_url


class BrowserSessionManager:
    """Quản lý tiến trình Chromium chạy nền thường trực và đồng bộ session."""

    _instance: Optional["BrowserSessionManager"] = None
    _singleton_lock = threading.RLock()

    def __init__(
        self,
        port: int = 9222,
        profile_dir: Optional[str] = None,
        browser_path: Optional[str] = None,
        show_browser: bool = False,
    ):
        self.port = port
        self.browser_path = browser_path
        self.show_browser = show_browser

        # Đường dẫn lưu trữ hồ sơ phiên (persistent profile)
        if profile_dir:
            self.profile_dir = Path(profile_dir)
        else:
            from .config import SESSION_DIR
            self.profile_dir = SESSION_DIR

        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self._browser_proc: Optional[BrowserProcess] = None
        self.job_lock = threading.RLock()
        self._init_lock = threading.RLock()

    @classmethod
    def get_instance(
        cls,
        port: int = 9222,
        profile_dir: Optional[str] = None,
        browser_path: Optional[str] = None,
        show_browser: bool = False,
    ) -> "BrowserSessionManager":
        """Lấy thể hiện Singleton của BrowserSessionManager."""
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = cls(
                    port=port,
                    profile_dir=profile_dir,
                    browser_path=browser_path,
                    show_browser=show_browser,
                )
            return cls._instance

    def is_cdp_ready(self) -> bool:
        """Kiểm tra xem cổng CDP của Chromium có đang phản hồi hay không."""
        try:
            url = f"http://127.0.0.1:{self.port}/json/version"
            with urllib.request.urlopen(url, timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def ensure_browser_running(self) -> None:
        """Đảm bảo trình duyệt Chromium đang hoạt động và sẵn sàng nhận kết nối CDP."""
        with self._init_lock:
            if self._browser_proc and self._browser_proc.is_alive() and self.is_cdp_ready():
                return

            # Nếu tiến trình cũ bị treo hoặc chết, dọn dẹp trước
            if self._browser_proc:
                try:
                    self._browser_proc.stop()
                except Exception:
                    pass
                self._browser_proc = None

            print(f"  🌐 [BrowserManager] Khởi động Warm Chromium Daemon (Port {self.port}, Profile: {self.profile_dir})...", flush=True)
            self._browser_proc = BrowserProcess(
                url="about:blank",
                port=self.port,
                browser_path=self.browser_path,
                show_browser=self.show_browser,
                profile_dir=str(self.profile_dir),
            )
            self._browser_proc.start()

            # Chờ cổng CDP sẵn sàng
            t_start = time.time()
            while time.time() - t_start < 25.0:
                if self.is_cdp_ready():
                    print("  ✨ [BrowserManager] Chromium Daemon đã sẵn sàng nhận lệnh CDP!", flush=True)
                    return
                time.sleep(0.3)

            raise TimeoutError(f"Không thể kết nối cổng CDP {self.port} của Chromium sau 25 giây.")

    async def get_ws_url(self) -> str:
        """Lấy WebSocket URL kết nối tới tab trang web."""
        self.ensure_browser_running()
        return await get_page_ws_url(self.port)

    def reset_session(self) -> None:
        """Dừng trình duyệt, dọn sạch hồ sơ cookies/cache và khởi động lại."""
        with self.job_lock:
            with self._init_lock:
                print("  🧹 [BrowserManager] Đang dọn dẹp sạch hồ sơ phiên (Session Reset)...", flush=True)
                if self._browser_proc:
                    try:
                        self._browser_proc.stop()
                    except Exception:
                        pass
                    self._browser_proc = None

                # Xóa toàn bộ dữ liệu trong thư mục session
                if self.profile_dir.exists():
                    try:
                        shutil.rmtree(self.profile_dir, ignore_errors=True)
                    except Exception:
                        pass
                self.profile_dir.mkdir(parents=True, exist_ok=True)

                # Khởi động lại phiên sạch
                self.ensure_browser_running()
                print("  ✅ [BrowserManager] Đã làm mới phiên trình duyệt thành công!", flush=True)

    def stop_all(self) -> None:
        """Dừng hoàn toàn trình duyệt khi server tắt."""
        with self._init_lock:
            if self._browser_proc:
                try:
                    self._browser_proc.stop()
                except Exception:
                    pass
                self._browser_proc = None
