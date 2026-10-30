# Original User Request

## Initial Request — 2026-10-30 14:13:38 UTC

Audit and remediate all features across the Facebook, Spotify, and Instagram downloader modules in DD Studio, eliminating delays, UI flickering, and functional errors across Web PWA, Android Native APK, and mobile/desktop platforms.

Integrity mode: development

References:
- Universal Tool Module Architecture Standard: `docs/MODULE_STANDARD.md` & `docs/knowledge-base/KI-CON-019-universal-tool-module-specification-standard.md`
- Isolated history container (`#xxxHistoryContainer`) with in-place DOM mutation: `KI-FIX-040`
- Spotify multi-factor deterministic match scoring & staged search (anti-remix): `KI-FIX-041`
- Mobile ergonomics & design tokens: `src/styles/stitch-tokens.css`

## Requirements

### R1. Facebook Downloader Audit and Remediation
Audit and resolve all performance bottlenecks, delays, and UI/backend defects in `src/components/tools/facebook/FacebookWorkspace.js`, `server/src/api/routes/facebook.route.ts`, `server/src/services/facebook.service.ts`, and `server/src/schemas/facebook.schema.ts`. Ensure an isolated history container (`#facebookHistoryContainer`) with in-place mutation to eliminate page flickering, robust input validation, and clear error handling.

### R2. Spotify Downloader Audit and Remediation
Audit and resolve delays, UI glitches, and search/download inaccuracies in `src/components/tools/spotify/SpotifyWorkspace.js`, `server/src/api/routes/spotify.route.ts`, `server/src/services/spotify.service.ts`, and `server/src/schemas/spotify.schema.ts`. Ensure an isolated history container (`#spotifyHistoryContainer`) with in-place mutation, and enforce multi-factor deterministic match scoring without remix or live-cover pollution (`KI-FIX-041`).

### R3. Instagram Downloader Audit and Remediation
Audit and resolve bottlenecks, UI delays, and media extraction failures in `src/components/tools/instagram/InstagramWorkspace.js`, `server/src/api/routes/instagram.route.ts`, `server/src/services/instagram.service.ts`, and `server/src/schemas/instagram.schema.ts`. Ensure an isolated history container (`#instagramHistoryContainer`) with in-place mutation and resilient media carousel/reel handling.

### R4. Cross-Platform Ergonomics and Module Standards
Ensure all 3 modules comply with Universal Tool Module standards:
- Touch targets >= 44px across all buttons and interactive controls.
- Responsive layouts with no horizontal scroll or layout breaking at >= 360px viewport width.
- Strict Light and Dark mode contrast using design tokens from `src/styles/stitch-tokens.css`.
- Support for Web PWA, Android Native APK wrapper (`android/app/`), and Web Share Target (`sw.js`, `shareTargetHelper.js`, `ShareReceiverActivity.kt`).

### R5. Non-Interference Constraint
Do not modify or touch any code in `src/components/tools/studocu/**` or `server/src/services/studocu/**`.

## Acceptance Criteria

### Audit & Functional Verification
- [ ] Backend TypeScript build passes with zero errors: `server/node_modules/.bin/tsc.cmd -p server/tsconfig.json --noEmit`.
- [ ] Compliance audit passes for all 3 tools via `python scripts/audit_module_compliance.py src/components/tools/<tool_name>`.
- [ ] Facebook downloader successfully resolves and downloads media from public test URLs without uncaught errors or UI freeze.
- [ ] Spotify downloader executes staged search with multi-factor scoring and successfully resolves audio streams matching target title and artist.
- [ ] Instagram downloader successfully parses and extracts media items from public test posts or reels.
- [ ] History containers (`#facebookHistoryContainer`, `#spotifyHistoryContainer`, `#instagramHistoryContainer`) mutate DOM elements in place on updates without full-list re-renders or page flickering.
- [ ] All interactive elements in the 3 modules have touch targets >= 44px and no layout overflow occurs down to 360px width.
- [ ] No files under `src/components/tools/studocu/**` or `server/src/services/studocu/**` are modified.
