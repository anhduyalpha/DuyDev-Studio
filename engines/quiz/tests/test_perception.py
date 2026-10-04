"""
Unit Tests for PDF Perception Layer (TASK-03)
Tests geometry extraction, classification (vector/mixed/scanned), candidates, and rendering.
"""

import os
import shutil
import tempfile
import unittest

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from PIL import Image

from engines.quiz.perception.models import (
    PageKind,
    PageRepresentation,
    QuestionCandidate,
    TextBlock,
    TextLine,
    TextSpan
)
from engines.quiz.perception.classifier import classify_page
from engines.quiz.perception.candidates import (
    detect_candidates_from_page,
    get_page_question_bounds,
    detect_continuation_candidate,
    get_next_page_index
)
from engines.quiz.perception.extractor import (
    extract_page_representation,
    extract_document_representations
)
from engines.quiz.perception.renderer import (
    render_page_to_image,
    render_page_to_bytes
)


class TestPerceptionLayer(unittest.TestCase):
    """Test suite for PDF perception layer components."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_perception_")

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def _create_sample_vector_pdf(self) -> fitz.Document:
        """Creates an in-memory PDF with digital vector text and questions."""
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)  # A4

        text = (
            "KỲ THI TRUNG HỌC PHỔ THÔNG QUỐC GIA\n"
            "Môn thi: HÓA HỌC\n\n"
            "Câu 1: Kim loại nào sau đây dẫn điện tốt nhất?\n"
            "A. Al.    B. Fe.    C. Ag.    D. Cu.\n\n"
            "Câu 2: Dung dịch nào sau đây làm quỳ tím chuyển màu đỏ?\n"
            "A. NaOH.  B. HCl.   C. NaCl.  D. Ba(OH)2.\n"
        )
        page.insert_text(fitz.Point(50, 70), text, fontsize=12)
        return doc

    def _create_sample_scanned_pdf(self) -> fitz.Document:
        """Creates an in-memory PDF simulating a scanned page with a full-page image."""
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)

        # Generate a temporary image to insert as full page
        img_path = os.path.join(self.temp_dir, "scanned_sample.png")
        img = Image.new("RGB", (600, 850), color=(240, 240, 240))
        img.save(img_path)

        # Insert image covering 90% of page area
        img_rect = fitz.Rect(10, 10, 585, 832)
        page.insert_image(img_rect, filename=img_path)

        # Minimal text layer (e.g. OCR artifact or page number)
        page.insert_text(fitz.Point(300, 838), "1", fontsize=10)
        return doc

    def _create_sample_mixed_pdf(self) -> fitz.Document:
        """Creates an in-memory PDF with text plus vector drawings and a small figure."""
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)

        # Insert text
        text = (
            "Câu 3: Cho sơ đồ thí nghiệm như hình vẽ bên dưới.\n"
            "Chất khí X thu được trong bình tam giác là gì?\n"
            "A. CO2.   B. SO2.   C. H2.   D. Cl2.\n"
        )
        page.insert_text(fitz.Point(50, 70), text, fontsize=12)

        # Draw vector rectangle and circle (drawings)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(100, 200, 300, 350))
        shape.finish(color=(0, 0, 0), width=1)
        shape.commit()
        return doc

    def test_classifier_rules(self):
        """Tests deterministic classification logic for vector, scanned, mixed, and unknown."""
        # Pure vector: High text, no image
        self.assertEqual(
            classify_page(character_count=500, image_area_ratio=0.0, has_images=False, drawing_count=0),
            PageKind.VECTOR
        )

        # Pure scanned: Very low text, heavy image coverage (> 55%)
        # Rule 21: Never raises error, must return SCANNED
        self.assertEqual(
            classify_page(character_count=10, image_area_ratio=0.85, has_images=True, drawing_count=0),
            PageKind.SCANNED
        )

        # Mixed: High text with images or drawings
        self.assertEqual(
            classify_page(character_count=350, image_area_ratio=0.2, has_images=True, drawing_count=2),
            PageKind.MIXED
        )

        # Unknown / Empty page
        self.assertEqual(
            classify_page(character_count=5, image_area_ratio=0.0, has_images=False, drawing_count=0),
            PageKind.UNKNOWN
        )

    def test_vector_pdf_extraction(self):
        """Tests extracting structured representation from digital vector PDF."""
        doc = self._create_sample_vector_pdf()
        rep = extract_page_representation(doc, 0)

        self.assertEqual(rep.page_index, 0)
        self.assertEqual(rep.page_number, 1)
        self.assertAlmostEqual(rep.width, 595.0, delta=1.0)
        self.assertAlmostEqual(rep.height, 842.0, delta=1.0)
        self.assertGreater(rep.character_count, 50)
        self.assertEqual(rep.page_kind, PageKind.VECTOR)
        self.assertGreaterEqual(len(rep.blocks), 1)

        # Check detected candidates
        cand_nums = [c.candidate_number for c in rep.candidates]
        self.assertIn(1, cand_nums)
        self.assertIn(2, cand_nums)

    def test_scanned_pdf_extraction(self):
        """Tests extracting scanned PDF without throwing errors (Rule 21 compliance)."""
        doc = self._create_sample_scanned_pdf()
        rep = extract_page_representation(doc, 0)

        self.assertEqual(rep.page_kind, PageKind.SCANNED)
        self.assertGreater(rep.image_area_ratio, 0.55)
        self.assertLess(rep.character_count, 60)
        self.assertGreater(len(rep.images), 0)

    def test_mixed_pdf_extraction(self):
        """Tests extracting mixed PDF with drawings."""
        doc = self._create_sample_mixed_pdf()
        rep = extract_page_representation(doc, 0)

        self.assertEqual(rep.page_kind, PageKind.MIXED)
        self.assertGreater(rep.drawing_count, 0)
        self.assertGreater(rep.character_count, 50)

    def test_candidate_detection_and_options(self):
        """Tests detecting question markers and option letters from text blocks."""
        blocks = [
            TextBlock(
                block_index=0,
                bbox=(50.0, 100.0, 500.0, 150.0),
                lines=[
                    TextLine(
                        bbox=(50.0, 100.0, 500.0, 120.0),
                        spans=[TextSpan(text="Câu 10: Este X có công thức phân tử C4H8O2.", bbox=(50.0, 100.0, 500.0, 120.0))],
                        text="Câu 10: Este X có công thức phân tử C4H8O2."
                    ),
                    TextLine(
                        bbox=(50.0, 125.0, 500.0, 145.0),
                        spans=[TextSpan(text="A. etyl axetat.  B. metyl fomat.  C. metyl axetat.  D. propyl fomat.", bbox=(50.0, 125.0, 500.0, 145.0))],
                        text="A. etyl axetat.  B. metyl fomat.  C. metyl axetat.  D. propyl fomat."
                    )
                ],
                text="Câu 10: Este X có công thức phân tử C4H8O2.\nA. etyl axetat.  B. metyl fomat.  C. metyl axetat.  D. propyl fomat."
            )
        ]

        candidates = detect_candidates_from_page(blocks)
        self.assertEqual(len(candidates), 1)
        c = candidates[0]
        self.assertEqual(c.candidate_number, 10)
        self.assertIn("Câu 10", c.marker_text)
        self.assertEqual(c.options_detected, ["A", "B", "C", "D"])

    def test_page_question_bounds_and_continuation(self):
        """Tests first/last question bound extraction and page continuation heuristic."""
        page1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            character_count=300,
            candidates=[
                QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(0, 100, 500, 120), y_pos=100.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=2, marker_text="Câu 2:", bbox=(0, 600, 500, 620), y_pos=600.0, options_detected=["A", "B"])  # Missing C, D
            ]
        )

        first_q, last_q = get_page_question_bounds(page1)
        self.assertEqual(first_q, 1)
        self.assertEqual(last_q, 2)

        # Page 2 starts with continuing options C and D
        page2 = PageRepresentation(
            page_index=1,
            page_number=2,
            width=595.0,
            height=842.0,
            character_count=150,
            blocks=[
                TextBlock(
                    block_index=0,
                    bbox=(50.0, 50.0, 500.0, 70.0),
                    lines=[],
                    text="C. Axit axetic.   D. Etanol."
                )
            ],
            candidates=[
                QuestionCandidate(candidate_number=3, marker_text="Câu 3:", bbox=(0, 200, 500, 220), y_pos=200.0, options_detected=["A", "B", "C", "D"])
            ]
        )

        is_cont = detect_continuation_candidate(page1, page2)
        self.assertTrue(is_cont)
        self.assertEqual(get_next_page_index(0, 2), 1)
        self.assertIsNone(get_next_page_index(1, 2))

    def test_renderer_output(self):
        """Tests rendering page to PNG image and bytes."""
        doc = self._create_sample_vector_pdf()

        # Render to image file
        img_path = render_page_to_image(doc, 0, self.temp_dir, dpi=150)
        self.assertTrue(os.path.exists(img_path))
        self.assertTrue(img_path.endswith(".png"))
        self.assertGreater(os.path.getsize(img_path), 500)

        # Render to bytes
        img_bytes = render_page_to_bytes(doc, 0, dpi=150)
        self.assertIsInstance(img_bytes, bytes)
        self.assertTrue(img_bytes.startswith(b"\x89PNG\r\n\x1a\n"))


if __name__ == "__main__":
    unittest.main()
