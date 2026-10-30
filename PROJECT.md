# Project: Media Downloaders Audit and Remediation (Facebook, Spotify, Instagram)

## Architecture
DuyDev Studio (DD Studio) is a Personal PWA Utility Hub and File Processing Suite. The media downloader suite consists of 3 dedicated tool modules:
- **Facebook Downloader**: Video, Reel, Post & Photo extraction with high-speed direct OpenGraph crawler and yt-dlp fallback, Studio Drive storage, and isolated DOM history container `#facebookHistoryContainer`.
- **Spotify Downloader**: Authoritative track resolution with 3-tier staged search (`Topic` -> `Official Audio` -> General), multi-factor scoring with duration tolerance and anti-remix penalties (KI-FIX-041), 320kbps MP3 stream proxy, and isolated DOM history container `#spotifyHistoryContainer`.
- **Instagram Downloader**: Reel, Single Photo, and Multi-item Carousel extraction with NDJSON line parser, MIME-type preserved Studio Drive storage, and isolated DOM history container `#instagramHistoryContainer`.

All 3 modules integrate with:
- **Web PWA & Android Native APK**: Service Worker Web Share Target (`sw.js`, `shareTargetHelper.js`), Android Native Bridge (`ShareReceiverActivity.kt`, `MainActivity.kt`), and `smartUrlRouter.js`.
- **Universal Tool Module Standard**: 10 Pillars (`docs/MODULE_STANDARD.md`, `KI-CON-019`), zero-flicker collapsible history (`KI-FIX-040`), mobile ergonomics (touch targets $\ge 44$px, viewport $\ge 360$px), and design tokens (`src/styles/stitch-tokens.css`).
- **Non-Interference Boundary**: Zero modifications permitted in `src/components/tools/studocu/**` or `server/src/services/studocu/**`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Facebook OpenGraph Fast Resolver | Lightweight ~300ms direct crawler for reels, watch, and post URLs before or racing heavy yt-dlp | M1 | survey (FB) |
| 2 | Facebook URL Regex & Protocol Handling | Support `fb.com`, `facebook.com`, `fb.watch`, `fb.gg`, and protocol-less inputs without dropping trailing chars | M1 | survey (FB) |
| 3 | Facebook Isolated History Container | Dedicated `#facebookHistoryContainer` with in-place DOM item mutation and zero full-page flickering | M1 | survey (FB) |
| 4 | Facebook Native APK Download Bridge | Primary download button dispatches via `triggerDownload()` / `AndroidBridge.downloadFile` | M1 | survey (FB) |
| 5 | Facebook Registry Tier & Metadata | Set `tier: 'UR'` for `facebook-downloader` in `useToolRegistry.js` and clean fluff | M1 | survey (FB) |
| 6 | Facebook Mobile Ergonomics & Tokens | Touch targets $\ge 44$px, 360px viewport wrap, CSS design token parity from `stitch-tokens.css` | M1 | survey (FB) |
| 7 | Facebook Resource Teardown | `AbortController` in `FacebookWorkspace.unmount()` and click listener cleanup | M1 | survey (FB) |
| 8 | Spotify Staged Fallback Search | 3-tier query execution (`Topic` -> `Official Audio` -> General) with early exit at score $\ge 80$ | M2 | survey (Spotify) |
| 9 | Spotify Anti-Remix Match Scoring (KI-FIX-041) | Strict penalties (-100 to -60) for remix/live/cover and duration tolerance filtering (>15s disqualified) | M2 | survey (Spotify) |
| 10 | Spotify Title & Artist Sanitization | Surgical regex stripping brackets (`feat`, `remaster`, `deluxe`) without stripping essential song title parentheses | M2 | survey (Spotify) |
| 11 | Spotify Isolated History Container | Dedicated `#spotifyHistoryContainer` with in-place DOM item mutation and zero full-page flickering | M2 | survey (Spotify) |
| 12 | Spotify Active Audio Preservation | Prevent `saveToDrive()` or quality actions from replacing root DOM and destroying `<audio>` playback | M2 | survey (Spotify) |
| 13 | Spotify Mobile Ergonomics & Tokens | Touch targets $\ge 44$px, 360px viewport wrap, CSS design token parity from `stitch-tokens.css` | M2 | survey (Spotify) |
| 14 | Spotify Registry Tier & AbortSignal | Set `tier: 'UR'` in `useToolRegistry.js`, integrate `AbortController` in `SpotifyWorkspace.unmount()` | M2 | survey (Spotify) |
| 15 | Instagram Carousel Multi-Line NDJSON Parser | Robust yt-dlp stdout parser handling newline-delimited JSON and `entries` array without crashing | M3 | survey (Insta) |
| 16 | Instagram Drive MIME & Extension Preservation | Dynamic `.jpg` / `image/jpeg` vs `.mp4` / `video/mp4` preservation when saving to Studio Drive | M3 | survey (Insta) |
| 17 | Instagram Relative Path Alignment | Consistent `/instagram/` relative path formatting between `saveToDrive` and `checkExistingInDrive` | M3 | survey (Insta) |
| 18 | Instagram Isolated History Container | Dedicated `#instagramHistoryContainer` with in-place DOM item mutation and zero full-page flickering | M3 | survey (Insta) |
| 19 | Instagram In-Place Carousel Selection | Switching carousel items updates media preview and download actions in place without root `animate-fadeIn` re-renders | M3 | survey (Insta) |
| 20 | Instagram Mobile Ergonomics & Tokens | Touch targets $\ge 44$px (tabs, extract, clear, download, drive), 360px responsive layout | M3 | survey (Insta) |
| 21 | Cross-Platform Web Share Target & Android Sheet | Seamless URL handoff and auto-start for Facebook, Spotify, and Instagram across PWA and Native APK | M4 | survey (All) |
| 22 | Universal Compliance & Module Standard Audit | All 3 tools pass `python scripts/audit_module_compliance.py` and TypeScript build `tsc --noEmit` | M4 | survey (All) |
| 23 | E2E Testing Suite (Tiers 1-4) | Comprehensive opaque-box test suite verifying end-to-end functionality, boundaries, and scenarios | M4 / E2E Track | survey (All) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Facebook Downloader Remediation | Frontend `FacebookWorkspace.js`, backend route, service, schema, `#facebookHistoryContainer`, OpenGraph fast crawler, `fb.com` regex, touch targets | none | DONE (Verified: Compliance 🟢, tsc 0, unit+e2e 62/62 pass, Auditor CLEAN) |
| M2 | Spotify Downloader Remediation | Frontend `SpotifyWorkspace.js`, backend route, service, schema, `#spotifyHistoryContainer`, anti-remix scoring (KI-FIX-041), audio playback preservation, touch targets | none | DONE |
| M3 | Instagram Downloader Remediation | Frontend `InstagramWorkspace.js`, backend route, service, schema, `#instagramHistoryContainer`, carousel NDJSON parser, image drive MIME fix, in-place preview | none | DONE |
| M4 | Cross-Platform Ergonomics & Final E2E Gate | Cross-platform verification, 100% E2E test pass, forensic audit, compliance audit for all 3 tools, non-interference verification | M1, M2, M3 | DONE (Verified: 157/157 tests passed, 3x Compliance 🟢, tsc 0, studocu 0 diff, Victory Auditor CLEAN) |

## Interface Contracts
### Facebook Downloader Contract
- **POST `/api/v1/facebook/resolve`**:
  - Request: `{ url: string }` (Accepts `facebook.com`, `fb.watch`, `fb.com`, `fb.gg`, with or without `https://`)
  - Response: `{ success: true, data: { id, title, author, mediaType: 'video' | 'photo' | 'post', videoHdUrl?, videoSdUrl?, formats: Array<{ quality, url, label, ext }>, images?: string[], coverUrl?, duration?, driveItem?: { exists: boolean, ... } } }`
- **POST `/api/v1/facebook/save-drive`**:
  - Request: `{ videoUrl, title, id, quality?, originalUrl?, coverUrl?, author? }`
  - Response: `{ success: true, data: { fileId, fileName, relPath: string, sizeBytes, mimeType } }`

### Spotify Downloader Contract
- **POST `/api/v1/spotify/resolve`**:
  - Request: `{ url: string }` (Spotify track, album, playlist link, or ID)
  - Response: `{ success: true, data: { id, title, artist, album, duration: number, coverUrl, streamUrl, downloadUrl, matchScore?: number, source?: string, driveItem?: { exists: boolean, ... } } }`
- **POST `/api/v1/spotify/save-drive`**:
  - Request: `{ audioUrl, title, artist, id, originalUrl?, coverUrl? }`
  - Response: `{ success: true, data: { fileId, fileName, relPath: string, sizeBytes, mimeType: 'audio/mpeg' } }`

### Instagram Downloader Contract
- **POST `/api/v1/instagram/resolve`**:
  - Request: `{ url: string }` (Instagram reel, post, photo, or carousel link)
  - Response: `{ success: true, data: { id, title, author, mediaType: 'video' | 'image' | 'carousel', videoUrl?, imageUrl?, medias?: Array<{ type: 'video' | 'image', url: string, cover?: string }>, coverUrl?, duration?, driveItem?: { exists: boolean, ... } } }`
- **POST `/api/v1/instagram/save-drive`**:
  - Request: `{ mediaUrl, title, id, originalUrl?, coverUrl?, author?, mediaType?: 'video' | 'image' }`
  - Response: `{ success: true, data: { fileId, fileName, relPath: string, sizeBytes, mimeType: string } }`

## Code Layout
- Frontend tools:
  - Facebook: `src/components/tools/facebook/FacebookWorkspace.js`, `src/components/tools/facebook/services/facebookApi.js`
  - Spotify: `src/components/tools/spotify/SpotifyWorkspace.js`, `src/components/tools/spotify/services/spotifyApi.js`
  - Instagram: `src/components/tools/instagram/InstagramWorkspace.js`, `src/components/tools/instagram/services/instagramApi.js`
  - Common: `src/components/tools/common/MediaHistorySection.js`
- Backend services & routes:
  - Facebook: `server/src/api/routes/facebook.route.ts`, `server/src/services/facebook.service.ts`, `server/src/schemas/facebook.schema.ts`
  - Spotify: `server/src/api/routes/spotify.route.ts`, `server/src/services/spotify.service.ts`, `server/src/schemas/spotify.schema.ts`
  - Instagram: `server/src/api/routes/instagram.route.ts`, `server/src/services/instagram.service.ts`, `server/src/schemas/instagram.schema.ts`
- Registries & Utilities:
  - Tool Registry: `src/hooks/useToolRegistry.js`
  - URL Routing & Share: `src/utilities/smartUrlRouter.js`, `src/utilities/shareTargetHelper.js`, `sw.js`
  - Android APK: `android/app/src/main/java/com/duydev/studio/ShareReceiverActivity.kt`
- Tests:
  - `server/tests/unit/media_downloaders.test.ts`
  - `server/tests/unit/collapsible_history.test.ts`
  - `server/tests/e2e/media_downloaders_e2e.test.ts` (to be created by E2E track)
