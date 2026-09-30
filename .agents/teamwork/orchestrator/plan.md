# Project Plan: Purge AI UI Annotations & Enforce Production Minimalism

## 1. Scope & Objective
Eliminate all AI-generated UI annotations ("AI-ified" UI), promotional/marketing filler text, parenthetical explanations, and patronizing helper text across the entire web interface (`src/`). Ensure compliance with `.agents/rules/ui-standards.md` and `docs/knowledge-base/KI-CON-001-ui-production-minimalism.md` to establish a production-grade developer utility standard (Linear/Vercel dark aesthetic).

## 2. Directory & Responsibility Matrix
- **Subagent A (Tools Specialist)**:
  - Exclusive Scope: `src/components/tools/{qr, pdf, archive, converter, hash, image}/`
  - Focus: Strip parentheticals in format selectors/badges (`(Ảnh số)`, `(Vector in ấn)`, `(Phổ biến)`, `(Mặc định)`), remove subtitles beneath action buttons and preview panels, condense upload dropzones into single concise technical lines.
  - Deliverable: Completed surgical purge across 14 files; verified clean with 0 fluff violations.
- **Subagent B (Pages & Shell Specialist)**:
  - Exclusive Scope: `src/components/layout/`, `src/components/dashboard/`, `src/components/common/`, `src/pages/`
  - Focus: Eliminate instructional fluff, verbose card descriptions, simplify labels and placeholders to direct, concise developer utility aesthetic.
  - Deliverable: Completed surgical purge across 22 files; verified clean with 0 fluff violations.
- **Subagent C (QA, Layout Hygiene & Verification Specialist)**:
  - Cross-cutting Scope: Entire `src/` directory.
  - Focus: Clean up orphaned margins (`mt-1.5`, `mt-2`, `space-y-*`), ensure 100% preservation of `aria-label`, form controls, keyboard shortcuts, and dark canvas (`#0B0F17`). Purged unassigned modules (`studocu`, `useToolRegistry.js`, shared hooks).
  - Execution of verification script: `python "C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py" "c:\Users\AnhDuy\Code\Project\DD Studio\src"`. 110 files scanned, 0 fluff violations.

## 3. Milestones & Phases

| Milestone | Agent | Target Files | Key Deliverables | Status |
|-----------|-------|--------------|------------------|--------|
| M1: Tools Purging | Subagent A | `src/components/tools/` | Cleaned tool components, no parentheticals or button fluff | DONE |
| M2: Shell & Pages Purging | Subagent B | `src/components/{layout,dashboard,common}/`, `src/pages/` | Cleaned layout/dashboard/pages, utility hub style | DONE |
| M3: QA & Layout Hygiene | Subagent C | Entire `src/` | Whitespace fix, aria integrity, clean scan_ui_fluff exit 0 | DONE |
| M4: Final Synthesis & Victory Claim | Orchestrator | `.agents/teamwork/` | Handoff report, victory summary sent to Sentinel | DONE |

## 4. Verification & Acceptance Criteria
- [x] 0 instances of obvious parenthetical explanations like `(Ảnh số)`, `(Vector)`, `(Phổ biến)`, `(Mặc định)`.
- [x] 0 marketing/PR/tutorial fluff sentences under buttons or preview headers (`"Sẵn sàng in ấn..."`, `"Giải mã tức thì..."`).
- [x] All dropzones condensed to 1 concise line (`"Kéo thả hoặc tải tệp lên"`) + accepted file extensions.
- [x] All placeholders and labels concise and direct.
- [x] No orphaned margins (`mt-2`, `space-y-*`) or awkward blank spaces left behind.
- [x] 100% preservation of `aria-label`, `title`, events, and functional DOM structure.
- [x] Consistent Dark Canvas (`#0B0F17`) theme.
- [x] `scan_ui_fluff.py` reports 0 errors across 110 files in `src/` with clean exit code 0.
- [x] `cd server && npx tsc --noEmit` passed with 0 errors.
- [x] `cd server && npx vitest run` passed with 14/14 test files and 76/76 unit & integration tests.
