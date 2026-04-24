"""
Dataset Converter — Converts yamanalab/ec-darkpattern TSV into CrawlData-conformant JSONs.

Reads mathur_dataset.tsv and generates:
  1. training_data/*.json  — mock CrawlData JSONs (batched, ~50 texts per file)
  2. training_data/labels.json — true labels mapping page_id → {label, category}

Usage:
    python scripts/convert_dataset.py
"""

import csv
import json
import os
import sys
from datetime import datetime

# Add project root to path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

DATASET_PATH = os.path.join(PROJECT_ROOT, "mathur_dataset.tsv")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "training_data")
BATCH_SIZE = 50  # texts per JSON file


def make_mock_element(row_id: str, text: str) -> dict:
    """Wrap a text string into a mock UIElement with safe dummy visual data."""
    return {
        "id": row_id,
        "tag": "span",
        "text": text,
        "classes": [],
        "bounding_box": {"x": 0.0, "y": 0.0, "w": 200.0, "h": 40.0},
        "computed_css": {
            "font_size": "14px",
            "font_weight": "400",
            "color": "#000000",
            "background_color": "#ffffff",
            "opacity": "1.0",
            "display": "block",
            "visibility": "visible",
        },
        "aria": None,
        "is_interactive": True,  # Treat as interactive so NLP agent processes it
        "is_visible": True,
        "element_type": "text",
        "children": [],
    }


def make_mock_page(page_id: str, elements: list[dict]) -> dict:
    """Wrap elements into a mock PageData."""
    return {
        "page_id": page_id,
        "url": f"https://dataset.example.com/page/{page_id}",
        "title": f"Training Page {page_id}",
        "screenshots": {},
        "elements": elements,
        "page_state": "initial",
    }


def make_mock_crawl_data(pages: list[dict]) -> dict:
    """Wrap pages into a CrawlData object."""
    return {
        "url": "https://dataset.example.com",
        "timestamp": datetime.now().isoformat(),
        "pages": pages,
    }


def main():
    # Read the TSV
    if not os.path.exists(DATASET_PATH):
        print(f"ERROR: Dataset not found at {DATASET_PATH}")
        print("Please download it first:")
        print('  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/yamanalab/ec-darkpattern/master/dataset/dataset.tsv" -OutFile "mathur_dataset.tsv"')
        sys.exit(1)

    rows = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            rows.append(row)

    print(f"Read {len(rows)} rows from dataset")

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Build labels mapping
    labels = {}
    for row in rows:
        page_id = row["page_id"]
        unique_id = f"dataset_{page_id}_{rows.index(row)}"
        labels[unique_id] = {
            "label": int(row["label"]),
            "category": row["Pattern Category"],
        }

    # Generate batched JSON files — each file has one page with multiple elements
    batch_num = 0
    total_elements = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        batch_num += 1

        elements = []
        for j, row in enumerate(batch):
            idx = i + j
            unique_id = f"dataset_{row['page_id']}_{idx}"
            element = make_mock_element(unique_id, row["text"])
            elements.append(element)
            total_elements += 1

        page = make_mock_page(f"training_batch_{batch_num:03d}", elements)
        crawl_data = make_mock_crawl_data([page])

        output_path = os.path.join(OUTPUT_DIR, f"batch_{batch_num:03d}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(crawl_data, f, indent=2)

    # Save labels
    labels_path = os.path.join(OUTPUT_DIR, "labels.json")
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(labels, f, indent=2)

    print(f"\nConversion complete!")
    print(f"  Batches:  {batch_num} JSON files in {OUTPUT_DIR}/")
    print(f"  Elements: {total_elements} text samples")
    print(f"  Labels:   {labels_path}")

    # Stats
    dark = sum(1 for v in labels.values() if v["label"] == 1)
    clean = sum(1 for v in labels.values() if v["label"] == 0)
    print(f"  Dark patterns: {dark}, Clean: {clean}")


if __name__ == "__main__":
    main()
