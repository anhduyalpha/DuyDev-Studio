# Explorer 3 Report: Testing, Verification & Homeserver Deployment for PDF Studio Pro

**Explorer**: Explorer 3 (Testing, Verification & Deployment Explorer)  
**Date**: 2026-09-24T17:58:00Z  
**Target Repository**: `c:\Users\AnhDuy\Code\Project\DD Studio`  
**Homeserver Target**: `192.168.2.171` (`dellhomesever`)

---

## 1. Executive Summary

This report delivers a comprehensive empirical survey of:
1. **Backend Testing & Coverage**: Audit of `server/tests/unit/pdf.test.ts`, `server/tests/integration/api.test.ts`, and surrounding test suites. Evaluated existing coverage against the 9 required PDF operations (`compress`, `merge`, `split`, `rotate`, `images_to_pdf`, `extract_images`, `view`, `watermark`, `lock`/`unlock`).
2. **TypeScript & Vitest Toolchain**: Configuration and execution status of `tsc --noEmit` and `vitest run` in `server/`.
3. **Frontend Syntax Validation**: Static AST validation (`node --check`) across all JavaScript files in `src/components/tools/pdf/`.
4. **Homeserver Deployment Architecture**: Verification of SSH connectivity, systemd service `dd-studio.service`, `/api/v1/health` status, file synchronization paths, and restart mechanics on `192.168.2.171`.

---

## 2. Backend Test Coverage Survey

### 2.1 Current State of `server/tests/unit/pdf.test.ts`
File path: `server/tests/unit/pdf.test.ts` (187 lines).  
Dependencies used: `vitest`, `pdf-lib` (for generating test fixtures and inspecting output buffers), `prisma`, `StorageManager`, `processPdfJob`.

Currently, `pdf.test.ts` implements only **3 test cases** spanning only **2 operations**:
1. **`compress` (Success)** (lines 79–116):
   - Enqueues job with `operation: 'compress'`, `options: { stripMetadata: true }`.
   - Calls `processPdfJob()`.
   - Verifies `resultFileId` is defined, `job.status === 'COMPLETED'`, `job.progress === 100`, artifact file exists on disk, and cleans up artifacts.
2. **`compress` (Corrupted File Error)** (lines 118–143):
   - Enqueues job pointing to a corrupt file (`'NOT_A_VALID_PDF_STREAM_CONTENT'`).
   - Asserts `processPdfJob()` rejects with `FileCorruptedError`.
   - Verifies `job.status === 'FAILED'` and `job.errorMessage` is recorded.
3. **`rotate` (Per-page JSON Mapping)** (lines 145–185):
   - Enqueues job with `operation: 'rotate'`, `options: { rotations: { '0': 90, '1': 180 } }`.
   - Calls `processPdfJob()`.
   - Uses `pdf-lib` to load the output artifact and asserts page 0 angle is 90° and page 1 angle is 180°.

### 2.2 Coverage Gap Analysis for All 9 PDF Operations

| Operation | Unit Test Exists? | Integration Test Exists? | Python Engine Implemented? | Worker Handling Implemented? | Missing Test Scenarios |
|---|---|---|---|---|---|
| **1. Nén PDF (`compress`)** | ✅ Yes (`pdf.test.ts:79`) | ✅ Yes (`api.test.ts:275`) | ✅ Yes (`pdf_ops_basic.py:18`) | ✅ Yes (`pdf.worker.ts:151`) | - Compression levels: `low`, `medium`, `high`<br>- Size protection fallback (revert to original if compressed size > original)<br>- `targetDpi` option |
| **2. Xoay trang (`rotate`)** | ⚠️ Partial (`pdf.test.ts:145`) | ❌ No | ✅ Yes (`pdf_ops_advanced.py:36`) | ✅ Yes (`pdf.worker.ts:152`) | - Uniform rotation via `angle` option (90°, 180°, 270°)<br>- Specific page subsets via `pages` string (e.g. `'1,3'`)<br>- Integration API test via `POST /api/v1/jobs/pdf` |
| **3. Ghép PDF (`merge`)** | ❌ **No** | ❌ **No** | ✅ Yes (`pdf_ops_basic.py:43`) | ✅ Yes (`pdf.worker.ts:130`) | - Multi-file concatenation order preservation<br>- Resulting page count equals sum of inputs<br>- Handling missing or deleted secondary `fileIds` |
| **4. Tách trang (`split`)** | ❌ **No** | ❌ **No** | ✅ Yes (`pdf_ops_basic.py:65`) | ✅ Yes (`pdf.worker.ts:159`) | - Page range syntax (`'1-3,5'`) extraction<br>- Out-of-bounds page numbers handling<br>- Preservation of vector resolution |
| **5. Ảnh sang PDF (`images_to_pdf`)** | ❌ **No** | ❌ **No** | ⚠️ Partial (`pdf_ops_advanced.py:75`)* | ✅ Yes (`pdf.worker.ts:130`) | - Multi-image input to single PDF<br>- Fitting images into standard A4 portrait (595x842 pt)<br>- Aspect ratio preservation and centering |
| **6. Trích ảnh (`extract_images`)** | ❌ **No** | ❌ **No** | ✅ Yes (`pdf_ops_advanced.py:134`) | ✅ Yes (`pdf.worker.ts:142`) | - Extracting embedded images to `.zip` artifact<br>- Correct naming sequence (`image_001.png`, etc.)<br>- Empty document (0 embedded images) handling |
| **7. Xem PDF (`view`)** | N/A (Client-side) | ⚠️ Partial (`studocu-stream.test.ts`) | N/A | N/A | - Standard file streaming via `/api/v1/files/download/:fileId`<br>- Range request support (HTTP 206)<br>- CDN/cMap & font assets loading |
| **8. Watermark (`watermark`)** | ❌ **No** | ❌ **No** | ✅ Yes (`pdf_ops_advanced.py:103`) | ✅ Yes (`pdf.worker.ts:161`) | - Text watermark placement & rotation (diagonal 45°)<br>- Automatic page numbering (`Trang X / N`)<br>- Opacity and font styling |
| **9. Bảo mật (`lock` / `unlock`)** | ❌ **No** | ❌ **No** | ✅ Yes (`pdf_ops_advanced.py:163`) | ✅ Yes (`pdf.worker.ts:164`) | - `lock`: AES-256 encryption, password verification<br>- `unlock`: decrypt with password<br>- `unlock`: rejection with invalid password error |

*\*Note on `images_to_pdf`*: In `engines/document/pdf_ops_advanced.py:89`, the script currently creates pages matching the input image pixel dimensions (`width=rect.width, height=rect.height`) rather than standard A4 portrait (595x842 pt) as required by R2.4.

### 2.3 Integration Test Coverage (`server/tests/integration/`)
- `server/tests/integration/api.test.ts` (lines 275–313):
  - Tests enqueuing a PDF compression job: `POST /api/v1/jobs/pdf` with `fileId: pdfFileId`, `operation: 'compress'`.
  - Asserts response is HTTP 202 Accepted with `jobId`, `eventsUrl`, and `pollUrl`.
  - Tests polling `GET /api/v1/jobs/:jobId` returning HTTP 200 with job details.
- Currently, NO integration tests exist for:
  - Enqueuing `merge`, `split`, `rotate`, `images_to_pdf`, `extract_images`, `watermark`, `lock`, or `unlock`.
  - SSE real-time event streaming (`GET /api/v1/jobs/:jobId/events`).
  - Validation failure scenarios (e.g., missing required fields, non-existent `fileId`, invalid `operation` name).

---

## 3. TypeScript & Vitest Toolchain Status

### 3.1 Toolchain Configuration
- **TypeScript (`server/tsconfig.json`)**:
  - Target: `ES2022`, Module: `NodeNext`, Resolution: `NodeNext`.
  - Strict mode: `true` (`"strict": true`, `"skipLibCheck": true`).
  - Excludes: `["node_modules", "dist", "tests", "data"]`.
- **Vitest (`server/vitest.config.ts`)**:
  - Globals: `true`, Environment: `'node'`.
  - Include pattern: `['tests/**/*.test.ts']`.
  - **`fileParallelism: false`**: Crucial setting to prevent SQLite file lock contention on `dev.db` when tests run Prisma queries simultaneously.
- **Node Scripts (`server/package.json`)**:
  - `"build": "tsc"`
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:coverage": "vitest run --coverage"`

### 3.2 Execution Results

#### 1. TypeScript Static Typecheck (`npx tsc --noEmit`)
- Execution command: `cd server && npx tsc --noEmit`
- Result: **0 errors**, clean exit code 0.
- Verification verified on Windows local workspace.

#### 2. Vitest Test Suite Execution (`npx vitest run`)
- Execution command: `cd server && npx vitest run`
- Result:
  ```
   Test Files  14 passed (14)
        Tests  76 passed (76)
     Start at  00:50:46
     Duration  13.34s
  ```
- **Redis Resilience Observation**: During local execution, Redis logs warning messages:
  `WARN: BullMQ taskQueue warning/error err: "connect ECONNREFUSED 127.0.0.1:6379"`.
  However, tests pass completely because:
  - `jobs.controller.ts:40` wraps `enqueueJob` in a `try...catch` block.
  - Workers under unit test are called directly via `processPdfJob()` rather than relying on the Redis BullMQ dispatcher daemon.

---

## 4. Frontend JavaScript Syntax & Static Validation

### 4.1 File Inventory in `src/components/tools/pdf/`
There are 15 JavaScript source files:
```
src/components/tools/pdf/
├── PdfWorkspace.js                      # Root workspace & orchestrator
├── components/
│   ├── ConfigPanel.js                   # Dynamic tool configuration controls
│   ├── DropzoneQueue.js                 # Drag & drop upload area with strict MIME filters
│   ├── PdfErrorBanner.js                # Non-intrusive error display
│   ├── PdfHistoryList.js                # Persistent tool processing history
│   ├── PdfModeSelector.js               # Mode navigation tab bar
│   ├── PdfMultiFileWorkspace.js         # Multi-file drag/order workspace (Merge, Images-to-PDF)
│   ├── PdfPageLightboxModal.js          # Fullscreen page preview & inspection modal
│   ├── PdfRotateWorkspace.js            # Visual 4x2 page grid rotation workspace
│   ├── PdfSplitWorkspace.js             # Visual 4x2 page grid extraction workspace
│   ├── PdfViewerInline.js               # PDF.js inline viewing canvas & toolbar
│   └── ResultCard.js                    # Post-processing download & forward action card
└── hooks/
    ├── pdfApi.js                        # Network client (upload, enqueue, poll, SSE)
    ├── usePdfDom.js                     # DOM event delegations & lightbox keyboard listeners
    └── usePdfQueue.js                   # State machine, file validation, execution flow
```

### 4.2 Syntax Verification (`node --check`)
- Command:
  ```bash
  node -e "const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'); function checkDir(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, f.name); if (f.isDirectory()) checkDir(full); else if (f.name.endsWith('.js')) { execFileSync(process.execPath, ['--check', full]); console.log('OK:', path.relative('.', full)); } } } checkDir('src/components/tools/pdf');"
  ```
- Verbatim Output:
  ```
  OK: src\components\tools\pdf\components\ConfigPanel.js
  OK: src\components\tools\pdf\components\DropzoneQueue.js
  OK: src\components\tools\pdf\components\PdfErrorBanner.js
  OK: src\components\tools\pdf\components\PdfHistoryList.js
  OK: src\components\tools\pdf\components\PdfModeSelector.js
  OK: src\components\tools\pdf\components\PdfMultiFileWorkspace.js
  OK: src\components\tools\pdf\components\PdfPageLightboxModal.js
  OK: src\components\tools\pdf\components\PdfRotateWorkspace.js
  OK: src\components\tools\pdf\components\PdfSplitWorkspace.js
  OK: src\components\tools\pdf\components\PdfViewerInline.js
  OK: src\components\tools\pdf\components\ResultCard.js
  OK: src\components\tools\pdf\hooks\pdfApi.js
  OK: src\components\tools\pdf\hooks\usePdfDom.js
  OK: src\components\tools\pdf\hooks\usePdfQueue.js
  OK: src\components\tools\pdf\PdfWorkspace.js
  ```
- Result: **15/15 files passed (100% valid syntax)**.

### 4.3 Architecture Compliance (Single Responsibility & Anti-Fluff)
- **Modularity**: Workspaces (`PdfRotateWorkspace`, `PdfSplitWorkspace`, `PdfMultiFileWorkspace`), Modals (`PdfPageLightboxModal`), and Controls (`ConfigPanel`) are strictly isolated. No "God files" exist.
- **Resource Management**: Canvas object cleanup and thumbnail cancel tokens (`activeRotateToken`, `activeSplitToken`) are properly implemented to avoid OOM when rendering large PDFs.
- **UI Production Minimalism**: Fluff purge confirmed; no marketing filler or parenthetical labels remain.

---

## 5. Homeserver Deployment Architecture & Operational Workflow

### 5.1 Host Specifications & Connectivity
- **Target Host**: `192.168.2.171` (Hostname: `dellhomesever`)
- **User**: `anhduy`
- **Authentication**: Key-based passwordless SSH using ED25519 key (`ssh anhduy@192.168.2.171`)
- **Remote Project Directory**: `/home/anhduy/dd-studio/`
- **Workstation Client IP**: `192.168.2.20`

### 5.2 Systemd Service Configuration
Service definition located at `/etc/systemd/system/dd-studio.service` on homeserver:
```ini
[Unit]
Description=DuyDev Studio Unified Server (PWA + API)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=anhduy
WorkingDirectory=/home/anhduy/dd-studio/server
EnvironmentFile=/home/anhduy/dd-studio/server/.env
ExecStart=/usr/bin/node dist/app.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 5.3 Health Endpoint Status
- Tested endpoint: `http://192.168.2.171:3000/api/v1/health`
- Response:
  ```json
  {
    "status": "UP",
    "version": "1.0.0",
    "runtime": "v20.20.2",
    "uptimeSeconds": 2250,
    "timestamp": "2026-09-24T17:52:00.403Z"
  }
  ```
- HTTP status code: `200 OK`.

### 5.4 Process Lifecycle & Service Restart Mechanics
1. **User Privileges**:
   - The systemd unit runs under `User=anhduy`.
   - General `sudo` commands on the homeserver require a password.
   - However, because `dd-studio.service` has `Restart=always` and `RestartSec=5`, terminating the Node.js process owned by `anhduy`:
     ```bash
     ssh anhduy@192.168.2.171 "pkill -u anhduy -f 'dist/app.js'"
     ```
     immediately prompts systemd to automatically respawn the server with the new build in 5 seconds without requiring `sudo` privileges.
   - Furthermore, `auth.log` shows that previous deployments executed:
     ```bash
     ssh anhduy@192.168.2.171 "sudo /usr/bin/systemctl restart dd-studio.service"
     ```
     (which succeeds when sudo password is provided via stdin or sudo timestamp is active).

### 5.5 Synchronization & Deployment Playbook

Because the project is not managed as a git repo on the local Windows machine, synchronization is performed via `scp` (or `rsync`).

#### Step-by-Step Deployment Procedure:

1. **Build Backend Locally**:
   ```bash
   cd "c:\Users\AnhDuy\Code\Project\DD Studio\server"
   npx tsc
   ```
2. **Sync Frontend Static PWA Assets**:
   ```bash
   scp -r src index.html sw.js package.json anhduy@192.168.2.171:/home/anhduy/dd-studio/
   ```
3. **Sync Python Engine Scripts**:
   ```bash
   scp -r engines/document/pdf_engine.py engines/document/pdf_ops_basic.py engines/document/pdf_ops_advanced.py anhduy@192.168.2.171:/home/anhduy/dd-studio/engines/document/
   ```
4. **Sync Backend Server Files & Compiled Dist**:
   ```bash
   scp -r server/dist server/src server/prisma anhduy@192.168.2.171:/home/anhduy/dd-studio/server/
   ```
5. **Restart Service on Homeserver**:
   ```bash
   ssh anhduy@192.168.2.171 "pkill -u anhduy -f 'dist/app.js'"
   ```
   *(Wait 5 seconds for systemd to restart)*
6. **Verify Health Endpoint**:
   ```bash
   curl.exe -s http://192.168.2.171:3000/api/v1/health
   ```
   *Expected response*: `{"status":"UP", ...}`.

---

## 6. Actionable Recommendations for Upcoming Milestones

### 1. For Milestone M1 (Backend & Polyglot Engine Full Coverage):
- **Compression**: In `server/src/workers/pdf.worker.ts`, ensure `options?.compressionLevel` and `options?.targetDpi` are converted to `--level` and `--dpi` CLI arguments for `pdf_engine.py`. Implement size fallback comparison (`resultSizeBytes > originalSizeBytes`).
- **Images to PDF**: In `engines/document/pdf_ops_advanced.py:cmd_images_to_pdf`, update page creation to fit images into standard A4 portrait (595x842 pt), preserving aspect ratio and centering the image.

### 2. For Milestone M3 (Verification & Test Suite Expansion):
- Expand `server/tests/unit/pdf.test.ts` to include dedicated unit tests for all 9 operations:
  - `merge`: multiple PDFs, assert page count matches sum.
  - `split`: range extraction, assert page count matches range.
  - `rotate`: uniform angle (90/180/270), assert rotation on `pdf-lib` loaded doc.
  - `images_to_pdf`: test converting image buffer to PDF, assert A4 dimensions.
  - `extract_images`: assert output is zip archive containing images.
  - `watermark`: assert text watermark and page numbering.
  - `lock` / `unlock`: assert encryption and successful decryption with password.
- Expand `server/tests/integration/api.test.ts`:
  - Add test suites for enqueuing all operations and verifying SSE progress events.

### 3. For Milestone M4 (Homeserver Sync & Verification):
- Execute the verified SCP synchronization protocol.
- Perform process termination reload.
- Verify HTTP 200 `status: UP` on `/api/v1/health`.
