import os
import sys
import tempfile
import shutil
import subprocess
import pymupdf

sys.path.insert(0, os.path.abspath("engines/quiz"))
from quiz_pipeline import find_chrome_path

def test_offline_render():
    chrome = find_chrome_path()
    assert chrome and os.path.exists(chrome), f"Chrome not found: {chrome}"

    td = tempfile.mkdtemp(prefix="test_katex_")
    try:
        src = os.path.abspath("engines/quiz/assets/katex")
        dst = os.path.join(td, "katex")
        shutil.copytree(src, dst)

        html_content = """<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="./katex/katex.min.css">
</head>
<body>
  <h1>Test Toán Offline</h1>
  <p>Phương trình: $x^2 + y^2 = z^2$ và display: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$</p>
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
        html_path = os.path.join(td, "test.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        pdf_path = os.path.join(td, "test.pdf")
        file_url = f"file:///{html_path.replace(os.sep, '/')}"

        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--allow-file-access-from-files",
            "--virtual-time-budget=8000",
            "--run-all-compositor-stages-before-draw",
            "--disable-features=NetworkService",
            f"--print-to-pdf={pdf_path}",
            file_url
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        assert res.returncode == 0, f"Chrome exited with {res.returncode}"
        assert os.path.exists(pdf_path), "PDF not created"

        doc = pymupdf.open(pdf_path)
        text = "".join(p.get_text() for p in doc)
        dollar_count = text.count("$")
        print(f"SUCCESS: PDF size = {os.path.getsize(pdf_path)} bytes")
        print(f"SUCCESS: Page text contains '{text.strip()}'")
        print(f"SUCCESS: Dollar count = {dollar_count} (expect 0)")
        assert dollar_count == 0, f"Expected 0 dollar signs, found {dollar_count}"
        print("ALL VERIFICATIONS PASSED!")
    finally:
        shutil.rmtree(td, ignore_errors=True)

if __name__ == "__main__":
    test_offline_render()
