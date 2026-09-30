# Orchestration Plan: PDF Studio Pro v2 (Continuous Thumbnails & Gestures Overhaul)

## Objectives
Deliver a bulletproof, production-grade PDF Studio Pro module adhering to Linear/iLovePDF standards, addressing:
1. R1: Continuous 8-thumbnail panel rendering & robust bitmap caching during job processing.
2. R2: Swipe-to-clear gesture (touch & pointer/mouse drag) with haptic feedback, animation, Lightbox keyboard shortcuts (Esc, arrow keys), smooth drag-and-drop.
3. R3: Standardization of all 9 PDF tools.
4. R4: Production minimalism, resource revocation (URL.revokeObjectURL, abort controllers, canvas cleanup), tab-locking on isProcessing.
5. System acceptance: tsc 0 errors, vitest 100% pass, node --check pass, homeserver 192.168.2.171 sync & service UP.

## Plan Steps
1. **Phase 0: Multi-angle Survey (3 Explorers)**
   - Explorer A (Thumbnail & Cache): Investigate why thumbnails turn black/spin endlessly during processing, inspect `PdfSplitWorkspace.js`, `PdfRotateWorkspace.js`, `PdfPreviewCanvas.js`, and caching in `usePdfQueue.js`.
   - Explorer B (Gestures & Ergonomics): Investigate touch/mouse drag gesture implementation, file list swipe-to-clear, haptic feedback, and Lightbox keyboard event listeners.
   - Explorer C (9-Tools Consistency & Deployment): Survey all 9 workspaces, verify action buttons, tab locking, resource cleanup, Vitest test cases, and homeserver deployment sync state.
2. **Phase 1: Synthesis & PROJECT.md Formulation**
   - Synthesize survey findings into Feature Inventory and Milestones.
3. **Phase 2: Milestone Execution & Quality Gates**
   - Milestone M1: Continuous Thumbnail Display & In-Memory Bitmap Cache (Worker -> Reviewer -> Challenger -> Auditor)
   - Milestone M2: Swipe-to-Clear Touch/Pointer Gesture & Lightbox Ergonomics (Worker -> Reviewer -> Challenger -> Auditor)
   - Milestone M3: 9-Tools Premium Ergonomics & Production Minimalism (Worker -> Reviewer -> Challenger -> Auditor)
   - Milestone M4: Verification, Test Suite & Homeserver Live Deployment
4. **Phase 3: Final Acceptance & Sentinel Reporting**
