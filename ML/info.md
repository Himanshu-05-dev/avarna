# YourCrawl - ML Microservice Info & Status

## Overview
The ML Microservice is a Python-based FastAPI application running on port 8000. It serves as the core analytical engine of the Dark Pattern Auditor, ingesting DOM tree data and screenshots provided by the Backend to detect, classify, and map dark patterns to regulatory frameworks.

## Current State & Features
- **FastAPI Server (`api.py`)**: 
  - Exposes endpoints like `POST /api/v1/scan` (sync) and `POST /api/v1/scan/async`.
  - Also provides taxonomy data (`/api/v1/taxonomy`) and config details (`/api/v1/config`).
  - Secured via an `X-API-Key` header.
- **Multi-Modal Detection Pipeline (`main.py` & `detection/`)**:
  - **Computer Vision (CV)**: Uses `ultralytics` (YOLO), `transformers`, and `open-clip-torch` (via `extractors/cv_agent.py`) to analyze the visual representation of the page (e.g., contrast ratios, deceptive button sizing).
  - **Natural Language Processing (NLP)**: Uses `sentencepiece` and `transformers` (via `extractors/nlp_agent.py`) to analyze text for urgency, guilt-tripping, or deceptive phrasing.
  - **Spatial/Heuristic Analysis**: Uses `extractors/spatial_agent.py` to evaluate bounding boxes, Z-indexes, and hidden elements.
  - **Ensemble ML**: Uses `xgboost`, `lightgbm`, and `scikit-learn` (`detection/ensemble.py`) to combine features and make a final prediction on the presence and subtype of a dark pattern.
- **Regulatory Compliance (`compliance/`)**:
  - Maps detected dark patterns to specific laws (e.g., GDPR, CCPA, EU AI Act, DSA, DPDP Act) using the `clause_database.py` and `mapper.py`.
- **Roadmap Generation (`output/`)**:
  - Uses `priority_scorer.py` to prioritize issues based on severity, effort, and regulatory risk.
  - Generates structured ticket objects (`roadmap_generator.py`).
- **Gemini Verification**:
  - Optional `verify_with_gemini` flag allows a secondary pass using the Gemini API to reduce false positives.

## Key Directories & Files
- `api.py`: Main entry point and routing.
- `main.py`: Pipeline execution logic.
- `training_data/`: JSON batches containing historical or training examples.
- `schemas/`: Pydantic models defining strict input/output shapes (`input_schema.py`, `output.py`).

## Status
Highly sophisticated and operational. It correctly fuses visual, spatial, and textual data to identify subtle UI/UX manipulation tactics (dark patterns). The async endpoint allows for processing large or multiple pages without timing out.
