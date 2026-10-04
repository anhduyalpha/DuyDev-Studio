"""
Document Object Graph Models (TASK-02 / PLAN-01)
Defines nodes, types, and association attachments connecting layout objects to questions.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from engines.quiz.assets.models import AssetRecord


class ObjectType(str, Enum):
    """Taxonomy of document objects in the graph."""
    TEXT_BLOCK = "text_block"
    IMAGE_ASSET = "image_asset"
    VECTOR_REGION = "vector_region"
    TABLE_REGION = "table_region"
    EQUATION_MATH = "equation_math"
    QUESTION_CANDIDATE = "question_candidate"
    OPTION_CANDIDATE = "option_candidate"
    SECTION_HEADER = "section_header"


class AssociationRole(str, Enum):
    """Semantic role of a visual asset relative to a question."""
    QUESTION_FIGURE = "question_figure"
    STEM_ASSET = "stem_asset"
    OPTION_ASSET = "option_asset"
    REACTION_SCHEME = "reaction_scheme"
    TABLE_FIGURE = "table_figure"
    SOLUTION_FIGURE = "solution_figure"
    UNASSOCIATED = "unassociated"


class RichElementAttachment(BaseModel):
    """
    Association link attaching an AssetRecord to a specific Question.
    Carries semantic role, position hint, confidence, and provenance.
    """
    asset_id: str
    role: AssociationRole = AssociationRole.QUESTION_FIGURE
    position: str = "after_stem"                 # "before_stem" | "after_stem" | "option_A"
    confidence: float = 1.0
    caption: Optional[str] = None
    asset_record: Optional[AssetRecord] = None


class GraphObject(BaseModel):
    """
    A single node in the document object graph representing text, visual, or structural items.
    """
    id: str
    page: int                                    # 1-based page number
    bbox: tuple[float, float, float, float]      # (x0, y0, x1, y1)
    source_order: int                            # Sequential order on page
    type: ObjectType
    content: Optional[str] = None                # Text content if text block
    asset_id: Optional[str] = None               # Reference if visual asset
    parent_id: Optional[str] = None              # Container or question ID
    related_ids: list[str] = Field(default_factory=list)
