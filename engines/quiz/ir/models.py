"""
Canonical Document Intermediate Representation (IR v3.0.0) Models
The single, authoritative typed contract connecting AI pipelines to HTML/PDF renderers.
"""

from enum import Enum
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field


class SchemaVersion(str, Enum):
    V3_0_0 = "3.0.0"


class DocumentMetadataIR(BaseModel):
    """Metadata describing the overall examination document."""
    title: str = "BÀI TẬP TRẮC NGHIỆM"
    subject: str = "HÓA HỌC"
    grade: Optional[str] = "12"
    exam_code: Optional[str] = None
    total_questions: int
    duration_minutes: Optional[int] = None
    duration: Optional[str] = None
    source_filename: str = ""
    source_hash: str = ""                # SHA-256 hash of original input
    created_at: str                      # ISO 8601 formatted timestamp


class PageIR(BaseModel):
    """Page geometry and characteristics."""
    page_number: int                     # 1-based page number
    width: float                         # Dimension in PDF points (A4 = 595.0)
    height: float                        # Dimension in PDF points (A4 = 842.0)
    kind: str = "vector"                 # "vector" | "mixed" | "scanned"


class SectionType(str, Enum):
    """Standardized examination question section taxonomy."""
    PART_I_MCQ = "part_i_mcq"           # Multiple choice 4 options (A, B, C, D)
    PART_II_TF = "part_ii_tf"           # True/False 4 sub-statements (a, b, c, d)
    PART_III_SHORT = "part_iii_short"   # Short answer fill-in (numeric/term)


class SectionIR(BaseModel):
    """Section container grouping related questions."""
    id: str                              # e.g. "sec_part_i", "sec_part_ii"
    title: str                           # Display title
    instruction: str = ""                # Instructions for examinee
    type: SectionType
    question_ids: list[str] = Field(default_factory=list)


class OptionIR(BaseModel):
    """Multiple-choice option item."""
    label: str                           # "A", "B", "C", "D"
    text: str                            # Normalized KaTeX/chemical text
    is_correct: Optional[bool] = None    # Populated by AnswerKey


class TFStatementIR(BaseModel):
    """True/False sub-statement item."""
    label: str                           # "a", "b", "c", "d"
    statement: str                       # Normalized statement body
    is_correct: Optional[bool] = None    # True = Đúng, False = Sai


class RichElementType(str, Enum):
    """Classification of rich visual and structured components."""
    IMAGE_CROP = "image_crop"           # High-resolution raster crop from source PDF
    STRUCTURED_TABLE = "structured_table"
    DIAGRAM_VECTOR = "diagram_vector"
    CHEMICAL_STRUCTURE = "chemical_structure"


class TableDataIR(BaseModel):
    """Tabular grid representation."""
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)


class RichElementIR(BaseModel):
    """Visual diagram, table, or raster element attached to a question."""
    element_id: str                      # Unique ID e.g. "elem_p11_q1_crop0"
    type: RichElementType = RichElementType.IMAGE_CROP
    source_crop_path: str = ""           # Path to high-res cropped PNG file
    caption: Optional[str] = None
    bbox: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    page_number: int = 1
    table_data: Optional[TableDataIR] = None
    fallback_image_path: Optional[str] = None


class ProvenanceIR(BaseModel):
    """Origin tracing linking back to raw PDF coordinates and pages."""
    source_pages: list[int] = Field(default_factory=list)
    source_block_ids: list[int] = Field(default_factory=list)
    bboxes: list[tuple[float, float, float, float]] = Field(default_factory=list)
    original_number: int = 1


class LayoutHintsIR(BaseModel):
    """Rendering hints for multi-column option layout and page break management."""
    columns: int = 1                     # 1, 2, or 4 columns
    keep_with_next: bool = False
    estimated_height_pt: float = 80.0


class QuestionIR(BaseModel):
    """Canonical question model guaranteed safe for downstream template rendering."""
    id: str                              # Stable ID e.g. "q_p11_num1_a9f1"
    number: int                          # Sequential number in worksheet (1..N)
    source_number: int                   # Original number from paper
    type: SectionType = SectionType.PART_I_MCQ
    stem: str                            # Normalized question stem text
    options: list[OptionIR] = Field(default_factory=list)
    sub_statements: list[TFStatementIR] = Field(default_factory=list)
    rich_elements: list[RichElementIR] = Field(default_factory=list)
    layout_hints: LayoutHintsIR = Field(default_factory=LayoutHintsIR)
    provenance: ProvenanceIR = Field(default_factory=lambda: ProvenanceIR(source_pages=[1]))
    confidence: float = 1.0              # 0.0 .. 1.0
    warnings: list[str] = Field(default_factory=list)
    source_question_number: Optional[int] = None
    selected_order: Optional[int] = None
    output_question_number: Optional[int] = None
    formulas: list[Any] = Field(default_factory=list)


class AnswerKeyIR(BaseModel):
    """Solution and answer verification record mapped 1:1 to QuestionIR."""
    question_id: str                     # Exactly matches QuestionIR.id
    question_number: int                 # Matches QuestionIR.number
    type: SectionType = SectionType.PART_I_MCQ
    selected_answer: str = ""            # "A", "B", "C", "D" (Part I)
    sub_answers: Optional[dict[str, bool]] = None # {"a": True, "b": False...} (Part II)
    short_answer_value: Optional[str] = None      # Numeric or short string (Part III)
    evidence: str = ""                   # Pedagogical explanation (NO Chain-of-Thought)
    confidence: float = 1.0
    is_verified: bool = True


class CanonicalDocumentIR(BaseModel):
    """
    The Single Contract between the AI pipeline and downstream PDF renderers.
    Strictly validated: 0 duplicate IDs, 1:1 question-answer mapping, validated cardinality.
    """
    schema_version: SchemaVersion = SchemaVersion.V3_0_0
    metadata: DocumentMetadataIR
    pages: list[PageIR] = Field(default_factory=list)
    sections: list[SectionIR] = Field(default_factory=list)
    questions: list[QuestionIR] = Field(default_factory=list)
    answers: list[AnswerKeyIR] = Field(default_factory=list)
    question_mapping: list[dict[str, Any]] = Field(default_factory=list)
    unparsed_warnings: list[str] = Field(default_factory=list)
