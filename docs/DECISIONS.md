# Architectural Decisions (ADRs)

> Record of significant architectural and design decisions in DuyDev Studio (DS).  
> Every decision is grounded in verified source code and documentation. Where historical motivation is unverified, it is explicitly stated as: *"Historical reason unknown."*

---

## ADR-001: Zero-Build Native ES Modules for Frontend PWA

- **Status**: Accepted & Implemented
- **Context**: Modern web development typically relies on build tools (Vite, Webpack, Rollup) and component frameworks (React, Vue, Svelte).
- **Decision**: The client PWA (`src/`) uses vanilla JavaScript ES2022+ modules served directly via `<script type="module" src="./src/app.js">`. No bundler, transpiler, or minifier runs for the frontend. Third-party vendor libraries (`jszip`, `qr-code-styling`, `highlight.js`, `docx-preview`, `xlsx`) are pre-bundled and checked directly into `src/vendor/`.
- **Consequences**:
  - *Positive*: Zero compilation step during development; sub-millisecond edit-and-refresh cycle; no `package.json` or `node_modules` required for the client bundle; completely predictable runtime execution.
  - *Negative*: Runtime CSS generation via Tailwind CDN script tag blocks the main thread during initial parse; no bundle-level tree-shaking; manual cache busting required via `sw.js` query parameters (`?v=19.1`).

---

## ADR-002: Single-Port Unified Fastify Gateway Serving API & Static Assets

- **Status**: Accepted & Implemented
- **Context**: Traditional web architectures deploy a static asset web server (Nginx/Caddy) reverse-proxying API traffic to an application server.
- **Decision**: Fastify v4 acts as both the REST/SSE API gateway and the static asset server (`@fastify/static` in `server/src/app.ts`), serving `index.html` and SPA fallback routes on a single port (3000/3001).
- **Consequences**:
  - *Positive*: Simplifies homeserver operations (one systemd service `dd-studio.service` or PM2 process); eliminates cross-origin complexity between UI and API on local LAN IP (`192.168.2.171`) and Cloudflare Tunnel.
  - *Negative*: Security filtering for static paths must be handled application-side in Fastify (`isBlockedSensitivePath` and `isAllowedStaticAsset`), which creates risk if path sanitization logic has holes.

---

## ADR-003: Polyglot Subprocess Delegation for File Processing Engines

- **Status**: Accepted & Implemented
- **Context**: File processing tasks (PDF vector parsing, DOCX conversion, video transcoding, OCR) can theoretically be attempted in JavaScript using WebAssembly or npm packages (`pdf-lib`, `ffmpeg.wasm`).
- **Decision**: Node.js Fastify acts strictly as the Gateway, Orchestrator, and Network Streamer. Intensive CPU/binary processing is delegated to native C and Python CLI engines via `child_process.spawn()`:
  - `PyMuPDF` (`fitz`) and `pdf2docx` in `engines/document/` for PDF operations.
  - `FFmpeg` native CLI for audio/video transcoding.
  - `LibreOffice Headless` (`soffice`) for Microsoft Office document conversions.
  - Python `engines/quiz/` for AI document extraction and spatial clustering.
  - Headless Chromium CDP for Studocu bypass in `engines/studocu/`.
- **Consequences**:
  - *Positive*: Near-native C performance; 100% preservation of complex layouts, tables, and fonts; access to mature Python/C libraries without recreating them in JS.
  - *Negative*: Requires system-level binary dependencies (LibreOffice, FFmpeg, Python virtual environments, Chromium); subprocess invocation requires cross-platform path resolution.

---

## ADR-004: SQLite in WAL Mode with Prisma ORM

- **Status**: Accepted & Implemented
- **Context**: Persistent relational storage was required for user records, job tracking, file metadata, QR codes, and telemetry logs.
- **Decision**: Use SQLite embedded database (`server/dev.db`) configured with Write-Ahead Logging (WAL) pragmas:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  ```
- **Consequences**:
  - *Positive*: Zero configuration, zero external database service daemon overhead; instant backups by copying a single `.db` file; WAL allows concurrent readers alongside a writer.
  - *Negative*: Single-writer limitation; database file is locked to a single host machine, preventing distributed multi-node clustering.

---

## ADR-005: BullMQ + Redis for Asynchronous Task Scheduling and Real-Time SSE

- **Status**: Accepted & Implemented
- **Context**: Document conversions, PDF processing, and AI quiz generation can take from seconds to minutes. Synchronous HTTP request-response cycles would result in connection timeouts or proxy dropouts (Cloudflare 100s HTTP timeout).
- **Decision**: Jobs are offloaded to BullMQ queues (`ds-tasks`, `ds-converter-tasks`, `ds-quiz-tasks`) backed by Redis. Progress events are published over Redis Pub/Sub channels (`job:events:{jobId}`) and piped to the browser via Server-Sent Events (`GET /api/v1/jobs/:jobId/events`).
- **Consequences**:
  - *Positive*: Uncoupled long-running tasks from the HTTP request lifecycle; resilient retry mechanics; real-time granular progress ticks (percentage and stage).
  - *Negative*: Hard dependency on an external Redis 7.2 instance; if Redis is down, file processing jobs cannot be scheduled.

---

## ADR-006: Direct-to-Disk Multipart Upload Streaming with 50GB Body Limit

- **Status**: Accepted & Implemented
- **Context**: The server runs on personal homeserver hardware (e.g., 8–16GB RAM) but is required to handle files up to 50GB (video archives, huge datasets).
- **Decision**: Configure `@fastify/multipart` and Fastify with a 50GB body limit (`50 * 1024 * 1024 * 1024`) and stream files directly to disk via Node.js write streams (`highWaterMark: 4MB`), calculating SHA-256 hashes on the fly without accumulating buffers in RAM.
- **Consequences**:
  - *Positive*: Server memory usage remains flat (~50-100MB) regardless of uploaded file size.
  - *Negative*: Ephemeral disk space fills rapidly if large uploads are abandoned; requires the background Janitor daemon to periodically purge scratch files.

---

## ADR-007: Zero-Extraction Archive Inspection via Central Directory Seeking

- **Status**: Accepted & Implemented
- **Context**: Users want to inspect contents of large `.zip`, `.rar`, and `.7z` files and extract single items without uncompressing gigabytes of data to disk.
- **Decision**: Read and parse archive Central Directory headers directly using `node-stream-zip` and `node-7z` seek pointers. Individual files are extracted on demand via stream pipelines directly to HTTP responses.
- **Consequences**:
  - *Positive*: Instant tree generation; zero temporary disk space consumption during inspection; protected against Zip Slip / path traversal attacks.
  - *Negative*: Compressed formats without random seek capability require linear reading; multi-volume split archives are not supported.

---

## ADR-008: Coexistence of Duplicate and Parallel Implementations

- **Status**: Documented Fact
- **Observed Coexistences**:
  1. **`server.cjs` vs `server/src/app.ts`**:
     - *Fact*: `server.cjs` is a standalone Node.js script simulating fake jobs with hardcoded timer intervals.
     - *Historical reason*: Historical prototype mock server created during early frontend development before the TypeScript Fastify backend was implemented. Preserved historically, not currently utilized.
  2. **`src/components/tools/pdf/hooks/pdfApi.js` vs `src/components/tools/pdf/services/pdfApi.js`**:
     - *Fact*: Two files named `pdfApi.js` exist with different hashes. Only `services/pdfApi.js` is imported.
     - *Historical reason*: Refactoring artifact during modularization where API callers were relocated to `services/`, leaving the older copy in `hooks/` orphaned.
  3. **`engines/converter/fastapi_app` vs `engines/converter/file_conversor_core`**:
     - *Fact*: Two separate converter engine trees exist under `engines/converter/`.
     - *Historical reason*: The project adapted two battle-tested upstream open-source repositories (`universal-file-converter` and `file_conversor`), orchestrating both via `convert_cli.py` to maximize format coverage (65+ formats) without rewriting conversion logic.

---

## ADR-009: Permanent Data Retention by Default (`FILE_TTL_MINUTES=0`)

- **Status**: Accepted & Implemented
- **Context**: Online file converter tools delete user files within 1-2 hours.
- **Decision**: Default `FILE_TTL_MINUTES` to `0` in `limits.config.ts`, setting expiration dates to `2099-12-31T23:59:59.999Z`. The Janitor daemon preserves all files referenced by any `HistoryRecord`.
- **Consequences**:
  - *Positive*: Acts as a private digital locker and personal cloud drive on the homeserver; files never vanish without explicit user deletion.
  - *Negative*: Storage space must be monitored manually by the user via the Server/Storage HUD.

---

## ADR-010: Hardcoded Fallback Passwords & Stateless HMAC Session Tokens

- **Status**: Accepted & Implemented
- **Context**: A lightweight authentication model was needed for homeserver administrative endpoints without external OAuth or complex user session databases.
- **Decision**: In `AuthService`, three default passwords (`anhduy123`, `duydev`, `admin`) are verified against pre-computed SHA-256 hashes before checking any custom password file (`admin_pwd.hash`). Authenticated sessions use a 30-day stateless token composed of `{expiresAt}.{hmac_sha256_signature}`.
- **Consequences**:
  - *Positive*: Simple, stateless, survives server restarts without invalidating client logins; owner cannot get locked out.
  - *Negative*: `anhduy123` acts as an indelible backdoor; anyone with access to the source code knows the fallback password.
