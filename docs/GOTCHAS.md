# Gotchas

> Dangerous, surprising, and fragile behavior in DuyDev Studio.  
> Read this before making changes. See also [AGENTS.md](../AGENTS.md).

---

## Dead Code

### [CONFIRMED] `server.cjs` is a dead mock server
- **Location**: `server.cjs` (project root)
- **What**: 176-line bare Node.js HTTP server with fake API responses (fake upload, fake SSE progress with hardcoded steps). Completely superseded by `server/src/app.ts`.
- **Danger**: An agent could start this instead of the real server. It will appear to work but serve fake data.
- **Action**: Do NOT start `server.cjs`. The real server is `server/src/app.ts`.

### [CONFIRMED] Duplicate `pdfApi.js` — only one is used
- **Location**: Two files named `pdfApi.js` exist:
  - `src/components/tools/pdf/hooks/pdfApi.js` — **DEAD CODE** (not imported anywhere)
  - `src/components/tools/pdf/services/pdfApi.js` — **ACTIVE** (actually imported by other modules)
- **Danger**: Editing `hooks/pdfApi.js` has no effect.
- **Action**: Always edit `src/components/tools/pdf/services/pdfApi.js`.

---

## Security

### [CONFIRMED] Authentication backdoor
- **Location**: `server/src/services/auth.service.ts` lines 14-16, 48-61
- **What**: Three default passwords are hardcoded as SHA-256 hashes: `"anhduy123"`, `"duydev"`, `"admin"`. The password `"anhduy123"` is checked BEFORE the custom password hash, so it always works as a backdoor even after changing the password.
- **Appears intentional**: Yes (personal project, owner convenience).
- **Action**: Do not remove without understanding. Do not rely on custom password being the only auth.

### [CONFIRMED] Default API key in source code
- **Location**: `server/src/config/env.config.ts` line 29, `server/.env.example` line 20
- **What**: `API_KEY` defaults to `'duydev_super_secret_token_2026'` in the Zod schema. This value is also used as the HMAC secret for session tokens.
- **Impact**: Anyone reading the source knows the default key.
- **Action**: Override via `.env` in production. The `.env` file is gitignored.

### [CONFIRMED] Open CORS policy
- **Location**: `server/src/app.ts` lines 52-57
- **What**: `origin: true` (reflects requester's origin) with `credentials: true`. Any website can make authenticated cross-origin requests.
- **Appears intentional**: Yes (AGENTS.md Rule 4: no rate limiting on personal self-hosted system).
- **Action**: Do NOT tighten CORS unless instructed.

---

## Fragile Path Resolution

### [CONFIRMED] `process.cwd()` affects all storage paths
- **Location**: `server/src/config/env.config.ts` lines 51-57
- **What**: All storage paths (uploads, processed, temp, drive) are resolved relative to `process.cwd()`. When run from `server/` dir (dev), paths resolve to `server/data/storage/`. When run from project root (PM2), paths resolve to `data/storage/`.
- **Impact**: File paths in the database may become invalid if the working directory changes.
- **Action**: Test with both cwd contexts when modifying storage code.

### [CONFIRMED] Hardcoded homeserver paths in workers
- **Location**: `server/src/workers/pdf.worker.ts` lines 29-32 and 41-48
- **What**: Python venv and script paths are hardcoded to `/home/anhduy/dd-studio/engines/...`. The code tries multiple candidates and falls back gracefully.
- **Impact**: Works on the homeserver but fails silently on other systems if no candidate matches.
- **Action**: If changing directory structure, update ALL candidate paths in `resolvePythonBin()` and `resolveEngineScript()`.

### [CONFIRMED] Hardcoded system binary paths in Python engines
- **Locations**:
  - `engines/converter/fastapi_app/converters/docx_converter.py` — LibreOffice paths
  - `engines/converter/file_conversor_core/libreoffice_backend.py` — Scoop path
  - `engines/quiz/rendering/compiler.py` — Chrome/Edge paths for Windows/Mac/Linux
- **Impact**: Engine fails if binaries aren't at expected locations.

---

## Frontend

### [CONFIRMED] No build step — native ES modules
- **What**: The frontend has NO bundler (no Vite, no webpack). Files in `src/` are served directly as native ES modules via `<script type="module">`.
- **Danger**: Do NOT try to add a build step, import npm packages, or use `require()`. This would break the entire frontend architecture.
- **Action**: Use `src/vendor/` for third-party libraries (copy minified JS files).

### [CONFIRMED] Tailwind CSS via CDN runtime parser
- **Location**: `index.html` (CDN script tag)
- **What**: Tailwind's CDN play script parses all templates at runtime. No pre-compilation, no tree-shaking.
- **Impact**: Slower initial load. All utility classes are available but computed on-the-fly.
- **Appears intentional**: Yes (zero-build architecture).

### [CONFIRMED] Service Worker cache versioning is manual
- **Location**: `sw.js` line 6
- **What**: `CACHE_NAME = 'duydev-studio-v19.1'` and asset URLs have `?v=19.1` suffixes. Version must be bumped manually.
- **Danger**: If you change frontend files without bumping the SW version, users will see stale cached content until they hard-refresh.
- **Action**: Update `CACHE_NAME` and `?v=` suffixes in `sw.js` when modifying frontend files. Also update `ASSETS_TO_PRECACHE` if adding new files.

### [CONFIRMED] Legacy route cleanup in app.js
- **Location**: `src/app.js` lines 51-54, 67, 303-310
- **What**: Code explicitly purges `ds_last_route` from localStorage and redirects several legacy hash routes. This is cleanup from prior versions.
- **Action**: Preserve these redirects — they handle bookmarks and saved links from earlier versions.

### [LIKELY] Silent error swallowing
- **Locations**: `src/app.js` lines 54, 111; `sw.js` (multiple `catch {}` blocks)
- **What**: Empty catch blocks that swallow errors without logging.
- **Impact**: Makes debugging harder. Non-critical individually but accumulates.

### [LIKELY] Blob URL memory leak risk
- **Location**: `src/components/tools/pdf/hooks/usePdfQueue.js`
- **What**: `URL.createObjectURL()` for PDF previews may not be revoked promptly if user rapidly switches modes.
- **Impact**: Memory accumulation on long sessions.

---

## Backend

### [CONFIRMED] `as any` type assertion
- **Location**: `server/src/app.ts` line 68
- **What**: Multipart plugin options cast to `any` to bypass Fastify type limitations.
- **Impact**: Minor — works at runtime but hides potential type mismatches.

### [CONFIRMED] Functions defined inside `buildApp()` scope
- **Location**: `server/src/app.ts` lines 176-204
- **What**: `normalizeSafePath()`, `isBlockedSensitivePath()`, `isAllowedStaticAsset()` are standalone functions defined inside the `buildApp()` function body.
- **Impact**: Works correctly (hoisted) but unconventional. Moving them outside could change behavior if future code adds closures.

### [CONFIRMED] `transit.controller.ts` has no route file
- **Location**: `server/src/api/controllers/transit.controller.ts`
- **What**: This controller exists but has no corresponding `transit.route.ts`. It is consumed by `files.route.ts` for R2 transit operations (`/presign`, `/complete-transit`).
- **Action**: Don't create a route file for it — it's used as a helper.

### [LIKELY] SSE race condition
- **Location**: `server/src/api/controllers/jobs.controller.ts`
- **What**: TOCTOU window between subscribing to Redis Pub/Sub and checking if the job already completed. A "POST-SUBSCRIPTION RE-CHECK" mitigation exists but a narrow race window remains.
- **Impact**: Rare — client might miss completion event and need to poll.

### [SUSPECTED] Quiz worker timeout race
- **Location**: `server/src/workers/quiz.worker.ts`
- **What**: Python engine termination timeout may race with final JSON result writing to stdout.
- **Impact**: Could produce truncated output on slow systems.

---

## File Co-dependencies

These file groups must be changed together:

### Adding a new tool
1. `src/components/tools/{name}/` — Workspace + components + hooks
2. `src/hooks/useToolRegistry.js` — Register tool metadata
3. `src/pages/ToolPage.js` — Import and dispatch Workspace
4. `src/app.js` — Add hash route in `renderCurrentView()`
5. `sw.js` — Add critical files to `ASSETS_TO_PRECACHE` (if needed)

### Adding a new API endpoint
1. `server/src/schemas/{name}.schema.ts` — Zod schemas
2. `server/src/api/controllers/{name}.controller.ts` — Handler
3. `server/src/api/routes/{name}.route.ts` — Route definition
4. `server/src/app.ts` — Import + register route
5. `server/src/services/{name}.service.ts` — Service (if needed)

### Adding a new database model
1. `server/prisma/schema.prisma` — Model definition
2. Run `npx prisma db push` (or `prisma migrate dev`)
3. `server/src/types/index.ts` — TypeScript interfaces
4. `server/src/schemas/` — Zod schemas for API validation

### Adding a new BullMQ job type
1. `server/src/queues/task.queue.ts` — New Queue + enqueue function
2. `server/src/workers/{name}.worker.ts` — Worker implementation
3. `server/src/app.ts` — Initialize in `startServer()` + add to graceful shutdown
4. Engine script in `engines/`

### Changing authentication
1. `server/src/services/auth.service.ts` — Backend logic
2. `src/utilities/adminAuth.js` — Frontend (must match hash algorithm)
3. `server/src/config/env.config.ts` — `AUTH_MODE` / `API_KEY`

---

## Things That Look Wrong But Are Intentional

| Observation | Why It's Intentional |
|---|---|
| CORS allows all origins with credentials | Personal self-hosted system — no external users |
| No rate limiting anywhere | Owner's mandate (AGENTS.md Rule 4) |
| `bodyLimit: 50 * 1024 * 1024 * 1024` (50GB) | Designed for large file processing |
| `requestTimeout: 0` (infinite) | Long-running file conversions |
| `connectionTimeout: 0` (infinite) | Same reason |
| Default API key in source | Convenience for personal use, overridden via `.env` |
| Auth backdoor password | Owner always needs access |
| `FILE_TTL_MINUTES` defaults to 0 (permanent) | Files persist until manually deleted |

---

## Uncertain Areas

### [UNKNOWN] `android/` directory state
- Contains Gradle files and a WebView wrapper activity.
- Not well-indexed. Unclear if functional or stub.

### [UNKNOWN] `engines/media/` purpose
- Contains sparse config files. Media conversion handled by `engines/converter/`.
- May be a placeholder or legacy directory.

### [UNKNOWN] Port 3000 vs 3001
- `ecosystem.config.cjs` sets `PORT: 3001`
- `.env.example` sets `PORT=3001`
- README mentions port 3000 for frontend and 3001 for backend
- In unified mode (current), both API and frontend are on the same port.
- The actual port depends on `server/.env` which is gitignored.

### [UNKNOWN] Vendored library versions
- Files in `src/vendor/` are minified with no version comments.
- No mechanism to track or update versions.
