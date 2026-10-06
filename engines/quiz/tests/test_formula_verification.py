"""
Unit & Regression Test Suite for Formula Verification Gate (Section 16 & 17).
Tests all 11 integrity dimensions across Chemistry, Mathematics, Physics,
targeted safe repairs, formula ownership, caching, and gate integration.
"""

import unittest
from engines.quiz.ir.models import (
    QuestionIR,
    OptionIR,
    TFStatementIR,
    ProvenanceIR,
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionType
)
from engines.quiz.formula_verification.models import (
    FormulaType,
    FormulaVerificationStatus,
    FormulaIssueType,
    FormulaCanonicalIR
)
from engines.quiz.formula_verification.semantic_canonical import (
    SemanticFormulaComparator,
    parse_chemical_composition,
    normalize_to_plain_sub_superscripts,
    canonicalize_math_expression,
    canonicalize_chemical_reaction
)
from engines.quiz.formula_verification.detector import FormulaDetector
from engines.quiz.formula_verification.repair import TargetedFormulaRepairEngine
from engines.quiz.formula_verification.cache import FormulaVerificationCache
from engines.quiz.formula_verification.gate import FormulaVerificationGate
from engines.quiz.formula_verification.post_render_checker import PostRenderFormulaChecker


class TestFormulaVerification(unittest.TestCase):
    """Comprehensive test suite for formula integrity verification."""

    # =========================================================================
    # 1. CHEMISTRY TESTS (Section 6 & Section 16)
    # =========================================================================

    def test_chem_stoichiometry_parsing(self):
        """Tests parsing complex organic and inorganic compounds into elemental counts."""
        # Trilinolein: (C17H31COO)3C3H5
        # (17+1)*3 + 3 = 57 C, 31*3 + 5 = 98 H, 2*3 = 6 O
        counts, charge = parse_chemical_composition("(C17H31COO)3C3H5")
        self.assertEqual(counts["C"], 57)
        self.assertEqual(counts["H"], 98)
        self.assertEqual(counts["O"], 6)
        self.assertEqual(charge, 0)

        # Glycerol: C3H5(OH)3
        counts_gly, _ = parse_chemical_composition("C3H5(OH)3")
        self.assertEqual(counts_gly["C"], 3)
        self.assertEqual(counts_gly["H"], 8)
        self.assertEqual(counts_gly["O"], 3)

        # Linoleic acid: C17H31COOH
        counts_lin, _ = parse_chemical_composition("C17H31COOH")
        self.assertEqual(counts_lin["C"], 18)
        self.assertEqual(counts_lin["H"], 32)
        self.assertEqual(counts_lin["O"], 2)

        # Sulfuric acid: H2SO4
        counts_h2so4, _ = parse_chemical_composition("H2SO4")
        self.assertEqual(counts_h2so4["H"], 2)
        self.assertEqual(counts_h2so4["S"], 1)
        self.assertEqual(counts_h2so4["O"], 4)

        # Hydrate: CuSO4.5H2O
        counts_hydrate, _ = parse_chemical_composition("CuSO4.5H2O")
        self.assertEqual(counts_hydrate["Cu"], 1)
        self.assertEqual(counts_hydrate["S"], 1)
        self.assertEqual(counts_hydrate["O"], 9)
        self.assertEqual(counts_hydrate["H"], 10)

    def test_chem_exact_and_semantic_pass(self):
        """Tests semantic equivalence in chemistry formulas."""
        # (C17H31COO)3C3H5 -> (C17H31COO)3C3H5 (PASS)
        issues = SemanticFormulaComparator.compare(
            source="(C17H31COO)3C3H5",
            candidate="(C17H31COO)3C3H5",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertEqual(len(issues), 0)

        # Unicode subscript H₂ -> H2 preserves semantics (PASS)
        issues_h2 = SemanticFormulaComparator.compare(
            source="H₂",
            candidate="H2",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertEqual(len(issues_h2), 0)

        # Unicode subscripts C₁₇H₃₁COOH -> C_{17}H_{31}COOH (PASS)
        issues_lin = SemanticFormulaComparator.compare(
            source="C₁₇H₃₁COOH",
            candidate="C_{17}H_{31}COOH",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertEqual(len(issues_lin), 0)

    def test_chem_element_count_mismatch_failure(self):
        """Tests failing when elemental count changes in chemical formula."""
        # Source: (C17H31COO)3C3H5 vs Output: (C17H31COO)3C3H6 (FAIL)
        issues = SemanticFormulaComparator.compare(
            source="(C17H31COO)3C3H5",
            candidate="(C17H31COO)3C3H6",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertGreater(len(issues), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.ELEMENT_COUNT_MISMATCH for i in issues))

        # H2SO4 vs H2SO3 (FAIL)
        issues_so3 = SemanticFormulaComparator.compare(
            source="H2SO4",
            candidate="H2SO3",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertGreater(len(issues_so3), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.ELEMENT_COUNT_MISMATCH for i in issues_so3))

    def test_chem_subscript_lost_failure(self):
        """Tests failing when a subscript is stripped: H₂ -> H (FAIL)."""
        issues = SemanticFormulaComparator.compare(
            source="H₂",
            candidate="H",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertGreater(len(issues), 0)
        self.assertTrue(any(i.issue_type in (FormulaIssueType.SUBSCRIPT_LOST, FormulaIssueType.ELEMENT_COUNT_MISMATCH) for i in issues))

    def test_chem_ionic_charge_verification(self):
        """Tests ionic charges: Cu^{2+}, Cu²⁺, Fe^{3+}."""
        # Cu²⁺ -> Cu^{2+} (PASS)
        issues_cu = SemanticFormulaComparator.compare(
            source="Cu²⁺",
            candidate="Cu^{2+}",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertEqual(len(issues_cu), 0)

        # Cu^{2+} -> Cu^{3+} (FAIL)
        issues_cu_fail = SemanticFormulaComparator.compare(
            source="Cu^{2+}",
            candidate="Cu^{3+}",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertGreater(len(issues_cu_fail), 0)
        self.assertTrue(any(i.issue_type in (FormulaIssueType.SUPERSCRIPT_LOST, FormulaIssueType.NUMERIC_MISMATCH) for i in issues_cu_fail))

    def test_chem_reaction_direction(self):
        """Tests chemical equilibrium vs forward arrow."""
        # Source is equilibrium ⇌ but candidate is one-way -> (FAIL)
        issues = SemanticFormulaComparator.compare(
            source="N2 + 3H2 <=> 2NH3",
            candidate="N2 + 3H2 -> 2NH3",
            formula_type=FormulaType.CHEMISTRY
        )
        self.assertGreater(len(issues), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.OPERATOR_MISMATCH for i in issues))

    # =========================================================================
    # 2. MATHEMATICS TESTS (Section 7 & Section 16)
    # =========================================================================

    def test_math_powers_and_superscripts(self):
        """Tests powers: x² -> x^2 (PASS) vs x² + 1 -> x2 + 1 (FAIL) vs x² + 1 -> x + 1 (FAIL)."""
        # x² -> x^2 (PASS)
        issues_pass = SemanticFormulaComparator.compare(
            source="x²",
            candidate="x^2",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertEqual(len(issues_pass), 0)

        # x² + 1 -> x2 + 1 (FAIL: superscript lost)
        issues_fail = SemanticFormulaComparator.compare(
            source="x² + 1",
            candidate="x2 + 1",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_fail), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.SUPERSCRIPT_LOST for i in issues_fail))

        # Dropped power: x² + 1 -> x + 1 (FAIL: power dropped completely)
        issues_drop = SemanticFormulaComparator.compare(
            source="x² + 1",
            candidate="x + 1",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_drop), 0)
        self.assertTrue(any(i.issue_type in (FormulaIssueType.SUPERSCRIPT_LOST, FormulaIssueType.NUMERIC_MISMATCH) for i in issues_drop))

    def test_math_roots_structure(self):
        """Tests root structures: √(x²+1) vs sqrt(x2+1) (FAIL)."""
        # √(x²+1) -> \sqrt{x^2+1} (PASS)
        issues_root_pass = SemanticFormulaComparator.compare(
            source="√(x²+1)",
            candidate="\\sqrt{x^2+1}",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertEqual(len(issues_root_pass), 0)

        # √(x²+1) -> sqrt(x2+1) (FAIL: lost math root structure and power)
        issues_root_fail = SemanticFormulaComparator.compare(
            source="√(x²+1)",
            candidate="sqrt(x2+1)",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_root_fail), 0)

    def test_math_indices_and_variables(self):
        """Tests variable indices: x₁ -> x_1 (PASS) vs x₁ -> x (FAIL)."""
        issues_pass = SemanticFormulaComparator.compare(
            source="x₁",
            candidate="x_1",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertEqual(len(issues_pass), 0)

        issues_fail = SemanticFormulaComparator.compare(
            source="x₁",
            candidate="x",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_fail), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.SUBSCRIPT_LOST for i in issues_fail))

    def test_math_greek_symbols(self):
        """Tests Greek symbols: \\Delta, \\alpha, \\pi."""
        issues_pass = SemanticFormulaComparator.compare(
            source="\\Delta = b^2 - 4ac",
            candidate="\\Delta = b^2 - 4ac",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertEqual(len(issues_pass), 0)

        # Greek symbol replaced by letter D (FAIL)
        issues_fail = SemanticFormulaComparator.compare(
            source="\\Delta = b^2 - 4ac",
            candidate="D = b^2 - 4ac",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_fail), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.SYMBOL_MISMATCH for i in issues_fail))

    def test_math_fractions_and_numeric_values(self):
        """Tests fractions and numeric integrity: \\frac{x}{2} vs \\frac{x}{3}."""
        issues_frac = SemanticFormulaComparator.compare(
            source="\\frac{x}{2}",
            candidate="\\frac{x}{3}",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_frac), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.NUMERIC_MISMATCH for i in issues_frac))

    def test_math_inequalities(self):
        """Tests inequality signs: x <= 5 vs x >= 5 (FAIL)."""
        issues_ineq = SemanticFormulaComparator.compare(
            source="x <= 5",
            candidate="x >= 5",
            formula_type=FormulaType.MATHEMATICS
        )
        self.assertGreater(len(issues_ineq), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.OPERATOR_MISMATCH for i in issues_ineq))

    # =========================================================================
    # 3. PHYSICS TESTS (Section 8 & Section 16)
    # =========================================================================

    def test_physics_subscripts(self):
        """Tests physics subscripts: v₀ vs v (FAIL)."""
        # v₀ -> v_0 (PASS)
        issues_pass = SemanticFormulaComparator.compare(
            source="v₀",
            candidate="v_0",
            formula_type=FormulaType.PHYSICS
        )
        self.assertEqual(len(issues_pass), 0)

        # v₀ -> v (FAIL)
        issues_fail = SemanticFormulaComparator.compare(
            source="v₀",
            candidate="v",
            formula_type=FormulaType.PHYSICS
        )
        self.assertGreater(len(issues_fail), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.SUBSCRIPT_LOST for i in issues_fail))

    def test_physics_scientific_notation_and_signs(self):
        """Tests scientific notation and sign integrity: 10⁻³ vs 10³ (FAIL)."""
        # 10⁻³ -> 10^{-3} (PASS)
        issues_pass = SemanticFormulaComparator.compare(
            source="10⁻³",
            candidate="10^{-3}",
            formula_type=FormulaType.PHYSICS
        )
        self.assertEqual(len(issues_pass), 0)

        # 10⁻³ -> 10³ (FAIL: sign reversal)
        issues_fail = SemanticFormulaComparator.compare(
            source="10⁻³",
            candidate="10³",
            formula_type=FormulaType.PHYSICS
        )
        self.assertGreater(len(issues_fail), 0)
        self.assertTrue(any(i.issue_type in (FormulaIssueType.NUMERIC_MISMATCH, FormulaIssueType.SUPERSCRIPT_LOST) for i in issues_fail))

    def test_physics_units_preservation(self):
        """Tests physical units: m/s, km/h, kg."""
        # 60 km/h -> 60 km/h (PASS)
        issues_pass = SemanticFormulaComparator.compare(
            source="Vận tốc 60 km/h",
            candidate="Vận tốc 60 km/h",
            formula_type=FormulaType.PHYSICS
        )
        self.assertEqual(len(issues_pass), 0)

        # Unit stripped: 60 km/h -> 60 (FAIL)
        issues_fail = SemanticFormulaComparator.compare(
            source="Vận tốc 60 km/h",
            candidate="Vận tốc 60",
            formula_type=FormulaType.PHYSICS
        )
        self.assertGreater(len(issues_fail), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.UNIT_LOST for i in issues_fail))

    def test_physics_vectors(self):
        """Tests vector notation: \\vec{v} vs v (FAIL)."""
        issues_vec = SemanticFormulaComparator.compare(
            source="\\vec{v}",
            candidate="v",
            formula_type=FormulaType.PHYSICS
        )
        self.assertGreater(len(issues_vec), 0)
        self.assertTrue(any(i.issue_type == FormulaIssueType.SYMBOL_MISMATCH for i in issues_vec))

    # =========================================================================
    # 4. FORMULA DETECTION & OWNERSHIP (Section 2 & Section 12)
    # =========================================================================

    def test_formula_detection_and_ownership(self):
        """Tests detection across question fields and 1:1 question ownership."""
        q = QuestionIR(
            id="q_test_chem_101",
            number=1,
            source_number=1,
            type=SectionType.PART_I_MCQ,
            stem="Thủy phân hoàn toàn (C17H31COO)3C3H5 trong dung dịch NaOH đun nóng.",
            options=[
                OptionIR(label="A", text="C17H31COONa và C3H5(OH)3"),
                OptionIR(label="B", text="C17H35COONa và C3H5(OH)3"),
                OptionIR(label="C", text="C15H31COONa và C3H5(OH)3"),
                OptionIR(label="D", text="CH3COONa và C2H5OH"),
            ]
        )

        detected = FormulaDetector.detect_for_question(q)
        self.assertGreater(len(detected), 0)

        # Verify strict ownership: every formula has question_id == q.id
        for f in detected:
            self.assertEqual(f.question_id, q.id)
            self.assertTrue(f.formula_id.startswith(f"frm_{q.id}_"))

        # Verify target formulas were found
        src_texts = [f.source_text for f in detected]
        self.assertTrue(any("(C17H31COO)3C3H5" in t for t in src_texts))
        self.assertTrue(any("C3H5(OH)3" in t for t in src_texts))

    def test_latex_fraction_detection_with_spaces(self):
        """Tests that fractions with spaces are not truncated during detection."""
        text = "Tính giá trị của \\frac{x^2 + 1}{2x - 3} khi x = 2."
        formulas = FormulaDetector.detect_formulas_in_text(text, "q_math_frac", "stem")
        self.assertGreater(len(formulas), 0)
        frac_formula = next((f for f in formulas if "\\frac" in f.source_text), None)
        self.assertIsNotNone(frac_formula)
        self.assertIn("2x - 3", frac_formula.source_text)

    # =========================================================================
    # 5. TARGETED SAFE REPAIR (Section 10)
    # =========================================================================

    def test_targeted_formula_repair(self):
        """Tests targeted repair on failing formula without regenerating entire question."""
        q = QuestionIR(
            id="q_repair_target_1",
            number=5,
            source_number=5,
            type=SectionType.PART_I_MCQ,
            stem="Chất béo (C17H31COO)3C3H6 tác dụng với dung dịch NaOH.",  # Typo: C3H6 instead of C3H5
            options=[
                OptionIR(label="A", text="Thu được glixerol")
            ]
        )

        formulas = FormulaDetector.detect_for_question(q)
        stem_formula = next(f for f in formulas if f.field == "stem")

        correct_source = "(C17H31COO)3C3H5"
        repaired_ok, q_repaired, f_repaired, rem_issues = TargetedFormulaRepairEngine.repair_formula_in_question(
            question=q,
            formula=stem_formula,
            correct_formula=correct_source
        )

        self.assertTrue(repaired_ok)
        self.assertEqual(f_repaired.verification_status, FormulaVerificationStatus.REPAIRED)
        self.assertIn("(C17H31COO)3C3H5", q_repaired.stem)
        self.assertNotIn("C3H6", q_repaired.stem)
        self.assertEqual(len(rem_issues), 0)

    # =========================================================================
    # 6. CACHING LAYER (Section 15)
    # =========================================================================

    def test_caching_layer(self):
        """Tests that verified formulas are cached and retrieved."""
        cache = FormulaVerificationCache()
        key = cache.compute_key("source_doc_123", "H2SO4")

        self.assertIsNone(cache.get(key))

        cache.set(key, FormulaVerificationStatus.PASS, [])
        entry = cache.get(key)
        self.assertIsNotNone(entry)
        self.assertEqual(entry["status"], "PASS")

    # =========================================================================
    # 7. END-TO-END GATE VERIFICATION (Section 1, 10, 18)
    # =========================================================================

    def test_formula_gate_end_to_end_pass(self):
        """Tests FormulaVerificationGate execution on a clean CanonicalDocumentIR."""
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="BÀI TẬP HÓA HỌC",
                total_questions=1,
                created_at="2026-10-06T00:00:00Z"
            ),
            questions=[
                QuestionIR(
                    id="q_chem_pass_1",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Công thức của axit sunfuric là H2SO4.",
                    options=[
                        OptionIR(label="A", text="H2SO4"),
                        OptionIR(label="B", text="HCl"),
                        OptionIR(label="C", text="HNO3"),
                        OptionIR(label="D", text="H3PO4"),
                    ]
                )
            ]
        )

        res = FormulaVerificationGate.verify_and_repair(doc_ir=doc_ir)
        self.assertTrue(res.is_pass())
        self.assertEqual(res.failed_count, 0)
        self.assertGreater(res.verified_count, 0)

    def test_formula_gate_end_to_end_detect_and_repair(self):
        """Tests FormulaVerificationGate detecting a discrepancy from source_text and repairing it."""
        formula_item = FormulaCanonicalIR(
            formula_id="frm_repair_test_1",
            question_id="q_repair_stem",
            field="stem",
            type=FormulaType.CHEMISTRY,
            source_text="(C17H31COO)3C3H5",
            canonical="(C17H31COO)3C3H5",
            render_representation="(C17H31COO)3C3H6",  # Corrupted
            source_page=1
        )
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="BÀI TẬP HÓA HỌC",
                total_questions=1,
                created_at="2026-10-06T00:00:00Z"
            ),
            questions=[
                QuestionIR(
                    id="q_repair_stem",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Thủy phân hoàn toàn (C17H31COO)3C3H6 trong NaOH.",
                    options=[],
                    formulas=[formula_item]
                )
            ]
        )

        res = FormulaVerificationGate.verify_and_repair(doc_ir=doc_ir)
        self.assertTrue(res.is_pass())
        self.assertEqual(res.status, "REPAIRED")
        self.assertEqual(res.repaired_count, 1)
        self.assertIn("(C17H31COO)3C3H5", doc_ir.questions[0].stem)

    def test_formula_gate_failure_on_unrendered_markup(self):
        """Tests gate failing when unrendered markup \\undefined is present."""
        formula_broken = FormulaCanonicalIR(
            formula_id="frm_broken_1",
            question_id="q_broken",
            field="stem",
            type=FormulaType.MATHEMATICS,
            source_text="\\frac{1}{2}",
            canonical="\\frac{1}{2}",
            render_representation="\\undefined",
            source_page=1
        )
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="BÀI TẬP TOÁN",
                total_questions=1,
                created_at="2026-10-06T00:00:00Z"
            ),
            questions=[
                QuestionIR(
                    id="q_broken",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Biểu thức có giá trị bằng \\undefined.",
                    options=[],
                    formulas=[formula_broken]
                )
            ]
        )

        res = FormulaVerificationGate.verify_and_repair(doc_ir=doc_ir, max_retries=0)
        self.assertFalse(res.is_pass())
        self.assertEqual(res.status, "FAIL")
        self.assertGreater(res.failed_count, 0)


if __name__ == "__main__":
    unittest.main()
