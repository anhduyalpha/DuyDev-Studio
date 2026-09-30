## 2026-09-27T16:15:12Z
You are Worker M3: 9-Tools Premium Consistency & Concurrency Hardening Specialist.
Your working directory is: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m3`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Specifications to read first:
1. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (header `## 2026-09-27T12:14:56Z`)
2. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_pdf_v2\PROJECT.md`
3. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_tools_audit\handoff.md`
4. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_tools_audit\analysis.md`

Files you own exclusively for Milestone M3:
- `src/components/tools/pdf/components/ConfigPanel.js`
- `src/components/tools/pdf/hooks/usePdfQueue.js`
- `src/components/tools/pdf/hooks/usePdfDom.js`
- `src/components/tools/pdf/services/pdfApi.js`
- `server/tests/unit/pdf_concurrency_m3.test.ts` (NEW unit test suite)

Objectives:
Resolve Requirements R3 & R4:
"Chuẩn hóa & Nâng cấp Trải nghiệm Cao cấp Toàn diện 9 Công cụ PDF và Production Minimalism:
- Rà soát toàn bộ 9 công cụ PDF: Ghép, Tách, Xoay, Ảnh sang PDF, Nén, Trích ảnh, Xem, Watermark, Bảo mật.
- Khóa chuyển tab và vô hiệu hóa nút hành động khi đang xử lý tác vụ (isProcessing === true).
- Thu hồi triệt để tài nguyên (URL.revokeObjectURL, hủy AbortController, dọn dẹp canvas bitmap) khi rời trang hoặc thay đổi tệp.
- Production minimalism: loại bỏ triệt để AI fluff, typography Geist / JetBrains Mono, dynamic action button labels."

Detailed Tasks:
1. Single Image Support in `images_to_pdf`:
   - In `ConfigPanel.js:148`: Change `hasEnoughFiles = fileCount >= 2` to `fileCount >= 1` when mode is `images_to_pdf`.
   - In `usePdfQueue.js:571`: Change check from `files.length < 2` to `files.length < 1` for `images_to_pdf`.
   - Label action button as `Tạo PDF từ ${fileCount} ảnh` (or `Tạo PDF từ 1 ảnh`).
2. Concurrency Defense & Defensive Guards:
   - In `usePdfQueue.js`: Guard ALL state/queue mutation methods with `if (this.isProcessing) return;`:
     - `addFiles`
     - `removeFile`
     - `clearFiles`
     - `reorderFiles`
     - `setThumbnailPage`
     - `setRotation`
     - `rotateAll`
     - `setSplitRange`
   - In `usePdfDom.js`: When `isProcessing === true`, ensure interactive action buttons have explicit `disabled` HTML attribute and visual disabled classes.
3. Resource Revocation & Listener Hygiene:
   - In `usePdfDom.js:337`: Clean up document click listener when switching modes or unmounting so listeners do not leak.
   - When mode changes or file changes, auto-close Lightbox if open (`closePdfPageLightbox()`).
   - In `pdfApi.js`: Add AbortController / AbortSignal support to `uploadPdfJob` / fetch calls so cancelling a job immediately aborts network transmission.
   - Ensure all `URL.revokeObjectURL` calls cleanly release object URLs.
4. Unit Test Suite `server/tests/unit/pdf_concurrency_m3.test.ts`:
   - Test single image validation in `images_to_pdf`.
   - Test concurrency locking: verify that calling `addFiles`, `removeFile`, `clearFiles`, `reorderFiles`, and `setThumbnailPage` while `isProcessing === true` is completely blocked.
   - Test AbortController signal handling in `pdfApi.js`.
5. Verification:
   - `node --check` across modified files.
   - `cd server && npx tsc --noEmit` -> 0 errors.
   - `cd server && npx vitest run` -> 100% pass.
   - Run UI fluff scanner: `python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src"`.
6. Deliver report to `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m3\handoff.md`.
