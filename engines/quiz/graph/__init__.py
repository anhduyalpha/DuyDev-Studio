"""
Document Object Graph Package
Preserves spatial, structural, and provenance relationships across text, visual assets, and questions.
"""

from .models import ObjectType, AssociationRole, RichElementAttachment, GraphObject, AssetOwnership
from .object_graph import DocumentObjectGraph

__all__ = [
    "ObjectType",
    "AssociationRole",
    "RichElementAttachment",
    "GraphObject",
    "AssetOwnership",
    "DocumentObjectGraph"
]

