"""
Rich Asset Management Package
Handles high-fidelity extraction of raster images, vector drawings, diagrams, and tables.
"""

from .models import AssetType, ExtractionMethod, AssetRecord
from .extractor import RichAssetExtractor

__all__ = [
    "AssetType",
    "ExtractionMethod",
    "AssetRecord",
    "RichAssetExtractor"
]
