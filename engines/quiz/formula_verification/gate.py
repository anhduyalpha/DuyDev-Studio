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
                # 1. Detect formulas in QuestionIR
                q_formulas = FormulaDetector.detect_for_question(question)
                
                # Attach to question formulas list if attribute exists
                if hasattr(question, "formulas"):
                    question.formulas = q_formulas
                all_detected_formulas.extend(q_formulas)

                for formula in q_formulas:
                    # 2. Check Cache (Section 15)
                    cache_key = global_formula_cache.compute_key(
                        source_hash=source_doc_hash,
                        formula_repr=formula.render_representation
                    )
                    cached_entry = global_formula_cache.get(cache_key)
                    if cached_entry and cached_entry.get("status") in ("PASS", "REPAIRED"):
                        formula.verification_status = FormulaVerificationStatus(cached_entry["status"])
                        passed_count += 1
                        continue

                    # 3. Source of Truth Extraction
                    # Priority 1: Exact text in question bboxes if available from fitz_doc
                    expected_source = formula.source_text
                    if fitz_doc and formula.source_bbox and formula.source_page <= len(fitz_doc):
                        try:
                            src_page = fitz_doc[formula.source_page - 1]
                            clip_rect = fitz.Rect(formula.source_bbox)
                            extracted_bbox_text = src_page.get_text(clip=clip_rect)
                            # If formula found in raw page text, prioritize it
                            if formula.source_text in extracted_bbox_text:
                                expected_source = formula.source_text
                        except Exception:
                            pass

                    # 4. Fast-Path Deterministic Semantic Comparison
                    issues = SemanticFormulaComparator.compare(
                        source=expected_source,
                        candidate=formula.render_representation,
                        formula_type=formula.type,
                        formula_id=formula.formula_id,
                        question_id=formula.question_id,
                        field=formula.field
                    )

                    if not issues:
                        formula.verification_status = FormulaVerificationStatus.PASS
                        passed_count += 1
                        global_formula_cache.set(cache_key, FormulaVerificationStatus.PASS, [])
                        continue

                    # 5. Mismatch detected -> Evaluate Need for Vision Cross-Check (Section 9 & 14)
                    attempt = 0
                    is_repaired = False
                    correct_source = expected_source

                    # If OCR / text conflict suspected or low confidence, invoke Agnes Vision diagnostic
                    if fitz_doc and ai_provider and attempt < max_retries:
                        diag, crop_p = VisionFormulaCrossChecker.diagnose_formula_with_crop(
                            pdf_doc=fitz_doc,
                            formula=formula,
                            crops_dir=crops_dir,
                            ai_provider=ai_provider
                        )
                        if diag.status == "PASS":
                            # Vision confirms output formula actually matches visual crop
                            formula.verification_status = FormulaVerificationStatus.PASS
                            passed_count += 1
                            global_formula_cache.set(cache_key, FormulaVerificationStatus.PASS, [])
                            continue
                        elif diag.source_formula and diag.source_formula != formula.render_representation:
                            correct_source = diag.source_formula
                            conflict_count += 1

                    # 6. Safe Targeted Repair (Section 10)
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
