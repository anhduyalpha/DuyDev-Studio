# -*- coding: utf-8 -*-
"""
studocu_dl.browser
==================
Quản lý dò tìm và vòng đời tiến trình trình duyệt (Google Chrome, Microsoft Edge, Brave).
"""

import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional


def find_browser_executable(user_path: Optional[str] = None) -> str:
    """Tự động tìm đường dẫn Chrome, Chromium hoặc Edge trên Windows và Linux."""
    if user_path and os.path.isfile(user_path):
        return user_path

    candidates = [
        # Linux standard paths
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/snap/bin/chromium",
        # Google Chrome Windows
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        # Microsoft Edge Windows
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        # Brave Windows
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
    ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    which_chrome = (
        shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("google-chrome")
        or shutil.which("google-chrome-stable")
        or shutil.which("chrome")
        or shutil.which("msedge")
    )
    if which_chrome:
        return which_chrome

    raise FileNotFoundError(
        "Không tìm thấy trình duyệt Google Chrome hoặc Chromium trên máy tính/server. "
        "Hãy truyền đường dẫn qua tham số --browser <path>."
    )


class BrowserProcess:
    """Quản lý khởi động, cấu hình cờ và giải phóng tiến trình trình duyệt."""

    def __init__(
        self,
        url: str,
        port: int,
        browser_path: Optional[str] = None,
        show_browser: bool = False,
        profile_dir: Optional[str] = None,
    ):
        self.url = url
        self.port = port
        self.browser_path = find_browser_executable(browser_path)
        self.show_browser = show_browser
        if profile_dir:
            self.profile_dir = Path(profile_dir)
            self._is_temp_profile = False
        else:
            # Tạo profile sạch riêng biệt cho mỗi phiên để chống xung đột khóa và ô nhiễm WAF
            self.profile_dir = Path(tempfile.mkdtemp(prefix="studocu_dl_session_"))
            self._is_temp_profile = True
        self.proc: Optional[subprocess.Popen] = None

    def start(self) -> None:
        """Khởi động trình duyệt với các cờ tối ưu hóa cho Linux/Windows."""
        self.profile_dir.mkdir(parents=True, exist_ok=True)

        # Xóa các file khóa singleton cũ nếu bị crash/zombie từ lần chạy trước
        for lock_name in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
            lock_path = self.profile_dir / lock_name
            if lock_path.is_symlink() or lock_path.exists():
                try:
                    lock_path.unlink()
                except Exception:
                    pass

        # Tự động phát hiện và đảm bảo màn hình ảo Xvfb đang chạy trên Linux
        if sys.platform != "win32":
            res = subprocess.run(["pgrep", "-x", "Xvfb"], stdout=subprocess.DEVNULL)
            if res.returncode != 0 and shutil.which("Xvfb"):
                for lock in ("/tmp/.X99-lock", "/tmp/.X11-unix/X99"):
                    if os.path.exists(lock):
                        try:
                            os.unlink(lock)
                        except Exception:
                            pass
                subprocess.Popen(
                    ["Xvfb", ":99", "-screen", "0", "1280x900x24", "-ac", "+extension", "GLX", "+render", "-noreset"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                time.sleep(1)
            if os.path.exists("/tmp/.X11-unix/X99") or shutil.which("Xvfb"):
                os.environ["DISPLAY"] = ":99"

        cmd = [
            self.browser_path,
            "about:blank",
            f"--remote-debugging-port={self.port}",
            f"--user-data-dir={str(self.profile_dir)}",
            "--disable-blink-features=AutomationControlled",
            "--disable-features=CalculateNativeWinOcclusion",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--no-first-run",
            "--no-default-browser-check",
            "--window-size=1280,900",
            "--lang=en-US,en",
            # CỜ TỐI ƯU HÓA TÀI NGUYÊN BỘ NHỚ VÀ TIẾN TRÌNH
            "--js-flags=--max-old-space-size=256",
            "--renderer-process-limit=4",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-default-apps",
            "--disable-extensions",
            "--mute-audio",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-sandbox",
        ]

        if sys.platform != "win32":
            has_display = bool(os.environ.get("DISPLAY"))
            if not has_display:
                cmd.append("--headless=new")
        else:
            if not self.show_browser:
                cmd.append("--window-position=-2000,-2000")

        popen_kwargs = {
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
        }
        if sys.platform != "win32":
            popen_kwargs["start_new_session"] = True

        self.proc = subprocess.Popen(cmd, **popen_kwargs)

    def is_alive(self) -> bool:
        """Kiểm tra xem tiến trình trình duyệt còn đang hoạt động hay không."""
        return self.proc is not None and self.proc.poll() is None

    def stop(self) -> None:
        """Dọn dẹp triệt để toàn bộ nhóm tiến trình trình duyệt (tránh zombie processes)."""
        if self.proc:
            if sys.platform != "win32":
                try:
                    os.killpg(self.proc.pid, signal.SIGTERM)
                    self.proc.wait(timeout=2)
                except Exception:
                    try:
                        os.killpg(self.proc.pid, signal.SIGKILL)
                    except Exception:
                        pass
            else:
                try:
                    self.proc.terminate()
                    self.proc.wait(timeout=3)
                except Exception:
                    try:
                        self.proc.kill()
                    except Exception:
                        pass
            self.proc = None
        if getattr(self, "_is_temp_profile", False) and self.profile_dir.exists():
            try:
                shutil.rmtree(self.profile_dir, ignore_errors=True)
            except Exception:
                pass
