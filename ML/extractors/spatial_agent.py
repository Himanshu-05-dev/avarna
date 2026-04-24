"""
Spatial Agent — detects layout-based dark patterns from DOM and CSS data.

Pure computation — no ML models, no LLM calls, no rate limits.
This is the most reliable extractor because it's deterministic math on DOM data.

Analyses:
- Contrast ratio (WCAG compliance)
- Size asymmetry between paired actions
- Z-index overlay abuse
- Visual hierarchy violations
- Reading flow disruption
- Pre-selection detection
"""

import re
import math
import logging
from typing import Optional

from schemas.input_schema import PageData, UIElement, BoundingBox
from schemas.features import SpatialFeature
from config import (
    CONTRAST_RATIO_AA,
    SIZE_ASYMMETRY_RATIO,
    Z_INDEX_OVERLAY_THRESHOLD,
    MIN_TOUCH_TARGET_PX,
)

logger = logging.getLogger(__name__)


def parse_color(color_str: str) -> Optional[tuple[int, int, int]]:
    """Parse CSS color string to (R, G, B) tuple."""
    if not color_str:
        return None

    color_str = color_str.strip().lower()

    # Named colors (basic set)
    named = {
        "white": (255, 255, 255), "black": (0, 0, 0),
        "red": (255, 0, 0), "green": (0, 128, 0), "blue": (0, 0, 255),
        "transparent": (255, 255, 255),
    }
    if color_str in named:
        return named[color_str]

    # Hex: #rgb, #rrggbb
    hex_match = re.match(r"#([0-9a-f]{3,8})", color_str)
    if hex_match:
        h = hex_match.group(1)
        if len(h) == 3:
            return (int(h[0]*2, 16), int(h[1]*2, 16), int(h[2]*2, 16))
        elif len(h) >= 6:
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

    # rgb() / rgba()
    rgb_match = re.match(r"rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", color_str)
    if rgb_match:
        return (int(rgb_match.group(1)), int(rgb_match.group(2)), int(rgb_match.group(3)))

    return None


def relative_luminance(r: int, g: int, b: int) -> float:
    """Calculate WCAG relative luminance from RGB values."""
    def linearize(c: int) -> float:
        c_norm = c / 255.0
        if c_norm <= 0.03928:
            return c_norm / 12.92
        return ((c_norm + 0.055) / 1.055) ** 2.4

    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)


def contrast_ratio(color1: tuple[int, int, int], color2: tuple[int, int, int]) -> float:
    """Calculate WCAG contrast ratio between two colors."""
    l1 = relative_luminance(*color1)
    l2 = relative_luminance(*color2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


class SpatialAgent:
    """Spatial analysis agent — pure computation, no ML."""

    def analyze(self, page: PageData) -> list[SpatialFeature]:
        """Run all spatial analyses on a page."""
        features = []
        all_elements = page.all_elements_flat()

        logger.info(f"Spatial Agent analyzing {len(all_elements)} elements on page '{page.page_id}'")

        features.extend(self._check_contrast_ratios(all_elements))
        features.extend(self._check_size_asymmetry(all_elements))
        features.extend(self._check_z_index_abuse(all_elements))
        features.extend(self._check_visual_hierarchy(all_elements))
        features.extend(self._check_reading_flow(all_elements))
        features.extend(self._check_font_size_manipulation(all_elements))

        logger.info(f"Spatial Agent found {len(features)} layout features")
        return features

    def _check_contrast_ratios(self, elements: list[UIElement]) -> list[SpatialFeature]:
        """Check text contrast meets WCAG AA (4.5:1 for normal, 3:1 for large)."""
        features = []
        for element in elements:
            if not element.text.strip() or not element.computed_css:
                continue

            fg = parse_color(element.computed_css.color or "")
            bg = parse_color(element.computed_css.background_color or "")

            if fg and bg:
                ratio = contrast_ratio(fg, bg)

                # Determine if text is "large" (>= 18px or >= 14px bold)
                is_large = False
                if element.computed_css.font_size:
                    try:
                        size = float(element.computed_css.font_size.replace("px", "").strip())
                        weight = element.computed_css.font_weight or "400"
                        is_bold = weight in ("bold", "700", "800", "900")
                        is_large = size >= 18 or (size >= 14 and is_bold)
                    except ValueError:
                        pass

                min_ratio = 3.0 if is_large else CONTRAST_RATIO_AA

                if ratio < min_ratio:
                    severity = "critical" if ratio < 2.0 else ("high" if ratio < 3.0 else "medium")
                    features.append(SpatialFeature(
                        element_id=element.id,
                        violation_type="low_contrast",
                        severity=severity,
                        measurements={
                            "contrast_ratio": round(ratio, 2),
                            "required_ratio": min_ratio,
                            "foreground_color": element.computed_css.color,
                            "background_color": element.computed_css.background_color,
                            "is_large_text": is_large,
                        },
                        details={
                            "element_text": element.text[:100],
                            "wcag_level": "AA",
                        }
                    ))

        return features

    def _check_size_asymmetry(self, elements: list[UIElement]) -> list[SpatialFeature]:
        """
        Flag paired actions where one is much larger/more prominent than the other.
        E.g., "Accept" button 5x larger than "Decline" link.

        Context-aware: only compares elements within 300px vertically.
        """
        features = []
        interactive = [e for e in elements if e.is_interactive and e.bounding_box
                       and len(e.text.strip()) > 1]  # Skip icon-only elements like ×

        # Categorize interactive elements as positive or negative actions
        # Removed generic words: "no", "get", "add", "start" — too common
        positive_keywords = {"accept", "agree", "yes", "ok", "continue", "buy", "subscribe",
                           "keep", "confirm", "join"}
        negative_keywords = {"reject", "decline", "cancel", "skip", "close", "later",
                           "exit", "leave", "unsubscribe", "dismiss"}

        positive_elements = []
        negative_elements = []

        for element in interactive:
            text_lower = element.text.lower()
            words = set(text_lower.split())

            if words & positive_keywords:
                positive_elements.append(element)
            elif words & negative_keywords:
                negative_elements.append(element)

        # Compare sizes of positive vs negative actions — ONLY if they are nearby
        PROXIMITY_PX = 300  # Only compare elements within 300px vertically

        for pos in positive_elements:
            for neg in negative_elements:
                # Proximity check: skip elements that are far apart
                vertical_distance = abs(pos.bounding_box.y - neg.bounding_box.y)
                if vertical_distance > PROXIMITY_PX:
                    continue

                # Context check: skip if elements are in different semantic containers
                # (e.g., one in nav sidebar, other in main content)
                pos_ctx = getattr(pos, 'semantic_context', None)
                neg_ctx = getattr(neg, 'semantic_context', None)
                if pos_ctx and neg_ctx and pos_ctx != neg_ctx:
                    continue

                # Skip elements inside navigation — nav buttons are standard design
                if neg_ctx in ('nav', 'header', 'footer'):
                    continue

                pos_area = pos.bounding_box.area
                neg_area = neg.bounding_box.area

                if neg_area > 0:
                    area_ratio = pos_area / neg_area
                else:
                    area_ratio = float("inf")

                if area_ratio >= SIZE_ASYMMETRY_RATIO:
                    severity = "critical" if area_ratio >= 15 else ("high" if area_ratio >= 8 else "medium")
                    features.append(SpatialFeature(
                        element_id=neg.id,
                        violation_type="size_asymmetry",
                        severity=severity,
                        related_element_id=pos.id,
                        measurements={
                            "positive_area": pos_area,
                            "negative_area": neg_area,
                            "area_ratio": round(area_ratio, 2),
                            "threshold": SIZE_ASYMMETRY_RATIO,
                            "vertical_distance_px": vertical_distance,
                        },
                        details={
                            "positive_text": pos.text[:80],
                            "negative_text": neg.text[:80],
                            "positive_dimensions": f"{pos.bounding_box.w}×{pos.bounding_box.h}",
                            "negative_dimensions": f"{neg.bounding_box.w}×{neg.bounding_box.h}",
                        }
                    ))

        return features

    def _check_z_index_abuse(self, elements: list[UIElement]) -> list[SpatialFeature]:
        """Detect overlays with extremely high z-index blocking content."""
        features = []
        for element in elements:
            if not element.computed_css or not element.computed_css.z_index:
                continue

            try:
                z_index = int(element.computed_css.z_index)
            except (ValueError, TypeError):
                continue

            if z_index >= Z_INDEX_OVERLAY_THRESHOLD:
                # Check if it covers a large portion of the viewport
                covers_viewport = False
                if element.bounding_box:
                    covers_viewport = (
                        element.bounding_box.w >= 800 and element.bounding_box.h >= 500
                    )

                if covers_viewport:
                    # Check if the close button is tiny/hidden
                    severity = "high"
                    if element.computed_css.position == "fixed":
                        severity = "critical"

                    features.append(SpatialFeature(
                        element_id=element.id,
                        violation_type="z_index_overlay",
                        severity=severity,
                        measurements={
                            "z_index": z_index,
                            "covers_width": element.bounding_box.w if element.bounding_box else 0,
                            "covers_height": element.bounding_box.h if element.bounding_box else 0,
                            "position": element.computed_css.position or "static",
                        },
                        details={
                            "element_tag": element.tag,
                            "is_fixed": element.computed_css.position == "fixed",
                        }
                    ))

        return features

    def _check_visual_hierarchy(self, elements: list[UIElement]) -> list[SpatialFeature]:
        """
        Check that the visual hierarchy doesn't privilege deceptive actions.
        
        Rules:
        - Important info (prices, terms) should not be in tiny/faded text
        - Decline/cancel should be at least somewhat visible
        - Requires at least 2 suppression signals to flag
        """
        features = []
        interactive = [e for e in elements if e.is_interactive and e.computed_css
                       and len(e.text.strip()) > 1]  # Skip icon-only elements

        # Words that indicate a negative/decline action — use word boundaries
        negative_action_words = {"cancel", "decline", "skip", "reject", "dismiss", "unsubscribe"}

        for element in interactive:
            text_lower = element.text.lower()
            words = set(re.findall(r'\b\w+\b', text_lower))

            # Only flag if the element text is primarily a negative action
            is_negative_action = bool(words & negative_action_words)

            if not is_negative_action:
                continue

            # Skip elements inside nav, header, footer, or forms — these are standard UI
            elem_ctx = getattr(element, 'semantic_context', None)
            if elem_ctx in ('nav', 'header', 'footer', 'form'):
                continue

            css = element.computed_css
            issues = []

            # Very small font (< 11px, not just 12)
            if css.font_size:
                try:
                    font_size = float(css.font_size.replace("px", "").strip())
                    if font_size < 11:
                        issues.append(f"tiny_font_{font_size}px")
                except ValueError:
                    pass

            # Low opacity
            if css.opacity:
                try:
                    opacity = float(css.opacity)
                    if opacity < 0.6:
                        issues.append(f"low_opacity_{opacity}")
                except ValueError:
                    pass

            # Missing visual button styling (plain text link for important action)
            if element.tag == "a" and not css.border and css.text_decoration == "none":
                issues.append("unstyled_link_for_action")

            # Require at least 2 signals — single weak signal is not enough
            if len(issues) >= 2:
                features.append(SpatialFeature(
                    element_id=element.id,
                    violation_type="suppressed_negative_action",
                    severity="high" if len(issues) >= 3 else "medium",
                    measurements={
                        "issues_found": issues,
                        "issue_count": len(issues),
                    },
                    details={
                        "element_text": element.text[:80],
                        "font_size": css.font_size,
                        "opacity": css.opacity,
                        "element_tag": element.tag,
                    }
                ))

        return features

    def _check_reading_flow(self, elements: list[UIElement]) -> list[SpatialFeature]:
        """
        Check if important information is placed outside the natural reading flow.
        
        E.g., hidden fees at the very bottom, cancel link far from main action.
        """
        features = []
        text_elements = [
            e for e in elements
            if e.text.strip() and e.bounding_box
        ]

        if not text_elements:
            return features

        # Find elements with important but potentially hidden information
        # Removed "cancel" — too generic, triggers on normal cancel buttons
        important_keywords = ["fee", "charge", "cost", "price", "recurring",
                            "subscription", "auto-renew"]

        # Exclude footer elements — "Terms" and "Privacy" in footers are standard
        def _is_footer_element(el):
            """Check if element is in a footer using semantic_context or class heuristics."""
            # Use semantic_context from the crawler (walks up the DOM tree)
            if getattr(el, 'semantic_context', None) in ('footer', 'nav', 'header'):
                return True
            if el.tag == "footer":
                return True
            classes_str = " ".join(getattr(el, 'classes', []) or []).lower()
            return any(kw in classes_str for kw in ('footer', 'copyright', 'legal', 'bottom-nav', 'site-info'))

        for element in text_elements:
            if _is_footer_element(element):
                continue

            text_lower = element.text.lower()
            matched_keywords = [kw for kw in important_keywords if kw in text_lower]

            if matched_keywords and element.bounding_box:
                # Check if it's pushed far down the page
                page_elements_with_bbox = [e for e in elements if e.bounding_box]
                if page_elements_with_bbox:
                    max_y = max(e.bounding_box.y for e in page_elements_with_bbox)
                    if max_y > 0:
                        vertical_position_ratio = element.bounding_box.y / max_y

                        # Important info at the bottom 5% + small AND faded text = suspicious
                        is_bottom = vertical_position_ratio > 0.95
                        is_small = False
                        is_faded = False

                        if element.computed_css:
                            if element.computed_css.font_size:
                                try:
                                    fs = float(element.computed_css.font_size.replace("px", "").strip())
                                    is_small = fs < 10
                                except ValueError:
                                    pass
                            if element.computed_css.opacity:
                                try:
                                    is_faded = float(element.computed_css.opacity) < 0.5
                                except ValueError:
                                    pass

                        # Require BOTH small and faded, not just one
                        if is_bottom and is_small and is_faded:
                            features.append(SpatialFeature(
                                element_id=element.id,
                                violation_type="buried_important_info",
                                severity="high",
                                measurements={
                                    "vertical_position_ratio": round(vertical_position_ratio, 3),
                                    "is_bottom_5_pct": is_bottom,
                                    "is_small_text": is_small,
                                    "is_faded": is_faded,
                                },
                                details={
                                    "element_text": element.text[:150],
                                    "matched_keywords": matched_keywords,
                                    "font_size": element.computed_css.font_size if element.computed_css else None,
                                    "opacity": element.computed_css.opacity if element.computed_css else None,
                                }
                            ))

        return features

    def _check_font_size_manipulation(self, elements: list[UIElement]) -> list[SpatialFeature]:
        """Detect font size manipulation — important information in much smaller text than surrounding content."""
        features = []
        elements_with_font = []

        for element in elements:
            if element.computed_css and element.computed_css.font_size and element.text.strip():
                try:
                    fs = float(element.computed_css.font_size.replace("px", "").strip())
                    elements_with_font.append((element, fs))
                except ValueError:
                    pass

        if len(elements_with_font) < 2:
            return features

        # Calculate median font size on the page
        font_sizes = [fs for _, fs in elements_with_font]
        median_fs = sorted(font_sizes)[len(font_sizes) // 2]

        # Flag elements with font size less than 60% of median AND containing important text
        important_patterns = [
            r"\*", r"terms", r"condition", r"fee", r"charge", r"recurring",
            r"auto.?renew", r"cancel", r"refund", r"subscription",
        ]

        for element, fs in elements_with_font:
            if fs < (median_fs * 0.6) and fs < 11:
                text_lower = element.text.lower()
                is_important = any(re.search(p, text_lower) for p in important_patterns)

                if is_important:
                    features.append(SpatialFeature(
                        element_id=element.id,
                        violation_type="font_size_manipulation",
                        severity="high",
                        measurements={
                            "element_font_size": fs,
                            "page_median_font_size": median_fs,
                            "ratio_to_median": round(fs / median_fs, 2),
                        },
                        details={
                            "element_text": element.text[:150],
                        }
                    ))

        return features
