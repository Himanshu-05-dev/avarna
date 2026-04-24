"""
Roadmap Generator — converts detection results + compliance annotations
into structured RemediationTickets and a prioritized Roadmap.
"""

import logging
from datetime import datetime

from schemas.detection import DetectionResult, Candidate
from schemas.compliance import ComplianceAnnotation
from schemas.output import RemediationTicket, Roadmap
from schemas.input_schema import PageData
from output.priority_scorer import compute_priority, estimate_effort
from config import SEVERITY_WEIGHTS, EFFORT_ESTIMATES, SUBTYPE_TO_CATEGORY

logger = logging.getLogger(__name__)


class RoadmapGenerator:
    """Generate prioritized remediation roadmap from findings."""

    def generate(self,
                 detection_result: DetectionResult,
                 compliance_map: dict[str, list[ComplianceAnnotation]],
                 page: PageData = None) -> Roadmap:
        """
        Generate the final roadmap from detection and compliance results.
        """
        tickets = []
        findings = detection_result.confirmed_findings()
        elements_by_id = {}
        if page:
            elements_by_id = {e.id: e for e in page.all_elements_flat()}

        logger.info(f"Generating roadmap for {len(findings)} findings")

        for i, candidate in enumerate(findings):
            element = elements_by_id.get(candidate.element_id)
            annotations = compliance_map.get(candidate.element_id, [])

            # Compute priority
            scores = compute_priority(candidate, annotations, element)
            effort = estimate_effort(candidate)

            # Build ticket
            ticket = RemediationTicket(
                ticket_id=f"DP-{i+1:03d}",
                element_id=candidate.element_id,
                page_id=candidate.page_id,
                dark_pattern_subtype=candidate.dark_pattern_subtype,
                dark_pattern_category=candidate.dark_pattern_category,
                problem_description=candidate.justification,
                evidence_summary=self._build_evidence_summary(candidate),
                element_reference=candidate.element_id,
                bounding_box=(
                    {"x": element.bounding_box.x, "y": element.bounding_box.y,
                     "w": element.bounding_box.w, "h": element.bounding_box.h}
                    if element and element.bounding_box else None
                ),
                compliance_annotations=annotations,
                regulatory_clause_plain=self._build_plain_regulatory(annotations),
                fix_recommendation=self._generate_fix(candidate),
                effort_estimate=effort,
                acceptance_criterion=self._generate_acceptance_criterion(candidate),
                severity_score=scores["severity_score"],
                reach_score=scores["reach_score"],
                regulatory_risk=scores["regulatory_risk"],
                priority_score=scores["priority_score"],
                detection_confidence=candidate.probability,
                gemini_confidence=(
                    detection_result.gemini_verdicts.get(candidate.element_id, None)
                    and detection_result.gemini_verdicts[candidate.element_id].confidence
                ),
                modality_count=len(set(
                    f.split("_")[0] for f in candidate.supporting_features.keys()
                    if f.startswith(("cv_", "nlp_", "spatial_"))
                )) or 1,
            )
            tickets.append(ticket)

        # Sort by priority
        tickets.sort(key=lambda t: t.priority_score, reverse=True)

        # Build summary stats
        roadmap = Roadmap(
            scan_url=page.url if page and page.url else "unknown",
            scan_timestamp=datetime.now(),
            tickets=tickets,
            total_elements_scanned=detection_result.total_elements_analyzed,
            total_findings=len(tickets),
            critical_count=sum(1 for t in tickets if t.severity_score >= 4),
            high_count=sum(1 for t in tickets if t.severity_score == 3),
            medium_count=sum(1 for t in tickets if t.severity_score == 2),
            low_count=sum(1 for t in tickets if t.severity_score <= 1),
            categories_found=list(set(t.dark_pattern_category for t in tickets)),
            regulations_violated=list(set(
                a.act_name
                for t in tickets
                for a in t.compliance_annotations
            )),
        )

        logger.info(
            f"Roadmap generated: {roadmap.total_findings} tickets "
            f"(Critical: {roadmap.critical_count}, High: {roadmap.high_count}, "
            f"Medium: {roadmap.medium_count}, Low: {roadmap.low_count})"
        )

        return roadmap

    def _build_evidence_summary(self, candidate: Candidate) -> str:
        """Build a concise evidence summary string."""
        parts = [f"Source: {candidate.evidence_source}"]
        if candidate.shap_attributions:
            top_shap = candidate.shap_attributions[:3]
            parts.append("Top SHAP features: " + ", ".join(
                f"{a.feature_name} ({a.shap_value:+.3f})" for a in top_shap
            ))
        if candidate.supporting_features:
            parts.append(f"Supporting signals: {len(candidate.supporting_features)} features")
        return " | ".join(parts)

    def _build_plain_regulatory(self, annotations: list[ComplianceAnnotation]) -> str:
        """Build a plain-language summary of violated regulations."""
        if not annotations:
            return "No specific regulatory clause match found."

        parts = []
        for a in annotations[:3]:  # Top 3 most relevant
            short_act = a.act_name.split("(")[0].strip()
            parts.append(f"{short_act} {a.section} (severity: {a.severity})")
        return "; ".join(parts)

    def _generate_fix(self, candidate: Candidate) -> str:
        """Generate a designer-targeted fix recommendation."""
        fixes = {
            "pre_selection": "Set the checkbox/radio button default state to unchecked. Ensure users must actively opt-in with a clear affirmative action.",
            "confirm_shaming": "Rewrite the decline option text to be neutral and respectful. Example: 'No, thank you' instead of shaming language.",
            "false_urgency": "Remove the false urgency messaging, or verify it against real data. If a timer exists, ensure it reflects a genuine deadline.",
            "countdown_timer": "Remove the countdown timer unless it reflects a genuine time-limited event. Add server-side validation that the deadline is real.",
            "limited_time_claim": "Remove or substantiate the time-limited claim with verifiable information.",
            "low_stock_warning": "Remove the stock warning, or dynamically pull actual inventory data. Displaying verifiable stock levels is acceptable.",
            "asymmetric_button_sizing": "Resize both action buttons (accept and decline) to be visually balanced. Both should be immediately recognizable as interactive elements.",
            "false_hierarchy": "Make the decline/cancel option visually discoverable. Use similar styling (size, color contrast, font weight) to the accept option.",
            "hard_to_cancel": "Simplify the cancellation flow to match the sign-up complexity. Provide a direct, single-step cancellation option.",
            "roach_motel": "Ensure the exit/cancellation process has equal or fewer steps than the entry/sign-up process.",
            "multi_step_exit": "Reduce the cancellation to a single confirmation step. Remove intermediary retention screens.",
            "hidden_costs": "Display all fees and charges prominently at the start of the checkout flow, not at the end.",
            "buried_information": "Move important information (fees, terms, conditions) to a prominent position with readable font size (minimum 14px) and adequate contrast.",
            "forced_consent": "Allow users to access content without requiring consent to non-essential data collection.",
            "toying_with_emotion": "Remove emotionally manipulative language (guilt, fear, sadness). Use neutral, informative language that respects user autonomy.",
            "disguised_ads": "Clearly label advertisements with visible 'Ad' or 'Sponsored' tags. Ensure ads are visually distinct from content.",
            "visual_misdirection": "Ensure all interactive elements are clearly visible and appropriately sized. Do not use visual tricks to divert attention.",
        }

        fix = fixes.get(candidate.dark_pattern_subtype)
        if fix:
            return fix

        return (
            f"Review the '{candidate.dark_pattern_subtype}' pattern on element '{candidate.element_id}' "
            f"and redesign it to respect user autonomy and informed consent."
        )

    def _generate_acceptance_criterion(self, candidate: Candidate) -> str:
        """Generate a testable acceptance criterion for QA."""
        criteria = {
            "pre_selection": "Verify that the checkbox loads in an unchecked state. The associated service/option should only be added after the user explicitly checks it.",
            "confirm_shaming": "Verify that the decline option text is emotionally neutral. No guilt-inducing, fear-based, or shaming language should be present.",
            "false_urgency": "Verify that no time-based pressure messaging appears unless backed by server-validated real deadlines.",
            "countdown_timer": "Verify the timer is removed, or that refreshing the page shows the same deadline (not reset).",
            "low_stock_warning": "Verify stock numbers are dynamically pulled from inventory API, or that the warning is removed entirely.",
            "asymmetric_button_sizing": "Verify both accept and decline buttons have similar dimensions (within 2x area ratio) and both are styled as visible buttons.",
            "false_hierarchy": "Verify the decline option is visible without scrolling, styled as a button or clearly interactive element, with font size >= 14px.",
            "hard_to_cancel": "Verify cancellation can be completed in <= 2 steps from the account settings page.",
            "hidden_costs": "Verify all fees appear on the first screen of the checkout flow, before any user commitment.",
            "buried_information": "Verify the information appears in font size >= 14px, contrast ratio >= 4.5:1, and within the first 80% of the page.",
            "toying_with_emotion": "Verify all copy uses neutral, informative language without emotional appeals, emojis conveying sadness/guilt, or loss-framing.",
        }

        criterion = criteria.get(candidate.dark_pattern_subtype)
        if criterion:
            return criterion

        return f"Verify that the '{candidate.dark_pattern_subtype}' pattern has been addressed and the element provides a clear, non-manipulative user experience."
