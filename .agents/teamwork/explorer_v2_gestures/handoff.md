# Handoff Report: Requirement R2 (Gestures & Touch Ergonomics)

**Investigator**: Explorer 2 (Gestures & Touch Ergonomics Specialist)  
**Target Milestone**: R2 — Swipe-to-Clear, Ergonomic Touch & Pointer Gestures, Lightbox Shortcuts & Mobile Navigation, Zero-Lag Drag & Drop Reordering  
**Handoff Type**: Hard (Investigation complete)

---

## 1. Observation

### Observation 1: Current Multi-File Workspace lacks Drag-and-Drop and Swipe Gestures
- **File**: `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`
- **Lines 44–48**:
  ```javascript
  ${files.length > 0 ? `
    <button id="btnClearAllMultiFiles" type="button" class="min-h-[40px] px-3 py-2 rounded-xl text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 text-xs font-medium transition cursor-pointer">
      Xóa tất cả
    </button>
  ` : ''}
  ```
  *Observed*: "Xóa tất cả" is an instant, unguarded button click that immediately destroys the queue without swipe confirmation.
- **Lines 83–96**:
  ```javascript
  <!-- Reorder & Action Controls -->
  <div class="flex items-center gap-1 shrink-0">
    <button type="button" data-move-up="${idx}" title="Lên"
      class="btn-file-move-up w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition cursor-pointer ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}">
      <i data-lucide="arrow-up" class="w-4 h-4"></i>
    </button>
    <button type="button" data-move-down="${idx}" title="Xuống"
      class="btn-file-move-down w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition cursor-pointer ${idx === files.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}">
      <i data-lucide="arrow-down" class="w-4 h-4"></i>
    </button>
    <button type="button" data-remove-multi-id="${f.id}" title="Xóa"
      class="btn-file-remove w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 flex items-center justify-center transition cursor-pointer ml-1">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  </div>
  ```
  *Observed*: Only step-by-step buttons (`arrow-up`, `arrow-down`, and remove `x`) are rendered. No `draggable` attribute, no pointer drag handles, and no horizontal swipe listeners exist.

### Observation 2: Queue Manager lacks arbitrary index reordering
- **File**: `src/components/tools/pdf/hooks/usePdfQueue.js`
- **Lines 411–427**:
  ```javascript
  moveFileUp(index) {
    const idx = Number(index);
    if (idx <= 0 || idx >= this.files.length) return;
    const temp = this.files[idx];
    this.files[idx] = this.files[idx - 1];
    this.files[idx - 1] = temp;
    this.notify('files-change');
  }

  moveFileDown(index) {
    const idx = Number(index);
    if (idx < 0 || idx >= this.files.length - 1) return;
    const temp = this.files[idx];
    this.files[idx] = this.files[idx + 1];
    this.files[idx + 1] = temp;
    this.notify('files-change');
  }
  ```
  *Observed*: Only adjacent single-step index swaps exist. An arbitrary reorder method (`reorderFiles(fromIdx, toIdx)`) required for fluid drag-and-drop is absent.

### Observation 3: Lightbox Shortcuts exist but possess a Critical Rotation Reset Bug
- **File**: `src/components/tools/pdf/components/PdfPageLightboxModal.js`
- **Lines 182–188 and 206–212**:
  ```javascript
  document.getElementById('btnLightboxPrev')?.addEventListener('click', () => {
    if (currentPage > 0) navigateToPage(currentPage - 1, 0);
  });

  document.getElementById('btnLightboxNext')?.addEventListener('click', () => {
    if (currentPage < total - 1) navigateToPage(currentPage + 1, 0);
  });

  // ...
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
  ```
  *Observed*:
  1. `navigateToPage(currentPage ± 1, 0)` forces `newRot = 0` on every navigation step. In Rotate mode, any previously rotated pages (90°, 180°, 270°) are erroneously reset to 0° when navigated via keyboard arrows or prev/next buttons.
  2. Clicking the dark backdrop (`#pdfPageLightboxModal`) does NOT close the modal; only the small top-right close button or `Esc` closes it.
  3. No touch swipe gestures exist in Lightbox for mobile users.
  4. Background body scrolling is not locked (`document.body.style.overflow = 'hidden'` is missing).
  5. Window listener cleanup is cleanly executed in `closePdfPageLightbox`: `window.removeEventListener('keydown', activeLightboxKeydownHandler)`.

### Observation 4: Syntax and Test Integrity
- **Command**: `node --check src/components/tools/pdf/PdfWorkspace.js src/components/tools/pdf/components/DropzoneQueue.js src/components/tools/pdf/components/PdfMultiFileWorkspace.js src/components/tools/pdf/components/PdfSplitWorkspace.js src/components/tools/pdf/components/PdfRotateWorkspace.js src/components/tools/pdf/components/PdfPageLightboxModal.js src/components/tools/pdf/hooks/usePdfDom.js src/components/tools/pdf/hooks/usePdfQueue.js`
  *Result*: Exited with code 0 (all files valid JS syntax).
- **Command**: `cd server && npx tsc --noEmit`
  *Result*: Exited with code 0 (0 TypeScript errors).
- **Command**: `cd server && npx vitest run`
  *Result*: Unit tests pass (`tests/unit/pdf.test.ts` passed 14/14 tests; `tests/integration/api.test.ts` passed 13/13 tests).

---

## 2. Logic Chain

1. **Requirement R2 mandates Swipe-to-Clear and Ergonomic Touch/Pointer Interactions**:
   - The user needs to quickly clear the file queue or dismiss individual files on both mobile touch and desktop mouse drag with smooth slide animations and haptic feedback (`navigator.vibrate?.([15, 30, 15])`).
   - Based on Observation 1, the current queue only has an unguarded plain button for clear-all and up/down buttons for rows.
   - Therefore, a dual-layer swipe mechanism is required:
     - **Item-level**: Swipe row left with red destructive reveal, 35% threshold, slide-out exit, and haptic feedback.
     - **Queue-level**: An ergonomic inline slide-to-clear track / gesture replacing the dangerous instant button.

2. **Scroll Collision & Axis Disambiguation**:
   - In mobile browsers, horizontal swipe gestures on list items often collide with vertical list scrolling, causing jerky stutter.
   - By implementing an 8px touch slop detection where $|dy| \ge |dx|$ yields immediately to native browser scroll, and $|dx| > |dy|$ locks horizontal swipe and captures pointer via `setPointerCapture`, scrolling remains 100% fluid and natural.

3. **Drag & Drop Reordering without Stutter**:
   - HTML5 DnD is unsupported on mobile browsers without heavy polyfills.
   - Based on Observation 1 & 2, no drag-and-drop exists currently in `PdfMultiFileWorkspace.js` or `usePdfQueue.js`.
   - By designing a unified Pointer-based reordering engine (`pointerdown`, `pointermove`, `pointerup`) with a dedicated grip handle (`grip-vertical`, `touch-action: none`) and 60fps GPU transforms (`translateY`), reordering works seamlessly on both mobile touch and desktop mouse.
   - Adding `reorderFiles(fromIdx, toIdx)` to `usePdfQueue.js` enables state-level persistence of arbitrary reordering.

4. **Lightbox Corrections**:
   - Based on Observation 3, keyboard shortcuts are registered at window level and properly cleaned up on modal close.
   - However, forcing `rotation = 0` on arrow navigation corrupts the user's view in Rotate mode.
   - Fixing this requires passing `getRotationForPage(pageIdx)` or querying `pageRotations`.
   - Adding backdrop click dismiss, touch swipe left/right for page flipping, and body scroll locking elevates the Lightbox to top-tier production grade.

---

## 3. Caveats

1. **Haptic Feedback Support**: `navigator.vibrate` is supported on Android Chrome and modern mobile browsers, but iOS Safari does not implement the Vibration API. The implementation must use optional chaining (`navigator.vibrate?.(...)`) so it executes safely without errors on unsupported devices.
2. **Read-Only Investigation**: As Explorer 2, no application source code files have been modified. All proposed additions and refactorings are fully detailed in `analysis.md` and this handoff report.
3. **No External Dependencies**: DD Studio is a Zero-Build Native ES Modules architecture. All gesture utilities must remain 100% pure vanilla JavaScript without introducing npm packages like Hammer.js or Sortable.js.

---

## 4. Conclusion

The investigation of Requirement R2 is complete. The system currently lacks drag-and-drop and swipe gestures, and has a critical rotation reset flaw in the Lightbox. 

The implementation roadmap is clearly defined and ready for execution:
1. **Create `src/utilities/swipeGesture.js`**: Lightweight, zero-dependency pointer & touch swipe engine with dual-axis locking, threshold math (>35% / 100px), spring physics, height collapse, and haptic feedback (`[15, 30, 15]`).
2. **Create `src/utilities/dragReorder.js`**: Zero-dependency pointer-based vertical list reordering with touch handle (`grip-vertical`), ghost slot indicators, and haptic pickup/drop ticks.
3. **Extend `usePdfQueue.js`**: Add `reorderFiles(fromIndex, toIndex)`.
4. **Update `PdfMultiFileWorkspace.js`**: Integrate grip handles, swipe row wrappers with hidden red destructive trash backgrounds, and inline slide-to-clear queue toolbar.
5. **Update `PdfPageLightboxModal.js`**: Fix the rotation reset bug on navigation, add touch swipe page navigation, add backdrop click dismiss, and lock background body scroll.
6. **Update `usePdfDom.js`**: Wire swipe-to-dismiss, pointer drag reorder, and lightbox rotation getters.

---

## 5. Verification Method

To independently verify the investigation findings and any future implementation:

1. **Syntax & TypeScript Integrity**:
   ```powershell
   node --check src/components/tools/pdf/PdfWorkspace.js src/components/tools/pdf/components/PdfMultiFileWorkspace.js src/components/tools/pdf/components/PdfPageLightboxModal.js src/components/tools/pdf/hooks/usePdfDom.js src/components/tools/pdf/hooks/usePdfQueue.js
   cd server
   npx tsc --noEmit
   npx vitest run
   ```
2. **Gesture & Lightbox Behavioral Verification**:
   - Inspect `PdfPageLightboxModal.js` lines 183 & 208 to confirm `navigateToPage(currentPage - 1, 0)` is currently present.
   - Inspect `PdfMultiFileWorkspace.js` lines 83–96 to confirm only up/down buttons exist.
   - In browser:
     - Open `#tool/pdf-studio` in Merge mode with 3+ PDF files.
     - Swipe row left with touch or mouse drag: row translates smoothly, reveals red trash layer, collapses and removes file on release beyond 35% width.
     - Grab grip handle on row 3 and drag to row 1: smooth 60fps tracking without page scrolling, reorders files correctly.
     - Open Lightbox on a rotated page (e.g. 90°): press `ArrowRight` and `ArrowLeft`: verify rotated pages retain their individual angles. Swipe left/right on touch screen to turn pages. Press `Esc` or click backdrop to dismiss.
