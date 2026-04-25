"""
Element Role Classifier — assigns a functional role to each UI element.

Instead of classifying the WEBSITE type (which leads to hardcoded per-site rules),
this classifies each ELEMENT's purpose: is it a CTA, a dismiss action, navigation,
content, or a consent element?

Every downstream agent can then decide which element roles to analyze.
"""

import re
import logging
from enum import Enum
from typing import Optional

from schemas.input_schema import UIElement

logger = logging.getLogger(__name__)


class ElementRole(str, Enum):
    CTA_PRIMARY = "cta_primary"         # Buy, Subscribe, Accept, Agree
    CTA_DISMISS = "cta_dismiss"         # Cancel, Skip, No Thanks, Decline
    NAVIGATION = "navigation"           # Menu links, breadcrumbs, pagination
    CONTENT_LINK = "content_link"       # Links within article/post body text
    FORM_CONTROL = "form_control"       # Inputs, selects, checkboxes
    CONSENT_ELEMENT = "consent_element" # Cookie banner, privacy consent
    OVERLAY = "overlay"                 # Modals, popups, dialogs
    DECORATIVE = "decorative"           # Icons, spacers, structural elements
    UNKNOWN = "unknown"


# ── Keyword sets for role detection ──────────────────────────────────────────

_CTA_POSITIVE_WORDS = {
    "buy", "subscribe", "accept", "agree", "continue", "confirm",
    "checkout", "join", "submit", "pay", "purchase", "order",
    "enroll", "register", "sign up", "get started", "download",
    "add to cart", "book now", "reserve",
}

_CTA_NEGATIVE_WORDS = {
    "cancel", "decline", "skip", "reject", "dismiss", "close",
    "unsubscribe", "no thanks", "later", "exit", "leave",
    "not now", "maybe later", "no, thanks", "i'll pass",
    "go back", "return",
}

_CONSENT_CLASS_KEYWORDS = {
    "cookie", "consent", "gdpr", "privacy-banner", "cc-banner",
    "cc-window", "notice", "cmp-", "onetrust", "cookiebot",
}

_NAV_CLASS_KEYWORDS = {
    "nav", "menu", "breadcrumb", "pagination", "tab",
    "sidebar", "topbar", "toolbar",
}

_OVERLAY_CLASS_KEYWORDS = {
    "modal", "popup", "overlay", "dialog", "lightbox",
    "drawer", "sheet",
}


def classify_element_role(element: UIElement) -> ElementRole:
    """
    Classify an element's functional role using DOM signals.
    
    Priority order:
    1. Semantic context (most reliable — from the DOM ancestor walk)
    2. CSS class signals (covers React/Angular non-semantic sites)
    3. Text + tag analysis (for interactive elements)
    4. Input type (for form controls)
    5. Fallback to UNKNOWN
    """
    ctx = getattr(element, 'semantic_context', None)
    classes_str = ' '.join(getattr(element, 'classes', []) or []).lower()
    text_lower = (element.text or '').strip().lower()

    # ── 1. Semantic context from DOM ancestor walk ────────────────────────
    if ctx == 'nav':
        return ElementRole.NAVIGATION
    if ctx == 'dialog':
        return ElementRole.OVERLAY
    # Don't override form inputs — they need FORM_CONTROL role for
    # pre-selection analysis, not a blanket "form" classification.
    # But non-interactive elements inside forms are form context.
    if ctx == 'form' and not element.is_interactive:
        return ElementRole.FORM_CONTROL

    # ── 2. Class-based signals (React, Angular, non-semantic sites) ──────
    if any(kw in classes_str for kw in _CONSENT_CLASS_KEYWORDS):
        return ElementRole.CONSENT_ELEMENT
    if any(kw in classes_str for kw in _OVERLAY_CLASS_KEYWORDS):
        return ElementRole.OVERLAY
    if any(kw in classes_str for kw in _NAV_CLASS_KEYWORDS):
        return ElementRole.NAVIGATION

    # ── 3. Text + tag analysis for interactive elements ──────────────────
    if element.is_interactive and text_lower:
        # Check against multi-word phrases first (order matters)
        for phrase in _CTA_POSITIVE_WORDS:
            if ' ' in phrase and phrase in text_lower:
                return ElementRole.CTA_PRIMARY
        for phrase in _CTA_NEGATIVE_WORDS:
            if ' ' in phrase and phrase in text_lower:
                return ElementRole.CTA_DISMISS

        # Then check individual words
        words = set(re.findall(r'\b\w+\b', text_lower))
        single_positive = {w for w in _CTA_POSITIVE_WORDS if ' ' not in w}
        single_negative = {w for w in _CTA_NEGATIVE_WORDS if ' ' not in w}

        if words & single_positive:
            return ElementRole.CTA_PRIMARY
        if words & single_negative:
            return ElementRole.CTA_DISMISS

        # Links that navigate to other pages (have href, not a CTA) = content link
        if element.tag == 'a' and getattr(element, 'href', None):
            return ElementRole.CONTENT_LINK

    # ── 4. Input elements ────────────────────────────────────────────────
    if getattr(element, 'input_type', None) in (
        'checkbox', 'radio', 'text', 'email', 'password', 'tel', 'number'
    ):
        return ElementRole.FORM_CONTROL

    # ── 5. Decorative / structural elements ──────────────────────────────
    if not text_lower or len(text_lower) <= 1:
        return ElementRole.DECORATIVE

    # ── 6. Navigation by context: header/footer elements ─────────────────
    if ctx in ('header', 'footer'):
        return ElementRole.NAVIGATION

    return ElementRole.UNKNOWN


def classify_all_elements(elements: list[UIElement]) -> dict[str, ElementRole]:
    """
    Classify all elements and return a lookup map: element_id → role.
    """
    roles = {}
    role_counts = {}
    for el in elements:
        role = classify_element_role(el)
        roles[el.id] = role
        role_counts[role] = role_counts.get(role, 0) + 1

    logger.info(
        f"Element role classification: {len(elements)} elements → "
        + ", ".join(f"{r.value}={c}" for r, c in sorted(role_counts.items(), key=lambda x: -x[1]))
    )
    return roles
