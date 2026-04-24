"""
NLP Agent — detects linguistic dark patterns in UI text.

Replaces Groq/Llama with deterministic code:
- Zero-shot classification via HuggingFace transformers (runs locally)
- Keyword-based urgency/manipulation detection
- Sentiment asymmetry analysis between accept/reject text pairs
- Confirm-shaming pattern matching

No external API calls — everything runs on CPU/GPU locally.
"""

import re
import logging
from typing import Optional

from schemas.input_schema import PageData, UIElement
from schemas.features import NLPFeature
from config import NLP_CLASSIFICATION_THRESHOLD, NLP_DARK_PATTERN_LABELS, SENTIMENT_ASYMMETRY_THRESHOLD

logger = logging.getLogger(__name__)

# ─── Keyword Dictionaries ──────────────────────────────────────
URGENCY_KEYWORDS = [
    "hurry", "quick", "fast", "today only", "limited time",
    "don't miss", "act now", "expires", "last chance", "ending soon",
    "running out", "deadline", "before it's gone", "while stocks last",
    "offer ends", "only today", "flash sale", "time is running out",
]

SCARCITY_KEYWORDS = [
    "only \\d+ left", "few remaining", "selling fast", "almost gone",
    "limited stock", "high demand", "low stock", "people viewing",
    "people bought", "in your cart", "recently purchased",
    "out of stock soon", "back in stock",
]

CONFIRM_SHAMING_PATTERNS = [
    r"no\s*,?\s*(?:thanks?\s*,?\s*)?i\s+(?:don'?t|do not)\s+(?:want|need|care|like)",
    r"i\s+(?:prefer|enjoy|like)\s+(?:paying|missing|losing|having)\s+(?:full|more|less)",
    r"i\s+don'?t\s+care\s+about\s+(?:my|saving|getting|having)",
    r"no\s*,?\s*i\s+(?:hate|dislike)\s+(?:saving|discounts|deals|good)",
    r"i'?(?:ll|d)\s+rather\s+(?:not|miss|pay|lose)",
    r"(?:no|not)\s+interested\s+in\s+(?:saving|better|improving)",
]

EMOTIONAL_MANIPULATION_KEYWORDS = [
    "we'll miss you", "don't leave",
    "you'll lose", "you will lose", "your data will be deleted",
    "your progress will be lost", "sad to see you go",
    "please reconsider", "think again",
    "family members will", "give up", "abandon", "lose access",
]

MISLEADING_LANGUAGE_PATTERNS = [
    r"free\s*\*",  # "Free*" with asterisk
    r"\bfree\b.*(?:terms|conditions|apply)",
    r"(?:starting|from)\s+(?:only\s+)?[\$₹€£]?\s*\d",  # "Starting from $X" hiding real price
    r"(?:up to|as low as)\s+\d+%?\s+(?:off|discount|savings)",
]


class NLPAgent:
    """NLP agent for detecting linguistic dark patterns. Fully deterministic + local ML."""

    def __init__(self, use_transformer: bool = True):
        """
        Args:
            use_transformer: Whether to use HuggingFace zero-shot classifier.
                           If False, uses only keyword/pattern matching.
        """
        self.use_transformer = use_transformer
        self.classifier = None

        if self.use_transformer:
            self._load_classifier()

    def _load_classifier(self):
        """Load zero-shot classification pipeline (runs locally)."""
        try:
            from transformers import pipeline
            logger.info("Loading zero-shot classification model...")
            self.classifier = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=-1,  # CPU — change to 0 for GPU
            )
            logger.info("NLP classifier loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load NLP classifier: {e}. Using keyword-only mode.")
            self.use_transformer = False

    def analyze(self, page: PageData) -> list[NLPFeature]:
        """
        Run all NLP analyses on a page.

        Analyses performed:
        1. Keyword-based urgency/scarcity detection
        2. Confirm-shaming pattern matching
        3. Emotional manipulation detection
        4. Sentiment asymmetry between accept/reject pairs
        5. Zero-shot classification (if transformer loaded)
        6. Misleading language detection
        """
        features = []
        all_elements = page.all_elements_flat()
        text_elements = [e for e in all_elements if e.text.strip()]

        logger.info(f"NLP Agent analyzing {len(text_elements)} text elements on page '{page.page_id}'")

        for element in text_elements:
            text = element.text.strip()
            if not text:
                continue

            # 1. Keyword-based detections (fast, deterministic)
            features.extend(self._detect_urgency(element, text))
            features.extend(self._detect_scarcity(element, text))
            features.extend(self._detect_confirm_shaming(element, text))
            features.extend(self._detect_emotional_manipulation(element, text))
            features.extend(self._detect_misleading_language(element, text))

        # 2. Sentiment asymmetry between paired elements
        features.extend(self._detect_sentiment_asymmetry(text_elements))

        # 3. Zero-shot classification on high-priority elements
        if self.use_transformer and self.classifier:
            features.extend(self._classify_with_transformer(text_elements))

        logger.info(f"NLP Agent found {len(features)} linguistic features")
        return features

    def _detect_urgency(self, element: UIElement, text: str) -> list[NLPFeature]:
        """Detect false urgency signals in text. Requires 2+ keyword matches."""
        # Skip very short text — too noisy
        if len(text.split()) < 3:
            return []

        text_lower = text.lower()
        matched = [kw for kw in URGENCY_KEYWORDS if kw in text_lower]

        # Require at least 2 matches to reduce false positives
        if len(matched) >= 2:
            confidence = min(0.95, 0.5 + 0.15 * len(matched))
            return [NLPFeature(
                element_id=element.id,
                text=text,
                pattern_type="false_urgency",
                confidence=confidence,
                matched_keywords=matched,
                details={"match_count": len(matched)},
            )]
        return []

    def _detect_scarcity(self, element: UIElement, text: str) -> list[NLPFeature]:
        """Detect artificial scarcity claims."""
        text_lower = text.lower()
        matched = []
        for pattern in SCARCITY_KEYWORDS:
            if re.search(pattern, text_lower):
                matched.append(pattern)

        if matched:
            confidence = min(0.90, 0.5 + 0.2 * len(matched))
            return [NLPFeature(
                element_id=element.id,
                text=text,
                pattern_type="scarcity_claim",
                confidence=confidence,
                matched_keywords=matched,
                details={"match_count": len(matched)},
            )]
        return []

    def _detect_confirm_shaming(self, element: UIElement, text: str) -> list[NLPFeature]:
        """Detect confirm-shaming language (guilting users who decline)."""
        text_lower = text.lower()
        for pattern in CONFIRM_SHAMING_PATTERNS:
            if re.search(pattern, text_lower):
                return [NLPFeature(
                    element_id=element.id,
                    text=text,
                    pattern_type="confirm_shaming",
                    confidence=0.90,
                    matched_keywords=[pattern],
                    details={"matched_pattern": pattern},
                )]

        # Also check for negative framing of the decline option
        decline_indicators = ["no thanks", "no, i", "not interested", "skip", "i'll pass"]
        negative_adjectives = ["worse", "bad", "miss out", "full price", "lose", "don't care"]

        is_decline = any(ind in text_lower for ind in decline_indicators)
        has_negative = any(adj in text_lower for adj in negative_adjectives)

        if is_decline and has_negative:
            return [NLPFeature(
                element_id=element.id,
                text=text,
                pattern_type="confirm_shaming",
                confidence=0.85,
                matched_keywords=[kw for kw in negative_adjectives if kw in text_lower],
                details={"detection_method": "decline_with_negative_framing"},
            )]
        return []

    def _detect_emotional_manipulation(self, element: UIElement, text: str) -> list[NLPFeature]:
        """Detect emotional manipulation tactics (guilt, fear, sadness). Requires 2+ matches."""
        # Skip very short text
        if len(text.split()) < 3:
            return []

        text_lower = text.lower()
        matched = [kw for kw in EMOTIONAL_MANIPULATION_KEYWORDS if kw in text_lower]

        # Require 2+ matches to avoid flagging standard confirmations
        if len(matched) >= 2:
            confidence = min(0.90, 0.5 + 0.2 * len(matched))
            return [NLPFeature(
                element_id=element.id,
                text=text,
                pattern_type="emotional_manipulation",
                confidence=confidence,
                matched_keywords=matched,
                details={"match_count": len(matched)},
            )]
        return []

    def _detect_misleading_language(self, element: UIElement, text: str) -> list[NLPFeature]:
        """Detect misleading language patterns (hidden qualifiers, asterisks)."""
        text_lower = text.lower()
        matched = []
        for pattern in MISLEADING_LANGUAGE_PATTERNS:
            if re.search(pattern, text_lower):
                matched.append(pattern)

        if matched:
            return [NLPFeature(
                element_id=element.id,
                text=text,
                pattern_type="misleading_language",
                confidence=0.75,
                matched_keywords=matched,
                details={"matched_patterns": matched},
            )]
        return []

    def _detect_sentiment_asymmetry(self, elements: list[UIElement]) -> list[NLPFeature]:
        """
        Detect sentiment asymmetry between paired actions.
        E.g., "Yes, I love savings! 🎉" vs "No thanks, I hate discounts"
        """
        features = []

        # Find button/link pairs (accept vs reject)
        interactive = [e for e in elements if e.is_interactive and e.text.strip()
                       and len(e.text.strip()) > 1]  # Skip icon-only elements
        positive_words = {"yes", "accept", "agree", "continue", "ok", "great", "love",
                         "best", "buy", "keep", "start", "join", "subscribe", "🎉", "🎁"}
        negative_words = {"cancel", "decline", "reject", "skip", "later", "close",
                         "don't", "stop", "quit", "leave", "unsubscribe", "exit"}

        # Score each interactive element for positive/negative sentiment
        scored = []
        for element in interactive:
            text_words = set(element.text.lower().split())
            pos_score = len(text_words & positive_words) / max(len(text_words), 1)
            neg_score = len(text_words & negative_words) / max(len(text_words), 1)
            scored.append((element, pos_score, neg_score))

        # Look for asymmetric pairs
        for i, (e1, p1, n1) in enumerate(scored):
            for j, (e2, p2, n2) in enumerate(scored):
                if i >= j:
                    continue

                # One strongly positive, one negative
                asymmetry = abs((p1 - n1) - (p2 - n2))
                if asymmetry > SENTIMENT_ASYMMETRY_THRESHOLD:
                    positive_elem = e1 if p1 > p2 else e2
                    negative_elem = e2 if p1 > p2 else e1

                    features.append(NLPFeature(
                        element_id=negative_elem.id,
                        text=negative_elem.text,
                        pattern_type="sentiment_asymmetry",
                        confidence=min(0.85, asymmetry),
                        sentiment_positive=max(p1, p2),
                        sentiment_negative=max(n1, n2),
                        details={
                            "positive_element_id": positive_elem.id,
                            "positive_text": positive_elem.text[:80],
                            "negative_element_id": negative_elem.id,
                            "negative_text": negative_elem.text[:80],
                            "asymmetry_score": asymmetry,
                        }
                    ))

        return features

    def _classify_with_transformer(self, elements: list[UIElement]) -> list[NLPFeature]:
        """
        Use zero-shot classifier for nuanced classification.
        Only runs on interactive elements and short text blocks to save compute.
        """
        features = []
        candidates = [
            e for e in elements
            if (e.is_interactive or e.tag in ("p", "span", "div", "h1", "h2", "h3", "h4"))
            and 3 < len(e.text.strip().split()) < 50  # Skip very short or very long texts
        ]

        # Limit to avoid slow inference
        candidates = candidates[:30]

        for element in candidates:
            try:
                result = self.classifier(
                    element.text.strip(),
                    candidate_labels=NLP_DARK_PATTERN_LABELS,
                    multi_label=False,
                )

                top_label = result["labels"][0]
                top_score = result["scores"][0]

                # Only record if confident and not "neutral"
                if top_label != "neutral" and top_score >= NLP_CLASSIFICATION_THRESHOLD:
                    features.append(NLPFeature(
                        element_id=element.id,
                        text=element.text.strip(),
                        pattern_type=top_label,
                        confidence=top_score,
                        details={
                            "all_labels": dict(zip(result["labels"][:5], result["scores"][:5])),
                            "classification_method": "zero_shot_bart_mnli",
                        }
                    ))
            except Exception as e:
                logger.debug(f"Transformer classification failed for {element.id}: {e}")

        return features
