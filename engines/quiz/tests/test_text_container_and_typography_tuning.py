"""
Regression Test Suite for Text-Container Box Purging and Typography Tuning.
Verifies:
1. is_text_container_box correctly identifies and filters out framed question boxes and MCQ options.
2. is_text_container_box preserves genuine diagrams and scientific schemes with short labels.
3. DocumentObjectGraph suppresses any vector asset that encloses or duplicates question text (zero self-embedded image).
4. Section banner styling is enlarged to 11.5pt with increased padding, and KaTeX visual harmony rule is declared.
"""

import unittest
from unittest.mock import MagicMock
import pymupdf as fitz

from engines.quiz.assets.extractor import is_text_container_box
from engines.quiz.assets.models import AssetRecord, AssetType, ExtractionMethod
from engines.quiz.perception.models import PageRepresentation, TextBlock, QuestionCandidate
from engines.quiz.reconstruction.models import ReconstructedQuestion
from engines.quiz.graph.object_graph import DocumentObjectGraph
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE, ANSWER_GREEN_STYLE
from engines.quiz.rendering.layout import LayoutSolver


class TestTextContainerAndTypographyTuning(unittest.TestCase):
    def test_is_text_container_box_detects_framed_question(self):
        """Framed question box with stem and options must be recognized as text container, not figure."""
        page_mock = MagicMock(spec=fitz.Page)
        page_mock.rect = fitz.Rect(0, 0, 595, 842)
        question_text = (
            "Câu 45: Ester X có công thức phân tử C4H8O2. Thủy phân X trong dung dịch H2SO4 loãng, "
            "đun nóng, thu được sản phẩm gồm propionic acid và chất hữu cơ Y. Công thức của Y là\n"
            "A. CH3OH.    B. C2H5OH.    C. CH3COOH.    D. HCOOH."
        )
        page_mock.get_text.return_value = question_text
        c_rect = fitz.Rect(40, 200, 550, 320)

        self.assertTrue(
            is_text_container_box(page_mock, c_rect),
            "Expected is_text_container_box to return True for a bordered question card"
        )

    def test_is_text_container_box_preserves_real_diagram(self):
        """Diagram with short labels (axes, apparatus, chemical names) must NOT be filtered out."""
        page_mock = MagicMock(spec=fitz.Page)
        page_mock.rect = fitz.Rect(0, 0, 595, 842)
        diagram_text = "Dung dịch NaOH 0.1M\nỐng nghiệm (1)\nNước"
        page_mock.get_text.return_value = diagram_text
        c_rect = fitz.Rect(100, 200, 300, 350)

        self.assertFalse(
            is_text_container_box(page_mock, c_rect),
            "Expected is_text_container_box to return False for genuine figure with short labels"
        )

    def test_object_graph_suppresses_asset_overlapping_question_marker(self):
        """A question must never embed a cropped image of its own stem/marker."""
        doc_rep = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            blocks=[
                TextBlock(
                    block_index=0,
                    bbox=(45.0, 150.0, 540.0, 220.0),
                    text="Câu 45: Ester X có công thức phân tử C4H8O2. Thủy phân X thu được...",
                    lines=[]
                )
            ],
            candidates=[
                QuestionCandidate(
                    candidate_number=45,
                    page_number=1,
                    bbox=(45.0, 150.0, 540.0, 220.0),
                    y_pos=150.0,
                    marker_text="Câu 45:"
                )
            ]
        )

        # Asset that was cropped from the question's text area
        text_asset = AssetRecord(
            asset_id="asset_p1_vec_text_box",
            type=AssetType.DIAGRAM_REGION,
            source_page=1,
            bbox=(40.0, 145.0, 545.0, 225.0),
            path="/tmp/asset_box.png",
            sha256="abc123hash",
            width=505,
            height=80,
            extraction_method=ExtractionMethod.CROP,
            confidence=0.9
        )

        q45 = ReconstructedQuestion(
            id="q_45",
            number=45,
            source_number=45,
            stem="Ester X có công thức phân tử C4H8O2. Thủy phân X thu được...",
            options=[],
            source_pages=[1]
        )

        graph = DocumentObjectGraph.build([doc_rep], [text_asset])
        attachments = graph.associate_assets_to_questions([q45])

        self.assertEqual(
            attachments.get("q_45", []),
            [],
            "Question 45 must NOT have any rich elements attached when asset encloses its own text"
        )

    def test_typography_banner_and_katex_rules(self):
        """Verify section banner styling (11.5pt font, larger padding) and KaTeX scaling."""
        css = LayoutSolver.generate_paged_media_css(BLUE_BLACK_CLASSIC_STYLE)

        # Section banner size and padding
        self.assertIn("font-size: 11.5pt;", css)
        self.assertIn("padding: 5.5pt 10pt;", css)

        # KaTeX font size scaling
        self.assertIn(".katex", css)
        self.assertIn("font-size: 1.05em !important;", css)

        # Base style font size
        self.assertEqual(BLUE_BLACK_CLASSIC_STYLE.font_size_pt, 10.2)
        self.assertEqual(ANSWER_GREEN_STYLE.font_size_pt, 10.2)


if __name__ == "__main__":
    unittest.main()
