# Handoff Report: Milestone 3 (WP5 — P0: 100% Offline PDF Printing & KaTeX CDN Decoupling)

## 1. Observation

### 1.1 Current Headless Chrome Flags and Timeout in `engines/quiz/quiz_pipeline.py`
In `engines/quiz/quiz_pipeline.py:1934-1999`, the inner worker function `run_chrome_worker` in `compile_pdf` is defined as:
```python
1934:     def run_chrome_worker(headless_flag: str) -> bool:
1935:         cmd = [
1936:             chrome_path,
1937:             headless_flag,
1938:             "--disable-gpu",
1939:             "--no-sandbox",
1940:             "--disable-dev-shm-usage",
1941:             "--disable-crash-reporter",
1942:             "--disable-breakpad",
1943:             "--no-first-run",
1944:             "--no-default-browser-check",
1945:             "--disable-background-networking",
1946:             "--disable-extensions",
1947:             "--disable-default-apps",
1948:             "--disable-sync",
1949:             "--mute-audio",
1950:             f"--user-data-dir={temp_profile}",
1951:             "--no-pdf-header-footer",
1952:             f"--print-to-pdf={abs_pdf}",
1953:             file_url
1954:         ]
```
Polling loop currently waits for up to 30 seconds at line 1966:
```python
1965:         start_time = time.time()
1966:         while time.time() - start_time < 30:
1967:             if os.path.exists(abs_pdf) and os.path.getsize(abs_pdf) > 1000:
...
```

### 1.2 Identification of All CDN References Across `engines/quiz/`
Executing `rg -n "cdn" engines/quiz/` returned exactly 6 matches in `engines/quiz/quiz_pipeline.py`:
- Lines 1397-1399 (inside `generate_worksheet_html`):
  ```html
  1397: <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
  1398: <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  1399: <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
  ```
- Lines 1696-1698 (inside `generate_answer_key_html`):
  ```html
  1696: <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
  1697: <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  1698: <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
  ```
Executing `rg "cdn.jsdelivr" engines/quiz/test_quiz_pipeline_v2.py` returned **0 matches**. The existing test `test_katex_delimiters_and_ignored_classes` (lines 358-376) only asserts KaTeX delimiters (`{left: '\\(', ...}`) and `ignoredClasses` (`"section-banner"`, `"katex-ignore"`, `"notranslate"`). It does NOT assert CDN URLs.

### 1.3 Vendored KaTeX Assets State
The vendored assets already exist in `engines/quiz/assets/katex/`:
- `katex.min.css` (23,335 bytes)
- `katex.min.js` (275,414 bytes)
- `contrib/auto-render.min.js` (3,481 bytes)
- `fonts/`: 20 `.woff2` font files totaling ~264 KB.
`git status --ignored engines/quiz/assets/` confirmed that `engines/quiz/assets/` is an untracked directory and is **not ignored by `.gitignore`**.

### 1.4 HTML Script Timing & Race Condition
In both `generate_worksheet_html` (lines 1630-1647) and `generate_answer_key_html` (lines 1891-1907), math rendering was wrapped in a deferred event listener:
```html
<script>
  window.addEventListener('DOMContentLoaded', function() {
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(document.body, { ... });
    }
  });
</script>
```
Because the external scripts in `<head>` had `defer`, and Chrome `--print-to-pdf` executes upon the main frame load lifecycle, race conditions could occur where the PDF was captured before DOM math replacement or font rasterization completed.

### 1.5 Dead Parameter `questions_per_page`
Executing `rg -n "questions_per_page" engines/quiz/` returned only lines 1372 and 1652:
```python
1372: def generate_worksheet_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
1652: def generate_answer_key_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
```
The parameter is neither passed by callers in `run_pipeline` nor used in the bodies of either function.

### 1.6 Empirical Verification with Headless Chrome Probe
A live probe (`probe_offline.py`) executing Chrome headless at `C:\Program Files\Google\Chrome\Application\chrome.exe` with the 4 target flags and local vendored KaTeX confirmed:
- Compilation time: **2.39 seconds** (well within 15s limit).
- Output: PDF generated (28,229 bytes, 1 page).
- PyMuPDF text layer inspection: **0 raw `$` characters** (`full_text.count('$') == 0`).
- Math expressions `$E = mc^2$` and `$\sqrt{x^2 + y^2}$` were converted into proper KaTeX elements.

---

## 2. Logic Chain

1. **Local Asset Access Requirement**:
   - Chromium blocks cross-file requests from `file://` URLs by default under the Same-Origin Policy.
   - When the rendered HTML file references `./katex/katex.min.css` and `@font-face { src: url(fonts/KaTeX_Main-Regular.woff2) }`, `--allow-file-access-from-files` is required so Chrome can read local stylesheets and font files without SOP/CORS denial.

2. **Rendering Race Condition Elimination**:
   - In `--print-to-pdf`, Chrome triggers printing when the page load event signals completion.
   - Moving `<script src="./katex/katex.min.js"></script>` and `<script src="./katex/contrib/auto-render.min.js"></script>` to the end of `<body>` without `defer` and calling `renderMathInElement(document.body, ...)` synchronously ensures that DOM math mutation runs synchronously *before* the document load finishes.
   - Adding `--virtual-time-budget=8000` pauses real timers and fast-forwards virtual time up to 8000ms until microtasks, stylesheet applications, and web font layout settle.
   - Adding `--run-all-compositor-stages-before-draw` forces Blink/cc to run layout, paint, raster, and composite passes prior to drawing, eliminating blank pages or unrasterized math glyphs.

3. **Deterministic Offline Operation**:
   - In an offline LAN environment without internet access, Chrome's out-of-process NetworkService attempts network initialization, captive portal probes, and CRL checks, causing hangs.
   - Adding `--disable-features=NetworkService` shuts down the network subsystem, ensuring 0 external network egress calls.
   - Because all assets are local and no network requests occur, rendering consistently takes 1-3 seconds.
   - Therefore, the polling timeout can be safely reduced from 30s to 15s (`while time.time() - start_time < 15:`), preventing unnecessary 60s stalls if an error occurs.

4. **Isolated Per-Job HTML Directory**:
   - In `run_pipeline`, creating `job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")` and copying `KATEX_SRC_DIR` to `os.path.join(job_html_dir, "katex")` places the assets directly next to `<prefix>_DeBai.html` and `<prefix>_DapAn.html`.
   - Relative paths `./katex/katex.min.css`, `./katex/katex.min.js`, and `./katex/fonts/*.woff2` resolve correctly.
   - In the `finally` block, removing `job_html_dir` cleans up all temporary HTML and asset files atomically.

---

## 3. Caveats

1. **KaTeX Directory Dependency**: If `engines/quiz/assets/katex` is deleted or missing, `run_pipeline` must throw a clear Vietnamese error (`RuntimeError("Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. Vui lòng cài đặt lại engine.")`) instead of hanging or falling back to CDN.
2. **Path Separators on Windows**: Chrome file URLs on Windows require `file:///{abs_html.replace(os.sep, '/')}` with 3 slashes. This is already implemented in `quiz_pipeline.py:1932` and must be preserved.
3. **Existing Tests in `test_quiz_pipeline_v2.py`**: None of the 35 existing tests assert `cdn.jsdelivr.net`. The test `test_katex_delimiters_and_ignored_classes` continues to pass untouched because it only checks `{left: '\\(', ...}`, `section-banner`, and `katex-ignore`.

---

## 4. Conclusion & Proposed Code Diffs

Milestone 3 (WP5) requires changes exclusively in `engines/quiz/quiz_pipeline.py` and adding a new test class in `engines/quiz/test_quiz_pipeline_v2.py`.

### 4.1 Step-by-Step Diffs for `engines/quiz/quiz_pipeline.py`

#### Diff 1: Module-Level KaTeX Source Constants (after imports, ~line 40)
```python
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
KATEX_SRC_DIR = os.path.join(ENGINE_DIR, "assets", "katex")
```

#### Diff 2: Decouple KaTeX CDN in `generate_worksheet_html` (~line 1397 & line 1630)
In `<head>`:
```diff
- <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
- <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
- <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
+ <link rel="stylesheet" href="./katex/katex.min.css">
```
At the end of `<body>`:
```diff
-   <script>
-     window.addEventListener('DOMContentLoaded', function() {{
-       if (typeof renderMathInElement === 'function') {{
-         renderMathInElement(document.body, {{
-           delimiters: [
-             {{left: '$$', right: '$$', display: true}},
-             {{left: '$', right: '$', display: false}},
-             {{left: '\\\\(', right: '\\\\)', display: false}},
-             {{left: '\\\\[', right: '\\\\]', display: true}}
-           ],
-           ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
-           ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
-           throwOnError: false
-         }});
-       }}
-     }});
-   </script>
+   <script src="./katex/katex.min.js"></script>
+   <script src="./katex/contrib/auto-render.min.js"></script>
+   <script>
+     if (typeof renderMathInElement === 'function') {{
+       renderMathInElement(document.body, {{
+         delimiters: [
+           {{left: '$$', right: '$$', display: true}},
+           {{left: '$', right: '$', display: false}},
+           {{left: '\\\\(', right: '\\\\)', display: false}},
+           {{left: '\\\\[', right: '\\\\]', display: true}}
+         ],
+         ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
+         ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
+         throwOnError: false
+       }});
+     }}
+   </script>
```

#### Diff 3: Decouple KaTeX CDN in `generate_answer_key_html` (~line 1696 & line 1891)
In `<head>`:
```diff
- <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
- <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
- <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
+ <link rel="stylesheet" href="./katex/katex.min.css">
```
At the end of `<body>`:
```diff
-   <script>
-     window.addEventListener('DOMContentLoaded', function() {{
-       if (typeof renderMathInElement === 'function') {{
-         renderMathInElement(document.body, {{
-           delimiters: [
-             {{left: '$$', right: '$$', display: true}},
-             {{left: '$', right: '$', display: false}},
-             {{left: '\\\\(', right: '\\\\)', display: false}},
-             {{left: '\\\\[', right: '\\\\]', display: true}}
-           ],
-           ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
-           ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
-           throwOnError: false
-         }});
-       }}
-     }});
-   </script>
+   <script src="./katex/katex.min.js"></script>
+   <script src="./katex/contrib/auto-render.min.js"></script>
+   <script>
+     if (typeof renderMathInElement === 'function') {{
+       renderMathInElement(document.body, {{
+         delimiters: [
+           {{left: '$$', right: '$$', display: true}},
+           {{left: '$', right: '$', display: false}},
+           {{left: '\\\\(', right: '\\\\)', display: false}},
+           {{left: '\\\\[', right: '\\\\]', display: true}}
+         ],
+         ignoredClasses: ["section-banner", "main-title", "header-box", "q-num", "info-bar", "matrix-table", "notranslate", "katex-ignore"],
+         ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
+         throwOnError: false
+       }});
+     }}
+   </script>
```

#### Diff 4: Add 4 Headless Flags & Reduce Polling Timeout in `run_chrome_worker` (~line 1949-1966)
```diff
             "--disable-sync",
             "--mute-audio",
+            "--allow-file-access-from-files",
+            "--virtual-time-budget=8000",
+            "--run-all-compositor-stages-before-draw",
+            "--disable-features=NetworkService",
             f"--user-data-dir={temp_profile}",
             "--no-pdf-header-footer",
             f"--print-to-pdf={abs_pdf}",
             file_url
         ]
...
         start_time = time.time()
-        while time.time() - start_time < 30:
+        while time.time() - start_time < 15:
```

#### Diff 5: Per-Job HTML Directory & Clean Asset Copying in `run_pipeline` (~line 2050-2056 & line 2141-2155)
```diff
     clean_prefix = sanitize_filename_prefix(filename_prefix)
     os.makedirs(output_dir, exist_ok=True)
+
+    if not os.path.isdir(KATEX_SRC_DIR):
+        raise RuntimeError(
+            "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
+            "Vui lòng cài đặt lại engine."
+        )
+
     temp_dir = tempfile.gettempdir()
     temp_assets_dir = os.path.join(temp_dir, f"quiz_assets_{uuid.uuid4().hex[:8]}")
     os.makedirs(temp_assets_dir, exist_ok=True)
 
-    ws_html_path = os.path.join(temp_dir, f"{clean_prefix}_DeBai.html")
-    ans_html_path = os.path.join(temp_dir, f"{clean_prefix}_DapAn.html")
+    job_html_dir = os.path.join(temp_dir, f"quiz_html_{uuid.uuid4().hex[:8]}")
+    os.makedirs(job_html_dir, exist_ok=True)
+    shutil.copytree(KATEX_SRC_DIR, os.path.join(job_html_dir, "katex"), dirs_exist_ok=True)
+
+    ws_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DeBai.html")
+    ans_html_path = os.path.join(job_html_dir, f"{clean_prefix}_DapAn.html")
```
And in `finally`:
```diff
     finally:
-        # Atomic cleanup of temporary HTML files and temporary visual assets
-        for temp_f in [ws_html_path, ans_html_path]:
-            try:
-                if os.path.exists(temp_f):
-                    os.remove(temp_f)
-            except Exception:
-                pass
+        # Atomic cleanup of temporary per-job HTML directory and visual assets
+        try:
+            if os.path.exists(job_html_dir):
+                shutil.rmtree(job_html_dir, ignore_errors=True)
+        except Exception:
+            pass
 
         try:
             if os.path.exists(temp_assets_dir):
                 shutil.rmtree(temp_assets_dir, ignore_errors=True)
         except Exception:
             pass
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Zero CDN Audit**:
   ```bash
   rg "cdn.jsdelivr" engines/quiz/
   ```
   *Expected*: **0 matches** (exit code 1).

2. **Verify Vendored KaTeX Assets**:
   ```bash
   python -c "import os; p='engines/quiz/assets/katex'; assert os.path.exists(f'{p}/katex.min.css') and os.path.exists(f'{p}/katex.min.js') and os.path.exists(f'{p}/contrib/auto-render.min.js') and len(os.listdir(f'{p}/fonts')) >= 20; print('KaTeX assets verified: OK')"
   ```

3. **Run All Existing Python Test Suites**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_adversarial_wp2.py
   python engines/quiz/test_adversarial_wp3_wp8.py
   ```
   *Expected*: 100% pass across all 88+ test cases.

4. **Automated Offline Smoke Test**:
   ```bash
   python -c "
   import os, sys, tempfile, shutil, pymupdf
   sys.path.insert(0, 'engines/quiz')
   from quiz_pipeline import generate_worksheet_html, compile_pdf, find_chrome_path, KATEX_SRC_DIR

   t_dir = tempfile.mkdtemp(prefix='smoke_test_')
   try:
       shutil.copytree(KATEX_SRC_DIR, os.path.join(t_dir, 'katex'))
       qs = [{'number': 1, 'type': 'mcq', 'question': 'Công thức $E = mc^2$ và $\\\\sqrt{x^2+y^2}$', 'options': {'A': 'Đúng', 'B': 'Sai'}, 'answer': 'A'}]
       h_path = os.path.join(t_dir, 'smoke.html')
       p_path = os.path.join(t_dir, 'smoke.pdf')
       with open(h_path, 'w', encoding='utf-8') as f:
           f.write(generate_worksheet_html('TEST', '', qs))
       compile_pdf(find_chrome_path(), h_path, p_path)
       assert os.path.exists(p_path) and os.path.getsize(p_path) > 1000
       doc = pymupdf.open(p_path)
       text = ''.join(p.get_text() for p in doc)
       assert text.count('$') == 0, f'Found raw dollars: {text.count(\"$\")}'
       print('Smoke test OFFLINE: PASSED (0 raw $ tokens)')
   finally:
       shutil.rmtree(t_dir, ignore_errors=True)
   "
   ```

5. **Pass/Fail Criteria**:
   - `rg "cdn.jsdelivr" engines/quiz/` must return 0 results.
   - Compiled PDF text layer must contain 0 raw `$` symbols.
   - Compilation of a worksheet and answer key takes < 4 seconds total without network connectivity.
   - Per-job directory `quiz_html_*` is deleted from temp after completion.
