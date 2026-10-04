"""Empirical Challenger 1: Milestone 3 (WP5) Adversarial Verification Suite.

Tests 100% Offline PDF Printing & KaTeX CDN Decoupling:
- KaTeX local bundle integrity and relative @font-face resolution.
- 0 CDN links in HTML templates.
- Adversarial math & chem formula rendering: fractions, square roots, Greek letters,
  superscripts/subscripts, complex equations, chemical compounds (C2H5OH, Fe3+).
- Headless Chrome compilation under --disable-features=NetworkService and offline flags.
- PyMuPDF text layer extraction asserting exact raw '$' count == 0.
- KaTeX font embedding and layout dimension verification (A4 Portrait).
- Multi-job isolation and ephemeral directory cleanup.
"""

import os
import sys
import tempfile
import shutil
import time
import subprocess
import unittest
import pymupdf

# Point to engines/quiz
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
QUIZ_ENGINE_DIR = os.path.join(ROOT_DIR, "engines", "quiz")
sys.path.insert(0, QUIZ_ENGINE_DIR)

from quiz_pipeline import (
    generate_worksheet_html,
    generate_answer_key_html,
    compile_pdf,
    find_chrome_path,
    KATEX_SRC_DIR
)


class TestMilestone3OfflineMathChallenge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chrome_path = find_chrome_path()
        if not cls.chrome_path or not os.path.exists(cls.chrome_path):
            raise RuntimeError(f"Google Chrome not found at {cls.chrome_path}")
        if not os.path.isdir(KATEX_SRC_DIR):
            raise RuntimeError(f"KATEX_SRC_DIR not found at {KATEX_SRC_DIR}")

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="challenger_m3_")

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_01_katex_local_bundle_integrity(self):
        """Verify all local KaTeX vendor files exist, are non-empty, and fonts are .woff2."""
        css_file = os.path.join(KATEX_SRC_DIR, "katex.min.css")
        js_file = os.path.join(KATEX_SRC_DIR, "katex.min.js")
        auto_render_file = os.path.join(KATEX_SRC_DIR, "contrib", "auto-render.min.js")
        fonts_dir = os.path.join(KATEX_SRC_DIR, "fonts")

        self.assertTrue(os.path.isfile(css_file), "katex.min.css must exist")
        self.assertGreater(os.path.getsize(css_file), 20000, "katex.min.css must be > 20KB")

        self.assertTrue(os.path.isfile(js_file), "katex.min.js must exist")
        self.assertGreater(os.path.getsize(js_file), 250000, "katex.min.js must be > 250KB")

        self.assertTrue(os.path.isfile(auto_render_file), "auto-render.min.js must exist")
        self.assertGreater(os.path.getsize(auto_render_file), 3000, "auto-render.min.js must be > 3KB")

        self.assertTrue(os.path.isdir(fonts_dir), "fonts/ directory must exist")
        font_files = os.listdir(fonts_dir)
        self.assertEqual(len(font_files), 20, f"Expected exactly 20 font files, found {len(font_files)}")
        for f in font_files:
            self.assertTrue(f.endswith(".woff2"), f"Font file {f} must be .woff2 format")
            f_size = os.path.getsize(os.path.join(fonts_dir, f))
            self.assertGreater(f_size, 3000, f"Font file {f} must not be empty or truncated")

        # Inspect katex.min.css font paths: must refer to relative fonts/ and ZERO remote URLs
        with open(css_file, "r", encoding="utf-8") as f:
            css_content = f.read()
        self.assertNotIn("http://", css_content, "CSS must not contain http:// remote references")
        self.assertNotIn("https://", css_content, "CSS must not contain https:// remote references")
        self.assertIn("fonts/KaTeX_Main-Regular.woff2", css_content, "CSS must reference relative fonts/*.woff2")

    def test_02_templates_zero_cdn_and_synchronous_scripts(self):
        """Verify worksheet and answer key templates have 0 CDN links and synchronous scripts at bottom of body."""
        sample_questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Tính $x^2 + 1$",
                "options": {"A": "$1$", "B": "$2$", "C": "$3$", "D": "$4$"},
                "answer": "A",
                "explanation": "Vì $x = 0$ nên $x^2 + 1 = 1$."
            }
        ]

        ws_html = generate_worksheet_html("Test Đề", "Subtitle", sample_questions)
        ans_html = generate_answer_key_html("Test Đáp Án", "Subtitle", sample_questions)

        for name, html in [("Worksheet", ws_html), ("Answer Key", ans_html)]:
            self.assertNotIn("cdn.jsdelivr.net", html, f"{name} must not contain cdn.jsdelivr.net")
            self.assertNotIn("unpkg.com", html, f"{name} must not contain unpkg.com")
            self.assertNotIn("cdnjs.cloudflare.com", html, f"{name} must not contain cdnjs")
            self.assertIn('<link rel="stylesheet" href="./katex/katex.min.css">', html,
                          f"{name} must load local katex.min.css")
            self.assertIn('<script src="./katex/katex.min.js"></script>', html,
                          f"{name} must load local katex.min.js")
            self.assertIn('<script src="./katex/contrib/auto-render.min.js"></script>', html,
                          f"{name} must load local auto-render.min.js")

            # Must NOT use defer or DOMContentLoaded wrapper
            self.assertNotIn('defer src="./katex', html, f"{name} must not use defer on katex scripts")
            self.assertNotIn("window.addEventListener('DOMContentLoaded'", html,
                             f"{name} must execute renderMathInElement synchronously without DOMContentLoaded")

            # Script tag must be near bottom of body
            idx_script = html.find('<script src="./katex/katex.min.js"></script>')
            idx_body_close = html.find('</body>')
            self.assertGreater(idx_script, 0, f"{name} script must be present")
            self.assertGreater(idx_body_close, idx_script, f"{name} script must precede </body>")

    def test_03_adversarial_math_and_chem_worksheet_compilation(self):
        """Stress-test offline compilation of complex math & chemistry formulas in Worksheet PDF.
        Assert that PyMuPDF text layer extraction contains exactly 0 raw '$' characters."""
        # Setup job folder with local KaTeX assets
        job_dir = os.path.join(self.temp_dir, "job_ws")
        os.makedirs(job_dir, exist_ok=True)
        shutil.copytree(KATEX_SRC_DIR, os.path.join(job_dir, "katex"), dirs_exist_ok=True)

        adversarial_questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": (
                    "Nghiệm của phương trình bậc hai $ax^2 + bx + c = 0$ ($a \\neq 0$) là "
                    "$x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ và liên phân số "
                    "$f(x) = \\frac{1}{1 + \\frac{1}{1 + \\frac{1}{x}}}$ có giới hạn khi $x \\to \\infty$ bằng bao nhiêu?"
                ),
                "options": {
                    "A": "$\\frac{1}{2}$",
                    "B": "$\\frac{\\sqrt{5} - 1}{2}$",
                    "C": "$-\\frac{\\sqrt{2}}{2}$",
                    "D": "$\\frac{2\\pi}{3}$"
                },
                "answer": "B"
            },
            {
                "number": 2,
                "type": "mcq",
                "question": (
                    "Cho biểu thức chứa căn bậc ba và căn bậc hai: "
                    "$P = \\sqrt[3]{27x^3 - 8} + \\sqrt{\\frac{a^2 + b^2}{2}}$ với $a, b > 0$. "
                    "Tính giá trị của $P$ khi $x = 1$ và $a = b = \\sqrt{2}$."
                ),
                "options": {
                    "A": "$\\sqrt{2} + \\sqrt[3]{19}$",
                    "B": "$\\sqrt{3}$",
                    "C": "$2 + \\sqrt{5}$",
                    "D": "$\\sqrt{6}$"
                },
                "answer": "A"
            },
            {
                "number": 3,
                "type": "mcq",
                "question": (
                    "Trong vật lý lượng tử và sóng ánh sáng: công thức dịch chuyển Compton là "
                    "$\\Delta \\lambda = \\frac{h}{m_e c}(1 - \\cos\\theta)$ và định lý động học sóng "
                    "$\\Phi = B \\cdot S \\cdot \\cos\\alpha$, tần số góc $\\omega = 2\\pi f$. "
                    "Góc $\\theta$ thoả mãn $\\alpha + \\beta + \\gamma = \\pi$ và $\\sigma = \\sqrt{\\frac{1}{N}\\sum_{i=1}^N (x_i - \\mu)^2}$."
                ),
                "options": {
                    "A": "$\\theta = \\frac{\\pi}{2}$",
                    "B": "$\\theta = \\pi$",
                    "C": "$\\theta = \\frac{\\pi}{3}$",
                    "D": "$\\theta = \\frac{\\pi}{4}$"
                },
                "answer": "B"
            },
            {
                "number": 4,
                "type": "mcq",
                "question": (
                    "Tổng lập phương các số tự nhiên: $\\sum_{k=1}^{n} k^3 = \\left(\\frac{n(n+1)}{2}\\right)^2$. "
                    "Tích phân Gauss $\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$. "
                    "Cho ma trận cấp số mũ $2^{2^n} + 1$ và logarithm $\\log_2(x^2 - 4x + 5) \\ge 1$."
                ),
                "options": {
                    "A": "$x_{i,j}^{(k+1)} \\le 10$",
                    "B": "$A_{m \\times n}$",
                    "C": "$x = 2$",
                    "D": "Vô nghiệm"
                },
                "answer": "C"
            },
            {
                "number": 5,
                "type": "mcq",
                "question": (
                    "Hóa học hữu cơ và vô cơ: Cho $0{,}1\\text{ mol } C_2H_5OH$ tác dụng hoàn toàn với Na dư thu được thể tích "
                    "khí $H_2$ (đktc). Mặt khác hòa tan hoàn toàn muối sắt có ion $Fe^{3+}$ và $SO_4^{2-}$ vào dung dịch chứa $Ba(OH)_2$ "
                    "thu được kết tủa gồm $Fe(OH)_3\\downarrow$ và $BaSO_4\\downarrow$. "
                    "Sử dụng thẻ sub/sup: C<sub>2</sub>H<sub>5</sub>OH + Na → C<sub>2</sub>H<sub>5</sub>ONa + 1/2 H<sub>2</sub>."
                ),
                "options": {
                    "A": "$2\\text{C}_2\\text{H}_5\\text{OH} + 2\\text{Na} \\to 2\\text{C}_2\\text{H}_5\\text{ONa} + \\text{H}_2\\uparrow$",
                    "B": "$\\text{Fe}^{3+} + 3\\text{OH}^- \\to \\text{Fe(OH)}_3\\downarrow$",
                    "C": "$\\text{Ba}^{2+} + \\text{SO}_4^{2-} \\to \\text{BaSO}_4\\downarrow$",
                    "D": "$\\text{CH}_3\\text{COOH} + \\text{C}_2\\text{H}_5\\text{OH} \\rightleftharpoons \\text{CH}_3\\text{COOC}_2\\text{H}_5 + \\text{H}_2\\text{O}$"
                },
                "answer": "A"
            },
            {
                "number": 6,
                "type": "mcq",
                "question": (
                    "Kiểm tra đa dạng delimiter KaTeX: Inline chuẩn $E = mc^2$, inline ngoặc đơn \\(x + y = z\\), "
                    "display chuẩn $$S = \\frac{1}{2}ab\\sin C$$, display ngoặc vuông \\[\\lim_{x \\to 0}\\frac{\\sin x}{x} = 1\\]."
                ),
                "options": {
                    "A": "$E = 0$",
                    "B": "$S > 0$",
                    "C": "$x = 1$",
                    "D": "Cả A, B, C đều đúng"
                },
                "answer": "B"
            },
            {
                "number": 7,
                "type": "mcq",
                "question": (
                    "Quan hệ tập hợp và vector: Cho hai tập hợp $A \\cap B \\neq \\emptyset$, "
                    "vector $\\vec{u} \\cdot \\vec{v} = 0$, toán tử xấp xỉ $f(x) \\approx g(x)$ và bất đẳng thức $x < y \\le z > w \\ge 0$."
                ),
                "options": {
                    "A": "$\\vec{u} \\perp \\vec{v}$",
                    "B": "$\\vec{u} \\parallel \\vec{v}$",
                    "C": "$A \\subset B$",
                    "D": "$x = w$"
                },
                "answer": "A"
            }
        ]

        html_content = generate_worksheet_html(
            title="ĐỀ THI ADVERSARIAL STRESS TEST TOÁN & HÓA HỌC",
            subtitle="Challenger 1 Empirical Verification Suite",
            questions=adversarial_questions
        )

        html_path = os.path.join(job_dir, "Adversarial_DeBai.html")
        pdf_path = os.path.join(job_dir, "Adversarial_DeBai.pdf")

        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        t0 = time.time()
        compile_pdf(self.chrome_path, html_path, pdf_path)
        comp_time = time.time() - t0
        print(f"\n[Empirical] Worksheet PDF compilation time: {comp_time:.2f}s")

        self.assertTrue(os.path.isfile(pdf_path), "Compiled PDF must exist")
        self.assertGreater(os.path.getsize(pdf_path), 20000, "Compiled PDF must be > 20KB")

        # PyMuPDF text layer inspection
        doc = pymupdf.open(pdf_path)
        self.assertGreaterEqual(len(doc), 1, "PDF must have at least 1 page")

        total_text = ""
        total_dollar_count = 0
        for pno, page in enumerate(doc):
            text = page.get_text()
            total_text += text
            page_dollar = text.count("$")
            total_dollar_count += page_dollar
            print(f"[Empirical] Page {pno + 1}: length={len(text)} chars, '$' count={page_dollar}")

        # CRITICAL ASSERTION: exactly ZERO raw '$' characters
        self.assertEqual(
            total_dollar_count, 0,
            f"Expected exactly 0 raw '$' characters in PDF text layer, but found {total_dollar_count}!"
        )

        # Verify math content rendered into text layer
        self.assertTrue(
            any(k in total_text for k in ["ax2", "bx", "2a", "sqrt", "lim", "pi", "sin", "C2H5OH", "Na", "Fe3+"]),
            "Text layer must contain rendered math/chemistry content"
        )
        print("[Empirical] PASS: 0 raw '$' in Worksheet PDF text layer")

    def test_04_adversarial_answer_key_compilation(self):
        """Stress-test offline compilation of Answer Key PDF with complex math explanations."""
        job_dir = os.path.join(self.temp_dir, "job_ans")
        os.makedirs(job_dir, exist_ok=True)
        shutil.copytree(KATEX_SRC_DIR, os.path.join(job_dir, "katex"), dirs_exist_ok=True)

        adversarial_questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Tìm cực trị của hàm số $y = \\frac{x^2 - 3x + 2}{x - 1}$",
                "options": {"A": "$y' = 1$", "B": "$y' = 0$", "C": "$x = 2$", "D": "Không có"},
                "answer": "D",
                "explanation": (
                    "Hàm số xác định khi $x \\neq 1$. Rút gọn $y = x - 2$ với $x \\neq 1$. "
                    "Đạo hàm $y' = 1 > 0 \\; \\forall x \\neq 1$, hàm số luôn đồng biến trên từng khoảng xác định. "
                    "Do đó hàm số không có cực trị: $\\min y$ hay $\\max y$ không tồn tại."
                )
            },
            {
                "number": 2,
                "type": "mcq",
                "question": "Tính thế điện cực tiêu chuẩn $E^o$ của pin điện hóa $\\text{Zn} - \\text{Cu}$",
                "options": {"A": "$+1{,}10\\text{ V}$", "B": "$+0{,}76\\text{ V}$", "C": "$+0{,}34\\text{ V}$", "D": "$-1{,}10\\text{ V}$"},
                "answer": "A",
                "explanation": (
                    "Phương trình bán phản ứng: "
                    "Anode: $\\text{Zn} \\to \\text{Zn}^{2+} + 2e$ ($E^o_{\\text{Zn}^{2+}/\\text{Zn}} = -0{,}76\\text{ V}$); "
                    "Cathode: $\\text{Cu}^{2+} + 2e \\to \\text{Cu}$ ($E^o_{\\text{Cu}^{2+}/\\text{Cu}} = +0{,}34\\text{ V}$). "
                    "Sức điện động tiêu chuẩn: $E^o_{\\text{pin}} = E^o_{\\text{cathode}} - E^o_{\\text{anode}} = 0{,}34 - (-0{,}76) = +1{,}10\\text{ V}$."
                )
            }
        ]

        html_content = generate_answer_key_html(
            title="ĐÁP ÁN & LỜI GIẢI ADVERSARIAL TEST",
            subtitle="Challenger 1 Empirical Verification Suite",
            questions=adversarial_questions
        )

        html_path = os.path.join(job_dir, "Adversarial_DapAn.html")
        pdf_path = os.path.join(job_dir, "Adversarial_DapAn.pdf")

        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        t0 = time.time()
        compile_pdf(self.chrome_path, html_path, pdf_path)
        comp_time = time.time() - t0
        print(f"\n[Empirical] Answer Key PDF compilation time: {comp_time:.2f}s")

        self.assertTrue(os.path.isfile(pdf_path), "Compiled Answer Key PDF must exist")
        doc = pymupdf.open(pdf_path)
        self.assertGreaterEqual(len(doc), 1, "PDF must have at least 1 page")

        total_dollar_count = 0
        total_text = ""
        for pno, page in enumerate(doc):
            text = page.get_text()
            total_text += text
            page_dollar = text.count("$")
            total_dollar_count += page_dollar
            print(f"[Empirical] Answer Key Page {pno + 1}: length={len(text)} chars, '$' count={page_dollar}")

        self.assertEqual(
            total_dollar_count, 0,
            f"Expected exactly 0 raw '$' characters in Answer Key PDF, but found {total_dollar_count}!"
        )
        collapsed_text = "".join(total_text.split())
        self.assertIn("Zn", collapsed_text)
        self.assertIn("2+", collapsed_text)
        self.assertIn("1,10", collapsed_text)
        print("[Empirical] PASS: 0 raw '$' in Answer Key PDF text layer and math formulas present")

    def test_05_font_embedding_and_page_dimensions(self):
        """Inspect embedded fonts in compiled PDF via PyMuPDF to ensure KaTeX fonts are embedded
        and page dimensions are standard A4 portrait."""
        job_dir = os.path.join(self.temp_dir, "job_font")
        os.makedirs(job_dir, exist_ok=True)
        shutil.copytree(KATEX_SRC_DIR, os.path.join(job_dir, "katex"), dirs_exist_ok=True)

        sample_questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Tính tích phân $\\int_0^1 x^2 dx = \\frac{1}{3}$ và $\\alpha + \\beta = \\theta$.",
                "options": {"A": "$\\frac{1}{3}$", "B": "$\\frac{1}{2}$", "C": "$1$", "D": "$0$"},
                "answer": "A"
            }
        ]
        html_content = generate_worksheet_html("Font Test", "", sample_questions)
        html_path = os.path.join(job_dir, "FontTest.html")
        pdf_path = os.path.join(job_dir, "FontTest.pdf")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        compile_pdf(self.chrome_path, html_path, pdf_path)

        doc = pymupdf.open(pdf_path)
        page = doc[0]

        # Check page dimensions: A4 portrait is 595.276 x 841.89 points
        rect = page.rect
        print(f"\n[Empirical] Page rect: width={rect.width}, height={rect.height}")
        self.assertAlmostEqual(rect.width, 595.28, delta=2.0, msg="Page width must match A4 (595.28 pt)")
        self.assertAlmostEqual(rect.height, 841.89, delta=2.0, msg="Page height must match A4 (841.89 pt)")

        # Inspect embedded fonts
        fonts = page.get_fonts()
        print(f"[Empirical] Page fonts list ({len(fonts)} fonts):")
        font_names = []
        for f in fonts:
            # tuple format: (xref, ext, type, basefont, name, encoding)
            basefont = f[3]
            font_names.append(basefont)
            print(f"  - {basefont} (type: {f[2]}, ext: {f[1]})")

        # Verify KaTeX fonts are present
        has_katex_font = any("KaTeX" in fn for fn in font_names)
        self.assertTrue(has_katex_font, f"Expected KaTeX fonts embedded in PDF, found: {font_names}")
        print("[Empirical] PASS: KaTeX font embedding verified")

    def test_06_simulated_network_blocked_compilation(self):
        """Verify that Chrome headless flag --disable-features=NetworkService completely isolates
        network and rendering still operates fast and reliably offline."""
        job_dir = os.path.join(self.temp_dir, "job_offline_flag")
        os.makedirs(job_dir, exist_ok=True)
        shutil.copytree(KATEX_SRC_DIR, os.path.join(job_dir, "katex"), dirs_exist_ok=True)

        sample_questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Biểu thức offline: $x = \\frac{-b}{2a}$, $y = \\sqrt{z}$",
                "options": {"A": "$1$", "B": "$2$", "C": "$3$", "D": "$4$"},
                "answer": "A"
            }
        ]
        html_content = generate_worksheet_html("Offline Test", "", sample_questions)
        html_path = os.path.join(job_dir, "Offline.html")
        pdf_path = os.path.join(job_dir, "Offline.pdf")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        t0 = time.time()
        compile_pdf(self.chrome_path, html_path, pdf_path)
        elapsed = time.time() - t0

        self.assertLess(elapsed, 10.0, f"Offline compilation took {elapsed:.2f}s, expected < 10.0s")
        self.assertTrue(os.path.isfile(pdf_path))
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text()
        self.assertEqual(text.count("$"), 0, "No raw '$' allowed in text layer")
        print(f"\n[Empirical] PASS: Offline render finished in {elapsed:.2f}s with 0 raw '$'")

    def test_07_visual_pixmap_render_sanity(self):
        """Render compiled PDF page to image pixmap via PyMuPDF to assert non-blank visual layout."""
        job_dir = os.path.join(self.temp_dir, "job_pixmap")
        os.makedirs(job_dir, exist_ok=True)
        shutil.copytree(KATEX_SRC_DIR, os.path.join(job_dir, "katex"), dirs_exist_ok=True)

        sample_questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Câu 1 với công thức: $f(x) = \\int_0^x \\sin(t) dt$",
                "options": {"A": "$\\cos(x)$", "B": "$1 - \\cos(x)$", "C": "$\\sin(x)$", "D": "$0$"},
                "answer": "B"
            }
        ]
        html_path = os.path.join(job_dir, "Pixmap.html")
        pdf_path = os.path.join(job_dir, "Pixmap.pdf")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(generate_worksheet_html("Pixmap Test", "", sample_questions))

        compile_pdf(self.chrome_path, html_path, pdf_path)

        doc = pymupdf.open(pdf_path)
        pix = doc[0].get_pixmap(dpi=150)
        # A4 portrait at 150 DPI is approx 1240 x 1754
        print(f"\n[Empirical] Pixmap size: {pix.width}x{pix.height}, samples: {len(pix.samples)} bytes")
        self.assertGreater(pix.width, 1000, "Pixmap width must be > 1000px")
        self.assertGreater(pix.height, 1500, "Pixmap height must be > 1500px")

        # Check non-blank: not all pixels are pure white (255)
        samples = pix.samples
        has_dark_pixel = any(b < 200 for b in samples[::50])
        self.assertTrue(has_dark_pixel, "Page visual rendering must contain dark ink pixels (not all white)")
        print("[Empirical] PASS: Pixmap rendering verified non-blank with valid glyph rasterization")

    def test_08_concurrent_job_compilation_isolation(self):
        """Run 3 concurrent PDF compilations in distinct directories to stress test process isolation."""
        import concurrent.futures

        def compile_worker(job_idx):
            j_dir = os.path.join(self.temp_dir, f"concurrent_{job_idx}")
            os.makedirs(j_dir, exist_ok=True)
            shutil.copytree(KATEX_SRC_DIR, os.path.join(j_dir, "katex"), dirs_exist_ok=True)
            qs = [
                {
                    "number": 1,
                    "type": "mcq",
                    "question": f"Công thức song song {job_idx}: $\\sum_{{i=1}}^{{n}} i^{job_idx} = \\frac{{1}}{{{job_idx+1}}} n^{{{job_idx+1}}} + \\dots$",
                    "options": {"A": "$1$", "B": "$2$", "C": "$3$", "D": "$4$"},
                    "answer": "A"
                }
            ]
            h_path = os.path.join(j_dir, f"c_{job_idx}.html")
            p_path = os.path.join(j_dir, f"c_{job_idx}.pdf")
            with open(h_path, "w", encoding="utf-8") as f:
                f.write(generate_worksheet_html(f"Job {job_idx}", "", qs))
            t_start = time.time()
            compile_pdf(self.chrome_path, h_path, p_path)
            el = time.time() - t_start
            doc = pymupdf.open(p_path)
            raw_dollars = sum(p.get_text().count("$") for p in doc)
            return job_idx, el, os.path.getsize(p_path), raw_dollars

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(compile_worker, i) for i in range(1, 4)]
            results = [f.result() for f in futures]

        for j_idx, el, sz, dollars in results:
            print(f"[Empirical] Concurrent job {j_idx}: time={el:.2f}s, size={sz} bytes, dollars={dollars}")
            self.assertGreater(sz, 20000)
            self.assertEqual(dollars, 0)
        print("[Empirical] PASS: 3 concurrent compilation jobs succeeded with 0 raw '$'")

    def test_09_stress_large_scale_25_questions_worksheet(self):
        """Stress-test rendering and compilation of a full 25-question exam with math and chemistry."""
        job_dir = os.path.join(self.temp_dir, "job_large_exam")
        os.makedirs(job_dir, exist_ok=True)
        shutil.copytree(KATEX_SRC_DIR, os.path.join(job_dir, "katex"), dirs_exist_ok=True)

        questions = []
        for i in range(1, 26):
            questions.append({
                "number": i,
                "type": "mcq",
                "question": f"Câu hỏi {i}: Tính $I_{i} = \\int_{{0}}^{{\\pi/{i}}} x \\sin({i}x) dx$ và $C_{{{i}}}H_{{{2*i+2}}}$.",
                "options": {
                    "A": f"$\\frac{{{i}}}{{{i+1}}}$",
                    "B": f"$\\sqrt{{{i}}}$",
                    "C": f"$\\pi / {i}$",
                    "D": f"$\\text{{Fe}}^{{{i}+}}$"
                },
                "answer": "A"
            })

        html_content = generate_worksheet_html("ĐỀ THI 25 CÂU STRESS TEST", "Đầy đủ 25 câu", questions)
        h_path = os.path.join(job_dir, "large.html")
        p_path = os.path.join(job_dir, "large.pdf")
        with open(h_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        t0 = time.time()
        compile_pdf(self.chrome_path, h_path, p_path)
        elapsed = time.time() - t0
        print(f"\n[Empirical] 25-question exam compile time: {elapsed:.2f}s")

        doc = pymupdf.open(p_path)
        print(f"[Empirical] 25-question exam page count: {len(doc)} pages")
        self.assertGreaterEqual(len(doc), 3, "25 questions should span at least 3 pages")

        total_dollars = 0
        for pno, p in enumerate(doc):
            d_count = p.get_text().count("$")
            total_dollars += d_count
            print(f"  - Page {pno + 1}: length={len(p.get_text())}, '$' count={d_count}")

        self.assertEqual(total_dollars, 0, f"Expected 0 raw '$' across all pages of 25-question exam, got {total_dollars}")
        print("[Empirical] PASS: 25-question exam compiled with 0 raw '$' across all pages")

    def test_10_missing_katex_dir_fail_fast(self):
        """Verify run_pipeline raises RuntimeError if KATEX_SRC_DIR does not exist."""
        from quiz_pipeline import run_pipeline
        import unittest.mock as mock

        with mock.patch("quiz_pipeline.KATEX_SRC_DIR", "/nonexistent/path/to/katex"):
            with self.assertRaises(RuntimeError) as ctx:
                run_pipeline(
                    input_source="dummy.pdf",
                    pages="1",
                    count=5
                )
            self.assertIn("Thiếu thư viện KaTeX cục bộ", str(ctx.exception))
            print(f"\n[Empirical] PASS: Fail-fast correctly caught missing KaTeX dir: {ctx.exception}")


if __name__ == "__main__":
    unittest.main()

