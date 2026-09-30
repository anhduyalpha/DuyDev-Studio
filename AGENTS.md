# Agent Instructions & Project Context for DuyDev Studio (DS)

Welcome, AI Coding Agent! This file defines the operational constraints, system architecture, and quality standards for working on **DuyDev Studio (DS)**.

> **PRIMARY ARCHITECTURE SPECIFICATION**:  
> Always read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) and [docs/BACKEND_SPEC.md](docs/BACKEND_SPEC.md) before designing or writing code.

---

## 1. What This Project Is
**DuyDev Studio (DS)** is a Personal Self-Hosted Utility Hub & File Processing Suite designed as an offline-first **Progressive Web App (PWA)** running locally, on a personal homeserver (`192.168.2.171`), or public via Cloudflare Tunnel (`duydevstudio.alphadaniel.io.vn`).
It handles:
- PDF Manipulation (Compression, DOCX conversion, merge/split via Python PyMuPDF & LibreOffice).
- Zero-Extraction Archive Inspection (.zip, .rar, .7z via Central Directory seeking).
- Dynamic QR Code Generation (Short URL redirect `/q/:slug`, scan analytics, VietQR EMVCo, `qr-code-styling`).
- Universal File Conversion (65+ formats leveraging pre-pulled open-source engines in `engines/converter/`).
- Hash Checksum & Real-Time System Hardware Telemetry.

---

## 2. Core Agent Constraints (MANDATORY RULES)

### Rule 1: Single Responsibility & Cohesive Modularity (Anti-Monolith & Anti-Fragmentation)
- **Strict Separation of Concerns**:
  - **Presentation Layer (`components/`)**: Focus exclusively on UI layout, markup rendering, and user event dispatching. Do not embed heavy business logic, raw network polling, or direct database access.
  - **Logic & State Layer (`hooks/`, `controllers/`)**: Encapsulate state machines, reactive state transitions, input validation, and async orchestration.
  - **Data & I/O Layer (`services/`, `storage/`, `workers/`)**: Manage communication with backend APIs, database models, file streams, and system engines.
- **Balanced Component Sizing (Avoid Both Extremes)**:
  - **NEVER** write monolithic "God Files" (500+ lines blending multiple unrelated responsibilities).
  - **NEVER** practice "Code Golfing" or "Micro-Fragmentation" (e.g., cramming multiple statements into one line, nesting cryptic ternaries, stripping JSDoc/comments, or artificially splitting cohesive logic just to satisfy an arbitrary line limit).
  - File size must naturally reflect domain responsibility: high cohesion and single purpose. Readability, maintainability, and clean boundaries always take precedence over mechanical line counting.
- **Resource Lifecycle & Defensive Execution**:
  - Always clean up asynchronous resources: close `EventSource` connections, abort pending `fetch` calls via `AbortController`, clear interval/timeout timers, and revoke `ObjectURL`s upon component unmount or route change.
  - Explicit error handling: Every async boundary must have graceful error recovery with user-facing toasts or error banners. Never swallow exceptions with empty `catch {}`.
  - Concurrency safety: Protect high-frequency inputs (live search, live hashing) against race conditions using monotonic sequence tokens, debouncing, or abort signals.

### Rule 2: Polyglot Reuse — Do NOT Re-Invent Engines
- Do NOT code conversion logic from scratch in JavaScript if specialized tools exist.
- We already pulled battle-tested converter engines into `engines/converter/`:
  - `engines/converter/fastapi_app/`: Image, video, audio, office, pdf converters.
  - `engines/converter/file_conversor_core/`: LibreOffice, FFmpeg, pdf2docx, PyMuPDF wrappers.
- The Node.js Fastify backend acts as the Gateway & Orchestrator. It delegates heavy processing to these specialized engines via BullMQ and child processes.

### Rule 3: UI Production Minimalism (Zero Fluff & Zero Marketing Annotations)
- Strictly follow `.agents/rules/ui-standards.md` and `docs/knowledge-base/KI-CON-001-ui-production-minimalism.md`.
- **FORBIDDEN**: Marketing copy, tutorial helper lines under buttons (`"Sẵn sàng in ấn..."`), parenthetical explanations in options (`"PNG (Ảnh số)"`, `"WPA (Phổ biến)"`).
- **REQUIRED**: High information density, developer utility aesthetic (Linear/Vercel style), concise badges, and clean typography (`Geist` + `JetBrains Mono`).

### Rule 4: Personal Unthrottled Server
- This is a personal self-hosted system on LAN (`192.168.2.171`) and Cloudflare (`duydevstudio.alphadaniel.io.vn`).
- Do NOT introduce artificial rate-limiting, captcha, or tight file size caps.
- Bind server to `0.0.0.0` and allow all local network and Cloudflare origins.

### Rule 5: Local-First Development & Git Deployment (No WinSCP / Remote Server Editing)
- Strictly follow `.agents/rules/local-workflow.md`.
- **FORBIDDEN**: Using WinSCP, `scp`, `rsync`, or SSH remote editing to manually copy source files or modify code on the remote server (`192.168.2.171`).
- **FORBIDDEN**: Modifying or testing code directly on the remote server.
- **REQUIRED**: All coding, refactoring, and testing must be performed on the local machine (`c:\Users\AnhDuy\Code\Project\DD Studio`).
- **LOCAL TESTING**: Use ready-made launch scripts in `scripts/`:
  - `.\scripts\start-background.ps1` (or `npm run start:bg`) / `.\start-background.bat`
  - `.\scripts\status-background.ps1` (or `npm run status:bg`)
  - `.\scripts\stop-background.ps1` (or `npm run stop:bg`) / `.\stop-background.bat`
  - Local endpoint: `http://localhost:3000` / `http://127.0.0.1:3000/api/v1/health`
- **DEPLOYMENT**: Deploy exclusively through Git by recording Conventional Commits and pushing to GitHub (`git push origin main`).

---

## 3. Directory Navigation Guide
- **Frontend PWA**: `src/`
  - Components: `src/components/tools/{qr, pdf, archive, converter, hash, image}/`
  - State & Hooks: `src/hooks/` and `src/utilities/persistentStore.js`
  - Router & App Mount: `src/app.js` and `index.html`
- **Backend Gateway**: `server/`
  - Fastify Entry: `server/src/app.ts`
  - Prisma Models: `server/prisma/schema.prisma` (SQLite WAL `dev.db`)
  - Routes & Controllers: `server/src/api/`
  - Background Workers: `server/src/workers/` and `server/src/queues/`
  - Storage Manager: `server/src/storage/storage.manager.ts`
- **Polyglot Engines**: `engines/`
  - Converter Bridge: `engines/converter/convert_cli.py`
  - Pre-pulled modules: `engines/converter/fastapi_app/` and `engines/converter/file_conversor_core/`

---

## 4. Verification Requirements
Before declaring any task complete, you MUST execute and verify:
1. `cd server && npx tsc --noEmit` -> Must pass with **0 errors**.
2. `cd server && npx vitest run` -> All unit and integration test suites must pass.
3. No newly introduced or edited file violates Single Responsibility, resource cleanup standards, or UI anti-filler rules.
