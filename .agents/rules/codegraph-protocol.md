---
activation: always
description: CodeGraph-First Retrieval & Affected Testing Protocol
---

# CodeGraph-First Protocol (Always-On)

1. **Step 0 is ALWAYS CodeGraph**: Before reading files or searching text, call MCP `codegraph_explore` (or CLI `codegraph explore -p "C:\Users\AnhDuy\Code\Project\DD Studio" "<query>"`) to retrieve exact source, symbols, and call paths.
2. **Polyglot Coverage**: Indexes 4 tiers: Frontend SPA (`src/`), Fastify (`server/src/`), Python Engines (`engines/`), Android Kotlin (`android/app/`).
3. **Blast-Radius Pre-Check**: Before modifying shared modules (`DriveService`, `StorageManager`, `TiktokManager`, `useTheme`, `useToolRegistry`), query callers via `codegraph callers -p "<path>" <Symbol>`.
4. **Surgical Reads Only**: Read ONLY exact line ranges surfaced by CodeGraph. Never blind-grep or full-read unindexed files.
5. **Smart Affected Testing**: Run only impact-affected tests:
   `git diff --name-only | codegraph affected -p "C:\Users\AnhDuy\Code\Project\DD Studio" --stdin -q`
