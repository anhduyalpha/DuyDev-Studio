# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Operator**: Anh Duy (system owner and primary administrator). Operates the suite across localhost, homeserver LAN (`192.168.2.171:3000`), and secure remote tunnel (`duydevstudio.alphadaniel.io.vn`). Needs immediate, unthrottled, high-performance media conversion, document manipulation, and diagnostic utilities without SaaS subscription paywalls or artificial file size caps.
- **Future Target Audience**: Team collaborators and invited secondary users under an upcoming multi-tenant access model with individualized authentication and role-based permission boundaries (RBAC).

## Product Purpose

DuyDev Studio (DS) is a self-hosted progressive web utility hub and high-performance file processing platform. It unifies essential developer, document, and media workflows into a centralized, private workstation, replacing fragmented commercial SaaS tools (Smallpdf, CloudConvert, TinyPNG, Bitly) with zero-cost, privacy-first, native processing power. Success is defined by sub-second tool launch times, seamless 50GB file streaming, zero frontend compilation overhead, and reliable real-time progress feedback.

## Positioning

- **Unthrottled Native Engine Execution**: Unlike commercial freemium converters that restrict file sizes to tens of megabytes and throttle processing speeds, DuyDev Studio delegates CPU-intensive tasks directly to system-native binaries (PyMuPDF, FFmpeg CLI, LibreOffice Headless, Chromium CDP) with zero artificial caps and a 50GB streaming ceiling.
- **Zero-Build PWA Architecture**: Built with native modern ES Modules without client-side bundling (no Vite, Webpack, or npm dependencies on the client), ensuring instant deployments, zero compile latency, and predictable browser execution.

## Operating Context

- **Environments**: Local development (`http://localhost:3000`), Homeserver LAN (`http://192.168.2.171:3000`), and Cloudflare Tunnel (`https://duydevstudio.alphadaniel.io.vn`).
- **Primary Workflows**: Drag-and-drop document conversion (PDF, DOCX, XLSX, media), dynamic QR code management with redirect tracking, zero-extraction archive inspection, A4 quiz worksheet compilation, and file integrity verification.
- **Client Modality**: Progressive Web App (PWA) with standalone window capability on desktop and mobile, Service Worker precaching, and OS Web Share Target integration.

## Capabilities and Constraints

- **Universal Converter**: Bidirectional conversion across 65+ media, raster, vector, and document formats via FFmpeg CLI, Pillow, and LibreOffice Headless.
- **PDF Studio & Viewer**: Vector-level PDF manipulations (merge, split, compress, docx extraction, page rotation) via PyMuPDF, paired with an in-browser canvas reader.
- **Dynamic QR Studio**: SQLite-persisted redirect links (`/q/:slug`) with scan analytics, SVG/PNG rendering, and collapsible design customizations.
- **Zero-Extraction Archive Inspector**: Central Directory seeking for `.zip`, `.rar`, and `.7z` archives using stream pointers, inspecting gigabyte-scale archives without disk extraction.
- **Administrative Guard**: SHA-256 administrative password protection on destructive and sensitive operations (system cache wipe, history reset, diagnostic logs).
- **Core Technical Constraints**:
  - Frontend must remain strictly zero-build Vanilla ES Modules served directly via Fastify static plugin.
  - Backend is a single-port Fastify v4 TypeScript gateway communicating with SQLite WAL via Prisma ORM.
  - Background asynchronous tasks are queued via BullMQ v5 backed by Redis 7.2, streaming ticks via Redis Pub/Sub to Server-Sent Events (SSE).
  - File uploads stream directly to disk with 4MB chunk buffers and a 50GB maximum body size.
- **Explicit Open Decisions**:
  - Full multi-tenant authentication architecture and schema migration (moving from single-operator model to multi-user RBAC).
  - Cloud backup storage integration (S3 / Cloudflare R2 replication).

## Brand Commitments

- **Identity**: DuyDev Studio (DS), subtitle "Studio riêng của Anh Duy".
- **Voice & Copywriting**: Direct, crisp, high-density utility hub tone. Strictly no marketing fluff, tutorial filler, or parenthetical explanations (e.g. banned: `(Ảnh số)`, `(Vector)`, `(Phổ biến)`).
- **Aesthetic Benchmark**: Production-grade minimalism following Linear, Vercel, and Raycast utility standards, anchored by `.agents/rules/ui-standards.md` and `docs/knowledge-base/KI-CON-001-ui-production-minimalism.md`.

## Evidence on Hand

- Verified Fastify gateway (`server/src/app.ts`) and Prisma data model (`server/prisma/schema.prisma`).
- Native engine CLI bridges (`engines/converter/convert_cli.py`, `engines/document/pdf_engine.py`).
- Active deployment on homeserver (`192.168.2.171:3000`) routed through Cloudflare Tunnel (`duydevstudio.alphadaniel.io.vn`).
- Standards and system documentation: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_FLOW.md`, `docs/DECISIONS.md`, and 21+ Knowledge Items in `docs/knowledge-base/`.

## Product Principles

1. **Unthrottled Native Power**: Delegate heavy processing to specialized native CLI engines rather than compromised WebAssembly or JavaScript re-implementations; uphold unconstrained file size ceilings.
2. **Self-Evident UI Minimalism**: Eliminate all marketing fluff, explanatory parentheses, and tutorial clutter; every UI element must be functional, high-density, and self-explanatory.
3. **Zero-Build Agility**: Preserve client-side delivery as pure ES Modules to eliminate bundler fragility, enabling instant reload and maintenance simplicity.
4. **Resilient Asynchrony**: Isolate heavy workloads from the HTTP cycle using BullMQ queues and real-time SSE streaming, ensuring continuous interface responsiveness.

## Accessibility & Inclusion

- Semantic HTML across tool workspaces, dialogs, and navigation with explicit `aria-label`, `role`, and `title` attributes.
- High-contrast visual tokens engineered for dark canvas environments (`#0B0F17` / `#121215`) to ensure readability across desktop monitors and mobile OLED screens.
- Keyboard navigation affordances, including Escape modal dismissal and global search shortcut (⌘K / Ctrl+K).
