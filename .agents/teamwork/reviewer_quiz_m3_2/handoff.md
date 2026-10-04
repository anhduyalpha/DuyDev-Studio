# Handoff Report — Reviewer 2: Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling)

## Review Summary
**Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Integrity Audit
- **Source Inspection**: Inspected `engines/quiz/quiz_pipeline.py`, `engines/quiz/assets/katex/`, and `engines/quiz/test_quiz_pipeline_v2.py`.
- **Integrity Findings**:
  - No hardcoded test results, fake outputs, or facade implementations were detected.
  - No shortcuts bypassing offline rendering (e.g. mock print or delegating to external online APIs) were found.
  - KaTeX vendor bundle consists of authentic production minified bundles:
    - `katex.min.css`: 23,335 bytes.
    - `katex.min.js`: 275,414 bytes.
    - `contrib/auto-render.min.js`: 3,481 bytes.
    - `fonts/`: Exactly 20 `.woff2` font files (259,792 bytes total). All 20 font files referenced by `url(fonts/KaTeX_*.woff2)` in `katex.min.css` match the files on disk.
  - `.gitignore` explicitly whitelists the assets directory at line 97:
    `!engines/quiz/assets/**`
    Confirmed via `git check-ignore -v engines/quiz/assets/katex/katex.min.js`:
    ```
    .gitignore:97:!engines/quiz/assets/**	engines/quiz/assets/katex/katex.min.js
    ```
  - `engines/quiz/quiz_pipeline.py` contains zero hardcoded API keys (`sk-[A-Za-z0-9]{20,}` returned 0 matches).
  - Verdict: **0 integrity violations detected**.

### 1.2 Race Condition Elimination & Script Positioning
- In `engines/quiz/quiz_pipeline.py`:
  - `generate_worksheet_html` (lines 1400, 1631-1646) and `generate_answer_key_html` (lines 1695, 1888-1903):
    - In `<head>`: CDN `<script>` tags were deleted. Replaced with single local CSS stylesheet: `<link rel="stylesheet" href="./katex/katex.min.css">`.
    - At the bottom of `<body>` (immediately preceding `</body>`):
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
    - The `defer` attribute was removed.
    - The `window.addEventListener('DOMContentLoaded', ...)` event listener wrapper was removed.
    - Delimiters and ignored classes:
      - `$$ ... $$` (`display: true`), `$ ... $` (`display: false`), `\( ... \)` (`display: false`), `\[ ... \]` (`display: true`).
      - `ignoredClasses`: `["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"]`.
      - `ignoredTags`: `["script", "noscript", "style", "textarea", "pre", "code"]`.
      - `throwOnError: false`.
  - In `compile_pdf` (lines 1945-1948):
    - Headless Chrome flags added:
      - `--allow-file-access-from-files`
      - `--virtual-time-budget=8000`
      - `--run-all-compositor-stages-before-draw`
      - `--disable-features=NetworkService`
    - Polling loop timeout reduced from 30s to 15s (`while time.time() - start_time < 15:`).

### 1.3 Per-Job Directory Isolation & Cleanup
- In `run_pipeline` (lines 2047-2064, 2150-2157):
  - Fail-fast check on missing KaTeX assets:
    ```python
    if not os.path.isdir(KATEX_SRC_DIR):
        raise RuntimeError(
            "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
            "Vui lòng cài đặt lại engine."
        )
    ```
  - Per-job directory generation:
    ```python
    job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")
    os.makedirs(job_html_dir, exist_ok=True)
    shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)

    ws_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DeBai.html")
    ans_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DapAn.html")
    ```
  - Cleaned up in `finally`:
    ```python
    try:
        if os.path.exists(job_html_dir):
            shutil.rmtree(job_html_dir, ignore_errors=True)
    except Exception:
        pass
    ```
  - In `compile_pdf` (lines 1924-1925):
    Chrome user data profile is also isolated per process call:
    `temp_profile = os.path.join(tempfile.gettempdir(), f"chrome_pdf_{os.getpid()}_{uuid.uuid4().hex[:8]}")`

### 1.4 Verification Command Results
1. `rg "cdn.jsdelivr" engines/quiz/`:
   - Command: `rg "cdn.jsdelivr" engines/quiz/`
   - Exit code: `1` (0 matches found across the entire engine directory).
2. `python engines/quiz/test_quiz_pipeline_v2.py`:
   - Result: `Ran 38 tests in 1.571s — OK` (38/38 passing, 0 failures, 0 skips).
3. `python engines/quiz/test_mcq_parser.py`:
   - Result: `Ran 19 tests in 0.005s — OK` (19/19 passing).
4. `python engines/quiz/test_adversarial_wp2.py` & `test_adversarial_wp3_wp8.py`:
   - Result: `Ran 20 tests in 0.019s — OK` and `Ran 14 tests in 0.539s — OK` (34/34 passing).
5. `cd server && npx tsc --noEmit`:
   - Exit code: `0` (0 TypeScript compilation errors).
6. `cd server && npx vitest run tests/unit/quiz.test.ts`:
   - Result: `13 passed (13)` in 3.85s.

### 1.5 Adversarial Stress Tests
Executed live stress-testing suite directly validating:
1. **Math/Chem Rendering Integrity**:
   - Compiled PDF with inline `$f(x) = \frac{x^2 - 4}{x - 2}$`, display `$$\lim_{x \to 2} f(x) = 4$$`, `\(x > 0\)`, `\[x \le 10\]`, integrals `$$\int_0^1 (3x^2 + 2x) dx$$`, and chemical notations (`C<sub>2</sub>H<sub>5</sub>OH`, `CH≡CH`).
   - PyMuPDF text layer inspection:
     - Raw unrendered `$` count: **0** in both Worksheet and Answer Key PDFs.
     - Chemical text and math symbols extracted accurately.
     - Compilation completed in < 10 seconds.
2. **Multi-Job Concurrency Isolation**:
   - Ran 4 concurrent jobs simultaneously in parallel threads (`ThreadPoolExecutor(max_workers=4)`).
   - All 4 jobs completed concurrently with zero file collisions, zero unrendered `$` signs, and clean removal of their respective directories.
3. **Syntax Fault-Tolerance**:
   - Injected deliberately malformed LaTeX (`$\frac{1}{`).
   - Compilation proceeded without process hang or unhandled exception due to `throwOnError: false`.

---

## 2. Logic Chain

1. **Decoupling from CDN (`cdn.jsdelivr.net`)**:
   - Observation 1.1 & 1.4: Replacing all remote CDN URLs with relative local paths (`./katex/...`) and vendoring all CSS, JS, and 20 `.woff2` font files resolves the network dependency entirely.
   - Observation 1.4: `rg "cdn.jsdelivr" engines/quiz/` returned 0 matches, confirming that no network calls to jsdelivr can occur.

2. **Race Condition Eradication**:
   - In Chrome Headless, `--print-to-pdf` snapshots the document layout upon firing of the `load` lifecycle event.
   - Previously, scripts in `<head defer>` loaded asynchronously across network connections, executing inside `DOMContentLoaded`. Under latency or resource contention, `--print-to-pdf` could fire before KaTeX transformed the DOM or downloaded web fonts.
   - Observation 1.2: Moving `<script src="./katex/katex.min.js">` and `<script src="./katex/contrib/auto-render.min.js">` to the bottom of `<body>` and removing `defer` forces synchronous script execution. Because script tags without `defer`/`async` block parsing, the browser executes `renderMathInElement(document.body, ...)` synchronously against the already-parsed question elements before completing body parsing and before emitting the `load` event.
   - Chromium compositor flags (`--virtual-time-budget=8000` and `--run-all-compositor-stages-before-draw`) guarantee that font rasterization, style calculation, and compositor layout passes finish before the PDF snapshot is written.
   - Observation 1.5 empirically proves this: 0 raw unrendered `$` characters appeared in the extracted PDF text layer.

3. **Concurrency and Storage Isolation**:
   - Observation 1.3: Creating a dedicated directory per job using `quiz_html_{uuid[:8]}` ensures that each job owns its private copy of `./katex/` and its own HTML documents.
   - Observation 1.5: 4 concurrent threads executed without collision, cross-talk, or resource locking.
   - The `finally` block reliably removes the temporary job directory, guaranteeing zero temporary storage leakage.

4. **Preservation of Delimiters and Ignored Classes**:
   - Observation 1.2: The delimiter configurations (`$$`, `$`, `\(`, `\[`) and ignored classes (`section-banner`, `main-title`, `header-box`, `q-num`, `info-bar`, `matrix-table`, `notranslate`, `katex-ignore`) were preserved verbatim.
   - All 38 tests in `test_quiz_pipeline_v2.py` pass.

---

## 3. Caveats

- **Chromium / Google Chrome Host Dependency**: Chrome Headless execution requires Google Chrome or Chromium to be present at a standard location. `find_chrome_path()` correctly locates Chrome on Windows (`C:\Program Files\Google\Chrome\Application\chrome.exe`) and Linux.
- **Font Format Optimization**: Only `.woff2` font format is vendored (~260 KB). Legacy formats (`.ttf`, `.eot`) are omitted as Chromium natively supports `.woff2`.
- No other caveats.

---

## 4. Conclusion

Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling) satisfies all functional requirements, security constraints, and quality standards:
- **Offline Decoupling**: Complete (0 CDN matches).
- **Race Condition Elimination**: Fully verified (synchronous execution, zero unrendered math in PDF text layer).
- **Concurrent Isolation**: Fully verified (UUID-isolated job directories, clean `finally` purge).
- **Test Suites**: 100% pass across all Python engine tests (91/91 total), TypeScript (`tsc` 0 errors), and Vitest (13/13).
- **Integrity**: Zero violations.

**Verdict**: **APPROVE**

---

## 5. Verification Method

To independently reproduce the verification:

1. **Verify 0 CDN Usages**:
   ```powershell
   rg "cdn.jsdelivr" engines/quiz/
   ```
   *Expected*: Exit code 1 (0 matches).

2. **Verify Git Ignore Whitelisting**:
   ```powershell
   git check-ignore -v engines/quiz/assets/katex/katex.min.js
   ```
   *Expected*: `.gitignore:97:!engines/quiz/assets/**`.

3. **Run All Engine Test Suites**:
   ```powershell
   python engines/quiz/test_quiz_pipeline_v2.py
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_adversarial_wp2.py
   python engines/quiz/test_adversarial_wp3_wp8.py
   ```
   *Expected*: 100% pass across all test files.

4. **Run Server TypeScript & Unit Tests**:
   ```powershell
   cd server
   npx tsc --noEmit
   npx vitest run tests/unit/quiz.test.ts
   ```
   *Expected*: `tsc` 0 errors, Vitest 13 passed.

5. **Verify Math Rendering in PDF Text Layer**:
   ```powershell
   python -c "
   import os, sys, tempfile, shutil, pymupdf
   sys.path.insert(0, 'engines/quiz')
   from quiz_pipeline import generate_worksheet_html, compile_pdf, find_chrome_path, KATEX_SRC_DIR
   t_dir = tempfile.mkdtemp()
   try:
       shutil.copytree(KATEX_SRC_DIR, os.path.join(t_dir, 'katex'))
       qs = [{'number': 1, 'type': 'mcq', 'question': 'Công thức: $S = \\frac{1}{2}ab\\sin C$ và $E = mc^2$', 'options': {'A': '1'}, 'answer': 'A'}]
       h = os.path.join(t_dir, 'test.html'); p = os.path.join(t_dir, 'test.pdf')
       with open(h, 'w', encoding='utf-8') as f: f.write(generate_worksheet_html('Title', '', qs))
       compile_pdf(find_chrome_path(), h, p)
       doc = pymupdf.open(p)
       assert ''.join(pg.get_text() for pg in doc).count('$') == 0
       print('VERIFIED: 0 unrendered $ in PDF text layer')
   finally:
       shutil.rmtree(t_dir, ignore_errors=True)
   "
   ```
   *Expected*: `VERIFIED: 0 unrendered $ in PDF text layer`.
