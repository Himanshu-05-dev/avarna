"""
Heuristic Rules — rule-based dark pattern detector.

Primary classifier that works without training data.
Each rule maps feature signals to dark pattern subtypes with justifications.
"""

import logging
from schemas.features import FeatureBundle, CVFeature, NLPFeature, SpatialFeature
from schemas.detection import Candidate
from config import CANDIDATE_THRESHOLD, SUBTYPE_TO_CATEGORY

logger = logging.getLogger(__name__)


class HeuristicClassifier:
    """Rule-based dark pattern detector — no training data needed."""

    def detect(self, bundle: FeatureBundle) -> list[Candidate]:
        """
        Apply heuristic rules to a FeatureBundle and return candidates.
        Each rule combines signals from one or more extractors.
        """
        candidates = []

        candidates.extend(self._rule_pre_selection(bundle))
        candidates.extend(self._rule_tiny_close_button(bundle))
        candidates.extend(self._rule_confirm_shaming(bundle))
        candidates.extend(self._rule_false_urgency(bundle))
        candidates.extend(self._rule_scarcity(bundle))
        candidates.extend(self._rule_size_asymmetry(bundle))
        candidates.extend(self._rule_hidden_information(bundle))
        candidates.extend(self._rule_overlay_obstruction(bundle))
        candidates.extend(self._rule_emotional_manipulation(bundle))
        candidates.extend(self._rule_suppressed_action(bundle))

        # Filter by threshold and deduplicate by element_id + subtype
        seen = set()
        filtered = []
        for c in candidates:
            key = (c.element_id, c.dark_pattern_subtype)
            if key not in seen and c.probability >= CANDIDATE_THRESHOLD:
                seen.add(key)
                filtered.append(c)

        # Sort by probability descending
        filtered.sort(key=lambda c: c.probability, reverse=True)

        logger.info(f"Heuristic classifier found {len(filtered)} candidates (from {len(candidates)} raw)")
        return filtered

    def _make_candidate(self, element_id: str, page_id: str, subtype: str,
                        probability: float, justification: str,
                        supporting: dict = None) -> Candidate:
        """Helper to create a Candidate with auto-filled category."""
        return Candidate(
            element_id=element_id,
            page_id=page_id,
            dark_pattern_subtype=subtype,
            dark_pattern_category=SUBTYPE_TO_CATEGORY.get(subtype, "unknown"),
            probability=min(probability, 0.99),
            evidence_source="heuristic",
            justification=justification,
            supporting_features=supporting or {},
        )

    # Keywords that indicate a consent/subscription context (dark pattern territory)
    _CONSENT_LABEL_KEYWORDS = {
        "agree", "consent", "subscribe", "newsletter", "marketing",
        "notifications", "opt-in", "opt-out", "terms", "privacy",
        "share", "data", "email", "sms", "promotional", "offers",
        "third-party", "partner", "communication",
    }

    # Keywords that indicate a search filter / navigation context (NOT a dark pattern)
    _FILTER_LABEL_KEYWORDS = {
        "bhk", "bedroom", "bathroom", "floor", "sqft", "area",
        "budget", "price range", "location", "type", "status",
        "ready to move", "under construction", "furnished",
        "sort", "filter", "category", "brand", "size", "color",
        "rating", "availability", "condition", "material",
    }

    def _rule_pre_selection(self, bundle: FeatureBundle) -> list[Candidate]:
        """Pre-checked checkboxes / pre-selected radio buttons = pre_selection.

        Form-context validation:
        - Only flag if the checkbox is inside a <form>, <dialog>, or <aside> (consent flows)
        - OR if the nearby label contains consent-related keywords
        - Skip checkboxes that appear to be search filters or navigation controls
        """
        candidates = []
        for cv in bundle.cv_features:
            if cv.detection_type != "pre_checked_input":
                continue

            label_text = (cv.details.get('aria_label', '') or '').lower()
            element_text = (cv.details.get('element_text', '') or '').lower()
            combined_text = label_text + " " + element_text

            # Skip if the label clearly indicates a search filter / navigation control
            is_filter = any(kw in combined_text for kw in self._FILTER_LABEL_KEYWORDS)
            if is_filter:
                logger.debug(
                    f"Pre-selection skipped for {cv.element_id}: "
                    f"filter/nav context detected ('{combined_text[:60]}')"
                )
                continue

            # Check for consent-context: either consent keywords in label,
            # or the element is inside a form/dialog/aside semantic context
            is_consent_context = any(kw in combined_text for kw in self._CONSENT_LABEL_KEYWORDS)
            # semantic_context is not directly on CVFeature, so we use a heuristic:
            # If neither consent NOR filter keywords match, still flag but with lower confidence
            confidence = cv.confidence if is_consent_context else cv.confidence * 0.7

            candidates.append(self._make_candidate(
                element_id=cv.element_id,
                page_id=bundle.page_id,
                subtype="pre_selection",
                probability=confidence,
                justification=(
                    f"Checkbox/radio is pre-checked by default. "
                    f"ARIA label: {cv.details.get('aria_label', 'N/A')}. "
                    f"Context: {'consent/subscription flow' if is_consent_context else 'general form'}. "
                    f"Users must actively uncheck to opt out — this is a pre-selection dark pattern."
                ),
                supporting={
                    "cv_detection": cv.detection_type,
                    "cv_confidence": cv.confidence,
                    "is_consent_context": is_consent_context,
                },
            ))
        return candidates

    def _rule_tiny_close_button(self, bundle: FeatureBundle) -> list[Candidate]:
        """Tiny interactive elements (< 44px) on modals/overlays = obstruction.

        Rules:
        - Element must have non-empty text (empty = ghost/invisible element)
        - If text contains a close keyword → label hard_to_cancel
        - If text does NOT contain a close keyword AND size < 20px → skip (decorative icon)
        - Otherwise → visual_misdirection (accessibility issue, lower severity)
        """
        candidates = []
        for cv in bundle.cv_features:
            if cv.detection_type != "tiny_interactive_element":
                continue

            element_text = cv.details.get("element_text", "").strip().lower()

            # Skip completely empty elements — these are ghost/invisible elements
            if not element_text:
                continue

            width = cv.details.get("width", 44)
            height = cv.details.get("height", 44)

            close_keywords = ["close", "dismiss", "exit", "quit", "cancel subscription",
                              "cancel plan", "end trial", "stop", "unsubscribe"]
            is_close = any(kw in element_text for kw in close_keywords)

            # If it doesn't look like a close button AND it's extremely tiny (<20px),
            # it's almost certainly a decorative icon — skip it entirely
            if not is_close and (width < 20 or height < 20):
                continue

            subtype = "hard_to_cancel" if is_close else "visual_misdirection"
            prob = cv.confidence + (0.1 if is_close else 0)

            candidates.append(self._make_candidate(
                element_id=cv.element_id,
                page_id=bundle.page_id,
                subtype=subtype,
                probability=min(prob, 0.99),
                justification=(
                    f"Interactive element is only {width}×{height}px — "
                    f"below the 44×44px WCAG minimum. "
                    f"{'This appears to be a close/dismiss button, making it intentionally hard to use.' if is_close else 'This small size makes the element difficult to interact with on touch devices.'}"
                ),
                supporting={
                    "width": width,
                    "height": height,
                    "is_close_button": is_close,
                },
            ))
        return candidates

    def _rule_confirm_shaming(self, bundle: FeatureBundle) -> list[Candidate]:
        """Confirm-shaming text patterns detected by NLP."""
        candidates = []
        for nlp in bundle.nlp_features:
            if nlp.pattern_type == "confirm_shaming":
                candidates.append(self._make_candidate(
                    element_id=nlp.element_id,
                    page_id=bundle.page_id,
                    subtype="confirm_shaming",
                    probability=nlp.confidence,
                    justification=(
                        f'The text "{nlp.text[:80]}" uses confirm-shaming language — '
                        f"making the user feel guilty or foolish for declining. "
                        f"This manipulates the user's emotional state to influence their decision."
                    ),
                    supporting={"text": nlp.text, "matched_keywords": nlp.matched_keywords},
                ))
        return candidates

    def _rule_false_urgency(self, bundle: FeatureBundle) -> list[Candidate]:
        """False urgency signals (countdown timers, "deal expires")."""
        candidates = []
        for nlp in bundle.nlp_features:
            if nlp.pattern_type == "false_urgency":
                candidates.append(self._make_candidate(
                    element_id=nlp.element_id,
                    page_id=bundle.page_id,
                    subtype="countdown_timer" if "expire" in nlp.text.lower() or "timer" in nlp.text.lower() else "limited_time_claim",
                    probability=nlp.confidence,
                    justification=(
                        f'The text "{nlp.text[:80]}" creates artificial urgency. '
                        f"Keywords matched: {', '.join(nlp.matched_keywords[:5])}. "
                        f"This pressures users into making hasty decisions."
                    ),
                    supporting={"text": nlp.text, "urgency_keywords": nlp.matched_keywords},
                ))
        return candidates

    def _rule_scarcity(self, bundle: FeatureBundle) -> list[Candidate]:
        """Artificial scarcity claims ("Only 2 left!")."""
        candidates = []
        for nlp in bundle.nlp_features:
            if nlp.pattern_type == "scarcity_claim":
                candidates.append(self._make_candidate(
                    element_id=nlp.element_id,
                    page_id=bundle.page_id,
                    subtype="low_stock_warning",
                    probability=nlp.confidence,
                    justification=(
                        f'The text "{nlp.text[:80]}" makes scarcity claims that may be unverifiable. '
                        f"Without backend validation, such claims can be fabricated to pressure purchases."
                    ),
                    supporting={"text": nlp.text, "scarcity_keywords": nlp.matched_keywords},
                ))
        return candidates

    def _rule_size_asymmetry(self, bundle: FeatureBundle) -> list[Candidate]:
        """Asymmetric button sizing — accept is disproportionately larger than decline."""
        candidates = []
        for spatial in bundle.spatial_features:
            if spatial.violation_type == "size_asymmetry":
                ratio = spatial.measurements.get("area_ratio", 0)
                candidates.append(self._make_candidate(
                    element_id=spatial.element_id,
                    page_id=bundle.page_id,
                    subtype="asymmetric_button_sizing",
                    probability=min(0.95, 0.4 + (ratio / 30)),
                    justification=(
                        f"The positive action button is {ratio:.1f}× larger than the negative action. "
                        f"Positive: \"{spatial.details.get('positive_text', '?')}\" "
                        f"({spatial.details.get('positive_dimensions', '?')}), "
                        f"Negative: \"{spatial.details.get('negative_text', '?')}\" "
                        f"({spatial.details.get('negative_dimensions', '?')}). "
                        f"This visually steers users toward the preferred action."
                    ),
                    supporting=spatial.measurements,
                ))
        return candidates

    # ─── Asymmetric Semantic Filtering ────────────────────────────────────
    # Opt-out/disclosure keywords: hiding these IS a dark pattern
    _OPT_OUT_KEYWORDS = {
        "cancel", "unsubscribe", "skip", "no thanks", "decline", "reject",
        "opt-out", "opt out", "remove", "deactivate", "close account",
        "delete account", "end trial", "stop",
    }
    # Disclosure keywords: hiding these IS a dark pattern
    _DISCLOSURE_KEYWORDS = {
        "fee", "charge", "cost", "price", "tax", "taxes",
        "additional", "extra", "surcharge", "hidden",
        "terms", "conditions", "auto-renew", "recurring", "refund",
        "non-refundable", "binding", "penalty",
    }
    # Opt-in/positive action keywords: low contrast on these is NOT a dark pattern
    _OPT_IN_KEYWORDS = {
        "subscribe", "buy", "purchase", "agree", "accept", "sign up",
        "register", "join", "get started", "continue", "confirm",
        "add to cart", "checkout", "submit", "apply",
    }
    # Structural UI text to always ignore for contrast checks
    _STRUCTURAL_IGNORE = {
        "menu", "search", "home", "login", "sign in", "log in",
        "next", "previous", "back", "forward", "more",
        "share", "like", "follow", "save",
    }

    def _is_opt_out_or_disclosure(self, text: str) -> bool:
        """Check if text contains opt-out or disclosure keywords (hiding these = dark pattern)."""
        text_lower = text.lower()
        return (any(kw in text_lower for kw in self._OPT_OUT_KEYWORDS) or
                any(kw in text_lower for kw in self._DISCLOSURE_KEYWORDS))

    def _is_opt_in_action(self, text: str) -> bool:
        """Check if text is a positive opt-in action (low contrast here = bad UX, not dark pattern)."""
        text_lower = text.lower()
        return any(kw in text_lower for kw in self._OPT_IN_KEYWORDS)

    def _is_structural_ui(self, text: str) -> bool:
        """Check if text is a standard structural UI element (never a dark pattern)."""
        text_lower = text.strip().lower()
        # Pagination: "1", "2", "3", etc.
        if text_lower.isdigit():
            return True
        # Single character navigation arrows
        if len(text_lower) <= 2:
            return True
        return text_lower in self._STRUCTURAL_IGNORE

    def _rule_hidden_information(self, bundle: FeatureBundle) -> list[Candidate]:
        """Important information hidden via small text, low contrast, or buried placement.

        Uses Asymmetric Semantic Filtering:
        - Opt-out/disclosure text with low contrast → FLAGGED (dark pattern)
        - Opt-in/positive action text with low contrast → SKIPPED (bad UX, not malicious)
        - Structural UI text → SKIPPED (pagination, menu, etc.)
        """
        candidates = []

        # From spatial: buried important info
        for spatial in bundle.spatial_features:
            if spatial.violation_type == "buried_important_info":
                candidates.append(self._make_candidate(
                    element_id=spatial.element_id,
                    page_id=bundle.page_id,
                    subtype="hidden_costs" if any(kw in spatial.details.get("element_text", "").lower()
                                                   for kw in ["fee", "charge", "cost", "price"]) else "buried_information",
                    probability=0.85,
                    justification=(
                        f"Important information is buried at the bottom of the page in small/faded text: "
                        f"\"{spatial.details.get('element_text', '')[:100]}\". "
                        f"Font size: {spatial.details.get('font_size', '?')}, "
                        f"Opacity: {spatial.details.get('opacity', '?')}."
                    ),
                    supporting=spatial.measurements,
                ))

        # From spatial: font size manipulation
        for spatial in bundle.spatial_features:
            if spatial.violation_type == "font_size_manipulation":
                candidates.append(self._make_candidate(
                    element_id=spatial.element_id,
                    page_id=bundle.page_id,
                    subtype="buried_information",
                    probability=0.80,
                    justification=(
                        f"Important text is displayed at {spatial.measurements.get('element_font_size', '?')}px — "
                        f"only {spatial.measurements.get('ratio_to_median', '?')}× of the page median "
                        f"({spatial.measurements.get('page_median_font_size', '?')}px). "
                        f"This obscures critical information below the user's attention threshold."
                    ),
                    supporting=spatial.measurements,
                ))

        # From spatial: low contrast on text — ASYMMETRIC FILTERING
        for spatial in bundle.spatial_features:
            if spatial.violation_type == "low_contrast":
                element_text = spatial.details.get("element_text", "")

                # Skip structural UI elements (pagination, nav items, etc.)
                if self._is_structural_ui(element_text):
                    logger.debug(
                        f"Contrast skip (structural UI): '{element_text[:40]}'"
                    )
                    continue

                # Skip opt-in/positive action text — low contrast here is bad UX, not malicious
                if self._is_opt_in_action(element_text):
                    logger.debug(
                        f"Contrast skip (opt-in action): '{element_text[:40]}'"
                    )
                    continue

                # Only flag if the text contains opt-out or disclosure keywords
                if self._is_opt_out_or_disclosure(element_text):
                    candidates.append(self._make_candidate(
                        element_id=spatial.element_id,
                        page_id=bundle.page_id,
                        subtype="buried_information",
                        probability=0.85,
                        justification=(
                            f"Opt-out/disclosure text has a contrast ratio of only "
                            f"{spatial.measurements.get('contrast_ratio', '?')}:1 "
                            f"(WCAG minimum: {spatial.measurements.get('required_ratio', '?')}:1). "
                            f"Text: \"{element_text[:80]}\". "
                            f"Low contrast on opt-out/disclosure text is a buried information dark pattern."
                        ),
                        supporting=spatial.measurements,
                    ))
                else:
                    logger.debug(
                        f"Contrast skip (no opt-out/disclosure keywords): '{element_text[:40]}'"
                    )

        return candidates

    def _rule_overlay_obstruction(self, bundle: FeatureBundle) -> list[Candidate]:
        """Z-index overlays blocking page content."""
        candidates = []
        for spatial in bundle.spatial_features:
            if spatial.violation_type == "z_index_overlay":
                candidates.append(self._make_candidate(
                    element_id=spatial.element_id,
                    page_id=bundle.page_id,
                    subtype="forced_consent" if "cookie" in spatial.element_id.lower() else "nagging",
                    probability=0.75,
                    justification=(
                        f"Element uses z-index {spatial.measurements.get('z_index', '?')} "
                        f"with {'fixed' if spatial.details.get('is_fixed') else 'absolute'} positioning, "
                        f"covering {spatial.measurements.get('covers_width', '?')}×"
                        f"{spatial.measurements.get('covers_height', '?')}px of the viewport. "
                        f"This blocks the user from accessing page content until they interact."
                    ),
                    supporting=spatial.measurements,
                ))
        return candidates

    def _rule_emotional_manipulation(self, bundle: FeatureBundle) -> list[Candidate]:
        """Emotional manipulation language (guilt, fear)."""
        candidates = []
        for nlp in bundle.nlp_features:
            if nlp.pattern_type == "emotional_manipulation":
                candidates.append(self._make_candidate(
                    element_id=nlp.element_id,
                    page_id=bundle.page_id,
                    subtype="toying_with_emotion",
                    probability=nlp.confidence,
                    justification=(
                        f'The text "{nlp.text[:80]}" uses emotional manipulation. '
                        f"Keywords: {', '.join(nlp.matched_keywords[:5])}. "
                        f"This exploits emotional responses to pressure the user's decision."
                    ),
                    supporting={"text": nlp.text, "emotional_keywords": nlp.matched_keywords},
                ))
        return candidates

    def _rule_suppressed_action(self, bundle: FeatureBundle) -> list[Candidate]:
        """Negative actions (cancel, decline) deliberately suppressed visually."""
        candidates = []
        for spatial in bundle.spatial_features:
            if spatial.violation_type == "suppressed_negative_action":
                issues = spatial.measurements.get("issues_found", [])
                # Only flag if 2+ suppression signals are present
                if len(issues) < 2:
                    continue
                candidates.append(self._make_candidate(
                    element_id=spatial.element_id,
                    page_id=bundle.page_id,
                    subtype="false_hierarchy",
                    probability=min(0.90, 0.45 + 0.15 * len(issues)),
                    justification=(
                        f"The decline/cancel action is deliberately suppressed: "
                        f"{', '.join(issues)}. "
                        f"Text: \"{spatial.details.get('element_text', '')[:80]}\". "
                        f"This makes it difficult for users to find the option to decline."
                    ),
                    supporting=spatial.measurements,
                ))
        return candidates
