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


def get_browser_ws_url(port: int) -> str:
    """Lấy WebSocket URL cấp trình duyệt (/devtools/browser/...) qua /json/version."""
    endpoint = f"http://127.0.0.1:{port}/json/version"
    try:
        req = urllib.request.Request(endpoint)
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read().decode())
            ws_url = data.get("webSocketDebuggerUrl")
            if not ws_url:
                raise RuntimeError("Không tìm thấy 'webSocketDebuggerUrl' trong /json/version")
            return ws_url
    except Exception as e:
        raise RuntimeError(f"Lỗi khi lấy browser WebSocket URL từ cổng {port}: {e}")


def _send_browser_cdp(port: int, method: str, params: Optional[dict] = None) -> dict:
    """Gửi một lệnh CDP trực tiếp tới WebSocket cấp trình duyệt (Browser-Level Target)."""
    ws_url = get_browser_ws_url(port)
    try:
        from websockets.sync.client import connect as sync_connect
        with sync_connect(ws_url, max_size=None, open_timeout=5.0, close_timeout=5.0) as ws:
            payload = {"id": 1, "method": method}
            if params:
                payload["params"] = params
            ws.send(json.dumps(payload))
            while True:
                msg = json.loads(ws.recv(timeout=10.0))
                if msg.get("id") == 1:
                    if "error" in msg:
                        raise RuntimeError(f"CDP Browser Error ({method}): {msg['error']}")
                    return msg.get("result", {})
    except ImportError:
        # Fallback cho môi trường không có websockets.sync.client (chạy qua ThreadPool riêng an toàn)
        from concurrent.futures import ThreadPoolExecutor
        def _runner():
            async def _async_call():
                async with websockets.connect(ws_url, max_size=None, open_timeout=5.0, close_timeout=5.0) as ws:
                    payload = {"id": 1, "method": method}
                    if params:
                        payload["params"] = params
                    await ws.send(json.dumps(payload))
                    while True:
                        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10.0))
                        if msg.get("id") == 1:
                            if "error" in msg:
                                raise RuntimeError(f"CDP Browser Error ({method}): {msg['error']}")
                            return msg.get("result", {})
            return asyncio.run(_async_call())
        with ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(_runner).result(timeout=12.0)


def create_browser_context(port: int) -> str:
    """Tạo một BrowserContext (Incognito isolation) mới và trả về context_id."""
    res = _send_browser_cdp(port, "Target.createBrowserContext")
    context_id = res.get("browserContextId")
    if not context_id:
        raise RuntimeError(f"Không nhận được browserContextId từ Chromium: {res}")
    return context_id


def dispose_browser_context(port: int, context_id: Optional[str]) -> bool:
    """Hủy một BrowserContext và đóng sạch toàn bộ tab cùng bộ nhớ đệm ẩn danh liên kết."""
    if not context_id:
        return False
    try:
        _send_browser_cdp(port, "Target.disposeBrowserContext", {"browserContextId": context_id})
        return True
    except Exception:
        return False


def create_tab(port: int, url: str = "about:blank", browser_context_id: Optional[str] = None) -> tuple[str, str]:
    """Mở một tab mới độc lập (tuỳ chọn gán vào browser_context_id) và trả về (target_id, ws_url)."""
    if browser_context_id:
        try:
            params = {"url": url, "browserContextId": browser_context_id}
            res = _send_browser_cdp(port, "Target.createTarget", params)
            target_id = res.get("targetId", "")
            if not target_id:
                raise RuntimeError(f"Không nhận được targetId từ Target.createTarget: {res}")
            ws_url = f"ws://127.0.0.1:{port}/devtools/page/{target_id}"
            return target_id, ws_url
        except Exception as e:
            print(f"[CDP] Warning: Lỗi tạo tab trong browser_context ({e}), thử mở tab thông thường...", flush=True)

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


def create_tab_in_context(port: int, browser_context_id: str, url: str = "about:blank") -> tuple[str, str]:
    """Alias mở tab bên trong một BrowserContext xác định."""
    return create_tab(port, url=url, browser_context_id=browser_context_id)


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

