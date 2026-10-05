"""
Unit Tests for Document HTML Renderer and Templates (TASK-09).
"""

import unittest
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionIR,
    SectionType,
    QuestionIR,
    OptionIR,
    TFStatementIR,
    RichElementIR,
    AnswerKeyIR,
)
from engines.quiz.rendering.renderer import DocumentHTMLRenderer
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE


class TestDocumentHTMLRenderer(unittest.TestCase):
    def setUp(self):
        # Build canonical sample document IR
        self.doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="KIỂM TRA GIỮA KỲ I",
                subject="HÓA HỌC",
                grade="12",
                exam_code="101",
                total_questions=3,
                duration_minutes=45,
                source_filename="de_thi_mau.pdf",
                source_hash="abcd1234hash",
                created_at="2026-10-04T12:00:00Z",
            ),
            sections=[
                SectionIR(
                    id="sec_1",
                    title="PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN",
                    instruction="Thí sinh trả lời từ câu 1 đến câu 1. Mỗi câu chỉ chọn một phương án.",
                    type=SectionType.PART_I_MCQ,
                    question_ids=["q_1"],
                ),
                SectionIR(
                    id="sec_2",
                    title="PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI",
                    instruction="Thí sinh trả lời câu 2. Trong mỗi ý a, b, c, d chọn đúng hoặc sai.",
                    type=SectionType.PART_II_TF,
                    question_ids=["q_2"],
                ),
                SectionIR(
                    id="sec_3",
                    title="PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN",
                    instruction="Thí sinh trả lời câu 3. Điền kết quả vào ô trống.",
                    type=SectionType.PART_III_SHORT,
                    question_ids=["q_3"],
                ),
            ],
            questions=[
                QuestionIR(
                    id="q_1",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Chất nào sau đây tác dụng với dung dịch $NaOH$ sinh ra muối và nước?",
                    options=[
                        OptionIR(label="A", text="$CH_3COOH$"),
                        OptionIR(label="B", text="$C_2H_5OH$"),
                        OptionIR(label="C", text="$CH_3CHO$"),
                        OptionIR(label="D", text="$C_6H_6$"),
                    ],
                    rich_elements=[
                        RichElementIR(
                            element_id="elem_crop_1",
                            source_crop_path="crops/crop_q1.png",
                            caption="Hình 1: Thí nghiệm chuẩn độ",
                        )
                    ],
                ),
                QuestionIR(
                    id="q_2",
                    number=2,
                    source_number=2,
                    type=SectionType.PART_II_TF,
                    stem="Cho các phát biểu về este $CH_3COOC_2H_5$:",
                    sub_statements=[
                        TFStatementIR(label="a", statement="Este này có mùi chuối chín đặc trưng."),
                        TFStatementIR(label="b", statement="Nhiệt độ sôi của este thấp hơn ancol tương ứng."),
                        TFStatementIR(label="c", statement="Phản ứng thủy phân trong môi trường axit là phản ứng thuận nghịch."),
                        TFStatementIR(label="d", statement="Tác dụng với dung dịch kiềm được gọi là phản ứng xà phòng hóa."),
                    ],
                ),
                QuestionIR(
                    id="q_3",
                    number=3,
                    source_number=3,
                    type=SectionType.PART_III_SHORT,
                    stem="Đốt cháy hoàn toàn $0{,}1\\text{ mol}$ este no đơn chức mạch hở X thu được bao nhiêu lít khí $CO_2$ (đktc)?",
                ),
            ],
            answers=[
                AnswerKeyIR(
                    question_id="q_1",
                    question_number=1,
                    type=SectionType.PART_I_MCQ,
                    selected_answer="A",
                    evidence="Axit axetic ($CH_3COOH$) phản ứng với $NaOH$ tạo $CH_3COONa + H_2O$.",
                ),
                AnswerKeyIR(
                    question_id="q_2",
                    question_number=2,
                    type=SectionType.PART_II_TF,
                    selected_answer="Part II",
                    sub_answers={"a": False, "b": True, "c": True, "d": True},
                    evidence="Ý a sai vì $CH_3COOC_2H_5$ có mùi dứa hoặc táo, este isoamyl axetat mới có mùi chuối chín.",
                ),
                AnswerKeyIR(
                    question_id="q_3",
                    question_number=3,
                    type=SectionType.PART_III_SHORT,
                    selected_answer="4.48",
                    short_answer_value="4.48",
                    evidence="Với este nhỏ nhất $HCOOCH_3$ ($C_2H_4O_2$), $n_{CO_2} = 2 \\times 0{,}1 = 0{,}2\\text{ mol} \\implies V = 4{,}48\\text{ lít}$.",
                ),
            ],
        )
        self.renderer = DocumentHTMLRenderer(preset=BLUE_BLACK_CLASSIC_STYLE)

    def test_render_worksheet_deterministic(self):
        # Multiple runs must return byte-for-byte identical HTML
        html1 = self.renderer.render_worksheet(self.doc_ir)
        html2 = self.renderer.render_worksheet(self.doc_ir)
        self.assertEqual(html1, html2)

    def test_render_worksheet_contains_essential_elements(self):
        worksheet_html = self.renderer.render_worksheet(self.doc_ir)

        # Title & Metadata
        self.assertIn("KIỂM TRA GIỮA KỲ I", worksheet_html)
        self.assertIn("HÓA HỌC", worksheet_html)
        self.assertIn("Lớp 12", worksheet_html)
        self.assertIn("Mã đề: 101", worksheet_html)
        self.assertIn("45 phút", worksheet_html)

        # Centered Exam Title
        self.assertIn('class="exam-header-title"', worksheet_html)

        # Student info box must be completely removed
        self.assertNotIn("Họ và tên thí sinh", worksheet_html)
        self.assertNotIn("Số báo danh", worksheet_html)
        self.assertNotIn("student-info-box", worksheet_html)

        # Section instruction line must be completely removed
        self.assertNotIn("section-instruction", worksheet_html)
        self.assertNotIn("Thí sinh trả lời", worksheet_html)

        # Section banners
        self.assertIn("PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN", worksheet_html)
        self.assertIn("PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI", worksheet_html)
        self.assertIn("PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN", worksheet_html)

        # Questions & Elements
        self.assertIn("Câu 1:", worksheet_html)
        self.assertIn("$CH_3COOH$", worksheet_html)
        self.assertIn("crops/crop_q1.png", worksheet_html)
        self.assertIn("Hình 1: Thí nghiệm chuẩn độ", worksheet_html)

        # Part II sub-statements
        self.assertIn("a)", worksheet_html)
        self.assertIn("b)", worksheet_html)

        # Part III short answer box
        self.assertIn("Trả lời:", worksheet_html)
        self.assertIn("short-answer-box", worksheet_html)

        # Total question count must NOT be in header metadata
        self.assertNotIn("Tổng số câu hỏi", worksheet_html)

    def test_optional_duration_regression_cases(self):
        # Case A: No duration (empty string or None) -> No duration text, no label, header collapses
        doc_no_dur = self.doc_ir.model_copy(deep=True)
        doc_no_dur.metadata.duration = ""
        doc_no_dur.metadata.duration_minutes = None
        html_a = self.renderer.render_worksheet(doc_no_dur)
        self.assertNotIn("Thời gian làm bài", html_a)
        self.assertNotIn("phút", html_a)
        self.assertNotIn("Tổng số câu hỏi", html_a)

        # Edge Case: duration = None
        doc_none = self.doc_ir.model_copy(deep=True)
        doc_none.metadata.duration = None
        doc_none.metadata.duration_minutes = None
        html_none = self.renderer.render_worksheet(doc_none)
        self.assertNotIn("Thời gian làm bài", html_none)

        # Edge Case: duration = whitespace only
        doc_ws = self.doc_ir.model_copy(deep=True)
        doc_ws.metadata.duration = "   "
        doc_ws.metadata.duration_minutes = None
        html_ws = self.renderer.render_worksheet(doc_ws)
        self.assertNotIn("Thời gian làm bài", html_ws)

        # Case B: Duration = "45 phút"
        doc_45 = self.doc_ir.model_copy(deep=True)
        doc_45.metadata.duration = "45 phút"
        doc_45.metadata.duration_minutes = None
        html_b = self.renderer.render_worksheet(doc_45)
        self.assertIn("Thời gian làm bài: 45 phút", html_b)

        # Edge Case: raw digits "45" auto-formats to "45 phút"
        doc_digits = self.doc_ir.model_copy(deep=True)
        doc_digits.metadata.duration = "45"
        doc_digits.metadata.duration_minutes = None
        html_digits = self.renderer.render_worksheet(doc_digits)
        self.assertIn("Thời gian làm bài: 45 phút", html_digits)

        # Case C: Duration = "90 phút"
        doc_90 = self.doc_ir.model_copy(deep=True)
        doc_90.metadata.duration = "90 phút"
        doc_90.metadata.duration_minutes = None
        html_c = self.renderer.render_worksheet(doc_90)
        self.assertIn("Thời gian làm bài: 90 phút", html_c)

    def test_long_title_header_wrap_safety(self):
        doc_long_title = self.doc_ir.model_copy(deep=True)
        doc_long_title.metadata.title = "BÀI TẬP TRẮC NGHIỆM HÓA HỌC HỮU CƠ CHƯƠNG ESTE LIPIT NÂNG CAO ÔN THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG NĂM 2026"
        html = self.renderer.render_worksheet(doc_long_title)
        self.assertIn("exam-header-title", html)
        self.assertIn("BÀI TẬP TRẮC NGHIỆM HÓA HỌC HỮU CƠ", html)
        self.assertIn("word-wrap: break-word", html)


    def test_render_answer_key_matrix_and_evidence(self):
        answer_html = self.renderer.render_answer_key(self.doc_ir)

        # Header
        self.assertIn("ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT", answer_html)

        # Quick matrix table
        self.assertIn("I. BẢNG ĐÁP ÁN NHANH", answer_html)
        self.assertIn("Bảng đáp án trắc nghiệm Phần I", answer_html)
        self.assertIn("<th>1</th>", answer_html)
        self.assertIn('<td class="correct-val">A</td>', answer_html)

        # Part II matrix
        self.assertIn("Bảng đáp án Đúng / Sai Phần II", answer_html)
        self.assertIn("a</strong>: S", answer_html)
        self.assertIn("b</strong>: Đ", answer_html)

        # Part III matrix
        self.assertIn("Bảng đáp án Điền ngắn Phần III", answer_html)
        self.assertIn("4.48", answer_html)

        # Detailed pedagogical solutions
        self.assertIn("II. HƯỚNG DẪN GIẢI CHI TIẾT", answer_html)
        self.assertIn("Câu 1:", answer_html)
        self.assertIn("Đáp án A", answer_html)
        self.assertIn("Axit axetic ($CH_3COOH$)", answer_html)


if __name__ == "__main__":
    unittest.main()
