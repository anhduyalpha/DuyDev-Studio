"""
Rich Asset Models (TASK-01 / PLAN-01)
Defines strongly-typed data contracts for extracted visual assets,
provenance tracking, and classification types.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AssetType(str, Enum):
    """Classification of extracted rich visual assets."""
    RASTER = "raster"
    VECTOR_REGION = "vector_region"
    TABLE_REGION = "table_region"
    DIAGRAM_REGION = "diagram_region"
    UNKNOWN_VISUAL = "unknown_visual"


class ExtractionMethod(str, Enum):
    """Method utilized to extract the visual asset."""
    EMBEDDED = "embedded"
    CROP = "crop"
    RENDERED = "rendered"


class AssetRecord(BaseModel):
    """
    Authoritative record for an extracted visual asset from the source PDF.
    Preserves exact coordinates, content hash, dimensions, and extraction method.
    """
    asset_id: str
    type: AssetType = AssetType.RASTER
    source_page: int                             # 1-based page number
    bbox: tuple[float, float, float, float]      # (x0, y0, x1, y1) in PDF points
    path: str                                    # Absolute path to saved image file
    sha256: str                                  # Content hash of the extracted image
    width: int                                   # Pixel width
    height: int                                  # Pixel height
    extraction_method: ExtractionMethod = ExtractionMethod.EMBEDDED
    confidence: float = 1.0
    caption: Optional[str] = None
    error: Optional[str] = None
