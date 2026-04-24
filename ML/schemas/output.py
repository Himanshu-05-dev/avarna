"""
Output schemas — remediation tickets and the final roadmap.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from schemas.compliance import ComplianceAnnotation


class RemediationTicket(BaseModel):
    """A single actionable remediation item for a product manager or designer."""
    ticket_id: str = Field(..., description="Unique ticket identifier")
    element_id: str = Field(..., description="The UI element that needs fixing")
    page_id: str = Field(..., description="Which page the element is on")

    # What's wrong
    dark_pattern_subtype: str = Field(..., description="Detected dark pattern type")
    dark_pattern_category: str = Field(default="", description="Parent category")
    problem_description: str = Field(..., description="Plain-English problem description")
    evidence_summary: str = Field(default="", description="Summary of evidence (CV/NLP/Spatial signals)")

    # Element details
    element_reference: str = Field(default="", description="CSS selector or element ID for reference")
    bounding_box: Optional[dict] = Field(default=None, description="Element location on page {x, y, w, h}")
    screenshot_path: Optional[str] = Field(default=None, description="Path to annotated screenshot")

    # Regulatory
    compliance_annotations: list[ComplianceAnnotation] = Field(default_factory=list)
    regulatory_clause_plain: str = Field(default="", description="Plain language summary of the violated regulation")

    # Fix
    fix_recommendation: str = Field(..., description="Designer-targeted fix with specific element references")
    effort_estimate: str = Field(default="M", description="S (Small), M (Medium), L (Large)")
    acceptance_criterion: str = Field(default="", description="Testable criterion for QA to verify the fix")

    # Scoring
    severity_score: float = Field(default=0.0, description="Severity weight (1-4)")
    reach_score: float = Field(default=0.0, description="User reach estimate (1-3)")
    regulatory_risk: float = Field(default=0.0, description="Regulatory risk multiplier (1-3)")
    priority_score: float = Field(default=0.0, description="Final priority = severity × reach × risk")

    # Evidence chain
    detection_confidence: float = Field(default=0.0, description="ML/heuristic detection confidence")
    gemini_confidence: Optional[float] = Field(default=None, description="Gemini verification confidence if available")
    modality_count: int = Field(default=0, description="How many modalities flagged this (1-3)")


class Roadmap(BaseModel):
    """The final deliverable — prioritized remediation roadmap."""
    scan_url: str = Field(..., description="The scanned website URL")
    scan_timestamp: datetime = Field(default_factory=datetime.now)
    tickets: list[RemediationTicket] = Field(default_factory=list, description="Tickets sorted by priority (highest first)")

    # Summary statistics
    total_elements_scanned: int = 0
    total_findings: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    categories_found: list[str] = Field(default_factory=list, description="Unique dark pattern categories detected")
    regulations_violated: list[str] = Field(default_factory=list, description="Unique acts/regulations violated")

    def sort_by_priority(self):
        """Sort tickets by priority score, highest first."""
        self.tickets.sort(key=lambda t: t.priority_score, reverse=True)

    def sort_by_effort(self):
        """Sort by lowest effort first (quick wins)."""
        effort_order = {"S": 0, "M": 1, "L": 2}
        self.tickets.sort(key=lambda t: (effort_order.get(t.effort_estimate, 1), -t.priority_score))

    def get_quick_wins(self) -> list[RemediationTicket]:
        """High priority + small effort = quick wins."""
        return [
            t for t in self.tickets
            if t.effort_estimate == "S" and t.priority_score >= 6.0
        ]
