"""
Clause Database — static regulatory clause lookup.

Matches dark pattern findings to specific regulatory clauses
using subtype mapping and keyword overlap. No embeddings needed.
"""

import json
import os
import logging
from typing import Optional

from schemas.compliance import RegulatoryClause, ComplianceAnnotation
from schemas.detection import Candidate

logger = logging.getLogger(__name__)


class ClauseDatabase:
    """Static regulatory clause database with type-based and keyword matching."""

    def __init__(self, clauses_path: str = None):
        if clauses_path is None:
            clauses_path = os.path.join(
                os.path.dirname(__file__), "regulatory_data", "clauses.json"
            )
        self.clauses = self._load_clauses(clauses_path)
        logger.info(f"Loaded {len(self.clauses)} regulatory clauses")

    def _load_clauses(self, path: str) -> list[RegulatoryClause]:
        """Load regulatory clauses from JSON file."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [RegulatoryClause(**clause) for clause in data]
        except Exception as e:
            logger.error(f"Failed to load regulatory clauses: {e}")
            return []

    def find_violations(self, candidate: Candidate) -> list[ComplianceAnnotation]:
        """
        Match a candidate against regulatory clauses.

        Matching strategy:
        1. Primary: candidate's dark_pattern_subtype in clause.dark_pattern_types
        2. Secondary: keyword overlap between candidate justification and clause keywords
        3. Score: combination of type match + keyword overlap
        """
        annotations = []

        candidate_text = (
            candidate.justification + " " +
            candidate.dark_pattern_subtype + " " +
            candidate.dark_pattern_category + " " +
            json.dumps(candidate.supporting_features)
        ).lower()

        for clause in self.clauses:
            # Primary match: subtype in clause's dark_pattern_types
            type_match = candidate.dark_pattern_subtype in clause.dark_pattern_types

            # Secondary match: keyword overlap
            keyword_matches = [
                kw for kw in clause.keywords
                if kw.lower() in candidate_text
            ]
            keyword_score = len(keyword_matches) / max(len(clause.keywords), 1)

            # Calculate overall match score
            if type_match:
                match_score = 0.7 + (0.3 * keyword_score)
            elif keyword_score >= 0.3:
                match_score = keyword_score * 0.6
            else:
                continue  # No meaningful match

            # Generate violation explanation
            explanation = self._generate_explanation(candidate, clause, keyword_matches)

            annotations.append(ComplianceAnnotation(
                clause_id=clause.clause_id,
                act_name=clause.act_name,
                section=clause.section,
                clause_text=clause.text,
                violation_explanation=explanation,
                severity=clause.severity_tier,
                match_score=round(match_score, 3),
            ))

        # Sort by match score descending, return top matches
        annotations.sort(key=lambda a: a.match_score, reverse=True)
        return annotations[:5]  # Top 5 most relevant clauses

    def _generate_explanation(self, candidate: Candidate,
                              clause: RegulatoryClause,
                              matched_keywords: list[str]) -> str:
        """Generate a human-readable violation explanation."""
        explanation_parts = [
            f"The detected '{candidate.dark_pattern_subtype}' pattern on element "
            f"'{candidate.element_id}' potentially violates {clause.act_name} — {clause.section}.",
        ]

        if matched_keywords:
            explanation_parts.append(
                f"Matched regulatory keywords: {', '.join(matched_keywords[:5])}."
            )

        # Pattern-specific explanations
        subtype_explanations = {
            "pre_selection": "Pre-selected checkboxes do not constitute free and unambiguous consent as required by this regulation.",
            "confirm_shaming": "Using guilt, shame, or emotional pressure to influence user decisions violates the requirement for free and informed choice.",
            "false_urgency": "Creating artificial time pressure to rush user decisions violates fair practice requirements.",
            "hidden_costs": "Concealing fees or costs until late in the process violates transparency requirements.",
            "hard_to_cancel": "Making cancellation significantly harder than sign-up violates the equal ease requirement.",
            "asymmetric_button_sizing": "Giving disproportionate visual prominence to one option impairs the user's ability to make a free choice.",
            "forced_consent": "Requiring consent as a condition of service access when not necessary violates purpose limitation principles.",
            "buried_information": "Obscuring important information through small text, low contrast, or placement undermines informed consent.",
            "toying_with_emotion": "Using emotional manipulation to influence decisions violates the prohibition on deceptive practices.",
            "low_stock_warning": "Unverifiable scarcity claims designed to pressure purchases constitute unfair trade practices.",
        }

        specific = subtype_explanations.get(candidate.dark_pattern_subtype)
        if specific:
            explanation_parts.append(specific)

        return " ".join(explanation_parts)

    def get_all_acts(self) -> list[str]:
        """Return unique act names in the database."""
        return list(set(c.act_name for c in self.clauses))

    def get_clauses_by_act(self, act_name: str) -> list[RegulatoryClause]:
        """Return all clauses for a specific act."""
        return [c for c in self.clauses if c.act_name == act_name]
