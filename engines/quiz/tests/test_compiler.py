"""
Integration and Unit Tests for Headless Chrome PDF Compiler (TASK-09).
Verifies Chrome discovery, filename sanitization, and the compilation of
both {prefix}_DeBai.pdf and {prefix}_DapAn.pdf with PyMuPDF integrity validation.
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionIR,
    SectionType,
    QuestionIR,
    OptionIR,
    TFStatementIR,
    AnswerKeyIR,
)
from engines.quiz.rendering.compiler import (
    PDFCompiler,
    find_chrome_path,
    sanitize_filename_prefix,
)


class TestPDFCompiler(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_quiz_compile_")
        self.doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="BÀI KIỂM TRA ĐỊNH KỲ",
                subject="VẬT LÝ",
                grade="12",
                exam_code="202",
                total_questions=2,
                duration_minutes=45,
                source_filename="physics.pdf",
                source_hash="phys123hash",
                created_at="2026-10-04T12:00:00Z",
            ),
            sections=[
                SectionIR(
                    id="sec_1",
                    title="PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN",
                    instruction="Thí sinh chọn một phương án đúng nhất.",
                    type=SectionType.PART_I_MCQ,
                    question_ids=["q_1"],
                ),
                SectionIR(
                    id="sec_2",
                    title="PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI",
                    instruction="Thí sinh trả lời các mệnh đề.",
                    type=SectionType.PART_II_TF,
                    question_ids=["q_2"],
                ),
            ],
            questions=[
                QuestionIR(
                    id="q_1",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Một con lắc lò xo có độ cứng $k = 100\\text{ N/m}$, gắn vật nặng khối lượng $m = 100\\text{ g}$. Chu kì dao động riêng là",
                    options=[
                        OptionIR(label="A", text="$0{,}2\\text{ s}$"),
                        OptionIR(label="B", text="$0{,}1\\pi\\text{ s}$"),
                        OptionIR(label="C", text="$0{,}2\\pi\\text{ s}$"),
                        OptionIR(label="D", text="$2\\pi\\text{ s}$"),
                    ],
                ),
                QuestionIR(
                    id="q_2",
                    number=2,
                    source_number=2,
                    type=SectionType.PART_II_TF,
                    stem="Xét một sóng cơ hình sin lan truyền trong một môi trường đàn hồi:",
                    sub_statements=[
                        TFStatementIR(label="a", statement="Tốc độ truyền sóng chỉ phụ thuộc vào bản chất môi trường."),
                        TFStatementIR(label="b", statement="Bước sóng là quãng đường sóng truyền đi trong một chu kì."),
                        TFStatementIR(label="c", statement="Biên độ dao động của phần tử môi trường luôn bằng bước sóng."),
                        TFStatementIR(label="d", statement="Tần số sóng không đổi khi truyền qua các môi trường khác nhau."),
                    ],
                ),
            ],
            answers=[
                AnswerKeyIR(
                    question_id="q_1",
                    question_number=1,
                    type=SectionType.PART_I_MCQ,
                    selected_answer="C",
                    evidence="Áp dụng công thức $T = 2\\pi \\sqrt{\\frac{m}{k}} = 2\\pi \\sqrt{\\frac{0{,}1}{100}} = 0{,}2\\pi\\text{ s}$.",
                ),
                AnswerKeyIR(
                    question_id="q_2",
                    question_number=2,
                    type=SectionType.PART_II_TF,
                    selected_answer="Part II",
                    sub_answers={"a": True, "b": True, "c": False, "d": True},
                    evidence="Ý c sai vì biên độ dao động và bước sóng là hai đại lượng hoàn toàn khác nhau.",
                ),
            ],
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_find_chrome_path(self):
        chrome_path = find_chrome_path()
        self.assertTrue(os.path.isfile(chrome_path))
        self.assertTrue(os.access(chrome_path, os.X_OK))

    def test_sanitize_filename_prefix(self):
        self.assertEqual(sanitize_filename_prefix(""), "DeThi")
        self.assertEqual(sanitize_filename_prefix("   "), "DeThi")
        self.assertEqual(
            sanitize_filename_prefix("KiemTra: 15_Phut / De_1 * V?T"),
            "KiemTra_15_Phut__De_1__VT",
        )

    def test_compile_both_documents_full_integration(self):
        compiler = PDFCompiler()
        prefix = "physics_test_101"

        debai_pdf, dapan_pdf = compiler.compile_both(
            doc_ir=self.doc_ir,
            output_dir=self.temp_dir,
            prefix=prefix,
        )

        # 1. Verify exact expected filenames
        self.assertTrue(os.path.isfile(debai_pdf))
        self.assertTrue(os.path.isfile(dapan_pdf))
        self.assertTrue(debai_pdf.endswith(f"{prefix}_DeBai.pdf"))
        self.assertTrue(dapan_pdf.endswith(f"{prefix}_DapAn.pdf"))

        # 2. Verify non-trivial file size (> 5 KB)
        debai_size = os.path.getsize(debai_pdf)
        dapan_size = os.path.getsize(dapan_pdf)
        self.assertGreater(debai_size, 5000, "DeBai.pdf must be a valid non-empty PDF")
        self.assertGreater(dapan_size, 5000, "DapAn.pdf must be a valid non-empty PDF")

        # 3. PyMuPDF inspection for A4 dimensions & page structure
        doc_debai = pymupdf.open(debai_pdf)
        self.assertGreaterEqual(doc_debai.page_count, 1)
        p0 = doc_debai[0]
        # Standard A4 is 595.28 x 841.89 points
        self.assertAlmostEqual(p0.rect.width, 595.28, delta=5.0)
        self.assertAlmostEqual(p0.rect.height, 841.89, delta=5.0)
        # Verify text presence
        text_debai = p0.get_text()
        self.assertIn("BÀI KIỂM TRA ĐỊNH KỲ", text_debai)
        self.assertIn("Câu 1:", text_debai)
        doc_debai.close()

        doc_dapan = pymupdf.open(dapan_pdf)
        self.assertGreaterEqual(doc_dapan.page_count, 1)
        p0_ans = doc_dapan[0]
        self.assertAlmostEqual(p0_ans.rect.width, 595.28, delta=5.0)
        self.assertAlmostEqual(p0_ans.rect.height, 841.89, delta=5.0)
        text_dapan = p0_ans.get_text()
        self.assertIn("ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT", text_dapan)
        self.assertIn("BẢNG ĐÁP ÁN NHANH", text_dapan)
        doc_dapan.close()


if __name__ == "__main__":
    unittest.main()
