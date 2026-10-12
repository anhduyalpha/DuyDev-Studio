"""
Adversarial Empirical Challenge Test Suite for Milestone M1 (Instance 2)
Focuses specifically on:
1. Cross-page banner inheritance (PHẦN III at bottom of page N, Câu 2 at top of page N+1).
2. Full-page query candidate preservation on multi-section pages ("toàn bộ trang 41" on Gốc.pdf).
3. False-positive option rejection in chemical and technical text (e.g. solitary "C.").
"""

import os
import shutil
import tempfile
import unittest

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.perception.models import (
    PageRepresentation,
    QuestionCandidate,
    TextBlock,
    TextLine,
    TextSpan,
)
from engines.quiz.perception.candidates import (
    detect_candidates_from_page,
    extract_statement_labels,
    OPTION_PATTERN,
)
from engines.quiz.perception.extractor import (
    extract_page_representation,
    extract_document_representations,
)
from engines.quiz.recognition.inspect_cli import (
    inspect_page_ground_truth,
    _split_candidates_by_section,
)
from engines.quiz.recognition.question_index import QuestionIndexService


class TestAdversarialM1Instance2(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="adv_test_m1_inst2_")
        self.goc_pdf = os.path.abspath(".tmp/Diff check/Gốc.pdf")
        self.sample_pdf = os.path.abspath(".tmp/sample.pdf")

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    # =========================================================================
    # CHALLENGE 1: Cross-Page Banner Inheritance
    # =========================================================================

    def _setup_page_with_font(self, doc: fitz.Document, width: float = 595, height: float = 842):
        font_path = "C:/Windows/Fonts/times.ttf" if os.path.exists("C:/Windows/Fonts/times.ttf") else None
        page = doc.new_page(width=width, height=height)
        if font_path:
            page.insert_font(fontname="times", fontfile=font_path)
            return page, "times"
        return page, None

    def test_challenge_1_1_banner_part_iii_at_bottom_of_page_n_inherits_to_page_n_plus_1(self):
        """
        Adversarial Test 1.1:
        Construct a multi-page PDF where:
        - Page 1 has Part I (MCQ) at top, and banner PHẦN III at the bottom with Câu 1.
        - Page 2 has NO banner, begins at the top with Câu 2 (no options A-D, no statements a-d).
        Verify that inspecting Page 2 correctly inherits part_iii_short and does NOT misclassify as part_i_mcq.
        """
        doc = fitz.open()

        # Page 1 (index 0): Part I at top, Part III banner at bottom
        p1, font1 = self._setup_page_with_font(doc)
        kw1 = {"fontname": font1} if font1 else {}
        p1.insert_text(fitz.Point(50, 40), "PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", fontsize=11, **kw1)
        for i in range(1, 4):
            y = 70 + (i - 1) * 60
            p1.insert_text(fitz.Point(50, y), f"Câu {i}: Nội dung câu hỏi trắc nghiệm {i}?", fontsize=10, **kw1)
            p1.insert_text(fitz.Point(50, y + 20), "A. 1.   B. 2.   C. 3.   D. 4.", fontsize=9, **kw1)

        # Banner PHẦN III placed at the bottom of Page 1 (y = 650)
        p1.insert_text(fitz.Point(50, 650), "PHẦN III. CÂU TRẮC NGHIỆM YÊU CẦU TRẢ LỜI NGẮN", fontsize=11, **kw1)
        p1.insert_text(fitz.Point(50, 700), "Câu 1: Cho hỗn hợp X phản ứng với Y. Tính khối lượng m theo gam?", fontsize=10, **kw1)

        # Page 2 (index 1): NO BANNER, starts with Câu 2
        p2, font2 = self._setup_page_with_font(doc)
        kw2 = {"fontname": font2} if font2 else {}
        p2.insert_text(fitz.Point(50, 50), "Câu 2: Đốt cháy hoàn toàn 0,1 mol chất Z cần V lít O2. Tính V ở đktc?", fontsize=10, **kw2)
        p2.insert_text(fitz.Point(50, 150), "Câu 3: Tính nhiệt lượng tỏa ra khi đốt cháy 1 mol butane theo kJ?", fontsize=10, **kw2)

        pdf_path = os.path.join(self.temp_dir, "bottom_banner_test.pdf")
        doc.save(pdf_path)
        doc.close()

        # 1. Verify single-page inspection of Page 2 with backward scan inheritance
        res_p2 = inspect_page_ground_truth(pdf_path, pages_arg="2")
        self.assertTrue(res_p2["success"])
        self.assertFalse(res_p2["has_part_i"], "Page 2 must NOT have Part I")
        self.assertFalse(res_p2["has_part_ii"], "Page 2 must NOT have Part II")
        self.assertTrue(res_p2["has_part_iii"], "Page 2 MUST inherit Part III from bottom of Page 1")
        self.assertEqual(res_p2["part_iii_start"], 2)
        self.assertEqual(res_p2["part_iii_count"], 2)
        self.assertEqual(res_p2["detected_questions"], [2, 3])

        # 2. Verify extract_document_representations forwards state across page sequence
        doc_reps = extract_document_representations(pdf_path)
        self.assertEqual(len(doc_reps), 2)

        rep_p1 = doc_reps[0]
        rep_p2 = doc_reps[1]

        # Check Page 1 candidates: 3 Part I + 1 Part III
        self.assertEqual(len(rep_p1.candidates), 4)
        self.assertEqual(rep_p1.candidates[0].section_type, "part_i_mcq")
        self.assertEqual(rep_p1.candidates[1].section_type, "part_i_mcq")
        self.assertEqual(rep_p1.candidates[2].section_type, "part_i_mcq")
        self.assertEqual(rep_p1.candidates[3].candidate_number, 1)
        self.assertEqual(rep_p1.candidates[3].section_type, "part_iii_short")

        # Check Page 2 candidates: both MUST be part_iii_short!
        self.assertEqual(len(rep_p2.candidates), 2)
        self.assertEqual(rep_p2.candidates[0].candidate_number, 2)
        self.assertEqual(
            rep_p2.candidates[0].section_type, "part_iii_short",
            f"Page 2 Câu 2 must be part_iii_short, got {rep_p2.candidates[0].section_type}"
        )
        self.assertEqual(rep_p2.candidates[1].candidate_number, 3)
        self.assertEqual(
            rep_p2.candidates[1].section_type, "part_iii_short",
            f"Page 2 Câu 3 must be part_iii_short, got {rep_p2.candidates[1].section_type}"
        )

        # 3. Verify multi-page inspect across pages 1-2
        res_both = inspect_page_ground_truth(pdf_path, pages_arg="1-2")
        self.assertTrue(res_both["success"])
        self.assertTrue(res_both["has_part_i"])
        self.assertEqual(res_both["part_i_count"], 3)
        self.assertTrue(res_both["has_part_iii"])
        self.assertEqual(res_both["part_iii_count"], 3)
        self.assertEqual(res_both["part_iii_start"], 1)

    def test_challenge_1_2_bottom_banner_without_questions_on_page_n_inherits_to_page_n_plus_1(self):
        """
        Adversarial Test 1.2:
        Edge case: Banner PHẦN III is at the very bottom of Page 1 (e.g. section transition),
        but Câu 1 begins immediately at the top of Page 2 (no questions on Page 1 under Part III).
        VERIFY: Page 2 correctly inherits part_iii_short.
        """
        doc = fitz.open()

        # Page 1: Part I questions 1..3, then banner PHẦN III at bottom (no Part III questions on page 1)
        p1, font1 = self._setup_page_with_font(doc)
        kw1 = {"fontname": font1} if font1 else {}
        p1.insert_text(fitz.Point(50, 40), "PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", fontsize=11, **kw1)
        for i in range(1, 4):
            y = 70 + (i - 1) * 60
            p1.insert_text(fitz.Point(50, y), f"Câu {i}: Câu hỏi MCQ {i}?", fontsize=10, **kw1)
            p1.insert_text(fitz.Point(50, y + 20), "A. 1.   B. 2.   C. 3.   D. 4.", fontsize=9, **kw1)
        # Banner at bottom
        p1.insert_text(fitz.Point(50, 750), "PHẦN III. CÂU TRẮC NGHIỆM YÊU CẦU TRẢ LỜI NGẮN", fontsize=11, **kw1)

        # Page 2: Starts with Câu 1 of Part III (no banner on page 2)
        p2, font2 = self._setup_page_with_font(doc)
        kw2 = {"fontname": font2} if font2 else {}
        p2.insert_text(fitz.Point(50, 50), "Câu 1: Đốt cháy m gam kim loại trong O2. Giá trị của m là bao nhiêu?", fontsize=10, **kw2)
        p2.insert_text(fitz.Point(50, 150), "Câu 2: Tính thể tích khí thu được?", fontsize=10, **kw2)

        pdf_path = os.path.join(self.temp_dir, "bottom_banner_no_q_test.pdf")
        doc.save(pdf_path)
        doc.close()

        res_p2 = inspect_page_ground_truth(pdf_path, pages_arg="2")
        self.assertTrue(res_p2["success"])
        self.assertFalse(res_p2["has_part_i"])
        self.assertTrue(res_p2["has_part_iii"], "Page 2 must inherit Part III from trailing banner on Page 1")
        self.assertEqual(res_p2["detected_questions"], [1, 2])
        self.assertEqual(res_p2["part_iii_start"], 1)
        self.assertEqual(res_p2["part_iii_count"], 2)

    # =========================================================================
    # CHALLENGE 2: Full-Page Query Candidate Preservation
    # =========================================================================

    def test_challenge_2_1_goc_pdf_page_41_all_questions_preservation(self):
        """
        Adversarial Test 2.1:
        Run inspect_cli.py with --query "toàn bộ trang 41" against .tmp/Diff check/Gốc.pdf.
        Verify that detected_questions contains all 5 questions ([47, 48, 49, 50, 1]),
        reports both has_part_i: true and has_part_ii: true, count: 5.
        """
        if not os.path.isfile(self.goc_pdf):
            self.skipTest(f"Gốc.pdf not found at {self.goc_pdf}")

        res = inspect_page_ground_truth(self.goc_pdf, query_arg="toàn bộ trang 41")
        self.assertTrue(res["success"], f"Failed inspection: {res.get('error')}")
        self.assertEqual(res["pages"], "41")
        self.assertEqual(res["start"], 47)
        self.assertEqual(res["end"], 50)
        self.assertEqual(res["count"], 5, f"Expected count 5, got {res.get('count')}")
        self.assertEqual(
            res["detected_questions"], [47, 48, 49, 50, 1],
            f"Expected all 5 questions [47, 48, 49, 50, 1], got {res.get('detected_questions')}"
        )
        self.assertTrue(res["has_part_i"], "Must report has_part_i: true")
        self.assertTrue(res["has_part_ii"], "Must report has_part_ii: true")
        self.assertFalse(res["has_part_iii"], "Must report has_part_iii: false on Page 41")
        self.assertEqual(res["part_i_count"], 4)
        self.assertEqual(res["part_ii_start"], 1)
        self.assertEqual(res["part_ii_count"], 1)
        self.assertEqual(res["section_filter"], "all")
        self.assertEqual(res["parity_filter"], "all")

    def test_challenge_2_2_goc_pdf_page_41_queries_parity_and_section_filtering(self):
        """
        Adversarial Test 2.2:
        Stress-test query variations on Page 41 of Gốc.pdf:
        - "các câu lẻ trang 41": [47, 49]
        - "các câu chẵn trang 41": [48, 50]
        - "phần 1 trang 41": [47, 48, 49, 50]
        - "phần 2 trang 41": [1]
        """
        if not os.path.isfile(self.goc_pdf):
            self.skipTest(f"Gốc.pdf not found at {self.goc_pdf}")

        # Odd questions
        res_odd = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu lẻ trang 41")
        self.assertTrue(res_odd["success"])
        self.assertEqual(res_odd["parity_filter"], "odd")
        self.assertEqual(res_odd["detected_questions"], [47, 49])
        self.assertEqual(res_odd["count"], 2)

        # Even questions
        res_even = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu chẵn trang 41")
        self.assertTrue(res_even["success"])
        self.assertEqual(res_even["parity_filter"], "even")
        self.assertEqual(res_even["detected_questions"], [48, 50])
        self.assertEqual(res_even["count"], 2)

        # Part 1 only
        res_p1 = inspect_page_ground_truth(self.goc_pdf, query_arg="phần 1 trang 41")
        self.assertTrue(res_p1["success"])
        self.assertEqual(res_p1["section_filter"], "part_i")
        self.assertEqual(res_p1["detected_questions"], [47, 48, 49, 50])
        self.assertEqual(res_p1["count"], 4)

        # Part 2 only
        res_p2 = inspect_page_ground_truth(self.goc_pdf, query_arg="phần 2 trang 41")
        self.assertTrue(res_p2["success"])
        self.assertEqual(res_p2["section_filter"], "part_ii")
        self.assertEqual(res_p2["detected_questions"], [1])
        self.assertEqual(res_p2["count"], 1)

    # =========================================================================
    # CHALLENGE 3: False-Positive Option Rejection
    # =========================================================================

    def test_challenge_3_1_solitary_chemical_carbon_c_rejected(self):
        """
        Adversarial Test 3.1:
        Chemical text containing solitary 'C.' (e.g. 'nguyên tử C. Cho 10g...').
        VERIFY: Not falsely extracted as option C.
        """
        b = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 200.0),
            lines=[],
            text=(
                "PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN\n"
                "Câu 1: Cho m gam nguyên tử C. Cho 10g dung dịch acid phản ứng vừa đủ. "
                "Giá trị của m là bao nhiêu?"
            )
        )
        cands = detect_candidates_from_page([b])
        self.assertEqual(len(cands), 1)
        c = cands[0]
        self.assertEqual(c.candidate_number, 1)
        self.assertEqual(c.options_detected, [], "Solitary 'C.' in chemistry text must NOT be detected as option C")
        self.assertEqual(c.section_type, "part_iii_short", "Must remain part_iii_short, not part_i_mcq")

    def test_challenge_3_2_solitary_c_in_raw_text_enrichment(self):
        """
        Adversarial Test 3.2:
        Verify raw_text enrichment pass also rejects solitary 'C.' and does not poison options.
        """
        b = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 200.0),
            lines=[],
            text="Câu 5: Trong phân tử hợp chất hữu cơ X có chứa nguyên tử C. Cho 15 gam X tác dụng với dung dịch AgNO3/NH3."
        )
        raw_text = b.text
        cands = detect_candidates_from_page([b], raw_text=raw_text)
        self.assertEqual(len(cands), 1)
        self.assertEqual(cands[0].options_detected, [], "Raw text enrichment must also purge solitary 'C.'")

    def test_challenge_3_3_solitary_vitamin_tokens_b_c_d_rejected(self):
        """
        Adversarial Test 3.3:
        Test other single non-A tokens in biological/chemical contexts (e.g. 'Vitamin B.', 'Vitamin D.').
        VERIFY: Purged as solitary non-A tokens.
        """
        b_vit_b = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 200.0),
            lines=[],
            text="Câu 1: Nguồn cung cấp vitamin B. Có nhiều trong cám gạo và ngũ cốc nguyên hạt. Trả lời ngắn giá trị nhu cầu hàng ngày (mg):"
        )
        cands_b = detect_candidates_from_page([b_vit_b])
        self.assertEqual(len(cands_b), 1)
        self.assertEqual(cands_b[0].options_detected, [], "Solitary 'B.' must be rejected")

        b_vit_d = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 200.0),
            lines=[],
            text="Câu 2: Cơ thể tự tổng hợp vitamin D. Khi tiếp xúc với ánh nắng mặt trời buổi sáng sớm."
        )
        cands_d = detect_candidates_from_page([b_vit_d])
        self.assertEqual(len(cands_d), 1)
        self.assertEqual(cands_d[0].options_detected, [], "Solitary 'D.' must be rejected")

    def test_challenge_3_4_genuine_mcq_with_chemical_carbon_still_detects_all_four_options(self):
        """
        Adversarial Test 3.4:
        A genuine MCQ question with chemical text mentioning 'nguyên tử C.' in the stem,
        followed by genuine choices A. B. C. D. at the end.
        VERIFY: Correctly detects all 4 options ['A', 'B', 'C', 'D'] and classifies as part_i_mcq.
        """
        b = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 300.0),
            lines=[],
            text=(
                "Câu 12: Đốt cháy hoàn toàn 1,2 gam nguyên tử C. Cho toàn bộ khí CO2 sinh ra vào dung dịch Ca(OH)2 dư thu được m gam kết tủa. Giá trị của m là\n"
                "A. 10.   B. 20.   C. 15.   D. 12."
            )
        )
        cands = detect_candidates_from_page([b])
        self.assertEqual(len(cands), 1)
        c = cands[0]
        self.assertEqual(c.candidate_number, 12)
        self.assertEqual(c.options_detected, ["A", "B", "C", "D"])
        self.assertEqual(c.section_type, "part_i_mcq")


if __name__ == "__main__":
    unittest.main()
