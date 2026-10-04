"""
Unit & Integration Tests for PLAN-01 (Rich Assets & Document Object Graph)
Tests TASK-01 and TASK-02 requirements:
1. Embedded raster image extraction and provenance (sha256, bbox, dims).
2. Vector drawing clustering and high-resolution 250 DPI cropping.
3. Spatial proximity, vertical containment, and textual cue boosting.
4. Cross-page question asset association.
5. Text-only document regression (zero rich elements, zero disruption).
6. Ambiguous asset boundary handling with selective Agnes AI fallback.
7. End-to-end provenance propagation into Canonical Document IR.
"""

import hashlib
import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.assets.models import AssetRecord, AssetType, ExtractionMethod
from engines.quiz.assets.extractor import RichAssetExtractor
from engines.quiz.graph.models import (
    ObjectType,
    AssociationRole,
    RichElementAttachment,
    GraphObject
)
from engines.quiz.graph.object_graph import DocumentObjectGraph, AmbiguityCandidateChoice
from engines.quiz.perception.models import (
    PageRepresentation,
    TextBlock,
    TextLine,
    TextSpan,
    QuestionCandidate,
    PageKind
)
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionOption,
    QuestionType
)
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    AnswerKeyIR,
    RichElementType,
    SectionType
)
from engines.quiz.ir.builder import CanonicalIRBuilder


class TestPlan01AssetsAndObjectGraph(unittest.TestCase):
    """Test suite for TASK-01 Rich Asset Extraction and TASK-02 Document Object Graph."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_plan01_")

    def tearDown(self):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_01_raster_image_extraction_provenance(self):
        """TASK-01: Verifies embedded raster extraction with sha256, bbox, and dimensions."""
        # Create PDF with an inserted image
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)

        # Create a small 60x40 RGB pixmap
        img_pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 60, 40), 0)
        img_pix.clear_with(255)
        # Draw some colored pixels
        for x in range(20):
            for y in range(20):
                img_pix.set_pixel(x, y, (255, 0, 0))

        img_rect = fitz.Rect(100, 150, 250, 250)
        page.insert_image(img_rect, pixmap=img_pix)

        output_dir = os.path.join(self.temp_dir, "assets_raster")
        extractor = RichAssetExtractor(output_dir=output_dir, dpi=250)
        assets = extractor.extract_all(doc)
        doc.close()

        self.assertEqual(len(assets), 1)
        rec = assets[0]
        self.assertEqual(rec.type, AssetType.RASTER)
        self.assertEqual(rec.source_page, 1)
        self.assertEqual(rec.extraction_method, ExtractionMethod.EMBEDDED)
        self.assertTrue(os.path.exists(rec.path))
        self.assertGreater(rec.width, 0)
        self.assertGreater(rec.height, 0)

        # Verify sha256
        with open(rec.path, "rb") as f:
            computed_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(rec.sha256, computed_sha)
        self.assertAlmostEqual(rec.bbox[0], 100.0, places=1)
        self.assertAlmostEqual(rec.bbox[1], 150.0, places=1)

    def test_02_vector_drawing_clustering_and_crop(self):
        """TASK-01: Verifies clustering of vector drawing elements into a diagram crop."""
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)

        # Draw a compound diagram (3 adjacent geometric boxes representing a reaction cycle)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(120, 300, 200, 360))
        shape.finish(color=(0, 0, 0), fill=(0.9, 0.9, 0.9), width=1.5)
        shape.draw_line(fitz.Point(200, 330), fitz.Point(250, 330))
        shape.finish(color=(0, 0, 0), width=1.5)
        shape.draw_rect(fitz.Rect(250, 300, 330, 360))
        shape.finish(color=(0, 0, 0), fill=(0.9, 0.9, 0.9), width=1.5)
        shape.commit()

        output_dir = os.path.join(self.temp_dir, "assets_vector")
        extractor = RichAssetExtractor(output_dir=output_dir, dpi=250)
        assets = extractor.extract_all(doc)
        doc.close()

        self.assertGreaterEqual(len(assets), 1)
        vec_asset = assets[0]
        self.assertIn(vec_asset.type, (AssetType.VECTOR_REGION, AssetType.DIAGRAM_REGION))
        self.assertEqual(vec_asset.source_page, 1)
        self.assertEqual(vec_asset.extraction_method, ExtractionMethod.CROP)
        self.assertTrue(os.path.exists(vec_asset.path))
        self.assertGreater(vec_asset.width, 0)
        self.assertGreater(vec_asset.height, 0)

        # Check that cropped bounding box encloses the drawings
        self.assertLessEqual(vec_asset.bbox[0], 120.0)
        self.assertGreaterEqual(vec_asset.bbox[2], 330.0)

    def test_03_deterministic_question_asset_association(self):
        """TASK-02: Verifies spatial containment and association between questions and visual assets."""
        # Setup PageRepresentation with 2 questions
        blocks = [
            TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 130.0), text="Câu 1: Cho sơ đồ chuyển hóa sau đây..."),
            TextBlock(block_index=1, bbox=(50.0, 250.0, 500.0, 270.0), text="A. Chất X   B. Chất Y   C. Chất Z   D. Chất T"),
            TextBlock(block_index=2, bbox=(50.0, 320.0, 500.0, 350.0), text="Câu 2: Phát biểu nào sau đây là đúng?"),
            TextBlock(block_index=3, bbox=(50.0, 360.0, 500.0, 390.0), text="A. Đúng   B. Sai   C. Không rõ   D. Tùy trường hợp"),
        ]
        candidates = [
            QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50.0, 100.0, 150.0, 120.0), y_pos=100.0),
            QuestionCandidate(candidate_number=2, marker_text="Câu 2:", bbox=(50.0, 320.0, 150.0, 340.0), y_pos=320.0),
        ]
        page_rep = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            raw_text="...",
            blocks=blocks,
            candidates=candidates,
            page_kind=PageKind.MIXED
        )

        # Asset placed between Câu 1 stem and its options (y: 140..230)
        asset_file = os.path.join(self.temp_dir, "asset1.png")
        with open(asset_file, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"mockdata")

        asset = AssetRecord(
            asset_id="asset_q1_scheme",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(80.0, 140.0, 480.0, 230.0),
            path=asset_file,
            sha256="abcd1234",
            width=800,
            height=200,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[page_rep], asset_records=[asset])

        questions = [
            ReconstructedQuestion(
                id="q1",
                number=1,
                source_number=1,
                source_pages=[1],
                stem="Cho sơ đồ chuyển hóa sau đây..."
            ),
            ReconstructedQuestion(
                id="q2",
                number=2,
                source_number=2,
                source_pages=[1],
                stem="Phát biểu nào sau đây là đúng?"
            )
        ]

        attachments = graph.associate_assets_to_questions(questions)

        # Question 1 must have the asset
        self.assertEqual(len(attachments["q1"]), 1)
        att = attachments["q1"][0]
        self.assertEqual(att.asset_id, "asset_q1_scheme")
        self.assertEqual(att.role, AssociationRole.REACTION_SCHEME)
        self.assertGreaterEqual(att.confidence, 0.95)

        # Question 2 must have NO assets
        self.assertEqual(len(attachments["q2"]), 0)

    def test_04_cross_page_question_association(self):
        """TASK-02: Verifies that a question spanning page 1 and page 2 retains assets from page 2."""
        # Page 1: Question 5 starts near bottom (y: 720..800)
        cand_q5 = QuestionCandidate(candidate_number=5, marker_text="Câu 5:", bbox=(50.0, 720.0, 150.0, 740.0), y_pos=720.0)
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            candidates=[cand_q5],
            blocks=[TextBlock(block_index=0, bbox=(50.0, 720.0, 500.0, 780.0), text="Câu 5: Cho cấu trúc phân tử sau đây...")],
            page_kind=PageKind.MIXED
        )

        # Page 2: Question 5 continues with figure and options at top (y: 40..160), Question 6 starts at y=250
        cand_q6 = QuestionCandidate(candidate_number=6, marker_text="Câu 6:", bbox=(50.0, 250.0, 150.0, 270.0), y_pos=250.0)
        p2 = PageRepresentation(
            page_index=1,
            page_number=2,
            width=595.0,
            height=842.0,
            candidates=[cand_q6],
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 170.0, 500.0, 200.0), text="A. Đồng phân cis   B. Đồng phân trans"),
                TextBlock(block_index=1, bbox=(50.0, 250.0, 500.0, 280.0), text="Câu 6: Chất nào sau đây là este no?")
            ],
            page_kind=PageKind.MIXED
        )

        # Asset placed on Page 2 at y: 50..150 (above Question 5's options, before Question 6)
        asset_file = os.path.join(self.temp_dir, "asset_p2.png")
        with open(asset_file, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"mockdata2")

        asset = AssetRecord(
            asset_id="asset_cross_p2",
            type=AssetType.RASTER,
            source_page=2,
            bbox=(100.0, 50.0, 450.0, 150.0),
            path=asset_file,
            sha256="ef5678",
            width=600,
            height=200,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[p1, p2], asset_records=[asset])

        questions = [
            ReconstructedQuestion(
                id="q5",
                number=5,
                source_number=5,
                source_pages=[1, 2],  # Spans across page 1 and page 2
                stem="Cho cấu trúc phân tử sau đây..."
            ),
            ReconstructedQuestion(
                id="q6",
                number=6,
                source_number=6,
                source_pages=[2],
                stem="Chất nào sau đây là este no?"
            )
        ]

        attachments = graph.associate_assets_to_questions(questions)

        # Asset on page 2 MUST be correctly attached to Question 5 (started on page 1)
        self.assertEqual(len(attachments["q5"]), 1)
        self.assertEqual(attachments["q5"][0].asset_id, "asset_cross_p2")
        self.assertEqual(len(attachments["q6"]), 0)

    def test_05_text_only_regression(self):
        """TASK-02: Verifies that pure text documents produce zero rich elements and zero disruption."""
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 130.0), text="Câu 1: Chất nào sau đây là kim loại kiềm?"),
                TextBlock(block_index=1, bbox=(50.0, 140.0, 500.0, 160.0), text="A. Na   B. Fe   C. Cu   D. Al")
            ],
            page_kind=PageKind.VECTOR
        )

        # Zero visual assets
        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[])

        q1 = ReconstructedQuestion(
            id="q1",
            number=1,
            source_number=1,
            source_pages=[1],
            stem="Chất nào sau đây là kim loại kiềm?",
            options=[QuestionOption(label="A", text="Na"), QuestionOption(label="B", text="Fe")]
        )

        attachments = graph.associate_assets_to_questions([q1])
        self.assertEqual(len(attachments), 0)

        # Verify CanonicalIRBuilder builds cleanly with zero rich elements
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q1],
            doc_reps=[p1],
            answers=[AnswerKeyIR(question_id="q1", question_number=1, selected_answer="A", evidence="Na là kim loại kiềm nhóm IA.")],
            rich_element_attachments=attachments
        )

        self.assertEqual(len(doc_ir.questions), 1)
        self.assertEqual(len(doc_ir.questions[0].rich_elements), 0)
        self.assertEqual(doc_ir.questions[0].options[0].text, "Na")

    def test_06_ambiguous_asset_selective_ai_resolution(self):
        """TASK-02: Verifies selective AI resolver when an asset lies in a contested boundary."""
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 120.0), text="Câu 14: Chất béo T được tìm thấy trong thịt bò..."),
                TextBlock(block_index=1, bbox=(50.0, 200.0, 500.0, 220.0), text="Câu 15: Sơ đồ bên biểu diễn một phân tử..."),
            ],
            page_kind=PageKind.MIXED
        )

        asset_file = os.path.join(self.temp_dir, "ambiguous_asset.png")
        with open(asset_file, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"ambiguous")

        # Asset located right at the boundary (y: 180..220)
        asset = AssetRecord(
            asset_id="asset_ambig_14_15",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(100.0, 180.0, 400.0, 220.0),
            path=asset_file,
            sha256="ambig789",
            width=500,
            height=100,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[asset])

        q14 = ReconstructedQuestion(id="q14", number=14, source_number=14, source_pages=[1], stem="Chất béo T được tìm thấy...")
        q15 = ReconstructedQuestion(id="q15", number=15, source_number=15, source_pages=[1], stem="Sơ đồ bên biểu diễn một phân tử...")

        # Mock AI Provider returning structured resolution
        mock_provider = MagicMock()
        mock_provider.generate_structured.return_value = AmbiguityCandidateChoice(
            selected_question_number=15,
            role="reaction_scheme",
            confidence=0.98
        )

        attachments = graph.associate_assets_to_questions([q14, q15], ai_provider=mock_provider)

        # Asset should be resolved to Question 15
        self.assertEqual(len(attachments["q14"]), 0)
        self.assertEqual(len(attachments["q15"]), 1)
        self.assertEqual(attachments["q15"][0].asset_id, "asset_ambig_14_15")
        mock_provider.generate_structured.assert_called_once()

    def test_07_provenance_and_ir_builder_integration(self):
        """TASK-02: Verifies that RichElementIR and spatial provenance propagate cleanly into CanonicalDocumentIR."""
        asset_file = os.path.join(self.temp_dir, "asset_chem.png")
        with open(asset_file, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"chem_data")

        asset_rec = AssetRecord(
            asset_id="asset_q1_diag",
            type=AssetType.DIAGRAM_REGION,
            source_page=1,
            bbox=(80.0, 150.0, 450.0, 260.0),
            path=asset_file,
            sha256="chemsha123",
            width=700,
            height=250,
            extraction_method=ExtractionMethod.CROP
        )

        att = RichElementAttachment(
            asset_id="asset_q1_diag",
            role=AssociationRole.REACTION_SCHEME,
            position="after_stem",
            confidence=0.99,
            caption="Hình 1. Sơ đồ điều chế",
            asset_record=asset_rec
        )

        p1 = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        q1 = ReconstructedQuestion(
            id="q1",
            number=1,
            source_number=1,
            source_pages=[1],
            stem="Sơ đồ điều chế khí X trong phòng thí nghiệm:",
            options=[QuestionOption(label="A", text="O2"), QuestionOption(label="B", text="CO2")]
        )

        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q1],
            doc_reps=[p1],
            answers=[AnswerKeyIR(question_id="q1", question_number=1, selected_answer="A", evidence="O2 sinh ra từ KMnO4.")],
            rich_element_attachments={"q1": [att]}
        )

        question_ir = doc_ir.questions[0]
        self.assertEqual(len(question_ir.rich_elements), 1)
        rich_el = question_ir.rich_elements[0]
        self.assertEqual(rich_el.type, RichElementType.DIAGRAM_VECTOR)
        self.assertEqual(rich_el.source_crop_path, asset_file)
        self.assertEqual(rich_el.caption, "Hình 1. Sơ đồ điều chế")
        self.assertEqual(rich_el.bbox, (80.0, 150.0, 450.0, 260.0))
        self.assertEqual(rich_el.page_number, 1)

        # Provenance bboxes must preserve the asset's bbox
        self.assertIn((80.0, 150.0, 450.0, 260.0), question_ir.provenance.bboxes)

    def test_08_real_pdf_asset_extraction_and_association(self):
        """PLAN-01 Golden Reference: Tests real sample PDF with reaction schemes & molecular figures."""
        real_pdf_candidates = [
            r"C:/Users/AnhDuy/.gemini/antigravity/brain/f31e07e6-2add-4d5a-99b4-c836ae398ac9/.user_uploaded/media_1791096031928.pdf",
            r"C:/Users/AnhDuy/.gemini/antigravity/brain/f31e07e6-2add-4d5a-99b4-c836ae398ac9/.user_uploaded/media_1791096031925.pdf",
        ]
        target_pdf = next((p for p in real_pdf_candidates if os.path.exists(p)), None)
        if not target_pdf:
            self.skipTest("Real reference PDF not found in environment, skipping golden regression.")

        output_dir = os.path.join(self.temp_dir, "real_pdf_assets")
        doc = fitz.open(target_pdf)
        extractor = RichAssetExtractor(output_dir=output_dir, dpi=250)
        assets = extractor.extract_all(doc)
        doc.close()

        # Must extract multiple rich assets
        self.assertGreaterEqual(len(assets), 4)
        for a in assets:
            self.assertTrue(os.path.exists(a.path))
            self.assertGreater(a.width, 0)
            self.assertGreater(a.height, 0)
            self.assertEqual(len(a.sha256), 64)

        # Test object graph association with questions
        from engines.quiz.perception.extractor import extract_document_representations
        doc_reps = extract_document_representations(target_pdf)
        graph = DocumentObjectGraph.build(doc_reps=doc_reps, asset_records=assets)

        mock_qs = [
            ReconstructedQuestion(id="q1", number=1, source_number=1, source_pages=[1], stem="Câu 1: Câu 14. Chất béo T được tìm thấy trong thịt bò..."),
            ReconstructedQuestion(id="q2", number=2, source_number=2, source_pages=[1], stem="Câu 2: Câu 15. Sơ đồ bên biểu diễn một phân tử chất hữu cơ X..."),
        ]
        attachments = graph.associate_assets_to_questions(mock_qs)

        # Question 2 references "Sơ đồ bên" and must retain its figure
        self.assertGreaterEqual(len(attachments["q2"]), 1)
        q2_att = attachments["q2"][0]
        self.assertEqual(q2_att.role, AssociationRole.REACTION_SCHEME)
        self.assertGreaterEqual(q2_att.confidence, 0.95)


if __name__ == "__main__":
    unittest.main()
