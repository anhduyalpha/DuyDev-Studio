## 2026-10-04T00:33:56Z
You are the Implementation Worker for Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling) of the Quiz Pipeline v3.0 Upgrade in DuyDev Studio.

## Working Directory
`C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m3`

## Key Documents to Read
1. `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (Read first!)
2. `C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md` (§WP5)
3. Explorer Reports:
   - `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m3_katex_vendor\handoff.md`
   - `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m3_html_templates\handoff.md`
   - `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m3_chrome_flags\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. `.gitignore`: Add `!engines/quiz/assets/**` to ensure KaTeX vendor files are tracked and never ignored.
2. `engines/quiz/quiz_pipeline.py`:
   - Top level: Define `ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))` and `KATEX_SRC_DIR = os.path.join(ENGINE_DIR, "assets", "katex")`.
   - `generate_worksheet_html` and `generate_answer_key_html`:
     - Remove dead parameter `questions_per_page`.
     - In `<head>`: replace all 3 `cdn.jsdelivr.net` lines with `<link rel="stylesheet" href="./katex/katex.min.css">`.
     - In `<body>`: move script tags to the end of `<body>` without `defer` and without `DOMContentLoaded` wrapper:
       ```html
       <script src="./katex/katex.min.js"></script>
       <script src="./katex/contrib/auto-render.min.js"></script>
       <script>
         renderMathInElement(document.body, {
           delimiters: [
             {left: '$$', right: '$$', display: true},
             {left: '$', right: '$', display: false},
             {left: '\\(', right: '\\)', display: false},
             {left: '\\[', right: '\\]', display: true}
           ],
           ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
           ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
           throwOnError: false
         });
       </script>
       ```
       (Preserve delimiters, ignoredClasses, and ignoredTags exactly as required).
   - `compile_pdf` -> `run_chrome_worker`:
     - Add 4 Chrome flags:
       `--allow-file-access-from-files`
       `--virtual-time-budget=8000`
       `--run-all-compositor-stages-before-draw`
       `--disable-features=NetworkService`
     - Lower timeout polling loop from 30s to 15s (`while time.time() - start_time < 15:`).
   - `run_pipeline`:
     - Fail-fast check at the beginning: `if not os.path.isdir(KATEX_SRC_DIR): raise RuntimeError("Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. Vui lòng cài đặt lại engine.")`.
     - Create per-job isolated directory: `job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")` and `os.makedirs(job_html_dir, exist_ok=True)`.
     - Copy KaTeX locally: `shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)`.
     - Place HTML paths in `job_html_dir`: `ws_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DeBai.html")`, `ans_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DapAn.html")`.
     - In `finally` block: ensure `job_html_dir` is cleanly removed via `shutil.rmtree(job_html_dir, ignore_errors=True)`.

3. `engines/quiz/test_quiz_pipeline_v2.py`:
   - In `test_katex_delimiters_and_ignored_classes`:
     - Update CDN assertions to check for `./katex/katex.min.css`, `./katex/katex.min.js`, `./katex/contrib/auto-render.min.js`.
     - Add `self.assertNotIn("cdn.jsdelivr.net", ws_html)` and `self.assertNotIn("cdn.jsdelivr.net", ans_html)`.
     - Keep all delimiter, ignoredClasses, ignoredTags assertions 100% intact.
   - Append 3 new unit tests for WP5:
     1. `test_katex_assets_exist_locally`: verify existence of `katex.min.css`, `katex.min.js`, `contrib/auto-render.min.js`, and `.woff2` font files in `KATEX_SRC_DIR`.
     2. `test_run_pipeline_fails_fast_when_katex_missing`: mock `KATEX_SRC_DIR` missing, verify clear Vietnamese `RuntimeError`.
     3. `test_job_html_dir_cleaned_up_in_finally`: verify per-job directory cleanup.

4. Execute all verification commands:
   - `rg "cdn.jsdelivr" engines/quiz/` (MUST BE 0 MATCHES).
   - `python engines/quiz/test_quiz_pipeline_v2.py` (Must be 38/38 passing).
   - `python engines/quiz/test_mcq_parser.py` (19/19 passing).
   - `python engines/quiz/test_adversarial_wp2.py` (20/20 passing).
   - `python engines/quiz/test_adversarial_wp3_wp8.py` (14/14 passing).
   - `cd server && npx tsc --noEmit` (0 errors).
   - `cd server && npx vitest run tests/unit/quiz.test.ts` (All passing).
   - Run a headless print probe to confirm 0 raw `$` in text layer.

5. Write detailed `handoff.md` and send_message to parent orchestrator.
