"""
Unit Tests for Semantic-Preserving Content Normalizer (TASK-07)
Tests math formatting, chemical formulas, Unicode sub/superscripts, reactions, and units.
"""

import unittest
from engines.quiz.ir.normalizer import (
    normalize_unicode_sub_superscripts,
    normalize_math_symbols,
    normalize_chemical_reactions,
    normalize_units,
    normalize_whitespace_and_punctuation,
    normalize_text
)


class TestContentNormalizer(unittest.TestCase):
    """Test suite for semantic-preserving content normalizer."""

    def test_unicode_subscripts_and_superscripts(self):
        """Tests converting Unicode sub/superscripts to standard LaTeX syntax."""
        # Chemical formula with subscripts
        self.assertEqual(normalize_unicode_sub_superscripts("H₂SO₄"), "H_2SO_4")
        self.assertEqual(normalize_unicode_sub_superscripts("Ca(OH)₂"), "Ca(OH)_2")

        # Mathematical variable with superscript
        self.assertEqual(normalize_unicode_sub_superscripts("x² + y³ = z⁴"), "x^2 + y^3 = z^4")

        # Chemical ion charges (compound superscript and sign)
        cu_ion = normalize_unicode_sub_superscripts("Cu²⁺")
        self.assertIn("^{2+}", cu_ion)

        fe_ion = normalize_unicode_sub_superscripts("Fe³⁺")
        self.assertIn("^{3+}", fe_ion)

    def test_math_symbols_and_scientific_notation(self):
        """Tests standardizing math symbols and multiplication."""
        # Scientific notation 2 x 10^3
        res = normalize_math_symbols("Nồng độ là 2 x 10^3 mol/L")
        self.assertIn("2 \\times 10^3", res)

        # Standard decimal multiplication 3.5 X 10^-5
        res2 = normalize_math_symbols("Giá trị k = 3.5 X 10^-5")
        self.assertIn("3.5 \\times 10^-5", res2)

    def test_chemical_reaction_arrows(self):
        """Tests converting reaction arrows to standard LaTeX arrows."""
        # Simple forward reaction
        self.assertEqual(
            normalize_chemical_reactions("CH3COOH + C2H5OH -> CH3COOC2H5 + H2O"),
            "CH3COOH + C2H5OH \\rightarrow CH3COOC2H5 + H2O"
        )
        self.assertEqual(
            normalize_chemical_reactions("Fe + 2HCl --> FeCl2 + H2"),
            "Fe + 2HCl \\rightarrow FeCl2 + H2"
        )

        # Equilibrium reaction
        self.assertEqual(
            normalize_chemical_reactions("N2 + 3H2 <=> 2NH3"),
            "N2 + 3H2 \\rightleftharpoons 2NH3"
        )
        self.assertEqual(
            normalize_chemical_reactions("SO2 + O2 ⇌ SO3"),
            "SO2 + O2 \\rightleftharpoons SO3"
        )

    def test_units_normalization(self):
        """Tests standardizing scientific and metric units with non-breaking spaces."""
        self.assertEqual(normalize_units("Dung dịch 50ml"), "Dung dịch 50 mL")
        self.assertEqual(normalize_units("Nồng độ 2M"), "Nồng độ 2 M")
        self.assertEqual(normalize_units("Khối lượng 100gam"), "Khối lượng 100 g")
        self.assertEqual(normalize_units("Thể tích 22,4 lit"), "Thể tích 22,4 lít")
        self.assertEqual(normalize_units("Vận tốc 60km/h"), "Vận tốc 60 km/h")

    def test_whitespace_and_punctuation(self):
        """Tests collapsing spaces and fixing spacing around punctuation."""
        self.assertEqual(
            normalize_whitespace_and_punctuation("Cho hỗn hợp gồm  Fe ,  Al   tác dụng với axit ."),
            "Cho hỗn hợp gồm Fe, Al tác dụng với axit."
        )

    def test_full_pipeline_normalize_text(self):
        """Tests full normalization pipeline end-to-end preserving meaning."""
        raw_stem = "Hòa tan hoàn toàn 5,4gam Al vào dung dịch H₂SO₄ loãng  . Khí thoát ra là gì ?"
        normalized = normalize_text(raw_stem)

        self.assertIn("5,4 g", normalized)
        self.assertIn("H_2SO_4", normalized)
        self.assertNotIn("  ", normalized)
        self.assertTrue(normalized.endswith("Khí thoát ra là gì?"))


if __name__ == "__main__":
    unittest.main()
