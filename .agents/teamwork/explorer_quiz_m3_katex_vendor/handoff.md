# Handoff Report — Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling)

## 1. Observation

### 1.1 Vendored KaTeX Assets State
- **Target directory**: `engines/quiz/assets/katex/`
- Direct observation via `list_dir` and python inspection:
  - `engines/quiz/assets/katex/katex.min.css`: 23,335 bytes. First line contains `.katex .katex-version:after{content:"0.16.11"}` and relative font URLs `url(fonts/KaTeX_AMS-Regular.woff2) format("woff2")`.
  - `engines/quiz/assets/katex/katex.min.js`: 275,414 bytes. Full UMD bundle.
  - `engines/quiz/assets/katex/contrib/auto-render.min.js`: 3,481 bytes. Contains `renderMathInElement` auto-renderer.
  - `engines/quiz/assets/katex/fonts/`: Exactly 20 `.woff2` font files (total size 246.6 KB). Verified 0 `.ttf` files and 0 `.woff` files.
  - Total bundle size across all files: **548.8 KB**.
- `git status engines/quiz/assets/` output:
  ```
  Untracked files:
    (use "git add <file>..." to include in what will be committed)
          engines/quiz/assets/
  ```

### 1.2 Git Ignore Status
- Inspected `.gitignore` (95 lines total).
- Ran `git check-ignore engines/quiz/assets/katex/katex.min.js engines/quiz/assets/katex/katex.min.css engines/quiz/assets/katex/contrib/auto-render.min.js engines/quiz/assets/katex/fonts/KaTeX_Main-Regular.woff2`:
  - Result: Exit code 1 (none of the files are ignored).
  - No rules matching `assets`, `fonts`, or `*.woff2` currently exist in `.gitignore`.

### 1.3 CDN Usages in `engines/quiz/`
- Direct search via `rg -n "cdn.jsdelivr" engines/quiz/` returned exactly 6 lines across the entire codebase, all in `engines/quiz/quiz_pipeline.py`:
  - Line 1397: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">`
  - Line 1398: `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>`
  - Line 1399: `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>`
  - Line 1696: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">`
  - Line 1697: `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>`
  - Line 1698: `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>`
- No other file in `engines/quiz/` references `cdn.jsdelivr.net`.

### 1.4 Script Lifecycle & Race Condition in HTML Templates
- Lines 1630-1646 (`generate_worksheet_html`) and 1891-1907 (`generate_answer_key_html`):
  ```html
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, { ... });
      }
    });
  </script>
  ```
  Coupled with `<script defer ...>` in `<head>`, this creates a race condition with Chrome `--print-to-pdf` which captures the page at `load` event.

### 1.5 Chrome Headless Flags & Timeout in `compile_pdf`
- Lines 1935-1954 in `quiz_pipeline.py`:
  Current Chrome command lacks offline file access flags (`--allow-file-access-from-files`), compositor synchronization flags (`--virtual-time-budget=8000`, `--run-all-compositor-stages-before-draw`), and network isolation flag (`--disable-features=NetworkService`).
- Line 1966 in `quiz_pipeline.py`:
  `while time.time() - start_time < 30:` (polling timeout set to 30s).

### 1.6 Job Directory & Asset Lifecycle in `run_pipeline`
- Lines 2050-2055 in `quiz_pipeline.py`:
  ```python
  temp_dir = tempfile.gettempdir()
  temp_assets_dir = os.path.join(temp_dir, f"quiz_assets_{uuid.uuid4().hex[:8]}")
  os.makedirs(temp_assets_dir, exist_ok=True)

  ws_html_path = os.path.join(temp_dir, f"{clean_prefix}_DeBai.html")
  ans_html_path = os.path.join(temp_dir, f"{clean_prefix}_DapAn.html")
  ```
  HTML files are written directly into `temp_dir` with no per-job isolation directory and without copying the KaTeX bundle alongside them.
- Lines 2141-2155 in `quiz_pipeline.py`:
  `finally` block cleans up individual HTML files and `temp_assets_dir`, but does not manage a dedicated `job_html_dir`.

### 1.7 Existing Test Invariants
- `test_katex_delimiters_and_ignored_classes` in `engines/quiz/test_quiz_pipeline_v2.py` (lines 358-376):
  Asserts `{left: '\\(', right: '\\)', display: false}`, `{left: '\\[', right: '\\]', display: true}`, and classes `"section-banner"`, `"katex-ignore"`, `"notranslate"`. It **does not** assert any CDN URL.
- Baseline test execution:
  - `python engines/quiz/test_mcq_parser.py`: 19/19 tests PASS.
  - `python engines/quiz/test_quiz_pipeline_v2.py`: 35/35 tests PASS.

### 1.8 Offline Chrome Headless Verification Test
- Created and executed `.agents/teamwork/explorer_quiz_m3_katex_vendor/test_offline_math_render.py` using:
  - Local `./katex/` assets.
  - Synchronous bottom-of-body `renderMathInElement`.
  - Flags: `--allow-file-access-from-files`, `--virtual-time-budget=8000`, `--run-all-compositor-stages-before-draw`, `--disable-features=NetworkService`.
- Result:
  - Successfully compiled PDF (72,507 bytes).
  - Page text extracted with PyMuPDF: math formula glyphs rendered correctly.
  - Raw `$` count in text layer: **0** (100% rendered math, 0 unparsed LaTeX tokens).

---

## 2. Logic Chain

1. **KaTeX Assets are Ready for Git Tracking**:
   From Observation 1.1, the full vendor bundle of KaTeX v0.16.11 is already located at `engines/quiz/assets/katex/`, including CSS, JS, auto-render, and all 20 `.woff2` font files.
   No `npm pack` step is necessary during runtime or build since the assets are already in place and ready to be tracked in git.

2. **Defensive Git Whitelisting**:
   From Observation 1.2, although `git check-ignore` currently confirms the files are not excluded, adding `!engines/quiz/assets/**` to `.gitignore` guarantees that future blanket patterns (e.g., `assets/` or `fonts/` or `*.woff2`) cannot accidentally exclude these essential assets.

3. **Elimination of CDN Dependencies**:
   From Observation 1.3, replacing the 6 CDN lines in `generate_worksheet_html` and `generate_answer_key_html` with relative references `./katex/...` completely eliminates all external network calls across `engines/quiz/`, fulfilling the 0 CDN requirement (`rg "cdn.jsdelivr" engines/quiz/` will return 0).

4. **Zero-Race Synchronous Math Rendering**:
   From Observation 1.4 & 1.8, removing `defer` and `DOMContentLoaded`, and positioning the KaTeX scripts and `renderMathInElement` execution at the very end of `<body>`, ensures the DOM is fully constructed before KaTeX executes, and KaTeX completes synchronously before the window `load` event fires. Combined with Chrome's `--virtual-time-budget=8000` and `--run-all-compositor-stages-before-draw`, this completely prevents the race condition where Chrome prints before math finishes rendering.

5. **Per-Job Directory Lifecycle & Cleanliness**:
   From Observation 1.5 & 1.6, defining `KATEX_SRC_DIR` at module level, checking its existence before execution, copying it into `job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")` via `shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)`, and deleting `job_html_dir` in `finally` guarantees that:
   - Multiple concurrent jobs never collide.
   - HTML files have local access to `./katex/`.
   - All ephemeral files and copied assets are completely removed when the job concludes or fails.

6. **Chrome Headless Tuning**:
   From Observation 1.5, reducing the polling loop timeout from 30s to 15s prevents excessive delays since no network requests are made.

7. **Zero Regression on Existing Tests**:
   From Observation 1.7, because `test_katex_delimiters_and_ignored_classes` does not assert CDN URLs, all 35 tests in `test_quiz_pipeline_v2.py` will remain 100% green without requiring test modifications.

---

## 3. Caveats

- **Chrome Installation Dependency**: Chrome headless PDF compilation requires a valid Chrome/Chromium binary found by `find_chrome_path()`. On the current environment, `C:\Program Files\Google\Chrome\Application\chrome.exe` was verified.
- **Font Format Support**: Only `.woff2` font files are vendored (to optimize repository size to ~549 KB). Modern Google Chrome / Chromium headless natively supports `.woff2`; older browsers that only support `.ttf` or `.eot` are out of scope as this pipeline targets Chromium headless printing only.

---

## 4. Conclusion & Concrete Implementation Diffs

### 4.1 Changes to `.gitignore`
Add explicit whitelisting rule at repo root:
```gitignore
# Quiz Engine Assets
!engines/quiz/assets/**
```

### 4.2 Changes to `engines/quiz/quiz_pipeline.py`

#### Change A: Module-level Constants (Lines 42-45)
```python
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")

_EMIT_LOCK = threading.Lock()

ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
KATEX_SRC_DIR = os.path.join(ENGINE_DIR, "assets", "katex")
```

#### Change B: `generate_worksheet_html` & `generate_answer_key_html` (Headers & Footers)
1. In `generate_worksheet_html`:
   - Signature: `def generate_worksheet_html(title: str, subtitle: str, questions: list[dict]) -> str:` (remove dead `questions_per_page: int = 10` parameter).
   - In `<head>`:
     ```html
     <link rel="stylesheet" href="./katex/katex.min.css">
     ```
     (Remove `<script defer src="https://cdn.jsdelivr.net/..."></script>` lines).
   - At end of `<body>`:
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
     </body>
     ```

2. In `generate_answer_key_html`:
   - Signature: `def generate_answer_key_html(title: str, subtitle: str, questions: list[dict]) -> str:` (remove dead `questions_per_page: int = 10` parameter).
   - Same `<head>` and end of `<body>` replacements as `generate_worksheet_html`.

#### Change C: `compile_pdf` Chrome Flags & Timeout
In `run_chrome_worker`:
```python
        cmd = [
            chrome_path,
            headless_flag,
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-crash-reporter",
            "--disable-breakpad",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-sync",
            "--mute-audio",
            "--allow-file-access-from-files",
            "--virtual-time-budget=8000",
            "--run-all-compositor-stages-before-draw",
            "--disable-features=NetworkService",
            f"--user-data-dir={temp_profile}",
            "--no-pdf-header-footer",
            f"--print-to-pdf={abs_pdf}",
            file_url
        ]
```
In polling loop:
```python
        start_time = time.time()
        while time.time() - start_time < 15:
```

#### Change D: `run_pipeline` Setup & Lifecycle
At the start of `run_pipeline`:
```python
    if not os.path.isdir(KATEX_SRC_DIR):
        raise RuntimeError(
            "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
            "Vui lòng cài đặt lại engine."
        )

    clean_prefix = sanitize_filename_prefix(filename_prefix)
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = tempfile.gettempdir()
    temp_assets_dir = os.path.join(temp_dir, f"quiz_assets_{uuid.uuid4().hex[:8]}")
    os.makedirs(temp_assets_dir, exist_ok=True)

    job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")
    os.makedirs(job_html_dir, exist_ok=True)
    shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)

    ws_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DeBai.html")
    ans_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DapAn.html")
```
In the `finally` block:
```python
    finally:
        # Atomic cleanup of temporary HTML directory and temporary visual assets
        try:
            if os.path.exists(job_html_dir):
                shutil.rmtree(job_html_dir, ignore_errors=True)
        except Exception:
            pass

        try:
            if os.path.exists(temp_assets_dir):
                shutil.rmtree(temp_assets_dir, ignore_errors=True)
        except Exception:
            pass
```

### 4.3 New Unit Tests to Append to `engines/quiz/test_quiz_pipeline_v2.py`
Append before `if __name__ == "__main__":`:
```python
    def test_offline_katex_local_assets_in_html(self):
        """WP5: Verify worksheet and answer key HTML use local KaTeX paths and no CDN."""
        from quiz_pipeline import generate_worksheet_html, generate_answer_key_html
        qs = [
            {"number": 1, "type": "mcq", "question": "Câu 1: Cho $x + y = z$", "options": {"A": "1"}, "answer": "A", "explanation": "Giải thích"}
        ]
        ws_html = generate_worksheet_html("TEST TITLE", "", qs)
        ans_html = generate_answer_key_html("TEST TITLE", "", qs)

        for html in (ws_html, ans_html):
            self.assertNotIn("cdn.jsdelivr.net", html)
            self.assertIn('<link rel="stylesheet" href="./katex/katex.min.css">', html)
            self.assertIn('<script src="./katex/katex.min.js"></script>', html)
            self.assertIn('<script src="./katex/contrib/auto-render.min.js"></script>', html)
            self.assertIn('renderMathInElement(document.body,', html)
            self.assertNotIn("window.addEventListener('DOMContentLoaded'", html)

    def test_katex_src_dir_exists_and_woff2_only(self):
        """WP5: Verify KATEX_SRC_DIR exists with required assets and only woff2 fonts."""
        from quiz_pipeline import KATEX_SRC_DIR
        self.assertTrue(os.path.isdir(KATEX_SRC_DIR), f"KATEX_SRC_DIR does not exist: {KATEX_SRC_DIR}")
        self.assertTrue(os.path.isfile(os.path.join(KATEX_SRC_DIR, "katex.min.css")))
        self.assertTrue(os.path.isfile(os.path.join(KATEX_SRC_DIR, "katex.min.js")))
        self.assertTrue(os.path.isfile(os.path.join(KATEX_SRC_DIR, "contrib", "auto-render.min.js")))

        fonts_dir = os.path.join(KATEX_SRC_DIR, "fonts")
        self.assertTrue(os.path.isdir(fonts_dir))
        fonts = os.listdir(fonts_dir)
        self.assertGreater(len(fonts), 0)
        self.assertTrue(all(f.endswith(".woff2") for f in fonts), f"Non-woff2 fonts detected: {fonts}")

    def test_run_pipeline_fails_fast_when_katex_missing(self):
        """WP5: Verify run_pipeline fails fast with clear message when KATEX_SRC_DIR is missing."""
        import quiz_pipeline
        original_katex_dir = quiz_pipeline.KATEX_SRC_DIR
        try:
            quiz_pipeline.KATEX_SRC_DIR = os.path.join(tempfile.gettempdir(), "non_existent_katex_dir_12345")
            with self.assertRaises(RuntimeError) as ctx:
                quiz_pipeline.run_pipeline("dummy.pdf", "1", filename_prefix="test_prefix")
            self.assertIn("Thiếu thư viện KaTeX cục bộ", str(ctx.exception))
        finally:
            quiz_pipeline.KATEX_SRC_DIR = original_katex_dir
```

---

## 5. Verification Method

To independently verify the completion of WP5:

1. **Verify 0 CDN Usages**:
   ```bash
   rg "cdn.jsdelivr" engines/quiz/
   ```
   **Expected**: 0 results.

2. **Verify Vendored Assets Tracked**:
   ```bash
   git status engines/quiz/assets/
   ```
   **Expected**: Listed as untracked files or staged files, not ignored.

3. **Verify Git Ignore Negation Rule**:
   ```bash
   git check-ignore -v engines/quiz/assets/katex/katex.min.js
   ```
   **Expected**: Exit code 1 (or matched negation rule `!engines/quiz/assets/**`).

4. **Verify Unit Test Suite**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   python engines/quiz/test_mcq_parser.py
   ```
   **Expected**: All tests pass (38/38 on `test_quiz_pipeline_v2.py`, 19/19 on `test_mcq_parser.py`), 0 failures, 0 errors.

5. **Verify Offline PDF Math Compilation**:
   Run offline rendering test:
   ```bash
   python .agents/teamwork/explorer_quiz_m3_katex_vendor/test_offline_math_render.py
   ```
   **Expected**: Exits with 0, PDF created with 0 raw `$` tokens.
