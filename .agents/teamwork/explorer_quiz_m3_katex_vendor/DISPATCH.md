## 2026-10-04T00:26:09Z
[Message] timestamp=2026-10-04T00:26:09Z sender=973de344-1990-4ba0-bff2-d8fc79ff96f1 priority=MESSAGE_PRIORITY_HIGH content=You are Explorer 1 for Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling) in Quiz Pipeline v3.0 Upgrade.

## Working Directory
`C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m3_katex_vendor`

## Key Documents
1. `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (Read first!)
2. `C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md` (§WP5)
3. `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_quiz_gen2\PROJECT.md`

## Your Task
Investigate vendoring KaTeX v0.16.11 locally and per-job directory setup:
1. Examine how to vendor KaTeX v0.16.11:
   - Check if `katex` package is available or how to fetch it via `npm pack katex@0.16.11` into a temporary directory.
   - Determine exact target structure in `engines/quiz/assets/katex/`:
     - `katex.min.css`
     - `katex.min.js`
     - `contrib/auto-render.min.js`
     - `fonts/*.woff2` (only woff2 files, skip ttf/woff).
2. Check `.gitignore` at repo root: ensure `engines/quiz/assets/` or `*.woff2` is NOT ignored. Specify any needed gitignore negation rule (`!engines/quiz/assets/**`).
3. Inspect `run_pipeline` in `engines/quiz/quiz_pipeline.py`:
   - How `KATEX_SRC_DIR` is defined.
   - How `job_html_dir` with uuid should be created in temp dir.
   - How `shutil.copytree` copies KaTeX to `job_html_dir/katex`.
   - How `job_html_dir` is safely cleaned up in the `finally` block.
   - Fail-fast check if `KATEX_SRC_DIR` is missing.
4. Deliver concrete step-by-step implementation diffs and verification methods in `handoff.md` and send_message to parent.
