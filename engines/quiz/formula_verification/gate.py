"""
Formula Verification Gate (Main Entrypoint).
Orchestrates formula detection, canonical representation, semantic verification,
caching, selective vision cross-checking, targeted safe repair, and post-render validation.
Runs after normalization and BEFORE rendering.
"""

import os
from typing import Optional, Any
import pymupdf as fitz

from engines.quiz.ir.models import CanonicalDocumentIR, QuestionIR
from .models import (
    FormulaType,
    FormulaVerificationStatus,
    FormulaCanonicalIR,
    FormulaVerificationIssue,
    FormulaIssueType,
    FormulaGateResult,
    PostRenderVerificationResult
)
from .detector import FormulaDetector
from .semantic_canonical import (
    SemanticFormulaComparator,
    normalize_to_plain_sub_superscripts
)
from .cache import global_formula_cache
from .vision_crosscheck import VisionFormulaCrossChecker
from .repair import TargetedFormulaRepairEngine
from .post_render_checker import PostRenderFormulaChecker


class FormulaVerificationGate:
    """Independent verification gate ensuring math, chem, and physics formula integrity."""

    @classmethod
    def verify_and_repair(
        cls,
        doc_ir: CanonicalDocumentIR,
        pdf_path: Optional[str] = None,
        ai_provider: Optional[Any] = None,
        output_dir: Optional[str] = None,
        max_retries: int = 2
    ) -> FormulaGateResult:
        """
        Executes complete formula verification and safe targeted repair across CanonicalDocumentIR.
        Prioritizes source of truth:
        1. Exact PDF text/spans from original PDF
        2. Original PDF object
        3. Visual crop & Agnes vision diagnosis when conflict/low confidence occurs
        """
        crops_dir = os.path.join(output_dir or ".", "formula_crops")
        os.makedirs(crops_dir, exist_ok=True)

        fitz_doc = None
        if pdf_path and os.path.isfile(pdf_path):
            try:
                fitz_doc = fitz.open(pdf_path)
            except Exception:
                fitz_doc = None

        all_detected_formulas: list[FormulaCanonicalIR] = []
        all_issues: list[FormulaVerificationIssue] = []
        passed_count = 0
        failed_count = 0
        repaired_count = 0
        conflict_count = 0

        source_doc_hash = getattr(doc_ir.metadata, "source_hash", "") or "default_hash"

        try:
            for question in doc_ir.questions:
                # 1. Obtain or detect formulas for question
                existing_formulas = getattr(question, "formulas", None)
                if existing_formulas and isinstance(existing_formulas, list) and len(existing_formulas) > 0:
                    q_formulas = existing_formulas
                else:
                    q_formulas = FormulaDetector.detect_for_question(question)
                    question.formulas = q_formulas

                all_detected_formulas.extend(q_formulas)

                # 2. Extract Ground Truth from PDF if available
                pdf_ground_truth_formulas: list[FormulaCanonicalIR] = []
                if fitz_doc and question.provenance.source_pages:
                    primary_p = question.provenance.source_pages[0]
                    if 1 <= primary_p <= len(fitz_doc):
                        try:
                            src_page = fitz_doc[primary_p - 1]
                            raw_pdf_text = ""
                            if question.provenance.bboxes:
                                # Union bounding boxes with margin
                                min_x = min(b[0] for b in question.provenance.bboxes) - 5
                                min_y = min(b[1] for b in question.provenance.bboxes) - 5
                                max_x = max(b[2] for b in question.provenance.bboxes) + 5
                                max_y = max(b[3] for b in question.provenance.bboxes) + 5
                                clip_rect = fitz.Rect(max(0, min_x), max(0, min_y), max_x, max_y)
                                raw_pdf_text = src_page.get_text("text", clip=clip_rect)
                            if not raw_pdf_text or len(raw_pdf_text.strip()) < 10:
                                raw_pdf_text = src_page.get_text("text")

                            pdf_ground_truth_formulas = FormulaDetector.detect_formulas_in_text(
                                text=raw_pdf_text,
                                question_id=question.id,
                                field="pdf_source",
                                source_page=primary_p
                            )
                        except Exception:
                            pdf_ground_truth_formulas = []

                # 3. Verify each formula
                for formula in q_formulas:
                    expected_source = formula.source_text

                    # Correlate with PDF ground truth if available
                    if pdf_ground_truth_formulas:
                        # Find best match from PDF formulas
                        matched_pdf_formula = None
                        # Priority A: exact match
                        for pf in pdf_ground_truth_formulas:
                            if pf.source_text == formula.render_representation:
                                matched_pdf_formula = pf
                                break
                        # Priority B: semantic sub/superscript match
                        if not matched_pdf_formula:
                            norm_cand = normalize_to_plain_sub_superscripts(formula.render_representation)
                            for pf in pdf_ground_truth_formulas:
                                if normalize_to_plain_sub_superscripts(pf.source_text) == norm_cand:
                                    matched_pdf_formula = pf
                                    break
                        # Priority C: prefix / structural overlap (detecting corruptions)
                        if not matched_pdf_formula:
                            for pf in pdf_ground_truth_formulas:
                                # If they share common core element string e.g. C17H31COO or similar
                                if len(pf.source_text) >= 4 and (
                                    pf.source_text[:4] == formula.render_representation[:4] or
                                    formula.render_representation[:4] in pf.source_text
                                ):
                                    matched_pdf_formula = pf
                                    break

                        if matched_pdf_formula:
                            expected_source = matched_pdf_formula.source_text
                            formula.source_text = expected_source

                    # Check Cache (Section 15)
                    cache_key = global_formula_cache.compute_key(
                        source_hash=source_doc_hash,
                        formula_repr=formula.render_representation
                    )
                    cached_entry = global_formula_cache.get(cache_key)
                    if cached_entry and cached_entry.get("status") in ("PASS", "REPAIRED"):
                        formula.verification_status = FormulaVerificationStatus(cached_entry["status"])
                        passed_count += 1
                        continue

                    # Autonomous syntax & markup check
                    autonomous_issues: list[FormulaVerificationIssue] = []
                    for unrendered_pat in (r"\\undefined\b", r"\$\$[^\$]+\$\$", r"KaTeX parse error"):
                        if os.path.exists("") or unrendered_pat in formula.render_representation:
                            autonomous_issues.append(
                                FormulaVerificationIssue(
                                    formula_id=formula.formula_id,
                                    question_id=formula.question_id,
                                    field=formula.field,
                                    issue_type=FormulaIssueType.UNRENDERED_MARKUP,
                                    expected="Ký hiệu hợp lệ",
                                    actual=formula.render_representation,
                                    severity="critical",
                                    description=f"Công thức chứa markup chưa kết xuất hoặc bị lỗi: '{formula.render_representation}'"
                                )
                            )

                    # Multi-dimensional Semantic Comparison
                    issues = SemanticFormulaComparator.compare(
                        source=expected_source,
                        candidate=formula.render_representation,
                        formula_type=formula.type,
                        formula_id=formula.formula_id,
                        question_id=formula.question_id,
                        field=formula.field
                    )
                    issues.extend(autonomous_issues)

                    if not issues:
                        formula.verification_status = FormulaVerificationStatus.PASS
                        passed_count += 1
                        global_formula_cache.set(cache_key, FormulaVerificationStatus.PASS, [])
                        continue

                    # Issues detected -> Evaluate Need for Agnes Vision Cross-Check (Section 9 & 14)
                    attempt = 0
                    is_repaired = False
                    correct_source = expected_source

                    # Conflict or low confidence handling
                    if fitz_doc and ai_provider and attempt < max_retries:
                        diag, crop_p = VisionFormulaCrossChecker.diagnose_formula_with_crop(
                            pdf_doc=fitz_doc,
                            formula=formula,
                            crops_dir=crops_dir,
                            ai_provider=ai_provider
                        )
                        if diag.status == "PASS":
                            formula.verification_status = FormulaVerificationStatus.PASS
                            passed_count += 1
                            global_formula_cache.set(cache_key, FormulaVerificationStatus.PASS, [])
                            continue
                        elif diag.source_formula and diag.source_formula != formula.render_representation:
                            correct_source = diag.source_formula
                            formula.verification_status = FormulaVerificationStatus.CONFLICT
                            conflict_count += 1

                    # Safe Targeted Repair Loop (Section 10)
                    while attempt < max_retries and not is_repaired:
                        attempt += 1
                        repaired_ok, question, formula, remaining = TargetedFormulaRepairEngine.repair_formula_in_question(
                            question=question,
                            formula=formula,
                            correct_formula=correct_source
                        )
                        if repaired_ok:
                            is_repaired = True
                            repaired_count += 1
                            formula.verification_status = FormulaVerificationStatus.REPAIRED
                            global_formula_cache.set(
                                cache_key,
                                FormulaVerificationStatus.REPAIRED,
                                [],
                                repaired_text=correct_source
                            )
                            break

                    if not is_repaired:
                        formula.verification_status = FormulaVerificationStatus.FAIL
                        failed_count += 1
                        all_issues.extend(issues)
                        global_formula_cache.set(cache_key, FormulaVerificationStatus.FAIL, issues)

        finally:
            if fitz_doc:
                fitz_doc.close()

        overall_status = "PASS"
        if failed_count > 0:
            overall_status = "FAIL"
        elif repaired_count > 0:
            overall_status = "REPAIRED"

        return FormulaGateResult(
            status=overall_status,
            verified_count=len(all_detected_formulas),
            passed_count=passed_count,
            failed_count=failed_count,
            repaired_count=repaired_count,
            conflict_count=conflict_count,
            issues=all_issues,
            formulas=all_detected_formulas
        )

    @classmethod
    def verify_post_render(
        cls,
        pdf_path: str,
        doc_ir: CanonicalDocumentIR,
        gate_result: FormulaGateResult
    ) -> PostRenderVerificationResult:
        """Runs selective post-render verification on the final compiled PDF."""
        post_res = PostRenderFormulaChecker.verify_rendered_pdf(
            pdf_path=pdf_path,
            doc_ir=doc_ir,
            formulas=gate_result.formulas
        )
        gate_result.post_render_result = post_res
        if not post_res.is_pass():
            gate_result.status = "FAIL"
            gate_result.issues.extend(post_res.issues)
        return post_res
