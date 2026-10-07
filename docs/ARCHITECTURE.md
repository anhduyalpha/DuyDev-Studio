# Architecture

> Deep architecture reference for DuyDev Studio (DS).  
> For quick agent reference, see [AGENTS.md](../AGENTS.md).  
> For data flows, see [DATA_FLOW.md](DATA_FLOW.md).

---

## System Overview

DuyDev Studio is a single-port full-stack application. One Fastify server serves both the REST API and the PWA frontend. Heavy file processing is delegated to Python engines via BullMQ workers. Real-time progress is streamed via Redis Pub/Sub → SSE.

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT TIER                                │
│  Vanilla JS PWA (Hash-Router SPA, no build step)               │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐            │
│  │ PDF     │ │ QR       │ │ Converter │ │ Archive│ ...         │
│  │Workspace│ │ Studio   │ │ Workspace │ │Wrkspace│             │
│  └────┬────┘ └────┬─────┘ └─────┬─────┘ └───┬────┘            │
│       └───────────┴──────┬──────┴────────────┘                  │
│                    fetch / SSE                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              HTTP REST + SSE (port 3000/3001)
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                    GATEWAY TIER (Fastify v4)                    │
│  Routes (13) → Controllers (13) → Services (13) → Prisma      │
│  @fastify/static (serves PWA) │ StorageManager (filesystem)    │
│  Error Middleware (AppError → JSON) │ Pino structured logging  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           BullMQ Queue Broker (Redis 7.2)                 │   │
│  │  ds-tasks (PDF) │ ds-converter-tasks │ ds-quiz-tasks      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              child_process.spawn()
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│              POLYGLOT ENGINE TIER                               │
│  engines/document/pdf_engine.py  (PyMuPDF)                     │
│  engines/converter/convert_cli.py (Pillow/FFmpeg/LibreOffice)  │
│  engines/quiz/orchestrator/pipeline.py (PyMuPDF + AI + Chrome) │
│  engines/studocu/studocu_dl/engine.py (CDP browser automation) │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│              STORAGE & PERSISTENCE                              │
│  data/storage/uploads/   │ data/storage/processed/              │
│  data/storage/temp/      │ data/storage/drive/                  │
│  server/dev.db (SQLite WAL) │ Cloudflare R2 (optional)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Map

### Frontend (`src/`)

No build step. Native ES Modules served directly by Fastify's `@fastify/static`.

| Component | Path | Responsibility |
|---|---|---|
| **App Bootstrapper** | `src/app.js` | Hash-based SPA router, lifecycle, cleanup |
| **Pages** | `src/pages/*.js` | Route-level view orchestrators (7 pages) |
| **Layout** | `src/components/layout/` | Header, Footer, BottomNav, GlobalTaskDock |
| **Common** | `src/components/common/` | Badge, Dropzone, Tabs, FileViewer, Modals |
| **Tool Modules** | `src/components/tools/{name}/` | Self-contained tool workspaces |
| **Global Hooks** | `src/hooks/` | useTheme, useToolRegistry, usePWAInstall, useFileQueue |
| **Utilities** | `src/utilities/` | formatters, toast, storage, pwa, clipboard, taskCoordinator, jobWatcher, resumableUploader, shareTargetHelper, storageJanitor, moduleState |
| **Services** | `src/services/storageService.js` | Storage API client |
| **Vendor** | `src/vendor/` | jszip, qr-code-styling, highlight.js, xlsx, docx-preview, thinking-orbs |
| **CSS** | `src/styles/` | stitch-tokens.css, studocu.css, highlight-theme.css |
| **Service Worker** | `sw.js` | Offline caching, Share Target API, version `v6.2` |
| **PWA Manifest** | `manifest.webmanifest` | Standalone mode, shortcuts, share_target |

### Frontend Tool Module Pattern

Each tool follows this structure:

```
src/components/tools/{name}/
├── {Name}Workspace.js          # Shell: renders HTML + calls attach*Listeners()
├── components/                  # Sub-components (render functions returning HTML)
├── hooks/
│   ├── use{Name}.js             # Manager class (pub-sub state, business logic)
│   ├── use{Name}Dom.js          # DOM event wiring (querySelector + addEventListener)
│   └── use{Name}Listeners.js    # Event delegation / keyboard shortcuts
├── services/                    # API client functions (fetch calls)
└── utilities/                   # Format helpers, registries
```

**Render pattern**: Functions export `render{Component}()` → returns HTML string. `attach{Component}Listeners()` → wires DOM events, returns cleanup function.

**State pattern**: Custom pub-sub classes with `subscribe(listener)` / `notify()`. No framework reactivity.

### Active Tool Modules

| Tool | Directory | Main Component | State Manager |
|---|---|---|---|
| PDF Studio | `src/components/tools/pdf/` | `PdfWorkspace.js` | `hooks/usePdfQueue.js` (PdfQueueManager) |
| QR Studio | `src/components/tools/qr/` | `QrStudio.js` | `hooks/useQrState.js` (qrState object) |
| Converter | `src/components/tools/converter/` | `ConverterWorkspace.js` | `hooks/useConverter.js` (ConverterManager) |
| Archive | `src/components/tools/archive/` | `ArchiveWorkspace.js` | `hooks/useArchive.js` |
| Archive Compress | `src/components/tools/archive/` | `ArchiveCompressWorkspace.js` | `hooks/useArchiveCompress.js` |
| Hash | `src/components/tools/hash/` | `HashStudio.js` | `hooks/useHashActions.js` |
| Quiz | `src/components/tools/quiz/` | `QuizWorkspace.js` | `hooks/useQuiz.js` |
| Studocu | `src/components/tools/studocu/` | `StudocuWorkspace.js` | `hooks/useStudocu.js` |
| Markdown | `src/components/tools/` | `MarkdownEditor.js` | (inline state) |

---

### Backend (`server/src/`)

Fastify v4 + TypeScript (strict mode). ESM with NodeNext resolution.

| Layer | Path | Responsibility |
|---|---|---|
| **Entry** | `server/src/app.ts` | Fastify setup, CORS, multipart, static, routes, startup |
| **Routes** | `server/src/api/routes/*.route.ts` | 13 route modules defining HTTP endpoints |
| **Controllers** | `server/src/api/controllers/*.controller.ts` | 13 request handlers |
| **Middleware** | `server/src/api/middleware/error.middleware.ts` | Global error handler (AppError → JSON) |
| **Services** | `server/src/services/*.service.ts` | 13 business logic services |
| **Workers** | `server/src/workers/*.worker.ts` | 3 BullMQ workers (pdf, converter, quiz) |
| **Queues** | `server/src/queues/task.queue.ts` | Redis connection, 3 queues, pub/sub helpers |
| **Storage** | `server/src/storage/storage.manager.ts` | Filesystem I/O, path security, SHA-256 |
| **Config** | `server/src/config/env.config.ts` | Zod-validated environment variables |
| **Config** | `server/src/config/limits.config.ts` | Operational limits (upload size, TTL, concurrency) |
| **Lib** | `server/src/lib/prisma.ts` | Prisma client + SQLite WAL pragmas |
| **Lib** | `server/src/lib/logger.ts` | Pino structured logger |
| **Lib** | `server/src/lib/errors.ts` | AppError class hierarchy |
| **Schemas** | `server/src/schemas/*.schema.ts` | 9 Zod validation schemas |
| **Types** | `server/src/types/index.ts` | Domain interfaces and DTOs |

### Backend Request Flow

```
HTTP Request
  → Fastify Router (routes/*.route.ts)
    → Zod Validation (schemas/*.schema.ts)
      → Controller (controllers/*.controller.ts)
        → Service (services/*.service.ts)
          → Prisma / StorageManager / BullMQ enqueue
            → Response (JSON / Stream / SSE)
```

Error at any point → caught by `error.middleware.ts` → uniform JSON response.

---

### Engines (`engines/`)

| Engine | Entry Point | Invoked By | External Dependencies |
|---|---|---|---|
| `converter/` | `convert_cli.py` | `converter.worker.ts` via `spawn` | Pillow, FFmpeg, LibreOffice, Calibre |
| `document/` | `pdf_engine.py` | `pdf.worker.ts` via `spawn` | PyMuPDF (`fitz`), `pdf2docx` |
| `quiz/` | `orchestrator/pipeline.py` | `quiz.worker.ts` via `spawn` | PyMuPDF, AI providers, headless Chrome |
| `studocu/` | `studocu_dl/engine.py` | `studocu-daemon.service.ts` (HTTP) | websockets, Chromium CDP |
| `media/` | (sparse config) | Referenced by converter | FFmpeg |

Workers communicate with engines via stdout JSON lines for progress reporting.

---

## Database Schema

SQLite with WAL mode, managed by Prisma ORM.

File: `server/prisma/schema.prisma`  
Database: `server/dev.db`

| Model | Purpose | Key Fields |
|---|---|---|
| `User` | Admin accounts | username, passwordHash, apiKey |
| `Job` | Background task tracking | type, status (QUEUED/PROCESSING/COMPLETED/FAILED), progress |
| `FileRecord` | Physical file metadata | storagePath, mimeType, sizeBytes, hashSha256, expiresAt, isPurged |
| `SystemMetric` | Hardware telemetry snapshots | cpuUsage, ramUsage, diskFreeGb |
| `DynamicQr` | Short URL QR codes | slug (unique), targetUrl, scanCount |
| `QrScanLog` | QR scan analytics | dynamicQrId, userAgent, ipAddress |
| `HistoryRecord` | User activity log (soft delete) | toolId, fileName, resultFileId, downloadUrl, isDeleted |

Relationships:
- `User` 1:N `Job`
- `Job` 1:N `FileRecord`
- `DynamicQr` 1:N `QrScanLog`

---

## API Endpoints

| Route Module | Prefix | Key Endpoints |
|---|---|---|
| `files.route.ts` | `/api/v1/files` | `POST /upload`, `POST /import-drive`, `GET /download/:fileId`, `GET /view/:fileId` |
| `chunk-upload.route.ts` | `/api/v1/files/chunk` | `POST /init`, `POST /upload`, `POST /complete`, `GET /status` |
| `jobs.route.ts` | `/api/v1/jobs` | `POST /pdf`, `GET /:jobId`, `GET /:jobId/events` (SSE) |
| `converter.route.ts` | `/api/v1/converter` | `POST /detect`, `POST /job` |
| `quiz.route.ts` | `/api/v1/quiz` | `POST /generate` |
| `archive.route.ts` | `/api/v1/archive` | `POST /inspect`, `GET /extract-file`, `POST /compress` |
| `qr.route.ts` | `/api/v1/qr` | `POST /generate`, `POST /decode` |
| `dynamic-qr.route.ts` | `/api/v1/qr/dynamic` | CRUD + analytics, `/q/:slug` redirect |
| `history.route.ts` | `/api/v1/history` | CRUD + `/api/v1/trash` |
| `auth.route.ts` | `/api/v1/auth` | `POST /verify`, `GET /status`, `PUT /change-password` |
| `storage.route.ts` | `/api/v1/storage` | File manager (list, mkdir, rename, delete, upload, download) |
| `studocu.route.ts` | `/api/v1/studocu` | Proxy to Python daemon at `:8090` |
| `viewer.route.ts` | `/api/v1/viewer` | File preview/conversion for universal viewer |

---

## BullMQ Workers

| Worker | Queue Name | Job Name | Engine |
|---|---|---|---|
| `pdf.worker.ts` | `ds-tasks` | `pdf_process` | `engines/document/pdf_engine.py` |
| `converter.worker.ts` | `ds-converter-tasks` | `converter_process` | `engines/converter/convert_cli.py` |
| `quiz.worker.ts` | `ds-quiz-tasks` | `quiz_process` | `engines/quiz/` pipeline |

All workers connect via shared Redis connection from `server/src/queues/task.queue.ts`.

Progress reporting:
1. Python engine writes JSON lines to stdout (`{"progress": 50, "stage": "..."}`)
2. Worker parses via `readline` interface
3. Worker publishes to Redis channel `job:events:{jobId}`
4. SSE endpoint subscribes to channel, pipes events to client

---

## Background Services

| Service | Type | Trigger |
|---|---|---|
| `JanitorService` | `setInterval` | Every `JANITOR_INTERVAL_MINUTES` (default 15) |
| `StudocuDaemonService` | External process | Started at app boot, HTTP proxy to `:8090` |

Janitor responsibilities:
- Purge expired `FileRecord` entries + physical files
- Clean orphaned chunk directories (2h TTL)
- Clean quiz cache (7d TTL)
- Clean R2 transit objects (1h TTL)

---

## Initialization Sequence

`startServer()` in `server/src/app.ts`:

1. `StorageManager.initStorage()` — ensure `data/storage/{uploads,processed,temp,drive}` exist
2. `initSqlitePragmas()` — enable WAL mode, journal_size_limit, synchronous=NORMAL
3. `JanitorService.startJanitor()` — start cleanup daemon
4. `getPdfWorker()` — initialize PDF BullMQ worker
5. `getConverterWorker()` — initialize Converter BullMQ worker
6. `getQuizWorker()` — initialize Quiz BullMQ worker
7. `StudocuDaemonService.ensureDaemonRunning()` — start Studocu Python daemon
8. `buildApp()` — register Fastify plugins, routes, static file server
9. `server.listen()` — bind to `HOST:PORT`
10. (Optional) Start HTTPS companion server on `HTTPS_PORT` if certs exist

## Graceful Shutdown

On `SIGINT` / `SIGTERM`:
1. `JanitorService.stopJanitor()`
2. Close HTTPS server (if running)
3. `closePdfWorker()`, `closeConverterWorker()`, `closeQuizWorker()`
4. `StudocuDaemonService.stopDaemon()`
5. `server.close()`
6. `prisma.$disconnect()`
7. `process.exit(0)`

---

## Communication Mechanisms

| Mechanism | From → To | Purpose |
|---|---|---|
| HTTP REST (fetch) | Client → Server | API calls, file upload/download |
| SSE (EventSource) | Server → Client | Real-time job progress |
| BullMQ (Redis) | Server → Workers | Job dispatch |
| Redis Pub/Sub | Workers → SSE endpoint | Progress event broadcasting |
| `child_process.spawn` | Workers → Python engines | Heavy processing delegation |
| stdout JSON lines | Python engines → Workers | Progress reporting |
| HTTP proxy | Server → Studocu daemon | Studocu operations |
| AWS SDK S3 | Server → Cloudflare R2 | Optional object storage |
| IndexedDB | Service Worker → Client | Share Target file transfer |
| BroadcastChannel | Service Worker → Client | Share Target notifications |

---

## Static File Security

Fastify serves the project root as static files. Access is controlled by:

- `isAllowedStaticAsset()` — whitelist: `/`, `/index.html`, `/manifest.webmanifest`, `/sw.js`, `/favicon.ico`, `/src/*`, `/static/*`, `/pdfjs/*`
- `isBlockedSensitivePath()` — blacklist: `/server`, `/data`, `/engines`, `/certs`, `/.git`, `/.agents`, `/docs`, `/scripts`, `/tests`, `.env`, `.db`, `.key`, `.crt`

Both functions are defined inside `buildApp()` in `server/src/app.ts` (lines 176-204).
