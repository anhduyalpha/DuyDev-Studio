# Quality & Adversarial Review Report: Milestone M2 (Touch & Mouse Gestures, Lightbox & Drag-and-Drop)

**Reviewer & Adversarial Critic**: Reviewer v2 M2  
**Parent Orchestrator**: Orchestrator PDF v2 (`e24d9046-d065-4184-aa63-0e966285270d`)  
**Milestone**: M2 (Touch & Mouse Gestures, Lightbox & Drag-and-Drop)  
**Target Work Product**: `worker_v2_m2`  
**Verdict**: **APPROVE**

---

## 1. Observation

Direct code examination and automated verification runs produced the following verified observations:

1. **Touch Slop Disambiguation & Native Scroll Yield (`src/utilities/swipeGesture.js:31–41, 137–149`)**:
   - `isTouchSlopDisambiguated(dx, dy, slopThreshold = 8)`:
     - When `|dx| < 8 && |dy| < 8`, returns `{ resolved: false, isHorizontal: false }`. No pointer capture or preventDefault occurs.
     - When `|dy| >= |dx|`, returns `{ resolved: true, isHorizontal: false }`. In `attachSwipeToDismiss` (line 142), `isTracking` is immediately set to `false` and execution returns early. Because `setPointerCapture` and `preventDefault()` are never called, native vertical scrolling retains 100% compositor control.
     - In `PdfMultiFileWorkspace.js:74`, `.pdf-file-row` explicitly contains CSS class `touch-pan-y`, instructing the browser that vertical touch gestures are native-handled.
     - When `|dx| > |dy| && |dx| >= 8`, horizontal swipe locks the axis (`directionLocked = true`), calls `element.setPointerCapture?.(e.pointerId)`, and blocks browser default scrolling (`if (e.cancelable) e.preventDefault()`).

2. **Swipe Dismiss Mechanics & Destructive Reveal (`src/utilities/swipeGesture.js:53–80, 184–222`, `PdfMultiFileWorkspace.js:67–71`)**:
   - In `calculateSwipeState`: threshold dynamically evaluates to `Math.min(effectiveWidth, Math.max(thresholdPx, effectiveWidth * thresholdRatio))`.
     - On a 400px wide row: threshold is `400 * 0.35 = 140px` (> 100px).
     - On a 200px narrow row: threshold is clamped to `thresholdPx = 100px`.
     - Clamped Dx enforces unidirectional swipe (`clampedDx = Math.min(0, dx)` for `direction='left'`).
   - Behind every row in `PdfMultiFileWorkspace.js`, `.swipe-trash-bg` renders a destructive red surface (`bg-red-500/15 dark:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400`) with a trash icon and uppercase "XÓA" badge.
   - Upon release past threshold: element slides out to `translateX(-105%)` with opacity `0` (180ms ease-out), followed by smooth wrapper collapse (`max-height: 0px`, zeroed margins/paddings, 220ms ease-out), invoking `onComplete` to remove the file from queue and purge bitmaps from `pdfPageCache`.
   - Upon release below threshold: springs back to `translateX(0px)` with `cubic-bezier(0.2, 0.8, 0.2, 1)`.

3. **Slide-to-Clear Toolbar Track (`src/utilities/swipeGesture.js:239–360`, `PdfMultiFileWorkspace.js:48–59`)**:
   - Replaced unguarded single-tap "Xóa tất cả" button with interactive slide confirmation track (`#slideClearTrack`, `#slideClearThumb`, `#slideClearFill`).
   - Thumb requires dragging past 70% (`thresholdRatio = 0.70`) of available track width to trigger.
   - Haptic vibration patterns trigger on threshold crossing (`triggerHaptic(15)`) and completion (`triggerHaptic([15, 30, 15])`).
   - The accessible button `#btnClearAllMultiFiles` is retained with `class="sr-only"` for keyboard navigators and automated test scripts.

4. **Pointer Drag Reorder & Queue Synchronization (`src/utilities/dragReorder.js`, `usePdfQueue.js:429–437`, `usePdfDom.js:264–273`)**:
   - `attachPointerReorder` specifically binds to dedicated `.drag-grip-handle` grip icons (`data-lucide="grip-vertical"`), preventing drag initiation when clicking filenames, action buttons, or inputs.
   - Sets `setPointerCapture` on the handle; listens for pointer moves on `window` to prevent drag dropouts on rapid movement.
   - Dragged element gains visual elevation (`z-index: 40`, `scale-[1.01]`, `ring-2 ring-amber-500`, `shadow-xl`).
   - Sibling elements dynamically shift up or down with 60fps GPU transforms (`translateY(-${itemHeight}px)` / `translateY(${itemHeight}px)`) based on continuous midpoint comparisons in `computeDropIndex`.
   - `usePdfQueue.reorderFiles(fromIndex, toIndex)` validates numeric bounds (`0 <= from, to < files.length`, `from !== to`), splices the item, and emits `this.notify('files-change')`.

5. **Lightbox Ergonomics & Angle Retention (`src/components/tools/pdf/components/PdfPageLightboxModal.js:118–127, 190–197, 202–206, 228–262`)**:
   - `resolveRotation` queries the caller-provided `getRotation(pageIndex)`. In Rotate mode, `usePdfDom.js:137` passes `getRotation: (pageIdx) => qm.pageRotations[pageIdx] || 0`. Navigating pages via ArrowLeft, ArrowRight, prev/next buttons, or touch swipe retains rotated angles (90°, 180°, 270°) without resetting to 0°.
   - Viewport touch/pointer swipe: dragging horizontally on `#pdfLightboxViewport` beyond 35px flips to next (`dx < -35`) or previous (`dx > 35`) page with haptic feedback.
   - Modal backdrop click dismiss: tapping outside interactive buttons, header, dock, and canvas dismisses the modal.
   - Body scroll locking: sets `document.body.style.overflow = 'hidden'` on open and restores `prevBodyOverflow` on close.
   - Keyboard shortcuts: `Esc` closes modal; `ArrowLeft` / `ArrowRight` navigate pages.

6. **Automated Verification & Integrity Audit Results**:
   - `node --check src/utilities/swipeGesture.js src/utilities/dragReorder.js src/components/tools/pdf/hooks/usePdfQueue.js src/components/tools/pdf/components/PdfMultiFileWorkspace.js src/components/tools/pdf/components/PdfPageLightboxModal.js src/components/tools/pdf/hooks/usePdfDom.js`: Exit code 0 (all syntax valid).
   - `cd server && npx tsc --noEmit`: Exit code 0 (0 TypeScript errors).
   - `cd server && npx vitest run tests/unit/pdf_gestures.test.ts`: Exit code 0 (31/31 tests passed).
   - `cd server && npx vitest run tests/unit/pdf_gestures_stress.test.ts`: Exit code 0 (25/25 tests passed).
   - `cd server && npx vitest run`: Exit code 0 (24/24 test files passed, 218/218 tests passed across the entire backend suite).
   - `python scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src"`: Exit code 0 (123 files scanned, 0 fluff detected).
   - Integrity audit: 0 hardcoded test results, 0 dummy facades, 0 unauthorized shortcuts.

---

## 2. Logic Chain

1. **Touch Slop Disambiguation**:
   - *Observation*: Mobile users frequently scroll vertically through file queues. If horizontal swipe engines greedily capture all pointer movements or call `preventDefault()` immediately, vertical scrolling freezes or stutters.
   - *Logic*: The 8px slop window allows distinguishing intentional gestures from hand jitter. When `|dy| >= |dx|`, the vector is vertical; setting `isTracking = false` without pointer capture permanently drops the gesture for that touch cycle and allows the native compositor thread to scroll unhindered.
   - *Conclusion*: Touch slop disambiguation is correctly structured and mathematically sound.

2. **Accidental Queue Deletion Prevention**:
   - *Observation*: Multi-file workspace previously had a bare button `#btnClearAllMultiFiles` that would delete all files with one accidental click.
   - *Logic*: Slide-to-clear requires deliberate linear drag of at least 70% track width. This eliminates accidental deletions while keeping the interaction physical, smooth, and tactile. Keeping `#btnClearAllMultiFiles` with `class="sr-only"` preserves accessibility and programmatic automation without visual clutter.
   - *Conclusion*: Slide-to-clear satisfies Requirement R2 and adheres to UI Production Minimalism.

3. **Arbitrary Reordering Precision**:
   - *Observation*: Reordering multi-file items via buttons was cumbersome for long lists.
   - *Logic*: Dedicated `drag-grip-handle` prevents conflicts with click and swipe listeners. Bounding rect midpoints allow deterministic drop position calculations. Immediate GPU transform feedback gives the user continuous visual clarity of where the item will land. `reorderFiles` ensures array consistency and triggers single re-renders via `notify('files-change')`.
   - *Conclusion*: Drag-and-drop reordering is fluid, robust, and cleanly integrated.

4. **Lightbox Rotation Persistence & Mobile Navigation**:
   - *Observation*: Previous implementation reset page rotation to 0° on every page flip during lightbox inspection.
   - *Logic*: In Rotate mode, each page has an independent angle stored in `qm.pageRotations`. By delegating rotation lookup to `getRotation(pageIndex)`, `navigateToPage` renders the true angle of each page. Adding viewport pointer swipe, backdrop click, body scroll locking, and keyboard shortcuts matches production-grade PDF viewing standards (iLovePDF/Linear).
   - *Conclusion*: Lightbox navigation is completely fixed and ergonomic.

---

## 3. Caveats

1. **Vibration API Platform Support**: iOS Safari and some desktop browsers do not implement `navigator.vibrate`. The implementation defensively wraps vibration in `try/catch` and checks for API availability, ensuring zero runtime exceptions on unsupported devices.
2. **Headless Environment Safety**: For server-side rendering or headless test environments where `window` or DOM APIs are mocked, `dragReorder.js` uses conditional fallbacks (`typeof window !== 'undefined' ? window : container?.ownerDocument?.defaultView`), preventing test crashes.

---

## 4. Conclusion

Milestone M2 is completely implemented, rigorously tested, and fully verified.
- No integrity violations or cheating patterns found.
- All 5 key inspection items (touch slop disambiguation, swipe dismiss mechanics, pointer drag reorder, lightbox rotation retention, and full automated test execution) passed without issues.
- All 218 tests across 24 test suites in `server` passed with 0 errors.

**Verdict: APPROVE**

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Verify JavaScript Syntax**:
   ```powershell
   node --check src/utilities/swipeGesture.js src/utilities/dragReorder.js src/components/tools/pdf/hooks/usePdfQueue.js src/components/tools/pdf/components/PdfMultiFileWorkspace.js src/components/tools/pdf/components/PdfPageLightboxModal.js src/components/tools/pdf/hooks/usePdfDom.js
   ```
   *Expected*: Code 0, no syntax errors.

2. **Verify TypeScript Typecheck**:
   ```powershell
   cd server
   npx tsc --noEmit
   ```
   *Expected*: Code 0, 0 errors.

3. **Run M2 Gesture Unit & Stress Tests**:
   ```powershell
   cd server
   npx vitest run tests/unit/pdf_gestures.test.ts tests/unit/pdf_gestures_stress.test.ts
   ```
   *Expected*: All 56 tests across both suites pass.

4. **Run Entire Vitest Suite**:
   ```powershell
   cd server
   npx vitest run
   ```
   *Expected*: All 24 test files pass (218/218 tests passed).

5. **Verify UI Fluff Absence**:
   ```powershell
   python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src"
   ```
   *Expected*: 0 fluff instances detected.
