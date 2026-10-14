# CodeGraph-First Protocol for DuyDev-Studio

## 1. Core Mandate: Step 0 is ALWAYS CodeGraph
Whenever exploring, debugging, refactoring, or navigating code in **DuyDev-Studio**, you MUST query CodeGraph first before reading files or running text searches.

- **MCP Tool (Preferred)**:
  ```json
  call_mcp_tool(
    ServerName: "codegraph",
    ToolName: "codegraph_explore",
    Arguments: {
      "projectPath": "C:\\Users\\AnhDuy\\Code\\Project\\DD Studio",
      "query": "<symbol, route, or feature question>"
    }
  )
  ```
- **CLI Alternative (Terminal & Subagents)**:
  ```bash
  codegraph explore -p "C:\Users\AnhDuy\Code\Project\DD Studio" "<symbol or query>"
  ```
- **Surgical Reads Only**: View only the exact files and line ranges identified by CodeGraph. Do not blindly read files.

---

## 2. Polyglot Architecture Mapping (4 Tiers)

DuyDev-Studio spans 4 distinct language tiers. Use targeted CodeGraph queries to explore each subsystem:

### Tier 1: Frontend SPA (Vanilla ES Modules / Hash Router)
- **Root & Entry**: `src/app.js`, `src/pages/`, `src/components/tools/`, `src/hooks/`
- **Key Modules**: `useToolRegistry`, `useTheme`, `src/components/common/`, `src/services/`
- **Querying Frontend**:
  - `codegraph_explore` query: `"useToolRegistry"`, `"registerTool"`, `"renderView"`, `"DriveDownloader"`
  - Traces client UI components to their service endpoints and hooks in a single call.

### Tier 2: Fastify Gateway (TypeScript & Node.js)
- **Directory**: `server/src/api/routes/`, `server/src/services/`, `server/src/workers/`
- **Key Modules**: `StorageManager`, `DriveService`, `TiktokManager`, `QueuePool`, `PrismaClient`
- **Querying Fastify**:
  - `codegraph_explore` query: `"StorageManager"`, `"DriveService"`, `"registerDriveRoutes"`, `"pdf.worker"`
  - Traces route definitions (`/api/v1/...`) to services, Prisma models, and BullMQ worker queues.

### Tier 3: Processing Engines (Python CLI / Subprocesses)
- **Directory**: `engines/converter/`, `engines/document/`, `engines/quiz/`, `engines/studocu/`
- **Key Modules**: `convert_cli.py`, `pdf_engine.py`, `quiz_engine.py`, `studocu_dl`
- **Querying Engines**:
  - `codegraph_explore` query: `"process_pdf"`, `"convert_format"`, `"generate_quiz"`, `"download_document"`
  - Maps command-line interface arguments, PyMuPDF pipelines, and extraction logic invoked by Fastify workers.

### Tier 4: Native Android Bridge (Kotlin / Java)
- **Directory**: `android/app/src/main/java/vn/alphadaniel/duydevstudio/`
- **Key Modules**: `MainActivity.kt`, `AndroidBridge.kt`, `ShareReceiverActivity.kt`, `UploadWorker.kt`, `DownloadHelper.kt`
- **Querying Android**:
  - `codegraph_explore` query: `"AndroidBridge"`, `"handleShare"`, `"enqueueUpload"`, `"DownloadNotificationManager"`
  - Traces WebView JavaScript interfaces (`@JavascriptInterface`) and native Android background workers.

---

## 3. Mandatory Blast-Radius & Caller Checks

Before modifying shared services, API routes, state managers, or schemas, query CodeGraph for all callers/callees to avoid cascading regressions:

### Critical Modules Requiring Prior Caller Check:
1. **`DriveService`**: Drives Google Drive / direct link file downloads across Fastify routes and workers.
   - Command: `codegraph callers -p "C:\Users\AnhDuy\Code\Project\DD Studio" DriveService`
2. **`StorageManager`**: Manages chunked disk streams, SHA-256 validation, and file persistence.
   - Command: `codegraph callers -p "C:\Users\AnhDuy\Code\Project\DD Studio" StorageManager`
3. **`TiktokManager`**: Handles TikTok audio/video extraction pipelines.
   - Command: `codegraph callers -p "C:\Users\AnhDuy\Code\Project\DD Studio" TiktokManager`
4. **`useTheme`**: Core UI theming state across all tools and components.
   - Command: `codegraph callers -p "C:\Users\AnhDuy\Code\Project\DD Studio" useTheme`
5. **`useToolRegistry`**: Central registry connecting tools to navbar, routes, and launcher cards.
   - Command: `codegraph callers -p "C:\Users\AnhDuy\Code\Project\DD Studio" useToolRegistry`

---

## 4. Smart Affected Testing (`codegraph affected`)

Never execute the full test suite when editing code. Run only tests in the impact graph:
```bash
git diff --name-only | codegraph affected -p "C:\Users\AnhDuy\Code\Project\DD Studio" --stdin -q
```
Execute only the affected test files surfaced by the command.
