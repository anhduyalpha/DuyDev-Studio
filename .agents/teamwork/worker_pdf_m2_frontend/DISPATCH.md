# Dispatch: Worker M2 - Frontend PDF Tools Core & UI/UX Overhaul

## Mission
Overhaul the frontend PDF Studio Pro module in `src/components/tools/pdf/` and supporting components to production-grade standards (like iLovePDF/Linear):

### 1. Dynamic Context Primary Action Button
- In `src/components/tools/pdf/components/ConfigPanel.js`:
  Dynamically label the primary action button based on mode and configuration:
  - `merge`: `Ghép ${count} tệp PDF`
  - `split`: `Tách ${selectedCount} trang đã chọn`
  - `rotate`: `Lưu file xoay`
  - `images_to_pdf`: `Tạo PDF từ ${count} ảnh`
  - `compress`: `Nén PDF (${levelLabel})` (e.g. `Nén PDF (Cân bằng)`)
  - `extract_images`: `Trích xuất toàn bộ ảnh`
  - `watermark`: `Đóng dấu PDF`
  - `lock`: `Khóa mật khẩu PDF`
  - `unlock`: `Mở khóa PDF`
  - `view`: `Xem PDF`
- Clean up or synchronize duplicate buttons in `PdfMultiFileWorkspace.js`, `PdfRotateWorkspace.js`, `PdfSplitWorkspace.js` so there are no conflicting action buttons.

### 2. Strict File Filters & Single vs Multi-file
- In `src/components/common/Dropzone.js`:
  Support `multiple: boolean` prop (default true for backwards compatibility, but accept `false` when single-file mode is requested).
- In `src/components/tools/pdf/components/DropzoneQueue.js` & `usePdfQueue.js`:
  Pass `multiple: isMulti` to Dropzone.
  When multiple files are dropped in single-file mode, auto-replace the existing file with the first valid file and show a toast informing the user.

### 3. Split Page Range Validation
- In `src/components/tools/pdf/components/PdfSplitWorkspace.js` & `usePdfQueue.js`:
  Parse and validate manual page ranges (`1-3, 5, 8-10`).
  If any page number is > `totalPages` or < 1, display an error message/toast and disable the split action button until fixed.

### 4. Watermark Position & Opacity Controls
- In `src/components/tools/pdf/components/ConfigPanel.js`:
  Add position selector: Diagonal center (`center`), Top header (`top`), Bottom footer (`bottom`).
  Add opacity slider (range 0.1 to 1.0, step 0.05, default 0.3) with percentage label.
- In `src/components/tools/pdf/hooks/usePdfQueue.js` & `pdfApi.js`:
  Store `watermarkPosition` and `watermarkOpacity` and forward them in `options` to `POST /api/v1/jobs/pdf`.

### 5. Inline PDF Viewer Fullscreen
- In `src/components/common/viewer/renderers/pdf/PdfFloatingDock.js` or `PdfViewerInline.js`:
  Add a Fullscreen toggle button with SVG icon that calls `requestFullscreen()` / `exitFullscreen()`.

### 6. Result Card Workflow Chaining
- In `src/components/tools/pdf/components/ResultCard.js`:
  Add a "Chuyển tiếp tệp sang công cụ khác" dropdown or button that allows the user to immediately feed the result artifact into another PDF tool (e.g., from Merge to Compress) without re-uploading.

### 7. Touch Targets (>= 40px) & Ergonomic Shortcuts
- In `PdfRotateWorkspace.js`, `PdfSplitWorkspace.js`, `PdfMultiFileWorkspace.js`:
  Ensure all buttons (page rotate, preview eye icon, file move up/down/delete) have touch targets >= 40px (`min-w-[40px] min-h-[40px]`).
- In `PdfPageLightboxModal.js`:
  Support `Esc` key to close lightbox.
  Support `←` / `→` arrow keys to navigate previous/next page.

### 8. State Sync, Tab Lock & Resource Cleanup
- Ensure in-tab progress bar renders smoothly from 0% -> 100%.
- Ensure tab switching is locked when `isProcessing === true`.
- Clean up Object URLs (`URL.revokeObjectURL()`) when clearing files or closing modals.
- Strict UI minimalism: 0 fluff, no marketing annotations, crisp Geist / JetBrains Mono typography.

## Write Ownership
You exclusively own and may edit:
- `src/components/tools/pdf/` (all components and hooks)
- `src/components/common/Dropzone.js` (only to support optional `multiple` parameter)
- `src/components/common/viewer/renderers/pdf/PdfFloatingDock.js` (only to add fullscreen button)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification Requirements
You MUST run:
1. `node --check src/components/tools/pdf/PdfWorkspace.js src/components/tools/pdf/components/*.js src/components/tools/pdf/hooks/*.js` -> Must pass 100% with exit code 0.
2. `cd server && npx tsc --noEmit` -> Must pass with 0 errors.
3. `python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src\components\tools\pdf"` -> Must report 0 fluff.
Document all results in `handoff.md` and notify orchestrator when done.
