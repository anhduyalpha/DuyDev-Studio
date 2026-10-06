"""
Semantic-Preserving Formula Canonicalizer & Multi-Dimensional Integrity Comparator.
Implements the 11-dimension verification strategy (A through K):
A. Character integrity
B. Token integrity
C. Subscript integrity
D. Superscript integrity
E. Symbol integrity
F. Operator integrity
G. Numeric integrity
H. Bracket/parenthesis integrity
I. Unit integrity
J. Equation structure
K. Chemical element/order/count integrity
"""

import re
from typing import Optional
from .models import (
    FormulaType,
    FormulaIssueType,
    FormulaVerificationIssue
)

# Unicode mapping tables
SUB_CHAR_MAP = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
    "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "₊": "+", "₋": "-", "ₐ": "a", "ₑ": "e", "ₕ": "h",
    "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₗ": "l", "ₘ": "m",
    "ₙ": "n", "ₒ": "o", "ₚ": "p", "ᵣ": "r", "ₛ": "s",
    "ₜ": "t", "ᵤ": "u", "ᵥ": "v", "ₓ": "x"
}

SUPER_CHAR_MAP = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁺": "+", "⁻": "-", "ⁿ": "n", "ⁱ": "i"
}

KNOWN_ELEMENTS = {
    "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
    "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
    "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
    "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
    "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
    "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
    "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb",
    "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
    "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
    "Pa", "U", "Np", "Pu"
}

GREEK_SYMBOLS = {
    "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "Delta": "Δ",
    "epsilon": "ε", "zeta": "ζ", "eta": "η", "theta": "θ", "Theta": "Θ",
    "iota": "ι", "kappa": "κ", "lambda": "λ", "Lambda": "Λ", "mu": "μ",
    "nu": "ν", "xi": "ξ", "pi": "π", "Pi": "Π", "rho": "ρ",
    "sigma": "σ", "Sigma": "Σ", "tau": "τ", "upsilon": "υ", "phi": "φ",
    "Phi": "Φ", "chi": "χ", "psi": "ψ", "Psi": "Ψ", "omega": "ω", "Omega": "Ω"
}

PHYSICAL_UNITS = [
    "km/h", "m/s^2", "m/s²", "m/s", "cm/s", "rad/s",
    "mol/L", "mol/l", "mol", "M",
    "cm^3", "cm³", "m^3", "m³", "dm^3", "dm³",
    "mL", "ml", "lít", "lit", "L", "g", "kg", "mg",
    "mmHg", "atm", "Pa", "kPa", "bar",
    "kJ/mol", "kcal", "kJ", "J", "cal",
    "W", "kW", "MW", "V", "mV", "kV",
    "A", "mA", "Ω", "ohm", "F", "H", "Hz",
    "N", "kN", "N/m", "T", "Wb",
    "^\\circ C", "°C", "K"
]


def normalize_to_plain_sub_superscripts(text: str) -> str:
    """Normalizes Unicode and LaTeX subscripts/superscripts into unified markup."""
    if not text:
        return ""
    # Strip enclosing math delimiters $...$ or $$...$$
    if text.startswith("$$") and text.endswith("$$"):
        text = text[2:-2].strip()
    elif text.startswith("$") and text.endswith("$"):
        text = text[1:-1].strip()

    # LaTeX _{...} to _(...) and ^{...} to ^(...)
    text = re.sub(r"_\{([^}]+)\}", r"_\1", text)
    text = re.sub(r"\^\{([^}]+)\}", r"^\1", text)
    # Unicode subscripts
    for u_char, repl in SUB_CHAR_MAP.items():
        if u_char in text:
            text = text.replace(u_char, f"_{repl}")
    # Unicode superscripts
    for u_char, repl in SUPER_CHAR_MAP.items():
        if u_char in text:
            text = text.replace(u_char, f"^{repl}")
    # Group adjacent single-char subscripts: e.g. _1_7 -> _17
    text = re.sub(r"_([A-Za-z0-9+-])(?:_([A-Za-z0-9+-]))+", lambda m: "_" + m.group(0).replace("_", ""), text)
    # Group adjacent single-char superscripts: e.g. ^2^+ -> ^{2+}
    text = re.sub(r"\^([A-Za-z0-9+-])(?:\^([A-Za-z0-9+-]))+", lambda m: "^" + m.group(0).replace("^", ""), text)
    return text


def extract_subscripts(text: str) -> list[str]:
    """Extracts all subscript tokens in a string."""
    norm = normalize_to_plain_sub_superscripts(text)
    return re.findall(r"_([A-Za-z0-9+-]+)", norm)


def extract_superscripts(text: str) -> list[str]:
    """Extracts all superscript tokens in a string."""
    norm = normalize_to_plain_sub_superscripts(text)
    return re.findall(r"\^([A-Za-z0-9+-]+)", norm)


def parse_chemical_composition(formula: str) -> tuple[dict[str, int], int]:
    """
    Parses a chemical formula string into elemental atomic counts and net ionic charge.
    Handles nested parentheses, brackets, organic chains, charge markers, and hydrates.
    Example: '(C17H31COO)3C3H5' -> ({'C': 57, 'H': 98, 'O': 6}, 0)
    Example: 'Cu^{2+}' -> ({'Cu': 1}, 2)
    Example: 'CuSO4.5H2O' -> ({'Cu': 1, 'S': 1, 'O': 9, 'H': 10}, 0)
    """
    clean_f = formula.strip()
    if not clean_f:
        return {}, 0

    # If it's a hydrate e.g. CuSO4.5H2O or CuSO4 \cdot 5H2O
    hydrate_parts = re.split(r"\s*(?:\.|\\cdot|\*)\s*", clean_f)
    if len(hydrate_parts) > 1:
        total_counts: dict[str, int] = {}
        total_charge = 0
        for part in hydrate_parts:
            part = part.strip()
            if not part:
                continue
            # Check leading coefficient e.g. 5H2O -> mult=5, part=H2O
            m_coeff = re.match(r"^(\d+)\s*(.*)$", part)
            if m_coeff:
                mult = int(m_coeff.group(1))
                sub_formula = m_coeff.group(2)
            else:
                mult = 1
                sub_formula = part
            sub_cnts, sub_chg = parse_chemical_composition(sub_formula)
            for elem, cnt in sub_cnts.items():
                total_counts[elem] = total_counts.get(elem, 0) + cnt * mult
            total_charge += sub_chg * mult
        return total_counts, total_charge

    # Normalize LaTeX and Unicode subscripts/superscripts
    clean_f = normalize_to_plain_sub_superscripts(clean_f)
    # Remove leading stoichiometric coefficients if present (e.g. '2 H2O' -> 'H2O')
    clean_f = re.sub(r"^\s*\d+\s*", "", clean_f)

    # Extract charge if present at the end: e.g. ^{2+}, ^2+, 2+, ^+, +, ^-, -
    charge = 0
    m_charge = re.search(r"\^([0-9]*[\+\-])$", clean_f)
    if m_charge:
        ch_str = m_charge.group(1)
        sign = -1 if "-" in ch_str else 1
        num_str = ch_str.replace("+", "").replace("-", "")
        charge = sign * (int(num_str) if num_str else 1)
        clean_f = clean_f[:m_charge.start()].strip()
    else:
        m_charge2 = re.search(r"(\d*[\+\-])$", clean_f)
        if m_charge2 and not clean_f.endswith(("->", "<=>")):
            ch_str = m_charge2.group(1)
            sign = -1 if "-" in ch_str else 1
            num_str = ch_str.replace("+", "").replace("-", "")
            if num_str or len(clean_f) <= 4:
                charge = sign * (int(num_str) if num_str else 1)
                clean_f = clean_f[:m_charge2.start()].strip()

    # Tokenize parentheses and elements
    counts: dict[str, int] = {}
    stack: list[dict[str, int]] = [{}]
    i = 0
    n = len(clean_f)

    while i < n:
        char = clean_f[i]

        if char in "([{":
            stack.append({})
            i += 1
        elif char in ")]}":
            i += 1
            # Check multiplier after closing bracket, e.g. )3 or )_3
            mult_str = ""
            if i < n and clean_f[i] == "_":
                i += 1
            while i < n and clean_f[i].isdigit():
                mult_str += clean_f[i]
                i += 1
            mult = int(mult_str) if mult_str else 1

            if len(stack) > 1:
                group = stack.pop()
                top = stack[-1]
                for elem, cnt in group.items():
                    top[elem] = top.get(elem, 0) + cnt * mult
        elif char.isupper():
            elem = char
            i += 1
            # Check for two-letter element symbol
            if i < n and clean_f[i].islower() and (elem + clean_f[i]) in KNOWN_ELEMENTS:
                elem += clean_f[i]
                i += 1
            # Number or subscript
            num_str = ""
            if i < n and clean_f[i] == "_":
                i += 1
            while i < n and clean_f[i].isdigit():
                num_str += clean_f[i]
                i += 1
            cnt = int(num_str) if num_str else 1
            top = stack[-1]
            top[elem] = top.get(elem, 0) + cnt
        else:
            # Skip non-element characters (bonds, hyphens, spaces, dots)
            i += 1

    # Merge all remaining layers
    while stack:
        layer = stack.pop()
        for elem, cnt in layer.items():
            counts[elem] = counts.get(elem, 0) + cnt

    return counts, charge


def canonicalize_math_expression(expr: str) -> str:
    """Canonicalizes a mathematical string for semantic equivalence."""
    c = expr.strip()
    # Strip $ delimiters
    if c.startswith("$$") and c.endswith("$$"):
        c = c[2:-2].strip()
    elif c.startswith("$") and c.endswith("$"):
        c = c[1:-1].strip()

    # Normalize LaTeX spaces
    c = re.sub(r"\\[,;! ]", " ", c)
    # Normalize roots: √(x) -> \sqrt{x}
    c = re.sub(r"[√]\s*\(?([^)]+)\)?", r"\\sqrt{\1}", c)
    # Normalize fractions
    c = re.sub(r"\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}", r"(\\frac{\1}{\2})", c)
    # Normalize sub/superscripts
    c = normalize_to_plain_sub_superscripts(c)
    # Normalize inequalities and operators
    c = re.sub(r"\\(?:leq|le)\b", "<=", c)
    c = re.sub(r"\\(?:geq|ge)\b", ">=", c)
    c = re.sub(r"\\neq\b", "!=", c)
    c = re.sub(r"\\times\b", "*", c)
    c = re.sub(r"\s+", " ", c)
    return c.strip()


def canonicalize_chemical_reaction(reaction: str) -> str:
    """Canonicalizes a chemical reaction equation."""
    r = reaction.strip()
    if r.startswith("$$") and r.endswith("$$"):
        r = r[2:-2].strip()
    elif r.startswith("$") and r.endswith("$"):
        r = r[1:-1].strip()

    r = re.sub(r"\s*(?:-->|->|—>|\\rightarrow)\s*", " -> ", r)
    r = re.sub(r"\s*(?:<=>|<==>|⇌|\\rightleftharpoons)\s*", " <=> ", r)
    r = re.sub(r"\s*\\xrightarrow\{([^}]+)\}\s*", r" --\1--> ", r)
    return r.strip()


def extract_numeric_tokens(text: str) -> list[str]:
    """Extracts all numeric tokens (including negative numbers and decimals)."""
    # Replace sub/superscripts first to treat them as numbers with markings
    norm = normalize_to_plain_sub_superscripts(text)
    # Find all signed numbers or floating points
    return re.findall(r"(?:(?<=[^A-Za-z0-9_])|^)[-+]?\d+(?:[\.,]\d+)?", norm)


def extract_operators(text: str) -> list[str]:
    """Extracts mathematical and relational operators."""
    norm = text
    norm = re.sub(r"\\(?:le|leq)\b", "<=", norm)
    norm = re.sub(r"\\(?:ge|geq)\b", ">=", norm)
    norm = re.sub(r"\\neq\b", "!=", norm)
    norm = re.sub(r"\\rightarrow\b", "->", norm)
    norm = re.sub(r"\\rightleftharpoons\b", "<=>", norm)
    # Match operators: <=, >=, !=, ==, ->, <=>, +, -, *, /, =, <, >
    op_pattern = re.compile(r"(?:<=|>=|!=|==|->|<=>|\+|-|\*|/|=|<|>|⇌)")
    return op_pattern.findall(norm)


class SemanticFormulaComparator:
    """
    Evaluates 11-dimensional integrity between source and candidate representations.
    Returns a list of structured FormulaVerificationIssue objects.
    """

    @classmethod
    def compare(
        cls,
        source: str,
        candidate: str,
        formula_type: FormulaType,
        formula_id: str = "formula_unknown",
        question_id: str = "q_unknown",
        field: str = "stem"
    ) -> list[FormulaVerificationIssue]:
        """Executes full multi-dimensional verification."""
        issues: list[FormulaVerificationIssue] = []

        clean_src = source.strip()
        clean_cand = candidate.strip()

        if not clean_src:
            return issues

        # Fast path exact match
        if clean_src == clean_cand:
            return issues

        # Strip outer dollar signs for normalization comparison
        src_inner = clean_src.strip("$").strip()
        cand_inner = clean_cand.strip("$").strip()

        # Fast path semantic sub/superscript match (e.g. H₂ == H2, Cu²⁺ == Cu^{2+}, 10⁻³ == 10^{-3})
        if normalize_to_plain_sub_superscripts(src_inner) == normalize_to_plain_sub_superscripts(cand_inner):
            return issues

        # Fast path math canonical match (e.g. √(x²+1) == \sqrt{x^2+1})
        if canonicalize_math_expression(src_inner) == canonicalize_math_expression(cand_inner):
            return issues

        # 1. Branch by specified formula_type
        if formula_type == FormulaType.CHEMISTRY:
            issues.extend(cls._verify_chemistry(clean_src, clean_cand, formula_id, question_id, field))
        elif formula_type == FormulaType.PHYSICS:
            issues.extend(cls._verify_physics(clean_src, clean_cand, formula_id, question_id, field))
        elif formula_type == FormulaType.MATHEMATICS:
            issues.extend(cls._verify_mathematics(clean_src, clean_cand, formula_id, question_id, field))
        else:
            # Fallback auto-detection for GENERAL formulas
            is_chem = any(el in clean_src for el in ("COOH", "COO", "OH", "SO4", "NO3", "CO3", "PO4", "NH4", "->", "⇌"))
            is_phys = any(u in clean_src for u in ("m/s", "km/h", "v_0", "v₀", "a_x", "10^", "10⁻"))
            is_math = any(sym in clean_src for sym in ("\\sqrt", "√", "\\frac", "^", "²", "³", "\\int", "\\lim", "\\log", "\\ln", "<=", ">="))

            if is_chem:
                issues.extend(cls._verify_chemistry(clean_src, clean_cand, formula_id, question_id, field))
            elif is_phys:
                issues.extend(cls._verify_physics(clean_src, clean_cand, formula_id, question_id, field))
            elif is_math:
                issues.extend(cls._verify_mathematics(clean_src, clean_cand, formula_id, question_id, field))

        # 2. Cross-cutting integrity checks across all formulas (Rules A, B, F, G, H)
        issues.extend(cls._verify_general_integrity(clean_src, clean_cand, formula_id, question_id, field))

        # Deduplicate issues by (issue_type, expected, actual)
        deduped: list[FormulaVerificationIssue] = []
        seen_keys: set[tuple[str, str, str]] = set()
        for iss in issues:
            k = (iss.issue_type.value, iss.expected, iss.actual)
            if k not in seen_keys:
                seen_keys.add(k)
                deduped.append(iss)

        return deduped

    @classmethod
    def _verify_chemistry(
        cls,
        source: str,
        candidate: str,
        fid: str,
        qid: str,
        field: str
    ) -> list[FormulaVerificationIssue]:
        issues: list[FormulaVerificationIssue] = []

        # Check Reaction arrows and direction (Rule F)
        has_eq_src = any(arrow in source for arrow in ("<=>", "<==>", "⇌", "\\rightleftharpoons"))
        has_eq_cand = any(arrow in candidate for arrow in ("<=>", "<==>", "⇌", "\\rightleftharpoons"))
        if has_eq_src != has_eq_cand:
            issues.append(
                FormulaVerificationIssue(
                    formula_id=fid,
                    question_id=qid,
                    field=field,
                    issue_type=FormulaIssueType.OPERATOR_MISMATCH,
                    expected="Thuận nghịch (⇌ hoặc <=>)",
                    actual="Một chiều (->) hoặc ngược lại",
                    severity="critical",
                    description=f"Hướng phản ứng hóa học bị sai lệch: nguồn={source}, kết quả={candidate}"
                )
            )

        # Parse Chemical Compositions & Elemental Counts (Rule K & Rule G)
        src_counts, src_charge = parse_chemical_composition(source)
        cand_counts, cand_charge = parse_chemical_composition(candidate)

        if src_counts and cand_counts:
            # Check elemental symbol and count integrity
            for elem, exp_count in src_counts.items():
                act_count = cand_counts.get(elem, 0)
                if act_count != exp_count:
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.ELEMENT_COUNT_MISMATCH,
                            expected=f"{elem}:{exp_count}",
                            actual=f"{elem}:{act_count}",
                            severity="critical",
                            description=f"Sai lệch số lượng nguyên tố '{elem}' trong công thức: mong đợi {exp_count}, thu được {act_count} ({source} -> {candidate})"
                        )
                    )

            for elem, act_count in cand_counts.items():
                if elem not in src_counts:
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.ELEMENT_COUNT_MISMATCH,
                            expected=f"Không có nguyên tố '{elem}'",
                            actual=f"{elem}:{act_count}",
                            severity="critical",
                            description=f"Xuất hiện nguyên tố thừa '{elem}' không có trong nguồn ({source} -> {candidate})"
                        )
                    )

            # Check charge integrity (Rule D)
            if src_charge != cand_charge:
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.SUPERSCRIPT_LOST,
                        expected=f"Điện tích {src_charge:+d}",
                        actual=f"Điện tích {cand_charge:+d}",
                        severity="critical",
                        description=f"Sai lệch điện tích ion: mong đợi {src_charge:+d}, thu được {cand_charge:+d}"
                    )
                )

        # Subscript presence (Rule C): e.g. H2 vs H
        src_subs = extract_subscripts(source)
        cand_subs = extract_subscripts(candidate)
        if src_subs and not cand_subs:
            if not cand_counts or any(cand_counts.get(k, 0) < src_counts.get(k, 0) for k in src_counts):
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.SUBSCRIPT_LOST,
                        expected=str(src_subs),
                        actual="Mất chỉ số dưới",
                        severity="critical",
                        description=f"Chỉ số dưới bị mất trong công thức hóa học: {source} -> {candidate}"
                    )
                )

        return issues

    @classmethod
    def _verify_mathematics(
        cls,
        source: str,
        candidate: str,
        fid: str,
        qid: str,
        field: str
    ) -> list[FormulaVerificationIssue]:
        issues: list[FormulaVerificationIssue] = []

        # Rule D: Exponent / Power integrity (e.g. x² + 1 vs x2 + 1 or x + 1)
        src_supers = extract_superscripts(source)
        cand_supers = extract_superscripts(candidate)

        for exp in src_supers:
            if exp not in cand_supers:
                # Check if flattened into normal text (x² -> x2) or completely dropped (x² -> x)
                cand_lin_pat = r"[A-Za-z]" + re.escape(exp) + r"\b"
                cand_sup_pat = r"[A-Za-z]\^\{?" + re.escape(exp) + r"\}?"
                if re.search(cand_lin_pat, candidate) and not re.search(cand_sup_pat, candidate):
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.SUPERSCRIPT_LOST,
                            expected=f"Lũy thừa ^{exp}",
                            actual=f"Chữ số thường {exp}",
                            severity="critical",
                            description=f"Lũy thừa bị biến thành số thường làm mất ý nghĩa toán học: {source} -> {candidate}"
                        )
                    )
                else:
                    # Dropped exponent entirely (e.g. x² + 1 -> x + 1)
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.SUPERSCRIPT_LOST,
                            expected=f"Lũy thừa ^{exp}",
                            actual=candidate,
                            severity="critical",
                            description=f"Số mũ lũy thừa '^{exp}' bị mất hoàn toàn trong kết xuất: {source} -> {candidate}"
                        )
                    )

        # Rule J: Root structure integrity (√(x²+1) vs sqrt(x2+1))
        has_root_src = any(r in source for r in ("\\sqrt", "√"))
        has_root_cand = any(r in candidate for r in ("\\sqrt", "√"))
        if has_root_src and not has_root_cand:
            issues.append(
                FormulaVerificationIssue(
                    formula_id=fid,
                    question_id=qid,
                    field=field,
                    issue_type=FormulaIssueType.EQUATION_STRUCTURE_MISMATCH,
                    expected="Cấu trúc căn thức (\\sqrt)",
                    actual=candidate,
                    severity="high",
                    description=f"Căn thức bị mất cấu trúc hiển thị toán học: {source} -> {candidate}"
                )
            )

        # Rule J: Fraction structure integrity (\frac{a}{b} vs linear a/b or dropped denominator)
        has_frac_src = "\\frac" in source
        has_frac_cand = "\\frac" in candidate or "/" in candidate
        if has_frac_src and not has_frac_cand:
            issues.append(
                FormulaVerificationIssue(
                    formula_id=fid,
                    question_id=qid,
                    field=field,
                    issue_type=FormulaIssueType.EQUATION_STRUCTURE_MISMATCH,
                    expected="Cấu trúc phân số (\\frac)",
                    actual=candidate,
                    severity="high",
                    description=f"Phân số bị mất cấu trúc tử/mẫu: {source} -> {candidate}"
                )
            )

        # Rule E: Greek symbols integrity
        for greek_name, greek_char in GREEK_SYMBOLS.items():
            if f"\\{greek_name}" in source or greek_char in source:
                if f"\\{greek_name}" not in candidate and greek_char not in candidate:
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.SYMBOL_MISMATCH,
                            expected=f"Ký hiệu Hy Lạp {greek_char} (\\{greek_name})",
                            actual=candidate,
                            severity="high",
                            description=f"Ký hiệu toán học Hy Lạp '{greek_name}' bị mất hoặc biến dạng: {source} -> {candidate}"
                        )
                    )

        # Rule C: Index / Subscript integrity (e.g. x₁ vs x1 or x)
        src_subs = extract_subscripts(source)
        cand_subs = extract_subscripts(candidate)
        for sub in src_subs:
            if sub not in cand_subs:
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.SUBSCRIPT_LOST,
                        expected=f"Chỉ số dưới _{sub}",
                        actual=candidate,
                        severity="high",
                        description=f"Chỉ số dưới biến số bị mất: mong đợi _{sub} trong {source}"
                    )
                )

        # Rule F: Operator and Inequality sign integrity (e.g. <= vs >=, + vs -)
        src_ops = extract_operators(source)
        cand_ops = extract_operators(candidate)
        if src_ops != cand_ops:
            # Check for critical inequality flip (<= vs >=)
            if ("<=" in src_ops and ">=" in cand_ops) or (">=" in src_ops and "<=" in cand_ops):
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.OPERATOR_MISMATCH,
                        expected=str(src_ops),
                        actual=str(cand_ops),
                        severity="critical",
                        description=f"Dấu bất đẳng thức bị đảo ngược: nguồn={source}, kết quả={candidate}"
                    )
                )
            elif len(src_ops) != len(cand_ops):
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.OPERATOR_MISMATCH,
                        expected=str(src_ops),
                        actual=str(cand_ops),
                        severity="high",
                        description=f"Toán tử toán học bị thay đổi hoặc thiếu: nguồn={source}, kết quả={candidate}"
                    )
                )

        # Rule G: Numeric integrity in math (e.g. 2x + 1 vs 3x + 1 or -5 vs 5)
        src_nums = extract_numeric_tokens(source)
        cand_nums = extract_numeric_tokens(candidate)
        if sorted(src_nums) != sorted(cand_nums):
            issues.append(
                FormulaVerificationIssue(
                    formula_id=fid,
                    question_id=qid,
                    field=field,
                    issue_type=FormulaIssueType.NUMERIC_MISMATCH,
                    expected=str(src_nums),
                    actual=str(cand_nums),
                    severity="critical",
                    description=f"Sai lệch hệ số hoặc giá trị số trong biểu thức: mong đợi {src_nums}, thu được {cand_nums}"
                )
            )

        return issues

    @classmethod
    def _verify_physics(
        cls,
        source: str,
        candidate: str,
        fid: str,
        qid: str,
        field: str
    ) -> list[FormulaVerificationIssue]:
        issues: list[FormulaVerificationIssue] = []

        # Rule C: Subscript integrity (v₀ vs v, aₓ vs a)
        src_subs = extract_subscripts(source)
        cand_subs = extract_subscripts(candidate)
        for sub in src_subs:
            if sub not in cand_subs:
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.SUBSCRIPT_LOST,
                        expected=f"Chỉ số đại lượng vật lý _{sub}",
                        actual="Mất chỉ số",
                        severity="critical",
                        description=f"Đại lượng vật lý bị mất chỉ số dưới (ví dụ v₀ thành v): {source} -> {candidate}"
                    )
                )

        # Rule D: Exponent sign & power integrity (10⁻³ vs 10³ or 10^3)
        src_supers = extract_superscripts(source)
        cand_supers = extract_superscripts(candidate)
        for sup in src_supers:
            if sup not in cand_supers:
                if (sup.startswith("-") and sup[1:] in cand_supers) or (not sup.startswith("-") and f"-{sup}" in cand_supers):
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.NUMERIC_MISMATCH,
                            expected=f"Số mũ ^{sup}",
                            actual=f"Số mũ bị đổi dấu: {cand_supers}",
                            severity="critical",
                            description=f"Số mũ khoa học bị đổi dấu (ví dụ 10⁻³ thành 10³): {source} -> {candidate}"
                        )
                    )
                elif re.search(r"10" + re.escape(sup) + r"\b", candidate):
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.SUPERSCRIPT_LOST,
                            expected=f"10^{sup}",
                            actual=f"10{sup}",
                            severity="critical",
                            description=f"Số mũ khoa học bị ép phẳng thành số nguyên: {source} -> {candidate}"
                        )
                    )
                else:
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.SUPERSCRIPT_LOST,
                            expected=f"Số mũ ^{sup}",
                            actual=candidate,
                            severity="critical",
                            description=f"Số mũ khoa học '^{sup}' bị mất: {source} -> {candidate}"
                        )
                    )

        # Rule I: Physical unit integrity
        for unit in PHYSICAL_UNITS:
            u_pat = r"(?:^|\s|\d)(" + re.escape(unit) + r")(?:$|\s|[,\.;\)])"
            if re.search(u_pat, source, re.IGNORECASE):
                if not re.search(u_pat, candidate, re.IGNORECASE):
                    issues.append(
                        FormulaVerificationIssue(
                            formula_id=fid,
                            question_id=qid,
                            field=field,
                            issue_type=FormulaIssueType.UNIT_LOST,
                            expected=f"Đơn vị {unit}",
                            actual="Thiếu đơn vị",
                            severity="high",
                            description=f"Đơn vị vật lý '{unit}' bị mất hoặc sai lệch: {source} -> {candidate}"
                        )
                    )

        # Rule E: Vectors & Greek symbols in physics
        has_vec_src = "\\vec" in source or "→" in source
        has_vec_cand = "\\vec" in candidate or "→" in candidate
        if has_vec_src and not has_vec_cand:
            issues.append(
                FormulaVerificationIssue(
                    formula_id=fid,
                    question_id=qid,
                    field=field,
                    issue_type=FormulaIssueType.SYMBOL_MISMATCH,
                    expected="Dấu vectơ (\\vec)",
                    actual=candidate,
                    severity="high",
                    description=f"Dấu vectơ đại lượng vật lý bị mất: {source} -> {candidate}"
                )
            )

        return issues

    @classmethod
    def _verify_general_integrity(
        cls,
        source: str,
        candidate: str,
        fid: str,
        qid: str,
        field: str
    ) -> list[FormulaVerificationIssue]:
        issues: list[FormulaVerificationIssue] = []

        # Rule H: Bracket / Parenthesis balance (literal '()', '[]', '{}')
        for open_b, close_b in [("(", ")"), ("[", "]"), ("{", "}")]:
            src_open = source.count(open_b)
            src_close = source.count(close_b)
            cand_open = candidate.count(open_b)
            cand_close = candidate.count(close_b)
            if (src_open != cand_open) or (src_close != cand_close):
                issues.append(
                    FormulaVerificationIssue(
                        formula_id=fid,
                        question_id=qid,
                        field=field,
                        issue_type=FormulaIssueType.BRACKET_MISMATCH,
                        expected=f"Dấu ngoặc {open_b}{close_b}: ({src_open}, {src_close})",
                        actual=f"Dấu ngoặc {open_b}{close_b}: ({cand_open}, {cand_close})",
                        severity="high",
                        description=f"Mất cân bằng dấu ngoặc '{open_b}{close_b}': {source} -> {candidate}"
                    )
                )

        return issues
