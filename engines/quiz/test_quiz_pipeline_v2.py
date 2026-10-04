"""
Unit tests for Quiz Pipeline v2.0 modules:
- 2-Column Layout Sorting (Module 1.1)
- Visual Asset Extraction & Clustering (Module 1.2)
- Structured Table Extraction (Module 1.3)
- Cross-Page Question Stitching (Module 1.4)
- Multi-Format Question Schema & HTML Generation (Module 1.5, 1.7)
- Sliding Window Chunking (Module 1.6)
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import pymupdf
import shutil
import tempfile
import time
import uuid

# Reconfigure stdout for utf-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add parent path to import
sys.path.insert(0, os.path.dirname(__file__))

from quiz_pipeline import (
    sort_blocks_by_layout,
    cluster_rects,
    extract_visual_assets,
    table_to_markdown,
    extract_tables_with_structure,
    stitch_cross_page_text,
    chunk_questions_sliding_window,
    link_assets_to_questions,
    format_tables_in_text,
    generate_worksheet_html,
    generate_answer_key_html,
    normalize_question,
    clean_image_markers,
    is_running_header_or_footer,
    is_section_banner,
    extract_structured_page_content
)

SAMPLE_EXAM_TEXT = (
    "Câu 1: Kim loại kiềm nào sau đây có tính khử mạnh nhất và tác dụng mãnh liệt với nước?\n"
    "A. Liti (Li)\nB. Natri (Na)\nC. Kali (K)\nD. Xesi (Cs)\n"
)


class TestQuizPipelineV2(unittest.TestCase):

    def setUp(self):
        self._test_cache_dir = tempfile.mkdtemp(prefix="quiz_test_cache_")
        self._orig_cache_dir = os.environ.get("QUIZ_CACHE_DIR")
        os.environ["QUIZ_CACHE_DIR"] = self._test_cache_dir

    def tearDown(self):
        if self._orig_cache_dir is not None:
            os.environ["QUIZ_CACHE_DIR"] = self._orig_cache_dir
        else:
            os.environ.pop("QUIZ_CACHE_DIR", None)
        shutil.rmtree(self._test_cache_dir, ignore_errors=True)

    def test_2_column_layout_sorting(self):
        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)
        # Create blocks:
        # Header block spanning top
        # Col 1: Question 1 at (50, 150), Question 2 at (50, 300)
        # Col 2: Question 3 at (350, 150), Question 4 at (350, 300)
        blocks = [
            (50, 50, 550, 100, "ĐỀ THI TRẮC NGHIỆM HÓA HỌC", 0, 0),
            (350, 150, 550, 250, "Câu 3: Chất nào sau đây...", 1, 0),
            (50, 150, 250, 250, "Câu 1: Kim loại kiềm...", 2, 0),
            (350, 300, 550, 400, "Câu 4: Đồng vị của...", 3, 0),
            (50, 300, 250, 400, "Câu 2: Este đơn chức...", 4, 0),
        ]

        sorted_blocks = sort_blocks_by_layout(page, blocks)
        texts = [b[4].strip() for b in sorted_blocks]

        # Expected order: Header -> Câu 1 -> Câu 2 -> Câu 3 -> Câu 4
        self.assertIn("ĐỀ THI", texts[0])
        self.assertIn("Câu 1", texts[1])
        self.assertIn("Câu 2", texts[2])
        self.assertIn("Câu 3", texts[3])
        self.assertIn("Câu 4", texts[4])

    def test_running_header_footer_filtering(self):
        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)
        blocks = [
            (50, 10, 550, 30, "Trang 1/4 - Mã đề thi 101", 0, 0),
            (50, 150, 550, 250, "Câu 1: Khí cười là N2O.", 1, 0),
            (50, 770, 550, 790, "--- HẾT ---", 2, 0),
        ]
        sorted_blocks = sort_blocks_by_layout(page, blocks)
        texts = [b[4].strip() for b in sorted_blocks]
        self.assertEqual(len(texts), 1)
        self.assertIn("Câu 1", texts[0])

    def test_cluster_rects(self):
        r1 = pymupdf.Rect(10, 10, 50, 50)
        r2 = pymupdf.Rect(55, 10, 95, 50) # Within 10pt margin of r1
        r3 = pymupdf.Rect(200, 200, 250, 250) # Far away

        clusters = cluster_rects([r1, r2, r3], margin=10.0)
        self.assertEqual(len(clusters), 2)
        # First cluster is union of r1 and r2
        self.assertEqual(clusters[0].x0, 10)
        self.assertEqual(clusters[0].x1, 95)

    def test_table_to_markdown(self):
        data = [
            ["Kim loại", "Tính khử", "Màu sắc"],
            ["Na", "Mạnh", "Trắng bạc"],
            ["Fe", "Trung bình", "Xám"]
        ]
        md = table_to_markdown(data)
        self.assertIn("| Kim loại | Tính khử | Màu sắc |", md)
        self.assertIn("| :--- | :--- | :--- |", md)
        self.assertIn("| Na | Mạnh | Trắng bạc |", md)

    def test_format_tables_in_text(self):
        text = (
            "Cho bảng số liệu sau:\n"
            "| Chất | Nhiệt độ sôi (°C) |\n"
            "| :--- | :--- |\n"
            "| CH4 | -161 |\n"
            "| C2H6 | -88 |\n"
            "Chất nào có nhiệt độ sôi cao hơn?"
        )
        html = format_tables_in_text(text)
        self.assertIn('<table class="q-table">', html)
        self.assertIn("<th>Nhiệt độ sôi (°C)</th>", html)
        self.assertIn("<td>-161</td>", html)

    def test_cross_page_stitcher(self):
        p1 = "Câu 12: Đốt cháy hoàn toàn hỗn hợp X gồm 2 amin no, đơn chức cần V lít O2.\nA. 2,24 lít.          B. 4,48 lít."
        p2 = "C. 6,72 lít.          D. 8,96 lít.\nCâu 13: Polime nào sau đây được dùng chế tạo tơ tằm nhân tạo?"

        stitched = stitch_cross_page_text([p1, p2])
        # P1 and P2 should be merged without a disruptive page break
        self.assertNotIn("--- PAGE BREAK ---", stitched)
        self.assertIn("B. 4,48 lít.\nC. 6,72 lít.", stitched)

    def test_sliding_window_chunking(self):
        full_text = "\n\n".join(f"Câu {i}: Đây là nội dung câu hỏi số {i}.\nA. 1 B. 2 C. 3 D. 4" for i in range(1, 26))
        chunks = chunk_questions_sliding_window(full_text, target_count=25, window_size=10)
        # Should produce 3 windows for 25 questions
        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0][0], 1)
        self.assertEqual(chunks[0][1], 10)
        self.assertEqual(chunks[1][0], 11)
        self.assertEqual(chunks[1][1], 20)

    def test_html_generation_mcq(self):
        questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Cho phản ứng $E = mc^2$, este X là...",
                "options": {"A": "CH<sub>3</sub>COOH", "B": "C<sub>2</sub>H<sub>5</sub>OH", "C": "HCOOH", "D": "CH<sub>3</sub>OH"},
                "answer": "A",
                "explanation": "Do este X thủy phân sinh ra axit axetic."
            },
            {
                "number": 2,
                "type": "mcq",
                "question": "Khi nói về kim loại kiềm, phát biểu nào sau đây đúng?",
                "options": {
                    "A": "Đều có mạng tinh thể lập phương tâm khối.",
                    "B": "Nhiệt độ nóng chảy tăng dần từ Li đến Cs.",
                    "C": "Đều có tính oxy hóa mạnh.",
                    "D": "Không phản ứng với nước."
                },
                "answer": "A",
                "explanation": "Kim loại kiềm đều có mạng tinh thể lập phương tâm khối."
            }
        ]

        ws_html = generate_worksheet_html("ĐỀ KIỂM TRA", "HÓA HỌC 12", questions)
        self.assertIn("CÂU HỎI TRẮC NGHIỆM", ws_html)
        self.assertIn("katex", ws_html)
        self.assertIn("options-grid", ws_html)

        ans_html = generate_answer_key_html("ĐỀ KIỂM TRA", "HÓA HỌC 12", questions)
        self.assertIn("BẢNG ĐÁP ÁN", ans_html)
        self.assertIn("matrix-table", ans_html)

    def test_visual_assets_extraction_and_linking(self):
        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)
        page.draw_rect(pymupdf.Rect(50, 100, 150, 200), color=(1, 0, 0), fill=(0, 0, 1))
        page.draw_circle(pymupdf.Point(100, 150), 30, color=(0, 1, 0))

        import tempfile
        import shutil
        temp_dir = tempfile.mkdtemp()
        try:
            assets = extract_visual_assets(page, page_num=1, temp_assets_dir=temp_dir)
            self.assertEqual(len(assets), 1)
            self.assertTrue(assets[0]["data_uri"].startswith("data:image/png;base64,"))
            self.assertTrue(os.path.exists(assets[0]["file_path"]))

            questions = [
                {"number": 1, "type": "mcq", "question": "Dựa vào hình vẽ thí nghiệm...", "image_ref": None},
                {"number": 2, "type": "mcq", "question": "Kim loại nào dẫn điện tốt nhất?", "image_ref": None}
            ]
            link_assets_to_questions(questions, assets)
            self.assertEqual(questions[0]["image_ref"], "fig_p1_1.png")
            self.assertIsNotNone(questions[0].get("image_data"))
            self.assertIsNone(questions[1].get("image_ref"))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_2_column_mid_page_banner_sorting(self):
        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)
        # Layout:
        # Band 1:
        # Top banner: y0=20, y1=60, x0=50, x1=550
        # Col 1: Q1 (x0=50, x1=250, y0=100, y1=180), Q2 (x0=50, x1=250, y0=200, y1=280)
        # Col 2: Q3 (x0=350, x1=550, y0=100, y1=180), Q4 (x0=350, x1=550, y0=200, y1=280)
        # Band 2:
        # Mid-page banner: "PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI" (spanning full width x0=50, x1=550, y0=320, y1=360)
        # Band 3:
        # Col 1: Q5 (x0=50, x1=250, y0=400, y1=480)
        # Col 2: Q6 (x0=350, x1=550, y0=400, y1=480)
        blocks = [
            (50, 20, 550, 60, "BÀI TẬP ÔN TẬP ĐẦU KỲ", 0, 0),
            (350, 100, 550, 180, "Câu 3: Chất nào tác dụng với HCl?", 1, 0),
            (50, 100, 250, 180, "Câu 1: Kim loại nhẹ nhất là Li.", 2, 0),
            (50, 400, 250, 480, "Câu 5: Cho các mệnh đề sau về ancol...", 3, 0),
            (350, 200, 550, 280, "Câu 4: Đồng có tính dẫn điện cao.", 4, 0),
            (50, 200, 250, 280, "Câu 2: Glucozơ có nhiều trong nho.", 5, 0),
            (50, 320, 550, 360, "PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI", 6, 0),
            (350, 400, 550, 480, "Câu 6: Cho các mệnh đề sau về phenol...", 7, 0),
        ]
        sorted_blocks = sort_blocks_by_layout(page, blocks)
        texts = [b[4].strip() for b in sorted_blocks]

        # In naive 2-col sort: Câu 1 -> Câu 2 -> Câu 5 would come before Câu 3 -> Câu 4!
        # In band-based sort: Top Banner -> Câu 1 -> Câu 2 -> Câu 3 -> Câu 4 -> PHẦN II -> Câu 5 -> Câu 6
        self.assertIn("BÀI TẬP", texts[0])
        self.assertIn("Câu 1", texts[1])
        self.assertIn("Câu 2", texts[2])
        self.assertIn("Câu 3", texts[3])
        self.assertIn("Câu 4", texts[4])
        self.assertIn("PHẦN II", texts[5])
        self.assertIn("Câu 5", texts[6])
        self.assertIn("Câu 6", texts[7])

    def test_school_header_filtering(self):
        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)
        blocks = [
            (50, 15, 550, 35, "SỞ GD&ĐT TỈNH BẮC GIANG - KỲ THI THỬ TỐT NGHIỆP THPT", 0, 0),
            (50, 35, 550, 50, "Họ và tên thí sinh: Nguyễn Văn A - Số báo danh: 123456", 1, 0),
            (50, 100, 550, 200, "Câu 1: Kim loại kiềm có hóa trị mấy?", 2, 0),
            (50, 780, 550, 795, "Trang 1/4 - Mã đề thi 101", 3, 0),
        ]
        sorted_blocks = sort_blocks_by_layout(page, blocks)
        texts = [b[4].strip() for b in sorted_blocks]
        self.assertEqual(len(texts), 1)
        self.assertIn("Câu 1", texts[0])

    def test_true_false_and_parenthesis_cross_page_stitching(self):
        # Case 1: GDPT 2018 True/False split across pages
        p1_tf = "Câu 4: Cho các phát biểu sau về peptit:\na) Tất cả các peptit đều có phản ứng màu biure."
        p2_tf = "b) Thủy phân hoàn toàn peptit đơn giản thu được các amino axit.\nc) Peptit mạch hở chứa n gốc có n-1 liên kết peptit."
        stitched_tf = stitch_cross_page_text([p1_tf, p2_tf])
        self.assertNotIn("--- PAGE BREAK ---", stitched_tf)
        self.assertIn("biure.\nb) Thủy phân", stitched_tf)

        # Case 2: Parenthesized options A), B) dangling
        p1_opt = "Câu 10: Cho hỗn hợp gồm Cu và Fe vào dung dịch HNO3 loãng dư thu được V lít khí NO.\nA) 2,24 lít.          B) 4,48 lít."
        p2_opt = "C) 6,72 lít.          D) 8,96 lít.\nCâu 11: Dung dịch nào sau đây làm quỳ tím hóa đỏ?"
        stitched_opt = stitch_cross_page_text([p1_opt, p2_opt])
        self.assertNotIn("--- PAGE BREAK ---", stitched_opt)
        self.assertIn("B) 4,48 lít.\nC) 6,72 lít.", stitched_opt)

    def test_defensive_question_normalization(self):
        # 1. Options given as array/list instead of dict
        raw_mcq = {
            "number": "Câu 5",
            "type": "mcq",
            "question": "Nồng độ mol của dung dịch là gì?",
            "options": ["A. 1,0 M", "B. 2,0 M", "C. 3,0 M", "D. 4,0 M"],
            "answer": "A. 1,0 M"
        }
        norm_mcq = normalize_question(raw_mcq)
        self.assertEqual(norm_mcq["number"], 5)
        self.assertEqual(norm_mcq["options"]["A"], "1,0 M")
        self.assertEqual(norm_mcq["options"]["B"], "2,0 M")
        self.assertEqual(norm_mcq["answer"], "A")

        # 2. Options given with lowercase keys and letter prefixes
        raw_mcq2 = {
            "number": 6,
            "question": "Các phát biểu sau:",
            "options": {
                "a": "A. Xenlulozơ tan nhiều trong nước.",
                "b": "B. Tinh bột thuộc loại polisaccarit.",
                "c": "C. Glucozơ có phản ứng tráng bạc.",
                "d": "D. Saccarozơ là đisaccarit."
            },
            "answer": "b"
        }
        norm_mcq2 = normalize_question(raw_mcq2)
        self.assertEqual(norm_mcq2["type"], "mcq")
        self.assertEqual(norm_mcq2["options"]["A"], "Xenlulozơ tan nhiều trong nước.")
        self.assertEqual(norm_mcq2["options"]["B"], "Tinh bột thuộc loại polisaccarit.")
        self.assertEqual(norm_mcq2["answer"], "B")

    def test_marker_purged_on_direct_match(self):
        questions = [
            {
                "number": 7,
                "type": "mcq",
                "question": "Hình vẽ dưới đây mô tả thí nghiệm điều chế khí nào?\n[IMAGE_REF: fig_p1_1]\nChọn phương án đúng.",
                "image_ref": "fig_p1_1"
            }
        ]
        assets = [
            {
                "name": "fig_p1_1.png",
                "data_uri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                "file_path": "/fake/fig_p1_1.png",
                "page": 1,
                "bbox": [50, 100, 200, 250]
            }
        ]
        link_assets_to_questions(questions, assets)
        self.assertEqual(questions[0]["image_ref"], "fig_p1_1.png")
        self.assertNotIn("[IMAGE_REF:", questions[0]["question"])
        self.assertIn("Chọn phương án đúng.", questions[0]["question"])
        self.assertIsNotNone(questions[0].get("image_data"))

    def test_sequential_index_mapping_with_renumbered_questions(self):
        """Verify that questions re-indexed from 1 still receive assets mapped to original question numbers (e.g. 14, 15)."""
        questions = [
            {"number": 1, "type": "mcq", "question": "Chất béo T được tìm thấy trong thịt bò...", "image_ref": None},
            {"number": 2, "type": "mcq", "question": "Sơ đồ biểu diễn một phân tử chất hữu cơ X...", "image_ref": None}
        ]
        assets = [
            {"id": "fig_p36_1", "name": "fig_p36_1.png", "data_uri": "data:image/png;base64,AAA1"},
            {"id": "fig_p36_2", "name": "fig_p36_2.png", "data_uri": "data:image/png;base64,AAA2"}
        ]
        asset_map = {"fig_p36_1": 14, "fig_p36_2": 15}
        source_nums = [14, 15]

        link_assets_to_questions(questions, assets, asset_question_map=asset_map, source_question_nums=source_nums)

        self.assertEqual(questions[0]["image_ref"], "fig_p36_1.png")
        self.assertEqual(questions[0]["image_data"], "data:image/png;base64,AAA1")
        self.assertEqual(questions[1]["image_ref"], "fig_p36_2.png")
        self.assertEqual(questions[1]["image_data"], "data:image/png;base64,AAA2")

    def test_no_artificial_page_breaks_in_worksheet_and_answer_key(self):
        """Verify that generate_worksheet_html and generate_answer_key_html do not inject hard page-break-before."""
        qs = [
            {"number": i, "type": "mcq", "question": f"Câu hỏi số {i}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A", "explanation": "Giải thích"}
            for i in range(1, 11)
        ]
        ws_html = generate_worksheet_html("TEST TITLE", "", qs)
        ans_html = generate_answer_key_html("TEST TITLE", "", qs)

        self.assertNotIn("page-break-before", ws_html)
        self.assertNotIn("page-break-before", ans_html)
        self.assertIn("break-inside: avoid;", ws_html)
        self.assertIn("break-inside: avoid;", ans_html)

    def test_katex_delimiters_and_ignored_classes(self):
        """Verify KaTeX delimiters in HTML have proper double backslashes, ignoredClasses, and local assets."""
        qs = [
            {"number": 1, "type": "mcq", "question": "Câu 1: [A] hoặc (10 CÂU)", "options": {"A": "1"}, "answer": "A", "explanation": "Giải thích"}
        ]
        ws_html = generate_worksheet_html("TEST TITLE", "", qs)
        ans_html = generate_answer_key_html("TEST TITLE", "", qs)

        # Verify local KaTeX assets and zero CDN dependencies
        cdn_domain = "cdn" + ".jsdelivr.net"
        self.assertNotIn(cdn_domain, ws_html)
        self.assertNotIn(cdn_domain, ans_html)

        for html in (ws_html, ans_html):
            self.assertIn('<link rel="stylesheet" href="./katex/katex.min.css">', html)
            self.assertIn('<script src="./katex/katex.min.js"></script>', html)
            self.assertIn('<script src="./katex/contrib/auto-render.min.js"></script>', html)

            # Verify JS string literal delimiters in the generated script block
            self.assertIn(r"{left: '\\(', right: '\\)', display: false}", html)
            self.assertIn(r"{left: '\\[', right: '\\]', display: true}", html)
            # Verify ignoredClasses contains critical classes
            self.assertIn('"section-banner"', html)
            self.assertIn('"katex-ignore"', html)
            self.assertIn('"notranslate"', html)
            # Verify banner has katex-ignore class
            self.assertIn('section-banner notranslate katex-ignore', html)

    def test_is_section_banner_detection(self):
        """Verify deterministic detection of Vietnamese exam section dividers and banners."""
        self.assertTrue(is_section_banner("PHẦN II. Câu trắc nghiệm đúng sai."))
        self.assertTrue(is_section_banner("PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN"))
        self.assertTrue(is_section_banner("PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN"))
        self.assertTrue(is_section_banner("Phần 1: Trắc nghiệm"))
        self.assertTrue(is_section_banner("BẢNG ĐÁP ÁN THAM KHẢO"))
        self.assertTrue(is_section_banner("HƯỚNG DẪN GIẢI CHI TIẾT"))
        self.assertTrue(is_section_banner("MỤC II. CÁC DẠNG BÀI TẬP"))
        self.assertFalse(is_section_banner("Câu 60: Methyl salicylate dùng làm thuốc xoa bóp..."))
        self.assertFalse(is_section_banner("A. 4. B. 1. C. 3. D. 2."))
        self.assertFalse(is_section_banner("Cho phản ứng hóa học sau:"))

    def test_extract_visual_assets_filters_banners_and_tables(self):
        """Verify that section banners and structured tables are never extracted as visual assets."""
        import tempfile
        import shutil

        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)

        # 1. Real diagram (should be extracted)
        page.draw_circle(pymupdf.Point(100, 150), 30, color=(0, 1, 0), fill=(0, 0, 1))

        # 2. Pink section banner (wide horizontal strip with 'PHẦN II' text, should be filtered)
        banner_rect = pymupdf.Rect(50, 400, 550, 425)
        page.draw_rect(banner_rect, color=(0.9, 0.8, 0.9), fill=(0.9, 0.8, 0.9))
        page.insert_text(pymupdf.Point(55, 418), "PHẦN II. Câu trắc nghiệm đúng sai.", fontsize=11)

        # 3. Table area (passed in table_rects, should be filtered)
        table_rect = pymupdf.Rect(50, 500, 550, 600)
        page.draw_rect(table_rect, color=(0, 0, 0))

        temp_dir = tempfile.mkdtemp()
        try:
            assets = extract_visual_assets(page, 1, temp_dir, table_rects=[table_rect])
            self.assertEqual(len(assets), 1)
            # The only asset extracted should be the circle diagram around y=150
            self.assertAlmostEqual(assets[0]["rect"][1], 120, delta=10)
            self.assertNotEqual(assets[0].get("text_inside"), "PHẦN II. Câu trắc nghiệm đúng sai.")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_chunk_questions_sliding_window_strips_trailing_section_banner(self):
        """Verify that trailing section banners at the end of a question are cleanly trimmed."""
        sample_text = (
            "Câu 60: Methyl salicylate...\n"
            "A. 4.\n"
            "B. 1.\n"
            "C. 3.\n"
            "D. 2.\n\n"
            "PHẦN II. Câu trắc nghiệm đúng sai.\n\n"
            "Câu 1: Cho các thông tin trong bảng sau:\n"
            "a) Đúng\n"
            "b) Sai\n"
        )
        windows = chunk_questions_sliding_window(sample_text, target_count=2, window_size=5)
        window_text = windows[0][2]
        # Ensure PHẦN II is not attached to Câu 60
        self.assertNotIn("PHẦN II. Câu trắc nghiệm đúng sai.", window_text.split("Câu 1:")[0])

    def test_normalize_question_sanitizes_section_banner(self):
        """Verify that normalize_question purges any stray section banner lines."""
        q = {
            "number": 60,
            "type": "mcq",
            "question": "Methyl salicylate...\n\nPHẦN II. Câu trắc nghiệm đúng sai.",
            "options": {
                "A": "4.",
                "B": "1.",
                "C": "3.",
                "D": "2.\nPHẦN II. Câu trắc nghiệm đúng sai."
            },
            "explanation": "Giải thích...\nPHẦN II. Câu trắc nghiệm đúng sai."
        }
        norm = normalize_question(q, fallback_num=60)
        self.assertNotIn("PHẦN II", norm["question"])
        self.assertNotIn("PHẦN II", norm["options"]["D"])
        self.assertNotIn("PHẦN II", norm["explanation"])

    def test_spatial_asset_map_resets_on_section_banner(self):
        """Verify that spatial asset mapping does not link post-banner images to pre-banner questions."""
        import tempfile
        import shutil

        doc = pymupdf.open()
        page = doc.new_page(width=600, height=800)
        page.insert_text(pymupdf.Point(50, 100), "Câu 60: Nội dung câu 60", fontsize=11)
        page.insert_text(pymupdf.Point(50, 200), "PHẦN II. Câu trắc nghiệm đúng sai.", fontsize=11)
        # Diagram after banner
        page.draw_circle(pymupdf.Point(100, 300), 20, color=(1, 0, 0), fill=(1, 0, 0))
        page.insert_text(pymupdf.Point(50, 400), "Câu 1: Nội dung câu 1", fontsize=11)

        temp_dir = tempfile.mkdtemp()
        try:
            _, _, asset_map = extract_structured_page_content(page, 1, temp_dir)
            # The diagram after PHẦN II should NOT be mapped to Câu 60!
            for a_id, mapped_q in asset_map.items():
                self.assertNotEqual(mapped_q, 60, f"Asset {a_id} should not be linked to pre-banner Câu 60")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    from unittest.mock import patch

    @patch("quiz_pipeline.call_agnes_api")
    def test_no_duplicate_questions_when_count_exceeds_available(self, mock_api):
        """WP2: Verify clamping to available count and absence of duplicate questions."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Nội dung câu hỏi số {i} về hóa học hữu cơ.\n"
            f"A. Đáp án A của câu {i}\n"
            f"B. Đáp án B của câu {i}\n"
            f"C. Đáp án C của câu {i}\n"
            f"D. Đáp án D của câu {i}"
            for i in range(1, 11)
        )

        def side_effect(api_key, user_prompt, system_prompt, **kwargs):
            if '"number": 6' in user_prompt or "from 6 to 10" in user_prompt:
                qs = [
                    {
                        "number": i,
                        "type": "mcq",
                        "question": f"Nội dung câu hỏi số {i} về hóa học hữu cơ.",
                        "options": {"A": f"A{i}", "B": f"B{i}", "C": f"C{i}", "D": f"D{i}"},
                        "answer": "B",
                        "explanation": f"Giải thích {i}"
                    }
                    for i in range(6, 11)
                ]
                return {"questions": qs}
            else:
                qs = [
                    {
                        "number": i,
                        "type": "mcq",
                        "question": f"Nội dung câu hỏi số {i} về hóa học hữu cơ.",
                        "options": {"A": f"A{i}", "B": f"B{i}", "C": f"C{i}", "D": f"D{i}"},
                        "answer": "A",
                        "explanation": f"Giải thích {i}"
                    }
                    for i in range(1, 6)
                ]
                return {"questions": qs}

        mock_api.side_effect = side_effect

        result = parse_and_standardize_questions(
            raw_text=raw_text,
            api_key="mock_key",
            count=20,
            start_num=1
        )

        self.assertEqual(len(result), 10)
        self.assertEqual([q["number"] for q in result], list(range(1, 11)))
        stems = [q["question"] for q in result]
        self.assertEqual(len(stems), len(set(stems)))
        self.assertEqual(mock_api.call_count, 2)

    @patch("quiz_pipeline.call_agnes_api")
    def test_sequential_numbering_overrides_ai_numbers(self, mock_api):
        """WP2: Verify that random/erratic AI numbers are strictly overridden by sequential numbers."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = (
            "Câu 1: Nội dung câu 1.\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 2: Nội dung câu 2.\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 3: Nội dung câu 3.\nA. 1\nB. 2\nC. 3\nD. 4"
        )
        mock_api.return_value = {
            "questions": [
                {"number": 5, "type": "mcq", "question": "Nội dung câu 1.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                {"number": 99, "type": "mcq", "question": "Nội dung câu 2.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"},
                {"number": 2, "type": "mcq", "question": "Nội dung câu 3.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "C"}
            ]
        }

        # Case 1: start_num = 1
        res1 = parse_and_standardize_questions(raw_text=raw_text, api_key="mock_key", count=3, start_num=1)
        self.assertEqual([q["number"] for q in res1], [1, 2, 3])

        # Case 2: start_num = 18
        res18 = parse_and_standardize_questions(raw_text=raw_text, api_key="mock_key", count=3, start_num=18)
        self.assertEqual([q["number"] for q in res18], [18, 19, 20])

    @patch("quiz_pipeline.call_agnes_api")
    def test_zero_questions_raises_before_any_api_call(self, mock_api):
        """WP2: Verify fast-fail with Vietnamese RuntimeError and 0 API calls when text has no questions."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "Lời mở đầu tài liệu. Giới thiệu tổng quan và mục lục, hoàn toàn không có câu trắc nghiệm."

        with self.assertRaises(RuntimeError) as ctx:
            parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=10,
                start_num=1,
                pages_desc="Trang 1-2"
            )

        self.assertIn("Không có câu hỏi trong Trang 1-2, vui lòng chọn lại.", str(ctx.exception))
        self.assertEqual(mock_api.call_count, 0)

    # ==========================================================================
    # WP3: Parallel Micro-Batching & Telemetry Unit Tests
    # ==========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    def test_batches_run_in_parallel(self, mock_api):
        """WP3: Verify that 4 batches run concurrently via ThreadPoolExecutor in < 2.0s."""
        import time
        import json
        from unittest.mock import patch as local_patch
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu hỏi số {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 21)
        )

        def slow_api(api_key, user_prompt, system_prompt, **kwargs):
            time.sleep(1.0)
            input_idx = user_prompt.find("INPUT:\n")
            if input_idx != -1:
                items = json.loads(user_prompt[input_idx + 7:].strip())
                return {
                    "questions": [
                        {
                            "number": it["number"],
                            "type": "mcq",
                            "question": it["question"],
                            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
                            "answer": "A"
                        }
                        for it in items
                    ]
                }
            return {"questions": []}

        mock_api.side_effect = slow_api

        with local_patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "4"}):
            start = time.time()
            res = parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=20,
                start_num=1
            )
            elapsed = time.time() - start

        self.assertEqual(len(res), 20)
        self.assertEqual(mock_api.call_count, 4)
        # 4 parallel workers finish in < 2.0s (~1.0s to 1.3s), while sequential would take >= 4.0s
        self.assertLess(elapsed, 2.0)

    @patch("quiz_pipeline.call_agnes_api")
    def test_result_order_independent_of_completion_order(self, mock_api):
        """WP3: Verify that result ordering remains strictly sequential even if later batches finish earlier."""
        import time
        from unittest.mock import patch as local_patch
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu hỏi số {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 11)
        )

        def out_of_order_api(api_key, user_prompt, system_prompt, **kwargs):
            # Batch 1 (questions 6-10) finishes immediately; Batch 0 (questions 1-5) sleeps 0.3s
            if '"number": 6' in user_prompt:
                qs = [
                    {"number": i, "type": "mcq", "question": f"Đề bài câu hỏi số {i}.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"}
                    for i in range(6, 11)
                ]
            else:
                time.sleep(0.3)
                qs = [
                    {"number": i, "type": "mcq", "question": f"Đề bài câu hỏi số {i}.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                    for i in range(1, 6)
                ]
            return {"questions": qs}

        mock_api.side_effect = out_of_order_api

        with local_patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "2"}):
            res = parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=10,
                start_num=1
            )

        self.assertEqual(len(res), 10)
        self.assertEqual([q["number"] for q in res], list(range(1, 11)))
        self.assertEqual([q["question"] for q in res], [f"Đề bài câu hỏi số {i}." for i in range(1, 11)])

    @patch("quiz_pipeline.call_agnes_api")
    def test_partial_batch_failure_degrades_gracefully(self, mock_api):
        """WP3: Verify that 1 failing batch falls back to raw parsed blocks without aborting the job."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu {i}.\nA. 1\nB. 2\nC. 3\nD. 4\nĐáp án: C"
            for i in range(1, 11)
        )

        def partial_failure_api(api_key, user_prompt, system_prompt, **kwargs):
            if '"number": 6' in user_prompt:
                raise RuntimeError("Agnes API 500 Internal Server Error")
            return {
                "questions": [
                    {"number": i, "type": "mcq", "question": f"Đề bài câu {i}.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A", "explanation": f"Giải thích {i}"}
                    for i in range(1, 6)
                ]
            }

        mock_api.side_effect = partial_failure_api

        res = parse_and_standardize_questions(
            raw_text=raw_text,
            api_key="mock_key",
            count=10,
            start_num=1
        )

        self.assertEqual(len(res), 10)
        self.assertEqual([q["number"] for q in res], list(range(1, 11)))
        # Batch 0 succeeded with explanation
        for q in res[:5]:
            self.assertIn("Giải thích", q["explanation"])
            self.assertEqual(q["answer"], "A")
        # Batch 1 degraded: empty explanation, answer guessed from raw regex as "C"
        for q in res[5:]:
            self.assertEqual(q["explanation"], "")
            self.assertEqual(q["answer"], "C")
            self.assertIn("Đề bài câu", q["question"])

    @patch("quiz_pipeline.call_agnes_api")
    def test_all_batches_failure_raises(self, mock_api):
        """WP3: Verify that when all batches fail, the pipeline raises the underlying RuntimeError."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 11)
        )
        mock_api.side_effect = RuntimeError("Không thể kết nối đến máy chủ Agnes AI")

        with self.assertRaises(RuntimeError) as ctx:
            parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=10,
                start_num=1
            )

        self.assertIn("Không thể kết nối đến máy chủ Agnes AI", str(ctx.exception))

    def test_emit_progress_is_thread_safe(self):
        """WP3: Verify that concurrent calls to emit_progress from 50 threads do not interleave stdout JSON lines."""
        import io
        import json
        import threading
        from contextlib import redirect_stdout
        from quiz_pipeline import emit_progress

        f = io.StringIO()
        num_threads = 50
        barrier = threading.Barrier(num_threads)

        def worker(idx):
            barrier.wait()
            emit_progress(idx, f"Đang tiến hành bước kiểm tra đa luồng số {idx}")

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]

        with redirect_stdout(f):
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        lines = [line.strip() for line in f.getvalue().strip().split("\n") if line.strip()]
        self.assertEqual(len(lines), num_threads)
        for line in lines:
            data = json.loads(line)
            self.assertIn("progress", data)
            self.assertIn("stage", data)
            self.assertIn("Đang tiến hành bước kiểm tra đa luồng số", data["stage"])

    # ==========================================================================
    # WP8: Truncated JSON Salvage, Adaptive Retries & Security Unit Tests
    # ==========================================================================

    def test_salvage_truncated_json_recovers_complete_objects(self):
        """WP8: Verify that truncated JSON recovers complete objects."""
        from quiz_pipeline import _salvage_truncated_json

        truncated_json = (
            '{"questions": ['
            '{"number": 1, "type": "mcq", "question": "Câu 1?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},'
            '{"number": 2, "type": "mcq", "question": "Câu 2?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"},'
            '{"number": 3, "type": "mcq", "question": "Câu 3?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "C"},'
            '{"number": 4, "type": "mcq", "question": "Câu 4 đang dang dở..."'
        )

        salvaged = _salvage_truncated_json(truncated_json)
        self.assertIsNotNone(salvaged)
        self.assertIn("questions", salvaged)
        self.assertEqual(len(salvaged["questions"]), 3)
        self.assertEqual([q["number"] for q in salvaged["questions"]], [1, 2, 3])

    def test_salvage_returns_none_on_unrecoverable(self):
        """WP8: Verify that unrecoverable JSON returns None."""
        from quiz_pipeline import _salvage_truncated_json

        # Cut off inside the first question object
        self.assertIsNone(_salvage_truncated_json('{"questions": [{"number": 1, "question": "dang_do'))
        # No questions array / plain text
        self.assertIsNone(_salvage_truncated_json("Bản giới thiệu giáo trình không có JSON"))
        # Empty string
        self.assertIsNone(_salvage_truncated_json(""))

    @patch("urllib.request.urlopen")
    @patch("time.sleep")
    def test_retry_uses_zero_temperature_after_json_error(self, mock_sleep, mock_urlopen):
        """WP8: Verify that invalid JSON causes retry with temperature: 0.0 and compact instruction."""
        import json
        from unittest.mock import MagicMock
        from quiz_pipeline import call_agnes_api

        # 1st response: Invalid JSON that cannot be salvaged
        resp1_content = '{"choices": [{"message": {"content": "{\\"questions\\": [{\\"number\\": 1, \\"dang_do"}}]}}'
        resp1 = MagicMock()
        resp1.read.return_value = resp1_content.encode("utf-8")
        resp1.__enter__.return_value = resp1

        # 2nd response: Valid JSON
        resp2_content = json.dumps({
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "questions": [{
                            "number": 1,
                            "type": "mcq",
                            "question": "Q1",
                            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
                            "answer": "A"
                        }]
                    })
                }
            }]
        })
        resp2 = MagicMock()
        resp2.read.return_value = resp2_content.encode("utf-8")
        resp2.__enter__.return_value = resp2

        mock_urlopen.side_effect = [resp1, resp2]

        res = call_agnes_api(
            api_key="mock_key",
            prompt="Trích xuất câu hỏi 1",
            system_prompt="System prompt",
            timeout=90
        )

        self.assertEqual(mock_urlopen.call_count, 2)
        req2 = mock_urlopen.call_args_list[1][0][0]
        payload2 = json.loads(req2.data.decode("utf-8"))
        self.assertEqual(payload2["temperature"], 0.0)
        self.assertIn("Chỉ trả JSON compact", payload2["messages"][1]["content"])
        self.assertEqual(len(res["questions"]), 1)

    @patch("urllib.request.urlopen")
    def test_http_401_does_not_retry(self, mock_urlopen):
        """WP8: Verify that HTTP 401 raises immediately without retrying."""
        import io
        import urllib.error
        from quiz_pipeline import call_agnes_api

        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="https://apihub.agnes-ai.com/v1/chat/completions",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=io.BytesIO(b"Invalid API Key")
        )

        with self.assertRaises(RuntimeError) as ctx:
            call_agnes_api(
                api_key="invalid_key",
                prompt="Prompt",
                system_prompt="System",
                timeout=90
            )

        self.assertIn("HTTP 401", str(ctx.exception))
        self.assertEqual(mock_urlopen.call_count, 1)

    def test_no_hardcoded_api_key_in_source(self):
        """WP8: Verify quiz_pipeline.py does not contain any hardcoded API keys."""
        import re
        pipeline_file = os.path.join(os.path.dirname(__file__), "quiz_pipeline.py")
        with open(pipeline_file, "r", encoding="utf-8") as f:
            content = f.read()
        matches = re.findall(r"sk-[A-Za-z0-9]{20,}", content)
        self.assertEqual(matches, [], f"Found hardcoded API keys in quiz_pipeline.py: {matches}")

    def test_katex_assets_exist_locally(self):
        """WP5: Verify KaTeX vendor assets exist locally and only contain woff2 fonts."""
        import quiz_pipeline
        katex_dir = quiz_pipeline.KATEX_SRC_DIR
        self.assertTrue(os.path.isdir(katex_dir), f"KATEX_SRC_DIR does not exist: {katex_dir}")
        self.assertTrue(os.path.isfile(os.path.join(katex_dir, "katex.min.css")))
        self.assertTrue(os.path.isfile(os.path.join(katex_dir, "katex.min.js")))
        self.assertTrue(os.path.isfile(os.path.join(katex_dir, "contrib", "auto-render.min.js")))

        fonts_dir = os.path.join(katex_dir, "fonts")
        self.assertTrue(os.path.isdir(fonts_dir), f"fonts dir does not exist: {fonts_dir}")
        font_files = os.listdir(fonts_dir)
        self.assertGreaterEqual(len(font_files), 20)
        self.assertTrue(all(f.endswith(".woff2") for f in font_files), f"Non-woff2 fonts found: {font_files}")

    def test_run_pipeline_fails_fast_when_katex_missing(self):
        """WP5: Verify run_pipeline fails fast when local KaTeX assets are missing."""
        import quiz_pipeline
        original_katex_dir = quiz_pipeline.KATEX_SRC_DIR
        try:
            quiz_pipeline.KATEX_SRC_DIR = os.path.join(tempfile.gettempdir(), "non_existent_katex_dir_12345")
            with self.assertRaises(RuntimeError) as ctx:
                quiz_pipeline.run_pipeline("dummy.pdf", "1", filename_prefix="test_prefix")
            self.assertIn("Thiếu thư viện KaTeX cục bộ", str(ctx.exception))
        finally:
            quiz_pipeline.KATEX_SRC_DIR = original_katex_dir

    def test_job_html_dir_cleaned_up_in_finally(self):
        """WP5: Verify per-job HTML directory is cleaned up in finally block."""
        import quiz_pipeline
        created_job_dirs = []
        original_copytree = shutil.copytree

        def spy_copytree(src, dst, *args, **kwargs):
            if os.path.abspath(src) == os.path.abspath(quiz_pipeline.KATEX_SRC_DIR):
                parent_dir = os.path.dirname(dst)
                created_job_dirs.append(parent_dir)
            return original_copytree(src, dst, *args, **kwargs)

        with patch("shutil.copytree", side_effect=spy_copytree):
            with patch("quiz_pipeline.download_gdrive_if_needed", side_effect=RuntimeError("Simulated pipeline failure")):
                with self.assertRaises(RuntimeError):
                    quiz_pipeline.run_pipeline("dummy.pdf", "1", filename_prefix="cleanup_test", api_key="dummy_key")

        self.assertEqual(len(created_job_dirs), 1)
        job_dir = created_job_dirs[0]
        self.assertFalse(os.path.exists(job_dir), f"job_html_dir was not cleaned up: {job_dir}")

    # ==========================================================================
    # MILESTONE 4: WP6 (SWEEP-LINE CLUSTER_RECTS) TESTS
    # ==========================================================================

    def test_cluster_rects_performance_2000_rects(self):
        """WP6: Stress-test cluster_rects with 2000 rectangles, must finish under 1.5s."""
        import random
        random.seed(42)
        test_rects = [
            pymupdf.Rect(
                random.uniform(0, 600),
                random.uniform(0, 800),
                random.uniform(0, 600) + 10,
                random.uniform(0, 800) + 10
            )
            for _ in range(2000)
        ]
        t0 = time.time()
        clusters = cluster_rects(test_rects, margin=10.0)
        elapsed = time.time() - t0
        self.assertLess(elapsed, 1.5, f"Elapsed time {elapsed:.3f}s exceeds 1.5s threshold")
        self.assertGreater(len(clusters), 0)

    def test_cluster_rects_equivalence_with_reference(self):
        """WP6: Verify 100% equivalence between sweep-line union-find and reference implementation on clustered rects."""
        import random

        def _ref_cluster(rect_list, margin=10.0):
            if not rect_list:
                return []
            clusters = [pymupdf.Rect(r) for r in rect_list]
            changed = True
            while changed:
                changed = False
                new_clusters = []
                skip = set()
                for i in range(len(clusters)):
                    if i in skip:
                        continue
                    curr = pymupdf.Rect(clusters[i])
                    for j in range(i + 1, len(clusters)):
                        if j in skip:
                            continue
                        exp_curr = pymupdf.Rect(curr.x0 - margin, curr.y0 - margin, curr.x1 + margin, curr.y1 + margin)
                        if exp_curr.intersects(clusters[j]):
                            curr = curr | clusters[j]
                            skip.add(j)
                            changed = True
                    new_clusters.append(curr)
                clusters = new_clusters
            return clusters

        random.seed(42)
        test_rects = []
        centers = [(50, 50), (200, 50), (350, 50), (100, 300), (300, 300)]
        for cx, cy in centers:
            for _ in range(10):
                x = cx + random.uniform(-20, 20)
                y = cy + random.uniform(-20, 20)
                w = random.uniform(2, 10)
                h = random.uniform(2, 10)
                test_rects.append(pymupdf.Rect(x, y, x + w, y + h))

        ref_clusters = _ref_cluster(test_rects, margin=10.0)
        new_clusters = cluster_rects(test_rects, margin=10.0)

        ref_set = {(round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)) for r in ref_clusters}
        new_set = {(round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)) for r in new_clusters}
        self.assertEqual(ref_set, new_set)

    def test_cluster_rects_transitive_bridging(self):
        """WP6: Verify that transitive connectivity (A connects to B, B to C) forms 1 cluster."""
        r_a = pymupdf.Rect(0, 0, 10, 10)
        r_b = pymupdf.Rect(15, 0, 25, 10)  # distance to A is 5 <= margin 10
        r_c = pymupdf.Rect(30, 0, 40, 10)  # distance to B is 5 <= margin 10

        exp_a = pymupdf.Rect(r_a.x0 - 10, r_a.y0 - 10, r_a.x1 + 10, r_a.y1 + 10)
        self.assertFalse(exp_a.intersects(r_c))  # A and C do not directly intersect

        clusters = cluster_rects([r_a, r_b, r_c], margin=10.0)
        self.assertEqual(len(clusters), 1)
        expected = r_a | r_b | r_c
        self.assertEqual(round(clusters[0].x0, 1), round(expected.x0, 1))
        self.assertEqual(round(clusters[0].x1, 1), round(expected.x1, 1))
        self.assertEqual(round(clusters[0].y0, 1), round(expected.y0, 1))
        self.assertEqual(round(clusters[0].y1, 1), round(expected.y1, 1))

    # ==========================================================================
    # MILESTONE 4: WP4 (OVERLAPPED PRINTING & EXPLANATIONS) TESTS
    # ==========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_worksheet_compile_overlaps_explanation_phase(self, mock_compile, mock_api):
        """WP4: Verify worksheet compile overlaps with Phase 2 explanation generation (elapsed < sum of times)."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            if "DeBai" in html_path:
                time.sleep(1.2)
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        def fake_api(key, user_prompt, system_prompt, **kwargs):
            if "explanations" in system_prompt or "Với mỗi câu hỏi" in user_prompt:
                time.sleep(1.2)
                return {"explanations": {"1": "Giải thích chi tiết câu 1"}}
            return {
                "questions": [{
                    "number": 1, "type": "mcq", "question": "Q1?",
                    "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
                }]
            }

        mock_compile.side_effect = fake_compile
        mock_api.side_effect = fake_api

        with tempfile.TemporaryDirectory() as tmp_out:
            pdf_path = os.path.join(tmp_out, "dummy.pdf")
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
            doc.save(pdf_path)
            doc.close()

            t0 = time.time()
            res = quiz_pipeline.run_pipeline(
                pdf_path, "1", count=1, filename_prefix="overlap_test",
                api_key="mock_key", output_dir=tmp_out
            )
            elapsed = time.time() - t0

        self.assertTrue(res["success"])
        self.assertLess(elapsed, 2.2, f"Elapsed {elapsed:.2f}s should be < 2.2s due to concurrent overlap")

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_explanation_failure_does_not_fail_job(self, mock_compile, mock_api):
        """WP4: Verify that complete Phase 2 API failure does not abort the job and answer PDF still compiles."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        def fake_api(key, user_prompt, system_prompt, **kwargs):
            if "explanations" in system_prompt or "Với mỗi câu hỏi" in user_prompt:
                raise RuntimeError("Phase 2 API Network Outage")
            return {
                "questions": [{
                    "number": 1, "type": "mcq", "question": "Q1?",
                    "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
                }]
            }

        mock_compile.side_effect = fake_compile
        mock_api.side_effect = fake_api

        with tempfile.TemporaryDirectory() as tmp_out:
            pdf_path = os.path.join(tmp_out, "dummy.pdf")
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
            doc.save(pdf_path)
            doc.close()

            res = quiz_pipeline.run_pipeline(
                pdf_path, "1", count=1, filename_prefix="fail_exp_test",
                api_key="mock_key", output_dir=tmp_out
            )

            self.assertTrue(res["success"])
            self.assertTrue(os.path.exists(res["worksheet_pdf"]))
            self.assertTrue(os.path.exists(res["answer_pdf"]))

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_skip_explanation_env_flag(self, mock_compile, mock_api):
        """WP4: Verify that QUIZ_SKIP_EXPLANATION=1 skips Phase 2 explanation generation completely."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        mock_compile.side_effect = fake_compile
        mock_api.return_value = {
            "questions": [{
                "number": 1, "type": "mcq", "question": "Q1?",
                "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
            }]
        }

        with patch.dict(os.environ, {"QUIZ_SKIP_EXPLANATION": "1"}):
            with tempfile.TemporaryDirectory() as tmp_out:
                pdf_path = os.path.join(tmp_out, "dummy.pdf")
                doc = pymupdf.open()
                page = doc.new_page()
                page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
                doc.save(pdf_path)
                doc.close()

                res = quiz_pipeline.run_pipeline(
                    pdf_path, "1", count=1, filename_prefix="skip_exp_test",
                    api_key="mock_key", output_dir=tmp_out
                )

        self.assertTrue(res["success"])
        for call_item in mock_api.call_args_list:
            prompt_arg = call_item[0][1]
            self.assertNotIn("Với mỗi câu hỏi", prompt_arg)

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_answer_key_contains_explanations_when_phase2_succeeds(self, mock_compile, mock_api):
        """WP4: Verify that generated Phase 2 explanations are rendered into Answer Key HTML."""
        import quiz_pipeline

        captured_answer_html = []

        def spy_compile(chrome, html_path, pdf_path):
            if "DapAn" in html_path:
                with open(html_path, "r", encoding="utf-8") as f:
                    captured_answer_html.append(f.read())
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        mock_compile.side_effect = spy_compile

        expl_text = "Natri (Na) là kim loại kiềm thuộc nhóm IA."

        def fake_api(key, user_prompt, system_prompt, **kwargs):
            if "explanations" in system_prompt or "Với mỗi câu hỏi" in user_prompt:
                return {"explanations": {"1": expl_text}}
            return {
                "questions": [{
                    "number": 1, "type": "mcq", "question": "Kim loại nào là kim loại kiềm?",
                    "options": {"A": "Na", "B": "Mg", "C": "Al", "D": "Fe"}, "answer": "A"
                }]
            }

        mock_api.side_effect = fake_api

        with tempfile.TemporaryDirectory() as tmp_out:
            pdf_path = os.path.join(tmp_out, "dummy.pdf")
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
            doc.save(pdf_path)
            doc.close()

            res = quiz_pipeline.run_pipeline(
                pdf_path, "1", count=1, filename_prefix="ans_expl_test",
                api_key="mock_key", output_dir=tmp_out
            )

        self.assertTrue(res["success"])
        self.assertEqual(len(captured_answer_html), 1)
        self.assertIn(expl_text, captured_answer_html[0])
        self.assertIn("<b>Hướng dẫn giải:</b>", captured_answer_html[0])

    # ==========================================================================
    # MILESTONE 5: WP7 (MULTI-TIER CACHE) TESTS
    # ==========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_extract_cache_hit_skips_pymupdf(self, mock_compile, mock_api):
        """WP7: Verify that repeated run with same PDF and page range skips extract_raw_pages."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        mock_compile.side_effect = fake_compile
        mock_api.return_value = {
            "questions": [{
                "number": 1, "type": "mcq", "question": "Q1?",
                "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
            }]
        }

        with tempfile.TemporaryDirectory() as tmp_out:
            pdf_path = os.path.join(tmp_out, "dummy.pdf")
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
            doc.save(pdf_path)
            doc.close()

            with patch("quiz_pipeline.extract_raw_pages", wraps=quiz_pipeline.extract_raw_pages) as spy_extract:
                res1 = quiz_pipeline.run_pipeline(
                    pdf_path, "1", count=1, filename_prefix="cache1",
                    api_key="mock_key", output_dir=tmp_out
                )
                self.assertEqual(spy_extract.call_count, 1)

                res2 = quiz_pipeline.run_pipeline(
                    pdf_path, "1", count=1, filename_prefix="cache2",
                    api_key="mock_key", output_dir=tmp_out
                )
                # Second run must hit extract cache, call_count remains 1
                self.assertEqual(spy_extract.call_count, 1)

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_ai_cache_hit_skips_api_call(self, mock_compile, mock_api):
        """WP7: Verify that second run on same job hits AI cache and makes 0 new API calls."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        mock_compile.side_effect = fake_compile

        def fake_api(key, user_prompt, system_prompt, **kwargs):
            if "explanations" in system_prompt or "Với mỗi câu hỏi" in user_prompt:
                return {"explanations": {"1": "Giải thích 1"}}
            return {
                "questions": [{
                    "number": 1, "type": "mcq", "question": "Q1?",
                    "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
                }]
            }

        mock_api.side_effect = fake_api

        with tempfile.TemporaryDirectory() as tmp_out:
            pdf_path = os.path.join(tmp_out, "dummy.pdf")
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
            doc.save(pdf_path)
            doc.close()

            # Run 1: calls API for Phase 1 and Phase 2
            res1 = quiz_pipeline.run_pipeline(
                pdf_path, "1", count=1, filename_prefix="run1",
                api_key="mock_key", output_dir=tmp_out
            )
            calls_run1 = mock_api.call_count
            self.assertGreater(calls_run1, 0)

            # Run 2: same PDF, same questions -> 0 new API calls
            res2 = quiz_pipeline.run_pipeline(
                pdf_path, "1", count=1, filename_prefix="run2",
                api_key="mock_key", output_dir=tmp_out
            )
            self.assertEqual(mock_api.call_count, calls_run1)

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_prompt_version_bump_invalidates_cache(self, mock_compile, mock_api):
        """WP7: Verify that bumping PROMPT_VERSION invalidates AI cache."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        mock_compile.side_effect = fake_compile
        mock_api.return_value = {
            "questions": [{
                "number": 1, "type": "mcq", "question": "Q1?",
                "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
            }]
        }

        with tempfile.TemporaryDirectory() as tmp_out:
            pdf_path = os.path.join(tmp_out, "dummy.pdf")
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
            doc.save(pdf_path)
            doc.close()

            res1 = quiz_pipeline.run_pipeline(
                pdf_path, "1", count=1, filename_prefix="pv1",
                api_key="mock_key", output_dir=tmp_out
            )
            count1 = mock_api.call_count

            # Bump PROMPT_VERSION
            orig_pv = quiz_pipeline.PROMPT_VERSION
            try:
                quiz_pipeline.PROMPT_VERSION = "v3_bumped"
                res2 = quiz_pipeline.run_pipeline(
                    pdf_path, "1", count=1, filename_prefix="pv2",
                    api_key="mock_key", output_dir=tmp_out
                )
                self.assertGreater(mock_api.call_count, count1)
            finally:
                quiz_pipeline.PROMPT_VERSION = orig_pv

    @patch("quiz_pipeline.call_agnes_api")
    @patch("quiz_pipeline.compile_pdf")
    def test_cache_disabled_env_bypasses(self, mock_compile, mock_api):
        """WP7: Verify that QUIZ_CACHE_DISABLED=1 bypasses caching on both runs."""
        import quiz_pipeline

        def fake_compile(chrome, html_path, pdf_path):
            doc = pymupdf.open()
            doc.new_page()
            doc.save(pdf_path)
            doc.close()

        mock_compile.side_effect = fake_compile
        mock_api.return_value = {
            "questions": [{
                "number": 1, "type": "mcq", "question": "Q1?",
                "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"
            }]
        }

        with patch.dict(os.environ, {"QUIZ_CACHE_DISABLED": "1"}):
            with tempfile.TemporaryDirectory() as tmp_out:
                pdf_path = os.path.join(tmp_out, "dummy.pdf")
                doc = pymupdf.open()
                page = doc.new_page()
                page.insert_text((50, 50), SAMPLE_EXAM_TEXT)
                doc.save(pdf_path)
                doc.close()

                res1 = quiz_pipeline.run_pipeline(
                    pdf_path, "1", count=1, filename_prefix="dis1",
                    api_key="mock_key", output_dir=tmp_out
                )
                count1 = mock_api.call_count

                res2 = quiz_pipeline.run_pipeline(
                    pdf_path, "1", count=1, filename_prefix="dis2",
                    api_key="mock_key", output_dir=tmp_out
                )
                self.assertGreater(mock_api.call_count, count1)

    def test_corrupt_cache_entry_treated_as_miss(self):
        """WP7: Verify corrupt non-JSON cache file returns None without crashing."""
        import quiz_cache
        corrupt_key = "corrupt_test_entry"
        c_root = quiz_cache.cache_root()
        corrupt_path = os.path.join(c_root, f"{corrupt_key}.json")
        with open(corrupt_path, "w", encoding="utf-8") as f:
            f.write("{this is not valid json!#$%^&*")

        res = quiz_cache.read_json(corrupt_key)
        self.assertIsNone(res)

    def test_cached_assets_rebuild_data_uri(self):
        """WP7: Verify cache hit rebuilds valid data:image/png;base64,... URI."""
        import quiz_cache

        with tempfile.TemporaryDirectory() as tmp_dir:
            src_png = os.path.join(tmp_dir, "test_fig.png")
            # Minimal 1x1 PNG bytes
            png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
            with open(src_png, "wb") as f:
                f.write(png_bytes)

            pdf_dummy = os.path.join(tmp_dir, "test.pdf")
            with open(pdf_dummy, "wb") as f:
                f.write(b"%PDF-1.4 mock")

            extracted = [{
                "id": "asset_1",
                "name": "test_fig.png",
                "page": 1,
                "rect": [10.0, 20.0, 100.0, 200.0],
                "data_uri": "mock",
                "file_path": src_png,
                "text_inside": ""
            }]

            quiz_cache.set_extract_cache(
                pdf_dummy, "1", "raw text", [1], extracted, {"test_fig.png": 1}, [1]
            )

            out_assets_dir = os.path.join(tmp_dir, "rebuilt_assets")
            hit = quiz_cache.get_extract_cache(pdf_dummy, "1", out_assets_dir)
            self.assertIsNotNone(hit)
            raw_text, pages, assets, asset_map, q_nums = hit
            self.assertEqual(len(assets), 1)
            self.assertTrue(assets[0]["data_uri"].startswith("data:image/png;base64,"))
            self.assertTrue(os.path.isfile(assets[0]["file_path"]))


if __name__ == "__main__":
    unittest.main()

