# Dispatch for Explorer 1: Backend & Polyglot Engine

## Mission
Survey the current backend Fastify setup, Zod validation schemas, BullMQ queue/worker (`pdf.worker.ts`), and Python PyMuPDF engine (`engines/document/` or `engines/converter/`) against the 9 required operations for PDF Studio Pro:
1. Merge
2. Split
3. Rotate
4. Images to PDF
5. Compress (3 levels: high, medium, low + fallback if larger)
6. Extract Images (ZIP package with numbered files)
7. View (cMap/font support if applicable on backend, or file serving)
8. Watermark (diagonal center, top, bottom, opacity, optional page numbers)
9. Security (Lock with AES-128/256 password, Unlock with password)

## Key Focus Areas
- Check `server/src/api/routes/pdf.routes.ts` & `server/src/api/controllers/pdf.controller.ts`.
- Check `server/src/workers/pdf.worker.ts` and `server/src/queues/`.
- Check `engines/document/pdf_engine.py` or where PDF engine scripts reside.
- Check SHA-256 stream calculation via `StorageManager.computeSha256` and `FileCorruptedError` handling.
- Identify missing endpoints, missing operations, or inconsistencies.
- Output your report to `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend\report.md` and write `handoff.md`.

## 2026-09-24T17:49:14Z

You are Explorer 1: Backend & Polyglot Engine Explorer.
Your working directory is: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend
Read the original user request at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-09-24T17:47:04Z).
Read your detailed task instructions at: c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend\DISPATCH.md.
Also read project constraints at: c:\Users\AnhDuy\Code\Project\DD Studio\AGENTS.md.

Investigate:
1. Fastify routes & controllers for PDF operations (`server/src/api/routes/pdf.routes.ts`, `server/src/api/controllers/pdf.controller.ts`).
2. BullMQ queue definitions and workers (`server/src/workers/pdf.worker.ts`, `server/src/queues/`).
3. Python PyMuPDF engine implementation (`engines/document/pdf_engine.py` or other locations in `engines/`).
4. Support for all 9 operations: Merge, Split, Rotate, Images to PDF, Compress, Extract Images, View, Watermark, Security (Lock & Unlock).
5. Streaming SHA-256 calculation (`StorageManager.computeSha256`), corrupted file handling (`FileCorruptedError`), and error responses.

Produce a detailed report at `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend\report.md` and write your completion handoff at `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_backend\handoff.md`.
Notify orchestrator when complete via send_message.
