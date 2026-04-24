"""
ML Ensemble Classifier — XGBoost + LightGBM with SHAP explainability.

Trained on pseudo-labels from heuristic rules (bootstrap approach).
Can be iteratively improved as real labeled data accumulates.

Feature vector is a flat tabular representation of FeatureBundle signals.
"""

import logging
import numpy as np
from typing import Optional
import pickle
import os

from schemas.features import FeatureBundle
from schemas.detection import Candidate, SHAPAttribution
from config import CANDIDATE_THRESHOLD, ALL_SUBTYPES, SUBTYPE_TO_CATEGORY

logger = logging.getLogger(__name__)


# Feature names for the tabular vector
FEATURE_NAMES = [
    # CV features (aggregated per page)
    "cv_tiny_element_count",
    "cv_pre_checked_count",
    "cv_max_clip_similarity",
    "cv_low_opacity_count",
    "cv_tiny_text_count",
    # NLP features
    "nlp_urgency_count",
    "nlp_urgency_max_conf",
    "nlp_scarcity_count",
    "nlp_confirm_shaming_count",
    "nlp_emotional_manipulation_count",
    "nlp_sentiment_asymmetry_max",
    "nlp_misleading_language_count",
    # Spatial features
    "spatial_low_contrast_count",
    "spatial_min_contrast_ratio",
    "spatial_size_asymmetry_max_ratio",
    "spatial_z_index_overlay_count",
    "spatial_suppressed_action_count",
    "spatial_buried_info_count",
    "spatial_font_manipulation_count",
    # Cross-modal
    "total_feature_count",
    "modalities_active",
]


def featurize(bundle: FeatureBundle) -> np.ndarray:
    """Convert a FeatureBundle into a flat feature vector for the ensemble."""
    vector = np.zeros(len(FEATURE_NAMES), dtype=np.float32)

    # CV features
    cv_by_type = {}
    for f in bundle.cv_features:
        cv_by_type.setdefault(f.detection_type, []).append(f)

    vector[0] = len(cv_by_type.get("tiny_interactive_element", []))
    vector[1] = len(cv_by_type.get("pre_checked_input", []))
    clip_sims = [f.clip_similarity for f in bundle.cv_features if f.clip_similarity is not None]
    vector[2] = max(clip_sims) if clip_sims else 0.0
    vector[3] = len(cv_by_type.get("low_opacity_interactive", []))
    vector[4] = len(cv_by_type.get("tiny_text_interactive", []))

    # NLP features
    nlp_by_type = {}
    for f in bundle.nlp_features:
        nlp_by_type.setdefault(f.pattern_type, []).append(f)

    urgency = nlp_by_type.get("false_urgency", [])
    vector[5] = len(urgency)
    vector[6] = max((f.confidence for f in urgency), default=0.0)
    vector[7] = len(nlp_by_type.get("scarcity_claim", []))
    vector[8] = len(nlp_by_type.get("confirm_shaming", []))
    vector[9] = len(nlp_by_type.get("emotional_manipulation", []))
    asymmetry = nlp_by_type.get("sentiment_asymmetry", [])
    vector[10] = max((f.details.get("asymmetry_score", 0) for f in asymmetry), default=0.0)
    vector[11] = len(nlp_by_type.get("misleading_language", []))

    # Spatial features
    sp_by_type = {}
    for f in bundle.spatial_features:
        sp_by_type.setdefault(f.violation_type, []).append(f)

    low_contrast = sp_by_type.get("low_contrast", [])
    vector[12] = len(low_contrast)
    contrast_ratios = [f.measurements.get("contrast_ratio", 21) for f in low_contrast]
    vector[13] = min(contrast_ratios) if contrast_ratios else 21.0
    asymm = sp_by_type.get("size_asymmetry", [])
    vector[14] = max((f.measurements.get("area_ratio", 0) for f in asymm), default=0.0)
    vector[15] = len(sp_by_type.get("z_index_overlay", []))
    vector[16] = len(sp_by_type.get("suppressed_negative_action", []))
    vector[17] = len(sp_by_type.get("buried_important_info", []))
    vector[18] = len(sp_by_type.get("font_size_manipulation", []))

    # Cross-modal
    vector[19] = bundle.total_features
    active = 0
    if bundle.cv_features:
        active += 1
    if bundle.nlp_features:
        active += 1
    if bundle.spatial_features:
        active += 1
    vector[20] = active

    return vector


class EnsembleClassifier:
    """XGBoost + LightGBM ensemble with SHAP explainability."""

    def __init__(self, model_dir: str = "models"):
        self.model_dir = model_dir
        self.xgb_model = None
        self.lgb_model = None
        self.xgb_explainer = None
        self.is_trained = False

    def train(self, feature_vectors: np.ndarray, labels: np.ndarray):
        """
        Train the ensemble on feature vectors and binary labels.
        Labels: 1 = dark pattern, 0 = not dark pattern.
        """
        try:
            import xgboost as xgb
            import lightgbm as lgb

            logger.info(f"Training ensemble on {len(labels)} samples...")

            # XGBoost
            self.xgb_model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                use_label_encoder=False,
                eval_metric="logloss",
                random_state=42,
            )
            self.xgb_model.fit(feature_vectors, labels)

            # LightGBM
            self.lgb_model = lgb.LGBMClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                random_state=42,
                verbose=-1,
            )
            self.lgb_model.fit(feature_vectors, labels)

            # SHAP explainer for XGBoost
            import shap
            self.xgb_explainer = shap.TreeExplainer(self.xgb_model)

            self.is_trained = True
            logger.info("Ensemble training complete")

            # Save models
            self._save_models()

        except ImportError as e:
            logger.warning(f"Could not train ensemble — missing dependency: {e}")
            self.is_trained = False

    def predict(self, feature_vector: np.ndarray, page_id: str) -> list[Candidate]:
        """
        Predict dark pattern probability with SHAP explanations.
        Returns candidates above the threshold.

        FIX A — Minimum signal gate:
        The ensemble uses a page-level feature vector (counts of signals).
        A large, interactive site (Reddit, Amazon) naturally has many elements,
        making total_feature_count high even with zero dark patterns.
        We require at least 3 DISTINCT positive signal types before trusting
        the ensemble output.
        """
        if not self.is_trained:
            logger.debug("Ensemble not trained — skipping ML prediction")
            return []

        # Reshape for single sample
        if feature_vector.ndim == 1:
            feature_vector = feature_vector.reshape(1, -1)

        # --- FIX A: Gate on minimum distinct positive signals ---
        # Count how many named feature buckets have a value > 0
        # (excludes total_feature_count and modalities_active which are aggregates)
        specific_features = feature_vector[0, :19]  # indices 0-18 are the actual signals
        active_signal_count = int(np.sum(specific_features > 0))
        if active_signal_count < 3:
            logger.debug(
                f"Ensemble skipped for page '{page_id}': "
                f"only {active_signal_count} active signals (minimum 3 required)"
            )
            return []

        # Ensemble prediction (average probabilities)
        xgb_proba = self.xgb_model.predict_proba(feature_vector)[:, 1]
        lgb_proba = self.lgb_model.predict_proba(feature_vector)[:, 1]
        ensemble_proba = (xgb_proba + lgb_proba) / 2.0

        candidates = []

        for i, prob in enumerate(ensemble_proba):
            if prob >= CANDIDATE_THRESHOLD:
                # SHAP values for explainability
                shap_values = self.xgb_explainer.shap_values(feature_vector[i:i+1])
                if isinstance(shap_values, list):
                    shap_vals = shap_values[1][0]  # Class 1 (dark pattern)
                else:
                    shap_vals = shap_values[0]

                # Build SHAP attributions (top contributing features)
                attributions = []
                for j, (name, sv) in enumerate(zip(FEATURE_NAMES, shap_vals)):
                    if abs(sv) > 0.01:  # Only significant features
                        attributions.append(SHAPAttribution(
                            feature_name=name,
                            shap_value=float(sv),
                            feature_value=float(feature_vector[i, j]),
                        ))

                # Sort by absolute SHAP value
                attributions.sort(key=lambda a: abs(a.shap_value), reverse=True)

                # Determine most likely subtype from top SHAP features
                # Returns None if the top driver is a non-specific aggregate feature
                subtype = self._infer_subtype(attributions)
                if subtype is None:
                    logger.debug(
                        f"Ensemble candidate skipped: top SHAP driver is a "
                        f"non-specific aggregate feature, not a real dark pattern signal"
                    )
                    continue

                candidates.append(Candidate(
                    element_id=f"page_level_{page_id}",
                    page_id=page_id,
                    dark_pattern_subtype=subtype,
                    dark_pattern_category=SUBTYPE_TO_CATEGORY.get(subtype, "unknown"),
                    probability=float(prob),
                    evidence_source="ensemble",
                    justification=(
                        f"ML ensemble confidence: {prob:.2%}. "
                        f"Top contributing features: "
                        + ", ".join(f"{a.feature_name} (SHAP: {a.shap_value:+.3f})" for a in attributions[:3])
                    ),
                    shap_attributions=attributions[:10],
                ))

        return candidates

    def _infer_subtype(self, attributions: list[SHAPAttribution]) -> Optional[str]:
        """Infer the most likely dark pattern subtype from SHAP feature contributions.

        FIX B: Returns None if the top SHAP driver is a non-specific aggregate
        feature (total_feature_count, modalities_active). These features just
        measure how big and complex the page is — they are NOT evidence of a
        dark pattern. Returning None causes the caller to skip this candidate.
        """
        if not attributions:
            return None  # No evidence at all — skip

        top_feature = attributions[0].feature_name

        # Aggregate features that are NOT specific dark pattern signals.
        # If any of these is the TOP driver, the ensemble has no real evidence.
        non_specific_features = {"total_feature_count", "modalities_active"}
        if top_feature in non_specific_features:
            return None

        # Map specific feature names to dark pattern subtypes
        feature_to_subtype = {
            "cv_pre_checked_count": "pre_selection",
            "cv_tiny_element_count": "hard_to_cancel",
            "cv_low_opacity_count": "visual_misdirection",
            "cv_tiny_text_count": "buried_information",
            "nlp_urgency_count": "limited_time_claim",
            "nlp_urgency_max_conf": "limited_time_claim",
            "nlp_scarcity_count": "low_stock_warning",
            "nlp_confirm_shaming_count": "confirm_shaming",
            "nlp_emotional_manipulation_count": "toying_with_emotion",
            "nlp_sentiment_asymmetry_max": "toying_with_emotion",
            "nlp_misleading_language_count": "disguised_ads",
            "spatial_size_asymmetry_max_ratio": "asymmetric_button_sizing",
            "spatial_low_contrast_count": "buried_information",
            "spatial_z_index_overlay_count": "forced_consent",
            "spatial_suppressed_action_count": "false_hierarchy",
            "spatial_buried_info_count": "hidden_costs",
            "spatial_font_manipulation_count": "buried_information",
        }

        # If the top feature maps to a known subtype, return it.
        # Otherwise return None — unknown signal, don't guess.
        return feature_to_subtype.get(top_feature, None)

    def _save_models(self):
        """Save trained models to disk."""
        os.makedirs(self.model_dir, exist_ok=True)
        try:
            with open(os.path.join(self.model_dir, "xgb_model.pkl"), "wb") as f:
                pickle.dump(self.xgb_model, f)
            with open(os.path.join(self.model_dir, "lgb_model.pkl"), "wb") as f:
                pickle.dump(self.lgb_model, f)
            logger.info(f"Models saved to {self.model_dir}/")
        except Exception as e:
            logger.warning(f"Could not save models: {e}")

    def load_models(self):
        """Load previously trained models from disk."""
        try:
            import shap
            with open(os.path.join(self.model_dir, "xgb_model.pkl"), "rb") as f:
                self.xgb_model = pickle.load(f)
            with open(os.path.join(self.model_dir, "lgb_model.pkl"), "rb") as f:
                self.lgb_model = pickle.load(f)
            self.xgb_explainer = shap.TreeExplainer(self.xgb_model)
            self.is_trained = True
            logger.info("Models loaded from disk")
        except Exception as e:
            logger.warning(f"Could not load models: {e}")
            self.is_trained = False
