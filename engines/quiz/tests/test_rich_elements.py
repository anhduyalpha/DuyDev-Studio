"""
Unit Tests for Rich Element Source Cropper (TASK-07)
Tests cropping visual regions directly from PDF pages at 250 DPI and coordinate clamping.
"""

import os
import shutil
import tempfile
import unittest

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.perception.models import ExtractedImage
from engines.quiz.ir.rich_elements import (
    crop_pdf_region,
    find_matching_images_for_question,
    extract_rich_elements_for_question
)
from engines.quiz.ir.models import RichElementType


class TestRichElements(unittest.TestCase):
    """Test suite for high-res PDF cropping and rich element management."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_crops_")
        # Create an in-memory test PDF with a drawn diagram
        self.doc = fitz.open()
        self.page = self.doc.new_page(width=595, height=842)

        # Draw a black box representing a diagram at (100, 200, 300, 350)
        shape = self.page.new_shape()
        shape.draw_rect(fitz.Rect(100, 200, 300, 350))
        shape.finish(color=(0, 0, 0), fill=(0.8, 0.8, 0.8), width=2)
        shape.commit()

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        self.doc.close()

    def test_crop_pdf_region_valid_png(self):
        """Tests that crop_pdf_region produces a valid high-resolution PNG file."""
        bbox = (100.0, 200.0, 300.0, 350.0)
        crop_path = crop_pdf_region(
            doc=self.doc,
            page_number=1,
            bbox=bbox,
            output_dir=self.temp_dir,
            dpi=250
        )

        self.assertTrue(os.path.exists(crop_path))
        self.assertTrue(crop_path.endswith(".png"))
        self.assertGreater(os.path.getsize(crop_path), 500)

        # Verify PNG signature
        with open(crop_path, "rb") as f:
            header = f.read(8)
            self.assertEqual(header, b"\x89PNG\r\n\x1a\n")

    def test_crop_coordinate_clamping_safety(self):
        """Tests that coordinates exceeding page bounds are safely clamped without crashing."""
        # Bbox exceeding page dimensions (negative and > 1000)
        extreme_bbox = (-50.0, -100.0, 800.0, 1000.0)
        crop_path = crop_pdf_region(
            doc=self.doc,
            page_number=1,
            bbox=extreme_bbox,
            output_dir=self.temp_dir,
            dpi=150
        )

        self.assertTrue(os.path.exists(crop_path))
        self.assertGreater(os.path.getsize(crop_path), 0)

    def test_find_matching_images_for_question(self):
        """Tests identifying images geometrically located inside or under a question."""
        q_bbox = (50.0, 100.0, 500.0, 180.0)

        img_inside = ExtractedImage(
            image_id="img_in", xref=1, bbox=(100.0, 120.0, 250.0, 170.0),
            width=150, height=50
        )
        img_below = ExtractedImage(
            image_id="img_bel", xref=2, bbox=(100.0, 190.0, 300.0, 250.0),
            width=200, height=60
        )
        img_far = ExtractedImage(
            image_id="img_far", xref=3, bbox=(100.0, 600.0, 300.0, 700.0),
            width=200, height=100
        )

        matched = find_matching_images_for_question(
            question_bbox=q_bbox,
            page_images=[img_inside, img_below, img_far],
            vertical_distance_threshold=100.0
        )

        matched_ids = [m.image_id for m in matched]
        self.assertIn("img_in", matched_ids)
        self.assertIn("img_bel", matched_ids)
        self.assertNotIn("img_far", matched_ids)

    def test_extract_rich_elements_for_question(self):
        """Tests packaging rich elements with source crop paths."""
        elements = extract_rich_elements_for_question(
            doc=self.doc,
            question_id="q10",
            page_number=1,
            bboxes=[(100.0, 200.0, 300.0, 350.0)],
            output_dir=self.temp_dir,
            dpi=200
        )

        self.assertEqual(len(elements), 1)
        el = elements[0]
        self.assertEqual(el.type, RichElementType.IMAGE_CROP)
        self.assertTrue(os.path.exists(el.source_crop_path))
        self.assertEqual(el.page_number, 1)


if __name__ == "__main__":
    unittest.main()
