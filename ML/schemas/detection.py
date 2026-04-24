"""
Detection schemas — candidates, SHAP attributions, and detection results.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SHAPAttribution(BaseModel):
    """SHAP feature attribution explaining why a candidate was flagged."""
    feature_name: str = Field(..., description="Name of the feature")
    shap_value: float = Field(..., description="SHAP value (positive = pushes toward dark pattern)")
    feature_value: float = Field(..., description="Actual feature value used in prediction")


class Candidate(BaseModel):
    """A dark pattern candidate that exceeded the detection threshold."""
    element_id: str = Field(..., description="ID of the flagged UI element")
    page_id: str = Field(..., description="Which page this candidate is from")
    dark_pattern_subtype: str = Field(..., description="Predicted dark pattern subtype")
    dark_pattern_category: str = Field(default="", description="Parent category of the subtype")
    probability: float = Field(..., ge=0.0, le=1.0, description="Detection probability")
    evidence_source: str = Field(..., description="What detected this: heuristic, ensemble, or gemini")
    justification: str = Field(default="", description="Human-readable explanation of why this was flagged")
    shap_attributions: list[SHAPAttribution] = Field(default_factory=list, description="SHAP explanations (for ML ensemble)")
    supporting_features: dict = Field(default_factory=dict, description="Key features that contributed to detection")
    screenshot_region: Optional[str] = Field(default=None, description="Path to cropped screenshot of the element")
    dom_context: Optional[str] = Field(default=None, description="Relevant DOM subtree context")


class GeminiVerdict(BaseModel):
    """Structured verdict from Gemini verification (replaces multi-agent consensus)."""
    finding_confirmed: bool = Field(..., description="Whether Gemini confirms this is a dark pattern")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Gemini's confidence in the verdict")
    reasoning_chain: list[str] = Field(default_factory=list, description="Step-by-step reasoning")
    alternative_explanation: str = Field(default="", description="MANDATORY: Strongest legitimate UX justification")
    revised_subtype: Optional[str] = Field(default=None, description="If Gemini reclassifies the pattern type")
    severity_assessment: str = Field(default="medium", description="Gemini's severity assessment: critical, high, medium, low")


class DetectionResult(BaseModel):
    """Complete detection output for a page."""
    page_id: str
    candidates: list[Candidate] = Field(default_factory=list)
    gemini_verdicts: dict[str, GeminiVerdict] = Field(
        default_factory=dict,
        description="Gemini verdicts keyed by element_id (populated after verification)"
    )
    total_elements_analyzed: int = 0
    detection_timestamp: datetime = Field(default_factory=datetime.now)
    heuristic_count: int = Field(default=0, description="How many came from heuristic rules")
    ensemble_count: int = Field(default=0, description="How many came from ML ensemble")

    def confirmed_findings(self) -> list[Candidate]:
        """Return only candidates confirmed by Gemini (or all if Gemini wasn't run)."""
        if not self.gemini_verdicts:
            return self.candidates
        return [
            c for c in self.candidates
            if c.element_id in self.gemini_verdicts
            and self.gemini_verdicts[c.element_id].finding_confirmed
        ]
