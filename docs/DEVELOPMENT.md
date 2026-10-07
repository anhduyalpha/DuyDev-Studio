# Development Guide

> Environment setup, commands, and workflows for DuyDev Studio.

---

## Environment Requirements

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 22+ (ESM support) | Backend runtime |
| npm | 9+ | Package manager |
| Python | 3.10+ | Processing engines |
| Redis | 7.2 | BullMQ job queue + Pub/Sub |
| FFmpeg | latest | Video/audio conversion |
| LibreOffice | latest | DOCX/PPTX/XLSX → PDF |
| 7-Zip | latest | RAR5/7Z archive operations |
| Chromium | latest | Quiz PDF rendering + Studocu CDP |
| Tesseract OCR | latest (optional) | OCR for Vietnamese/English |

**All engines are optional.** The backend starts without them, but specific tools will fail when invoked.

---

## Installation

```bash
# 1. Backend dependencies
cd server
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Initialize SQLite database
npx prisma db push

# 4. Create environment file
cp .env.example .env
# Edit .env as needed (defaults work for local dev)

# 5. Return to project root
cd ..

# 6. Python engine dependencies (optional, per-engine)
pip install PyMuPDF pdf2docx python-docx Pillow   # PDF + converter basics
pip install -r engines/converter/fastapi_app/requirements.txt  # Full converter
```

### Homeserver System Dependencies

```bash
bash scripts/setup_homeserver_engines.sh
# Installs: FFmpeg, LibreOffice, Poppler, Redis, 7-Zip
```

---

## Development

### Start Development Server

```bash
# Single command from project root:
npm run dev

# Or explicitly:
cd server && npx tsx watch src/app.ts
```

This starts the Fastify server with live reload. It serves BOTH the API and the frontend PWA on the same port (default `PORT` from `.env`, typically 3000 or 3001).

**No separate frontend dev server is needed.** The frontend has no build step — files in `src/` are served directly as native ES modules.

### Access

- Open browser: `http://localhost:{PORT}` (check your `.env` for the port)
- API: `http://localhost:{PORT}/api/v1/...`

### Redis Requirement

Redis must be running for BullMQ workers to process jobs:

```bash
# Check Redis status
redis-cli ping  # Should return PONG

# Start Redis (varies by OS)
# Linux: sudo systemctl start redis
# Windows: Redis runs as a service or via WSL
# macOS: brew services start redis
```

Without Redis, the server starts but PDF/converter/quiz processing will not work.

---

## Commands Reference

### From project root

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (delegates to `server/`) |
| `npm run build` | Build backend TypeScript (delegates to `server/`) |
| `npm run start` | Start production server (requires prior build) |

### From `server/` directory

| Command | Description |
|---|---|
| `npx tsx watch src/app.ts` | Dev server with live reload |
| `npx tsc --noEmit` | **Type check (must pass with 0 errors)** |
| `npx tsc` | Compile TypeScript → `dist/` |
| `npx vitest run` | Run all tests |
| `npx vitest` | Run tests in watch mode |
| `npx vitest run --coverage` | Run tests with coverage report |
| `npx prisma generate` | Regenerate Prisma client after schema change |
| `npx prisma db push` | Push schema changes to database |
| `npx prisma migrate dev` | Create and apply migration |
| `npx prisma studio` | Open Prisma Studio (database GUI) |
| `npm run r2:stats` | Show Cloudflare R2 usage statistics |

### Python

| Command | Description |
|---|---|
| `python -m py_compile engines/converter/convert_cli.py` | Syntax check converter |
| `python -m py_compile engines/document/pdf_engine.py` | Syntax check PDF engine |
| `python -m pytest engines/quiz/tests/` | Run quiz engine tests |
| `python -m pytest engines/studocu/tests/` | Run studocu engine tests |

### Commands to AVOID

| Command | Why |
|---|---|
| `node server.cjs` | Dead mock server with fake data. Use `npm run dev` instead. |
| `npm start` (without build) | Runs `node dist/app.js` which requires `npm run build` first |
| `npx serve .` for frontend | Not needed. `npm run dev` serves both API and frontend. |
| Any `vite` / `webpack` command | Frontend has no build step. Native ES modules. |

---

## Verification Workflow

Before declaring any change complete:

```bash
# 1. Type check (MUST pass with 0 errors)
cd server && npx tsc --noEmit

# 2. Run tests
cd server && npx vitest run

# 3. Python syntax check (if engines modified)
python -m py_compile engines/converter/convert_cli.py
python -m py_compile engines/document/pdf_engine.py
```

---

## Build for Production

```bash
cd server
npm run build   # tsc → dist/
```

Output goes to `server/dist/`. Production starts via:

```bash
node dist/app.js
# or via PM2:
pm2 start ecosystem.config.cjs
```

---

## Deployment

### Deploy to Homeserver

```powershell
# From local Windows machine
.\scripts\deploy-prod.ps1

# Or via SSH
ssh anhduy@192.168.2.171 "bash /home/anhduy/dd-studio/scripts/deploy-prod.sh"
```

### Production Endpoints

- **Cloudflare**: `https://duydevstudio.alphadaniel.io.vn`
- **LAN**: `http://192.168.2.171:3000`

### Process Management

```bash
# Homeserver (systemd)
sudo systemctl status dd-studio.service
sudo systemctl restart dd-studio.service

# Or PM2
pm2 start ecosystem.config.cjs
pm2 status
pm2 restart dd-studio
pm2 logs dd-studio
```

---

## Debugging

### Backend

- **Pino structured logging**: Set `LOG_LEVEL=debug` in `.env` for verbose output
- Use `pino-pretty` for readable dev logs: `npm run dev | npx pino-pretty`
- All errors are caught by `server/src/api/middleware/error.middleware.ts` and returned as JSON

### Frontend

- No source maps (native ES modules, code is readable as-is)
- Check browser console for `[Router]`, `[PdfQueue]`, `[Converter]` prefixed messages
- Add `?reset=1` to URL to clear all module state
- Stale content? Bump `CACHE_NAME` in `sw.js` or unregister service worker

### Workers

- BullMQ errors logged via Pino
- Python engine stderr captured and included in error messages
- Check Redis connection: `redis-cli monitor` to watch real-time commands

### Database

- SQLite file: `server/dev.db` (or as configured in `DATABASE_URL`)
- GUI: `cd server && npx prisma studio`
- Raw queries: `sqlite3 server/dev.db`

---

## Environment Variables

Defined in `server/.env` (gitignored). Schema: `server/src/config/env.config.ts`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server listen port |
| `HOST` | `0.0.0.0` | Server bind address |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection |
| `STORAGE_ROOT` | `./data/storage` | Base path for file storage |
| `MAX_UPLOAD_SIZE_MB` | `50000` | Upload size limit |
| `FILE_TTL_MINUTES` | `0` | File expiry (0 = permanent) |
| `JANITOR_INTERVAL_MINUTES` | `15` | Cleanup daemon interval |
| `AUTH_MODE` | `none` | `none` or `token` |
| `API_KEY` | (has default) | API authentication key |
| `HTTPS_PORT` | `3443` | HTTPS companion port |
| `LOG_LEVEL` | `info` | Pino log level |
| `R2_ENABLED` | `false` | Enable Cloudflare R2 storage |
| `STUDOCU_API_URL` | `http://127.0.0.1:8090` | Studocu daemon URL |
