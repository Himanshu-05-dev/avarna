"""
Dark Pattern Auditor — Main Pipeline Entry Point

Usage:
    python main.py sample_data/dark_checkout.json
    python main.py sample_data/cookie_banner.json --no-clip --no-transformer
    python main.py sample_data/subscription_cancel.json --verify-with-gemini

The pipeline:
    Input JSON → Feature Extraction (CV + NLP + Spatial) → Detection (Heuristic + Ensemble)
    → Optional Gemini Verification → Compliance Mapping → Priority Scoring → HTML + JSON Report
"""

import argparse
import asyncio
import json
import logging
import sys
import os
import time

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from schemas.input_schema import CrawlData
from schemas.features import FeatureBundle
from schemas.detection import DetectionResult, GeminiVerdict

from extractors.cv_agent import CVAgent
from extractors.nlp_agent import NLPAgent
from extractors.spatial_agent import SpatialAgent

from detection.heuristic_rules import HeuristicClassifier
from detection.ensemble import EnsembleClassifier, featurize
from detection.gemini_verify import GeminiVerifier

from compliance.clause_database import ClauseDatabase
from compliance.mapper import ComplianceMapper

from output.roadmap_generator import RoadmapGenerator
from output.report_renderer import render_html, render_json


# ─── Logging Setup ──────────────────────────────────────────
def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s │ %(name)-25s │ %(levelname)-7s │ %(message)s",
        datefmt="%H:%M:%S",
    )
    # Reduce noise from libraries
    logging.getLogger("transformers").setLevel(logging.WARNING)
    logging.getLogger("ultralytics").setLevel(logging.WARNING)
    logging.getLogger("PIL").setLevel(logging.WARNING)


# ─── Pipeline Stages ────────────────────────────────────────
def load_input(input_path: str) -> CrawlData:
    """Load and validate input JSON against the CrawlData schema."""
    logger = logging.getLogger("pipeline.load")
    logger.info(f"Loading input from {input_path}")

    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Unwrap if the JSON was saved directly from an API response containing a 'data' key
    if "data" in raw and isinstance(raw["data"], dict) and "url" in raw["data"]:
        raw = raw["data"]

    crawl_data = CrawlData(**raw)
    logger.info(
        f"Loaded: {len(crawl_data.pages)} page(s), "
        f"{crawl_data.total_elements()} total elements"
    )
    return crawl_data


def extract_features(page, use_clip: bool = True, use_transformer: bool = True) -> FeatureBundle:
    """Run all three feature extractors on a page."""
    logger = logging.getLogger("pipeline.extract")
    logger.info(f"═══ Feature Extraction: page '{page.page_id}' ═══")

    # Initialize agents
    cv_agent = CVAgent(use_clip=use_clip, use_yolo=False)
    nlp_agent = NLPAgent(use_transformer=use_transformer)
    spatial_agent = SpatialAgent()

    # Run extractors (sequential for simplicity — can be parallelized)
    t0 = time.time()

    logger.info("Running CV Agent...")
    cv_features = cv_agent.analyze(page)

    logger.info("Running NLP Agent...")
    nlp_features = nlp_agent.analyze(page)

    logger.info("Running Spatial Agent...")
    spatial_features = spatial_agent.analyze(page)

    elapsed = time.time() - t0
    logger.info(
        f"Feature extraction complete in {elapsed:.1f}s: "
        f"CV={len(cv_features)}, NLP={len(nlp_features)}, Spatial={len(spatial_features)}"
    )

    return FeatureBundle(
        page_id=page.page_id,
        cv_features=cv_features,
        nlp_features=nlp_features,
        spatial_features=spatial_features,
    )


def detect_patterns(bundle: FeatureBundle) -> DetectionResult:
    """Run heuristic and ensemble classifiers on the feature bundle.

    Confidence Scaling:
    - Solo findings (one source only): require >85% confidence
    - Corroborated findings (multiple sources): require >60% confidence
    """
    logger = logging.getLogger("pipeline.detect")
    logger.info(f"═══ Detection Engine: page '{bundle.page_id}' ═══")

    SOLO_THRESHOLD = 0.85
    CORROBORATED_THRESHOLD = 0.60

    # 1. Heuristic rules (always runs)
    heuristic = HeuristicClassifier()
    heuristic_candidates = heuristic.detect(bundle)
    logger.info(f"Heuristic classifier: {len(heuristic_candidates)} candidates")

    # 2. ML ensemble (runs if trained)
    ensemble = EnsembleClassifier()
    ensemble.load_models()
    ensemble_candidates = []

    if ensemble.is_trained:
        feature_vector = featurize(bundle)
        ensemble_candidates = ensemble.predict(feature_vector, bundle.page_id)
        logger.info(f"Ensemble classifier: {len(ensemble_candidates)} candidates")
    else:
        logger.info("Ensemble not trained — using heuristic results only")

    # Combine results
    all_candidates = heuristic_candidates + ensemble_candidates

    # Build corroboration map: which element_ids are flagged by multiple sources
    element_sources: dict[str, set[str]] = {}
    for c in all_candidates:
        element_sources.setdefault(c.element_id, set()).add(c.evidence_source)

    # Deduplicate by element_id + subtype (keep highest confidence)
    deduped = {}
    for c in all_candidates:
        key = (c.element_id, c.dark_pattern_subtype)
        if key not in deduped or c.probability > deduped[key].probability:
            deduped[key] = c

    # Apply confidence scaling
    final_candidates = []
    for c in deduped.values():
        sources = element_sources.get(c.element_id, set())
        is_corroborated = len(sources) > 1

        threshold = CORROBORATED_THRESHOLD if is_corroborated else SOLO_THRESHOLD

        if c.probability >= threshold:
            final_candidates.append(c)
        else:
            logger.debug(
                f"Confidence scaling dropped: {c.element_id} "
                f"({c.dark_pattern_subtype}, {c.probability:.0%}) — "
                f"{'corroborated' if is_corroborated else 'solo'} "
                f"threshold: {threshold:.0%}"
            )

    final_candidates.sort(key=lambda c: c.probability, reverse=True)

    result = DetectionResult(
        page_id=bundle.page_id,
        candidates=final_candidates,
        total_elements_analyzed=bundle.total_features,
        heuristic_count=len(heuristic_candidates),
        ensemble_count=len(ensemble_candidates),
    )

    logger.info(
        f"Detection complete: {len(final_candidates)} candidates "
        f"(from {len(deduped)} unique, {len(all_candidates)} raw)"
    )
    return result


def verify_with_gemini(detection_result: DetectionResult) -> DetectionResult:
    """Verify candidates with Gemini LLM using a 3-tier system to protect API limits.

    Tier 1 (Auto-Drop):     Confidence < 60% → dropped entirely (0 API calls)
    Tier 2 (Gemini Review): Confidence 60%–85% → sent to Gemini for verdict (targeted API calls)
    Tier 3 (Auto-Confirm):  Confidence > 85% → auto-confirmed (0 API calls)
    """
    logger = logging.getLogger("pipeline.verify")
    logger.info("═══ Gemini Verification (Tiered) ═══")

    TIER_DROP_THRESHOLD = 0.60
    TIER_CONFIRM_THRESHOLD = 0.85

    # Classify candidates into tiers
    tier1_drop = []
    tier2_gemini = []
    tier3_confirm = []

    for c in detection_result.candidates:
        if c.probability < TIER_DROP_THRESHOLD:
            tier1_drop.append(c)
        elif c.probability > TIER_CONFIRM_THRESHOLD:
            tier3_confirm.append(c)
        else:
            tier2_gemini.append(c)

    logger.info(
        f"Tiered classification: "
        f"Tier 1 (drop): {len(tier1_drop)}, "
        f"Tier 2 (Gemini): {len(tier2_gemini)}, "
        f"Tier 3 (auto-confirm): {len(tier3_confirm)}"
    )

    # Drop Tier 1 candidates from the results
    surviving_candidates = tier2_gemini + tier3_confirm

    # Auto-confirm Tier 3 with synthetic verdicts (no API call)
    for c in tier3_confirm:
        detection_result.gemini_verdicts[c.element_id] = GeminiVerdict(
            finding_confirmed=True,
            confidence=c.probability,
            reasoning_chain=[
                f"Auto-confirmed: detection confidence {c.probability:.0%} exceeds "
                f"the {TIER_CONFIRM_THRESHOLD:.0%} auto-confirm threshold.",
                f"Evidence source: {c.evidence_source}.",
            ],
            alternative_explanation="High-confidence detection — auto-confirmed without LLM review.",
            severity_assessment=(
                "critical" if c.probability >= 0.95
                else "high" if c.probability >= 0.90
                else "medium"
            ),
        )

    # Send only Tier 2 candidates to Gemini (targeted API usage)
    if tier2_gemini:
        verifier = GeminiVerifier()
        if verifier.model is None:
            logger.warning("Gemini not available — auto-confirming Tier 2 candidates")
            # If Gemini isn't available, include them anyway with lower confidence
            for c in tier2_gemini:
                detection_result.gemini_verdicts[c.element_id] = GeminiVerdict(
                    finding_confirmed=True,
                    confidence=c.probability * 0.8,
                    reasoning_chain=["Gemini unavailable — included with reduced confidence."],
                    alternative_explanation="LLM verification was not available.",
                    severity_assessment="medium",
                )
        else:
            verdicts = verifier.verify_batch(tier2_gemini, delay_seconds=1.5)
            detection_result.gemini_verdicts.update(verdicts)

            confirmed = sum(1 for v in verdicts.values() if v.finding_confirmed)
            logger.info(f"Gemini Tier 2 results: {confirmed}/{len(verdicts)} confirmed")
    else:
        logger.info("No Tier 2 candidates — Gemini API not called (0 API usage)")

    # Update the candidate list to exclude Tier 1 drops
    detection_result.candidates = surviving_candidates

    total_confirmed = sum(1 for v in detection_result.gemini_verdicts.values() if v.finding_confirmed)
    logger.info(
        f"Tiered verification complete: {total_confirmed} total confirmed, "
        f"{len(tier1_drop)} auto-dropped"
    )

    return detection_result


def map_compliance(detection_result: DetectionResult) -> dict:
    """Map findings to regulatory clauses."""
    logger = logging.getLogger("pipeline.compliance")
    logger.info("═══ Compliance Mapping ═══")

    mapper = ComplianceMapper()
    return mapper.map_findings(detection_result)


def generate_output(detection_result: DetectionResult,
                    compliance_map: dict, page=None) -> str:
    """Generate the final roadmap and render reports."""
    logger = logging.getLogger("pipeline.output")
    logger.info("═══ Report Generation ═══")

    generator = RoadmapGenerator()
    roadmap = generator.generate(detection_result, compliance_map, page)

    # Render reports
    json_path = render_json(roadmap)
    html_path = render_html(roadmap)

    # Print summary (ASCII-safe for Windows console)
    print("\n" + "=" * 60)
    print("  DARK PATTERN AUDIT COMPLETE")
    print("=" * 60)
    print(f"  URL:              {roadmap.scan_url}")
    print(f"  Elements scanned: {roadmap.total_elements_scanned}")
    print(f"  Findings:         {roadmap.total_findings}")
    print(f"    Critical:       {roadmap.critical_count}")
    print(f"    High:           {roadmap.high_count}")
    print(f"    Medium:         {roadmap.medium_count}")
    print(f"    Low:            {roadmap.low_count}")
    print(f"  Categories:       {', '.join(roadmap.categories_found)}")
    print(f"  Regulations:      {len(roadmap.regulations_violated)} frameworks")
    print("-" * 60)
    print(f"  JSON report: {json_path}")
    print(f"  HTML report: {html_path}")
    print("=" * 60)

    # Print top 3 tickets
    if roadmap.tickets:
        print("\n  Top Priority Findings:")
        for ticket in roadmap.tickets[:3]:
            sev = "CRITICAL" if ticket.severity_score >= 4 else ("HIGH" if ticket.severity_score >= 3 else "MEDIUM")
            print(f"    [{sev}] {ticket.ticket_id} - {ticket.dark_pattern_subtype.replace('_', ' ').title()}")
            print(f"       Priority: {ticket.priority_score} | Element: {ticket.element_reference}")
            print(f"       {ticket.problem_description[:100]}...")
            print()

    return html_path


# ─── Main ────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Dark Pattern Auditor — AI-powered regulatory compliance analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py sample_data/dark_checkout.json
  python main.py sample_data/cookie_banner.json --no-clip --no-transformer
  python main.py sample_data/subscription_cancel.json --verify-with-gemini -v
        """,
    )
    parser.add_argument("input", help="Path to crawled data JSON file")
    parser.add_argument("--verify-with-gemini", action="store_true",
                       help="Run Gemini LLM verification on candidates (uses API quota)")
    parser.add_argument("--no-clip", action="store_true",
                       help="Disable CLIP model (faster, less CV capability)")
    parser.add_argument("--no-transformer", action="store_true",
                       help="Disable transformer NLP classifier (faster, keyword-only)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose logging")
    parser.add_argument("-o", "--output-dir", default="output_reports",
                       help="Output directory for reports")

    args = parser.parse_args()
    setup_logging(args.verbose)
    logger = logging.getLogger("pipeline")

    logger.info("🚀 Dark Pattern Auditor starting...")
    start_time = time.time()

    # 1. Load input
    crawl_data = load_input(args.input)

    # Process each page
    for page in crawl_data.pages:
        # 2. Extract features
        bundle = extract_features(
            page,
            use_clip=not args.no_clip,
            use_transformer=not args.no_transformer,
        )

        # 3. Detect patterns
        detection_result = detect_patterns(bundle)

        # 4. Optional Gemini verification
        if args.verify_with_gemini:
            detection_result = verify_with_gemini(detection_result)

        # 5. Compliance mapping
        compliance_map = map_compliance(detection_result)

        # 6. Generate output
        html_path = generate_output(detection_result, compliance_map, page)

    elapsed = time.time() - start_time
    logger.info(f"Pipeline complete in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
