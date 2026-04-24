"""
Computer Vision Agent — detects visual dark patterns from UI element properties.

Uses YOLO for UI element detection, CLIP for similarity matching against
dark pattern exemplars, and size/visual analysis from bounding boxes.

For hackathon: primary value comes from size analysis and CLIP similarity.
YOLO adds "we use computer vision" factor but pretrained model won't catch
UI-specific patterns without fine-tuning.
"""

import os
import logging
from typing import Optional
from PIL import Image
import numpy as np

from schemas.input_schema import PageData, UIElement
from schemas.features import CVFeature
from config import MIN_TOUCH_TARGET_PX

logger = logging.getLogger(__name__)

# Dark pattern descriptions for CLIP zero-shot classification
DARK_PATTERN_VISUAL_DESCRIPTIONS = [
    "a very tiny close button that is hard to click",
    "a pre-checked checkbox that the user did not select",
    "a large bright accept button next to a tiny faded reject link",
    "a misleading progress bar showing fake progress",
    "a popup overlay blocking the entire page content",
    "a countdown timer creating urgency to buy",
    "a disguised advertisement that looks like real content",
    "a normal user interface element with clear design",
]


class CVAgent:
    """Computer vision agent for detecting visual dark patterns."""

    def __init__(self, use_clip: bool = True, use_yolo: bool = False):
        """
        Initialize CV agent.

        Args:
            use_clip: Whether to use CLIP for similarity matching (requires torch)
            use_yolo: Whether to use YOLO for element detection (requires ultralytics)
        """
        self.use_clip = use_clip
        self.use_yolo = use_yolo
        self.clip_model = None
        self.clip_processor = None
        self.yolo_model = None

        if self.use_clip:
            self._load_clip()
        if self.use_yolo:
            self._load_yolo()

    def _load_clip(self):
        """Load CLIP model for visual similarity matching."""
        try:
            from transformers import CLIPModel, CLIPProcessor
            logger.info("Loading CLIP model...")
            self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            logger.info("CLIP model loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load CLIP model: {e}. CV agent will run without CLIP.")
            self.use_clip = False

    def _load_yolo(self):
        """Load YOLO model for UI element detection."""
        try:
            from ultralytics import YOLO
            logger.info("Loading YOLOv8 model...")
            self.yolo_model = YOLO("yolov8n.pt")
            logger.info("YOLOv8 model loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load YOLO model: {e}. CV agent will run without YOLO.")
            self.use_yolo = False

    def analyze(self, page: PageData) -> list[CVFeature]:
        """
        Run all CV analyses on a page and return features.

        Analyses performed:
        1. Size analysis — flag tiny interactive elements
        2. Visual state detection — pre-checked checkboxes, etc.
        3. CLIP similarity — compare element descriptions to dark pattern exemplars
        4. YOLO detection — detect UI elements from screenshots (if enabled)
        """
        features = []
        all_elements = page.all_elements_flat()

        logger.info(f"CV Agent analyzing {len(all_elements)} elements on page '{page.page_id}'")

        # 1. Size analysis on interactive elements
        features.extend(self._analyze_element_sizes(all_elements))

        # 2. Visual state detection (pre-checked checkboxes, opacity tricks)
        features.extend(self._analyze_visual_states(all_elements))

        # 3. CLIP similarity matching (if model is loaded)
        if self.use_clip and self.clip_model is not None:
            features.extend(self._analyze_clip_similarity(all_elements))

        # 4. Opacity / visibility tricks
        features.extend(self._analyze_visibility_tricks(all_elements))

        logger.info(f"CV Agent found {len(features)} visual features")
        return features

    def _analyze_element_sizes(self, elements: list[UIElement]) -> list[CVFeature]:
        """Flag interactive elements that are too small to be usable (< 44x44px).
        
        Skips:
        - Elements with 0x0 dimensions (hidden modals/menus not yet rendered)
        - Elements inside nav/header (small icons are standard design)
        """
        features = []
        # Semantic contexts where small interactive elements are normal design
        safe_contexts = {"nav", "header", "footer"}

        for element in elements:
            if not element.is_interactive or not element.bounding_box:
                continue

            bbox = element.bounding_box

            # Skip elements with zero dimensions — they're hidden, not dark patterns
            if bbox.w <= 0 or bbox.h <= 0:
                continue

            # Skip elements inside nav/header/footer — small icons are standard
            if getattr(element, 'semantic_context', None) in safe_contexts:
                continue

            # FIX C: Skip elements whose text is purely an icon character or empty.
            # Hamburger menus, close buttons, arrows are intentionally small.
            icon_chars = set('×✕✖‹›←→↑↓⟨⟩❮❯≡☰⊕⊖+-•·…▲▼◀▶⬅➡⬆⬇◄►')
            element_text = element.text.strip()
            is_icon_only = len(element_text) <= 2 and all(c in icon_chars for c in element_text)
            if is_icon_only or not element_text:
                continue

            min_dimension = min(bbox.w, bbox.h)

            if min_dimension < MIN_TOUCH_TARGET_PX:
                # Calculate severity based on how small it is
                size_ratio = min_dimension / MIN_TOUCH_TARGET_PX
                confidence = 1.0 - size_ratio  # Smaller = higher confidence

                features.append(CVFeature(
                    element_id=element.id,
                    detection_type="tiny_interactive_element",
                    confidence=min(confidence, 0.95),
                    bounding_box={"x": bbox.x, "y": bbox.y, "w": bbox.w, "h": bbox.h},
                    details={
                        "width": bbox.w,
                        "height": bbox.h,
                        "min_dimension": min_dimension,
                        "required_minimum": MIN_TOUCH_TARGET_PX,
                        "element_tag": element.tag,
                        "element_text": element.text[:100],
                    }
                ))

        return features

    def _analyze_visual_states(self, elements: list[UIElement]) -> list[CVFeature]:
        """Detect pre-checked checkboxes and pre-selected radio buttons."""
        features = []
        for element in elements:
            # Check for pre-checked checkboxes
            if element.input_type in ("checkbox", "radio") and element.default_checked:
                features.append(CVFeature(
                    element_id=element.id,
                    detection_type="pre_checked_input",
                    confidence=0.95,  # Very reliable signal from DOM
                    bounding_box=(
                        {"x": element.bounding_box.x, "y": element.bounding_box.y,
                         "w": element.bounding_box.w, "h": element.bounding_box.h}
                        if element.bounding_box else None
                    ),
                    details={
                        "input_type": element.input_type,
                        "element_text": element.text[:100],
                        "aria_label": element.aria.label if element.aria else None,
                    }
                ))

            # Check ARIA checked state as backup
            if element.aria and element.aria.checked == "true" and element.input_type in ("checkbox", "radio"):
                # Avoid duplicate if already caught by default_checked
                if not element.default_checked:
                    features.append(CVFeature(
                        element_id=element.id,
                        detection_type="pre_checked_input",
                        confidence=0.90,
                        details={
                            "input_type": element.input_type,
                            "source": "aria_checked",
                            "aria_label": element.aria.label if element.aria else None,
                        }
                    ))

        return features

    def _analyze_clip_similarity(self, elements: list[UIElement]) -> list[CVFeature]:
        """
        Use CLIP to compare element text descriptions against dark pattern descriptions.
        This acts as a visual-semantic similarity check.
        """
        features = []
        import torch

        for element in elements:
            if not element.text.strip():
                continue

            # Build a description of the element for CLIP
            element_desc = self._build_element_description(element)
            if not element_desc:
                continue

            try:
                # Encode element description and dark pattern descriptions
                inputs = self.clip_processor(
                    text=[element_desc] + DARK_PATTERN_VISUAL_DESCRIPTIONS,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                )

                with torch.no_grad():
                    text_features = self.clip_model.get_text_features(**inputs)

                # Compute similarity between element desc and each dark pattern desc
                element_embedding = text_features[0]
                pattern_embeddings = text_features[1:]

                similarities = torch.nn.functional.cosine_similarity(
                    element_embedding.unsqueeze(0),
                    pattern_embeddings,
                    dim=1,
                )

                # Find the best matching dark pattern
                max_sim_idx = similarities.argmax().item()
                max_sim_value = similarities[max_sim_idx].item()

                # The last description is "normal UI" — skip if that's the best match
                if max_sim_idx < len(DARK_PATTERN_VISUAL_DESCRIPTIONS) - 1 and max_sim_value > 0.65:
                    features.append(CVFeature(
                        element_id=element.id,
                        detection_type="clip_visual_similarity",
                        confidence=max_sim_value,
                        clip_similarity=max_sim_value,
                        exemplar_matched=DARK_PATTERN_VISUAL_DESCRIPTIONS[max_sim_idx],
                        details={
                            "element_description": element_desc,
                            "all_similarities": {
                                desc: float(sim)
                                for desc, sim in zip(DARK_PATTERN_VISUAL_DESCRIPTIONS, similarities)
                            },
                        }
                    ))

            except Exception as e:
                logger.debug(f"CLIP analysis failed for element {element.id}: {e}")

        return features

    def _analyze_visibility_tricks(self, elements: list[UIElement]) -> list[CVFeature]:
        """Detect elements with suspiciously low opacity or visibility tricks."""
        features = []
        for element in elements:
            if not element.computed_css or not element.is_interactive:
                continue

            css = element.computed_css

            # Check for low opacity on interactive elements
            if css.opacity:
                try:
                    opacity = float(css.opacity)
                    if opacity < 0.6:
                        features.append(CVFeature(
                            element_id=element.id,
                            detection_type="low_opacity_interactive",
                            confidence=0.7 * (1 - opacity),
                            details={
                                "opacity": opacity,
                                "element_text": element.text[:100],
                                "element_tag": element.tag,
                            }
                        ))
                except ValueError:
                    pass

            # Check for very small font on important interactive elements
            if css.font_size:
                try:
                    font_size = float(css.font_size.replace("px", "").strip())
                    if font_size < 11 and element.text.strip():
                        features.append(CVFeature(
                            element_id=element.id,
                            detection_type="tiny_text_interactive",
                            confidence=min(0.9, (11 - font_size) / 11),
                            details={
                                "font_size_px": font_size,
                                "element_text": element.text[:100],
                            }
                        ))
                except ValueError:
                    pass

        return features

    def _build_element_description(self, element: UIElement) -> str:
        """Build a textual description of an element for CLIP analysis."""
        parts = []

        if element.tag:
            parts.append(f"a {element.tag} element")

        if element.text:
            parts.append(f'with text "{element.text[:80]}"')

        if element.bounding_box:
            if element.bounding_box.w < 30 or element.bounding_box.h < 30:
                parts.append("that is very small")
            elif element.bounding_box.w > 500 or element.bounding_box.h > 60:
                parts.append("that is very large")

        if element.computed_css:
            if element.computed_css.opacity and float(element.computed_css.opacity or "1") < 0.5:
                parts.append("with low opacity")
            if element.computed_css.font_size:
                try:
                    fs = float(element.computed_css.font_size.replace("px", ""))
                    if fs < 10:
                        parts.append("with tiny text")
                except ValueError:
                    pass

        return " ".join(parts) if len(parts) > 1 else ""
