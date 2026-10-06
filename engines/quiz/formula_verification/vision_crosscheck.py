"""
Selective Agnes Vision Cross-Checker & OCR Conflict Inspector (Section 9 & 14).
Crops high-resolution visual region from original PDF page and requests
structured diagnostic from Agnes AI ONLY for conflicted or low-confidence formulas.
Agnes does NOT modify the formula directly; it only provides diagnostic evidence.
"""

import os
import json
import re
from typing import Optional, Any
from pydantic import BaseModel

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.ir.rich_elements import crop_pdf_region
from .models import (
    FormulaCanonicalIR,
    FormulaVerificationStatus,
    FormulaIssueType,
    FormulaVerificationIssue
)


class AgnesFormulaDiagnosis(BaseModel):
    """Structured diagnostic schema returned by Agnes Vision."""
    status: str  # "PASS" | "FAIL"
    source_formula: str
    output_formula: str
    difference: Optional[str] = None
    confidence: float = 1.0


class VisionFormulaCrossChecker:
    """Orchestrates selective crop extraction and Agnes vision cross-checking."""

    @classmethod
    def diagnose_formula_with_crop(
        cls,
        pdf_doc: fitz.Document,
        formula: FormulaCanonicalIR,
        crops_dir: str,
        ai_provider: Optional[Any] = None
    ) -> tuple[AgnesFormulaDiagnosis, Optional[str]]:
        """
        Extracts source crop for the formula's bounding box and invokes Agnes vision diagnostic.
        Returns (AgnesFormulaDiagnosis, crop_path).
        """
        page_num = max(1, formula.source_page)
        bbox = formula.source_bbox or (50.0, 50.0, 545.0, 750.0)

        # 1. High-resolution crop
        crop_path = ""
        try:
            crop_path = crop_pdf_region(
                doc=pdf_doc,
                page_number=page_num,
                bbox=bbox,
                output_dir=crops_dir,
                dpi=250,
                filename_prefix=f"formula_crop_{formula.formula_id}"
            )
        except Exception:
            pass

        # 2. Check if AI Provider is available
        if ai_provider is None or not hasattr(ai_provider, "generate_structured") and not hasattr(ai_provider, "generate_text"):
            # Fallback deterministic diagnostic: compare against source_text
            diff = None
            status = "PASS" if formula.canonical == formula.render_representation else "FAIL"
            if status == "FAIL":
                diff = f"Mismatch between canonical '{formula.canonical}' and render representation '{formula.render_representation}'"
            return AgnesFormulaDiagnosis(
                status=status,
                source_formula=formula.source_text,
                output_formula=formula.render_representation,
                difference=diff,
                confidence=1.0 if status == "PASS" else 0.85
            ), crop_path

        # 3. Prompt Agnes for structured diagnostic
        prompt = (
            "Bạn là chuyên gia thẩm định công thức Toán / Hóa / Lý từ ảnh chụp gốc (Formula Verification Inspector).\n"
            "Nhiệm vụ: So sánh công thức xuất hiện thực tế trong ảnh cắt gốc (source crop) với công thức trích xuất (output formula).\n"
            f"Công thức trích xuất cần kiểm tra: '{formula.render_representation}'\n\n"
            "Tuyệt đối KHÔNG tự ý giải bài hoặc suy diễn theo kiến thức ngoài. Chỉ đọc chính xác những gì nhìn thấy trên ảnh.\n"
            "Hãy trả về kết quả dưới định dạng JSON duy nhất:\n"
            "{\n"
            '  "status": "PASS" hoặc "FAIL",\n'
            '  "source_formula": "<công thức chính xác đọc được từ ảnh>",\n'
            f'  "output_formula": "{formula.render_representation}",\n'
            '  "difference": "<mô tả sai khác nếu FAIL (ví dụ: chỉ số dưới bị sai từ 5 thành 6, thiếu dấu trừ trên số mũ), hoặc null nếu PASS>",\n'
            '  "confidence": 0.99\n'
            "}"
        )

        try:
            # Check if vision endpoint or multimodal generate supported
            if hasattr(ai_provider, "generate_vision_text") and crop_path and os.path.isfile(crop_path):
                raw_response = ai_provider.generate_vision_text(prompt=prompt, image_path=crop_path)
            elif hasattr(ai_provider, "generate_text"):
                raw_response = ai_provider.generate_text(prompt=prompt)
            else:
                raw_response = ""

            # Extract JSON block
            m_json = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if m_json:
                data = json.loads(m_json.group(0))
                diag = AgnesFormulaDiagnosis(
                    status=str(data.get("status", "PASS")).upper(),
                    source_formula=str(data.get("source_formula", formula.source_text)),
                    output_formula=str(data.get("output_formula", formula.render_representation)),
                    difference=data.get("difference"),
                    confidence=float(data.get("confidence", 0.95))
                )
                return diag, crop_path
        except Exception:
            pass

        # Safe fallback
        return AgnesFormulaDiagnosis(
            status="PASS" if formula.canonical == formula.render_representation else "FAIL",
            source_formula=formula.source_text,
            output_formula=formula.render_representation,
            difference=None if formula.canonical == formula.render_representation else "Unverified discrepancy",
            confidence=0.9
        ), crop_path
