# Handoff Report — Reviewer 1 (Milestone 3: WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling)

## Review Summary

**Verdict**: **APPROVE**  
**Integrity Status**: **CLEAN (0 integrity violations)**. No hardcoded test outputs, no facade implementations, no task bypassing, and no fabricated artifacts detected.

---

## 1. Observation

### 1.1 Git Tracking & Asset Whitelisting
- In `.gitignore` line 97:
  ```gitignore
  # Quiz Engine Assets
  !engines/quiz/assets/**
  ```
- Command: `git check-ignore -v engines/quiz/assets/katex/katex.min.js`
  Result:
  ```
  .gitignore:97:!engines/quiz/assets/**	engines/quiz/assets/katex/katex.min.js
  ```
  Confirms that KaTeX vendor files in `engines/quiz/assets/**` are intentionally tracked and never ignored by Git.

### 1.2 KaTeX Local Vendor Assets
- Inspected directory `engines/quiz/assets/katex/`:
  - `katex.min.css`: 23,335 bytes (v0.16.11).
  - `katex.min.js`: 275,414 bytes.
  - `contrib/auto-render.min.js`: 3,481 bytes (`renderMathInElement`).
  - `fonts/`: Exactly 20 `.woff2` font files (~246 KB). Zero `.ttf` or `.woff` files.
  - Total local asset bundle size: ~549 KB.
  - `katex.min.css` relative font references: `url(fonts/KaTeX_*.woff2) format("woff2")` correctly match the `./katex/fonts/` directory structure.

### 1.3 `quiz_pipeline.py` Code Changes
- **Module Constants** (lines 45-46):
  ```python
  ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
  KATEX_SRC_DIR = os.path.join(ENGINE_DIR, "assets", "katex")
  ```
- **Template Declarations** (lines 1375 and 1651):
  - Function signatures: `def generate_worksheet_html(title: str, subtitle: str, questions: list[dict]) -> str:` and `def generate_answer_key_html(title: str, subtitle: str, questions: list[dict]) -> str:`. Dead parameter `questions_per_page` has been completely removed.
  - In `<head>`: CDN lines replaced by `<link rel="stylesheet" href="./katex/katex.min.css">`.
  - In `<body>`: Scripts placed at the very end of `<body>` without `defer` or `DOMContentLoaded` wrapper:
    ```html
      <script src="./katex/katex.min.js"></script>
      <script src="./katex/contrib/auto-render.min.js"></script>
      <script>
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: '$$', right: '$$', display: true}},
            {{left: '$', right: '$', display: false}},
            {{left: '\\\\(', right: '\\\\)', display: false}},
            {{left: '\\\\[', right: '\\\\]', display: true}}
          ],
          ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
          ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
          throwOnError: false
        }});
      </script>
    ```
- **Chrome Headless Printing Flags & Timeout** (lines 1945-1965):
  - Headless flags: Added `--allow-file-access-from-files`, `--virtual-time-budget=8000`, `--run-all-compositor-stages-before-draw`, and `--disable-features=NetworkService`.
  - Polling timeout: Reduced from 30s to 15s (`while time.time() - start_time < 15:`).
- **Fail-Fast & Job HTML Isolation** (lines 2045-2064, 2151-2156):
  - Pre-flight check:
    ```python
    if not os.path.isdir(KATEX_SRC_DIR):
        raise RuntimeError(
            "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
            "Vui lòng cài đặt lại engine."
        )
    ```
  - Job isolation: Creates `job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")` and copies KaTeX via `shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)`.
  - Cleanup: Atomic removal of `job_html_dir` in `finally` via `shutil.rmtree(job_html_dir, ignore_errors=True)`.

### 1.4 Test Suite Verification Results
- `rg "cdn.jsdelivr" engines/quiz/`: Exit code 1 (**0 matches found**).
- `python engines/quiz/test_quiz_pipeline_v2.py`: **Ran 38 tests in 1.541s — OK** (38/38 passed).
  - Includes 3 new WP5 tests: `test_katex_assets_exist_locally`, `test_run_pipeline_fails_fast_when_katex_missing`, `test_job_html_dir_cleaned_up_in_finally`.
  - Updated CDN assertion in `test_katex_delimiters_and_ignored_classes` to assert local `./katex/` and absence of `cdn.jsdelivr.net`.
- `python engines/quiz/test_mcq_parser.py`: **Ran 19 tests in 0.006s — OK** (19/19 passed).
- `python engines/quiz/test_adversarial_wp2.py`: **Ran 20 tests in 0.026s — OK** (20/20 passed).
- `python engines/quiz/test_adversarial_wp3_wp8.py`: **Ran 14 tests in 0.653s — OK** (14/14 passed).
- `cd server && npx tsc --noEmit`: Exit code 0 (**0 errors**).
- `cd server && npx vitest run tests/unit/quiz.test.ts`: **13 passed (13)** in 2.61s.

### 1.5 Independent Live Offline Headless Chrome Probe
- Executed independent math rendering test via headless Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`):
  - Formulas tested: `$y = \sqrt{x^2 - 4x + 3}$`, `$S = \frac{1}{2}ab\sin C$`, `$[1; 3]$`, `$(-\infty; 1] \cup [3; +\infty)$`, `$\mathbb{R}$`, `$x^2 - 4x + 3 \ge 0 \iff x \le 1$`.
  - Text layer extraction via PyMuPDF:
    - Worksheet text length: 343 characters, raw dollar character count (`$`) = **0**.
    - Answer key text length: 238 characters, raw dollar character count (`$`) = **0**.
    - Compilation duration: ~2.1s (well under the 15s budget).

---

## 2. Logic Chain

1. **Elimination of External CDN Dependency**:
   - Observations 1.2 and 1.4 prove all KaTeX assets (JS, CSS, auto-render, fonts) exist locally in `engines/quiz/assets/katex/`.
   - Ripgrep verification confirms 0 matches of `cdn.jsdelivr` in `engines/quiz/`.
   - As a consequence, Chrome does not make outbound network calls during offline execution, preventing the prior 30s hang and 60s timeout crash.

2. **Resolution of Math Render Race Condition**:
   - In earlier versions, `defer` scripts wrapped with `DOMContentLoaded` caused Chrome's `--print-to-pdf` to capture the page before KaTeX rendered LaTeX strings into DOM elements.
   - Moving scripts to the bottom of `<body>` and removing `defer`/`DOMContentLoaded` guarantees math rendering occurs synchronously during DOM parsing before the `load` event.
   - Chrome flags `--virtual-time-budget=8000` and `--run-all-compositor-stages-before-draw` ensure all Blink compositor passes finish prior to the snapshot.
   - Observation 1.5 confirms 0 raw `$` symbols in the extracted PDF text layer, proving complete pre-snapshot rendering.

3. **Concurrency Isolation & Temp Hygiene**:
   - Storing each job's HTML and local KaTeX assets in a dedicated `quiz_html_<uuid>` directory prevents file collisions between concurrent jobs.
   - Observation 1.3 and unit test `test_job_html_dir_cleaned_up_in_finally` confirm that `job_html_dir` is safely and completely deleted in the `finally` block even when pipeline execution fails.

---

## 3. Caveats & Adversarial Findings

### [Minor Finding] Temp Directory Creation Precedes API Key Check
- **Where**: `engines/quiz/quiz_pipeline.py:2057-2068`
- **Issue**: `temp_assets_dir` and `job_html_dir` are created (and KaTeX copied) before validating `key = api_key or DEFAULT_API_KEY`. If an empty API key is passed and `DEFAULT_API_KEY` is not set, a `ValueError` is raised before entering the `try: ... finally:` block, leaving the freshly copied `job_html_dir` in `tempfile.gettempdir()`.
- **Severity**: Minor (Non-blocking).
- **Recommendation**: In a future refactor/hardening pass, validate `api_key` prior to directory creation, or wrap directory creation within the `try:` block.

---

## 4. Conclusion

Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling) satisfies all functional requirements, architectural constraints, and quality standards:
1. KaTeX v0.16.11 is vendored locally and tracked via `.gitignore`.
2. CDN dependencies are eliminated (0 occurrences of `cdn.jsdelivr` in `engines/quiz/`).
3. Chrome headless flags and 15s timeout are integrated.
4. Math formulas render 100% offline with zero raw `$` remaining in the PDF text layer.
5. All 91 Python unit tests pass (38 + 19 + 20 + 14 = 91), TypeScript compiles with 0 errors, and server Vitest passes 13/13.
6. Dead parameter `questions_per_page` has been purged.

**Final Verdict**: **APPROVE**

---

## 5. Verification Method

To reproduce and verify these findings independently:

1. **Verify 0 CDN Usages**:
   ```bash
   rg "cdn.jsdelivr" engines/quiz/
   ```
   *Expected*: Exit code 1, 0 matches.

2. **Verify Git Ignore Whitelisting**:
   ```bash
   git check-ignore -v engines/quiz/assets/katex/katex.min.js
   ```
   *Expected*: `.gitignore:97:!engines/quiz/assets/**`.

3. **Run Test Suites**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_adversarial_wp2.py
   python engines/quiz/test_adversarial_wp3_wp8.py
   cd server && npx tsc --noEmit
   cd server && npx vitest run tests/unit/quiz.test.ts
   ```
   *Expected*: All tests pass with 0 errors.

4. **Verify Offline Math Rendering in Headless Chrome**:
   Compile sample HTML with KaTeX math expressions using headless Chrome flags `--allow-file-access-from-files` and `--virtual-time-budget=8000`, open with PyMuPDF, and verify `page.get_text().count('$') == 0`.
