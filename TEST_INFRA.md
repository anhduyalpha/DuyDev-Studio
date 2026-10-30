# Media Downloaders Test Infrastructure (TEST_INFRA.md)

## 1. System Overview & Testing Philosophy

The Media Downloader test infrastructure provides comprehensive, deterministic, and opaque-box end-to-end (E2E) verification for the trio of media downloaders in DuyDev Studio (DD Studio):
- **Facebook Downloader** (`#tool/facebook-downloader`): Video, Reel, Post & Photo resolution, streaming proxy with HTTP 206 Partial Content, Studio Drive persistence (`/data/storage/drive/facebook/`), and duplicate detection.
- **Spotify Downloader** (`#tool/spotify-downloader`): Authoritative track resolution, staged search, multi-factor scoring with duration tolerance and anti-remix penalties (KI-FIX-041), 320kbps MP3 stream proxy, and Studio Drive persistence (`/data/storage/drive/spotify/`).
- **Instagram Downloader** (`#tool/instagram-downloader`): Single Reel, Video, Photo, and multi-item Carousel resolution, stream proxy, Studio Drive persistence (`/data/storage/drive/instagram/`), and duplicate detection.

### Core Testing Pillars
1. **Opaque-Box Server Injection**: Fastify's native `app.inject({ method, url, payload, headers })` tests the full HTTP request-reply lifecycle without spinning up external TCP ports or incurring network socket overhead.
2. **Deterministic Sandboxed Execution**: All test storage operations occur in the local sandboxed storage directories (`/data/storage/drive/{facebook,spotify,instagram}/` and `/data/storage/temp/`).
3. **Upstream Network Interception**: Controlled upstream mocks simulate diverse CDN scenarios (200 OK, 206 Partial Content, 404 Not Found, 502 Upstream Down, malformed HTML/JSON) to guarantee offline repeatability and zero reliance on external network flakiness.
4. **Non-Interference Boundary**: Complete isolation from Studocu and Scribd services (`src/components/tools/studocu/**`, `server/src/services/studocu/**`).

---

## 2. 4-Tier Test Architecture

The test suite in `server/tests/e2e/media_downloaders_e2e.test.ts` adheres to the 4-tier methodology:

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 4: Real-World Scenarios (End-to-End User Journeys)     │
│ - OS Share Target Flow -> Resolve -> Stream -> Save Drive   │
│ - Upstream Outage & Network Failure Resilience              │
│ - Concurrent High-Throughput Drive Writes                   │
├─────────────────────────────────────────────────────────────┤
│ Tier 3: Cross-Feature Combinations (Pairwise Interactions)   │
│ - Resolve -> Save -> Check Duplicate Synchronization        │
│ - Drive Overwrite vs Collision Conflict Resolution          │
│ - HTTP 206 Partial Content Stream Range Requests            │
│ - Dynamic Media Format / Quality / Extension Preservation   │
│ - Spotify Staged Anti-Remix Match Scoring (KI-FIX-041)      │
├─────────────────────────────────────────────────────────────┤
│ Tier 2: Boundary & Corner Cases (>=5 per Tool)             │
│ - Dirty conversational text containing embedded URLs        │
│ - Mobile tracking & query parameter stripping               │
│ - Protocol-less inputs (e.g. fb.watch/..., spotify.com/...) │
│ - Invalid domains, malformed schemas, and empty payloads    │
├─────────────────────────────────────────────────────────────┤
│ Tier 1: Feature Coverage (>=5 per Tool)                    │
│ - Facebook: Reel resolve, Photo post, Save Drive, Duplicate │
│ - Spotify: Track resolve, Staged search, Save Drive, Stream │
│ - Instagram: Reel resolve, Carousel, Save Drive, Duplicate  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Inventory & Test Coverage Matrix

| Feature ID | Feature Description | Tier | Test Coverage in `media_downloaders_e2e.test.ts` |
|---|---|---|---|
| **F-01** | Facebook OpenGraph Fast Resolver | Tier 1 | `POST /api/v1/facebook/resolve` (Reel & Post with video) |
| **F-02** | Facebook URL Regex & Protocol Handling | Tier 2 | Dirty text, `fb.watch`, protocol-less `facebook.com` |
| **F-03** | Facebook Isolated History Container | Tier 3 | History persistence & DOM state verification |
| **F-04** | Facebook Native APK Download Bridge | Tier 1 & 4 | `GET /api/v1/facebook/stream?download=true` header validation |
| **F-05** | Facebook Registry Tier & Metadata | Tier 1 | Registry definition inspection (`tier: 'UR'`) |
| **F-06** | Facebook Save to Studio Drive | Tier 1 & 3 | `POST /api/v1/facebook/save-drive` with metadata sidecar |
| **F-07** | Facebook Drive Duplicate Detection | Tier 1 & 3 | `POST /api/v1/facebook/check-duplicate` before and after save |
| **F-08** | Spotify Staged Fallback Search | Tier 1 | `POST /api/v1/spotify/resolve` multi-tier pipeline |
| **F-09** | Spotify Anti-Remix Match Scoring (KI-FIX-041) | Tier 3 | Penalty math, duration tolerance (>15s rejected), topic bonus |
| **F-10** | Spotify Title & Artist Sanitization | Tier 2 | Regex sanitization stripping bracket clutter |
| **F-11** | Spotify Stream Proxy & Audio Preservation | Tier 1 & 3 | `GET /api/v1/spotify/stream` with Range and MIME verification |
| **F-12** | Spotify Studio Drive Persistence | Tier 1 & 3 | `POST /api/v1/spotify/save-drive` with 320kbps MP3 transcode |
| **F-13** | Spotify Drive Duplicate Detection | Tier 1 & 3 | `POST /api/v1/spotify/check-duplicate` track ID & title checks |
| **F-14** | Instagram Reel & Video Extraction | Tier 1 | `POST /api/v1/instagram/resolve` Reel parsing |
| **F-15** | Instagram Carousel Multi-Line NDJSON Parser | Tier 1 | Multi-item media carousel with type markers |
| **F-16** | Instagram Drive MIME & Extension Preservation | Tier 3 | Image `.jpg` vs Video `.mp4` format alignment |
| **F-17** | Instagram Relative Path Alignment | Tier 1 & 3 | `/instagram/` relative path consistency |
| **F-18** | Instagram Stream Proxy with Partial Content | Tier 3 | `GET /api/v1/instagram/stream` HTTP 206 range chunking |
| **F-19** | Instagram Drive Duplicate Detection | Tier 1 & 3 | `POST /api/v1/instagram/check-duplicate` verification |
| **F-20** | Web Share Target Ingestion | Tier 4 | `POST /share-target` and `GET /share-target` routing |
| **F-21** | Upstream Error & Timeout Resilience | Tier 4 | Graceful 400/502 handling on upstream failure |
| **F-22** | Concurrent High-Throughput Drive Writes | Tier 4 | Parallel writes race-condition and metadata integrity |

---

## 4. Test Runner Commands

All test execution commands are token-miser and RTK-proxy compliant.

### Run Media Downloaders E2E Suite
```powershell
rtk vitest run server/tests/e2e/media_downloaders_e2e.test.ts
```

### Run Unit Tests + E2E Suite
```powershell
rtk vitest run server/tests/unit/media_downloaders.test.ts server/tests/e2e/media_downloaders_e2e.test.ts
```

### Run Full Test Suite with Coverage
```powershell
rtk vitest run server/tests/e2e/media_downloaders_e2e.test.ts --coverage
```

### Fastify TypeScript Typecheck
```powershell
rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit
```

---

## 5. Non-Interference Guarantee

This test infrastructure operates strictly within:
- `server/tests/e2e/media_downloaders_e2e.test.ts`
- `data/storage/drive/{facebook,spotify,instagram}/`
- `data/storage/temp/`

Zero modifications are made to:
- `src/components/tools/studocu/**`
- `server/src/services/studocu/**`
- `server/src/api/routes/studocu.route.ts`
