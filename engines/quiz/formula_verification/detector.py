"""
Rich Formula & Equation Detector for Canonical IR.
Extracts mathematical, chemical, and physics formulas from QuestionIR components,
preserving strict 1:1 question ownership and geometric provenance.
"""

import re
import uuid
from typing import Optional
from engines.quiz.ir.models import QuestionIR
from .models import (
    FormulaType,
    FormulaCanonicalIR,
    FormulaVerificationStatus
)
from .semantic_canonical import (
    normalize_to_plain_sub_superscripts,
    canonicalize_math_expression,
    canonicalize_chemical_reaction
)

# Robust Patterns for Detection
CHEM_FORMULA_PATTERN = re.compile(
    r"(?:\([A-Za-z0-9_]+\)\d*|[A-Z][a-z]?(?:_\{\d+\}|_\d+|\d+)?)+"
    r"(?:COOH|COO|OH|SO4|NO3|CO3|PO4|NH4|Cl|Br|O|H|Na|K|Ca|Ba|Fe|Cu|Al|Mg|Zn|Ag)*"
)

# Specific organic & inorganic compounds
KNOWN_CHEM_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])((?:\([A-Za-z0-9_]+\)\d*|[A-Z][a-z]?(?:_\{?\d+\}?|\d+)?)+(?:COOH|COONa|COOK|COO|OH|SO4|NO3|CO3|PO4|NH4|Cl|Br|O|H|Na|K|Ca|Ba|Fe|Cu|Al|Mg|Zn|Ag|\([A-Za-z0-9_]+\)\d*|[A-Z][a-z]?(?:_\{?\d+\}?|\d+)?)*)(?![A-Za-z0-9_])"
)

CHEM_REACTION_PATTERN = re.compile(
    r"[A-Za-z0-9\(\)\^_\{\}\s\+\-]+\s*(?:-->|->|—>|\\rightarrow|<=>|<==>|⇌|\\rightleftharpoons|--[^-]+-->|\\xrightarrow\{[^}]+\})\s*[A-Za-z0-9\(\)\^_\{\}\s\+\-]+"
)

MATH_KATEX_PATTERN = re.compile(
    r"(\$\$[^\$]+\$\$|\$[^\$]+\$|\\(?:sqrt|frac|int|lim|log|ln|sum|times|le|ge|neq|alpha|beta|pi|Delta|vec)\b[^\s,;\.?!]*)"
)

MATH_EXPR_PATTERN = re.compile(
    r"(?:[A-Za-z]\^\{?[0-9\+\-]+\}?|[A-Za-z][²³⁴⁵⁶⁷⁸⁹]|[√]\s*\(?[^)]+\)?|\b[A-Za-z]_[0-9a-z]+\b|\b[A-Za-z][₀₁₂₃₄₅₆₇₈₉]\b)"
)

PHYSICS_PATTERN = re.compile(
    r"(\b[vaFspEUBI]_[0-9a-z]+\b|\b[vaFspEUBI][₀₁₂₃₄₅₆₇₈₉]\b|\b10\^\{?[-+]?\d+\}?|\b10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|\b\d+(?:[,\.]\d+)?\s*(?:[xX]|\\times)\s*10\^?[-+]?\d+|\b[Fv]\s*=\s*[A-Za-z0-9\s\+\-\*/\^_\{\}]+)"
)


class FormulaDetector:
    """Scans and extracts structured FormulaCanonicalIR instances from questions."""

    @classmethod
    def detect_formulas_in_text(
        cls,
        text: str,
        question_id: str,
        field: str,
        source_page: int = 1,
        source_bbox: Optional[tuple[float, float, float, float]] = None
    ) -> list[FormulaCanonicalIR]:
        """Detects rich formula components within a text segment."""
        if not text or not text.strip():
            return []

        formulas: list[FormulaCanonicalIR] = []
        seen_texts: set[str] = set()

        def _add_formula(raw: str, ftype: FormulaType, canonical: str, render_rep: str):
            clean = raw.strip()
            if not clean or clean in seen_texts or len(clean) < 2:
                return
            seen_texts.add(clean)
            fid = f"frm_{question_id}_{field}_{uuid.uuid4().hex[:8]}"
            formulas.append(
                FormulaCanonicalIR(
                    formula_id=fid,
                    question_id=question_id,
                    field=field,
                    type=ftype,
                    source_text=clean,
                    canonical=canonical,
                    render_representation=render_rep,
                    tokens=[clean],
                    source_page=source_page,
                    source_bbox=source_bbox,
                    verification_status=FormulaVerificationStatus.PENDING,
                )
            )

        # 1. Chemical Reactions
        for m in CHEM_REACTION_PATTERN.finditer(text):
            r_str = m.group(0).strip()
            _add_formula(
                r_str,
                FormulaType.CHEMISTRY,
                canonicalize_chemical_reaction(r_str),
                r_str
            )

        # 2. Chemical Formulas & Ions (e.g. C17H31COOH, (C17H31COO)3C3H5, H2SO4, Cu^{2+})
        for m in KNOWN_CHEM_PATTERN.finditer(text):
            f_str = m.group(1).strip()
            # Exclude false positives like single words or Roman numerals
            if len(f_str) >= 2 and any(c.isdigit() or c in ("₀₁₂₃₄₅₆₇₈₉_{()^}") for c in f_str):
                norm_f = normalize_to_plain_sub_superscripts(f_str)
                _add_formula(
                    f_str,
                    FormulaType.CHEMISTRY,
                    norm_f,
                    f_str
                )

        # 3. Mathematical KaTeX / LaTeX Expressions
        for m in MATH_KATEX_PATTERN.finditer(text):
            m_str = m.group(1).strip()
            _add_formula(
                m_str,
                FormulaType.MATHEMATICS,
                canonicalize_math_expression(m_str),
                m_str
            )

        # 4. Mathematical Expressions with powers or roots (e.g. x², √(x²+1), x_1)
        for m in MATH_EXPR_PATTERN.finditer(text):
            m_str = m.group(0).strip()
            _add_formula(
                m_str,
                FormulaType.MATHEMATICS,
                canonicalize_math_expression(m_str),
                m_str
            )

        # 5. Physics Subscripts, Scientific notation & Equations (v_0, 10⁻³, F = ma)
        for m in PHYSICS_PATTERN.finditer(text):
            p_str = m.group(0).strip()
            _add_formula(
                p_str,
                FormulaType.PHYSICS,
                normalize_to_plain_sub_superscripts(p_str),
                p_str
            )

        return formulas

    @classmethod
    def detect_for_question(cls, question: QuestionIR) -> list[FormulaCanonicalIR]:
        """Extracts all formulas across stem, options, sub_statements, and rich assets."""
        all_formulas: list[FormulaCanonicalIR] = []
        p_page = question.provenance.source_pages[0] if question.provenance.source_pages else 1
        p_bbox = question.provenance.bboxes[0] if question.provenance.bboxes else None

        # 1. Stem
        stem_f = cls.detect_formulas_in_text(
            question.stem,
            question.id,
            field="stem",
            source_page=p_page,
            source_bbox=p_bbox
        )
        all_formulas.extend(stem_f)

        # 2. Options (A, B, C, D)
        for opt in question.options:
            opt_f = cls.detect_formulas_in_text(
                opt.text,
                question.id,
                field=f"option_{opt.label}",
                source_page=p_page,
                source_bbox=p_bbox
            )
            all_formulas.extend(opt_f)

        # 3. True/False Sub-statements (a, b, c, d)
        for sub in question.sub_statements:
            sub_f = cls.detect_formulas_in_text(
                sub.statement,
                question.id,
                field=f"sub_statement_{sub.label}",
                source_page=p_page,
                source_bbox=p_bbox
            )
            all_formulas.extend(sub_f)

        return all_formulas
