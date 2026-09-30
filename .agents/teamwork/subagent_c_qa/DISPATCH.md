## 2026-09-24T16:03:18Z

You are Subagent C: QA, Layout Hygiene & Verification Specialist (Worker) on the project "Purge AI UI Annotations & Enforce Production Minimalism" for DuyDev Studio.

Your working directory is:
`c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\subagent_c_qa`

Your scope is:
The entire project `src/` directory, focusing on quality assurance, layout hygiene, accessibility verification, and full-project scan.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Prior Work:
1. Subagent A completed purging in `src/components/tools/`:
   Report: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\subagent_a_tools\handoff.md`
2. Subagent B completed purging in `src/components/layout/`, `src/components/dashboard/`, `src/components/common/`, and `src/pages/`:
   Report: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\subagent_b_pages\handoff.md`
3. UI Standards & Knowledge Item:
   `.agents/rules/ui-standards.md`
   `docs/knowledge-base/KI-CON-001-ui-production-minimalism.md`
   `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md`
4. Skill instructions:
   `C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\SKILL.md`

Your Tasks:
1. Inspect central tool registry and remaining files in `src/hooks/` (especially `src/hooks/useToolRegistry.js`), `src/app.js`, etc. Ensure tool titles, badges, and descriptions adhere to production minimalism (e.g. check for any remaining marketing tags like "Pro", verbose descriptions, or parenthetical annotations). If any remain, refactor them cleanly.
2. Layout & Spacing Hygiene Audit:
   - Audit touched components across `src/` for orphaned margins (`mt-1.5`, `mt-2`, `space-y-*`), broken flex/grid alignments, or unnatural blank spaces left behind by deleted text elements.
   - Fix any awkward spacing issues to ensure tight, developer-grade information density (Linear/Vercel style).
3. Accessibility & DOM Verification:
   - Verify that 100% of functional DOM IDs, form controls, `aria-label`, `title`, keyboard shortcuts (e.g., ⌘K), and event listeners are intact and operative.
   - Verify consistent Dark Canvas (`#0B0F17`) and elevated dark surfaces (`#18181B`).
4. Full Codebase Diagnostic Scan:
   Run the fluff scanner across the ENTIRE `src/` directory:
   `python "C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py" "c:\Users\AnhDuy\Code\Project\DD Studio\src"`
   Confirm that it returns 0 violations (clean exit code 0).
5. Run Project Verification Commands:
   - `cd server && npx tsc --noEmit` -> Must pass with 0 errors.
   - `cd server && npx vitest run` -> Must pass all tests.
6. Acceptance Criteria Audit:
   Systematically verify every acceptance criterion from `ORIGINAL_REQUEST.md`:
   - [ ] 0 trường hợp mở ngoặc giải thích hiển nhiên kiểu `(Ảnh số)`, `(Vector)`, `(Phổ biến)`, `(Mặc định)` còn tồn tại trong `src/`.
   - [ ] 0 câu tiếp thị/PR/hướng dẫn thừa thãi dưới nút bấm (`"Sẵn sàng in ấn..."`, `"Giải mã tức thì..."`).
   - [ ] Toàn bộ dropzone hiển thị 1 dòng ngắn gọn (`"Kéo thả hoặc tải tệp lên"`) kèm danh sách đuôi file kỹ thuật.
   - [ ] Toàn bộ placeholder và label ngắn gọn, trực diện, không mang tính trò chuyện bot AI.
   - [ ] Không có khoảng trống bất thường hoặc margin mồ côi (`mt-2`, `space-y-*`) sau khi xóa text.
   - [ ] Giữ nguyên 100% các thuộc tính `aria-label`, `title`, sự kiện bấm, và cấu trúc DOM chức năng.
   - [ ] Theme Dark Canvas (`#0B0F17`) và Vercel/Linear dark minimalism đồng bộ trên mọi màn hình.
   - [ ] Script chẩn đoán `scan_ui_fluff.py` quét toàn bộ `src/` đạt kết quả 0 lỗi (clean exit code 0).
7. Deliverables:
   Write `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\subagent_c_qa\handoff.md` with:
   - Detailed audit findings and any hygiene fixes made
   - Verbatim outputs of `scan_ui_fluff.py`, `tsc`, and `vitest`
   - Explicit check-off of each acceptance criterion
   Send a completion message back to the parent orchestrator.
