import os
import sys
import shutil
import tempfile
import subprocess
import time
import pymupdf

temp_dir = tempfile.mkdtemp(prefix="test_katex_probe_")
try:
    katex_src = os.path.abspath(r"engines\quiz\assets\katex")
    katex_dst = os.path.join(temp_dir, "katex")
    shutil.copytree(katex_src, katex_dst)

    html_content = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="./katex/katex.min.css">
</head>
<body>
<p>Test Math: $E = mc^2$ and $\\sqrt{x^2 + y^2}$</p>
<script src="./katex/katex.min.js"></script>
<script src="./katex/contrib/auto-render.min.js"></script>
<script>
renderMathInElement(document.body, {
  delimiters: [
    {left: '$$', right: '$$', display: true},
    {left: '$', right: '$', display: false}
  ],
  throwOnError: false
});
</script>
</body>
</html>"""

    html_path = os.path.join(temp_dir, "test.html")
    pdf_path = os.path.join(temp_dir, "test.pdf")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    file_url = f"file:///{html_path.replace(os.sep, '/')}"
    profile = os.path.join(temp_dir, "profile")
    os.makedirs(profile, exist_ok=True)

    cmd = [
        chrome,
        "--headless=new",
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
        f"--user-data-dir={profile}",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        file_url
    ]

    t0 = time.time()
    res = subprocess.run(cmd, capture_output=True, timeout=15)
    elapsed = time.time() - t0

    doc = pymupdf.open(pdf_path)
    full_text = "".join(p.get_text() for p in doc)
    dollars = full_text.count("$")
    print(f"STATUS: SUCCESS")
    print(f"Elapsed: {elapsed:.2f}s")
    print(f"PDF pages: {len(doc)}")
    print(f"PDF size: {os.path.getsize(pdf_path)} bytes")
    print(f"Dollars in text layer: {dollars}")
    print(f"Extracted text: {repr(full_text.strip())}")
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)
