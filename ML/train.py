"""
Model Training Script — Trains ML ensemble on labeled dataset + heuristic pseudo-labels.

Usage:
    python train.py                     # Train on all available data
    python train.py --dataset-only      # Train only on labeled dataset (skip sample_data)
    python train.py --sample-only       # Train only on sample_data (original behavior)
"""

import os
import glob
import json
import logging
import numpy as np
import sys
from collections import Counter

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from main import load_input, extract_features
from detection.heuristic_rules import HeuristicClassifier
from detection.ensemble import EnsembleClassifier, featurize

logging.basicConfig(level=logging.INFO, format="%(levelname)-7s │ %(message)s")
logger = logging.getLogger("trainer")


def build_heuristic_dataset():
    """
    Original approach: build a dataset from sample_data using heuristic pseudo-labels.
    """
    feature_vectors = []
    labels = []

    heuristic = HeuristicClassifier()
    sample_dir = os.path.join(os.path.dirname(__file__), "sample_data")
    sample_files = glob.glob(os.path.join(sample_dir, "*.json"))

    logger.info(f"Building heuristic dataset from {len(sample_files)} sample files...")

    for file_path in sample_files:
        try:
            crawl_data = load_input(file_path)
            for page in crawl_data.pages:
                bundle = extract_features(page, use_clip=False, use_transformer=False)
                vector = featurize(bundle)
                feature_vectors.append(vector)

                heuristic_results = heuristic.detect(bundle)
                label = 1 if len(heuristic_results) > 0 else 0
                labels.append(label)

                logger.info(f"Processed {page.page_id}: Label={label}")
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")

    return feature_vectors, labels


def build_labeled_dataset():
    """
    Build a dataset from the converted yamanalab/ec-darkpattern data.
    Uses TRUE labels from the dataset (not heuristic pseudo-labels).
    """
    training_dir = os.path.join(os.path.dirname(__file__), "training_data")
    labels_path = os.path.join(training_dir, "labels.json")

    if not os.path.exists(labels_path):
        logger.warning("No labeled dataset found. Run 'python scripts/convert_dataset.py' first.")
        return [], []

    # Load true labels
    with open(labels_path, "r", encoding="utf-8") as f:
        true_labels = json.load(f)

    logger.info(f"Loaded {len(true_labels)} true labels from dataset")

    # Find all batch JSON files
    batch_files = sorted(glob.glob(os.path.join(training_dir, "batch_*.json")))
    logger.info(f"Found {len(batch_files)} batch files in training_data/")

    feature_vectors = []
    labels = []
    processed = 0
    skipped = 0

    for file_path in batch_files:
        try:
            crawl_data = load_input(file_path)
            for page in crawl_data.pages:
                # Extract features (keyword-only for speed)
                bundle = extract_features(page, use_clip=False, use_transformer=False)
                vector = featurize(bundle)

                # For each element in this page, create a training sample
                # The page-level vector represents all elements combined
                # We use the majority label of elements in this batch
                batch_labels = []
                for element in page.all_elements_flat():
                    if element.id in true_labels:
                        batch_labels.append(true_labels[element.id]["label"])

                if batch_labels:
                    # Use majority vote for the page-level label
                    label = 1 if sum(batch_labels) > len(batch_labels) / 2 else 0
                    feature_vectors.append(vector)
                    labels.append(label)
                    processed += 1
                else:
                    skipped += 1

                if processed % 10 == 0:
                    logger.info(f"Processed {processed} batches...")

        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")

    logger.info(f"Labeled dataset: {processed} samples processed, {skipped} skipped")
    return feature_vectors, labels


def build_per_element_dataset():
    """
    Build a dataset where EACH text element is an individual sample.
    This gives us ~2,356 training samples instead of ~47 batch-level samples.
    Uses a lightweight per-element featurization.
    """
    training_dir = os.path.join(os.path.dirname(__file__), "training_data")
    labels_path = os.path.join(training_dir, "labels.json")

    if not os.path.exists(labels_path):
        logger.warning("No labeled dataset found. Run 'python scripts/convert_dataset.py' first.")
        return [], []

    # Load true labels
    with open(labels_path, "r", encoding="utf-8") as f:
        true_labels = json.load(f)

    logger.info(f"Building per-element dataset from {len(true_labels)} labeled texts...")

    # Import NLP agent for per-element text analysis
    from extractors.nlp_agent import NLPAgent
    from schemas.input_schema import PageData, UIElement
    from schemas.features import FeatureBundle, NLPFeature
    from detection.ensemble import FEATURE_NAMES

    nlp_agent = NLPAgent(use_transformer=False)

    feature_vectors = []
    labels = []
    processed = 0

    batch_files = sorted(glob.glob(os.path.join(training_dir, "batch_*.json")))

    for file_path in batch_files:
        try:
            crawl_data = load_input(file_path)
            for page in crawl_data.pages:
                all_elements = page.all_elements_flat()

                for element in all_elements:
                    if element.id not in true_labels:
                        continue

                    true_label = true_labels[element.id]["label"]

                    # Create a single-element page for feature extraction
                    mini_page = PageData(
                        page_id=element.id,
                        elements=[element],
                    )

                    # Run NLP on this single element
                    nlp_features = nlp_agent.analyze(mini_page)

                    # Build a feature bundle with just this element's NLP features
                    bundle = FeatureBundle(
                        page_id=element.id,
                        cv_features=[],
                        nlp_features=nlp_features,
                        spatial_features=[],
                    )

                    vector = featurize(bundle)
                    feature_vectors.append(vector)
                    labels.append(true_label)
                    processed += 1

                    if processed % 500 == 0:
                        logger.info(f"  Processed {processed}/{len(true_labels)} elements...")

        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")

    logger.info(f"Per-element dataset: {processed} samples created")
    return feature_vectors, labels


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train the dark pattern ML ensemble")
    parser.add_argument("--dataset-only", action="store_true",
                       help="Train only on labeled dataset (skip sample_data)")
    parser.add_argument("--sample-only", action="store_true",
                       help="Train only on sample_data heuristic labels (original behavior)")
    args = parser.parse_args()

    print("=" * 60)
    print("  DARK PATTERN ENSEMBLE TRAINING")
    print("=" * 60)

    all_vectors = []
    all_labels = []

    # 1. Labeled dataset (per-element — ~2,356 real samples)
    if not args.sample_only:
        print("\n[1/2] Building per-element dataset from labeled data...")
        vecs, labs = build_per_element_dataset()
        all_vectors.extend(vecs)
        all_labels.extend(labs)

    # 2. Heuristic pseudo-labeled data from sample_data
    if not args.dataset_only:
        print("\n[2/2] Building heuristic dataset from sample_data...")
        vecs, labs = build_heuristic_dataset()
        all_vectors.extend(vecs)
        all_labels.extend(labs)

    if not all_vectors:
        print("\nERROR: No training data found!")
        print("  - Run 'python scripts/convert_dataset.py' to generate labeled data")
        print("  - Or ensure sample_data/ has JSON files")
        sys.exit(1)

    X_train = np.array(all_vectors)
    y_train = np.array(all_labels)

    print(f"\n{'=' * 60}")
    print(f"  DATASET SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Total samples:    {X_train.shape[0]}")
    print(f"  Feature count:    {X_train.shape[1]}")
    print(f"  Dark patterns:    {sum(y_train)} ({sum(y_train)/len(y_train)*100:.1f}%)")
    print(f"  Clean samples:    {len(y_train) - sum(y_train)} ({(len(y_train)-sum(y_train))/len(y_train)*100:.1f}%)")
    print(f"{'=' * 60}")

    # 3. Train the ensemble
    print("\nTraining XGBoost + LightGBM ensemble...")
    ensemble = EnsembleClassifier()
    ensemble.train(X_train, y_train)

    if ensemble.is_trained:
        print(f"\n{'=' * 60}")
        print("  SUCCESS: Models trained and saved to 'models/'!")
        print("  Run: python main.py sample_data/dark_checkout.json")
        print(f"{'=' * 60}")
    else:
        print("\nFAILED: Make sure xgboost, lightgbm, and shap are installed.")
        print("  pip install xgboost lightgbm shap")
