"""
Question Reconstruction Data Models (Pydantic v2)
Models for reconstructed questions, options, sub-statements, batch payloads, and section types.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class QuestionType(str, Enum):
    """Section classification according to national exam standards."""
    PART_I_MCQ = "part_i_mcq"          # 4-option multiple choice (A, B, C, D)
    PART_II_TF = "part_ii_tf"          # True/False 4 sub-statements (a, b, c, d)
    PART_III_SHORT = "part_iii_short"  # Short-answer fill-in (numeric or term)
    SECTION_HEADER = "section_header"  # Exam header or instructions (ignored in output)


class QuestionOption(BaseModel):
    """Multiple-choice option item (A, B, C, D)."""
    label: str                         # "A", "B", "C", "D"
    text: str                          # Option text preserving KaTeX and chemical formulas
    is_correct: Optional[bool] = None  # Populated during Answer Solving (TASK-08)


class TFSubStatement(BaseModel):
    """Part II True/False sub-statement (a, b, c, d)."""
    label: str                         # "a", "b", "c", "d"
    statement: str                     # Sub-statement text
    is_correct: Optional[bool] = None  # Populated during Answer Solving (TASK-08)


class ReconstructedQuestion(BaseModel):
    """Standardized reconstructed question record with provenance and layout metadata."""
    id: str                            # Stable unique identifier, e.g. "q_p11_c1_a9f1"
    number: int                        # Sequential question number in generated worksheet (1..N)
    source_number: int                 # Original number printed in source document
    type: QuestionType = QuestionType.PART_I_MCQ
    stem: str                          # Question body text (may include [IMAGE_REF: ...])
    options: list[QuestionOption] = Field(default_factory=list)
    sub_statements: list[TFSubStatement] = Field(default_factory=list)
    source_pages: list[int] = Field(default_factory=list)      # 1-based page numbers
    source_block_ids: list[int] = Field(default_factory=list)
    bboxes: list[tuple[float, float, float, float]] = Field(default_factory=list)
    confidence: float = 1.0
    warnings: list[str] = Field(default_factory=list)


class BatchPayload(BaseModel):
    """
    Independent batch package prepared by BatchPlanner for execution.
    Contains target content, neighboring context for cross-page stitching, and visual hints.
    """
    batch_id: str
    batch_type: str                    # "vector_text" | "formula_heavy" | "visual_heavy" | "scanned"
    target_question_numbers: list[int] = Field(default_factory=list)
    page_indices: list[int] = Field(default_factory=list)      # 0-based page indices
    page_numbers: list[int] = Field(default_factory=list)      # 1-based human page numbers
    text_content: str = ""
    neighboring_prev_context: str = "" # Trailing text from previous page for cross-page stitching
    neighboring_next_context: str = "" # Leading text from next page
    image_bytes: Optional[bytes] = None
    has_visuals: bool = False


class BatchReconstructionResult(BaseModel):
    """Structured response schema returned by AI Provider for an individual batch."""
    batch_id: str
    questions: list[ReconstructedQuestion] = Field(default_factory=list)
    unparsed_blocks: list[int] = Field(default_factory=list)
