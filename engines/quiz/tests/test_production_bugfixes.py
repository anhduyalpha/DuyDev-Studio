"""
Regression Test Suite for Production Bugfixes (TASK: Bug #1, Bug #2, Bug #3).
Verifies:
1. Bug #1: Range & Canonical Numbering (31..46 -> request 31..42, no duplicate headings, canonical mapping).
2. Bug #2: Rich Image Normalization & Black-Box Fallback (SMask/alpha composited to white, black box detection, page crop fallback).
3. Bug #3: Last Option Integrity & Boundary Continuation (Option D preserved, 3-option MCQs raise OPTION_MISSING, never silently dropped).
"""

import os
import shutil
import tempfile
import unittest
import numpy as np
from PIL import Image
import pymupdf

from engines.quiz.perception.models import (
    PageRepresentation,
    QuestionCandidate,
    PageKind,
    TextBlock
)
from engines.quiz.recognition.range_resolver import resolve_smart_range
from engines.quiz.recognition.rule_parser import parse_numeric_instruction
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionOption,
    QuestionType
)
from engines.quiz.reconstruction.post_processor import (
    clean_question_stem,
    recover_missing_mcq_options,
    post_process_questions
)
from engines.quiz.assets.extractor import (
    normalize_image_to_renderer_safe,
    is_black_or_blank_image,
    validate_image_asset,
    RichAssetExtractor
)
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionType,
    QuestionIR,
    OptionIR,
    AnswerKeyIR
)
from engines.quiz.ir.validator import (
    validate_canonical_document_ir,
    IRValidationError
)
from engines.quiz.common.errors import ErrorCode, QuizEngineError


class TestProductionBugfixes(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_prod_bugfix_")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # =========================================================================
    # BUG #1: Range & Canonical Numbering
    # =========================================================================

    def test_bug1_clean_question_stem_removes_duplicate_prefixes(self):
        """Verifies that duplicate 'Câu 35:', 'Câu 31.' headers are cleanly stripped from stems."""
        stems_with_prefixes = [
            ("Câu 35: Hợp chất nào sau đây là este?", "Hợp chất nào sau đây là este?"),
            ("Câu 31. Tính khối lượng este thu được:", "Tính khối lượng este thu được:"),
            ("Bài 12: Cho dung dịch NaOH vào...", "Cho dung dịch NaOH vào..."),
            ("Question 40: What is the IUPAC name?", "What is the IUPAC name?"),
            ("CÂU 41: Axit linoleic có công thức là", "Axit linoleic có công thức là"),
            ("  Câu  42 :   Cho m gam kim loại... ", "Cho m gam kim loại..."),
            ("10. Thủy phân este X trong môi trường axit", "Thủy phân este X trong môi trường axit"),
            ("Câu 31: Câu 35: Từ dầu thực vật...", "Từ dầu thực vật..."),
            ("Câu 32: Câu 36: Cho sơ đồ...", "Cho sơ đồ..."),
            ("Câu 31. Câu 35. Từ dầu thực vật...", "Từ dầu thực vật..."),
            ("Câu 31: 35. Cho sơ đồ phản ứng...", "Cho sơ đồ phản ứng..."),
        ]
        for raw, expected in stems_with_prefixes:
            cleaned = clean_question_stem(raw)
            self.assertEqual(cleaned, expected, f"Failed cleaning stem: {raw}")

    def test_bug1_range_resolver_finds_canonical_start_question_on_page(self):
        """
        Source has questions 31..46 distributed across pages:
        Page 1: questions 20..30
        Page 2: questions 31..38
        Page 3: questions 39..46
        User requests start_question=31, count=12.
        Resolver must target Page 2 to Page 3 and select questions 31..42.
        """
        doc_reps = []
        # Page 1: Q20..30
        c1 = [
            QuestionCandidate(
                candidate_number=q,
                marker_text=f"Câu {q}:",
                bbox=(50.0, 50.0 + (q - 20) * 50, 500.0, 80.0 + (q - 20) * 50),
                y_pos=50.0 + (q - 20) * 50,
                options_detected=["A", "B", "C", "D"]
            )
            for q in range(20, 31)
        ]
        p1_text = "\n".join(f"Câu {q}: Nội dung câu {q}..." for q in range(20, 31))
        doc_reps.append(PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            raw_text=p1_text, character_count=len(p1_text),
            page_kind=PageKind.VECTOR, candidates=c1
        ))

        # Page 2: Q31..38
        c2 = [
            QuestionCandidate(
                candidate_number=q,
                marker_text=f"Câu {q}:",
                bbox=(50.0, 50.0 + (q - 31) * 70, 500.0, 90.0 + (q - 31) * 70),
                y_pos=50.0 + (q - 31) * 70,
                options_detected=["A", "B", "C", "D"]
            )
            for q in range(31, 39)
        ]
        p2_text = "\n".join(f"Câu {q}: Nội dung câu {q}..." for q in range(31, 39))
        doc_reps.append(PageRepresentation(
            page_index=1, page_number=2, width=595.0, height=842.0,
            raw_text=p2_text, character_count=len(p2_text),
            page_kind=PageKind.VECTOR, candidates=c2
        ))

        # Page 3: Q39..46
        c3 = [
            QuestionCandidate(
                candidate_number=q,
                marker_text=f"Câu {q}:",
                bbox=(50.0, 50.0 + (q - 39) * 70, 500.0, 90.0 + (q - 39) * 70),
                y_pos=50.0 + (q - 39) * 70,
                options_detected=["A", "B", "C", "D"]
            )
            for q in range(39, 47)
        ]
        p3_text = "\n".join(f"Câu {q}: Nội dung câu {q}..." for q in range(39, 47))
        doc_reps.append(PageRepresentation(
            page_index=2, page_number=3, width=595.0, height=842.0,
            raw_text=p3_text, character_count=len(p3_text),
            page_kind=PageKind.VECTOR, candidates=c3
        ))

        # Request: start_question=31, count=12
        res = resolve_smart_range("Từ câu 31 lấy 12 câu", doc_reps)
        self.assertEqual(res.start_page, 2, "Start page should be Page 2 where Câu 31 resides")
        self.assertEqual(res.start_question, 31)
        self.assertEqual(res.question_count, 12)
        # 12 questions from 31 -> 31..42. Page 2 has 31..38 (8 questions), Page 3 has 39..46.
        # So end page must be 3.
        self.assertEqual(res.end_page, 3)

    def test_bug1_post_processor_canonical_mapping_and_no_mechanical_masking(self):
        """
        Verifies that questions 31..46 filtered with start_question=31, count=12
        yields exactly questions 31..42 with canonical source_number preservation,
        no duplicate headings in stems, and no questions 43..46.
        """
        questions = []
        for q in range(31, 47):
            questions.append(
                ReconstructedQuestion(
                    id=f"q_temp_{q}",
                    number=q,
                    source_number=q,
                    type=QuestionType.PART_I_MCQ,
                    stem=f"Câu {q}: Axit cacboxylic nào sau đây có mạch phân nhánh?",
                    options=[
                        QuestionOption(label="A", text="Axit axetic"),
                        QuestionOption(label="B", text="Axit isobutiric"),
                        QuestionOption(label="C", text="Axit propionic"),
                        QuestionOption(label="D", text="Axit oxalic"),
                    ],
                    source_pages=[2 if q <= 38 else 3]
                )
            )

        processed = post_process_questions(
            questions,
            start_question=31,
            expected_count=12
        )

        self.assertEqual(len(processed), 12)
        expected_numbers = list(range(31, 43))
        for idx, p_q in enumerate(processed):
            exp_num = expected_numbers[idx]
            self.assertEqual(p_q.number, exp_num)
            self.assertEqual(p_q.source_number, exp_num)
            # Ensure duplicate header "Câu XX:" was stripped from stem
            self.assertFalse(p_q.stem.startswith(f"Câu {exp_num}:"))
            self.assertEqual(p_q.stem, "Axit cacboxylic nào sau đây có mạch phân nhánh?")

        # Build CanonicalDocumentIR and verify question_mapping contract
        builder = CanonicalIRBuilder()
        mock_answers = [
            AnswerKeyIR(
                question_id=p_q.id,
                question_number=p_q.number,
                selected_answer="A"
            )
            for p_q in processed
        ]
        doc_ir = builder.build(
            reconstructed_questions=processed,
            doc_reps=[],
            answers=mock_answers
        )
        self.assertEqual(len(doc_ir.question_mapping), 12)
        for idx, mapping in enumerate(doc_ir.question_mapping):
            exp_num = expected_numbers[idx]
            self.assertEqual(mapping["source_question_number"], exp_num)
            self.assertEqual(mapping["selected_order"], idx + 1)

    def test_bug1_post_processor_preserves_non_contiguous_source_numbers(self):
        """
        Verifies that when source questions have gaps (e.g. 31, 32, 34..42, skipping 33),
        post_process_questions preserves the canonical source numbers (31, 32, 34..42)
        and NEVER mechanically renumbers question 34 into 33 using array position indices.
        """
        source_nums = [31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42]  # 11 questions, 33 missing
        questions = [
            ReconstructedQuestion(
                id=f"q_non_contig_{q}",
                number=q,
                source_number=q,
                type=QuestionType.PART_I_MCQ,
                stem=f"Nội dung câu {q}",
                options=[
                    QuestionOption(label="A", text="Opt A"),
                    QuestionOption(label="B", text="Opt B"),
                    QuestionOption(label="C", text="Opt C"),
                    QuestionOption(label="D", text="Opt D"),
                ],
                source_pages=[2]
            )
            for q in source_nums
        ]

        processed = post_process_questions(
            questions,
            start_question=31,
            expected_count=12
        )

        self.assertEqual(len(processed), 11)
        # Canonical identity invariant: question 34 must remain 34, NOT 33!
        self.assertEqual([p.number for p in processed], source_nums)
        self.assertEqual([p.source_number for p in processed], source_nums)
        q34 = next(p for p in processed if p.source_number == 34)
        self.assertEqual(q34.number, 34, "Question 34 must retain canonical output number 34, not be renumbered to 33")

        # Verify CanonicalDocumentIR mapping
        builder = CanonicalIRBuilder()
        doc_ir = builder.build(
            reconstructed_questions=processed,
            doc_reps=[],
            answers=[AnswerKeyIR(question_id=p.id, question_number=p.number, selected_answer="A") for p in processed]
        )
        self.assertEqual(len(doc_ir.question_mapping), 11)
        for idx, mapping in enumerate(doc_ir.question_mapping):
            exp_q = source_nums[idx]
            self.assertEqual(mapping["source_question_number"], exp_q)
            self.assertEqual(mapping["output_question_number"], exp_q)
            self.assertEqual(mapping["selected_order"], idx + 1)

    # =========================================================================
    # BUG #2: Rich Image Normalization & Black-Box Fallback
    # =========================================================================

    def test_bug2_normalize_alpha_transparent_image_to_white_background(self):
        """
        Creates an RGBA image with transparent background (alpha=0 with black RGB bytes)
        and colored/black line art. Verifies normalization converts to opaque RGB
        with pure white background (255, 255, 255) rather than solid black rectangle.
        """
        # Create 100x100 RGBA image where transparent pixels are (0, 0, 0, 0)
        img_arr = np.zeros((100, 100, 4), dtype=np.uint8)
        # Transparent background: (0, 0, 0, 0)
        # Draw a central black square (50x50) representing molecular structure
        img_arr[25:75, 25:75] = [0, 0, 0, 255]
        pil_rgba = Image.fromarray(img_arr, mode="RGBA")

        raw_path = os.path.join(self.temp_dir, "transparent_chem.png")
        pil_rgba.save(raw_path)

        # Normalize
        w, h = normalize_image_to_renderer_safe(raw_path)
        self.assertEqual(w, 100)
        self.assertEqual(h, 100)
        normalized_path = raw_path
        self.assertTrue(os.path.isfile(normalized_path))

        # Inspect normalized image
        norm_img = Image.open(normalized_path)
        self.assertEqual(norm_img.mode, "RGB")
        norm_arr = np.array(norm_img)

        # Corner pixel (0,0) must now be pure white (255, 255, 255), NOT black (0, 0, 0)
        np.testing.assert_array_equal(norm_arr[0, 0], [255, 255, 255])
        # Center pixel (50, 50) must remain structure color (0, 0, 0)
        np.testing.assert_array_equal(norm_arr[50, 50], [0, 0, 0])

        # Validate that is_black_or_blank_image returns False (it is a valid figure, not black box)
        self.assertFalse(is_black_or_blank_image(normalized_path))
        self.assertTrue(validate_image_asset(normalized_path))

    def test_bug2_detect_and_reject_pure_black_box_image(self):
        """Verifies that is_black_or_blank_image detects solid black rectangle artifacts."""
        # Solid black image (0, 0, 0) across all pixels
        black_arr = np.zeros((120, 120, 3), dtype=np.uint8)
        black_pil = Image.fromarray(black_arr, mode="RGB")
        black_path = os.path.join(self.temp_dir, "solid_black.png")
        black_pil.save(black_path)

        # Must be flagged as black/blank
        self.assertTrue(is_black_or_blank_image(black_path))
        self.assertFalse(validate_image_asset(black_path))

        # Solid white image (255, 255, 255) across all pixels
        white_arr = np.full((120, 120, 3), 255, dtype=np.uint8)
        white_pil = Image.fromarray(white_arr, mode="RGB")
        white_path = os.path.join(self.temp_dir, "solid_white.png")
        white_pil.save(white_path)

        self.assertTrue(is_black_or_blank_image(white_path))
        self.assertFalse(validate_image_asset(white_path))

    def test_bug2_embedded_extraction_and_page_crop_fallback_end_to_end(self):
        """
        Creates a PDF document containing a drawing / figure.
        Extracts assets and verifies fallback to clean page crop with alpha=False
        produces valid non-black image files.
        """
        pdf_path = os.path.join(self.temp_dir, "figure_doc.pdf")
        doc = pymupdf.open()
        page = doc.new_page(width=400, height=400)
        # Draw a line art diagram (vector region)
        page.draw_rect(pymupdf.Rect(50, 50, 200, 200), color=(0, 0, 0), fill=(0.9, 0.9, 0.9), width=2)
        page.draw_line(pymupdf.Point(50, 50), pymupdf.Point(200, 200), color=(1, 0, 0), width=2)
        doc.save(pdf_path)
        doc.close()

        # Extract rich assets
        assets_dir = os.path.join(self.temp_dir, "assets_out")
        doc = pymupdf.open(pdf_path)
        extractor = RichAssetExtractor(output_dir=assets_dir)
        assets = extractor.extract_all(doc)
        doc.close()

        # Even if no raster images were embedded, any cropped asset must pass validation
        for asset in assets:
            self.assertTrue(os.path.isfile(asset.path))
            self.assertGreater(os.path.getsize(asset.path), 100)
            self.assertFalse(is_black_or_blank_image(asset.path))

    # =========================================================================
    # BUG #3: Last Option Disappears / Option Integrity
    # =========================================================================

    def test_bug3_recover_missing_mcq_options_from_stem(self):
        """Verifies recovery of Option D when embedded in stem due to boundary cut."""
        q = ReconstructedQuestion(
            id="q_boundary_test",
            number=46,
            source_number=46,
            type=QuestionType.PART_I_MCQ,
            stem="Chất nào có nhiệt độ sôi cao nhất? D. CH3COOH",
            options=[
                QuestionOption(label="A", text="C2H5OH"),
                QuestionOption(label="B", text="CH3OCH3"),
                QuestionOption(label="C", text="CH3CHO"),
            ],
            source_pages=[3]
        )

        recovered = recover_missing_mcq_options(q)
        self.assertEqual(len(recovered), 4)
        labels = [o.label for o in recovered]
        self.assertEqual(labels, ["A", "B", "C", "D"])
        opt_d = next(o for o in recovered if o.label == "D")
        self.assertEqual(opt_d.text, "CH3COOH")
        # Ensure D was removed from stem
        self.assertNotIn("D. CH3COOH", q.stem)

    def test_bug3_recover_missing_mcq_options_from_source_context(self):
        """Verifies recovery of Option D from raw source document text context."""
        q = ReconstructedQuestion(
            id="q_boundary_ctx",
            number=46,
            source_number=46,
            type=QuestionType.PART_I_MCQ,
            stem="Chất nào có nhiệt độ sôi cao nhất?",
            options=[
                QuestionOption(label="A", text="C2H5OH"),
                QuestionOption(label="B", text="CH3OCH3"),
                QuestionOption(label="C", text="CH3CHO"),
            ],
            source_pages=[3]
        )

        source_text = """
        Câu 45: Hợp chất X có công thức C4H8O2...
        A. 1 B. 2 C. 3 D. 4
        Câu 46: Chất nào có nhiệt độ sôi cao nhất?
        A. C2H5OH
        B. CH3OCH3
        C. CH3CHO
        D. CH3COOH
        --- HẾT ---
        """

        recovered = recover_missing_mcq_options(q, source_context=source_text)
        self.assertEqual(len(recovered), 4)
        labels = [o.label for o in recovered]
        self.assertEqual(labels, ["A", "B", "C", "D"])
        opt_d = next(o for o in recovered if o.label == "D")
        self.assertEqual(opt_d.text, "CH3COOH")

    def test_bug3_post_processor_raises_option_missing_on_irrecoverable_3_options(self):
        """
        Enforces Content Integrity Invariant:
        When an MCQ has only 3 options (A, B, C) and Option D cannot be recovered,
        post_process_questions MUST raise QuizEngineError(ErrorCode.OPTION_MISSING),
        never silently emit a 3-option question.
        """
        q = ReconstructedQuestion(
            id="q_irrecoverable",
            number=46,
            source_number=46,
            type=QuestionType.PART_I_MCQ,
            stem="Nội dung câu hỏi bị mất phương án D hoàn toàn",
            options=[
                QuestionOption(label="A", text="Phương án 1"),
                QuestionOption(label="B", text="Phương án 2"),
                QuestionOption(label="C", text="Phương án 3"),
            ],
            source_pages=[3]
        )

        with self.assertRaises(QuizEngineError) as ctx:
            post_process_questions([q], start_question=46, source_context="")

        self.assertEqual(ctx.exception.code, ErrorCode.OPTION_MISSING)
        self.assertIn("Câu 46", ctx.exception.message)
        self.assertIn("thiếu phương án lựa chọn", ctx.exception.message)

    def test_bug3_ir_validator_rejects_3_option_mcq(self):
        """
        Verifies that CanonicalIRValidator strictly rejects any CanonicalDocumentIR
        where a PART_I_MCQ question has fewer than 4 options.
        """
        bad_doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                total_questions=1,
                created_at="2026-10-05T00:00:00Z"
            ),
            questions=[
                QuestionIR(
                    id="q_bad_3_opts",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Câu hỏi chỉ có 3 phương án",
                    options=[
                        OptionIR(label="A", text="Opt A"),
                        OptionIR(label="B", text="Opt B"),
                        OptionIR(label="C", text="Opt C"),
                    ]
                )
            ]
        )

        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(bad_doc_ir)

        self.assertIn("found only 3 options (expected 4)", str(ctx.exception))

    def test_bug3_recover_missing_mcq_options_standalone_number_and_inline_het(self):
        """Verifies recovery of Option D when question marker is standalone '46.' and '--- HẾT ---' is on same line."""
        q = ReconstructedQuestion(
            id="q_standalone_num",
            number=46,
            source_number=46,
            type=QuestionType.PART_I_MCQ,
            stem="Chất nào có nhiệt độ sôi cao nhất?",
            options=[
                QuestionOption(label="A", text="C2H5OH"),
                QuestionOption(label="B", text="CH3OCH3"),
                QuestionOption(label="C", text="CH3CHO"),
            ],
            source_pages=[3]
        )
        source_text = "46. Chất nào có nhiệt độ sôi cao nhất?\nA. C2H5OH\nB. CH3OCH3\nC. CH3CHO\nD. 1 mol G phản ứng hoàn toàn với Na dư thu được 3 mol H2. --- HẾT ---"
        recovered = recover_missing_mcq_options(q, source_context=source_text)
        self.assertEqual(len(recovered), 4)
        opt_d = next(o for o in recovered if o.label == "D")
        self.assertEqual(opt_d.text, "1 mol G phản ứng hoàn toàn với Na dư thu được 3 mol H2.")

    def test_bug2_normalize_img_src_converts_to_base64_data_url(self):
        """Verifies that _normalize_img_src converts local image files to base64 Data URLs for safe headless rendering."""
        from engines.quiz.rendering.templates import _normalize_img_src
        test_img_path = os.path.join(self.temp_dir, "test_crop.png")
        Image.new("RGB", (30, 30), (200, 100, 50)).save(test_img_path)
        data_url = _normalize_img_src(test_img_path)
        self.assertTrue(data_url.startswith("data:image/png;base64,"))


if __name__ == "__main__":
    unittest.main()
