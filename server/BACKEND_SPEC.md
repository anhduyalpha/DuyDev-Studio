# DuyDev Studio - Backend Agent Technical Specification
**Document Version:** 1.0.0  
**Target Ingestion:** LLM Software Engineering Agents & Core Backend Developers  
**System Classification:** Self-Hosted Personal Utility & File Processing Hub  
**Status:** Approved for Implementation  

---

## 1. Architecture Overview

### 1.1 System Boundaries & Environment
DuyDev Studio (DS) Backend operates as a self-hosted, resource-efficient, asynchronous processing platform. It serves the Progressive Web App (PWA) client while isolating CPU- and memory-intensive binary operations (PDF manipulation, media transcoding, OCR parsing, and archive extraction).

```
                      +-------------------------------------------------------+
                      |                      CLIENT TIER                      |
                      |   DuyDev Studio PWA (Desktop & Mobile Standalone)     |
                      +---------------------------+---------------------------+
                                                  | HTTPS / WSS / SSE
                                                  v
                      +-------------------------------------------------------+
                      |                     INGRESS TIER                      |
                      |   Reverse Proxy (Caddy / Nginx)                       |
                      |   - TLS Termination, Rate Limiting, Static Asset CDN  |
                      +---------------------------+---------------------------+
                                                  | HTTP/1.1 (Reverse Proxy)
                                                  v
+-----------------------------------------------------------------------------------------------------+
|                                          BACKEND APPLICATION HOST                                   |
|                                                                                                     |
|  +-----------------------------------------------------------------------------------------------+  |
|  |                              API GATEWAY SERVICE (Fastify v4.x)                               |  |
|  |  - REST Endpoints & Route Controllers        - JWT / Bearer API Key Authentication            |  |
|  |  - Fastify Multipart Streaming Uploader      - JSON Schema Request/Response Validation (Zod)   |  |
|  |  - Server-Sent Events (SSE) Event Hub        - Global Structured Pino Logger                  |  |
|  +------------------------------+-------------------------------+--------------------------------+  |
|                                 |                               |                                   |
|            Enqueue Job Requests |                               | Direct Small Stream               |
|                                 v                               v                                   |
|  +----------------------------------------------+  +---------------------------------------------+  |
|  |           TASK QUEUE BROKER (Redis 7.2)      |  |          SYNCHRONOUS UTILITY RUNTIME        |  |
|  |   - BullMQ Priority Job Queues               |  |   - QR Code Generator & Scanner             |  |
|  |   - Task Progress & State Pub/Sub            |  |   - Hash Calculator (MD5, SHA-256)          |  |
|  |   - Ephemeral Cache & Token Store            |  |   - Base64 & Format Converters              |  |
|  +----------------------+-----------------------+  +---------------------------------------------+  |
|                         |                                                                           |
|                         | Dispatches Background Tasks                                               |
|                         v                                                                           |
|  +-----------------------------------------------------------------------------------------------+  |
|  |                                  ISOLATED WORKER POOL (Node.js / Child Process)               |  |
|  |  +--------------------+  +--------------------+  +--------------------+  +--------------------+  |
|  |  |    PDF Worker      |  |   Media Worker     |  |   Archive Worker   |  |    OCR Worker      |  |
|  |  |  (pdf-lib/Poppler) |  |  (fluent-ffmpeg)   |  | (node-stream-zip / |  |  (tesseract.js /   |  |
|  |  |                    |  |  (LibreOffice CLI) |  |     7zip-bin)      |  |   tesseract-ocr)   |  |
|  |  +--------------------+  +--------------------+  +--------------------+  +--------------------+  |
|  +----------------------------------------------+------------------------------------------------+  |
|                                                 |                                                   |
|                         Reads / Writes Artifacts|                                                   |
|                                                 v                                                   |
|  +-----------------------------------------------------------------------------------------------+  |
|  |                                    PERSISTENCE & STORAGE TIER                                 |  |
|  |  +-----------------------------------------+   +-------------------------------------------+  |  |
|  |  |           METADATA REPOSITORY           |   |            EPHEMERAL FILE STORAGE         |  |  |
|  |  |   SQLite 3 (WAL Mode) via Prisma ORM    |   |   Local Scratch Filesystem (/data/storage) |  |  |
|  |  |   - Users, Jobs, Files, Audit Log       |   |   - /uploads/   /processed/   /temp/      |  |  |
|  |  +-----------------------------------------+   +-------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------------------------+  |
|                                                 |                                                   |
|                                                 v                                                   |
|  +-----------------------------------------------------------------------------------------------+  |
|  |                               EPHEMERAL CLEANUP JANITOR (Cron Daemon)                         |  |
|  |   - Evaluates files WHERE expires_at <= NOW()                                                 |  |
|  |   - Unlinks scratch files from disk and marks DB records as PURGED every 15 minutes            |  |
|  +-----------------------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------------------+
```

### 1.2 Data Flow Logic

#### 1.2.1 Asynchronous Heavy File Processing (PDF Conversion, Compression, Video Transcoding)
1. **Client Upload**: The client initiates a streaming `POST /api/v1/files/upload`. Fastify's `@fastify/multipart` pipes bytes directly to `/data/storage/uploads/{fileId}.bin` without buffering the file in system RAM.
2. **Metadata & Job Enqueue**: The API Gateway records the file record in SQLite, generates a `jobId` (UUID v4), creates a task in BullMQ with the required pipeline config, and returns HTTP 202 Accepted with the `jobId` and SSE endpoint.
3. **SSE Connection**: The client connects to `GET /api/v1/jobs/{jobId}/events`. The API Gateway subscribes to the Redis Pub/Sub channel for `{jobId}`.
4. **Worker Execution**: An isolated worker picks up the job, inspects the binary, executes the processing engine (e.g., Ghostscript / Poppler for PDF compression, FFmpeg for media transcoding), and posts granular percentage progress ticks to Redis.
5. **Completion & Artifact Generation**: The worker outputs the result to `/data/storage/processed/{resultFileId}.ext`, writes the resulting metadata to SQLite, sets a 30-minute expiration timestamp (`expires_at`), and emits a `COMPLETED` event.
6. **Artifact Delivery**: The client downloads the processed file via `GET /api/v1/files/download/{resultFileId}`.

#### 1.2.2 Zero-Extraction Archive Inspection (.ZIP, .RAR, .7Z)
1. **Central Directory Reading**: When the client requests directory inspection for a local or uploaded archive, the backend initializes `node-stream-zip` or `7z` in index-reading mode.
2. **Seekable File Access**: The worker parses the archive's header/central directory via seekable file descriptors. It reads filenames, uncompressed sizes, compression ratios, and folder hierarchies **without extracting single members to disk**.
3. **Hierarchy Cache**: The tree structure is cached in Redis for quick path browsing.
4. **Selective Member Extraction**: When a user requests a single file inside an archive (`GET /api/v1/archive/extract-file`), the worker streams only that specific byte-range/member directly to the client HTTP response stream (`Content-Disposition: attachment; filename="..."`).

---

## 2. Tech Stack Constraints

All implementations MUST conform strictly to the following runtime, library, and framework versions. Deviation without prior architectural review is prohibited.

| Component / Layer | Technology | Exact Version | Justification |
|---|---|---|---|
| **Runtime Environment** | Node.js (Active LTS) | `^22.14.0` | Native ES modules support, enhanced WebStreams API, top-tier V8 performance. |
| **Language** | TypeScript | `^5.4.2` | Strict typing, AST optimization, type-safe API contracts. |
| **HTTP Web Engine** | Fastify | `^4.26.2` | Up to 4x throughput compared to Express; native JSON schema serialization. |
| **Multipart Streaming** | `@fastify/multipart` | `^8.1.0` | Stream directly to disk; caps RAM consumption on large multi-gigabyte uploads. |
| **Task Queue & Broker** | BullMQ | `^5.4.0` | Robust Redis-based job management with automatic backoff, retries, and progress tracking. |
| **Cache & Queue Store** | Redis | `^7.2.4` | High-performance atomic counters, Pub/Sub for SSE, fast cache. |
| **Database Engine** | SQLite 3 | `^3.45.0` (WAL Mode) | Zero-maintenance, single-file ACID persistence optimal for personal self-hosted hubs. |
| **ORM / Query Builder** | Prisma ORM | `^5.11.0` | Type-safe migrations, auto-generated TypeScript clients, robust connection pooling. |
| **Schema Validation** | Zod | `^3.22.4` | Runtime contract validation shared across controller inputs and outputs. |
| **Structured Logger** | Pino | `^8.19.0` | Low overhead JSON logging with process-level asynchronous flushing. |
| **Image Processing** | Sharp | `^0.33.2` | High-speed libvips C-bindings for WebP, AVIF, PNG, JPEG, SVG, and ICO generation. |
| **PDF Manipulation** | `pdf-lib` + Poppler Utils | `pdf-lib ^1.17.1` / Poppler `^24.02` | Native JS PDF editing combined with CLI utilities (`pdftoppm`, `pdfunite`) for fast vector rendering. |
| **Office Conversion** | LibreOffice (Headless) | `^7.6.4` | Production-grade fidelity for DOCX/PPTX/XLSX to PDF rasterization. |
| **Audio/Video Transcoding** | FFmpeg / `fluent-ffmpeg` | FFmpeg `^6.1.1` / `fluent-ffmpeg ^2.1.2` | Hardware-accelerated or multi-threaded media compression and format transcoding. |
| **Archive Inspection** | `node-stream-zip` / `node-7z` | `node-stream-zip ^1.15.0` / `node-7z ^3.2.0` | Direct Central Directory seek without full disk expansion for ZIP, RAR5, and 7Z archives. |
| **OCR Engine** | Tesseract.js / System OCR | `tesseract.js ^5.0.5` / Tesseract `^5.3.4` | Vietnamese & English multilingual character recognition. |
| **QR Code Engine** | `qrcode` / `jsqr` | `qrcode ^1.5.3` / `jsqr ^1.4.0` | Standard matrix encoding (SVG/PNG) and image scanning. |
| **Testing Suite** | Vitest | `^1.4.0` | Blazing fast ESM unit testing; native integration with Vite and TypeScript. |
| **API End-to-End Test** | Supertest | `^6.3.4` | HTTP integration tests using Fastify's native `.inject()` interface. |

---

## 3. Coding Standards & Conventions

### 3.1 Directory Organization
The backend service must follow the standard layered architecture pattern:

```text
server/
├── src/
│   ├── config/              # Environment variables, constants, service configs
│   │   ├── env.config.ts
│   │   └── limits.config.ts
│   ├── api/
│   │   ├── middleware/      # Auth, rate limiting, error handlers, request context
│   │   │   ├── auth.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── routes/          # Fastify route registrations
│   │   │   ├── files.route.ts
│   │   │   ├── jobs.route.ts
│   │   │   ├── archive.route.ts
│   │   │   └── qr.route.ts
│   │   └── controllers/     # Request validation, dispatching, HTTP responses
│   │       ├── files.controller.ts
│   │       ├── jobs.controller.ts
│   │       └── archive.controller.ts
│   ├── services/            # Pure business logic and domain processing
│   │   ├── pdf.service.ts
│   │   ├── media.service.ts
│   │   ├── archive.service.ts
│   │   ├── qr.service.ts
│   │   └── janitor.service.ts
│   ├── workers/             # BullMQ consumer processors
│   │   ├── pdf.worker.ts
│   │   ├── media.worker.ts
│   │   └── ocr.worker.ts
│   ├── queues/              # BullMQ queue definitions and job producers
│   │   └── task.queue.ts
│   ├── storage/             # Disk I/O, streaming helpers, path builders
│   │   └── storage.manager.ts
│   ├── schemas/             # Zod schemas for validation and TypeScript inference
│   │   ├── jobs.schema.ts
│   │   └── files.schema.ts
│   ├── types/               # Domain interfaces, enums, global declarations
│   │   └── index.ts
│   └── app.ts               # Fastify server bootstrapper & plugin loader
├── prisma/
│   ├── schema.prisma        # Prisma data model
│   └── migrations/          # SQL migration files
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/            # Sample test PDFs, archives, and corrupt files
├── tsconfig.json
└── package.json
```

### 3.2 Naming Conventions
- **Files & Directories**: Strictly `kebab-case` with dot qualifiers (`pdf-converter.service.ts`, `task-queue.worker.ts`, `archive.schema.ts`).
- **Classes & Types & Interfaces**: `PascalCase` (`ArchiveInspectorService`, `JobMetadata`, `TaskPayload`). Do NOT prefix interfaces with `I`.
- **Functions & Methods**: `camelCase`, using active verb-noun structure (`extractArchiveEntry()`, `convertDocument()`, `enqueueJob()`).
- **Constants & Enums**: `UPPER_SNAKE_CASE` (`DEFAULT_TTL_MINUTES`, `JOB_STATUS_FAILED`, `SUPPORTED_ARCHIVE_EXTENSIONS`).
- **Database Tables & Columns**: PostgreSQL/SQLite standard: `snake_case` plural for tables (`job_records`, `file_artifacts`), `snake_case` for columns (`created_at`, `mime_type`).

### 3.3 Error Handling Patterns
1. **Never throw untyped errors**: All runtime exceptions must inherit from the base `AppError`.
2. **Standard Exception Class**:
   ```typescript
   export class AppError extends Error {
     constructor(
       public readonly message: string,
       public readonly statusCode: number = 500,
       public readonly code: string = 'INTERNAL_ERROR',
       public readonly details: unknown = null
     ) {
       super(message);
       Object.setPrototypeOf(this, new.target.prototype);
       Error.captureStackTrace(this);
     }
   }
   ```
3. **Standard Error Code Registry**:
   - `BAD_REQUEST_PAYLOAD` (400): Schema validation failure.
   - `UNAUTHORIZED_ACCESS` (401): Missing or invalid Bearer token / API key.
   - `RESOURCE_NOT_FOUND` (404): Job ID or File ID does not exist.
   - `UNSUPPORTED_MEDIA_TYPE` (415): File extension/magic bytes not supported.
   - `FILE_CORRUPTED` (422): PDF, archive, or media stream cannot be parsed.
   - `FILE_SIZE_LIMIT_EXCEEDED` (413): Upload exceeds maximum configured limit.
   - `PROCESSING_TIMEOUT` (504): Transcoding or OCR exceeded maximum run time.

4. **Uniform JSON Error Response**:
   ```json
   {
     "success": false,
     "error": {
       "code": "FILE_CORRUPTED",
       "message": "The uploaded PDF structure is invalid or password-protected.",
       "details": [
         { "field": "password", "issue": "Document requires password for decrypt" }
       ],
       "requestId": "req_01HPX7Y8Z9AKJ2",
       "timestamp": "2026-09-20T07:40:00.000Z"
     }
   }
   ```

### 3.4 Logging Requirements
- **Library**: `pino` with `pino-pretty` exclusively enabled in development mode.
- **Log Serialization**: Logs must be structured JSON format containing standard correlation keys:
  - `requestId` (UUID v4 / nanoid propagated from HTTP request headers)
  - `jobId` (if executing within BullMQ worker context)
  - `durationMs` (elapsed execution time for disk or processing operations)
  - `bytesProcessed` (size of input or output stream)
- **Security Redaction**: Automatically redact `Authorization`, `cookie`, `password`, and file system paths containing operating system usernames (`/Users/...`, `C:\Users\...`).

---

## 4. API Contract Definitions

### 4.1 Authentication Mechanism
- **Mechanism**: Bearer Token or Optional Header Token.
- **Header**: `Authorization: Bearer <API_TOKEN>` or `X-API-Key: <KEY>`.
- **Public vs. Protected**:
  - In `AUTH_MODE=none` (typical local self-hosted LAN setup), all endpoints are accessible without credentials.
  - In `AUTH_MODE=token` (public server / reverse proxy setup), all endpoints except `/health` and static UI assets require a valid token.

---

### 4.2 Endpoint Specifications

#### 4.2.1 File Ingestion
##### `POST /api/v1/files/upload`
Uploads raw file(s) directly to ephemeral storage via disk stream.

- **Request**: `multipart/form-data`
  - `file`: Binary file stream (max 500 MB by default)
  - `purpose`: String (`pdf-convert` | `archive-inspect` | `media-transcode`)
- **Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "fileId": "fil_01HQK8VNZP14D8",
    "originalName": "contract_2026.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 14204850,
    "hashSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "expiresAt": "2026-09-20T08:10:00.000Z"
  }
}
```

---

#### 4.2.2 PDF Processing
##### `POST /api/v1/jobs/pdf`
Enqueues a PDF manipulation task (conversion, compression, merging, password locking).

- **Request**: `application/json`
```json
{
  "fileId": "fil_01HQK8VNZP14D8",
  "operation": "compress",
  "options": {
    "compressionLevel": "medium",
    "targetDpi": 150,
    "stripMetadata": true
  }
}
```
- **Success Response** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "jobId": "job_01HQK8WABC77DF",
    "status": "QUEUED",
    "eventsUrl": "/api/v1/jobs/job_01HQK8WABC77DF/events",
    "pollUrl": "/api/v1/jobs/job_01HQK8WABC77DF"
  }
}
```

---

#### 4.2.3 Archive Inspection & Extraction
##### `POST /api/v1/archive/inspect`
Reads the central directory of an uploaded archive (`.zip`, `.rar`, `.7z`) without decompression.

- **Request**: `application/json`
```json
{
  "fileId": "fil_01HQK8XYZ98765"
}
```
- **Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "archiveName": "Project_Full_Backup_2026.rar",
    "totalFiles": 1482,
    "totalUncompressedBytes": 2297920140,
    "totalCompressedBytes": 1205862400,
    "format": "RAR5",
    "tree": [
      {
        "path": "/src/assets/banner_hero.webp",
        "name": "banner_hero.webp",
        "isDirectory": false,
        "sizeBytes": 3565158,
        "compressedBytes": 1887436,
        "compressionRatio": 0.52,
        "crc32": "A1B2C3D4",
        "lastModified": "2026-09-18T10:14:22.000Z"
      }
    ]
  }
}
```

##### `GET /api/v1/archive/extract-file`
Extracts and streams a single file directly from the archive container.

- **Query Parameters**:
  - `fileId`: String (ID of the uploaded archive)
  - `memberPath`: String (e.g. `/src/assets/banner_hero.webp`)
- **Success Response** (200 OK):
  - `Content-Type`: `application/octet-stream` (or inferred MIME type)
  - `Content-Disposition`: `attachment; filename="banner_hero.webp"`
  - `Transfer-Encoding`: `chunked`

---

#### 4.2.4 QR Code Studio
##### `POST /api/v1/qr/generate`
Synchronous QR Code generation. Supports standard URLs, Wi-Fi credentials, and Vietnamese Banking Standard (VietQR).

- **Request**: `application/json`
```json
{
  "type": "vietqr",
  "payload": {
    "bankBin": "970422",
    "accountNumber": "0987654321",
    "amount": 250000,
    "purpose": "Thanh toan tien hosting"
  },
  "format": "svg",
  "margin": 2,
  "errorCorrectionLevel": "M"
}
```
- **Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "format": "svg",
    "content": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\">...</svg>",
    "dataUrl": "data:image/svg+xml;utf8,<svg>...</svg>"
  }
}
```

---

#### 4.2.5 Job Lifecycle & Real-Time SSE Stream
##### `GET /api/v1/jobs/:jobId/events`
Establishes a Server-Sent Events (SSE) channel for real-time progress updates.

- **Response Headers**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **SSE Stream Data Frames**:
```text
event: progress
data: {"jobId":"job_01HQK8WABC77DF","percentage":45,"stage":"Rasterizing PDF pages","timestamp":1774078800}

event: progress
data: {"jobId":"job_01HQK8WABC77DF","percentage":90,"stage":"Applying lossless compression","timestamp":1774078805}

event: completed
data: {"jobId":"job_01HQK8WABC77DF","percentage":100,"resultFileId":"fil_01HQK8RES9912A","resultSizeBytes":4512000,"originalSizeBytes":14204850,"savingsPct":68.2,"downloadUrl":"/api/v1/files/download/fil_01HQK8RES9912A"}
```

---

## 5. Database Schema & Storage

### 5.1 SQLite Schema (Prisma Data Model)
The service utilizes SQLite in Write-Ahead Logging (`WAL`) mode.

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  CANCELED
}

enum FilePurpose {
  UPLOAD
  PROCESSED_ARTIFACT
  TEMPORARY_SCRATCH
}

model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String    @map("password_hash")
  apiKey       String?   @unique @map("api_key")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  jobs         Job[]

  @@map("users")
}

model Job {
  id           String      @id @default(cuid())
  userId       String?     @map("user_id")
  type         String      // pdf_compress, pdf_convert, media_transcode, ocr
  status       JobStatus   @default(QUEUED)
  progress     Int         @default(0)
  errorMessage String?     @map("error_message")
  optionsJson  String      @map("options_json")
  createdAt    DateTime    @default(now()) @map("created_at")
  startedAt    DateTime?   @map("started_at")
  completedAt  DateTime?   @map("completed_at")

  user         User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  files        FileRecord[]

  @@index([status, createdAt])
  @@map("jobs")
}

model FileRecord {
  id           String      @id @default(cuid())
  jobId        String?     @map("job_id")
  purpose      FilePurpose @default(UPLOAD)
  originalName String      @map("original_name")
  storagePath  String      @map("storage_path")
  mimeType     String      @map("mime_type")
  sizeBytes    BigInt      @map("size_bytes")
  hashSha256   String      @map("hash_sha256")
  isPurged     Boolean     @default(false) @map("is_purged")
  expiresAt    DateTime    @map("expires_at")
  createdAt    DateTime    @default(now()) @map("created_at")

  job          Job?        @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([expiresAt, isPurged])
  @@index([hashSha256])
  @@map("files")
}

model SystemMetric {
  id         Int      @id @default(autoincrement())
  cpuUsage   Float    @map("cpu_usage")
  ramUsage   Float    @map("ram_usage")
  diskFreeGb Float    @map("disk_free_gb")
  recordedAt DateTime @default(now()) @map("recorded_at")

  @@index([recordedAt])
  @@map("system_metrics")
}
```

### 5.2 SQLite WAL Initialization Script
Whenever the SQLite connection pool starts, the engine must execute the following PRAGMA statements:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -64000; -- 64MB memory cache
```

### 5.3 Storage Management & Janitor Protocol
- **Upload Directory**: `/data/storage/uploads/`
- **Artifact Directory**: `/data/storage/processed/`
- **Scratch Directory**: `/data/storage/temp/`
- **Janitor Schedule**: Every 15 minutes, a cron job executes:
  ```sql
  SELECT id, storage_path FROM files 
  WHERE expires_at <= CURRENT_TIMESTAMP AND is_purged = 0;
  ```
  For each matching file:
  1. Unlinks the file from disk (`fs.promises.unlink(storage_path)`).
  2. Sets `is_purged = 1` and clears `storage_path`.

---

## 6. Testing Protocols

### 6.1 Framework & Suite Configuration
- **Test Runner**: Vitest (`vitest.config.ts`) configured with ESM support.
- **Assertion Engine**: Vitest native `expect` with `@testing-library/jest-dom` extensions.
- **Mocking Policy**:
  - File system operations: Utilize temporary isolated test fixtures (`tests/fixtures/sandbox/`).
  - Redis/BullMQ: Mocked with `ioredis-mock` for unit test runs; real Redis container during integration tests.
  - External CLIs (FFmpeg, LibreOffice, Poppler): Wrapper interfaces with mock CLI responses for unit tests; verification fixtures in CI.

### 6.2 Coverage Benchmarks
- **Domain Services (`src/services/`)**: Minimum **85%** branch and line coverage.
- **Route & Input Validation (`src/schemas/`, `src/api/routes/`)**: Minimum **95%** coverage.
- **Storage & Janitor Cleanup Logic (`src/storage/`)**: **100%** critical path coverage (preventing file descriptor leaks or unintended deletions).

### 6.3 Required Test Scenarios
1. **Corrupt File Resilience**:
   - Upload zero-byte PDF -> Expect HTTP 400 with `BAD_REQUEST_PAYLOAD`.
   - Upload encrypted PDF without password -> Expect HTTP 422 with `FILE_CORRUPTED`.
   - Upload invalid ZIP header -> Expect HTTP 422 without server process crash.
2. **Path Traversal Security (Archive Member Extraction)**:
   - Archive contains `../../etc/passwd` or `..\Windows\System32` -> Extraction MUST reject the path and sanitize destination with `SECURITY_EXCEPTION`.
3. **Queue Concurrency & Rate Limiting**:
   - Enqueue 50 concurrent PDF conversions -> Ensure BullMQ respects worker concurrency limits (`maxConcurrency: 4`) without memory exhaustion.
4. **SSE Liveness & Cleanup**:
   - Disconnecting SSE client mid-job must cleanly remove Redis Pub/Sub listener and cancel unneeded child processes.
