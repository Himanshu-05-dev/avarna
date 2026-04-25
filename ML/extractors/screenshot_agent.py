"""
Screenshot Analysis Agent — uses Gemini Vision API for:
1. Website CONTEXT CLASSIFICATION (what kind of site is this?)
2. Visual dark pattern DETECTION (with context-awareness)

This is the ONLY agent that actually "sees" the rendered page. All other agents
work on DOM-extracted data. The screenshot agent provides visual ground truth
that can corroborate or contradict other agents' findings.

The context classification is critical: a "Pay Now" button means something
different on Amazon vs a phishing site. A Reddit post mentioning "limited time
offer" is content, not a site-level dark pattern.

Usage:
    agent = ScreenshotAgent()
    context, features = agent.analyze(page_data)
"""

import os
import re
import json
import base64
import logging
import glob
from typing import Optional
from pathlib import Path

from schemas.input_schema import PageData
from schemas.features import ScreenshotFeature
from config import SUBTYPE_TO_CATEGORY

logger = logging.getLogger(__name__)


# ─── Combined Context + Detection Prompt ─────────────────────────────────────

CONTEXT_AND_DETECTION_PROMPT = """You are an expert UX auditor and website analyst. You will perform TWO tasks on this screenshot:

## TASK 1: Website Context Classification

Classify what kind of website this is. This context is CRITICAL for Task 2 — different contexts
mean different things. A "Buy Now" button on Amazon is normal. The same button on a phishing page is suspicious.

Identify:
- **site_type**: One of: e_commerce, social_media, news_media, banking_finance, gaming, education, 
  government, healthcare, travel_booking, food_delivery, real_estate, streaming, productivity, 
  search_engine, blog_personal, corporate, phishing_suspicious, other
- **site_category**: More specific (e.g., "fashion_retail", "tech_news", "crypto_exchange")
- **trust_signals**: Positive indicators (e.g., "established_brand", "https_secure", "clear_branding", 
  "professional_design", "visible_contact_info", "recognized_logo")
- **risk_signals**: Negative indicators (e.g., "aggressive_popups", "fake_urgency", "poor_design", 
  "misleading_layout", "no_branding", "suspicious_domain")
- **context_summary**: 1-2 sentence description of what this website appears to be

## TASK 2: Dark Pattern Detection (Context-Aware)

Using the context from Task 1, analyze the screenshot for GENUINE dark patterns.

### CONTEXT-SPECIFIC RULES (CRITICAL):
- **E-commerce sites**: Product prices, "Add to Cart", and sale banners are NORMAL. Only flag genuinely 
  deceptive patterns like hidden fees, fake countdown timers, or manipulative button sizing.
- **Social media** (Reddit, Twitter, etc.): POST CONTENT is NOT a dark pattern of the site. If a user's 
  post contains words like "limited time" or "act now", that's user content, not a site-level dark pattern.
  Only flag site UI elements (forced notifications, deceptive opt-ins, etc.)
- **News sites**: Article headlines with urgency words are editorial, NOT dark patterns.
- **Banking/Finance**: Security warnings and verification steps are LEGITIMATE, not dark patterns.
- **Phishing/Suspicious**: Be MORE aggressive — flag fake urgency, manipulative buttons, deceptive forms.

### What to Look For (genuine dark patterns only):
1. **Urgency & Scarcity** — FAKE countdown timers, fabricated "Only X left!" claims
2. **Price Manipulation** — Hidden fees, drip pricing, deceptive strikethrough pricing
3. **Visual Misdirection** — Accept buttons much larger/brighter than decline, hidden close buttons
4. **Nagging** — Persistent popups that block content
5. **Forced Action** — Must create account to browse, forced consent
6. **Social Proof Manipulation** — "X people viewing this", fake activity
7. **Confirm Shaming** — Guilt-trip decline text like "No, I don't want savings"
8. **Disguised Ads** — Ads disguised as content
9. **Pre-selection** — Pre-checked consent/marketing checkboxes
10. **Manipulative Contrast/Brightness** — Opt-out text deliberately made nearly invisible

## Response Format

Respond ONLY with a valid JSON object (NOT an array) in this exact format:
{{
    "website_context": {{
        "site_type": "string",
        "site_category": "string",
        "trust_signals": ["signal1", "signal2"],
        "risk_signals": ["signal1", "signal2"],
        "context_summary": "string"
    }},
    "dark_patterns": [
        {{
            "detection_type": "string — one of: visual_urgency, price_anchoring, countdown_timer, 
                               size_asymmetry, nagging_popup, forced_action, social_proof_manipulation,
                               confirm_shaming, disguised_ad, pre_selection, hidden_information, 
                               deceptive_button, dark_consent, fake_scarcity, manipulative_contrast",
            "confidence": 0.0-1.0,
            "region_description": "Where on the page this appears",
            "pattern_details": "Specific description of what you see",
            "severity": "critical/high/medium/low",
            "dark_pattern_subtype": "closest match from: {subtypes}",
            "context_justification": "Why this IS a dark pattern given the website context"
        }}
    ]
}}

## CRITICAL RULES
- Only flag GENUINE dark patterns — standard e-commerce features are NOT dark patterns
- User-generated content on social media is NOT a site-level dark pattern
- Standard navigation and product listings are NORMAL
- Be CONSERVATIVE — if unsure, do NOT include it
- Return an empty dark_patterns array [] if you find NO dark patterns
- Return at most 10 findings, prioritized by severity
- ALWAYS include the website_context section even if you find no dark patterns

Analyze the screenshot now:"""


class ScreenshotAgent:
    """Screenshot analysis agent — uses Gemini Vision for context classification + dark pattern detection."""

    def __init__(self, api_key: str = None):
        """
        Initialize the screenshot agent.
        
        Args:
            api_key: Gemini API key. Falls back to config/env if not provided.
        """
        self.api_key = api_key
        self.model = None
        self._init_gemini()

    def _init_gemini(self):
        """Initialize the Gemini Vision API client."""
        try:
            import google.generativeai as genai

            if not self.api_key:
                from config import GEMINI_API_KEY
                self.api_key = GEMINI_API_KEY

            if not self.api_key or self.api_key == "your_api_key_here":
                logger.warning("Gemini API key not configured. Screenshot analysis will be skipped.")
                return

            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
            logger.info("Screenshot Agent: Gemini Vision initialized successfully")

        except ImportError:
            logger.warning("google-generativeai not installed. Screenshot analysis will be skipped.")
        except Exception as e:
            logger.warning(f"Could not initialize Gemini for screenshot analysis: {e}")

    def analyze(self, page: PageData) -> tuple[Optional[dict], list[ScreenshotFeature]]:
        """
        Analyze the page screenshot for website context + visual dark patterns.
        
        Returns:
            tuple of (website_context dict or None, list of ScreenshotFeature)
        """
        if self.model is None:
            logger.info("Screenshot Agent: Gemini not available — skipping visual analysis")
            return None, []

        # Get the screenshot image data
        image_data = self._get_screenshot_data(page)
        if image_data is None:
            logger.info(f"Screenshot Agent: No screenshot available for page '{page.page_id}'")
            return None, []

        logger.info(f"Screenshot Agent: Analyzing screenshot for page '{page.page_id}'")

        try:
            return self._analyze_with_gemini(image_data, page)
        except Exception as e:
            logger.error(f"Screenshot Agent: Analysis failed: {e}")
            return None, []

    def _get_screenshot_data(self, page: PageData) -> Optional[bytes]:
        """
        Retrieve screenshot image bytes from the page data or disk.
        
        Returns raw image bytes or None if no screenshot is available.
        """
        # Strategy 1: Decode from base64 data URI in page.screenshots
        full_page_screenshot = page.screenshots.get("full_page", "")
        if full_page_screenshot and full_page_screenshot.startswith("data:image"):
            try:
                # Strip the data URI prefix: "data:image/png;base64,..."
                b64_data = full_page_screenshot.split(",", 1)[1]
                image_bytes = base64.b64decode(b64_data)
                logger.info(f"Screenshot Agent: Decoded base64 screenshot ({len(image_bytes)} bytes)")
                return image_bytes
            except Exception as e:
                logger.warning(f"Screenshot Agent: Failed to decode base64 screenshot: {e}")

        # Strategy 2: Look for a matching file on disk
        # The crawler saves screenshots as: Backend/screenshots/<safe_url>_<timestamp>.png
        screenshot_dir = self._find_screenshot_dir()
        if screenshot_dir and page.url:
            disk_path = self._find_screenshot_on_disk(screenshot_dir, page.url)
            if disk_path:
                try:
                    with open(disk_path, "rb") as f:
                        image_bytes = f.read()
                    logger.info(f"Screenshot Agent: Loaded from disk: {disk_path} ({len(image_bytes)} bytes)")
                    return image_bytes
                except Exception as e:
                    logger.warning(f"Screenshot Agent: Failed to read {disk_path}: {e}")

        return None

    def _find_screenshot_dir(self) -> Optional[str]:
        """Find the Backend/screenshots directory relative to the ML directory."""
        # ML is at avarna/ML, screenshots are at avarna/Backend/screenshots
        ml_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        candidates = [
            os.path.join(ml_dir, "..", "Backend", "screenshots"),
            os.path.join(ml_dir, "Backend", "screenshots"),
        ]
        for candidate in candidates:
            resolved = os.path.normpath(candidate)
            if os.path.isdir(resolved):
                return resolved
        return None

    def _find_screenshot_on_disk(self, screenshot_dir: str, url: str) -> Optional[str]:
        """Find the most recent screenshot file matching the given URL."""
        # The crawler saves filenames like: https___www_example_com__<timestamp>.png
        # Normalize URL to match the filename pattern
        safe_url = re.sub(r'[^a-z0-9]', '_', url.lower())[:50]
        
        # Find all matching files
        pattern = os.path.join(screenshot_dir, f"{safe_url}*.png")
        matches = glob.glob(pattern)
        
        if not matches:
            # Try a shorter prefix match
            safe_url_short = safe_url[:30]
            pattern = os.path.join(screenshot_dir, f"{safe_url_short}*.png")
            matches = glob.glob(pattern)

        if matches:
            # Return the most recent file (highest timestamp)
            matches.sort(key=os.path.getmtime, reverse=True)
            return matches[0]

        return None

    def get_screenshot_data_for_gatekeeper(self, page: PageData) -> Optional[bytes]:
        """Public accessor for the gatekeeper to get screenshot bytes."""
        return self._get_screenshot_data(page)

    def _analyze_with_gemini(self, image_data: bytes, page: PageData) -> tuple[Optional[dict], list[ScreenshotFeature]]:
        """Send the screenshot to Gemini Vision for context classification + dark pattern detection."""
        import google.generativeai as genai

        # Build the subtypes list for the prompt
        subtypes_str = ", ".join(SUBTYPE_TO_CATEGORY.keys())
        prompt = CONTEXT_AND_DETECTION_PROMPT.format(subtypes=subtypes_str)

        # Create the image part
        image_part = {
            "mime_type": "image/png",
            "data": image_data,
        }

        try:
            response = self.model.generate_content(
                [prompt, image_part],
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

            # Parse website context
            website_context = result.get("website_context", None)
            if website_context:
                logger.info(
                    f"Screenshot Agent: Context classified — "
                    f"type={website_context.get('site_type', '?')}, "
                    f"category={website_context.get('site_category', '?')}, "
                    f"trust={len(website_context.get('trust_signals', []))}, "
                    f"risk={len(website_context.get('risk_signals', []))}"
                )

            # Parse dark pattern findings
            findings = result.get("dark_patterns", [])
            if not isinstance(findings, list):
                findings = []

            features = []
            for finding in findings:
                try:
                    subtype = finding.get("dark_pattern_subtype", "")
                    category = SUBTYPE_TO_CATEGORY.get(subtype, finding.get("dark_pattern_category", ""))

                    feature = ScreenshotFeature(
                        detection_type=finding.get("detection_type", "unknown"),
                        confidence=min(float(finding.get("confidence", 0.5)), 0.99),
                        region_description=finding.get("region_description", ""),
                        pattern_details=finding.get("pattern_details", ""),
                        dark_pattern_subtype=subtype or None,
                        dark_pattern_category=category or None,
                        severity=finding.get("severity", "medium"),
                        details={
                            "source": "screenshot_gemini_vision",
                            "page_url": page.url or "",
                            "page_title": page.title or "",
                            "context_justification": finding.get("context_justification", ""),
                        },
                    )
                    features.append(feature)
                except Exception as e:
                    logger.debug(f"Screenshot Agent: Skipping malformed finding: {e}")

            logger.info(
                f"Screenshot Agent: Found {len(features)} visual dark patterns "
                f"on page '{page.page_id}'"
            )
            return website_context, features

        except json.JSONDecodeError as e:
            logger.error(f"Screenshot Agent: Failed to parse Gemini response as JSON: {e}")
            logger.debug(f"Raw response: {response_text[:500]}")
            return None, []
        except Exception as e:
            logger.error(f"Screenshot Agent: Gemini Vision call failed: {e}")
            return None, []


def reconcile_verdicts(
    candidates: list,
    screenshot_features: list[ScreenshotFeature],
    page_id: str,
) -> list:
    """
    Cross-reference screenshot findings against agent candidates.
    
    Logic:
    1. If a screenshot finding matches an existing candidate (by subtype) → BOOST confidence
    2. If a screenshot finding is new (no matching candidate) → CREATE new candidate
    3. If the screenshot found NOTHING but agents flagged items → REDUCE confidence (mild)
    
    Args:
        candidates: Existing Candidate objects from heuristic/ensemble detection
        screenshot_features: ScreenshotFeature objects from the screenshot agent
        page_id: The page being analyzed
    
    Returns:
        Updated list of candidates with reconciled confidence scores
    """
    from schemas.detection import Candidate

    if not screenshot_features:
        return candidates

    logger.info(
        f"Verdict Reconciliation: {len(candidates)} agent candidates vs "
        f"{len(screenshot_features)} screenshot findings"
    )

    # Build a lookup of existing candidate subtypes
    candidate_subtypes = set()
    for c in candidates:
        candidate_subtypes.add(c.dark_pattern_subtype)

    # Map screenshot detection_types to taxonomy subtypes
    SCREENSHOT_TYPE_TO_SUBTYPE = {
        "visual_urgency": "limited_time_claim",
        "price_anchoring": "hidden_costs",
        "countdown_timer": "countdown_timer",
        "size_asymmetry": "asymmetric_button_sizing",
        "nagging_popup": "nagging",
        "forced_action": "forced_registration",
        "social_proof_manipulation": "fake_activity_notifications",
        "confirm_shaming": "confirm_shaming",
        "disguised_ad": "disguised_ads",
        "pre_selection": "pre_selection",
        "hidden_information": "buried_information",
        "deceptive_button": "visual_misdirection",
        "dark_consent": "forced_consent",
        "fake_scarcity": "low_stock_warning",
        "manipulative_contrast": "buried_information",
    }

    boosted = 0
    created = 0

    for sf in screenshot_features:
        mapped_subtype = sf.dark_pattern_subtype or SCREENSHOT_TYPE_TO_SUBTYPE.get(
            sf.detection_type, sf.detection_type
        )
        mapped_category = sf.dark_pattern_category or SUBTYPE_TO_CATEGORY.get(mapped_subtype, "")

        # Check if any existing candidate matches this subtype
        matched_candidate = None
        for c in candidates:
            if c.dark_pattern_subtype == mapped_subtype:
                matched_candidate = c
                break

        if matched_candidate:
            # BOOST: Screenshot corroborates agent finding
            old_prob = matched_candidate.probability
            boost = min(0.15, (1.0 - old_prob) * 0.3)  # Adaptive boost
            matched_candidate.probability = min(0.99, old_prob + boost)
            matched_candidate.supporting_features["screenshot_corroboration"] = {
                "region": sf.region_description,
                "visual_details": sf.pattern_details,
                "screenshot_confidence": sf.confidence,
                "confidence_boost": round(boost, 3),
            }
            boosted += 1
            logger.debug(
                f"  BOOST: {mapped_subtype} confidence {old_prob:.0%} → "
                f"{matched_candidate.probability:.0%} (screenshot corroborated)"
            )
        else:
            # CREATE: Screenshot found something the agents missed
            new_candidate = Candidate(
                element_id=f"screenshot_{sf.detection_type}_{page_id}",
                page_id=page_id,
                dark_pattern_subtype=mapped_subtype,
                dark_pattern_category=mapped_category,
                probability=sf.confidence * 0.85,  # Slightly lower since we can't pin an element
                evidence_source="screenshot_vision",
                justification=(
                    f"Visual analysis detected {sf.detection_type} in the {sf.region_description}. "
                    f"{sf.pattern_details}"
                ),
                supporting_features={
                    "screenshot_detection": {
                        "region": sf.region_description,
                        "visual_details": sf.pattern_details,
                        "severity": sf.severity,
                    }
                },
            )
            candidates.append(new_candidate)
            created += 1
            logger.debug(
                f"  NEW: {mapped_subtype} ({sf.confidence:.0%}) — "
                f"screenshot found pattern not detected by agents"
            )

    # If screenshot found nothing but agents found many things → mild confidence reduction
    if len(screenshot_features) == 0 and len(candidates) > 3:
        for c in candidates:
            if c.evidence_source != "screenshot_vision":
                reduction = min(0.05, c.probability * 0.05)
                c.probability = max(0.1, c.probability - reduction)
        logger.info("  MILD REDUCTION: Screenshot found nothing, reducing agent confidence slightly")

    logger.info(
        f"Verdict Reconciliation complete: "
        f"{boosted} boosted, {created} new from screenshots"
    )
    return candidates
