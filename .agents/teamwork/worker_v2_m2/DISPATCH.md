## 2026-09-27T15:45:19Z
You are Worker M2: Touch & Mouse Gestures, Lightbox & Drag-and-Drop Specialist.
Your working directory is: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m2`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Specifications to read first:
1. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (header `## 2026-09-27T12:14:56Z`)
2. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_pdf_v2\PROJECT.md`
3. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_gestures\handoff.md`
4. `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_v2_gestures\analysis.md`

Files you own exclusively for Milestone M2:
- `src/utilities/swipeGesture.js` (NEW)
- `src/utilities/dragReorder.js` (NEW)
- `src/components/tools/pdf/hooks/usePdfQueue.js`
- `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`
- `src/components/tools/pdf/components/PdfPageLightboxModal.js`
- `src/components/tools/pdf/hooks/usePdfDom.js`
- `server/tests/unit/pdf_gestures.test.ts` (NEW unit test suite)

Objectives:
Resolve Requirement R2:
"Cử chỉ vuốt để xóa tất cả (Swipe-to-Clear) và Tương tác Cảm ứng Công thái học:
- Trang bị cử chỉ vuốt nhạy bén (Swipe gesture) hỗ trợ cả màn hình cảm ứng di động (Touch events) lẫn chuột máy tính (Mouse/Pointer drag) trên thanh công cụ/danh sách tệp để xóa toàn bộ hàng đợi hoặc tệp đang chọn nhanh chóng, kèm animation trượt mượt mà và phản hồi rung nhẹ (Haptic feedback nếu có - navigator.vibrate).
- Hỗ trợ đầy đủ phím tắt tiện ích trong Lightbox xem to trang PDF (Esc để đóng, ← / → để lật trang liền mạch) và kéo thả đổi thứ tự tệp/trang không giật lag."

Detailed Tasks:
1. Create `src/utilities/swipeGesture.js`:
   - Zero-dependency pointer/touch swipe utility with dual-axis touch slop: 8px threshold window. If vertical delta exceeds horizontal delta (|dy| >= |dx|), release to native scrolling. If horizontal delta dominates (|dx| > |dy|), capture pointer and translate foreground element.
   - Threshold for dismissal: >35% element width or >100px.
   - Supports haptic feedback: `navigator.vibrate?.([15, 30, 15])` on trigger.
   - Smooth exit animation and height collapse (`transition: transform 0.2s, max-height 0.25s, opacity 0.2s`).
   - Queue-level slide-to-clear: Support sliding track where user drags an icon across a track (e.g. >70% track width) to trigger "Clear All" with haptic feedback, preventing accidental queue wipes.
2. Create `src/utilities/dragReorder.js`:
   - Unified Pointer-based reordering engine (`pointerdown`, `pointermove`, `pointerup` with `setPointerCapture` and `touch-action: none` on `grip-vertical` handle).
   - 60fps GPU transforms (`translateY`) for the dragged element, ghost slot placeholder or visual border indicator.
   - On release, invokes `onReorder(fromIndex, toIndex)` callback.
3. Extend `usePdfQueue.js`:
   - Add `reorderFiles(fromIndex, toIndex)`: Move file item in `this.files` from `fromIndex` to `toIndex`, notify `files-change`.
4. Update `PdfMultiFileWorkspace.js`:
   - Add `grip-vertical` handle on each file row for drag reordering.
   - Add swipe-to-dismiss wrapper structure with hidden red destructive trash background behind each file row.
   - Integrate the slide-to-clear queue toolbar track replacing unguarded instant "Xóa tất cả" button.
5. Update `PdfPageLightboxModal.js`:
   - Fix the rotation reset bug: When navigating pages with ArrowLeft, ArrowRight, or prev/next buttons, do NOT force rotation to 0! Query or accept rotation for `newPage` so rotated pages in Rotate mode retain their angle.
   - Add touch swipe page navigation: swipe left to go to next page, swipe right to go to previous page.
   - Add backdrop click dismiss: clicking the backdrop outside the image closes the modal.
   - Lock body scrolling while Lightbox is open (`document.body.style.overflow = 'hidden'`) and restore on close.
6. Update `usePdfDom.js`:
   - Wire swipe gestures and pointer drag reorder in multi-file workspaces.
   - Pass page rotation getter/state to Lightbox so page flipping respects rotation in Rotate mode.
7. Create unit test suite `server/tests/unit/pdf_gestures.test.ts`:
   - Test `reorderFiles` in `usePdfQueue`.
   - Test swipe math (threshold detection, touch slop disambiguation, haptic invocation).
   - Test Lightbox rotation retention.
8. Verification Requirements:
   - Check JS syntax on all modified/created files: `node --check <file>`
   - Check TypeScript: `cd server && npx tsc --noEmit` -> 0 errors.
   - Run Vitest tests: `cd server && npx vitest run` -> 100% pass.
   - Zero-build native ES modules preserved, Single Responsibility maintained.
9. Write your report to `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_v2_m2\handoff.md`.
10. Send a message to parent reporting completion.
