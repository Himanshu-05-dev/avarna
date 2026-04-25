"""Quick validation of the new screenshot agent imports and schemas."""
import sys
sys.path.insert(0, ".")

from schemas.features import ScreenshotFeature, FeatureBundle
from extractors.screenshot_agent import ScreenshotAgent, reconcile_verdicts

print("All imports OK")

# Test ScreenshotFeature
sf = ScreenshotFeature(detection_type="test", confidence=0.8)
print(f"ScreenshotFeature: {sf.detection_type}, {sf.confidence}")

# Test FeatureBundle with screenshot_features
fb = FeatureBundle(page_id="test")
print(f"FeatureBundle total: {fb.total_features}")
print(f"Has screenshot_features: {hasattr(fb, 'screenshot_features')}")
print(f"Screenshot features list: {fb.screenshot_features}")

# Test FeatureBundle with data
fb2 = FeatureBundle(
    page_id="test2",
    screenshot_features=[sf],
)
print(f"FeatureBundle with 1 screenshot feature, total: {fb2.total_features}")

print("\nAll tests PASSED!")
