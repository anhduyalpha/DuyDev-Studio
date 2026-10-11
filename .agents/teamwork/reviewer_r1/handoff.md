> [!WARNING] **Skepticism Disclaimer**
> High confidence in backend telemetry calculations, scanner noise filtering, and error reclassification (verified via 13/13 false-positive tests, 27/27 admin unit tests, and live production API responses on 192.168.2.171), but external client browser rendering of the new v22.37 UI badges depends on clients fetching the updated service worker cache.

## 1. What the prior attempt got wrong

### Issue 1: Hardcoded 0% error rate in traffic noise badge
- **Input:** Live traffic with genuine server errors (e.g. `status5xxLast60 > 0`, leading to `errorRatePercent = 16.7%`).
- **Expected:** The traffic badge displays the calculated error rate (e.g. `Đã lọc 10 bot scan · 16.7% Lỗi` or `16.7% Lỗi`) with amber/rose styling.
- **Actual:** `AdminPage.js` hardcoded `${(codes.c4xxNoise || 0) > 0 ? \`Đã lọc \${codes.c4xxNoise} bot scan · 0% Lỗi\` : '0.0% Lỗi (Sạch bot scan)'}` in both initial render and ticker updates.
- **Root cause:** The implementer hardcoded static string `"0% Lỗi"` and `"0.0% Lỗi"` instead of referencing `trafficSummary.errorRatePercent`.

### Issue 2: Redis status in live ticker reverted from READY to connected
- **Input:** Live 3-second telemetry ticker poll.
- **Expected:** Redis cache indicator continues to display `READY (connected)` matching R4 requirements.
- **Actual:** Reverted to `connected · 3.10M · 110 keys` after 3 seconds, losing the `READY` display indicator.
- **Root cause:** `updateAdminTelemetryDom` did not include `redis.displayStatus` in its DOM update logic (unlike the initial render template).

### Issue 3: Invalid Tailwind CSS padding class `py-0.2` on queue status badges
- **Input:** Queue status badges in PDF, Universal Converter, and Quiz Generator rows.
- **Expected:** Proper vertical padding (e.g. `py-0.5`).
- **Actual:** Rendered with `py-0.2`, which is not a valid Tailwind CSS class and is ignored by the browser CSS parser.
- **Root cause:** Typo in class string (`py-0.2` instead of `py-0.5`).

### Issue 4: AI Agents Card displayed truncated `RECOVERED` badge instead of required `FALLBACK_RECOVERED`
- **Input:** Upstream Agnes AI timeout recovered by secondary Gemini API key.
- **Expected:** UI badge displays `FALLBACK_RECOVERED` as mandated in R2 and acceptance criteria.
- **Actual:** Badge displayed `RECOVERED`.
- **Root cause:** Implementer shortened the badge text in `AdminAiAgentsCard.js` to `RECOVERED`.

### Issue 5: Unconditional 504 default on non-timeout AI errors in `executeWithFallback`
- **Input:** AI provider error with `response.status = 401` or standard generic exception.
- **Expected:** Logged status code reflects actual HTTP status (e.g. 401 or 500).
- **Actual:** Defaulted unconditionally to 504 Gateway Timeout.
- **Root cause:** `const statusCode = Number(err?.status || err?.statusCode) || 504` did not check `err?.response?.status` and defaulted everything to 504 regardless of error type.

### Issue 6: Scanner noise isolation limited to 27 hardcoded string patterns
- **Input:** Automated bot scanner probing for `.php`, `.asp`, `.jsp`, `.sql`, `geoserver`, or arbitrary non-application root URLs.
- **Expected:** Categorized as scanner noise (`isBotScannerNoise() === true`).
- **Actual:** Unmatched scanner probes returned `false` and contaminated legitimate client 4xx telemetry.
- **Root cause:** String matching was purely an exact list of 27 patterns without script extension detection or non-app route boundary isolation.

## 2. What I changed
- `server/src/api/middleware/telemetry.middleware.ts`:
  - Enhanced `isBotScannerNoise()` to detect script/backup extensions (`.php`, `.asp`, `.aspx`, `.jsp`, `.cgi`, `.sql`, `.bak`, `.zip`, `.tar`, `.gz`, etc.), common probe keywords (`hnap1`, `wlwmanifest`, `geoserver`, `jenkins`), and isolated 404s on paths outside DD Studio's SPA/API boundary.
  - Added `resetBuckets()` to `TelemetryTracker` for clean telemetry resets and test isolation.
- `server/src/services/ai-metrics.service.ts`:
  - Refined status code resolution in `executeWithFallback()` to check `err?.response?.status`, differentiate timeout signatures (`AbortError`, `ETIMEDOUT`, `ECONNABORTED`, message timeout) as 504, and assign 500 for generic crashes.
- `src/pages/AdminPage.js`:
  - Made `adminTrafficNoiseBadge` dynamically display `trafficSummary.errorRatePercent` and dynamically change background/text colors (emerald for 0%, amber for < 5%, rose for >= 5%).
  - Updated `updateAdminTelemetryDom()` to retain `redis.displayStatus` (`READY (connected)`).
  - Fixed invalid Tailwind `py-0.2` classes to `py-0.5` across all queue status badges.
- `src/components/admin/AdminAiAgentsCard.js`:
  - Updated table status badge to display `FALLBACK_RECOVERED`.
  - Updated modal status code tag to display `FALLBACK_RECOVERED (${log.statusCode})`.
- `src/components/admin/AdminFailedJobsInspector.js`:
  - Standardized cleared jobs count badge to `0 lỗi hệ thống · 0 thao tác người dùng`.
- `sw.js`:
  - Bumped `CACHE_NAME` to `duydev-studio-v22.37` and asset version query strings to `?v=22.37`.
- `server/tests/unit/admin_false_positive_elimination.test.ts`:
  - Added `beforeEach` reset for telemetry buckets.
  - Added tests verifying accurate AI error status code resolution (401/500 vs 504).
  - Added tests for expanded bot scanner probes (extensions, non-app URLs) and genuine 5xx health degradation.

## 3. Verification Record
- **Deep Verification (ran actual tests):**
  - `npx vitest run tests/unit/admin_false_positive_elimination.test.ts`: **13/13 passed** (including new status code resolution and health degradation tests).
  - `npx vitest run tests/unit/admin_telemetry.test.ts tests/unit/admin_operations_inspect.test.ts`: **27/27 passed**.
  - `npm --prefix server run build` (`tsc`): **0 typecheck errors**.
  - `node --check src/pages/AdminPage.js src/components/admin/AdminFailedJobsInspector.js src/components/admin/AdminAiAgentsCard.js sw.js`: **0 syntax errors**.
  - `python -m py_compile engines/converter/convert_cli.py engines/document/pdf_engine.py`: **0 syntax errors**.
  - Deployed to homeserver `192.168.2.171` via `.\scripts\deploy-prod.ps1`:
    - Git commit `d8a554c` pushed to GitHub main and pulled to `/home/anhduy/dd-studio`.
    - Server built with `tsc` and `dd-studio.service` restarted cleanly.
  - Live API verification on homeserver `192.168.2.171:3000`:
    - `curl http://192.168.2.171:3000/api/v1/health`: HTTP 200 `{"status":"UP","version":"1.0.0"}`.
    - `POST /api/v1/auth/verify`: authenticated successfully with token.
    - `GET /api/v1/admin/telemetry`: returned `systemHealth: "HEALTHY"`, `errorRatePercent: 0`, all queues (`pdf`, `converter`, `quiz`, `total`) reporting `status: "IDLE / READY"`, Redis reporting `displayStatus: "READY"`.
    - `GET /api/v1/admin/logs/failed-jobs`: verified separation of `errorClass: "USER_ACTION"` (question count mismatch) vs `errorClass: "SYSTEM_ERROR"` (unhandled engine crash).
- **Shallow Verification (manual only):**
  - Confirmed Tailwind CSS padding class change from `py-0.2` to `py-0.5`.
  - Confirmed service worker cache name bump to `v22.37`.
- **Unverified aspects:**
  - Visual layout in mobile safari browser on external cellular networks (tested via live API responses and LAN endpoints).

## 4. Known Issues
- `Minor Robustness Risk` — If a legitimate external webhook endpoint is ever mounted at the root path without an `/api/` prefix and returns 404, it would be classified as scanner noise under the SPA path boundary check. (Currently all backend routes strictly reside under `/api/v1/` or `/q/`).

## 5. Remaining risk & next step
- **Assessment:** The task requirements R1-R4 and all acceptance criteria are fully met, verified by automated unit tests, backend build, and live deployment on the homeserver.
- **Next Step:** Mark task complete. Users can visit `https://studio.duydev.cloud/#/admin` to observe the Mission Control dashboard with 0 false-positive errors, `FALLBACK_RECOVERED` AI status, isolated bot scanner noise, and `IDLE / READY` worker indicators.
