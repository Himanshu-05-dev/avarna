"""
Compliance Mapper — orchestrates finding-to-clause mapping.
"""

import logging
from schemas.detection import Candidate, DetectionResult
from schemas.compliance import ComplianceAnnotation
from compliance.clause_database import ClauseDatabase

logger = logging.getLogger(__name__)


class ComplianceMapper:
    """Maps detection results to regulatory violations."""

    def __init__(self, clause_db: ClauseDatabase = None):
        self.clause_db = clause_db or ClauseDatabase()

    def map_findings(self, detection_result: DetectionResult) -> dict[str, list[ComplianceAnnotation]]:
        """
        Map all confirmed findings to regulatory clauses.
        Returns a dict keyed by element_id → list of ComplianceAnnotations.
        """
        findings = detection_result.confirmed_findings()
        logger.info(f"Mapping {len(findings)} findings to regulatory clauses")

        result = {}
        for candidate in findings:
            annotations = self.clause_db.find_violations(candidate)
            if annotations:
                result[candidate.element_id] = annotations
                logger.debug(
                    f"  {candidate.element_id} ({candidate.dark_pattern_subtype}): "
                    f"{len(annotations)} clause matches"
                )

        total_violations = sum(len(v) for v in result.values())
        logger.info(f"Compliance mapping complete: {total_violations} total violations across {len(result)} elements")

        return result
