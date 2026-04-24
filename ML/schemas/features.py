"""
Feature schemas — output of the three parallel extractors (CV, NLP, Spatial).
All downstream detection reads from FeatureBundle.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


class CVFeature(BaseModel):
    """A computer vision detection on a UI element."""
    element_id: str = Field(..., description="ID of the UI element this feature belongs to")
    detection_type: str = Field(..., description="What was detected: tiny_close_button, pre_checked_checkbox, misleading_progress, etc.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence 0-1")
    bounding_box: Optional[dict] = Field(default=None, description="Detection bounding box {x, y, w, h}")
    clip_similarity: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="CLIP cosine similarity to dark pattern exemplar")
    exemplar_matched: Optional[str] = Field(default=None, description="Which exemplar image was most similar")
    details: dict = Field(default_factory=dict, description="Additional detection metadata")


class NLPFeature(BaseModel):
    """A text-based dark pattern signal detected by NLP analysis."""
    element_id: str = Field(..., description="ID of the UI element this feature belongs to")
    text: str = Field(..., description="The analyzed text content")
    pattern_type: str = Field(..., description="Detected pattern: confirm_shaming, false_urgency, etc.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classification confidence 0-1")
    sentiment_positive: Optional[float] = Field(default=None, description="Positive sentiment score")
    sentiment_negative: Optional[float] = Field(default=None, description="Negative sentiment score")
    matched_keywords: list[str] = Field(default_factory=list, description="Urgency/manipulation keywords found")
    details: dict = Field(default_factory=dict, description="Additional NLP metadata")


class SpatialFeature(BaseModel):
    """A layout/spatial dark pattern signal from DOM and CSS analysis."""
    element_id: str = Field(..., description="ID of the UI element this feature belongs to")
    violation_type: str = Field(..., description="Type of spatial violation detected")
    severity: str = Field(default="medium", description="Severity: critical, high, medium, low")
    measurements: dict = Field(default_factory=dict, description="Raw measurements that triggered the detection")
    related_element_id: Optional[str] = Field(default=None, description="ID of related element for comparison violations (e.g., accept vs reject button)")
    details: dict = Field(default_factory=dict, description="Additional spatial metadata")


class FeatureBundle(BaseModel):
    """Combined output of all three feature extractors for a single page."""
    page_id: str = Field(..., description="Which page these features were extracted from")
    cv_features: list[CVFeature] = Field(default_factory=list)
    nlp_features: list[NLPFeature] = Field(default_factory=list)
    spatial_features: list[SpatialFeature] = Field(default_factory=list)

    @property
    def total_features(self) -> int:
        return len(self.cv_features) + len(self.nlp_features) + len(self.spatial_features)

    def features_for_element(self, element_id: str) -> dict:
        """Get all features associated with a specific element."""
        return {
            "cv": [f for f in self.cv_features if f.element_id == element_id],
            "nlp": [f for f in self.nlp_features if f.element_id == element_id],
            "spatial": [f for f in self.spatial_features if f.element_id == element_id],
        }

    def modality_count_for_element(self, element_id: str) -> int:
        """Count how many modalities detected something for this element (0-3)."""
        feats = self.features_for_element(element_id)
        count = 0
        if feats["cv"]:
            count += 1
        if feats["nlp"]:
            count += 1
        if feats["spatial"]:
            count += 1
        return count
