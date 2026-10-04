"""
Unit Tests for Semantic QA Engine (TASK-10).
"""

import os
import shutil
import tempfile
import unittest

from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionType,
    QuestionIR,
    OptionIR,
    TFStatementIR,
    AnswerKeyIR,
)
from engines.quiz.qa.semantic_qa import validate_semantic_integrity
from engines.quiz.qa.models import QAIssueType, QASeverity


class TestSemanticQA(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_sem_qa_")
        self.dummy_debai = os.path.join(self.temp_dir, "test_DeBai.pdf")
        self.dummy_dapan = os.path.join(self.temp_dir, "test_DapAn.pdf")

        # Create valid mock dummy files (> 1024 bytes)
        with open(self.dummy_debai, "wb") as f:
            f.write(b"%PDF-1.4 mock content " + b"x" * 2000)
        with open(self.dummy_dapan, "wb") as f:
            f.write(b"%PDF-1.4 mock content " + b"y" * 2000)

        self.doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="ĐỀ THI THỬ",
                subject="HÓA HỌC",
                total_questions=2,
                created_at="2026-10-04T12:00:00Z",
            ),
            questions=[
                QuestionIR(
                    id="q_1",
                    number=1,
                    source_number=1,
                    type=SectionType.PART_I_MCQ,
                    stem="Chất nào là este?",
                    options=[
                        OptionIR(label="A", text="HCOOCH3"),
                        OptionIR(label="B", text="CH3OH"),
                        OptionIR(label="C", text="CH3COOH"),
                        OptionIR(label="D", text="C2H5OH"),
                    ],
                ),
                QuestionIR(
                    id="q_2",
                    number=2,
                    source_number=2,
                    type=SectionType.PART_II_TF,
                    stem="Phát biểu về lipit:",
                    sub_statements=[
                        TFStatementIR(label="a", statement="Chất béo nhẹ hơn nước."),
                        TFStatementIR(label="b", statement="Triolein là chất béo no."),
                        TFStatementIR(label="c", statement="Chất béo không tan trong nước."),
                        TFStatementIR(label="d", statement="Dầu mỡ động thực vật chứa este."),
                    ],
                ),
            ],
            answers=[
                AnswerKeyIR(
                    question_id="q_1",
                    question_number=1,
                    type=SectionType.PART_I_MCQ,
                    selected_answer="A",
                    evidence="Este là HCOOCH3",
                ),
                AnswerKeyIR(
                    question_id="q_2",
                    question_number=2,
                    type=SectionType.PART_II_TF,
                    selected_answer="Part II",
                    sub_answers={"a": True, "b": False, "c": True, "d": True},
                    evidence="Triolein không no",
                ),
            ],
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_valid_semantic_integrity_passes(self):
        res = validate_semantic_integrity(self.doc_ir, self.dummy_debai, self.dummy_dapan)
        self.assertEqual(res.status, "PASS")
        self.assertTrue(res.is_pass())
        self.assertEqual(res.total_questions, 2)
        self.assertEqual(res.matched_answers, 2)
        self.assertTrue(res.is_sequence_valid)

    def test_missing_file_triggers_critical_issue(self):
        non_existent = os.path.join(self.temp_dir, "missing.pdf")
        res = validate_semantic_integrity(self.doc_ir, non_existent, self.dummy_dapan)
        self.assertEqual(res.status, "FAIL")
        self.assertFalse(res.is_pass())
        self.assertTrue(any(i.type == QAIssueType.MISSING_FILE and i.severity == QASeverity.CRITICAL for i in res.issues))

    def test_answer_mismatch_triggers_critical_issue(self):
        # Remove answer for question q_2
        doc_ir_missing_ans = self.doc_ir.model_copy(deep=True)
        doc_ir_missing_ans.answers = [doc_ir_missing_ans.answers[0]]

        res = validate_semantic_integrity(doc_ir_missing_ans, self.dummy_debai, self.dummy_dapan)
        self.assertEqual(res.status, "FAIL")
        self.assertTrue(any(i.type == QAIssueType.ANSWER_MISMATCH for i in res.issues))

    def test_non_sequential_question_numbering(self):
        doc_ir_bad_seq = self.doc_ir.model_copy(deep=True)
        # Change second question number to 5 instead of 2
        doc_ir_bad_seq.questions[1].number = 5

        res = validate_semantic_integrity(doc_ir_bad_seq, self.dummy_debai, self.dummy_dapan)
        self.assertEqual(res.status, "FAIL")
        self.assertFalse(res.is_sequence_valid)
        self.assertTrue(any(i.type == QAIssueType.CARDINALITY_MISMATCH for i in res.issues))

    def test_cardinality_mismatch_for_options(self):
        doc_ir_bad_card = self.doc_ir.model_copy(deep=True)
        # Part I question has only 1 option
        doc_ir_bad_card.questions[0].options = [doc_ir_bad_card.questions[0].options[0]]

        res = validate_semantic_integrity(doc_ir_bad_card, self.dummy_debai, self.dummy_dapan)
        self.assertEqual(res.status, "FAIL")
        self.assertTrue(any(i.type == QAIssueType.CARDINALITY_MISMATCH for i in res.issues))


if __name__ == "__main__":
    unittest.main()
