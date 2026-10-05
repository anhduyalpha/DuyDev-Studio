"""
Regression and Invariant Test Suite for Visual Asset Association
Tests the critical bugfix for rich-asset/question association:
1. Golden regression on Gốc.pdf:
   - Q46.rich_elements == []
   - Q47 contains Triglyceride X/Y asset
   - Q48 contains reaction scheme
   - Q50 contains fatty-acid structure (ARA)
   - Q49.rich_elements == []
2. Question with image (Q41 with Linoleic acid).
3. Question without image next to an image question (Q40, Q42, Q46, Q49).
4. Two consecutive questions both containing images (Q47 and Q48).
5. Cross-page image (Q41 spanning P1..P2 with image on P2; Q46 continuing to P3 without owning P3 images).
6. Image near page boundary.
7. Multiple images in one question (preserved without duplication or loss).
8. Strict Agnes hallucination validation (invented question/asset IDs rejected).
9. End-to-end DeBai PDF compilation with image verification.
"""

import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock
import pymupdf

from engines.quiz.assets.models import AssetRecord, AssetType, ExtractionMethod
from engines.quiz.assets.extractor import RichAssetExtractor
from engines.quiz.graph.models import (
    AssociationRole,
    RichElementAttachment,
    AssetOwnership,
    ObjectType
)
from engines.quiz.graph.object_graph import DocumentObjectGraph, AmbiguityCandidateChoice
from engines.quiz.perception.models import (
    PageRepresentation,
    TextBlock,
    QuestionCandidate,
    PageKind
)
from engines.quiz.perception.extractor import extract_document_representations
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
from engines.quiz.rendering.compiler import PDFCompiler
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE


class TestRegressionAssetAssociation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.goc_pdf_path = os.path.abspath(".tmp/Diff check/Gốc.pdf")
        cls.has_goc = os.path.isfile(cls.goc_pdf_path)
        if cls.has_goc:
            cls.doc_reps = extract_document_representations(cls.goc_pdf_path)
            cls.temp_assets_dir = tempfile.mkdtemp(prefix="reg_goc_assets_")
            fitz_doc = pymupdf.open(cls.goc_pdf_path)
            extractor = RichAssetExtractor(output_dir=cls.temp_assets_dir, dpi=250)
            cls.extracted_assets = extractor.extract_all(fitz_doc)
            fitz_doc.close()
        else:
            cls.doc_reps = []
            cls.extracted_assets = []

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "temp_assets_dir") and os.path.exists(cls.temp_assets_dir):
            shutil.rmtree(cls.temp_assets_dir, ignore_errors=True)

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_asset_assoc_")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_01_golden_goc_q35_q46_q46_has_zero_rich_elements(self):
        """Golden Regression: When Q35..Q46 is processed, Q46 must have ZERO rich elements."""
        if not self.has_goc:
            self.skipTest("Gốc.pdf not available on disk.")

        graph = DocumentObjectGraph.build(
            doc_reps=self.doc_reps,
            asset_records=self.extracted_assets
        )

        default_opts = [
            QuestionOption(label="A", text="Option A"),
            QuestionOption(label="B", text="Option B"),
            QuestionOption(label="C", text="Option C"),
            QuestionOption(label="D", text="Option D"),
        ]
        qs = [
            ReconstructedQuestion(
                id=f"q_{i}",
                number=i,
                source_number=i,
                type=QuestionType.PART_I_MCQ,
                stem=f"Câu {i} stem text...",
                options=list(default_opts),
                source_pages=[1] if i <= 41 else ([2, 3] if i == 46 else [2])
            )
            for i in range(35, 47)
        ]

        attachments = graph.associate_assets_to_questions(qs)

        # Q46 must have strictly ZERO attachments
        self.assertEqual(len(attachments["q_46"]), 0, "Q46 must have ZERO attachments from Page 3!")

        # Q41 must have Linoleic acid attachment
        self.assertEqual(len(attachments["q_41"]), 1, "Q41 must retain Linoleic acid on Page 2!")

        # Verify CanonicalIRBuilder enforces IR invariant: Q46.rich_elements == []
        meta = DocumentMetadataIR(
            title="BÀI TẬP",
            subject="HÓA HỌC",
            total_questions=len(qs),
            created_at="2026-10-05T00:00:00Z"
        )
        answers = [
            AnswerKeyIR(question_id=q.id, question_number=q.number, selected_answer="A")
            for q in qs
        ]
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=qs,
            doc_reps=self.doc_reps,
            answers=answers,
            metadata=meta,
            rich_element_attachments=attachments
        )

        q46_ir = next(q for q in doc_ir.questions if q.number == 46)
        self.assertEqual(q46_ir.rich_elements, [], "IR Invariant: Q46.rich_elements must be strictly empty!")

        q41_ir = next(q for q in doc_ir.questions if q.number == 41)
        self.assertEqual(len(q41_ir.rich_elements), 1, "Q41 must have Linoleic acid rich element!")

    def test_02_golden_goc_q46_to_q50_correct_ownership_partitioning(self):
        """Golden Regression: When Q46..Q50 is processed, Q46 has [], Q47 has Triglyceride, Q48 has Scheme, Q50 has ARA."""
        if not self.has_goc:
            self.skipTest("Gốc.pdf not available on disk.")

        graph = DocumentObjectGraph.build(
            doc_reps=self.doc_reps,
            asset_records=self.extracted_assets
        )

        default_opts = [
            QuestionOption(label="A", text="Option A"),
            QuestionOption(label="B", text="Option B"),
            QuestionOption(label="C", text="Option C"),
            QuestionOption(label="D", text="Option D"),
        ]
        q46 = ReconstructedQuestion(
            id="q_46",
            number=46,
            source_number=46,
            type=QuestionType.PART_I_MCQ,
            stem="Chất hữu cơ G được dùng phổ biến trong lĩnh vực mĩ phẩm...",
            options=list(default_opts),
            source_pages=[2, 3]
        )
        q47 = ReconstructedQuestion(
            id="q_47",
            number=47,
            source_number=47,
            type=QuestionType.PART_I_MCQ,
            stem="Cho các triglyceride X, Y với công thức cấu tạo sau: [hình]",
            options=list(default_opts),
            source_pages=[3]
        )
        q48 = ReconstructedQuestion(
            id="q_48",
            number=48,
            source_number=48,
            type=QuestionType.PART_I_MCQ,
            stem="Cho sơ đồ phản ứng của chất béo X như sau: [sơ đồ]",
            options=list(default_opts),
            source_pages=[3]
        )
        q49 = ReconstructedQuestion(
            id="q_49",
            number=49,
            source_number=49,
            type=QuestionType.PART_I_MCQ,
            stem="Cho các phát biểu sau đây: a) Các triglyceride...",
            options=list(default_opts),
            source_pages=[3]
        )
        q50 = ReconstructedQuestion(
            id="q_50",
            number=50,
            source_number=50,
            type=QuestionType.PART_I_MCQ,
            stem="Arachidonic acid (ARA) là một acid béo thiết yếu... ARA có công thức cấu tạo như hình dưới:",
            options=list(default_opts),
            source_pages=[3]
        )

        qs = [q46, q47, q48, q49, q50]
        attachments = graph.associate_assets_to_questions(qs)

        # 1. Q46 must have ZERO attachments
        self.assertEqual(len(attachments["q_46"]), 0, "Q46 must have NO attachments!")

        # 2. Q47 must have Triglyceride X/Y asset (asset_p3_img_115_0)
        self.assertEqual(len(attachments["q_47"]), 1, "Q47 must have exactly 1 Triglyceride asset!")
        self.assertEqual(attachments["q_47"][0].asset_id, "asset_p3_img_115_0")

        # 3. Q48 must have reaction scheme (asset_p3_img_117_0)
        self.assertEqual(len(attachments["q_48"]), 1, "Q48 must have exactly 1 reaction scheme asset!")
        self.assertEqual(attachments["q_48"][0].asset_id, "asset_p3_img_117_0")
        self.assertEqual(attachments["q_48"][0].role, AssociationRole.REACTION_SCHEME)

        # 4. Q49 must have ZERO attachments
        self.assertEqual(len(attachments["q_49"]), 0, "Q49 must have NO attachments!")

        # 5. Q50 must have fatty-acid structure (asset_p3_img_119_0)
        q50_asset_ids = [a.asset_id for a in attachments["q_50"]]
        self.assertIn("asset_p3_img_119_0", q50_asset_ids, "Q50 must contain ARA fatty-acid structure!")

        # IR Invariant Verification
        meta = DocumentMetadataIR(
            title="BÀI TẬP",
            subject="HÓA HỌC",
            total_questions=len(qs),
            created_at="2026-10-05T00:00:00Z"
        )
        answers = [
            AnswerKeyIR(question_id=q.id, question_number=q.number, selected_answer="A")
            for q in qs
        ]
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=qs,
            doc_reps=self.doc_reps,
            answers=answers,
            metadata=meta,
            rich_element_attachments=attachments
        )

        ir_46 = next(q for q in doc_ir.questions if q.number == 46)
        ir_47 = next(q for q in doc_ir.questions if q.number == 47)
        ir_48 = next(q for q in doc_ir.questions if q.number == 48)
        ir_49 = next(q for q in doc_ir.questions if q.number == 49)
        ir_50 = next(q for q in doc_ir.questions if q.number == 50)

        self.assertEqual(ir_46.rich_elements, [])
        self.assertEqual(len(ir_47.rich_elements), 1)
        self.assertEqual(len(ir_48.rich_elements), 1)
        self.assertEqual(ir_49.rich_elements, [])
        self.assertGreaterEqual(len(ir_50.rich_elements), 1)

    def test_03_two_consecutive_questions_both_with_images(self):
        """Test two consecutive questions each containing its own visual asset without cross-contamination."""
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            candidates=[
                QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50.0, 100.0, 150.0, 120.0), y_pos=100.0),
                QuestionCandidate(candidate_number=2, marker_text="Câu 2:", bbox=(50.0, 300.0, 150.0, 320.0), y_pos=300.0),
            ],
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 130.0), text="Câu 1: Cho sơ đồ phản ứng 1:"),
                TextBlock(block_index=1, bbox=(50.0, 300.0, 500.0, 330.0), text="Câu 2: Cho sơ đồ phản ứng 2:"),
            ],
            page_kind=PageKind.MIXED
        )

        asset1_path = os.path.join(self.temp_dir, "asset1.png")
        asset2_path = os.path.join(self.temp_dir, "asset2.png")
        for path in (asset1_path, asset2_path):
            with open(path, "wb") as f:
                f.write(b"\x89PNG\r\n\x1a\n" + b"img")

        # Asset 1 belongs to Q1 (y: 140..220)
        asset1 = AssetRecord(
            asset_id="asset_q1",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(80.0, 140.0, 450.0, 220.0),
            path=asset1_path,
            sha256="h1",
            width=400,
            height=100,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        # Asset 2 belongs to Q2 (y: 340..420)
        asset2 = AssetRecord(
            asset_id="asset_q2",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(80.0, 340.0, 450.0, 420.0),
            path=asset2_path,
            sha256="h2",
            width=400,
            height=100,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[asset1, asset2])
        q1 = ReconstructedQuestion(id="q1", number=1, source_number=1, source_pages=[1], stem="Cho sơ đồ phản ứng 1:")
        q2 = ReconstructedQuestion(id="q2", number=2, source_number=2, source_pages=[1], stem="Cho sơ đồ phản ứng 2:")

        attachments = graph.associate_assets_to_questions([q1, q2])

        self.assertEqual([a.asset_id for a in attachments["q1"]], ["asset_q1"])
        self.assertEqual([a.asset_id for a in attachments["q2"]], ["asset_q2"])

    def test_04_multiple_images_in_one_question(self):
        """Test multiple images inside a single question: all preserved in order without loss or duplication."""
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            candidates=[
                QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50.0, 100.0, 150.0, 120.0), y_pos=100.0),
                QuestionCandidate(candidate_number=2, marker_text="Câu 2:", bbox=(50.0, 500.0, 150.0, 520.0), y_pos=500.0),
            ],
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 130.0), text="Câu 1: So sánh hai đồ thị hình A và hình B sau:"),
                TextBlock(block_index=1, bbox=(50.0, 500.0, 500.0, 530.0), text="Câu 2: Kim loại nào sau đây dẫn điện tốt nhất?"),
            ],
            page_kind=PageKind.MIXED
        )

        path_a = os.path.join(self.temp_dir, "graph_a.png")
        path_b = os.path.join(self.temp_dir, "graph_b.png")
        for path in (path_a, path_b):
            with open(path, "wb") as f:
                f.write(b"\x89PNG\r\n\x1a\n" + b"img")

        asset_a = AssetRecord(
            asset_id="asset_q1_graph_a",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(60.0, 150.0, 260.0, 300.0),
            path=path_a,
            sha256="ha",
            width=300,
            height=200,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        asset_b = AssetRecord(
            asset_id="asset_q1_graph_b",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(280.0, 150.0, 480.0, 300.0),
            path=path_b,
            sha256="hb",
            width=300,
            height=200,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[asset_a, asset_b])
        q1 = ReconstructedQuestion(id="q1", number=1, source_number=1, source_pages=[1], stem="So sánh hai đồ thị hình A và hình B sau:")
        q2 = ReconstructedQuestion(id="q2", number=2, source_number=2, source_pages=[1], stem="Kim loại nào sau đây dẫn điện tốt nhất?")

        attachments = graph.associate_assets_to_questions([q1, q2])

        # Q1 must contain BOTH assets in natural reading order
        self.assertEqual(len(attachments["q1"]), 2)
        self.assertEqual([a.asset_id for a in attachments["q1"]], ["asset_q1_graph_a", "asset_q1_graph_b"])
        # Q2 must contain zero
        self.assertEqual(len(attachments["q2"]), 0)

    def test_05_image_near_page_boundary(self):
        """Test image near top or bottom page boundary."""
        # Page 1: Question 1 starts near bottom (y: 730), asset is at y: 750..820 (near bottom boundary)
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            candidates=[
                QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50.0, 730.0, 150.0, 750.0), y_pos=730.0)
            ],
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 730.0, 500.0, 750.0), text="Câu 1: Hình bên mô tả thí nghiệm:")
            ],
            page_kind=PageKind.MIXED
        )

        asset_path = os.path.join(self.temp_dir, "asset_boundary.png")
        with open(asset_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"img")

        asset = AssetRecord(
            asset_id="asset_bottom",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(100.0, 755.0, 450.0, 825.0),
            path=asset_path,
            sha256="hbottom",
            width=400,
            height=100,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[asset])
        q1 = ReconstructedQuestion(id="q1", number=1, source_number=1, source_pages=[1], stem="Hình bên mô tả thí nghiệm:")

        attachments = graph.associate_assets_to_questions([q1])
        self.assertEqual(len(attachments["q1"]), 1)
        self.assertEqual(attachments["q1"][0].asset_id, "asset_bottom")

    def test_06_strict_agnes_validation_rejects_hallucinations(self):
        """Test that Agnes hallucinating non-existent question or asset IDs is rejected and falls back safely."""
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 120.0), text="Câu 10: Thí nghiệm 1..."),
                TextBlock(block_index=1, bbox=(50.0, 200.0, 500.0, 220.0), text="Câu 11: Thí nghiệm 2..."),
            ],
            page_kind=PageKind.MIXED
        )

        asset_path = os.path.join(self.temp_dir, "ambig.png")
        with open(asset_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"ambig")

        # Ambiguous asset right on boundary (y: 180..220)
        asset = AssetRecord(
            asset_id="asset_ambig",
            type=AssetType.RASTER,
            source_page=1,
            bbox=(100.0, 180.0, 400.0, 220.0),
            path=asset_path,
            sha256="amb1",
            width=400,
            height=80,
            extraction_method=ExtractionMethod.EMBEDDED
        )

        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[asset])
        q10 = ReconstructedQuestion(id="q10", number=10, source_number=10, source_pages=[1], stem="Câu 10: Thí nghiệm 1...")
        q11 = ReconstructedQuestion(id="q11", number=11, source_number=11, source_pages=[1], stem="Câu 11: Thí nghiệm 2...")

        # Mock AI provider hallucinating a non-existent question (Câu 99)
        mock_provider = MagicMock()
        mock_provider.generate_structured.return_value = AmbiguityCandidateChoice(
            selected_question_number=99,
            owner_question_id="q_hallucinated_99",
            asset_id="asset_ambig",
            role="question_figure",
            confidence=0.99
        )

        # Must reject hallucinated Câu 99 and fall back to valid candidate
        attachments = graph.associate_assets_to_questions([q10, q11], ai_provider=mock_provider)

        # Asset should be associated to one of the real candidates, NEVER q_hallucinated_99
        self.assertNotIn("q_hallucinated_99", attachments)
        total_assigned = len(attachments["q10"]) + len(attachments["q11"])
        self.assertEqual(total_assigned, 1)

    def test_07_e2e_debai_pdf_visual_validation(self):
        """End-to-End DeBai PDF Generation & Visual Validation: Q46 has no images, Q47 has Triglyceride, Q48 has Scheme."""
        if not self.has_goc:
            self.skipTest("Gốc.pdf not available on disk.")

        graph = DocumentObjectGraph.build(
            doc_reps=self.doc_reps,
            asset_records=self.extracted_assets
        )

        # Test batch Q45..Q48
        q45 = ReconstructedQuestion(
            id="q_45",
            number=45,
            source_number=45,
            type=QuestionType.PART_I_MCQ,
            stem="Khi các acid béo không no có nhiều liên kết đôi...",
            options=[
                QuestionOption(label="A", text="Phát biểu A"),
                QuestionOption(label="B", text="Phát biểu B"),
                QuestionOption(label="C", text="Phát biểu C"),
                QuestionOption(label="D", text="Phát biểu D"),
            ],
            source_pages=[2]
        )
        q46 = ReconstructedQuestion(
            id="q_46",
            number=46,
            source_number=46,
            type=QuestionType.PART_I_MCQ,
            stem="Chất hữu cơ G được dùng phổ biến trong lĩnh vực mĩ phẩm và phụ gia thực phẩm...",
            options=[
                QuestionOption(label="A", text="G là tristearin"),
                QuestionOption(label="B", text="G là glycerol"),
                QuestionOption(label="C", text="Thủy phân 1 mol"),
                QuestionOption(label="D", text="1 mol G phản ứng hoàn toàn với Na dư thu được 3 mol H2."),
            ],
            source_pages=[2, 3]
        )
        q47 = ReconstructedQuestion(
            id="q_47",
            number=47,
            source_number=47,
            type=QuestionType.PART_I_MCQ,
            stem="Cho các triglyceride X, Y với công thức cấu tạo sau:",
            options=[
                QuestionOption(label="A", text="Triglyceride X có tên gọi tripalmitin"),
                QuestionOption(label="B", text="X là chất béo no"),
                QuestionOption(label="C", text="X, Y đều tan tốt"),
                QuestionOption(label="D", text="Hydrogen hóa Y thu được X"),
            ],
            source_pages=[3]
        )
        q48 = ReconstructedQuestion(
            id="q_48",
            number=48,
            source_number=48,
            type=QuestionType.PART_I_MCQ,
            stem="Cho sơ đồ phản ứng của chất béo X như sau:",
            options=[
                QuestionOption(label="A", text="Phản ứng trên là tổng hợp"),
                QuestionOption(label="B", text="(A) là tristearoyl"),
                QuestionOption(label="C", text="C52H100O6"),
                QuestionOption(label="D", text="Có 3 phân tử H2"),
            ],
            source_pages=[3]
        )

        qs = [q45, q46, q47, q48]
        attachments = graph.associate_assets_to_questions(qs)

        meta = DocumentMetadataIR(
            title="BÀI TẬP HÓA HỌC HỮU CƠ",
            subject="HÓA HỌC",
            total_questions=len(qs),
            created_at="2026-10-05T00:00:00Z"
        )
        answers = [
            AnswerKeyIR(question_id=q.id, question_number=q.number, selected_answer="A")
            for q in qs
        ]

        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=qs,
            doc_reps=self.doc_reps,
            answers=answers,
            metadata=meta,
            rich_element_attachments=attachments
        )

        # Compile PDF
        compiler = PDFCompiler()
        debai_pdf_path, dapan_pdf_path = compiler.compile_both(
            doc_ir=doc_ir,
            output_dir=self.temp_dir,
            prefix="AssetValidation",
            preset=BLUE_BLACK_CLASSIC_STYLE
        )

        self.assertTrue(os.path.isfile(debai_pdf_path), "DeBai PDF must be generated")

        # Inspect generated PDF via PyMuPDF
        pdf = pymupdf.open(debai_pdf_path)
        self.assertGreaterEqual(len(pdf), 1)

        # Inspect all images in the generated PDF
        total_pdf_images = 0
        for pno in range(len(pdf)):
            page = pdf[pno]
            imgs = page.get_images()
            total_pdf_images += len(imgs)

        # Exactly 2 images rendered: Triglyceride X/Y (Câu 47) and Reaction scheme (Câu 48)
        self.assertEqual(total_pdf_images, 2, "Generated PDF must contain exactly 2 images (Q47 and Q48)!")

        # Verify HTML contains images only for Q47 and Q48
        html_path = os.path.join(self.temp_dir, "AssetValidation_DeBai.html")
        with open(html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        # Câu 46 must NOT contain <div class="q-rich-element">
        q46_idx = html_content.find("Câu 46:")
        q47_idx = html_content.find("Câu 47:")
        q48_idx = html_content.find("Câu 48:")

        self.assertNotEqual(q46_idx, -1)
        self.assertNotEqual(q47_idx, -1)
        self.assertNotEqual(q48_idx, -1)

        q46_chunk = html_content[q46_idx:q47_idx]
        self.assertNotIn("q-rich-element", q46_chunk, "Câu 46 in HTML must have NO rich elements!")
        self.assertNotIn("q-crop-img", q46_chunk, "Câu 46 in HTML must have NO crop images!")

        q47_chunk = html_content[q47_idx:q48_idx]
        self.assertIn("q-rich-element", q47_chunk, "Câu 47 in HTML must have rich element!")

        q48_chunk = html_content[q48_idx:]
        self.assertIn("q-rich-element", q48_chunk, "Câu 48 in HTML must have rich element!")

        pdf.close()

    def test_08_cross_page_image_pushed_to_next_page_with_zero_text_before_next_question(self):
        """Cross-page test: Question 1 ends on Page 1, image pushed to Page 2 with zero text before Q2."""
        p1 = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            candidates=[QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50.0, 750.0, 150.0, 770.0), y_pos=750.0)],
            blocks=[TextBlock(block_index=0, bbox=(50.0, 750.0, 500.0, 770.0), text="Câu 1: Hình bên là đồ thị:")],
            page_kind=PageKind.MIXED
        )
        p2 = PageRepresentation(
            page_index=1, page_number=2, width=595.0, height=842.0,
            candidates=[QuestionCandidate(candidate_number=2, marker_text="Câu 2:", bbox=(50.0, 200.0, 150.0, 220.0), y_pos=200.0)],
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 20.0, 300.0, 35.0), text="Header line"),
                TextBlock(block_index=1, bbox=(50.0, 200.0, 500.0, 220.0), text="Câu 2: Kim loại nào tốt nhất?")
            ],
            page_kind=PageKind.MIXED
        )
        asset_file = os.path.join(self.temp_dir, "q1_pushed.png")
        with open(asset_file, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"img")

        asset = AssetRecord(
            asset_id="asset_q1_pushed_to_p2", type=AssetType.RASTER, source_page=2,
            bbox=(80.0, 60.0, 400.0, 160.0), path=asset_file, sha256="h_push", width=300, height=100,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        graph = DocumentObjectGraph.build(doc_reps=[p1, p2], asset_records=[asset])
        q1 = ReconstructedQuestion(id="q1", number=1, source_number=1, source_pages=[1], stem="Hình bên là đồ thị:")
        q2 = ReconstructedQuestion(id="q2", number=2, source_number=2, source_pages=[2], stem="Kim loại nào tốt nhất?")

        att = graph.associate_assets_to_questions([q1, q2])
        self.assertEqual([a.asset_id for a in att["q1"]], ["asset_q1_pushed_to_p2"], "Q1 must own pushed image on P2!")
        self.assertEqual(len(att["q2"]), 0, "Q2 must NOT steal Q1's image on P2!")

    def test_09_question_with_source_pages_1_only_naturally_claims_p2_figure(self):
        """Golden test: Q41 with source_pages=[1] naturally claims Linoleic acid on Page 2 and Q42 gets zero."""
        if not self.has_goc:
            self.skipTest("Gốc.pdf not available on disk.")

        graph = DocumentObjectGraph.build(
            doc_reps=self.doc_reps,
            asset_records=self.extracted_assets
        )
        default_opts = [QuestionOption(label="A", text="Option A")]
        q41 = ReconstructedQuestion(id="q_41", number=41, source_number=41, type=QuestionType.PART_I_MCQ, stem="Linoleic acid", options=default_opts, source_pages=[1])
        q42 = ReconstructedQuestion(id="q_42", number=42, source_number=42, type=QuestionType.PART_I_MCQ, stem="Phát biểu nào sau đây sai?", options=default_opts, source_pages=[2])

        att = graph.associate_assets_to_questions([q41, q42])
        self.assertEqual([a.asset_id for a in att["q_41"]], ["asset_p2_img_83_0"], "Q41 must claim Linoleic acid on P2!")
        self.assertEqual(len(att["q_42"]), 0, "Q42 must have zero attachments!")

    def test_10_running_header_and_footer_assets_remain_unassociated(self):
        """Test running header (y <= 40) and running footer (y >= height - 35) assets remain UNASSOCIATED."""
        p1 = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            candidates=[QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50.0, 100.0, 150.0, 120.0), y_pos=100.0)],
            blocks=[TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 120.0), text="Câu 1: Stem text")],
            page_kind=PageKind.MIXED
        )
        hdr_path = os.path.join(self.temp_dir, "hdr.png")
        ftr_path = os.path.join(self.temp_dir, "ftr.png")
        for p in (hdr_path, ftr_path):
            with open(p, "wb") as f:
                f.write(b"\x89PNG\r\n\x1a\n" + b"img")

        hdr_asset = AssetRecord(
            asset_id="asset_header", type=AssetType.RASTER, source_page=1,
            bbox=(50.0, 10.0, 150.0, 35.0), path=hdr_path, sha256="hdr", width=100, height=25,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        ftr_asset = AssetRecord(
            asset_id="asset_footer", type=AssetType.RASTER, source_page=1,
            bbox=(50.0, 815.0, 150.0, 835.0), path=ftr_path, sha256="ftr", width=100, height=20,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[hdr_asset, ftr_asset])
        q1 = ReconstructedQuestion(id="q1", number=1, source_number=1, source_pages=[1], stem="Câu 1: Stem text")

        att = graph.associate_assets_to_questions([q1])
        self.assertEqual(len(att["q1"]), 0, "Q1 must not claim header or footer assets!")
        ownerships = graph.get_asset_ownership()
        self.assertIsNone(ownerships["asset_header"].owner_question_id)
        self.assertEqual(ownerships["asset_header"].role, AssociationRole.UNASSOCIATED)
        self.assertIsNone(ownerships["asset_footer"].owner_question_id)
        self.assertEqual(ownerships["asset_footer"].role, AssociationRole.UNASSOCIATED)

    def test_11_ir_invariant_enforced_in_builder_against_mismatched_ownership(self):
        q1 = ReconstructedQuestion(
            id="q1",
            number=1,
            source_number=1,
            source_pages=[1],
            stem="Stem 1",
            options=[QuestionOption(label="A", text="Opt A"), QuestionOption(label="B", text="Opt B")]
        )
        img_path = os.path.join(self.temp_dir, "inv.png")
        with open(img_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"img")

        rec = AssetRecord(
            asset_id="asset_rogue", type=AssetType.RASTER, source_page=1,
            bbox=(50.0, 100.0, 200.0, 200.0), path=img_path, sha256="rogue", width=150, height=100,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        # Rogue attachment with owner_question_id="q99" erroneously placed in q1's attachment list
        rogue_att = RichElementAttachment(
            asset_id="asset_rogue",
            role=AssociationRole.QUESTION_FIGURE,
            position="after_stem",
            confidence=0.9,
            asset_record=rec,
            owner_question_id="q99"
        )
        meta = DocumentMetadataIR(title="Test", subject="Test", total_questions=1, created_at="2026-10-05T00:00:00Z")
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q1],
            doc_reps=[],
            answers=[AnswerKeyIR(question_id="q1", question_number=1, selected_answer="A")],
            metadata=meta,
            rich_element_attachments={"q1": [rogue_att]}
        )
        self.assertEqual(doc_ir.questions[0].rich_elements, [], "IR Invariant: Rogue attachment with mismatched owner_question_id must be dropped!")

    def test_12_agnes_rejects_mismatched_asset_id_and_missing_owner_id(self):
        """Test Agnes validation strictly rejects mismatched asset_id or unknown owner_question_id."""
        p1 = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            blocks=[
                TextBlock(block_index=0, bbox=(50.0, 100.0, 500.0, 120.0), text="Câu 10: Stem 10"),
                TextBlock(block_index=1, bbox=(50.0, 200.0, 500.0, 220.0), text="Câu 11: Stem 11"),
            ],
            page_kind=PageKind.MIXED
        )
        asset_path = os.path.join(self.temp_dir, "ambig2.png")
        with open(asset_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"ambig")

        asset = AssetRecord(
            asset_id="asset_real", type=AssetType.RASTER, source_page=1,
            bbox=(100.0, 180.0, 400.0, 220.0), path=asset_path, sha256="amb2", width=400, height=80,
            extraction_method=ExtractionMethod.EMBEDDED
        )
        graph = DocumentObjectGraph.build(doc_reps=[p1], asset_records=[asset])
        q10 = ReconstructedQuestion(id="q10", number=10, source_number=10, source_pages=[1], stem="Câu 10: Stem 10")
        q11 = ReconstructedQuestion(id="q11", number=11, source_number=11, source_pages=[1], stem="Câu 11: Stem 11")

        # Mock AI returning wrong asset_id
        mock_provider = MagicMock()
        mock_provider.generate_structured.return_value = AmbiguityCandidateChoice(
            selected_question_number=10,
            owner_question_id="q10",
            asset_id="asset_WRONG_ID",
            role="question_figure",
            confidence=0.99
        )
        att = graph.associate_assets_to_questions([q10, q11], ai_provider=mock_provider)
        # Should not crash and should fall back safely to one valid question
        total = len(att["q10"]) + len(att["q11"])
        self.assertEqual(total, 1)
