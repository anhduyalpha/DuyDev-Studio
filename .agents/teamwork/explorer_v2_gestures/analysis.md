# Deep Architectural Analysis: Requirement R2 (Gestures & Touch Ergonomics)

**Date**: 2026-09-27  
**Investigator**: Explorer 2 (Gestures & Touch Ergonomics Specialist)  
**Target Milestone**: R2 — Swipe-to-Clear, Ergonomic Touch & Mouse Gestures, Lightbox Shortcuts & Mobile Navigation, Zero-Lag Drag & Drop Reordering

---

## 1. Executive Summary

Requirement R2 mandates:
1. **Swipe-to-Clear Gesture**: Responsive swipe interaction supporting both mobile touch events and desktop pointer/mouse drag on toolbars and file lists to clear queues or dismiss files with smooth slide animations and haptic feedback (`navigator.vibrate?.([15, 30, 15])`).
2. **Lightbox Keyboard & Mobile Ergonomics**: Flawless keyboard shortcuts (`Esc`, `ArrowLeft`, `ArrowRight`) in full-screen PDF inspection, touch swipe page navigation, proper cleanup, and backdrop dismissal.
3. **Zero-Lag Drag & Drop Reordering**: Fluid reordering of files in multi-file workspaces (Merge PDF, Images to PDF) across both mobile touch screens and desktop mouse without stutter.

### Key Discoveries & Status:
| Feature | Current State | Defect / Architectural Gap | Required Engineering |
|---|---|---|---|
| **Swipe-to-Clear All** | Non-existent; only instant-click text button `#btnClearAllMultiFiles` exists | Accidental tap clears queue without confirmation; no swipe gesture | Implement a sleek inline slide-to-clear track / gesture on queue toolbar with threshold and haptic feedback |
| **Swipe-to-Dismiss Row** | Non-existent; only `.btn-file-remove` (X icon) exists | No mobile gesture support; tapping small 40px X button on mobile is cumbersome | Implement touch & pointer swipe-left with red destructive reveal, 35% threshold, spring-back or slide-out collapse, and haptic pulse |
| **Drag & Drop Reordering** | Non-existent; only `.btn-file-move-up` and `.btn-file-move-down` step buttons exist | No direct drag-and-drop; `usePdfQueue.js` lacks `reorderFiles(fromIdx, toIdx)` | Build unified Pointer-based Drag & Drop (works on both touch and mouse with 60fps GPU transforms); add `reorderFiles` to `usePdfQueue` |
| **Lightbox Shortcuts** | Partially implemented (`Esc`, `ArrowLeft`, `ArrowRight` registered at window level) | **Critical Bug**: `ArrowLeft`/`ArrowRight` resets page rotation to 0° (`navigateToPage(newPage, 0)`); no backdrop click dismiss; no touch swipe; body scroll not locked | Preserve page rotation from state; add backdrop click close; add touch swipe left/right to change pages; lock body scroll |

---

## 2. Examination of Existing PDF Workspaces & Toolbars

The PDF Studio module (`src/components/tools/pdf/`) utilizes a zero-build native ES Modules architecture with Vanilla DOM rendering and reactive event subscriptions via `PdfQueueManager` (`usePdfQueue.js`) and `usePdfDom.js`.

### 2.1 Multi-File Workspace (`PdfMultiFileWorkspace.js`)
- **Location**: `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`
- **Rendered for**: `mode === 'merge'` and `mode === 'images_to_pdf'`
- **Structure**:
  1. **Header Bar**:
     - Contains file count badge, total size (`formatBytes`), file upload button (`#inputAddMoreFiles`), and plain text button `#btnClearAllMultiFiles` ("Xóa tất cả").
     - **Issue**: Clicking "Xóa tất cả" instantly calls `qm.clearFiles()` with zero confirmation or gesture guard. If a user accidentally taps it, their 20 uploaded files are destroyed immediately.
  2. **File List Container** (`#pdfMultiFileList` or `.space-y-2.5`):
     - Each item is a row displaying index badge, thumbnail/icon, filename, file size, and 3 buttons:
       - `.btn-file-move-up` (`data-move-up="${idx}"`)
       - `.btn-file-move-down` (`data-move-down="${idx}"`)
       - `.btn-file-remove` (`data-remove-multi-id="${f.id}"`)
     - **Deficiency**: There is no drag handle (`grip-vertical`), no `draggable` attribute, and no pointer/touch listener for dragging. To move an item from position 10 to position 1, the user must click the up arrow 9 times.

### 2.2 Single-File Workspace (`DropzoneQueue.js`)
- **Location**: `src/components/tools/pdf/components/DropzoneQueue.js`
- **Rendered for**: `compress`, `watermark`, `security`, `extract_images`, `view`
- **Structure**:
  - Displays `#pdfSingleFileCardRoot` with file metadata, status badge, "Xem trước", and "Đổi tệp" (`#btnChangeSingleFile`).
  - Swiping the card left or right can trigger "Đổi tệp" or file dismissal.

### 2.3 Visual Grid Workspaces (`PdfRotateWorkspace.js` & `PdfSplitWorkspace.js`)
- **Structure**:
  - Displays file metadata, quick action toolbar, pagination bar (4x2 grid, 8 pages per screen), and page thumbnail cards.
  - Page cards include an eye button (`.btn-preview-page`) which invokes `openPdfPageLightbox()` in `PdfPageLightboxModal.js`.

---

## 3. Swipe-to-Clear Interaction Design & Ergonomics

### 3.1 Dual-Level Gesture Architecture

To provide maximum ergonomics without disrupting vertical scrolling:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Queue Header: Swipe-to-Clear All Track / Interactive Slide Button     │
│  [  ===>  Vuốt sang phải để xóa toàn bộ hàng đợi (3 tệp)  ===>  ]     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  File Row 1: [Grip] 1. report.pdf (1.2 MB)           [▲][▼][✕]        │
│  ◄◄◄ [Swipe Left to Dismiss Row] ◄◄◄  (Reveals Red Trash Layer)        │
├────────────────────────────────────────────────────────────────────────┤
│  File Row 2: [Grip] 2. scan.pdf (3.4 MB)             [▲][▼][✕]        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Level 1: Item-Level Swipe-to-Dismiss (Row Swipe)
- **Target**: Each file row in `PdfMultiFileWorkspace.js`.
- **Interaction**:
  - User touches or clicks & drags a file row to the left (`dx < 0`).
  - The row translates horizontally with 1:1 finger tracking (`transform: translateX(${dx}px)`).
  - An underlying destructive background is revealed with red tint (`bg-red-500/10 dark:bg-red-500/15 border-red-500/30`), a trash icon (`trash-2`), and `"Xóa tệp"`.
  - **Threshold**: When dragged past **35% of row width** or **> 110px**:
    - The trash icon expands (`scale-110`) and turns vivid red (`text-red-500`).
    - A haptic tick is delivered: `navigator.vibrate?.(12)`.
  - **Release beyond threshold**:
    - Row smoothly slides completely off-screen: `transform: translateX(-105%); opacity: 0; transition: transform 0.18s ease-out, opacity 0.18s ease-out;`.
    - Distinctive haptic pulse: `navigator.vibrate?.([15, 30, 15])`.
    - Row height, margin, and padding smoothly collapse to 0 in 0.2s.
    - File is removed from queue: `qm.removeFile(fileId)`.
  - **Release before threshold**:
    - Springs back to original position: `transform: translateX(0px); transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);`.

#### Level 2: Queue-Level Swipe-to-Clear All
- **Target**: The multi-file queue header or dedicated swipe track.
- **Ergonomic Problem**: Accidental click on "Xóa tất cả" erases all files without recovery.
- **Solution**: A sleek, compact slide-to-clear track integrated directly into the header bar when files are present:
  - Width: ~200px - 260px (or full width on mobile).
  - Handle: Circular thumb with chevrons (`chevrons-right`) or trash icon.
  - Background track: `bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08]`.
  - Label: `"Vuốt để xóa tất cả"`.
  - When dragged past 75% of track width:
    - Handle snaps to end, progress bar turns red, haptic vibration `navigator.vibrate?.([15, 30, 15])` fires.
    - Entire file list fades out with slide-down exit animation.
    - `qm.clearFiles()` is invoked.

### 3.2 Dual-Axis Disambiguation (Preventing Scroll Stutter)

A common flaw in mobile touch gestures is capturing vertical page scrolling as a horizontal swipe, causing sticky or jarring scrolls.

**Algorithm for Axis Locking**:
```javascript
const TOUCH_SLOP = 8; // pixels before deciding intent

function onPointerMove(e) {
  if (!isTracking) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  // Initial detection window
  if (!directionLocked) {
    if (Math.abs(dx) < TOUCH_SLOP && Math.abs(dy) < TOUCH_SLOP) {
      return; // wait for deliberate movement
    }
    // If vertical movement dominates, yield immediately to native browser scroll!
    if (Math.abs(dy) >= Math.abs(dx)) {
      isTracking = false;
      return;
    }
    // Horizontal movement dominates: lock axis and prevent browser back navigation
    directionLocked = true;
    element.setPointerCapture?.(e.pointerId);
  }

  e.preventDefault();
  // Apply resistance and transform
  const clampedX = Math.min(0, dx); // only allow swipe left
  element.style.transform = `translateX(${clampedX}px)`;
}
```

---

## 4. Reusable Zero-Dependency Gesture Utility Specification

We specify `src/utilities/swipeGesture.js` adhering to Single Responsibility and zero external libraries:

### 4.1 Interface Specification
```javascript
/**
 * Attaches swipe-to-dismiss gesture to a DOM element.
 * @param {HTMLElement} element - The sliding foreground element
 * @param {Object} options
 * @param {string} [options.direction='left'] - 'left' | 'right' | 'both'
 * @param {number} [options.thresholdRatio=0.35] - Fraction of element width
 * @param {number} [options.thresholdPx=100] - Minimum pixel distance
 * @param {boolean} [options.haptic=true] - Enable navigator.vibrate feedback
 * @param {Function} [options.onProgress] - (distance, ratio, isTriggered) => void
 * @param {Function} [options.onComplete] - () => void
 * @param {Function} [options.onCancel] - () => void
 * @returns {Function} cleanup - Function to unbind all listeners
 */
export function attachSwipeToDismiss(element, options = {}) { ... }
```

### 4.2 State Machine
```
   [IDLE]
     │
     ▼ pointerdown
 [MEASURING] (dx, dy < 8px)
     │
     ├─► |dy| > |dx| ───────────────► Yield to Native Scroll (IDLE)
     │
     ▼ |dx| >= |dy|
  [SWIPING] (setPointerCapture, transform: translateX)
     │
     ├─► pointerup (dx < threshold) ─► [RESETTING] (spring back 0.25s) ──► IDLE
     │
     └─► pointerup (dx >= threshold) ─► [DISMISSING] (vibrate, slide-out, collapse) ──► onComplete()
```

### 4.3 Hardware Acceleration & Styling
- Sliding element uses `transform: translateX(...)` and `will-change: transform`.
- Underlying layer uses absolute positioning (`inset-0`) so layout thrashing is 0%.
- Height collapse uses `max-height` transition rather than immediate DOM deletion to avoid jarring jumps for sibling items below.

---

## 5. Drag-and-Drop Reordering Architecture

### 5.1 Verification of Current State
In `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`:
- Lines 83-95:
  ```html
  <button type="button" data-move-up="${idx}" title="Lên" ...>
    <i data-lucide="arrow-up" class="w-4 h-4"></i>
  </button>
  <button type="button" data-move-down="${idx}" title="Xuống" ...>
    <i data-lucide="arrow-down" class="w-4 h-4"></i>
  </button>
  ```
- **Conclusion**: There is NO drag-and-drop implementation currently in place.
- In `src/components/tools/pdf/hooks/usePdfQueue.js`:
  - `moveFileUp(index)` and `moveFileDown(index)` exist.
  - `reorderFiles(fromIndex, toIndex)` is missing.

### 5.2 Why Pointer-Based DnD Outperforms HTML5 DnD
1. **Mobile Touch Compatibility**: HTML5 DnD (`draggable="true"`, `dragstart`) does NOT fire on iOS Safari or Chrome Android without external heavy polyfills. Pointer Events work identically on mobile touch and desktop mouse!
2. **Smooth 60fps Performance**: Pointer events allow direct GPU CSS transform translation without the ghost-image lag inherent to native HTML5 drag images.
3. **Ergonomic Drag Handle**: A dedicated touch-action: none grip handle (`<i data-lucide="grip-vertical"></i>`) ensures user can comfortably scroll the list by touching the row, but instantly drag-reorder by grabbing the grip handle.

### 5.3 Unified Pointer-Reorder Implementation Design
```javascript
/**
 * Attaches pointer-based list reordering to a container.
 * @param {HTMLElement} containerEl - The list container
 * @param {Object} options
 * @param {string} options.itemSelector - Selector for list items (e.g. '.pdf-file-row')
 * @param {string} options.handleSelector - Selector for drag handles (e.g. '.drag-grip-handle')
 * @param {Function} options.onReorder - (fromIndex, toIndex) => void
 * @returns {Function} cleanup
 */
export function attachPointerReorder(containerEl, { itemSelector, handleSelector, onReorder }) {
  // Uses setPointerCapture on drag handle
  // Calculates live index collision based on sibling boundingClientRect midpoints
  // Updates visual drop indicator line
  // Delivers light haptic pulse on pickup (15ms) and placement (20ms)
}
```

### 5.4 Extension to `usePdfQueue.js`
Add `reorderFiles` method:
```javascript
reorderFiles(fromIndex, toIndex) {
  const from = Number(fromIndex);
  const to = Number(toIndex);
  if (from === to || from < 0 || to < 0 || from >= this.files.length || to >= this.files.length) return;
  const [item] = this.files.splice(from, 1);
  this.files.splice(to, 0, item);
  this.notify('files-change');
}
```

---

## 6. Lightbox Keyboard Shortcuts & Mobile Ergonomics Audit

### 6.1 Audit of `PdfPageLightboxModal.js`
Inspected `src/components/tools/pdf/components/PdfPageLightboxModal.js` (218 lines):

```javascript
// Lines 202-214:
activeLightboxKeydownHandler = (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    e.preventDefault();
    closePdfPageLightbox();
  } else if (e.key === 'ArrowLeft' && currentPage > 0) {
    e.preventDefault();
    navigateToPage(currentPage - 1, 0);
  } else if (e.key === 'ArrowRight' && currentPage < total - 1) {
    e.preventDefault();
    navigateToPage(currentPage + 1, 0);
  }
};
window.addEventListener('keydown', activeLightboxKeydownHandler);
```

### 6.2 Identified Flaws & Fixes

1. **Flaw 1: Page Rotation Reset to 0° during Keyboard & Button Navigation**:
   - In lines 183, 187, 208, 211:
     `navigateToPage(currentPage - 1, 0)` and `navigateToPage(currentPage + 1, 0)` hardcodes `newRot = 0`.
   - **Consequence**: If a user is rotating pages in `Rotate` workspace, and page 2 is rotated 180°, pressing `ArrowRight` from page 1 causes page 2 to display at 0° in the lightbox!
   - **Fix**: Accept `getRotationForPage: (pageIndex) => number` callback or query `pageRotations[newPage] || 0`.

2. **Flaw 2: Missing Touch Gestures in Lightbox (Mobile Ergonomics)**:
   - On mobile devices, users intuitively swipe left/right across the large image to flip pages. Currently, only tiny 40px buttons at the bottom work.
   - **Fix**: Attach horizontal touch/pointer swipe on `#pdfLightboxViewport`. Swiping left flips to next page, swiping right flips to previous page, with haptic feedback `navigator.vibrate?.(15)`.

3. **Flaw 3: Backdrop Click-to-Dismiss Missing**:
   - In lines 180-181, only `#btnClosePdfLightbox` closes the modal.
   - Clicking the dark background outside the canvas does nothing.
   - **Fix**: Add backdrop click listener:
     ```javascript
     modal.onclick = (e) => {
       if (e.target.id === 'pdfPageLightboxModal' || e.target.id === 'pdfLightboxBackdrop') {
         closePdfPageLightbox();
       }
     };
     ```

4. **Flaw 4: Body Scroll Leak**:
   - When lightbox is open, scrolling on mobile scrolls the background PDF Studio workspace.
   - **Fix**: Set `document.body.style.overflow = 'hidden'` in `openPdfPageLightbox` and restore in `closePdfPageLightbox`.

5. **Flaw 5: Keyboard Shortcuts Cleanup**:
   - `closePdfPageLightbox` properly unbinds `window.removeEventListener('keydown', activeLightboxKeydownHandler)`. This was verified as cleanly implemented.

---

## 7. Implementation Blueprint

### 7.1 Proposed Modular File Structure
To adhere strictly to Rule 1 (Single Responsibility & Balanced Sizing < 250 lines) and avoid god-files:

```
src/
├── utilities/
│   ├── swipeGesture.js          <-- NEW: Zero-dependency swipe-to-dismiss & slide-to-confirm engine
│   └── dragReorder.js           <-- NEW: Zero-dependency pointer drag-and-drop reorder engine
└── components/
    └── tools/
        └── pdf/
            ├── components/
            │   ├── PdfMultiFileWorkspace.js    <-- UPDATE: Add grip handles, swipe row wrappers, slide-to-clear track
            │   └── PdfPageLightboxModal.js    <-- UPDATE: Fix rotation preservation, touch swipe, backdrop click, body scroll lock
            └── hooks/
                ├── usePdfDom.js                <-- UPDATE: Wire swipe gestures, pointer drag reorder, and lightbox options
                └── usePdfQueue.js              <-- UPDATE: Add reorderFiles(fromIdx, toIdx)
```

### 7.2 UI Production Minimalism Compliance
- In accordance with `.agents/rules/ui-standards.md` and `KI-CON-001`:
  - Zero marketing copy ("Trải nghiệm vuốt xóa siêu nhanh...")
  - Zero parenthetical clutter ("(Kéo sang trái)", "(Vuốt để xóa)")
  - Clean developer utility aesthetics: sleek Geist / JetBrains Mono labels, 40px touch targets, subtle dark canvas `#0B0F17` / `#121215` contrast, crisp amber highlights `#f59e0b`.

---

## 8. Verification Strategy

1. **System & Syntax Verification**:
   - `node --check src/components/tools/pdf/components/*.js src/components/tools/pdf/hooks/*.js src/utilities/*.js`
   - `cd server && npx tsc --noEmit` -> 0 errors.
   - `cd server && npx vitest run` -> 100% test suites pass.
2. **Gesture Interaction Verification**:
   - Touch simulation in DevTools: Swipe left on multi-file row triggers red reveal, threshold trigger, haptic call, and height collapse.
   - Mouse pointer drag: Click and drag row left triggers identical behavior.
   - Pointer drag reorder: Grab grip handle, move vertically, observe smooth placement and index reordering in state.
   - Lightbox shortcuts: `Esc` closes, `ArrowLeft`/`ArrowRight` navigate without resetting page rotations. Touch swipe left/right turns pages.
