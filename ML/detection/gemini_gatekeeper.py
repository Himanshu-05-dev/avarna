"""
Gemini Gatekeeper — the REAL detection authority.

All agent candidates (CV, NLP, Spatial heuristics) are filtered through this
gatekeeper. Gemini receives the screenshot + website context + all candidates
and decides what actually passes as a confirmed dark pattern.

Hard Gates (bypass Gemini — pass automatically):
- Contrast ratio below 1.5:1 on opt-out/disclosure text
- Brightness/opacity below 0.3 on disclosure text

Everything else requires Gemini confirmation.

Fallback: If Gemini is unavailable, falls back to heuristic-only detection
with very high thresholds (>90% confidence) to minimize false positives.
"""

import json
import logging
import time
from typing import Optional

from schemas.detection import Candidate, GeminiVerdict, WebsiteContext

logger = logging.getLogger(__name__)


# ─── Gatekeeper Prompt ─────────────────────────────────────────────────────────

GATEKEEPER_PROMPT = """You are the FINAL AUTHORITY on dark pattern detection for a regulatory compliance audit. You receive:
1. A screenshot of a webpage
2. The website context (what kind of site it is)
3. A list of candidate dark patterns flagged by automated agents (CV, NLP, Spatial analysis)

Your job: For EACH candidate, decide if it is a GENUINE dark pattern or a FALSE POSITIVE.

## Website Context
{context_json}

## Candidates to Judge
{candidates_json}

## IMPORTANT: Even Established Brands Use Dark Patterns

Major websites (Amazon, Booking.com, Alibaba, Flipkart) are KNOWN to use dark patterns extensively.
Being a well-known brand does NOT mean the site is free of dark patterns. In fact, large e-commerce 
and travel sites are the WORST offenders. You must audit them strictly.

## Context-Specific Guidance

### E-commerce (Amazon, Flipkart, Alibaba, etc.):
These sites FREQUENTLY use dark patterns. CONFIRM these when detected:
- **Fake urgency**: "Only X left!", "Deal expires in...", countdown timers — these are classic dark patterns
- **Price anchoring**: Inflated "original" prices with misleading discounts
- **Pre-selected add-ons**: Insurance, warranties, or subscriptions pre-checked
- **Hidden fees**: Charges revealed only at checkout
- **Confirm shaming**: "No thanks, I don't want to save money"
- **Nagging popups**: App download prompts, newsletter overlays blocking content
- **Social proof manipulation**: "X people viewing this" — often fabricated

ONLY reject if the candidate is truly a standard feature (e.g., a normal "Add to Cart" button, 
a regular product price without manipulation).

### Travel/Booking (Booking.com, MakeMyTrip, etc.):
These are NOTORIOUS for dark patterns. Be EXTRA strict:
- "Only 2 rooms left!" — classic fake scarcity
- "X people looking at this" — social proof manipulation
- Urgency banners — pressure tactics
- Pre-selected insurance/extras

### Social Media (Reddit, Twitter, etc.):
- **User posts/comments** with urgency words = NOT a dark pattern (it's content, not the site)
- **Site UI elements** (forced notifications, deceptive opt-ins, nagging prompts) = ARE dark patterns

### News/Media:
- **Headlines** with urgency = editorial, NOT dark pattern
- **Subscription paywalls with manipulative design** = ARE dark patterns

## When to CONFIRM a candidate:
- The automated agents detected a genuine deceptive/manipulative UI pattern
- The pattern pressures, tricks, or misleads users
- Even if the site is a major brand — brands use dark patterns too
- The evidence (text, layout, sizing, contrast) supports the finding

## When to REJECT a candidate:
- User-generated content on social media mistakenly flagged as a site pattern
- Genuinely standard UI elements (normal buttons, regular navigation)
- Search/filter checkboxes that are pre-set for UX convenience (not consent-related)
- Standard pricing display without manipulation

## Response Format

Respond ONLY with a valid JSON object:
{{
    "decisions": [
        {{
            "element_id": "the candidate's element_id",
            "confirmed": true/false,
            "confidence": 0.0-1.0,
            "reasoning": "Why this is or isn't a genuine dark pattern given the context",
            "severity": "critical/high/medium/low",
            "revised_subtype": null or "new_subtype_if_reclassified"
        }}
    ],
    "overall_assessment": "1-2 sentence summary of the page's dark pattern risk level"
}}

RULES:
- Judge EVERY candidate in the list — don't skip any
- LEAN TOWARD CONFIRMING — the automated agents already applied strict filters, so candidates that reach you are likely genuine
- Use the screenshot as visual ground truth
- Do NOT give sites a free pass just because they are well-known brands
- When in doubt, CONFIRM with medium severity rather than rejecting
"""


class GeminiGatekeeper:
    """
    The authoritative dark pattern gatekeeper.
    
    All agent candidates pass through here. Only Gemini-confirmed findings
    (or hard-gated signals) make it to the final report.
    """

    # Hard-gate thresholds — these bypass Gemini
    HARD_GATE_CONTRAST_CEILING = 1.5   # Contrast ratio below this = nearly invisible
    HARD_GATE_OPACITY_FLOOR = 0.3      # Opacity below this = nearly invisible

    # Fallback threshold when Gemini is unavailable
    FALLBACK_CONFIDENCE_THRESHOLD = 0.90

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
                logger.warning("Gemini Gatekeeper: API key not configured.")
                return

            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
            logger.info("Gemini Gatekeeper: Initialized successfully")

        except ImportError:
            logger.warning("Gemini Gatekeeper: google-generativeai not installed.")
        except Exception as e:
            logger.warning(f"Gemini Gatekeeper: Could not initialize: {e}")

    @property
    def is_available(self) -> bool:
        return self.model is not None

    def gate(
        self,
        candidates: list[Candidate],
        image_data: Optional[bytes],
        website_context: Optional[dict],
        page_id: str,
    ) -> tuple[list[Candidate], dict[str, GeminiVerdict], Optional[WebsiteContext]]:
        """
        Run all candidates through the Gemini gate.
        
        Args:
            candidates: All candidates from heuristic/ensemble detection
            image_data: Raw screenshot bytes (or None)
            website_context: Website context dict from screenshot agent (or None)
            page_id: The page being analyzed
            
        Returns:
            tuple of (confirmed_candidates, gemini_verdicts, website_context_model)
        """
        if not candidates:
            logger.info("Gemini Gatekeeper: No candidates to gate")
            return [], {}, self._make_context_model(website_context)

        # Step 1: Separate hard-gated candidates from Gemini-gated candidates
        hard_gated, gemini_review = self._split_hard_gates(candidates)
        logger.info(
            f"Gemini Gatekeeper: {len(hard_gated)} hard-gated (auto-pass), "
            f"{len(gemini_review)} need Gemini review"
        )

        # Step 2: Build verdicts for hard-gated candidates (auto-confirmed)
        verdicts: dict[str, GeminiVerdict] = {}
        for c in hard_gated:
            verdicts[c.element_id] = GeminiVerdict(
                finding_confirmed=True,
                confidence=c.probability,
                reasoning_chain=[
                    f"Hard-gated: {c.dark_pattern_subtype} — "
                    f"extreme visual manipulation detected (contrast/opacity below hard threshold).",
                    f"Evidence: {c.justification[:200]}",
                ],
                alternative_explanation="The extreme contrast/opacity values leave no room for legitimate UX justification.",
                severity_assessment=self._severity_from_prob(c.probability),
            )

        # Step 3: Send remaining candidates to Gemini
        if gemini_review:
            if self.is_available:
                gemini_confirmed, gemini_verdicts = self._gemini_judge(
                    gemini_review, image_data, website_context
                )
                verdicts.update(gemini_verdicts)
            else:
                # Fallback: no Gemini → use heuristic with very high threshold
                logger.warning(
                    f"Gemini Gatekeeper: Gemini unavailable — "
                    f"falling back to {self.FALLBACK_CONFIDENCE_THRESHOLD:.0%} threshold"
                )
                gemini_confirmed = []
                for c in gemini_review:
                    if c.probability >= self.FALLBACK_CONFIDENCE_THRESHOLD:
                        gemini_confirmed.append(c)
                        verdicts[c.element_id] = GeminiVerdict(
                            finding_confirmed=True,
                            confidence=c.probability * 0.85,
                            reasoning_chain=[
                                "Gemini unavailable — auto-confirmed due to very high "
                                f"detection confidence ({c.probability:.0%} >= {self.FALLBACK_CONFIDENCE_THRESHOLD:.0%}).",
                            ],
                            alternative_explanation="LLM verification was not available. High-confidence heuristic detection.",
                            severity_assessment=self._severity_from_prob(c.probability),
                        )
                    else:
                        verdicts[c.element_id] = GeminiVerdict(
                            finding_confirmed=False,
                            confidence=c.probability,
                            reasoning_chain=[
                                f"Gemini unavailable — dropped due to insufficient confidence "
                                f"({c.probability:.0%} < {self.FALLBACK_CONFIDENCE_THRESHOLD:.0%}).",
                            ],
                            alternative_explanation="Without LLM verification, only very high confidence findings are retained.",
                            severity_assessment="low",
                        )

                logger.info(
                    f"Gemini Gatekeeper fallback: {len(gemini_confirmed)}/{len(gemini_review)} "
                    f"passed the {self.FALLBACK_CONFIDENCE_THRESHOLD:.0%} threshold"
                )
        else:
            gemini_confirmed = []

        # Combine hard-gated + Gemini-confirmed
        final_candidates = hard_gated + gemini_confirmed
        final_candidates.sort(key=lambda c: c.probability, reverse=True)

        context_model = self._make_context_model(website_context)

        logger.info(
            f"Gemini Gatekeeper: {len(final_candidates)} confirmed out of "
            f"{len(candidates)} total candidates"
        )
        return final_candidates, verdicts, context_model

    def _split_hard_gates(self, candidates: list[Candidate]) -> tuple[list[Candidate], list[Candidate]]:
        """
        Separate candidates that pass the hard gate (auto-confirm) from those
        that need Gemini review.
        
        Hard gates:
        - Contrast ratio < 1.5:1 on opt-out/disclosure text
        - Opacity < 0.3 on disclosure text
        """
        hard_gated = []
        needs_review = []

        for c in candidates:
            sf = c.supporting_features

            # Check for extreme contrast manipulation
            contrast = sf.get("contrast_ratio", None)
            if contrast is not None and contrast < self.HARD_GATE_CONTRAST_CEILING:
                if c.dark_pattern_subtype in ("buried_information", "hidden_costs", "false_hierarchy"):
                    logger.debug(
                        f"  HARD GATE: {c.element_id} — contrast {contrast}:1 < "
                        f"{self.HARD_GATE_CONTRAST_CEILING}:1"
                    )
                    hard_gated.append(c)
                    continue

            # Check for extreme opacity manipulation
            opacity = sf.get("opacity", None)
            if opacity is not None:
                try:
                    opacity_val = float(opacity)
                    if opacity_val < self.HARD_GATE_OPACITY_FLOOR:
                        if c.dark_pattern_subtype in ("buried_information", "hidden_costs", "false_hierarchy"):
                            logger.debug(
                                f"  HARD GATE: {c.element_id} — opacity {opacity_val} < "
                                f"{self.HARD_GATE_OPACITY_FLOOR}"
                            )
                            hard_gated.append(c)
                            continue
                except (ValueError, TypeError):
                    pass

            needs_review.append(c)

        return hard_gated, needs_review

    def _gemini_judge(
        self,
        candidates: list[Candidate],
        image_data: Optional[bytes],
        website_context: Optional[dict],
    ) -> tuple[list[Candidate], dict[str, GeminiVerdict]]:
        """
        Send candidates + screenshot to Gemini for authoritative judgment.
        Returns (confirmed_candidates, verdicts_dict).
        """
        # Build the candidates JSON for the prompt
        candidates_for_prompt = []
        for c in candidates:
            candidates_for_prompt.append({
                "element_id": c.element_id,
                "dark_pattern_subtype": c.dark_pattern_subtype,
                "dark_pattern_category": c.dark_pattern_category,
                "probability": round(c.probability, 3),
                "evidence_source": c.evidence_source,
                "justification": c.justification[:300],
                "key_evidence": {
                    k: v for k, v in list(c.supporting_features.items())[:5]
                    if isinstance(v, (str, int, float, bool))
                },
            })

        context_json = json.dumps(website_context or {"site_type": "unknown"}, indent=2)
        candidates_json = json.dumps(candidates_for_prompt, indent=2)

        prompt = GATEKEEPER_PROMPT.format(
            context_json=context_json,
            candidates_json=candidates_json,
        )

        # Build content parts
        content_parts = [prompt]
        if image_data:
            content_parts.append({
                "mime_type": "image/png",
                "data": image_data,
            })

        try:
            response = self.model.generate_content(
                content_parts,
                generation_config={
                    "temperature": 0.1,
                    "top_p": 0.95,
                    "max_output_tokens": 4096,
                },
            )

            response_text = response.text.strip()

            # Handle markdown code blocks
            if response_text.startswith("```"):
                parts = response_text.split("```")
                if len(parts) >= 2:
                    response_text = parts[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()

            result = json.loads(response_text)
            decisions = result.get("decisions", [])
            overall = result.get("overall_assessment", "")

            if overall:
                logger.info(f"Gemini Gatekeeper assessment: {overall}")

            # Map decisions back to candidates
            decision_map = {d["element_id"]: d for d in decisions}
            confirmed = []
            verdicts = {}

            for c in candidates:
                decision = decision_map.get(c.element_id)

                if decision:
                    is_confirmed = decision.get("confirmed", False)
                    confidence = float(decision.get("confidence", 0.5))
                    reasoning = decision.get("reasoning", "")
                    severity = decision.get("severity", "medium")
                    revised = decision.get("revised_subtype")

                    verdicts[c.element_id] = GeminiVerdict(
                        finding_confirmed=is_confirmed,
                        confidence=confidence,
                        reasoning_chain=[reasoning],
                        alternative_explanation="" if is_confirmed else reasoning,
                        revised_subtype=revised,
                        severity_assessment=severity,
                    )

                    if is_confirmed:
                        # Update candidate with Gemini's confidence
                        c.probability = min(0.99, max(c.probability, confidence))
                        if revised:
                            c.dark_pattern_subtype = revised
                        confirmed.append(c)
                        logger.debug(f"  CONFIRMED: {c.element_id} — {reasoning[:80]}")
                    else:
                        logger.debug(f"  REJECTED: {c.element_id} — {reasoning[:80]}")
                else:
                    # Gemini didn't mention this candidate — treat as rejected
                    verdicts[c.element_id] = GeminiVerdict(
                        finding_confirmed=False,
                        confidence=0.0,
                        reasoning_chain=["Gemini did not include this candidate in its response — treated as rejected."],
                        alternative_explanation="Not addressed by the LLM judge.",
                        severity_assessment="low",
                    )
                    logger.debug(f"  SKIPPED: {c.element_id} — not in Gemini response")

            confirmed_count = len(confirmed)
            rejected_count = len(candidates) - confirmed_count
            logger.info(
                f"Gemini Gatekeeper judgment: {confirmed_count} confirmed, "
                f"{rejected_count} rejected out of {len(candidates)}"
            )
            return confirmed, verdicts

        except json.JSONDecodeError as e:
            logger.error(f"Gemini Gatekeeper: Failed to parse response: {e}")
            logger.debug(f"Raw response: {response_text[:500]}")
            # Fallback: pass high-confidence candidates through
            return self._fallback_filter(candidates)
        except Exception as e:
            logger.error(f"Gemini Gatekeeper: API call failed: {e}")
            return self._fallback_filter(candidates)

    def _fallback_filter(self, candidates: list[Candidate]) -> tuple[list[Candidate], dict[str, GeminiVerdict]]:
        """Fallback when Gemini call fails — only pass very high confidence candidates."""
        confirmed = []
        verdicts = {}
        for c in candidates:
            if c.probability >= self.FALLBACK_CONFIDENCE_THRESHOLD:
                confirmed.append(c)
                verdicts[c.element_id] = GeminiVerdict(
                    finding_confirmed=True,
                    confidence=c.probability * 0.80,
                    reasoning_chain=[
                        "Gemini API call failed — auto-confirmed due to very high "
                        f"detection confidence ({c.probability:.0%}).",
                    ],
                    alternative_explanation="LLM verification failed. Retained on heuristic confidence alone.",
                    severity_assessment=self._severity_from_prob(c.probability),
                )
            else:
                verdicts[c.element_id] = GeminiVerdict(
                    finding_confirmed=False,
                    confidence=c.probability,
                    reasoning_chain=[
                        f"Gemini API call failed — dropped due to insufficient confidence "
                        f"({c.probability:.0%} < {self.FALLBACK_CONFIDENCE_THRESHOLD:.0%}).",
                    ],
                    alternative_explanation="Without LLM verification, only very high confidence findings are retained.",
                    severity_assessment="low",
                )
        logger.warning(
            f"Gemini Gatekeeper fallback: {len(confirmed)}/{len(candidates)} "
            f"passed the {self.FALLBACK_CONFIDENCE_THRESHOLD:.0%} threshold"
        )
        return confirmed, verdicts

    def _make_context_model(self, context_dict: Optional[dict]) -> Optional[WebsiteContext]:
        """Convert context dict to WebsiteContext Pydantic model."""
        if not context_dict:
            return None
        try:
            return WebsiteContext(
                site_type=context_dict.get("site_type", "unknown"),
                site_category=context_dict.get("site_category", "general"),
                trust_signals=context_dict.get("trust_signals", []),
                risk_signals=context_dict.get("risk_signals", []),
                context_summary=context_dict.get("context_summary", ""),
            )
        except Exception as e:
            logger.warning(f"Gemini Gatekeeper: Failed to create WebsiteContext model: {e}")
            return None

    @staticmethod
    def _severity_from_prob(probability: float) -> str:
        if probability >= 0.95:
            return "critical"
        elif probability >= 0.85:
            return "high"
        elif probability >= 0.70:
            return "medium"
        return "low"
