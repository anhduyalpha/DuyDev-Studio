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
    generate_answer_key_html
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

    def test_html_generation_multi_format(self):
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
                "type": "true_false_group",
                "question": "Khi nói về kim loại kiềm, các phát biểu sau đúng hay sai?",
                "statements": {
                    "a": {"text": "Đều có mạng tinh thể lập phương tâm khối.", "is_correct": True},
                    "b": {"text": "Nhiệt độ nóng chảy tăng dần từ Li đến Cs.", "is_correct": False},
                    "c": {"text": "Đều có tính khử mạnh.", "is_correct": True},
                    "d": {"text": "Phản ứng mãnh liệt với nước.", "is_correct": True}
                },
                "answer": "a-Đ, b-S, c-Đ, d-Đ",
                "explanation": "Nhiệt độ nóng chảy giảm dần từ Li đến Cs."
            },
            {
                "number": 3,
                "type": "short_answer",
                "question": "Tính khối lượng mol phân tử (g/mol) của este no đơn chức mạch hở chứa 4 nguyên tử cacbon.",
                "answer": "88",
                "explanation": "Công thức este là C4H8O2, M = 88."
            }
        ]

        ws_html = generate_worksheet_html("ĐỀ KIỂM TRA", "HÓA HỌC 12", questions)
        self.assertIn("PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", ws_html)
        self.assertIn("PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG / SAI", ws_html)
        self.assertIn("PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN", ws_html)
        self.assertIn("katex", ws_html)
        self.assertIn("tf-table", ws_html)
        self.assertIn("sa-box", ws_html)

        ans_html = generate_answer_key_html("ĐỀ KIỂM TRA", "HÓA HỌC 12", questions)
        self.assertIn("I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", ans_html)
        self.assertIn("II. BẢNG ĐÁP ÁN TRẮC NGHIỆM ĐÚNG / SAI", ans_html)
        self.assertIn("III. BẢNG ĐÁP ÁN TRẢ LỜI NGẮN", ans_html)

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



if __name__ == "__main__":
    unittest.main()
