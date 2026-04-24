"""
Priority Scorer — computes priority = severity × reach × regulatory risk.
"""

import logging
from schemas.detection import Candidate
from schemas.compliance import ComplianceAnnotation
from schemas.input_schema import UIElement
from config import SEVERITY_WEIGHTS

logger = logging.getLogger(__name__)


def compute_priority(candidate: Candidate,
                     annotations: list[ComplianceAnnotation],
                     element: UIElement = None) -> dict:
    """
    Compute priority score and its components for a finding.

    Priority = severity_score × reach_score × regulatory_risk

    Returns dict with all scoring components.
    """
    # 1. Severity score (1-4) — from compliance annotations
    severity_score = 1.0
    if annotations:
        max_severity = max(a.severity for a in annotations)
        severity_score = SEVERITY_WEIGHTS.get(max_severity, 2)
    else:
        # Fallback: derive from confidence
        if candidate.probability >= 0.9:
            severity_score = 3
        elif candidate.probability >= 0.7:
            severity_score = 2
        else:
            severity_score = 1

    # 2. Reach score (1-3) — estimate user impact based on element prominence
    reach_score = _estimate_reach(element)

    # 3. Regulatory risk (1-3) — based on number and severity of violated clauses
    regulatory_risk = _estimate_regulatory_risk(annotations)

    priority = severity_score * reach_score * regulatory_risk

    return {
        "severity_score": severity_score,
        "reach_score": reach_score,
        "regulatory_risk": regulatory_risk,
        "priority_score": round(priority, 1),
    }


def _estimate_reach(element: UIElement = None) -> float:
    """
    Estimate how many users are affected.
    Higher score = more users impacted.

    Based on: element position, size, visibility.
    """
    if element is None:
        return 2.0  # Default medium reach

    score = 2.0  # Base score

    if element.bounding_box:
        # Above the fold (top 600px) = higher reach
        if element.bounding_box.y < 600:
            score += 0.5

        # Large elements = more visible = higher reach
        if element.bounding_box.area > 10000:
            score += 0.3

    # Interactive elements have higher reach
    if element.is_interactive:
        score += 0.2

    return min(score, 3.0)


def _estimate_regulatory_risk(annotations: list[ComplianceAnnotation]) -> float:
    """
    Estimate regulatory risk based on violated clauses.

    More violations + higher severity = higher risk.
    """
    if not annotations:
        return 1.0

    # Count critical/high violations
    critical_count = sum(1 for a in annotations if a.severity == "critical")
    high_count = sum(1 for a in annotations if a.severity == "high")

    # Multiple regulatory frameworks violated = higher risk
    unique_acts = len(set(a.act_name for a in annotations))

    risk = 1.0
    risk += critical_count * 0.5
    risk += high_count * 0.3
    risk += (unique_acts - 1) * 0.3  # Extra risk for multi-framework violations

    return min(risk, 3.0)


def estimate_effort(candidate: Candidate) -> str:
    """
    Estimate implementation effort for the fix.
    S = Small (single attribute/text change)
    M = Medium (component redesign)
    L = Large (flow redesign)
    """
    subtype = candidate.dark_pattern_subtype

    small_fixes = {
        "pre_selection",          # Uncheck a checkbox
        "low_stock_warning",      # Remove/verify text
        "confirm_shaming",        # Rewrite text
        "countdown_timer",        # Remove timer
        "limited_time_claim",     # Remove urgency text
    }

    large_fixes = {
        "hard_to_cancel",         # Redesign cancellation flow
        "roach_motel",            # Redesign onboarding/offboarding
        "multi_step_exit",        # Simplify exit flow
        "complex_cancellation_flow",
        "forced_registration",
    }

    if subtype in small_fixes:
        return "S"
    elif subtype in large_fixes:
        return "L"
    else:
        return "M"
