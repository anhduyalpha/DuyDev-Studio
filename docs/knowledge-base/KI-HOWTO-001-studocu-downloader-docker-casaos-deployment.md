---
id: KI-HOWTO-001-studocu-downloader-docker-casaos-deployment
title: "Deploying Studocu Downloader with Integrated Web PDF Viewer on CasaOS Docker"
type: how-to
status: verified
domain: devops
tags: [casaos, docker, docker-compose, pdfjs, web-viewer, fastapi, headless-chromium]
created_at: 2026-09-19
updated_at: 2026-09-19
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Deploying or hosting Studocu Downloader on a home server (CasaOS / Docker) with in-browser PDF viewing capabilities"
search_queries:
  - "deploy studocu downloader casaos docker"
  - "studocu downloader web pdf viewer pdfjs"
  - "docker-compose studocu-dl headless chromium xvfb"
  - "casaos install custom app studocu web reader"
related_kis:
  - KI-FIX-001-persistent-browser-session-cloudflare
  - KI-FIX-002-studocu-blank-pages-virtual-scroll
  - KI-FIX-003-studocu-paywalled-blurred-pages-bypass
---

# [KI-HOWTO-001] Deploying Studocu Downloader with Integrated Web PDF Viewer on CasaOS Docker

## 1. Context & Purpose
This guide details the procedure for deploying Studocu Downloader as an autonomous, web-accessible service on CasaOS or any Docker-enabled Linux server. The deployment packages a FastAPI backend, an embedded PDF.js web reader, a headless Chromium instance with virtual display (Xvfb), and persistent volume mounts for downloaded documents and persistent browser sessions.

## 2. Prerequisites
- [ ] Docker Engine 24.0+ and Docker Compose v2.
- [ ] CasaOS or Linux host (e.g. Ubuntu / Debian server) with 2+ CPU cores and 2+ GB RAM.
- [ ] Available host port (default: `8090`).
- [ ] Minimum 1GB shared memory (`shm_size: 1gb`) configured for Chromium stability.

## 3. Core Instructions / Solution

### Step 1: Prepare Docker Compose Configuration
Create or inspect `docker-compose.yml` in the project root:

```yaml
version: "3.8"

services:
  studocu-dl:
    build: .
    container_name: studocu-dl
    restart: unless-stopped
    ports:
      - "8090:8090"
    volumes:
      - ./downloads:/app/downloads
    environment:
      - PORT=8090
      - HOST=0.0.0.0
      - DISPLAY=:99
      - PYTHONUNBUFFERED=1
    shm_size: 1gb
    deploy:
      resources:
        limits:
          memory: 2G
```

### Step 2: Build and Launch Container
Run the build and start commands via terminal or CasaOS CLI:

```bash
# Build the Docker image with Chromium and PDF.js viewer
docker compose build

# Start container in detached mode
docker compose up -d
```

### Step 3: Verify Container Health and Port Exposure
Check container status and logs:

```bash
docker compose ps
docker logs --tail 20 studocu-dl
```

Expected log output:
```text
🌐 [BrowserManager] Khởi động Warm Chromium Daemon (Port 9222, Profile: /app/downloads/.browser_session)...
✨ [BrowserManager] Chromium Daemon đã sẵn sàng nhận lệnh CDP!
INFO:     Uvicorn running on http://0.0.0.0:8090 (Press CTRL+C to quit)
```

### Step 4: Access Web Interface and In-Browser Viewer
1. Open your browser and navigate to:
   ```
   http://<SERVER_IP>:8090/
   ```
2. Enter any Studocu document URL and click **Tải tài liệu**.
3. Once completed, view the downloaded PDF directly in the browser via the integrated PDF.js reader:
   ```
   http://<SERVER_IP>:8090/viewer/web/viewer.html?file=/api/documents/<FILENAME>.pdf
   ```

### Step 5: (Optional) Register as CasaOS Custom App
1. Open the **CasaOS Dashboard**.
2. Click the **`+`** icon on the top right of the App panel > **Install Custom App**.
3. Fill in the fields:
   - **App Name**: `Studocu Downloader`
   - **Icon URL**: `https://raw.githubusercontent.com/anhduyalpha/Studocu-Downloader/main/studocu_dl/pdfjs/web/images/app-icon.png` (or any PDF icon)
   - **Web UI**: `8090`
   - **Network**: `Bridge`
   - **Port**: `8090 -> 8090`
   - **Volumes**: `/DATA/AppData/studocu-dl/downloads` -> `/app/downloads`
4. Click **Save / Install**.

## 4. Gotchas & Edge Cases
- > [!IMPORTANT]
  > **Shared Memory Allocation (`shm_size`)**: Chromium requires sufficient `/dev/shm` space to render complex vector DOM structures. Setting `shm_size: 1gb` is strictly required to prevent random browser tab crashes (`SIGBUS` or `SIGSEGV`).
- > [!WARNING]
  > **File Permissions on Host Volumes**: By default, files created in root Docker containers may have restrictive permissions. The engine explicitly sets `chmod(0o666)` on exported PDFs and Markdown files so that non-root CasaOS file managers can read, move, or delete them without permission errors.
- **Session Reset Endpoint**: If the browser ever enters an unresponsive state or Cloudflare bans the session, invoke the reset API without restarting the container:
  ```bash
  curl -s http://127.0.0.1:8090/api/reset-session
  ```

## 5. Verification
1. Test server responsiveness:
   ```bash
   curl -I http://127.0.0.1:8090/
   ```
   *Expected*: `HTTP/1.1 200 OK`.
2. Test PDF.js viewer asset serving:
   ```bash
   curl -I http://127.0.0.1:8090/viewer/web/viewer.html
   ```
   *Expected*: `HTTP/1.1 200 OK`.
3. Test document list API:
   ```bash
   curl -s http://127.0.0.1:8090/api/documents | jq .
   ```
   *Expected*: Valid JSON array of downloaded document metadata.

## 6. Changelog
- **2026-09-19 (v1.0.0)**: Initial guide for Docker Compose deployment, PDF.js integration, and CasaOS registration by @anhduy.
