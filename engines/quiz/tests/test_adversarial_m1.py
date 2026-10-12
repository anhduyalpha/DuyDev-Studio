"""
Adversarial Empirical Challenge Test Suite for Milestone M1
Tests candidate deduplication across multiple parts on a single page,
3-tier classification (statement-counting vs True/False vs Short Answer),
and non-contiguous discrete question subset validation in question_index.
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
from engines.quiz.common.errors import QuizEngineError, ErrorCode


class TestAdversarialM1PerceptionAndClassification(unittest.TestCase):
    """
    Empirical adversarial challenge suite for Worker M1.
    """

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="adv_test_m1_")
        self.index_service = QuestionIndexService()

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    # =========================================================================
    # CHALLENGE 1: Candidate Deduplication on a Single Page
    # =========================================================================

    def test_challenge_1_1_dedup_three_parts_same_page_15_questions(self):
        """
        Adversarial Challenge 1.1:
        A single page containing Part I (Q1..5), Part II (Q1..4), and Part III (Q1..6).
        Total: 15 questions sharing the same page with overlapping question numbers.
        VERIFY: All 15 questions are detected and not swallowed by candidate deduplication.
        """
        # Block 0: Part I Header & Q1..5 (MCQ 4 options A, B, C, D)
        b_part_i = TextBlock(
            block_index=0,
            bbox=(50.0, 50.0, 550.0, 300.0),
            lines=[],
            text=(
                "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn\n"
                "Thí sinh trả lời từ câu 1 đến câu 5. Mỗi câu hỏi chỉ chọn một phương án.\n\n"
                "Câu 1: Kim loại nào sau đây dẫn điện tốt nhất?\n"
                "A. Al.   B. Fe.   C. Ag.   D. Cu.\n\n"
                "Câu 2: Dung dịch nào sau đây làm quỳ tím chuyển màu đỏ?\n"
                "A. NaOH. B. HCl.  C. NaCl. D. Ba(OH)2.\n\n"
                "Câu 3: Chất nào sau đây là chất điện li mạnh?\n"
                "A. CH3COOH. B. H2O. C. NaCl. D. C2H5OH.\n\n"
                "Câu 4: Kim loại Fe tác dụng với dung dịch nào sau đây sinh ra H2?\n"
                "A. HCl.  B. CuCl2. C. AgNO3. D. FeCl3.\n\n"
                "Câu 5: Công thức phân tử của ethanol là\n"
                "A. CH4.  B. C2H6. C. C2H5OH. D. CH3OH.\n"
            )
        )

        # Block 1: Part II Header & Q1..4 (True/False sub-statements a, b, c, d)
        b_part_ii = TextBlock(
            block_index=1,
            bbox=(50.0, 320.0, 550.0, 550.0),
            lines=[],
            text=(
                "PHẦN II. Câu trắc nghiệm đúng sai\n"
                "Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) chọn đúng hoặc sai.\n\n"
                "Câu 1: Cho các nhận định sau về carbohydrate:\n"
                "a) Glucose là monosaccharide.\n"
                "b) Fructose là đồng phân của glucose.\n"
                "c) Saccharose có phản ứng tráng bạc.\n"
                "d) Cellulose có cấu trúc mạch phân nhánh.\n\n"
                "Câu 2: Cho các nhận định sau về este và lipid:\n"
                "a) Triolein là chất béo không no ở thể lỏng.\n"
                "b) Tristearin có công thức (C17H35COO)3C3H5.\n"
                "c) Xà phòng hóa chất béo luôn thu được glycerol.\n"
                "d) Dầu thực vật bị ôi thiu do nối đôi bị oxi hóa chậm.\n\n"
                "Câu 3: Cho các phát biểu sau về amino acid:\n"
                "a) Glycine là amino acid đơn giản nhất.\n"
                "b) Dung dịch lysine làm quỳ tím hóa xanh.\n"
                "c) Axit glutamic có 2 nhóm carboxyl.\n"
                "d) Amino acid là hợp chất hữu cơ đa chức.\n\n"
                "Câu 4: Cho các phát biểu sau về polymer:\n"
                "a) Polyethylene được điều chế bằng phản ứng trùng hợp.\n"
                "b) Tơ tằm là tơ thiên nhiên.\n"
                "c) Cao su buna-S có chứa lưu huỳnh.\n"
                "d) Nilon-6,6 là polyamide.\n"
            )
        )

        # Block 2: Part III Header & Q1..6 (Short Answer calculation / fill-in)
        b_part_iii = TextBlock(
            block_index=2,
            bbox=(50.0, 570.0, 550.0, 800.0),
            lines=[],
            text=(
                "PHẦN III. Câu trắc nghiệm yêu cầu trả lời ngắn\n"
                "Thí sinh trả lời từ câu 1 đến câu 6.\n\n"
                "Câu 1: Đốt cháy hoàn toàn 6,0 gam hỗn hợp Mg và Fe trong oxi dư thu được 9,2 gam oxit. Số mol O2 đã phản ứng là bao nhiêu mol?\n\n"
                "Câu 2: Cho 10 gam CaCO3 phản ứng hết với dung dịch HCl dư. Thể tích khí CO2 (đktc) thu được là bao nhiêu lít?\n\n"
                "Câu 3: Khối lượng mol phân tử của glucozơ bằng bao nhiêu gam/mol?\n\n"
                "Câu 4: Cho 5,4 gam Al tác dụng hết với dung dịch NaOH dư. Số mol H2 giải phóng là bao nhiêu mol?\n\n"
                "Câu 5: Số đồng phân este đơn chức, no có công thức C3H6O2 là bao nhiêu?\n\n"
                "Câu 6: Cho 0,1 mol amino acid X phản ứng vừa đủ với 100ml dung dịch HCl 1M. Số nhóm amino trong X là bao nhiêu?\n"
            )
        )

        candidates = detect_candidates_from_page([b_part_i, b_part_ii, b_part_iii])

        # 1. Total candidate count check
        self.assertEqual(
            len(candidates), 15,
            f"Expected exactly 15 candidates across 3 parts on same page, got {len(candidates)}. Candidates: {[(c.candidate_number, c.section_type) for c in candidates]}"
        )

        # 2. Check Part I (5 questions: Q1..5)
        part_i = [c for c in candidates if c.section_type == "part_i_mcq"]
        self.assertEqual(len(part_i), 5, f"Expected 5 Part I questions, got {len(part_i)}")
        self.assertEqual([c.candidate_number for c in part_i], [1, 2, 3, 4, 5])
        for c in part_i:
            self.assertEqual(c.options_detected, ["A", "B", "C", "D"])

        # 3. Check Part II (4 questions: Q1..4)
        part_ii = [c for c in candidates if c.section_type == "part_ii_tf"]
        self.assertEqual(len(part_ii), 4, f"Expected 4 Part II questions, got {len(part_ii)}")
        self.assertEqual([c.candidate_number for c in part_ii], [1, 2, 3, 4])
        for c in part_ii:
            self.assertEqual(c.statements_detected, ["a", "b", "c", "d"])
            self.assertEqual(c.options_detected, [])

        # 4. Check Part III (6 questions: Q1..6)
        part_iii = [c for c in candidates if c.section_type == "part_iii_short"]
        self.assertEqual(len(part_iii), 6, f"Expected 6 Part III questions, got {len(part_iii)}")
        self.assertEqual([c.candidate_number for c in part_iii], [1, 2, 3, 4, 5, 6])
        for c in part_iii:
            self.assertEqual(c.options_detected, [])
            self.assertEqual(c.statements_detected, [])

    def test_challenge_1_2_real_pdf_document_extraction_15_questions(self):
        """
        Adversarial Challenge 1.2:
        Builds a real vector PDF document via PyMuPDF with all 15 questions on a single page
        and executes extract_page_representation to test full PyMuPDF block parsing pipeline.
        """
        doc = fitz.open()
        page = doc.new_page(width=595, height=1200)

        page.insert_text(fitz.Point(50, 40), "PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", fontsize=11)
        for i in range(1, 6):
            y_base = 60 + (i - 1) * 50
            page.insert_text(fitz.Point(50, y_base), f"Câu {i}: Nội dung câu hỏi trắc nghiệm {i}?", fontsize=10)
            page.insert_text(fitz.Point(50, y_base + 15), "A. Phương án 1.   B. Phương án 2.   C. Phương án 3.   D. Phương án 4.", fontsize=9)

        page.insert_text(fitz.Point(50, 330), "PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI", fontsize=11)
        for i in range(1, 5):
            y_base = 350 + (i - 1) * 75
            page.insert_text(fitz.Point(50, y_base), f"Câu {i}: Cho các mệnh đề sau về vấn đề {i}:", fontsize=10)
            page.insert_text(fitz.Point(50, y_base + 15), "a) Mệnh đề thứ nhất.", fontsize=9)
            page.insert_text(fitz.Point(50, y_base + 28), "b) Mệnh đề thứ hai.", fontsize=9)
            page.insert_text(fitz.Point(50, y_base + 41), "c) Mệnh đề thứ ba.", fontsize=9)
            page.insert_text(fitz.Point(50, y_base + 54), "d) Mệnh đề thứ tư.", fontsize=9)

        page.insert_text(fitz.Point(50, 680), "PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN", fontsize=11)
        for i in range(1, 7):
            y_base = 700 + (i - 1) * 45
            page.insert_text(fitz.Point(50, y_base), f"Câu {i}: Tính giá trị đại lượng X trong thí nghiệm {i}?", fontsize=10)

        pdf_path = os.path.join(self.temp_dir, "three_parts_single_page.pdf")
        doc.save(pdf_path)
        doc.close()

        rep = extract_page_representation(pdf_path, 0)
        self.assertEqual(len(rep.candidates), 15, f"Expected 15 candidates from PDF, got {len(rep.candidates)}")

        # Verify inspect_cli ground truth split on this real PDF
        p_i, p_ii, p_iii = _split_candidates_by_section(rep)
        self.assertEqual(len(p_i), 5, f"Expected 5 Part I candidates, got {len(p_i)}")
        self.assertEqual(len(p_ii), 4, f"Expected 4 Part II candidates, got {len(p_ii)}")
        self.assertEqual(len(p_iii), 6, f"Expected 6 Part III candidates, got {len(p_iii)}")

    # =========================================================================
    # CHALLENGE 2: 3-Tier Classification Stress Testing
    # =========================================================================

    def test_challenge_2_1_statement_counting_mcq_classified_as_part_i(self):
        """
        Adversarial Challenge 2.1:
        Statement-counting MCQ with a), b), c), d) in stem ending with A. 1 B. 2 C. 3 D. 4
        MUST classify as PART_I_MCQ, NOT Part II True/False.
        """
        block = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 250.0),
            lines=[],
            text=(
                "Câu 49: Cho các phát biểu sau đây:\n"
                "a) Các triglyceride đều có phản ứng cộng hydrogen.\n"
                "b) Chỉ có các chất béo ở thể lỏng mới có phản ứng cộng hydrogen.\n"
                "c) Các triglyceride có gốc acid béo no thường là chất rắn ở điều kiện thường.\n"
                "d) Có thể dùng nước để phân biệt ester với alcohol hoặc với acid tạo nên chính ester đó.\n"
                "Số phát biểu đúng là\n"
                "A. 1.    B. 2.    C. 3.    D. 4."
            )
        )
        cands = detect_candidates_from_page([block])
        self.assertEqual(len(cands), 1)
        c = cands[0]
        self.assertEqual(c.candidate_number, 49)
        self.assertEqual(c.section_type, "part_i_mcq", "Statement counting question MUST be classified as part_i_mcq")
        self.assertEqual(c.options_detected, ["A", "B", "C", "D"])
        self.assertEqual(c.statements_detected, ["a", "b", "c", "d"])

        # Also verify through _split_candidates_by_section
        rep = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            blocks=[block], candidates=cands
        )
        p_i, p_ii, p_iii = _split_candidates_by_section(rep)
        self.assertEqual(len(p_i), 1, "Must be placed in Part I list")
        self.assertEqual(len(p_ii), 0, "Must NOT be placed in Part II list")
        self.assertEqual(len(p_iii), 0, "Must NOT be placed in Part III list")

    def test_challenge_2_2_true_false_without_options_classified_as_part_ii(self):
        """
        Adversarial Challenge 2.2:
        True/False with a), b), c), d) without options A-D
        MUST classify as PART_II_TF, NOT Part I or Part III.
        """
        block = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 250.0),
            lines=[],
            text=(
                "Câu 1: Cho các nhận định sau về ester:\n"
                "a) Ester có nhiệt độ sôi thấp hơn alcohol có cùng khối lượng mol.\n"
                "b) Phản ứng xà phòng hóa chất béo là phản ứng thuận nghịch.\n"
                "c) Thủy phân vinyl acetate thu được aldehyde acetic.\n"
                "d) Tristearin là chất rắn ở nhiệt độ thường."
            )
        )
        cands = detect_candidates_from_page([block])
        self.assertEqual(len(cands), 1)
        c = cands[0]
        self.assertEqual(c.candidate_number, 1)
        self.assertEqual(c.section_type, "part_ii_tf", "Sub-statements without A-D options MUST be part_ii_tf")
        self.assertEqual(c.statements_detected, ["a", "b", "c", "d"])
        self.assertEqual(c.options_detected, [])

        rep = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            blocks=[block], candidates=cands
        )
        p_i, p_ii, p_iii = _split_candidates_by_section(rep)
        self.assertEqual(len(p_i), 0)
        self.assertEqual(len(p_ii), 1, "Must be placed in Part II list")
        self.assertEqual(len(p_iii), 0)

    def test_challenge_2_3_short_answer_without_options_or_statements(self):
        """
        Adversarial Challenge 2.3:
        Short answer question with NO options and NO sub-statements under PHẦN III banner
        MUST classify as PART_III_SHORT.
        """
        block = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 200.0),
            lines=[],
            text=(
                "PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN\n"
                "Câu 1: Đốt cháy hoàn toàn 4,4 gam este X đơn chức thu được 4,48 lít CO2 (đktc) và 3,6 gam H2O. Khối lượng mol của este X là bao nhiêu gam/mol?"
            )
        )
        cands = detect_candidates_from_page([block])
        self.assertEqual(len(cands), 1)
        c = cands[0]
        self.assertEqual(c.candidate_number, 1)
        self.assertEqual(c.section_type, "part_iii_short", "Question under Part III banner MUST be part_iii_short")
        self.assertEqual(c.options_detected, [])
        self.assertEqual(c.statements_detected, [])

        rep = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            blocks=[block], candidates=cands
        )
        p_i, p_ii, p_iii = _split_candidates_by_section(rep)
        self.assertEqual(len(p_i), 0)
        self.assertEqual(len(p_ii), 0)
        self.assertEqual(len(p_iii), 1, "Must be placed in Part III list")

    def test_challenge_2_4_adversarial_spurious_options_chemical_formula(self):
        """
        Adversarial Challenge 2.4:
        Solitary option-like tokens in chemical formulas or text (e.g. "C." in carbon notation)
        MUST be filtered as false positives so True/False or Short Answer questions are not poisoned.
        """
        block_tf_with_carbon = TextBlock(
            block_index=0,
            bbox=(50.0, 100.0, 500.0, 250.0),
            lines=[],
            text=(
                "PHẦN II\n"
                "Câu 2: Cho các nhận định về nguyên tố hóa học:\n"
                "a) Kim loại Fe có tính dẫn điện tốt.\n"
                "b) Nguyên tố C. là phi kim có nhiều dạng thù hình.\n"
                "c) Khí O2 duy trì sự sống và sự cháy.\n"
                "d) Khí N2 trơ ở nhiệt độ thường."
            )
        )
        cands = detect_candidates_from_page([block_tf_with_carbon])
        self.assertEqual(len(cands), 1)
        c = cands[0]
        self.assertEqual(c.candidate_number, 2)
        self.assertEqual(c.section_type, "part_ii_tf", "Stray 'C.' token must not poison Part II into Part I")
        self.assertEqual(c.options_detected, [])
        self.assertEqual(c.statements_detected, ["a", "b", "c", "d"])

    def test_challenge_2_5_cross_page_banner_inheritance(self):
        """
        Adversarial Challenge 2.5:
        Page 2 starts mid-section with Câu 2 of Part III without an explicit section banner.
        Page 1 has the PHẦN III banner.
        VERIFY: Cross-page banner inheritance accurately inherits part_iii on Page 2.
        """
        doc = fitz.open()
        font_path = "C:/Windows/Fonts/times.ttf" if os.path.exists("C:/Windows/Fonts/times.ttf") else None
        p1 = doc.new_page(width=595, height=842)
        if font_path:
            p1.insert_font(fontname="times", fontfile=font_path)
            p1.insert_text(fitz.Point(50, 50), "PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN", fontname="times", fontsize=12)
            p1.insert_text(fitz.Point(50, 100), "Câu 1: Tính khối lượng kết tủa thu được?", fontname="times", fontsize=10)
        else:
            p1.insert_text(fitz.Point(50, 50), "PHẦN 3. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN", fontsize=12)
            p1.insert_text(fitz.Point(50, 100), "Câu 1: Tính khối lượng kết tủa thu được?", fontsize=10)

        p2 = doc.new_page(width=595, height=842)
        if font_path:
            p2.insert_font(fontname="times", fontfile=font_path)
            p2.insert_text(fitz.Point(50, 100), "Câu 2: Tính thể tích khí CO2 thu được ở đktc?", fontname="times", fontsize=10)
            p2.insert_text(fitz.Point(50, 200), "Câu 3: Tính số mol H2 giải phóng?", fontname="times", fontsize=10)
        else:
            p2.insert_text(fitz.Point(50, 100), "Câu 2: Tính thể tích khí CO2 thu được ở đktc?", fontsize=10)
            p2.insert_text(fitz.Point(50, 200), "Câu 3: Tính số mol H2 giải phóng?", fontsize=10)

        pdf_path = os.path.join(self.temp_dir, "cross_page_part_iii.pdf")
        doc.save(pdf_path)
        doc.close()

        res_p2 = inspect_page_ground_truth(pdf_path, pages_arg="2")
        self.assertTrue(res_p2["success"])
        self.assertFalse(res_p2["has_part_i"])
        self.assertFalse(res_p2["has_part_ii"])
        self.assertTrue(res_p2["has_part_iii"], "Page 2 MUST inherit part_iii from Page 1")
        self.assertEqual(res_p2["part_iii_start"], 2)
        self.assertEqual(res_p2["part_iii_count"], 2)
        self.assertEqual(res_p2["detected_questions"], [2, 3])

    # =========================================================================
    # CHALLENGE 3: Question Index Discrete Question Range Stress Testing
    # =========================================================================

    def test_challenge_3_1_non_contiguous_odd_list_no_range_mismatch(self):
        """
        Adversarial Challenge 3.1:
        User requests non-contiguous odd questions [1, 3, 5, 7, 9].
        Page contains Q1..Q10.
        VERIFY: validate_requested_range and build_extraction_plan succeed with NO RANGE_MISMATCH.
        """
        os.environ["QUIZ_CACHE_DISABLED"] = "1"
        try:
            p1 = PageRepresentation(
                page_index=0, page_number=99, width=595.0, height=842.0, character_count=600,
                candidates=[
                    QuestionCandidate(candidate_number=n, marker_text=f"Câu {n}:", bbox=(50, 50 + n * 50, 500, 80 + n * 50), y_pos=float(50 + n * 50), options_detected=["A", "B", "C", "D"])
                    for n in range(1, 11)
                ]
            )
            neighborhood = self.index_service.build_neighborhood_index(target_physical_page=99, doc_reps=[p1])

            odd_targets = [1, 3, 5, 7, 9]
            is_valid, detected, missing, entries = self.index_service.validate_requested_range(
                neighborhood=neighborhood,
                start_q=1,
                end_q=9,
                count=5,
                doc_reps=[p1],
                raise_on_mismatch=True,
                target_question_numbers=odd_targets
            )
            self.assertTrue(is_valid, "Non-contiguous odd question range must be valid")
            self.assertEqual(detected, odd_targets)
            self.assertEqual(missing, [])

            plan = self.index_service.build_extraction_plan(
                neighborhood=neighborhood,
                start_q=1,
                end_q=9,
                count=5,
                doc_reps=[p1],
                raise_on_mismatch=True,
                target_question_numbers=odd_targets
            )
            self.assertTrue(plan.validated)
            self.assertEqual(plan.status, "RANGE_VALID")
            self.assertEqual(plan.target_question_numbers, odd_targets)
            self.assertEqual(plan.requested_count, 5)
        finally:
            os.environ.pop("QUIZ_CACHE_DISABLED", None)

    def test_challenge_3_2_non_contiguous_arbitrary_subset_page_41_sample(self):
        """
        Adversarial Challenge 3.2:
        Target question subset [47, 49] (odd questions from Page 41).
        Page contains Q47..Q50.
        VERIFY: Succeeds cleanly without RANGE_MISMATCH.
        """
        p41 = PageRepresentation(
            page_index=0, page_number=41, width=595.0, height=842.0, character_count=500,
            candidates=[
                QuestionCandidate(candidate_number=47, marker_text="Câu 47:", bbox=(50, 100, 500, 120), y_pos=100.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=48, marker_text="Câu 48:", bbox=(50, 200, 500, 220), y_pos=200.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=49, marker_text="Câu 49:", bbox=(50, 300, 500, 320), y_pos=300.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=50, marker_text="Câu 50:", bbox=(50, 400, 500, 420), y_pos=400.0, options_detected=["A", "B", "C", "D"]),
            ]
        )
        neighborhood = self.index_service.build_neighborhood_index(target_physical_page=41, doc_reps=[p41])

        plan = self.index_service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=47,
            end_q=49,
            count=2,
            doc_reps=[p41],
            raise_on_mismatch=True,
            target_question_numbers=[47, 49]
        )
        self.assertTrue(plan.validated)
        self.assertEqual(plan.status, "RANGE_VALID")
        self.assertEqual(plan.target_question_numbers, [47, 49])

    def test_challenge_3_3_discrete_subset_genuinely_missing_triggers_hard_gate(self):
        """
        Adversarial Challenge 3.3:
        Discrete list requests [1, 3, 5, 99]. Document contains Q1..Q10 (Q99 is missing).
        VERIFY: Hard gate is strictly preserved — raises QuizEngineError(RANGE_MISMATCH).
        """
        p1 = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0, character_count=600,
            candidates=[
                QuestionCandidate(candidate_number=n, marker_text=f"Câu {n}:", bbox=(50, 50 + n * 50, 500, 80 + n * 50), y_pos=float(50 + n * 50), options_detected=["A", "B", "C", "D"])
                for n in range(1, 11)
            ]
        )
        neighborhood = self.index_service.build_neighborhood_index(target_physical_page=1, doc_reps=[p1])

        # Non-raising mode
        valid, detected, missing, _ = self.index_service.validate_requested_range(
            neighborhood=neighborhood,
            start_q=1,
            end_q=99,
            count=4,
            doc_reps=[p1],
            raise_on_mismatch=False,
            target_question_numbers=[1, 3, 5, 99]
        )
        self.assertFalse(valid, "Must fail validation when Q99 is genuinely missing")
        self.assertEqual(detected, [1, 3, 5])
        self.assertEqual(missing, [99])

        # Raising mode must raise RANGE_MISMATCH
        with self.assertRaises(QuizEngineError) as ctx:
            self.index_service.build_extraction_plan(
                neighborhood=neighborhood,
                start_q=1,
                end_q=99,
                count=4,
                doc_reps=[p1],
                raise_on_mismatch=True,
                target_question_numbers=[1, 3, 5, 99]
            )
        self.assertEqual(ctx.exception.code, ErrorCode.RANGE_MISMATCH)
        self.assertIn("RANGE_MISMATCH", str(ctx.exception))

    def test_challenge_1_3_intra_section_duplicate_blocks_deduplicated(self):
        """
        Adversarial Challenge 1.3:
        Verifies that within the same section, duplicate blocks or repeated text spans
        at near-identical vertical coordinates (round(y_pos, -1)) are deduplicated cleanly,
        while different sections with the same question numbers are preserved.
        """
        b_dup1 = TextBlock(
            block_index=0, bbox=(50, 100, 500, 140),
            text="Câu 1: Este X có mùi chuối chín\nA. Isoamyl axetat. B. Etyl fomat. C. Metyl axetat. D. Benzyl axetat."
        )
        # Duplicate block of Câu 1 at near-identical y (y=103.0 -> round to 100.0)
        b_dup2 = TextBlock(
            block_index=1, bbox=(50, 103, 500, 143),
            text="Câu 1: Este X có mùi chuối chín\nA. Isoamyl axetat. B. Etyl fomat. C. Metyl axetat. D. Benzyl axetat."
        )
        # Distinct Part II Câu 1 at y=400.0
        b_part_ii = TextBlock(
            block_index=2, bbox=(50, 400, 500, 500),
            text="PHẦN II\nCâu 1: Cho các nhận định sau:\na) Đúng 1.\nb) Đúng 2.\nc) Đúng 3.\nd) Đúng 4."
        )
        cands = detect_candidates_from_page([b_dup1, b_dup2, b_part_ii])
        self.assertEqual(len(cands), 2, "Duplicate Câu 1 in Part I must be deduplicated, but Part II Câu 1 must be kept")
        self.assertEqual(cands[0].candidate_number, 1)
        self.assertEqual(cands[0].section_type, "part_i_mcq")
        self.assertEqual(cands[1].candidate_number, 1)
        self.assertEqual(cands[1].section_type, "part_ii_tf")

    def test_challenge_2_6_goc_pdf_ground_truth_all_queries(self):
        """
        Adversarial Challenge 2.6:
        Runs ground-truth verification on the real fixture '.tmp/Diff check/Gốc.pdf'
        for all target queries specified in DISPATCH.md and ORIGINAL_REQUEST.md:
        1. 'toàn bộ trang 41' -> 5 questions [47, 48, 49, 50, 1]
        2. 'các câu lẻ trang 41' -> [47, 49]
        3. 'các câu chẵn trang 41' -> [48, 50]
        4. 'phần 1 trang 41' -> [47, 48, 49, 50]
        5. 'phần 2 trang 41' -> [1]
        """
        goc_pdf = os.path.abspath(".tmp/Diff check/Gốc.pdf")
        if not os.path.isfile(goc_pdf):
            self.skipTest("Gốc.pdf fixture not available")

        # 1. Toàn bộ trang 41
        res_all = inspect_page_ground_truth(goc_pdf, query_arg="toàn bộ trang 41")
        self.assertTrue(res_all["success"])
        self.assertEqual(res_all["detected_questions"], [47, 48, 49, 50, 1])
        self.assertEqual(res_all["count"], 5)
        self.assertTrue(res_all["has_part_i"])
        self.assertTrue(res_all["has_part_ii"])
        self.assertFalse(res_all["has_part_iii"])

        # 2. Các câu lẻ trang 41
        res_odd = inspect_page_ground_truth(goc_pdf, query_arg="các câu lẻ trang 41")
        self.assertTrue(res_odd["success"])
        self.assertEqual(res_odd["detected_questions"], [47, 49])
        self.assertEqual(res_odd["parity_filter"], "odd")

        # 3. Các câu chẵn trang 41
        res_even = inspect_page_ground_truth(goc_pdf, query_arg="các câu chẵn trang 41")
        self.assertTrue(res_even["success"])
        self.assertEqual(res_even["detected_questions"], [48, 50])
        self.assertEqual(res_even["parity_filter"], "even")

        # 4. Phần 1 trang 41
        res_p1 = inspect_page_ground_truth(goc_pdf, query_arg="phần 1 trang 41")
        self.assertTrue(res_p1["success"])
        self.assertEqual(res_p1["detected_questions"], [47, 48, 49, 50])
        self.assertEqual(res_p1["section_filter"], "part_i")

        # 5. Phần 2 trang 41
        res_p2 = inspect_page_ground_truth(goc_pdf, query_arg="phần 2 trang 41")
        self.assertTrue(res_p2["success"])
        self.assertEqual(res_p2["detected_questions"], [1])
        self.assertEqual(res_p2["section_filter"], "part_ii")


if __name__ == "__main__":
    unittest.main()
