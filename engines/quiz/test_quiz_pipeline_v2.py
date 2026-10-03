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
import pymupdf

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


class TestQuizPipelineV2(unittest.TestCase):

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


if __name__ == "__main__":
    unittest.main()
