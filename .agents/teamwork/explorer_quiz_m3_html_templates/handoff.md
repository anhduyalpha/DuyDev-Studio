# Handoff Report: Milestone 3 (WP5 — P0) HTML Templates & Test Assertion Investigation

## 1. Observation

### 1.1 Existing CDN Links in `engines/quiz/quiz_pipeline.py`
In `engines/quiz/quiz_pipeline.py`, KaTeX assets are currently imported from `https://cdn.jsdelivr.net/` inside the `<head>` section of both HTML generator functions:

1. **`generate_worksheet_html`** (Lines 1397–1399):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
```

2. **`generate_answer_key_html`** (Lines 1696–1698):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
```

Repository-wide grep confirmed that lines 1397–1399 and 1696–1698 are the **only** occurrences of `cdn.jsdelivr` in `engines/quiz/`.

### 1.2 Existing KaTeX Scripts & `DOMContentLoaded` Wrapper in `quiz_pipeline.py`
Currently, KaTeX rendering execution is wrapped in a `DOMContentLoaded` event listener at the bottom of the `<body>`:

1. **`generate_worksheet_html`** (Lines 1630–1646):
```html
  <script>
    window.addEventListener('DOMContentLoaded', function() {{
      if (typeof renderMathInElement === 'function') {{
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
      }}
    }});
  </script>
```

2. **`generate_answer_key_html`** (Lines 1891–1907):
```html
  <script>
    window.addEventListener('DOMContentLoaded', function() {{
      if (typeof renderMathInElement === 'function') {{
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
      }}
    }});
  </script>
```

### 1.3 Audit of Parameter `questions_per_page`
Grep search across the entire repository revealed only 2 code declarations:
- `engines/quiz/quiz_pipeline.py:1372`:
  ```python
  def generate_worksheet_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
  ```
- `engines/quiz/quiz_pipeline.py:1652`:
  ```python
  def generate_answer_key_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
  ```

Findings:
- In `generate_worksheet_html`, the identifier `questions_per_page` is never referenced in the body.
- In `generate_answer_key_html`, the identifier `questions_per_page` is never referenced in the body.
- In `quiz_pipeline.py:2088-2089`: called as `generate_worksheet_html(title, subtitle, questions)` and `generate_answer_key_html(title, subtitle, questions)` (3 positional arguments).
- In `engines/quiz/test_quiz_pipeline_v2.py:166, 171, 350, 351, 363, 364`: all 6 calls pass 3 positional arguments `(title, subtitle, questions)`.
- No other file or test anywhere in the workspace passes or references `questions_per_page`.

### 1.4 Test Assertions in `engines/quiz/test_quiz_pipeline_v2.py`
In `engines/quiz/test_quiz_pipeline_v2.py`, method `test_katex_delimiters_and_ignored_classes` is located at lines 358–376:
```python
    def test_katex_delimiters_and_ignored_classes(self):
        """Verify KaTeX delimiters in HTML have proper double backslashes and ignoredClasses."""
        qs = [
            {"number": 1, "type": "mcq", "question": "Câu 1: [A] hoặc (10 CÂU)", "options": {"A": "1"}, "answer": "A", "explanation": "Giải thích"}
        ]
        ws_html = generate_worksheet_html("TEST TITLE", "", qs)
        ans_html = generate_answer_key_html("TEST TITLE", "", qs)

        for html in (ws_html, ans_html):
            # Verify JS string literal delimiters in the generated script block
            self.assertIn(r"{left: '\\(', right: '\\)', display: false}", html)
            self.assertIn(r"{left: '\\[', right: '\\]', display: true}", html)
            # Verify ignoredClasses contains critical classes
            self.assertIn('"section-banner"', html)
            self.assertIn('"katex-ignore"', html)
            self.assertIn('"notranslate"', html)
            # Verify banner has katex-ignore class
            self.assertIn('section-banner notranslate katex-ignore', html)
```

Findings:
- Currently, this test does **not** assert CDN URLs (there are zero `cdn.jsdelivr.net` assertions).
- In `test_html_generation_includes_katex` (line 168): `self.assertIn("katex", ws_html)` passes both before and after this change.
- In `test_katex_delimiters_and_ignored_classes`: we can directly drop in assertions verifying local relative paths (`./katex/katex.min.css`, `./katex/katex.min.js`, `./katex/contrib/auto-render.min.js`) and verifying zero CDN presence (`self.assertNotIn("cdn.jsdelivr.net", html)`), keeping all existing delimiter and ignoredClass assertions 100% intact.

---

## 2. Logic Chain

1. **Root Cause of Race Condition and Offline Failure**:
   - In `<head>`, `<script defer src="https://cdn.jsdelivr.net/...">` depends on external internet connectivity. If the server is offline or LAN-isolated, Chrome headless hangs for 30s + 30s timeout and fails.
   - Chrome's `--print-to-pdf` executes upon the window `load` event.
   - When scripts are marked `defer` and math rendering is scheduled in `window.addEventListener('DOMContentLoaded', ...)`, the math DOM mutation can execute concurrently with or after `--print-to-pdf` starts capturing the layout, causing unrendered `$x^2$` raw delimiters in the PDF text layer.

2. **Resolution Mechanics**:
   - Replacing CDN `<head>` links with a single local `<link rel="stylesheet" href="./katex/katex.min.css">` ensures CSS is loaded synchronously from the per-job directory without network roundtrips.
   - Removing `<script defer>` from `<head>` and placing `<script src="./katex/katex.min.js"></script>` and `<script src="./katex/contrib/auto-render.min.js"></script>` at the bottom of `<body>` ensures the scripts execute synchronously after the DOM content is completely parsed.
   - Executing `renderMathInElement(document.body, {...})` immediately (removing `DOMContentLoaded` and `defer`) guarantees that all LaTeX formulas are rendered into SVG/HTML nodes **synchronously before** the document fires the `load` event.
   - Retaining the exact f-string escaping (`\\\\(` -> `\\(`) ensures KaTeX receives `{left: '\\(', right: '\\)'}` as valid JS string literals.

3. **Dead Parameter Elimination**:
   - Because `questions_per_page` has default value `= 10` and is never read inside `generate_worksheet_html` or `generate_answer_key_html`, and because all call sites in `quiz_pipeline.py` and `test_quiz_pipeline_v2.py` pass exactly 3 positional parameters (`title, subtitle, questions`), removing `questions_per_page` from both function signatures is 100% safe and causes zero regression across the codebase.

4. **Test Assertion Integration**:
   - In `test_katex_delimiters_and_ignored_classes`, adding:
     ```python
     self.assertIn('<link rel="stylesheet" href="./katex/katex.min.css">', html)
     self.assertIn('<script src="./katex/katex.min.js"></script>', html)
     self.assertIn('<script src="./katex/contrib/auto-render.min.js"></script>', html)
     self.assertNotIn("cdn.jsdelivr.net", html)
     ```
     ensures both `generate_worksheet_html` and `generate_answer_key_html` are continuously audited against CDN regressions while validating the exact local KaTeX script and style paths.

---

## 3. Caveats

- **Per-Job Directory Dependency**: The HTML files link to `./katex/katex.min.css` and `./katex/katex.min.js`. For Chrome headless to load these relative assets during PDF compilation, the vendored KaTeX assets must be copied into a `katex/` subdirectory inside `job_html_dir` alongside the HTML file (as handled in WP5 Bước 2 by Explorer 1 / Implementer).
- **Chrome Flags**: Chrome must be invoked with `--allow-file-access-from-files` so that `file:///` URLs are permitted to read relative assets from the local directory.
- No other caveats.

---

## 4. Conclusion & Concrete Code Diffs

The implementer can apply the following drop-in edits with zero ambiguity.

### 4.1 Changes to `engines/quiz/quiz_pipeline.py`

#### A. Function `generate_worksheet_html`
**Target lines**: ~1372, 1397–1399, and 1630–1646.

**Signature Diff**:
```python
<<<< BEFORE (Line 1372)
def generate_worksheet_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
==== AFTER
def generate_worksheet_html(title: str, subtitle: str, questions: list[dict]) -> str:
>>>>
```

**`<head>` Section Diff**:
```html
<<<< BEFORE (Lines 1397–1399)
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
==== AFTER
<link rel="stylesheet" href="./katex/katex.min.css">
>>>>
```

**Bottom of `<body>` Diff**:
```html
<<<< BEFORE (Lines 1630–1646)
  <script>
    window.addEventListener('DOMContentLoaded', function() {{
      if (typeof renderMathInElement === 'function') {{
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
      }}
    }});
  </script>
==== AFTER
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
>>>>
```

---

#### B. Function `generate_answer_key_html`
**Target lines**: ~1652, 1696–1698, and 1891–1907.

**Signature Diff**:
```python
<<<< BEFORE (Line 1652)
def generate_answer_key_html(title: str, subtitle: str, questions: list[dict], questions_per_page: int = 10) -> str:
==== AFTER
def generate_answer_key_html(title: str, subtitle: str, questions: list[dict]) -> str:
>>>>
```

**`<head>` Section Diff**:
```html
<<<< BEFORE (Lines 1696–1698)
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
==== AFTER
<link rel="stylesheet" href="./katex/katex.min.css">
>>>>
```

**Bottom of `<body>` Diff**:
```html
<<<< BEFORE (Lines 1891–1907)
  <script>
    window.addEventListener('DOMContentLoaded', function() {{
      if (typeof renderMathInElement === 'function') {{
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
      }}
    }});
  </script>
==== AFTER
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
>>>>
```

---

### 4.2 Changes to `engines/quiz/test_quiz_pipeline_v2.py`

**Target lines**: 358–376 (`test_katex_delimiters_and_ignored_classes`).

**Diff**:
```python
<<<< BEFORE (Lines 358–376)
    def test_katex_delimiters_and_ignored_classes(self):
        """Verify KaTeX delimiters in HTML have proper double backslashes and ignoredClasses."""
        qs = [
            {"number": 1, "type": "mcq", "question": "Câu 1: [A] hoặc (10 CÂU)", "options": {"A": "1"}, "answer": "A", "explanation": "Giải thích"}
        ]
        ws_html = generate_worksheet_html("TEST TITLE", "", qs)
        ans_html = generate_answer_key_html("TEST TITLE", "", qs)

        for html in (ws_html, ans_html):
            # Verify JS string literal delimiters in the generated script block
            self.assertIn(r"{left: '\\(', right: '\\)', display: false}", html)
            self.assertIn(r"{left: '\\[', right: '\\]', display: true}", html)
            # Verify ignoredClasses contains critical classes
            self.assertIn('"section-banner"', html)
            self.assertIn('"katex-ignore"', html)
            self.assertIn('"notranslate"', html)
            # Verify banner has katex-ignore class
            self.assertIn('section-banner notranslate katex-ignore', html)
==== AFTER
    def test_katex_delimiters_and_ignored_classes(self):
        """Verify KaTeX delimiters in HTML have proper double backslashes, ignoredClasses, and local assets."""
        qs = [
            {"number": 1, "type": "mcq", "question": "Câu 1: [A] hoặc (10 CÂU)", "options": {"A": "1"}, "answer": "A", "explanation": "Giải thích"}
        ]
        ws_html = generate_worksheet_html("TEST TITLE", "", qs)
        ans_html = generate_answer_key_html("TEST TITLE", "", qs)

        for html in (ws_html, ans_html):
            # Verify local KaTeX assets and zero CDN dependencies
            self.assertIn('<link rel="stylesheet" href="./katex/katex.min.css">', html)
            self.assertIn('<script src="./katex/katex.min.js"></script>', html)
            self.assertIn('<script src="./katex/contrib/auto-render.min.js"></script>', html)
            self.assertNotIn("cdn.jsdelivr.net", html)

            # Verify JS string literal delimiters in the generated script block
            self.assertIn(r"{left: '\\(', right: '\\)', display: false}", html)
            self.assertIn(r"{left: '\\[', right: '\\]', display: true}", html)
            # Verify ignoredClasses contains critical classes
            self.assertIn('"section-banner"', html)
            self.assertIn('"katex-ignore"', html)
            self.assertIn('"notranslate"', html)
            # Verify banner has katex-ignore class
            self.assertIn('section-banner notranslate katex-ignore', html)
>>>>
```

---

## 5. Verification Method

To independently verify after code modification:

1. **Verify CDN elimination across `engines/quiz/`**:
   ```bash
   rg "cdn.jsdelivr" engines/quiz/
   ```
   *Expected result*: Exactly **0 matches**.

2. **Verify Python unit tests**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Expected result*: All 35 tests pass (`OK`), 0 failures, 0 errors.

3. **Verify other quiz unit test suites**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_adversarial_wp2.py
   python engines/quiz/test_adversarial_wp3_wp8.py
   ```
   *Expected result*: 100% pass across all test suites.

4. **Verify TypeScript compilation and server vitest (AGENTS.md §4)**:
   ```bash
   cd server && npx tsc --noEmit
   cd server && npx vitest run
   ```
   *Expected result*: 0 TypeScript errors, 100% vitest pass.
