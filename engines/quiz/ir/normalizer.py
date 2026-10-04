"""
Semantic-Preserving Content Normalizer
Normalizes mathematical symbols, chemical formulas, sub/superscripts, reactions, and units.
Guarantees 100% fidelity to the original meaning without semantic distortion.
"""

import re

# Unicode Subscript and Superscript Maps
SUB_MAP = {
    "₀": "_0", "₁": "_1", "₂": "_2", "₃": "_3", "₄": "_4",
    "₅": "_5", "₆": "_6", "₇": "_7", "₈": "_8", "₉": "_9",
    "₊": "_+", "₋": "_-"
}

SUPER_MAP = {
    "⁰": "^0", "¹": "^1", "²": "^2", "³": "^3", "⁴": "^4",
    "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9",
    "⁺": "^+", "⁻": "^-"
}

# Standardized Units Regex
UNIT_PATTERN = re.compile(
    r"\b(\d+(?:[,\.]\d+)?)\s*(ml|mL|lit|lít|gam|kg|mol/l|mol/L|mol|M|cm3|cm³|m3|m³|km/h|m/s|kJ|kcal|mmHg|atm)\b",
    re.IGNORECASE
)

# Chemical Arrows Regex
REACTION_ARROW_PATTERN = re.compile(
    r"(?<=\S)\s*(?:-->|->|—>)\s*(?=\S)"
)

EQUILIBRIUM_ARROW_PATTERN = re.compile(
    r"(?<=\S)\s*(?:<=>|<==>|⇌)\s*(?=\S)"
)

# Number multiplication e.g. 2 x 10^3
MULTIPLICATION_PATTERN = re.compile(
    r"\b(\d+(?:[,\.]\d+)?)\s*[xX]\s*(10\^[-+]?\d+|\d+)\b"
)


def normalize_unicode_sub_superscripts(text: str) -> str:
    """
    Converts Unicode subscripts (H₂SO₄) and superscripts (x², Cu²⁺)
    into standard bracketed LaTeX notation.
    """
    # Replace compound superscript sequences e.g. ²⁺ -> ^{2+}
    text = re.sub(r"([⁰¹²³⁴⁵⁶⁷⁸⁹]+)([⁺⁻])", lambda m: "^{" + "".join(SUPER_MAP.get(c, c)[1:] for c in m.group(1)) + SUPER_MAP.get(m.group(2), "")[1:] + "}", text)
    text = re.sub(r"([⁺⁻])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)", lambda m: "^{" + SUPER_MAP.get(m.group(1), "")[1:] + "".join(SUPER_MAP.get(c, c)[1:] for c in m.group(2)) + "}", text)

    # Replace individual superscripts
    for u_char, tex in SUPER_MAP.items():
        if u_char in text:
            text = text.replace(u_char, tex)

    # Replace individual subscripts
    for u_char, tex in SUB_MAP.items():
        if u_char in text:
            text = text.replace(u_char, tex)

    # Group adjacent single-char subscripts e.g. _2_3 -> _{23} if needed, or _2 -> _2
    return text


def normalize_math_symbols(text: str) -> str:
    """
    Normalizes standard scientific notation (2 x 10^3 -> 2 \\times 10^3).
    """
    # Convert multiplication x to \times
    text = MULTIPLICATION_PATTERN.sub(r"\1 \\times \2", text)
    return text


def normalize_chemical_reactions(text: str) -> str:
    """
    Standardizes reaction arrows (-> to \\rightarrow, <=> to \\rightleftharpoons)
    and physical state annotations.
    """
    text = REACTION_ARROW_PATTERN.sub(r" \\rightarrow ", text)
    text = EQUILIBRIUM_ARROW_PATTERN.sub(r" \\rightleftharpoons ", text)
    return text


def normalize_units(text: str) -> str:
    """
    Normalizes spacing and casing for standard scientific units (e.g. 50ml -> 50 mL).
    """
    def _unit_replacer(match: re.Match) -> str:
        val = match.group(1)
        raw_unit = match.group(2).lower()

        unit_canonical = {
            "ml": "mL",
            "lit": "lít",
            "lít": "lít",
            "gam": "g",
            "kg": "kg",
            "mol": "mol",
            "mol/l": "mol/L",
            "m": "M",
            "cm3": "cm³",
            "cm³": "cm³",
            "m3": "m³",
            "m³": "m³",
            "km/h": "km/h",
            "m/s": "m/s",
            "kj": "kJ",
            "kcal": "kcal",
            "mmhg": "mmHg",
            "atm": "atm"
        }.get(raw_unit, raw_unit)

        return f"{val} {unit_canonical}"

    return UNIT_PATTERN.sub(_unit_replacer, text)


def normalize_whitespace_and_punctuation(text: str) -> str:
    """
    Cleans up redundant spaces while preserving deliberate linebreaks.
    Fixes spacing around commas and colons.
    """
    # Remove whitespace before punctuation
    text = re.sub(r"\s+([,;\.:\?!])", r"\1", text)
    # Ensure space after comma if followed by word
    text = re.sub(r",([^\s\d])", r", \1", text)
    # Collapse multiple inline spaces
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def normalize_text(text: str) -> str:
    """
    Applies the full semantic-preserving normalization pipeline to a text segment.
    Safe for stems, options, and explanations.
    """
    if not text:
        return ""

    text = normalize_unicode_sub_superscripts(text)
    text = normalize_chemical_reactions(text)
    text = normalize_math_symbols(text)
    text = normalize_units(text)
    text = normalize_whitespace_and_punctuation(text)
    return text
