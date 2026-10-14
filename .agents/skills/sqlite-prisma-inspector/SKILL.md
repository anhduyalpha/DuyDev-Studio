---
name: sqlite-prisma-inspector
description: On-demand diagnostic skill for inspecting SQLite databases (server/dev.db) and Prisma schemas in DuyDev-Studio.
activation: on-demand
---

# SQLite & Prisma Inspector Protocol

1. **Schema & Validation Check:**
   - Always inspect `server/prisma/schema.prisma` first to understand model relationships (`HistoryRecord`, `Job`, `FileRecord`, `DynamicQr`).
   - Run validation cleanly via `rtk err npx --prefix server prisma validate`.

2. **Safe Database Inspection via CLI / Node:**
   - Respect SQLite WAL mode (`server/src/lib/prisma.ts`).
   - Run fast, lightweight queries using `node -e` with PrismaClient or `sqlite3 server/dev.db` piped through `head -n 20` to verify actual table rows, sidecar parity, or `deviceId` partitioning without dumping large datasets into the context window.
