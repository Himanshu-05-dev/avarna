"""
Input schema — defines the data contract between the crawler team and the AI/ML pipeline.
The crawler produces CrawlData; everything downstream consumes it.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BoundingBox(BaseModel):
    """Pixel coordinates of an element on the page."""
    x: float = Field(..., description="Left edge X coordinate in pixels")
    y: float = Field(..., description="Top edge Y coordinate in pixels")
    w: float = Field(..., description="Width in pixels")
    h: float = Field(..., description="Height in pixels")

    @property
    def area(self) -> float:
        return self.w * self.h

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.w / 2, self.y + self.h / 2)


class ComputedCSS(BaseModel):
    """Key computed CSS properties relevant to dark pattern detection."""
    font_size: Optional[str] = None
    font_weight: Optional[str] = None
    color: Optional[str] = None
    background_color: Optional[str] = None
    opacity: Optional[str] = None
    z_index: Optional[str] = None
    display: Optional[str] = None
    visibility: Optional[str] = None
    position: Optional[str] = None
    cursor: Optional[str] = None
    border: Optional[str] = None
    padding: Optional[str] = None
    margin: Optional[str] = None
    text_decoration: Optional[str] = None
    text_align: Optional[str] = None
    # Allow extra CSS properties via model_config
    model_config = {"extra": "allow"}


class AriaAttributes(BaseModel):
    """Accessibility attributes for an element."""
    role: Optional[str] = None
    label: Optional[str] = None
    hidden: Optional[str] = None
    expanded: Optional[str] = None
    checked: Optional[str] = None
    disabled: Optional[str] = None
    describedby: Optional[str] = None
    required: Optional[str] = None
    model_config = {"extra": "allow"}


class UIElement(BaseModel):
    """A single UI element extracted from the page DOM."""
    id: str = Field(..., description="Unique element identifier (CSS selector or generated ID)")
    tag: str = Field(..., description="HTML tag name (button, div, input, etc.)")
    text: str = Field(default="", description="Visible text content of the element")
    classes: list[str] = Field(default_factory=list, description="CSS class names")
    bounding_box: Optional[BoundingBox] = None
    computed_css: Optional[ComputedCSS] = None
    aria: Optional[AriaAttributes] = None
    is_interactive: bool = Field(default=False, description="Whether the element accepts user interaction")
    is_visible: bool = Field(default=True, description="Whether the element is visible on screen")
    element_type: Optional[str] = Field(default=None, description="Semantic type: button, checkbox, link, input, modal, banner, etc.")
    href: Optional[str] = Field(default=None, description="Link URL if applicable")
    input_type: Optional[str] = Field(default=None, description="Input type attribute (checkbox, radio, text, etc.)")
    default_checked: Optional[bool] = Field(default=None, description="Whether checkbox/radio is checked by default")
    placeholder: Optional[str] = Field(default=None, description="Placeholder text for inputs")
    parent_tag: Optional[str] = Field(default=None, description="HTML tag of the direct parent element")
    parent_classes: list[str] = Field(default_factory=list, description="CSS classes of the direct parent element")
    semantic_context: Optional[str] = Field(default=None, description="Nearest semantic ancestor: nav, header, footer, form, dialog, aside, etc.")
    children: list[UIElement] = Field(default_factory=list, description="Child elements in the DOM tree")

    def all_elements_flat(self) -> list[UIElement]:
        """Recursively flatten the element tree into a flat list."""
        result = [self]
        for child in self.children:
            result.extend(child.all_elements_flat())
        return result


class PageData(BaseModel):
    """Data for a single page/state captured by the crawler."""
    page_id: str = Field(..., description="Unique page identifier")
    url: Optional[str] = None
    title: Optional[str] = None
    screenshots: dict[str, str] = Field(
        default_factory=dict,
        description="Screenshot paths keyed by state name (e.g., 'full_page', 'initial', 'scrolled')"
    )
    elements: list[UIElement] = Field(default_factory=list, description="All extracted UI elements")
    page_state: str = Field(default="initial", description="State when captured: initial, scrolled, modal_open, etc.")

    def get_interactive_elements(self) -> list[UIElement]:
        """Return only interactive elements (buttons, links, inputs, etc.)."""
        return [e for e in self.all_elements_flat() if e.is_interactive]

    def get_visible_elements(self) -> list[UIElement]:
        """Return only visible elements."""
        return [e for e in self.all_elements_flat() if e.is_visible]

    def all_elements_flat(self) -> list[UIElement]:
        """Flatten all element trees into a single list."""
        result = []
        for element in self.elements:
            result.extend(element.all_elements_flat())
        return result


class CrawlData(BaseModel):
    """Top-level input data from the crawler team."""
    url: str = Field(..., description="Target website URL")
    timestamp: datetime = Field(default_factory=datetime.now, description="When the crawl was performed")
    pages: list[PageData] = Field(default_factory=list, description="Captured page states")

    def total_elements(self) -> int:
        return sum(len(p.all_elements_flat()) for p in self.pages)
