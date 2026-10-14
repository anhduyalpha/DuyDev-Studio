# AI Agent Guidelines & Project Map (AGENTS.md)

> Operational reference for **DuyDev Studio (DS)**.  
> Detailed guides: [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [GOTCHAS.md](docs/GOTCHAS.md) · [DECISIONS.md](docs/DECISIONS.md).

---

## ⚡ Core Protocols & 1-Line Micro-Receipt

1. **CodeGraph-First (Step 0)** ([.agents/rules/codegraph-protocol.md](.agents/rules/codegraph-protocol.md)): Call MCP `codegraph_explore` before reading files. Verify callers before editing shared modules. Test via `git diff --name-only | codegraph affected -p "." --stdin -q`.
2. **Autonomous KI Lifecycle** ([.agents/rules/ki-lifecycle.md](.agents/rules/ki-lifecycle.md)): Pre-flight check [docs/knowledge-base/README.md](docs/knowledge-base/README.md). Post-flight maintain KIs on bug fixes (`KI-FIX`), architecture (`KI-CON`), ops (`KI-HOWTO`), or drift. Sync index table.
3. **Impeccable UI/UX** ([.agents/rules/impeccable-auto.md](.agents/rules/impeccable-auto.md)): Strict design tokens from [src/styles/stitch-tokens.css](src/styles/stitch-tokens.css). Light/Dark parity. Ban marketing filler & parentheticals (`KI-CON-001`). Touch targets $\ge 44\text{px}$, responsive $\ge 360\text{px}$, `window.lucide?.createIcons()`.
4. **Superpowers Discipline** ([.agents/rules/superpowers-protocol.md](.agents/rules/superpowers-protocol.md)): `using-superpowers` bootstrap; 4-phase `systematic-debugging` (no fixes without root cause); `verification-before-completion` (CLI evidence required).
5. **Token-Miser & RTK Protocol** ([.agents/rules/token-miser.md](.agents/rules/token-miser.md)): Always prefix CLI commands with `rtk` (`rtk git`, `rtk err`, `rtk vitest`) to compress terminal noise by 60–90%; no full reads >120 lines; no redundant re-reads; batch tool calls; zero chatter; no code echoes.
6. **Karpathy Coding & Premortem Thinking** ([.agents/rules/deep-coder.md](.agents/rules/deep-coder.md)): 3-point premortem (edge cases, lifecycle/orphans, backward compatibility); simplicity first (minimum code, anti-bloat); surgical precision; surface assumptions early.
7. **On-Demand Diagnostic Skills**: `sqlite-prisma-inspector` ([.agents/skills/sqlite-prisma-inspector/SKILL.md](.agents/skills/sqlite-prisma-inspector/SKILL.md)) for SQLite (`server/dev.db`) & Prisma schema inspection without MCP overhead.

### Mandatory 1-Line Micro-Receipt
Every response modifying or checking code MUST end with:
`✅ [Verify: <cmd->0> | UI: <ok/n-a> | KI: <ID/none>]`

---

## Project Overview & Stack
- **What it is**: Personal PWA Utility Hub & File Processing Suite.
- **Environments**: Localhost, Homeserver LAN (`192.168.2.171:3000`), Cloudflare Tunnel (`studio.duydev.cloud`).
- **Stack**:
  - *Frontend*: Zero-build Vanilla ES Modules, Tailwind CDN, Lucide Icons.
  - *Backend*: Fastify v4 + TypeScript (strict mode), Prisma ORM, BullMQ v5 + Redis 7.2.
  - *Database*: SQLite WAL mode (`server/dev.db`).
  - *Engines*: Python 3 (PyMuPDF, pdf2docx, Pillow), LibreOffice, FFmpeg, Chromium CDP.

---

## Verified Commands

| Task | Command |
|---|---|
| **Install backend** | `cd server && npm install` |
| **Prisma generate/push** | `cd server && npx prisma generate && npx prisma db push` |
| **Build backend** | `cd server && npm run build` *(runs `tsc` → `dist/`)* |
| **Typecheck** | `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit` **(Exit 0)** |
| **Unit tests** | `rtk vitest run [test_path]` |
| **Python check** | `rtk err python -m py_compile <path_to_engine.py>` |
| **Deploy HTTPS** | `.\scripts\deploy-prod.ps1` |

**Forbidden**:
- DO NOT run `node server.cjs` (obsolete mock prototype).
- DO NOT run `vite build` or `webpack` (zero-build native ES modules).
- DO NOT run full test suites blindly; use `codegraph affected`.

---

## Architecture Flow

```
PWA Frontend (Vanilla ES Modules / Hash Router)
  ↓ fetch / EventSource (SSE)
Fastify Gateway (:3000/:3001) [server/src/app.ts]
  ├── @fastify/static (serves index.html & src/)
  ├── Route Validation (Zod) & StorageManager (Stream to disk, 4MB chunks, SHA-256)
  ├── Prisma Client → SQLite WAL (server/dev.db)
  └── BullMQ Producers → Redis Queue Pool → BullMQ Workers (server/src/workers/)
       ├── pdf.worker.ts       → engines/document/pdf_engine.py (PyMuPDF)
       ├── converter.worker.ts → engines/converter/convert_cli.py (FFmpeg/LibreOffice)
       └── quiz.worker.ts      → engines/quiz/ pipeline
            ↓
Progress: Worker stdout JSON → Redis Pub/Sub → Fastify SSE → Browser
Storage: /data/storage/ (uploads/, processed/, temp/, drive/)
```

---

## Key Files & Modules

| Path | Responsibility |
|---|---|
| `index.html` / `src/app.js` | SPA entry, hash router (`handleRoute`), lifecycle cleanups. |
| `sw.js` | Service worker, precache, Web Share Target (`ds_share_db`). |
| `src/hooks/useToolRegistry.js` | Dashboard tools and route registry. |
| `server/src/app.ts` | Fastify entry, plugins, CORS, static routes, worker init. |
| `server/src/api/routes/` | HTTP route definitions (13 API modules). |
| `server/src/services/` | Core logic (auth, janitor, dynamic-qr, archive, storage, drive). |
| `server/src/workers/` | BullMQ worker consumers spawning Python engines. |
| `server/src/storage/storage.manager.ts` | Sandboxed disk operations (`sanitizeSafePath`). |
| `server/src/lib/errors.ts` | Standard `AppError` hierarchy. |
| `engines/converter/convert_cli.py` | 65+ media/document format conversion CLI. |
| `engines/document/pdf_engine.py` | PyMuPDF vector pipeline (merge, split, compress, docx). |

---

## Conventions & Gotchas

- **Surgical Resource Cleanup**: Always close `EventSource`, cancel pending `fetch` (`AbortController`), clear timers, revoke `URL.revokeObjectURL()` on unmount.
- **Auth Backdoor**: Password `"anhduy123"` always passes in `AuthService.verifyPassword()` for recovery.
- **Dead File**: `src/components/tools/pdf/hooks/pdfApi.js` is unimported dead code; use `services/pdfApi.js`.
- **SW Cache Stale Trap**: When updating `src/**`, bump version in `sw.js` (e.g. `v19.2`) to prevent serving stale code.
- **CWD Resolution**: Paths resolve to `data/storage/` or `server/data/storage/` depending on process CWD.
- **No JS Re-implementation**: Never rewrite conversion/vector logic in JS when Python engines exist.
