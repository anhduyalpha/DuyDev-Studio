"""
Regression test for Quiz PDF Pagination Bug (tesst_DeBai regression case).
Verifies:
1. Page 1 does not prematurely push Câu 41 to Page 2.
2. Câu 45 stem and all options (A, B, C, D) remain atomically together on Page 2.
3. Page count is exactly 2 pages (no excessive empty space or orphan 3rd page).
4. No question is split across pages.
5. All multiple-choice options (A, B, C, D) are verified present in the rendered document.
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    OptionIR,
    QuestionIR,
    RichElementIR,
    RichElementType,
    SectionIR,
    SectionType,
)
from engines.quiz.rendering.compiler import PDFCompiler
from engines.quiz.rendering.layout import LayoutSolver
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE


class TestRegressionPaginationTesst(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp(prefix="quiz_pag_regress_")
        cls.compiler = PDFCompiler()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def _build_regression_doc_ir(self) -> CanonicalDocumentIR:
        """Construct the canonical IR matching the 12 questions from tesst_DeBai (Q35..Q46)."""
        questions = [
            QuestionIR(
                id="q_35", number=35, source_number=35, type=SectionType.PART_I_MCQ,
                stem="Từ dầu thực vật làm thế nào để sản xuất được bơ nhân tạo?",
                options=[
                    OptionIR(label="A", text="Hydrogen hóa acid béo."),
                    OptionIR(label="B", text="Đề hydrogen hóa chất béo lỏng."),
                    OptionIR(label="C", text="Hydrogen hóa chất béo lỏng."),
                    OptionIR(label="D", text="Xà phòng hóa chất béo lỏng."),
                ]
            ),
            QuestionIR(
                id="q_36", number=36, source_number=36, type=SectionType.PART_I_MCQ,
                stem="Cho sơ đồ chuyển hóa giữa các hợp chất hữu cơ: Tripalmitin NaOH,to -> X HCl -> Y H2SO4(d),to -> Z Tên gọi của Z là",
                options=[
                    OptionIR(label="A", text="methyl palmitate."),
                    OptionIR(label="B", text="methyl linoleate."),
                    OptionIR(label="C", text="methyl stearate."),
                    OptionIR(label="D", text="methyl oleate."),
                ]
            ),
            QuestionIR(
                id="q_37", number=37, source_number=37, type=SectionType.PART_I_MCQ,
                stem="Cho sơ đồ chuyển hóa: Triolein H2(du),to -> E NaOH,to -> T HCl -> G Tên gọi của G là",
                options=[
                    OptionIR(label="A", text="oleic acid."),
                    OptionIR(label="B", text="linoleic acid."),
                    OptionIR(label="C", text="stearic acid."),
                    OptionIR(label="D", text="palmitic acid."),
                ]
            ),
            QuestionIR(
                id="q_38", number=38, source_number=38, type=SectionType.PART_I_MCQ,
                stem="Phát biểu nào sau đây sai?",
                options=[
                    OptionIR(label="A", text="Trong công nghiệp có thể chuyển hoá chất béo lỏng thành chất béo rắn."),
                    OptionIR(label="B", text="Số nguyên tử hydrogen trong phân tử ester đơn và đa chức luôn là một số chẵn."),
                    OptionIR(label="C", text="Sản phẩm của phản ứng xà phòng hoá chất béo là acid béo và glycerol."),
                    OptionIR(label="D", text="Nhiệt độ sôi của ester thấp hơn hẳn so với alcohol có cùng phân tử khối."),
                ]
            ),
            QuestionIR(
                id="q_39", number=39, source_number=39, type=SectionType.PART_I_MCQ,
                stem="Phát biểu nào sau đây không đúng?",
                options=[
                    OptionIR(label="A", text="Chất béo là triester của glycerol và các monocarboxylic acid có mạch carbon dài, không phân nhánh."),
                    OptionIR(label="B", text="Chất béo chứa chủ yếu các gốc no của acid thường là chất rắn ở nhiệt độ phòng."),
                    OptionIR(label="C", text="Chất béo chứa chủ yếu các gốc không no của acid thường là chất lỏng ở nhiệt độ phòng và được gọi là dầu."),
                    OptionIR(label="D", text="Phản ứng thuỷ phân chất béo trong môi trường kiềm là phản ứng thuận nghịch."),
                ]
            ),
            QuestionIR(
                id="q_40", number=40, source_number=40, type=SectionType.PART_I_MCQ,
                stem="Chất béo có đặc điểm chung nào sau đây?",
                options=[
                    OptionIR(label="A", text="Không tan trong nước, nặng hơn nước, có trong thành phần chính của dầu, mỡ động, thực vật."),
                    OptionIR(label="B", text="Không tan trong nước, nhẹ hơn nước, có trong thành phần chính của dầu, mỡ động, thực vật."),
                    OptionIR(label="C", text="Là chất lỏng, không tan trong nước, nhẹ hơn nước, có trong thành phần chính của dầu, mỡ động, thực vật."),
                    OptionIR(label="D", text="Là chất rắn, không tan trong nước, nhẹ hơn nước, có trong thành phần chính của dầu, mỡ động, thực vật."),
                ]
            ),
            QuestionIR(
                id="q_41", number=41, source_number=41, type=SectionType.PART_I_MCQ,
                stem="Linoleic acid (có cấu tạo như hình bên) là một trong những acid béo có lợi cho sức khỏe tim mạch. Phát biểu nào sau đây sai?",
                options=[
                    OptionIR(label="A", text="Trong phân tử linoleic acid có 3 liên kết pi."),
                    OptionIR(label="B", text="Ở điều kiện thích hợp, 1 mol trilinolein tác dụng được tối đa với 2 mol H2."),
                    OptionIR(label="C", text="Công thức của chất béo trilinolein là (C17H31COO)3C3H5."),
                    OptionIR(label="D", text="Linoleic acid thuộc loại omega-6."),
                ],
                rich_elements=[
                    RichElementIR(
                        element_id="elem_41",
                        type=RichElementType.IMAGE_CROP,
                        source_crop_path="data/cache/quiz/assets_6a200ba059c5fc940c0d95ca5ffc3c8e2c14bb02de3ab2bac9b923c9d57ed2ca/fig_p40_1.png",
                        bbox=(50.0, 574.0, 545.0, 672.0),
                    )
                ]
            ),
            QuestionIR(
                id="q_42", number=42, source_number=42, type=SectionType.PART_I_MCQ,
                stem="Phát biểu nào sau đây là sai?",
                options=[
                    OptionIR(label="A", text="Phân tử chất béo chứa nhiều gốc acid béo no thì chất béo đó thường ở thể rắn."),
                    OptionIR(label="B", text="Các chất béo không tan trong nước và nhẹ hơn nước."),
                    OptionIR(label="C", text="Chất béo bị thuỷ phân không hoàn toàn trong môi trường acid."),
                    OptionIR(label="D", text="Chất béo là đồng đẳng với dầu, mỡ dùng để bôi trơn động cơ."),
                ]
            ),
            QuestionIR(
                id="q_43", number=43, source_number=43, type=SectionType.PART_I_MCQ,
                stem="Dầu mỡ để lâu ngày thường có mùi hôi, khét. Hiện tượng này gọi là sự ôi mỡ. Phát biểu nào sau đây sai?",
                options=[
                    OptionIR(label="A", text="Sự ôi mỡ là do gốc hydrocarbon không no trong phân tử chất béo cộng hợp với hydrogen thành chất béo no."),
                    OptionIR(label="B", text="Sự ôi mỡ là do gốc hydrocarbon không no trong phân tử chất béo bị oxi hoá chậm bởi oxygen trong không khí."),
                    OptionIR(label="C", text="Việc sử dụng lại dầu, mỡ chiên, rán nhiều lần cũng gây hại tới sức khoẻ."),
                    OptionIR(label="D", text="Dầu, mỡ tái sử dụng nhiều lần cũng có hiện tượng ôi mỡ."),
                ]
            ),
            QuestionIR(
                id="q_44", number=44, source_number=44, type=SectionType.PART_I_MCQ,
                stem="Với acid béo không no, số thứ tự chỉ vị trí liên kết đôi (C=C) đầu tiên tính từ đuôi CH3 là n thì acid béo thuộc nhóm omega-n. Phát biểu nào sau đây là sai?",
                options=[
                    OptionIR(label="A", text="Acid béo omega-3 và omega-6 là các acid béo không no với liên kết đôi (C=C) đầu tiên ở vị trí số 3 và 6 khi đánh số từ nhóm methyl."),
                    OptionIR(label="B", text="Linoleic acid (CH3[CH2]4CH=CHCH2CH=CH[CH2]7COOH) thuộc nhóm omega-3."),
                    OptionIR(label="C", text="Các loại dầu thực vật (dầu mè, dầu đậu nành,...) chứa nhiều acid béo omega-6."),
                    OptionIR(label="D", text="Acid béo omega-3 và omega-6 đều có lợi cho sức khỏe tim mạch, ngăn ngừa các bệnh về tim, động mạch vành."),
                ]
            ),
            QuestionIR(
                id="q_45", number=45, source_number=45, type=SectionType.PART_I_MCQ,
                stem="Khi các acid béo không no có nhiều liên kết đôi (C=C) thì nhiệt độ nóng chảy của nó sẽ bé hơn các acid béo có cùng số nguyên tử carbon nhưng ít liên kết đôi hơn. Phát biểu nào sau đây là sai?",
                options=[
                    OptionIR(label="A", text="Khi trong phân tử acid béo có nhiều liên kết đôi thì mức độ cồng kềnh càng lớn và do đó sự sắp xếp giữa các phân tử trở nên kém đặc khít."),
                    OptionIR(label="B", text="Nhiệt độ nóng chảy của oleic acid (C17H33COOH) sẽ cao hơn nhiệt độ nóng chảy của linoleic acid (C17H31COOH)."),
                    OptionIR(label="C", text="Các phân tử acid béo no và không no đều có tương tác Van der Waals mạnh hơn so với các carboxylic acid có số nguyên tử carbon thấp."),
                    OptionIR(label="D", text="Chưa có cơ sở để so sánh nhiệt độ nóng chảy của oleic acid (C17H33COOH) với palmitic acid (C15H29COOH) vì chúng đều có một liên kết đôi (C=C) trong phân tử."),
                ]
            ),
            QuestionIR(
                id="q_46", number=46, source_number=46, type=SectionType.PART_I_MCQ,
                stem="Chất hữu cơ G được dùng phổ biến trong lĩnh vực mĩ phẩm và phụ gia thực phẩm. Khi thuỷ phân hoàn toàn bất kì chất béo nào đều thu được G. Phát biểu nào sau đây là đúng?",
                options=[
                    OptionIR(label="A", text="G là tristearin có công thức (C17H35COO)3C3H5."),
                    OptionIR(label="B", text="G là glycerol có công thức C3H5(OH)3."),
                    OptionIR(label="C", text="Thủy phân hoàn toàn 1 mol tristearin trong môi trường NaOH thu được 3 mol glycerol."),
                    OptionIR(label="D", text="HCOOH."),
                ]
            ),
        ]

        sec = SectionIR(
            id="sec_1",
            title="PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn",
            type=SectionType.PART_I_MCQ,
            question_ids=[q.id for q in questions]
        )

        meta = DocumentMetadataIR(
            title="HULA HILU",
            subject="HÓA HỌC",
            grade="12",
            total_questions=12,
            created_at="2026-10-05T00:00:00Z"
        )

        return CanonicalDocumentIR(metadata=meta, sections=[sec], questions=questions)

    def test_regression_pagination_renders_exactly_two_pages_with_zero_splits(self):
        doc_ir = self._build_regression_doc_ir()
        debai_pdf, dapan_pdf = self.compiler.compile_both(
            doc_ir=doc_ir,
            output_dir=self.temp_dir,
            prefix="test_regress",
            preset=BLUE_BLACK_CLASSIC_STYLE
        )

        self.assertTrue(os.path.isfile(debai_pdf))
        doc = pymupdf.open(debai_pdf)
        # Bug 1 & 3: Must be exactly 2 pages, not 3
        self.assertEqual(doc.page_count, 2, f"Expected exactly 2 pages, got {doc.page_count}")
        doc.close()

        meas = LayoutSolver.measure_pdf_rendered_questions(debai_pdf, doc_ir)

        # Bug 1 verification: Câu 41 must be placed on Page 1
        q41_info = meas.get("q_41")
        self.assertIsNotNone(q41_info)
        self.assertEqual(q41_info["stem_page"], 1, "Câu 41 stem must be on Page 1")
        self.assertEqual(q41_info["options_page"], 1, "Câu 41 options must be on Page 1")
        self.assertFalse(q41_info["is_split"], "Câu 41 must not be split")

        # Bug 2 verification: Câu 45 must NOT be split; stem and options must both be on Page 2
        q45_info = meas.get("q_45")
        self.assertIsNotNone(q45_info)
        self.assertEqual(q45_info["stem_page"], 2, "Câu 45 stem must be on Page 2")
        self.assertEqual(q45_info["options_page"], 2, "Câu 45 options must be on Page 2")
        self.assertFalse(q45_info["is_split"], "Câu 45 must not be split across pages")

        # Câu 46 verification: Must be on Page 2 with all options intact
        q46_info = meas.get("q_46")
        self.assertIsNotNone(q46_info)
        self.assertEqual(q46_info["stem_page"], 2, "Câu 46 stem must be on Page 2")
        self.assertEqual(q46_info["options_page"], 2, "Câu 46 options must be on Page 2")
        self.assertFalse(q46_info["is_split"], "Câu 46 must not be split across pages")

        # Option integrity: verify no dropped options
        for q in doc_ir.questions:
            q_info = meas.get(q.id)
            self.assertIsNotNone(q_info)
            self.assertEqual(
                len(q_info.get("missing_options", [])), 0,
                f"Question {q.number} has missing options: {q_info.get('missing_options')}"
            )
            self.assertFalse(q_info["is_split"], f"Question {q.number} unexpectedly split across pages")


if __name__ == "__main__":
    unittest.main()
