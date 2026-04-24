"""
Compliance schemas — regulatory clause matching and violation annotations.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


class RegulatoryClause(BaseModel):
    """A specific clause from a regulatory framework."""
    clause_id: str = Field(..., description="Unique identifier e.g. DPDP-S7-1")
    act_name: str = Field(..., description="Name of the act/regulation")
    section: str = Field(..., description="Section/Article reference")
    text: str = Field(..., description="The actual clause text")
    keywords: list[str] = Field(default_factory=list, description="Keywords for matching")
    dark_pattern_types: list[str] = Field(default_factory=list, description="Dark pattern subtypes this clause covers")
    severity_tier: str = Field(default="medium", description="Severity if violated: critical, high, medium, low")


class ComplianceAnnotation(BaseModel):
    """A mapping between a detected dark pattern and a regulatory violation."""
    clause_id: str = Field(..., description="ID of the violated clause")
    act_name: str = Field(..., description="Name of the act")
    section: str = Field(..., description="Section/Article violated")
    clause_text: str = Field(..., description="Full text of the violated clause")
    violation_explanation: str = Field(default="", description="How this finding violates this clause")
    severity: str = Field(default="medium", description="Severity tier: critical, high, medium, low")
    match_score: float = Field(default=0.0, description="How well this clause matches the finding (0-1)")
