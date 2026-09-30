---
id: KI-FIX-001-persistent-browser-session-cloudflare
title: "Fixing Cloudflare Turnstile Re-challenging and Concurrency Deadlocks with Warm Persistent Browser Daemon"
type: troubleshoot
status: verified
domain: backend
tags: [cloudflare, turnstile, cdp, chromium, session-persistence, concurrency, rlock]
created_at: 2026-09-19
updated_at: 2026-09-19
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Consecutive document downloads take 15-30s extra due to Cloudflare Turnstile re-verification, WebSocket CDP connection timeouts, or Cloudflare WAF Access Blocked errors"
search_queries:
  - "cloudflare turnstile re-challenging every request studocu"
  - "studocu cdp connection timeout concurrent downloads"
  - "how to keep warm browser session cloudflare clearance"
  - "access blocked cloudflare waf studocu downloader"
related_kis:
  - KI-FIX-003-studocu-paywalled-blurred-pages-bypass
  - KI-HOWTO-001-studocu-downloader-docker-casaos-deployment
---

# [KI-FIX-001] Fixing Cloudflare Turnstile Re-challenging and Concurrency Deadlocks with Warm Persistent Browser Daemon

## 1. Context & Purpose
Studocu is protected by Cloudflare Bot Management and Turnstile challenges ("Just a moment..."). Spawning a new Chromium instance or clearing all cookies for every download request invalidates the `cf_clearance` token, forcing users to wait 15–30 seconds per document while the headless browser attempts to solve the Turnstile challenge. Furthermore, concurrent API download requests on an un-synchronized browser instance cause CDP WebSocket collisions and deadlocks. 

This Knowledge Item documents the implementation of a persistent singleton browser daemon (`BrowserSessionManager`) utilizing native stealth flags, a persistent profile directory, thread-safe request serialization (`threading.RLock`), and selective cookie scrubbing that preserves Cloudflare tokens while purging document tracking state.

## 2. Prerequisites & Root Cause Analysis
- **Python**: 3.10+ with `asyncio`, `websockets`
- **Headless Chromium**: Installed with Xvfb or equivalent virtual framebuffer.
- **Root Causes Identified**:
  1. **Session Destruction**: Creating and destroying Chromium processes per task wiped the ephemeral cookies, specifically `cf_clearance`, `__cf_bm`, and `_cfuvid`.
  2. **Indiscriminate Cookie Purging**: Calling `Network.clearBrowserCookies` purged Cloudflare authorization alongside Studocu tracking cookies.
  3. **WAF Fingerprint Triggering**: Overwriting `navigator.webdriver` or modifying `navigator.plugins` via `Page.addScriptToEvaluateOnNewDocument` was detected by Cloudflare Turnstile's client-side behavioral probe, resulting in immediate `Access Blocked` (Cloudflare 1020/403).
  4. **CDP Concurrency Collisions**: Multiple incoming API requests attempted to attach to the same CDP port simultaneously without synchronization, causing WebSocket handshake failures.

## 3. Core Instructions / Solution

### Step 1: Singleton Warm Browser Daemon (`BrowserSessionManager`)
Implement a thread-safe singleton daemon that maintains a persistent Chromium instance with a designated `--user-data-dir`:

```python
# studocu_dl/browser_manager.py
import threading
from pathlib import Path
from typing import Optional
from .browser import BrowserProcess

class BrowserSessionManager:
    _instance: Optional["BrowserSessionManager"] = None
    _singleton_lock = threading.RLock()

    def __init__(self, port: int = 9222, profile_dir: Optional[str] = None):
        self.port = port
        self.profile_dir = Path(profile_dir or "/app/downloads/.browser_session")
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self._browser_proc: Optional[BrowserProcess] = None
        self.job_lock = threading.RLock()
        self._init_lock = threading.RLock()

    @classmethod
    def get_instance(cls, port: int = 9222, profile_dir: Optional[str] = None) -> "BrowserSessionManager":
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = cls(port=port, profile_dir=profile_dir)
            return cls._instance

    def ensure_browser_running(self) -> None:
        with self._init_lock:
            if self._browser_proc and self._browser_proc.is_alive() and self.is_cdp_ready():
                return
            self._browser_proc = BrowserProcess(
                url="about:blank",
                port=self.port,
                profile_dir=str(self.profile_dir)
            )
            self._browser_proc.start()
```

### Step 2: Native Stealth Chromium Flags
Remove artificial JavaScript evasion overrides (`Page.addScriptToEvaluateOnNewDocument`) and rely strictly on Chromium native flags:

```python
# studocu_dl/browser.py
args = [
    f"--remote-debugging-port={port}",
    f"--user-data-dir={profile_dir}",
    "--disable-blink-features=AutomationControlled", # Native stealth flag
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1280,900",
    "--disable-infobars",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check"
]
```

### Step 3: Selective Cookie Scrubbing (Cloudflare Preservation)
When clearing tracking state to reset document preview limits, selectively delete non-Cloudflare cookies:

```python
# studocu_dl/engine.py
async def _prepare_clean_studocu_session(self, page_client: StudocuCDPClient):
    cookies = (await page_client.send("Network.getCookies")).get("cookies", [])
    for ck in cookies:
        name = ck.get("name", "")
        # CRITICAL: Preserve Cloudflare clearance tokens
        if "cf" in name.lower():
            continue
        domain = ck.get("domain", "")
        path = ck.get("path", "/")
        await page_client.send("Network.deleteCookies", {
            "name": name,
            "domain": domain,
            "path": path
        })
    await page_client.eval("""(() => {
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
    })()""")
```

### Step 4: Synchronize Requests in API Server
Ensure all download jobs acquire `BrowserSessionManager.get_instance().job_lock`:

```python
# studocu_dl/server.py
@app.post("/api/download")
async def handle_download(req: DownloadRequest):
    manager = BrowserSessionManager.get_instance()
    # Serialize concurrent downloads to protect the warm session
    with manager.job_lock:
        engine = StudocuEngine(
            url=req.url,
            keep_browser_alive=True,
            port=manager.port
        )
        return await engine.run()
```

## 4. Gotchas & Edge Cases
- > [!WARNING]
  > **Never call `Network.clearBrowserCookies`**: Doing so will immediately wipe `cf_clearance` and cause Turnstile challenge on the very next document request.
- > [!CAUTION]
  > **Do NOT tamper with `navigator.plugins` or `navigator.languages`**: Cloudflare's client-side runtime detects mismatched prototypes and flags the browser with an immediate 403 `Access Blocked` response.
- **Session Corruption Recovery**: If an IP change or WAF policy trips an `Access Blocked` page, provide an explicit endpoint (`/api/reset-session`) that stops the browser daemon, removes `--user-data-dir`, and respawns a clean session.

## 5. Verification
1. Run first download:
   ```bash
   python -m studocu_dl.cli "https://www.studocu.com/vn/document/..." --keep-browser-alive
   ```
   *Expected*: Cloudflare Turnstile solves in 3–5 seconds.
2. Immediately run second download on a different document URL:
   *Expected*: Cloudflare passes in under 1.5 seconds without encountering "Just a moment..." or triggering Turnstile challenge.
3. Check browser session logs:
   *Expected*: Log shows `🧹 Đã làm sạch tracking cookies (bảo toàn Cloudflare session).`

## 6. Changelog
- **2026-09-19 (v1.0.0)**: Initial documentation of warm browser daemon, Cloudflare token preservation, and request synchronization by @anhduy.
