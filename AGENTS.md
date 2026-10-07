# AI Agent Guidelines & Project Map (AGENTS.md)

> Compact operational reference for AI coding agents working on **DuyDev Studio (DS)**.  
> Detailed guides: [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [DATA_FLOW.md](docs/DATA_FLOW.md) · [DEVELOPMENT.md](docs/DEVELOPMENT.md) · [GOTCHAS.md](docs/GOTCHAS.md) · [DECISIONS.md](docs/DECISIONS.md).

---

## Project

- **What it is**: Personal Self-Hosted Progressive Web App (PWA) Utility Hub & File Processing Suite.
- **Where it runs**: Localhost, Homeserver LAN (`192.168.2.171:3000`), and Cloudflare Tunnel (`duydevstudio.alphadaniel.io.vn`).
- **Core Stack**:
  - *Frontend*: Zero-build Vanilla ES Modules, Tailwind CSS (CDN), Lucide Icons, PDF.js, SheetJS.
  - *Backend*: Fastify v4 + TypeScript (strict mode), Prisma ORM, BullMQ v5 + Redis 7.2.
  - *Database*: SQLite WAL mode (`server/dev.db`).
  - *Processing Engines*: Python 3 (PyMuPDF, pdf2docx, Pillow), LibreOffice headless, FFmpeg CLI, Chromium CDP.

---

## Commands

### Verified Working Commands

| Task | Command |
|---|---|
| **Install backend** | `cd server && npm install` |
| **Prisma generate** | `cd server && npx prisma generate` |
| **Prisma push** | `cd server && npx prisma db push` |
| **Development** | `npm run dev` *(or `cd server && npx tsx watch src/app.ts`)* |
| **Build backend** | `cd server && npm run build` *(runs `tsc` → `dist/`)* |
| **Typecheck** | `cd server && npx tsc --noEmit` **(MUST pass with 0 errors)** |
| **Run tests** | `cd server && npx vitest run` |
| **Run single test** | `cd server && npx vitest run tests/unit/pdf.test.ts` |
| **Python syntax check** | `python -m py_compile engines/converter/convert_cli.py` |
| **Deploy (production)** | `.\scripts\deploy-prod.ps1` *(or SSH: `ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio/scripts/deploy-prod.sh"`)* |

### Forbidden / Do NOT Use Commands

- **DO NOT run `node server.cjs`**: `server.cjs` is an obsolete prototype mock server with fake timers.
- **DO NOT run `npm start` in root without building first**: Runs `node dist/app.js` which requires prior `npm run build`.
- **DO NOT run `vite build` or `webpack`**: The frontend is zero-build native ES modules.
- **DO NOT re-run all tests blindly**: Run affected tests first using `codegraph affected` or targeted test files.

---

## Architecture

```
PWA Frontend (Vanilla ES Modules / Hash Router)
  ↓ fetch / EventSource (SSE)
Fastify Gateway (:3000/:3001) [server/src/app.ts]
  ├── @fastify/static (serves index.html & src/ directly)
  ├── Route Validation (Zod schemas)
  ├── StorageManager (Stream to disk, 4MB chunks, SHA-256 inline)
  ├── Prisma Client → SQLite WAL (server/dev.db)
  └── BullMQ Producers → Redis 7.2 Queue Pool
                           ↓
BullMQ Workers (server/src/workers/)
  ├── pdf.worker.ts       → spawn() → engines/document/pdf_engine.py (PyMuPDF)
  ├── converter.worker.ts → spawn() → engines/converter/convert_cli.py (FFmpeg, LibreOffice)
  └── quiz.worker.ts      → spawn() → engines/quiz/ pipeline (AI + Chrome)
                           ↓
Real-Time Progress: Worker stdout JSON → Redis Pub/Sub → SSE → Browser
Storage: /data/storage/ (uploads/, processed/, temp/, drive/)
```

---

## Important File Responsibilities

| Path | Responsibility |
|---|---|
| `index.html` | PWA entry point; loads Tailwind CDN, Lucide, fonts, and `src/app.js`. |
| `src/app.js` | App bootstrapper; hash-based SPA router (`handleRoute`); cleanups. |
| `sw.js` | Service worker; precaching; Web Share Target interceptor (`ds_share_db`). |
| `src/components/tools/{name}/` | Modular tool workspaces (PDF, QR, Converter, Archive, Hash, Quiz, Studocu). |
| `src/hooks/useToolRegistry.js` | Registry of all active dashboard tools and routes. |
| `src/utilities/moduleState.js` | Client-side persistent state between route transitions. |
| `server/src/app.ts` | Server entry; Fastify plugins; CORS; static server; route registration; worker init. |
| `server/src/api/routes/` | HTTP route declarations for all 13 API modules. |
| `server/src/api/controllers/` | Request handlers validating input with Zod and delegating to services. |
| `server/src/services/` | Core business logic (auth, janitor, dynamic-qr, archive, storage, etc.). |
| `server/src/workers/` | BullMQ queue consumers running Python CLIs via `spawn()`. |
| `server/src/queues/task.queue.ts` | Redis connection, BullMQ queue instances, and Pub/Sub publisher. |
| `server/src/storage/storage.manager.ts` | Filesystem operations, path traversal sandboxing (`sanitizeSafePath`). |
| `server/src/config/env.config.ts` | Zod schema validating environment variables. |
| `server/src/config/limits.config.ts` | System limits, concurrency, timeouts, permanent retention logic. |
| `server/src/lib/errors.ts` | Standardized `AppError` exception hierarchy. |
| `server/prisma/schema.prisma` | Relational database models (User, Job, FileRecord, DynamicQr, HistoryRecord). |
| `engines/converter/convert_cli.py` | Universal CLI bridge for 65+ media, image, and document formats. |
| `engines/document/pdf_engine.py` | PyMuPDF vector processing script (merge, split, compress, docx, rotate). |

---

## Data Flow

1. **Heavy Processing (PDF / Converter / Quiz)**:
   Drop file → `POST /api/v1/files/upload` (streams to `data/storage/uploads/`, saves `FileRecord`) → `POST /api/v1/jobs/*` (enqueues BullMQ job) → Worker spawns Python CLI → Engine streams JSON ticks to stdout → Worker publishes to Redis channel `job:events:{jobId}` → Fastify SSE stream pushes to client → On exit 0, output saved to `data/storage/processed/`, records created in `FileRecord` and `HistoryRecord` → User downloads via `GET /api/v1/files/download/:fileId`.
2. **Dynamic QR Code**:
   `POST /api/v1/qr/dynamic` → inserts `DynamicQr` in SQLite → QR rendered pointing to `/q/:slug` → User scans → Fastify increments `scanCount`, logs `QrScanLog`, responds HTTP 302 redirect.
3. **PWA Share Target**:
   OS share sheet sends multipart `POST /share-target` → Service Worker `sw.js` intercepts → stores in IndexedDB → sends BroadcastChannel message → `src/app.js` opens `ShareTargetModal`.

---

## Conventions

- **Code Intelligence**: Prioritize CodeGraph MCP (`codegraph_explore` passing `projectPath: "C:\\Users\\AnhDuy\\Code\\Project\\DD Studio"`) before broad text scans. Fall back to `ripgrep` for raw strings/configs.
- **Frontend Modularity**: Keep component files focused (<200 lines where practical). Separate presentation (`components/`), state (`hooks/`), and API (`services/`).
- **Resource Lifecycle**: Always clean up resources on unmount: close `EventSource`, cancel pending `fetch` with `AbortController`, clear timers, revoke `URL.revokeObjectURL()`.
- **UI Minimalism**: Strictly enforce `.agents/rules/ui-standards.md`. FORBIDDEN: tutorial filler, marketing buzzwords, parenthetical explanations like `(Ảnh số)`. Use high-density Linear/Vercel utility styling.
- **Error Handling**: Throw `AppError` subclasses (`BadRequestError`, `NotFoundError`, `SecurityException`) on backend. Handled uniformly by `error.middleware.ts`.
- **Branch & Deployment**: Work directly on `main` branch. Production runs at `/home/anhduy/dd-studio` on port 3000 (`dd-studio.service`).

---

## Do Not

- **DO NOT** edit `src/components/tools/pdf/hooks/pdfApi.js` (dead duplicate; edit `src/components/tools/pdf/services/pdfApi.js`).
- **DO NOT** add a frontend bundler (Webpack, Vite, Rollup) or import Node modules into `src/`.
- **DO NOT** swallow errors with empty `catch {}` blocks.
- **DO NOT** rewrite conversion or vector logic in JavaScript when specialized engines exist in `engines/`.
- **DO NOT** introduce artificial rate-limiting, captchas, or file size restrictions (Rule 4: personal unthrottled server).
- **DO NOT** modify `isAllowedStaticAsset()` in `server/src/app.ts` without verifying you are not exposing `server/`, `data/`, or `.env`.

---

## Gotchas

- **Auth Backdoor**: Password `"anhduy123"` always passes verification in `AuthService.verifyPassword()` before checking custom password file. This is intentional for owner recovery.
- **Duplicate `pdfApi.js`**: `src/components/tools/pdf/hooks/pdfApi.js` is unimported dead code; `services/pdfApi.js` is the active file.
- **SW Cache Stale Trap**: When updating frontend files in `src/`, bump `CACHE_NAME` and `?v=` version parameters in `sw.js` (e.g. `v19.1`), or browser will serve stale cached code.
- **CWD Storage Resolution**: Paths resolve to `data/storage/` or `server/data/storage/` depending on whether process runs from project root or `server/`.
- **Hardcoded Paths**: System binaries (LibreOffice, Chrome, Python venv) have hardcoded candidate paths in workers and Python scripts; ensure fallbacks are preserved.
- **Prisma Schema Updates**: Always run `npx prisma db push` and `npx prisma generate` after editing `schema.prisma`.

---

## Testing

```bash
# 1. Typecheck (0 errors required)
cd server && npx tsc --noEmit

# 2. Run unit & integration tests
cd server && npx vitest run

# 3. Python script syntax check
python -m py_compile engines/converter/convert_cli.py
python -m py_compile engines/document/pdf_engine.py
```
