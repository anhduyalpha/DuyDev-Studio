# Data Flow

> Traces of the most important workflows in DuyDev Studio.  
> For architecture overview, see [ARCHITECTURE.md](ARCHITECTURE.md).  
> For agent quick reference, see [AGENTS.md](../AGENTS.md).

---

## 1. File Upload → Queue → Process → Download (PDF, Converter, Quiz)

This is the core flow for all heavy processing operations.

```
User drops file into Dropzone component
  → services/pdfApi.js (or converterApi, quizApi) calls fetch()
    → POST /api/v1/files/upload (multipart stream)
      → files.controller.ts receives multipart parts
        → fs.createWriteStream() pipes file to data/storage/uploads/
        → SHA-256 computed inline via Transform stream
        → FileRecord created in SQLite (status, hash, size, expiry)
          → Returns { fileId, fileName, fileSizeBytes }
```

```
Frontend calls POST /api/v1/jobs/pdf (or /converter/job, /quiz/generate)
  → jobs.controller.ts (or converter/quiz controller)
    → Zod validation on request body
      → enqueueJob() / enqueueConverterJob() / enqueueQuizJob()
        → BullMQ adds job to Redis queue
          → Returns { jobId, eventsUrl }
```

```
BullMQ Worker picks up job from queue
  → pdf.worker.ts / converter.worker.ts / quiz.worker.ts
    → Resolve Python binary path (venv candidates → fallback)
    → Resolve engine script path (multiple candidates → existsSync)
    → spawn(pythonBin, [scriptPath, ...args])
      → readline parses stdout JSON lines: {"progress": N, "stage": "..."}
        → publishJobEvent(jobId, 'progress', data) → Redis Pub/Sub
    → On exit code 0:
      → Create FileRecord for output artifact
      → Create HistoryRecord
      → publishJobEvent(jobId, 'completed', resultPayload)
    → On failure:
      → Update Job status to FAILED
      → publishJobEvent(jobId, 'failed', errorPayload)
```

```
Client connects: GET /api/v1/jobs/:jobId/events
  → jobs.controller.ts
    → Creates Redis subscriber for channel `job:events:{jobId}`
    → Sets SSE headers (text/event-stream)
    → Pipes Redis messages to SSE events
    → POST-SUBSCRIPTION RE-CHECK: polls job status after subscribing
      to catch jobs that completed in the gap
    → On client disconnect: unsubscribe from Redis
```

```
User clicks download
  → GET /api/v1/files/download/:fileId
    → files.controller.ts
      → Looks up FileRecord in SQLite
      → Supports HTTP Range headers for partial content
      → Streams file from disk to client
```

### Key Files

| Step | Frontend | Backend | Engine |
|---|---|---|---|
| Upload | `src/components/tools/pdf/services/pdfApi.js` | `server/src/api/controllers/files.controller.ts` | — |
| Enqueue | Same API module | `server/src/api/controllers/jobs.controller.ts` | — |
| Process | — | `server/src/workers/pdf.worker.ts` | `engines/document/pdf_engine.py` |
| Progress | SSE via EventSource | `server/src/queues/task.queue.ts` (pub/sub) | stdout JSON lines |
| Download | fetch() | `server/src/api/controllers/files.controller.ts` | — |
| History | `src/pages/HistoryPage.js` | `server/src/api/controllers/history.controller.ts` | — |

---

## 2. Chunked / Resumable Upload

For large files that may fail mid-upload.

```
Client calls POST /api/v1/files/chunk/init
  → chunk-upload.controller.ts
    → Generates uploadId
    → Creates directory: data/storage/temp/chunks/{uploadId}/
    → Returns { uploadId }
```

```
Client sends chunks: POST /api/v1/files/chunk/upload
  → Each chunk saved as: chunks/{uploadId}/{index}.part
  → Upload tracked by chunk index
```

```
Client calls POST /api/v1/files/chunk/complete
  → Reads all .part files in order
  → Concatenates into single file in data/storage/uploads/
  → Computes SHA-256
  → Creates FileRecord in SQLite
  → Deletes chunk directory
  → Returns { fileId }
```

Orphaned chunk directories (>2 hours old) are cleaned by `JanitorService.cleanupOrphanedChunks()`.

---

## 3. Dynamic QR Code (Create → Scan → Redirect)

```
User fills Dynamic QR form (QrFormDynamic.js)
  → POST /api/v1/qr/dynamic
    → dynamic-qr.controller.ts
      → Validates slug uniqueness (or auto-generates via SlugGeneratorHelper)
      → Creates DynamicQr record in SQLite
      → Returns { id, slug, shortUrl }
```

```
Client renders QR pointing to /q/:slug
  → Uses qr-code-styling library (client-side)
  → Error correction level locked to H (30%)
```

```
User scans QR code
  → GET /q/:slug
    → dynamic-qr.controller.ts
      → Looks up DynamicQr by slug
      → Atomically increments scanCount
      → Creates QrScanLog entry (user-agent, IP, referer)
      → HTTP 302 redirect to targetUrl
```

```
Owner views analytics
  → GET /api/v1/qr/dynamic/:id/analytics
    → Returns scan timeline, top user agents, recent scans
```

### Key Files
- Frontend: `src/components/tools/qr/components/QrFormDynamic.js`
- Backend route: `server/src/api/routes/dynamic-qr.route.ts`
- Controller: `server/src/api/controllers/dynamic-qr.controller.ts`
- Service: `server/src/services/dynamic-qr.service.ts`
- Schema: `server/src/schemas/dynamic-qr.schema.ts`

---

## 4. Archive Inspection (Zero-Extraction)

```
User drops archive file (.zip, .rar, .7z)
  → Upload to server via POST /api/v1/files/upload
    → POST /api/v1/archive/inspect { fileId }
      → archive.controller.ts
        → archive.service.ts reads Central Directory
        → Returns tree structure (name, size, compressed, isDirectory)
```

```
User clicks "Download single file" from tree
  → GET /api/v1/archive/extract-file?fileId=X&entryPath=Y
    → Extracts only the requested file from archive
    → Streams to client with Content-Disposition: attachment
    → Path traversal protection via sanitizeSafePath()
```

### Key Files
- Frontend: `src/components/tools/archive/ArchiveWorkspace.js`, `hooks/useArchiveInspect.js`
- Backend: `server/src/api/controllers/archive.controller.ts`
- Service: `server/src/services/archive.service.ts`

---

## 5. Authentication

```
Client enters password
  → src/utilities/adminAuth.js computes SHA-256 locally
    → POST /api/v1/auth/verify { password }
      → auth.controller.ts
        → AuthService.verifyPassword()
          → Checks against hardcoded defaults ("anhduy123", "duydev", "admin")
          → Then checks data/storage/admin_pwd.hash (custom password)
        → On success: AuthService.generateSessionToken()
          → HMAC-signed token: {expiresAt}.{signature}
          → 30-day TTL
          → Returns { token }
```

```
Subsequent authenticated requests
  → Authorization: Bearer {token}
    → AuthService.validateToken()
      → Validates HMAC signature + expiry
      → OR matches direct API_KEY from env
```

**Warning**: The password `"anhduy123"` always passes verification regardless of any custom password set. This is checked before the custom hash. See [GOTCHAS.md](GOTCHAS.md).

### Key Files
- Frontend: `src/utilities/adminAuth.js`
- Backend: `server/src/services/auth.service.ts`
- Controller: `server/src/api/controllers/auth.controller.ts`
- Route: `server/src/api/routes/auth.route.ts`

---

## 6. Web Share Target (PWA)

```
User shares file/URL to DuyDev Studio from OS share sheet
  → OS sends POST /share-target (multipart)
    → Service Worker intercepts (sw.js)
      → Saves payload to IndexedDB (ds_share_db / ds_share_store)
      → Posts message via BroadcastChannel + client.postMessage
      → Redirects to /#share-target
```

```
App receives share event
  → App.checkAndOpenShareTarget() in src/app.js
    → Polls IndexedDB with backoff (up to 4 retries × 120ms)
    → Merges URL params from hash fragment
    → Opens ShareTargetModal
    → User selects tool to process the shared content
```

### Key Files
- Service Worker: `sw.js` (saveSharePayload function)
- Frontend helper: `src/utilities/shareTargetHelper.js`
- Modal: `src/components/common/ShareTargetModal.js`
- App entry: `src/app.js` (checkAndOpenShareTarget method)
- Manifest: `manifest.webmanifest` (share_target configuration)

---

## 7. Storage Manager (Cloud Drive)

```
User navigates to #storage
  → StoragePage.js renders file browser
    → GET /api/v1/storage/list?path=/
      → storage.controller.ts (requires auth)
        → Reads data/storage/drive/ directory
        → Returns file/folder listing with sizes
```

Operations (all require auth):
- `POST /api/v1/storage/mkdir` → Create directory
- `POST /api/v1/storage/upload` → Upload file to drive
- `GET /api/v1/storage/download` → Download file or ZIP directory
- `PUT /api/v1/storage/rename` → Rename file/folder
- `DELETE /api/v1/storage/delete` → Delete file/folder

All paths sanitized via `StorageManager.sanitizeSafePath()` to prevent path traversal.

---

## 8. Janitor Cleanup Cycle

```
Every JANITOR_INTERVAL_MINUTES (default 15):
  → JanitorService.runJanitorOnce()
    → cleanupOrphanedChunks() — rm temp/chunks/ dirs older than 2h
    → cleanOrphanedR2TransitObjects() — rm R2 transit/ prefix older than 1h
    → cleanupQuizCache() — rm data/cache/quiz/ entries older than 7d
    → If FILE_TTL_MINUTES > 0 (not permanent retention):
      → Find FileRecords where expiresAt <= now AND isPurged = false
      → Exclude files referenced by any HistoryRecord
      → Delete physical files + mark isPurged = true in DB
```

### Key File
- `server/src/services/janitor.service.ts`

---

## 9. Frontend Routing

```
User navigates (click or URL change)
  → window 'hashchange' event
    → App.handleRoute() in src/app.js
      → Closes FileViewer if not PDF view route
      → Calls cleanupCurrentView() — runs all stored cleanup functions
      → Matches hash against route table:
        #                    → DashboardPage
        #tool/{id}           → ToolPage → dispatches to specific Workspace
        #tool/{id}/{sub}     → ToolPage with sub-mode (e.g., pdf-studio/merge)
        #archive             → ArchivePage
        #history / #trash    → HistoryPage
        #server / #settings  → ServerPage
        #storage             → StoragePage
        #view/pdf?file=...   → PDF Reader (FileViewerConnector)
        #share-target        → Dashboard + ShareTargetModal overlay
      → Several legacy routes redirect (e.g., #pdf → #tool/pdf-studio)
      → Updates BottomNav active state
      → Calls window.lucide.createIcons() to render icon SVGs
```

### Key File
- `src/app.js` — `renderCurrentView()` method (lines 300-366)
