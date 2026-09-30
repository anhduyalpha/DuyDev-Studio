# UI Annotation Purger Skill
(Local copy in .agents/teamwork/subagent_a_tools/)

See C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\SKILL.md
Methodology:
1. Automated scan with scan_ui_fluff.py
2. Ingestion & triage of parentheticals, button subtitles, marketing hype, verbose dropzones, bot persona, qualitative badges
3. Surgical code editing preserving aria-label, event handlers, state hooks
4. Layout and whitespace hygiene (pruning orphaned mt-1.5, mt-2, space-y-*)
5. Verification with 0 fluff violations
