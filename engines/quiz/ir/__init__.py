"""
Canonical Document IR Package
The single typed contract between the AI processing pipeline and downstream PDF renderers.
"""

from .models import (
    SchemaVersion,
    DocumentMetadataIR,
    PageIR,
    SectionType,
    SectionIR,
    OptionIR,
    TFStatementIR,
    RichElementType,
    TableDataIR,
    RichElementIR,
    ProvenanceIR,
    LayoutHintsIR,
    QuestionIR,
    AnswerKeyIR,
    CanonicalDocumentIR
)
from .normalizer import normalize_text
from .rich_elements import crop_pdf_region, extract_rich_elements_for_question, find_matching_images_for_question
from .validator import IRValidationError, validate_canonical_document_ir
from .builder import CanonicalIRBuilder

__all__ = [
    "SchemaVersion",
    "DocumentMetadataIR",
    "PageIR",
    "SectionType",
    "SectionIR",
    "OptionIR",
    "TFStatementIR",
    "RichElementType",
    "TableDataIR",
    "RichElementIR",
    "ProvenanceIR",
    "LayoutHintsIR",
    "QuestionIR",
    "AnswerKeyIR",
    "CanonicalDocumentIR",
    "normalize_text",
    "crop_pdf_region",
    "extract_rich_elements_for_question",
    "find_matching_images_for_question",
    "IRValidationError",
    "validate_canonical_document_ir",
    "CanonicalIRBuilder"
]
