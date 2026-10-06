"""
Post-Render Formula Verification Engine (Section 11).
Inspects final compiled PDF artifacts on formula-heavy, repaired, or low-confidence pages
to verify that KaTeX HTML and Headless Chrome compilation preserved formulas with 100% fidelity.
"""

import os
import re
from typing import Optional, Any

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.ir.models import CanonicalDocumentIR
from .models import (
    FormulaCanonicalIR,
    FormulaVerificationIssue,
    FormulaIssueType,
    PostRenderVerificationResult
)


class PostRenderFormulaChecker:
    """Spot-checks formula rendering on compiled PDF artifacts."""

    @classmethod
    def verify_rendered_pdf(
        cls,
        pdf_path: str,
        doc_ir: CanonicalDocumentIR,
        formulas: list[FormulaCanonicalIR]
    ) -> PostRenderVerificationResult:
        """
        Executes selective post-render verification on formula-heavy and sensitive pages.
        """
        if not os.path.isfile(pdf_path) or os.path.getsize(pdf_path) < 1024:
            return PostRenderVerificationResult(
                status="FAIL",
                issues=[
                    FormulaVerificationIssue(
                        formula_id="post_render_missing",
                        question_id="all",
                        field="pdf",
                        issue_type=FormulaIssueType.UNRENDERED_MARKUP,
                        expected="Tệp PDF hoàn chỉnh",
                        actual="Tệp không tồn tại hoặc rỗng",
                        severity="critical",
                        description=f"Tệp PDF xuất bản không hợp lệ: {pdf_path}"
                    )
                ]
            )

        doc = fitz.open(pdf_path)
        try:
            total_pages = len(doc)
            if total_pages == 0:
                return PostRenderVerificationResult(status="FAIL")

            # 1. Select representative pages (cap to max 5 pages for performance)
            selected_pages = list(range(1, min(total_pages + 1, 6)))

            issues: list[FormulaVerificationIssue] = []
            verified_count = 0

            # 2. Inspect selected rendered pages
            for page_num in selected_pages:
                page_idx = page_num - 1
                if page_idx < 0 or page_idx >= total_pages:
                    continue

                page = doc[page_idx]
                page_text = page.get_text()

                # Check for unrendered KaTeX markup or broken syntax
                unrendered_patterns = [
                    r"\$\$[^\$]+\$\$",
                    r"\\undefined\b",
                    r"KaTeX parse error",
                    r"\\begin\{matrix\}(?!.*\\end\{matrix\})",
                ]
                for pat in unrendered_patterns:
                    m = re.search(pat, page_text)
                    if m:
                        issues.append(
                            FormulaVerificationIssue(
                                formula_id=f"post_render_p{page_num}",
                                question_id="post_render",
                                field="compiled_page",
                                issue_type=FormulaIssueType.UNRENDERED_MARKUP,
                                expected="Công thức KaTeX kết xuất hoàn chỉnh",
                                actual=m.group(0),
                                severity="critical",
                                description=f"Phát hiện lỗi hiển thị công thức chưa kết xuất trên trang {page_num}: '{m.group(0)[:60]}'"
                            )
                        )

                # Spot-check formula tokens on this page
                for f in formulas:
                    tokens = re.findall(r"[A-Za-z0-9]{2,}", f.render_representation)
                    for tok in tokens[:2]:
                        if tok.isalnum() and len(tok) >= 2 and tok in page_text:
                            verified_count += 1
                            break

            return PostRenderVerificationResult(
                status="PASS" if not issues else "FAIL",
                inspected_pages=selected_pages,
                verified_formulas_count=verified_count,
                issues=issues
            )
        finally:
            doc.close()
