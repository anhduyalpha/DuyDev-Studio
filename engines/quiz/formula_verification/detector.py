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

# Common words to exclude from chemical formula false-positives
VIETNAMESE_STOPWORDS = {
    "Chất", "Cho", "Các", "Khi", "Một", "Hai", "Ba", "Bốn", "Trong", "Để",
    "Nếu", "Tìm", "Tính", "Biết", "Gọi", "Tại", "Sau", "Và", "Hoặc", "Được",
    "Có", "Là", "Đoạn", "Đường", "Điểm", "Hình", "Góc", "Mặt", "Đáy", "Cạnh"
}

# 1. Chemical Reaction Equations: e.g. 2H2 + O2 -> 2H2O, N2 + 3H2 <=> 2NH3
CHEM_REACTION_PATTERN = re.compile(
    r"[A-Za-z0-9\(\)\^_\{\}\s\+\-]+\s*(?:-->|->|—>|\\rightarrow|<=>|<==>|⇌|\\rightleftharpoons|--[^-]+-->|\\xrightarrow\{[^}]+\})\s*[A-Za-z0-9\(\)\^_\{\}\s\+\-]+"
)

# 2. Chemical Compounds & Ions:
# Organic chains, ionic charges (Cu^{2+}, Cu²⁺, SO4^{2-}), hydrates (CuSO4.5H2O)
CHEM_FORMULA_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])("
    r"(?:\([A-Za-z0-9_{}\^+-]+\)\d*|[A-Z][a-z]?(?:_\{?[0-9a-z+-]+\}?|[₀₁₂₃₄₅₆₇₈₉]+|\d+)?)+"
    r"(?:COOH|COONa|COOK|COO|OH|SO4|NO3|CO3|PO4|NH4|Cl|Br|O|H|Na|K|Ca|Ba|Fe|Cu|Al|Mg|Zn|Ag|"
    r"\([A-Za-z0-9_{}\^+-]+\)\d*|[A-Z][a-z]?(?:_\{?[0-9a-z+-]+\}?|[₀₁₂₃₄₅₆₇₈₉]+|\d+)?)*"
    r"(?:\^\{?[0-9]*[+-]\}?|[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻])?"
    r"(?:\s*(?:\.|\\cdot|\*)\s*\d+[A-Z][a-z0-9]+)?"
    r")(?![A-Za-z0-9_])"
)

# Structural organic shorthand: e.g. CH3-CH2-OH, CH2=CH2, CH3-COOH
CHEM_STRUCTURAL_PATTERN = re.compile(
    r"\b([A-Z][a-z0-9]*(?:-[A-Z][a-z0-9]*|=[A-Z][a-z0-9]*|≡[A-Z][a-z0-9]*)+)\b"
)

# 3. Mathematical KaTeX Blocks & Command Structures
# LaTeX environments, fractions, roots, matrices
MATH_KATEX_BLOCK_PATTERN = re.compile(
    r"(\$\$[^\$]+\$\$|\$[^\$]+\$|"
    r"\\(?:frac|sqrt|int|lim|log|ln|sum|vec|begin)\b(?:\{[^}]*\}|\[[^\]]*\]|[A-Za-z0-9_])+(?:\{[^}]*\})*|"
    r"\\(?:alpha|beta|gamma|delta|Delta|pi|Pi|theta|Theta|lambda|Lambda|sigma|Sigma|omega|Omega|mu|rho|tau|phi|Phi)\b|"
    r"\\(?:le|leq|ge|geq|neq|times|pm|approx)\b)"
)

# Mathematical Equations & Inequalities: e.g. x^2 - 2x + 1 = 0, y = 3x + 2, x <= 5
MATH_EQUATION_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])([A-Za-z](?:_\{?[0-9a-z+-]+\}?|[₀₁₂₃₄₅₆₇₈₉])?\s*=\s*[-+]?[A-Za-z0-9\s\+\-\*/\^_\{\}\(\)\.]{2,}|"
    r"[A-Za-z0-9\^_\{\}\(\)]+\s*(?:<=|>=|!=|<|>)\s*[-+]?[A-Za-z0-9\s\+\-\*/\^_\{\}\(\)\.]{1,})(?![A-Za-z0-9_])"
)

# Math expressions with powers or roots: e.g. x², x^2, √(x²+1), x₁
MATH_EXPR_PATTERN = re.compile(
    r"(?:[A-Za-z]\^\{?[0-9\+\-a-z]+\}?|[A-Za-z][²³⁴⁵⁶⁷⁸⁹]|[√]\s*\(?[^)]+\)?|\b[A-Za-z]_[0-9a-z]+\b|\b[A-Za-z][₀₁₂₃₄₅₆₇₈₉]\b)"
)

# 4. Physics: scientific notation (10⁻³, 10^{-3}, 3 \times 10^8), equations (F = ma, v = v_0 + at), units
PHYSICS_PATTERN = re.compile(
    r"(\b[vaFspEUBI]_[0-9a-z]+\b|\b[vaFspEUBI][₀₁₂₃₄₅₆₇₈₉]\b|"
    r"\b10\^\{?[-+]?\d+\}?|\b10[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|"
    r"\b\d+(?:[,\.]\d+)?\s*(?:[xX]|\\times)\s*10\^?[-+]?\d+|"
    r"\b[vaFspEUBImk]\s*=\s*[A-Za-z0-9\s\+\-\*/\^_\{\}]{2,}|"
    r"\b\d+(?:[,\.]\d+)?\s*(?:km/h|m/s\^2|m/s²|m/s|rad/s|kJ|kcal|mmHg|atm|kg|mol/L|mol/l)\b)"
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
            # Filter Vietnamese stopwords and short non-formula tokens
            if clean in VIETNAMESE_STOPWORDS or (len(clean) <= 4 and clean.isalpha() and clean.istitle()):
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
            if any(arr in r_str for arr in ("->", "-->", "—>", "<=>", "⇌", "\\rightarrow", "\\rightleftharpoons")):
                _add_formula(
                    r_str,
                    FormulaType.CHEMISTRY,
                    canonicalize_chemical_reaction(r_str),
                    r_str
                )

        # 2. Mathematical KaTeX Blocks & Command Structures
        for m in MATH_KATEX_BLOCK_PATTERN.finditer(text):
            m_str = m.group(0).strip()
            _add_formula(
                m_str,
                FormulaType.MATHEMATICS,
                canonicalize_math_expression(m_str),
                m_str
            )

        # 3. Chemical Compounds & Ions
        for m in CHEM_FORMULA_PATTERN.finditer(text):
            f_str = m.group(1).strip()
            # Must contain digits or sub/superscript or bond or chemical group
            has_chem_feature = any(
                c.isdigit() or c in ("₀₁₂₃₄₅₆₇₈₉_{()^+-\\}") for c in f_str
            ) or any(grp in f_str for grp in ("COOH", "COO", "OH", "SO4", "NO3", "CO3", "PO4", "NH4"))
            if len(f_str) >= 2 and has_chem_feature:
                norm_f = normalize_to_plain_sub_superscripts(f_str)
                _add_formula(
                    f_str,
                    FormulaType.CHEMISTRY,
                    norm_f,
                    f_str
                )

        # 4. Organic structural shorthand (e.g. CH3-CH2-OH)
        for m in CHEM_STRUCTURAL_PATTERN.finditer(text):
            s_str = m.group(1).strip()
            _add_formula(
                s_str,
                FormulaType.CHEMISTRY,
                normalize_to_plain_sub_superscripts(s_str),
                s_str
            )

        # 5. Mathematical Equations & Inequalities
        for m in MATH_EQUATION_PATTERN.finditer(text):
            eq_str = m.group(1).strip()
            _add_formula(
                eq_str,
                FormulaType.MATHEMATICS,
                canonicalize_math_expression(eq_str),
                eq_str
            )

        # 6. Math expressions with powers or roots
        for m in MATH_EXPR_PATTERN.finditer(text):
            m_str = m.group(0).strip()
            _add_formula(
                m_str,
                FormulaType.MATHEMATICS,
                canonicalize_math_expression(m_str),
                m_str
            )

        # 7. Physics Variables, Equations, Units & Scientific Notation
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
