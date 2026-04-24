"""
Gemini Verification — uses Google Gemini API for structured verification of candidates.

This is the only LLM call in the pipeline. Gemini has generous free-tier tokens.
Each candidate is sent to Gemini with its evidence context, and Gemini returns
a structured verdict including a mandatory alternative explanation.
"""

import json
import logging
import time
from typing import Optional

from schemas.detection import Candidate, GeminiVerdict

logger = logging.getLogger(__name__)


VERIFICATION_PROMPT_TEMPLATE = """You are an expert UX auditor specializing in dark pattern detection. 
You must analyze the following UI element and determine if it constitutes a dark pattern.

## Element Details
- Element ID: {element_id}
- Detected Pattern Type: {subtype} (Category: {category})
- Detection Confidence: {probability:.0%}
- Evidence Source: {evidence_source}

## Detection Justification
{justification}

## Supporting Evidence
{supporting_features}

## Your Task
Analyze this detection and provide a structured verdict. You MUST:

1. **Determine** if this is genuinely a dark pattern (true/false)
2. **Rate your confidence** (0.0 to 1.0)
3. **Provide step-by-step reasoning** explaining your analysis
4. **MANDATORY: Provide the strongest possible alternative explanation** — argue why this COULD be legitimate UX design, not a dark pattern. This is required even if you confirm the finding.
5. **Assess severity** if confirmed (critical/high/medium/low)

Respond ONLY with valid JSON in this exact format:
{{
    "finding_confirmed": true/false,
    "confidence": 0.0-1.0,
    "reasoning_chain": ["step 1...", "step 2...", "step 3..."],
    "alternative_explanation": "The strongest argument for why this is legitimate UX...",
    "revised_subtype": null or "new_subtype_if_reclassified",
    "severity_assessment": "critical/high/medium/low"
}}
"""


class GeminiVerifier:
    """Verify dark pattern candidates using Google Gemini API."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.model = None
        self._init_gemini()

    def _init_gemini(self):
        """Initialize the Gemini API client."""
        try:
            import google.generativeai as genai

            if not self.api_key:
                from config import GEMINI_API_KEY
                self.api_key = GEMINI_API_KEY

            if not self.api_key or self.api_key == "your_api_key_here":
                logger.warning("Gemini API key not configured. LLM verification will be skipped.")
                return

            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
            logger.info("Gemini API initialized successfully")

        except ImportError:
            logger.warning("google-generativeai not installed. LLM verification will be skipped.")
        except Exception as e:
            logger.warning(f"Could not initialize Gemini: {e}")

    def verify_candidate(self, candidate: Candidate) -> Optional[GeminiVerdict]:
        """
        Send a single candidate to Gemini for verification.
        Returns a structured GeminiVerdict or None if API unavailable.
        """
        if self.model is None:
            return None

        prompt = VERIFICATION_PROMPT_TEMPLATE.format(
            element_id=candidate.element_id,
            subtype=candidate.dark_pattern_subtype,
            category=candidate.dark_pattern_category,
            probability=candidate.probability,
            evidence_source=candidate.evidence_source,
            justification=candidate.justification,
            supporting_features=json.dumps(candidate.supporting_features, indent=2),
        )

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.1,  # Low temperature for consistent structured output
                    "top_p": 0.95,
                    "max_output_tokens": 1024,
                },
            )

            # Parse JSON from response
            response_text = response.text.strip()

            # Handle markdown code blocks
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            verdict_data = json.loads(response_text)

            verdict = GeminiVerdict(
                finding_confirmed=verdict_data.get("finding_confirmed", False),
                confidence=float(verdict_data.get("confidence", 0.5)),
                reasoning_chain=verdict_data.get("reasoning_chain", []),
                alternative_explanation=verdict_data.get("alternative_explanation", ""),
                revised_subtype=verdict_data.get("revised_subtype"),
                severity_assessment=verdict_data.get("severity_assessment", "medium"),
            )

            logger.info(
                f"Gemini verdict for {candidate.element_id}: "
                f"{'CONFIRMED' if verdict.finding_confirmed else 'REJECTED'} "
                f"(confidence: {verdict.confidence:.0%})"
            )
            return verdict

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            return None

    def verify_batch(self, candidates: list[Candidate],
                     delay_seconds: float = 1.0) -> dict[str, GeminiVerdict]:
        """
        Verify a batch of candidates with rate-limit-friendly delays.
        Returns verdicts keyed by element_id.
        """
        verdicts = {}

        if self.model is None:
            logger.warning("Gemini not available — returning empty verdicts")
            return verdicts

        logger.info(f"Verifying {len(candidates)} candidates with Gemini...")

        for i, candidate in enumerate(candidates):
            verdict = self.verify_candidate(candidate)
            if verdict:
                verdicts[candidate.element_id] = verdict

            # Rate limit: wait between calls
            if i < len(candidates) - 1:
                time.sleep(delay_seconds)

        confirmed = sum(1 for v in verdicts.values() if v.finding_confirmed)
        logger.info(f"Gemini verification complete: {confirmed}/{len(verdicts)} confirmed")

        return verdicts
