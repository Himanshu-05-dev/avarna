"""
Central configuration for the Dark Pattern Auditor.
All thresholds, taxonomy definitions, and settings live here.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ─── API Keys ───────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"  # Latest free-tier model

# ─── Detection Thresholds ───────────────────────────────────
CANDIDATE_THRESHOLD = 0.6        # Min probability to flag as candidate
HIGH_CONFIDENCE_THRESHOLD = 0.7  # Auto-confirm threshold
SHAP_SIGNIFICANCE = 0.1          # Min SHAP value to count as significant

# ─── Spatial / Accessibility Thresholds ─────────────────────
MIN_TOUCH_TARGET_PX = 44         # WCAG 2.5.5 minimum touch target
CONTRAST_RATIO_AA = 4.5          # WCAG AA text contrast
CONTRAST_RATIO_AAA = 7.0         # WCAG AAA text contrast
SIZE_ASYMMETRY_RATIO = 5.0       # Flag if accept button > 5x reject button
Z_INDEX_OVERLAY_THRESHOLD = 999  # Suspiciously high z-index

# ─── NLP Thresholds ─────────────────────────────────────────
NLP_CLASSIFICATION_THRESHOLD = 0.6   # Min confidence for NLP classification
SENTIMENT_ASYMMETRY_THRESHOLD = 0.6  # Flag if sentiment gap > 0.6

# ─── Dark Pattern Taxonomy ──────────────────────────────────
# 8 categories, ~40 subtypes
DARK_PATTERN_TAXONOMY = {
    "nagging": {
        "description": "Repeated interruptions to push user toward an action",
        "subtypes": [
            "repeated_prompts",
            "persistent_banners",
            "notification_spam",
            "popup_loops",
        ],
    },
    "obstruction": {
        "description": "Making it intentionally difficult to perform an action",
        "subtypes": [
            "hard_to_cancel",
            "roach_motel",
            "multi_step_exit",
            "hidden_unsubscribe",
            "complex_cancellation_flow",
        ],
    },
    "sneaking": {
        "description": "Hiding or delaying disclosure of relevant information",
        "subtypes": [
            "hidden_costs",
            "forced_continuity",
            "bait_and_switch",
            "hidden_subscription",
            "drip_pricing",
        ],
    },
    "interface_interference": {
        "description": "Manipulating UI to privilege specific actions",
        "subtypes": [
            "disguised_ads",
            "false_hierarchy",
            "pre_selection",
            "trick_questions",
            "confirm_shaming",
            "visual_misdirection",
            "toying_with_emotion",
            "asymmetric_button_sizing",
        ],
    },
    "forced_action": {
        "description": "Forcing users to do something to access functionality",
        "subtypes": [
            "forced_registration",
            "forced_consent",
            "pay_to_skip",
            "gamification_pressure",
        ],
    },
    "urgency": {
        "description": "Imposing time pressure to rush decisions",
        "subtypes": [
            "countdown_timer",
            "limited_time_claim",
            "low_stock_warning",
            "expiring_offer",
        ],
    },
    "social_proof": {
        "description": "Using fabricated social signals to influence behavior",
        "subtypes": [
            "fake_reviews",
            "fake_activity_notifications",
            "testimonial_manipulation",
            "inflated_statistics",
        ],
    },
    "misdirection": {
        "description": "Using visual design to divert attention",
        "subtypes": [
            "attention_diversion",
            "decoy_pricing",
            "buried_information",
            "misleading_flow",
        ],
    },
}

# Flatten for quick lookup
ALL_SUBTYPES = []
SUBTYPE_TO_CATEGORY = {}
for category, info in DARK_PATTERN_TAXONOMY.items():
    for subtype in info["subtypes"]:
        ALL_SUBTYPES.append(subtype)
        SUBTYPE_TO_CATEGORY[subtype] = category

# ─── NLP Classification Labels ─────────────────────────────
NLP_DARK_PATTERN_LABELS = [
    "confirm_shaming",
    "false_urgency",
    "scarcity_claim",
    "misleading_language",
    "emotional_manipulation",
    "hidden_information",
    "forced_action_language",
    "neutral",
]

# ─── Priority Scoring Weights ──────────────────────────────
SEVERITY_WEIGHTS = {
    "critical": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
}

EFFORT_ESTIMATES = {
    "S": "Small — single attribute or text change",
    "M": "Medium — component redesign or flow adjustment",
    "L": "Large — significant architectural or flow changes",
}
