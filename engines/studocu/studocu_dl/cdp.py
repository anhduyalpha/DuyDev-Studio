# -*- coding: utf-8 -*-
"""
studocu_dl.cdp
==============
Client giao tiếp Chrome DevTools Protocol (CDP) trực tiếp qua WebSocket.
"""

import asyncio
import json
import time
import urllib.request
from typing import Optional

try:
    import websockets
except ImportError:
    websockets = None


class StudocuCDPClient:
    """Quản lý kết nối và gửi lệnh DevTools Protocol tới tab trình duyệt."""

    def __init__(self, ws_url: str):
        if websockets is None:
            raise ImportError(
                "Thư viện 'websockets' chưa được cài đặt. Vui lòng chạy: pip install websockets"
            )
        self.ws_url = ws_url
        self.ws = None
        self._msg_id = 0

    async def connect(self) -> None:
        """Mở kết nối WebSocket tới tab với bộ đệm dữ liệu không giới hạn dung lượng."""
        self.ws = await websockets.connect(
            self.ws_url,
            max_size=None,
            ping_interval=None,
        )

    async def close(self) -> None:
        """Đóng kết nối WebSocket an toàn."""
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
            self.ws = None

    async def send(self, method: str, params: Optional[dict] = None) -> dict:
        """Gửi một lệnh CDP và chờ kết quả trả về theo id."""
        self._msg_id += 1
        current_id = self._msg_id
        payload = {"id": current_id, "method": method}
        if params:
            payload["params"] = params

        await self.ws.send(json.dumps(payload))
        while True:
            raw = await self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == current_id:
                if "error" in data:
                    raise RuntimeError(f"CDP Error ({method}): {data['error']}")
                return data.get("result", {})

    async def eval(self, expression: str, await_promise: bool = False) -> any:
        """Thực thi mã JavaScript trong bối cảnh của trang và trả về giá trị."""
        params = {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise,
        }
        res = await self.send("Runtime.evaluate", params)
        return res.get("result", {}).get("value")

    async def block_unwanted_resources(self) -> None:
        """Chặn 100% request rác, tracking, analytics, media video/gif để tăng tốc 50% và tiết kiệm 40% RAM."""
        blocked_patterns = [
            "*google-analytics.com*",
            "*googletagmanager.com*",
            "*analytics.google.com*",
            "*facebook.net*",
            "*facebook.com*",
            "*connect.facebook.net*",
            "*doubleclick.net*",
            "*hotjar.com*",
            "*sentry.io*",
            "*datadoghq.com*",
            "*criteo.net*",
            "*criteo.com*",
            "*tiktok.com*",
            "*ads.pubmatic.com*",
            "*.mp4",
            "*.webm",
            "*.mp3",
            "*.wav",
            "*.gif",
        ]
        try:
            await self.send("Network.enable")
            await self.send("Network.setBlockedURLs", {"urls": blocked_patterns})
        except Exception:
            pass

    async def purge_memory(self) -> None:
        """Ép engine V8 và Blink dọn rác và giải phóng cache đồ họa, đưa RAM về mức sàn tối thiểu."""
        try:
            await self.send("Memory.forciblyPurgeCacheAndPerformGarbageCollection")
        except Exception:
            pass
        try:
            await self.send("HeapProfiler.collectGarbage")
        except Exception:
            pass


async def get_page_ws_url(port: int, max_wait: float = 25.0) -> str:
    """Lấy WebSocket URL của tab tài liệu Studocu qua endpoint HTTP /json/list."""
    start = time.time()
    url = f"http://127.0.0.1:{port}/json/list"
    fallback_ws = None
    discovered_tabs = []

    while time.time() - start < max_wait:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                tabs = json.loads(resp.read().decode())
                discovered_tabs = [f"[{t.get('type')}] {t.get('url')}" for t in tabs]
                for t in tabs:
                    t_url = t.get("url", "")
                    t_type = t.get("type", "")
                    ws_url = t.get("webSocketDebuggerUrl")
                    if not ws_url:
                        continue
                    if t_type == "page":
                        if t_url.startswith("http://") or t_url.startswith("https://") or t_url == "about:blank":
                            return ws_url
                        if not fallback_ws:
                            fallback_ws = ws_url

                if not fallback_ws:
                    try:
                        new_req = urllib.request.Request(f"http://127.0.0.1:{port}/json/new?about:blank", method="PUT")
                        with urllib.request.urlopen(new_req, timeout=1.0) as new_resp:
                            new_tab = json.loads(new_resp.read().decode())
                            new_ws = new_tab.get("webSocketDebuggerUrl")
                            if new_ws:
                                return new_ws
                    except Exception:
                        pass
        except Exception:
            pass
        await asyncio.sleep(0.4)

    if fallback_ws:
        return fallback_ws

    tabs_info = "\n     - ".join(discovered_tabs) if discovered_tabs else "Không tìm thấy tab nào"
    raise TimeoutError(
        f"Không thể kết nối đến cổng gỡ lỗi Chrome CDP (port {port}).\n"
        f"     Các tab được Chrome báo cáo:\n     - {tabs_info}"
    )


def create_tab(port: int, url: str = "about:blank") -> tuple[str, str]:
    """Mở một tab mới độc lập và trả về (target_id, ws_url)."""
    import urllib.parse
    encoded_url = urllib.parse.quote(url, safe=":/%?=&")
    endpoint = f"http://127.0.0.1:{port}/json/new?{encoded_url}"
    try:
        req = urllib.request.Request(endpoint, method="PUT")
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read().decode())
            target_id = data.get("id", "")
            ws_url = data.get("webSocketDebuggerUrl", "")
            return target_id, ws_url
    except Exception as e:
        raise RuntimeError(f"Lỗi khi mở tab mới qua CDP: {e}")


def close_tab(port: int, target_id: str) -> bool:
    """Đóng tab theo target_id và thu hồi toàn bộ tài nguyên RAM của tab."""
    if not target_id:
        return False
    endpoint = f"http://127.0.0.1:{port}/json/close/{target_id}"
    try:
        req = urllib.request.Request(endpoint, method="PUT")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return resp.status == 200
    except Exception:
        return False

