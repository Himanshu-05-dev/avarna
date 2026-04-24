"""
Dark Pattern Auditor — REST API

Run:
    uvicorn api:app --reload --host 0.0.0.0 --port 8000

Docs:
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""

import os
import sys
import uuid
import time
import logging
import traceback
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Security, Query, BackgroundTasks
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Project imports ──────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from schemas.input_schema import CrawlData
from schemas.output import Roadmap
from main import load_input, extract_features, detect_patterns, verify_with_gemini, map_compliance
from output.roadmap_generator import RoadmapGenerator
from config import DARK_PATTERN_TAXONOMY, ALL_SUBTYPES, SUBTYPE_TO_CATEGORY
import config as cfg


# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-25s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("api")


# ── FastAPI App ──────────────────────────────────────────────
app = FastAPI(
    title="Dark Pattern Auditor API",
    description=(
        "AI-powered dark pattern detection and regulatory compliance analysis. "
        "Submit crawled website data and receive a prioritized remediation roadmap."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins for dev convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ─────────────────────────────────────────────────────
API_KEY = os.getenv("API_KEY", "changeme")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)):
    if not api_key or api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return api_key


# ── Response Models ──────────────────────────────────────────
class HealthResponse(BaseModel):
    name: str = "Dark Pattern Auditor API"
    version: str = "1.0.0"
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.now)


class AsyncScanResponse(BaseModel):
    scan_id: str
    status: str = "processing"
    message: str = "Scan queued. Poll GET /api/v1/scan/{scan_id} for results."


class ScanStatusResponse(BaseModel):
    scan_id: str
    status: str  # processing | completed | failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Roadmap] = None


class TaxonomyResponse(BaseModel):
    taxonomy: dict
    total_categories: int
    total_subtypes: int
    all_subtypes: list[str]


class ConfigResponse(BaseModel):
    candidate_threshold: float
    high_confidence_threshold: float
    shap_significance: float
    min_touch_target_px: int
    contrast_ratio_aa: float
    contrast_ratio_aaa: float
    size_asymmetry_ratio: float
    nlp_classification_threshold: float
    sentiment_asymmetry_threshold: float


# ── In-memory scan store (async results) ─────────────────────
scan_store: dict[str, ScanStatusResponse] = {}


# ── Pipeline Runner ──────────────────────────────────────────
def run_pipeline(
    crawl_data: CrawlData,
    use_clip: bool = False,
    use_transformer: bool = False,
    verify_gemini: bool = False,
) -> Roadmap:
    """
    Execute the full auditor pipeline on provided crawl data.
    Inference only — no training data is collected.
    """
    logger.info(f"Pipeline start: {crawl_data.url} ({len(crawl_data.pages)} pages)")
    start = time.time()

    all_roadmaps: list[Roadmap] = []

    for page in crawl_data.pages:
        # 1. Feature extraction
        bundle = extract_features(page, use_clip=use_clip, use_transformer=use_transformer)

        # 2. Detection
        detection_result = detect_patterns(bundle)

        # 3. Optional Gemini verification
        if verify_gemini:
            detection_result = verify_with_gemini(detection_result)

        # 4. Compliance mapping
        compliance_map = map_compliance(detection_result)

        # 5. Generate roadmap (without writing files)
        generator = RoadmapGenerator()
        roadmap = generator.generate(detection_result, compliance_map, page)
        all_roadmaps.append(roadmap)

    # Merge multi-page roadmaps into one
    if len(all_roadmaps) == 0:
        roadmap = Roadmap(scan_url=crawl_data.url)
    elif len(all_roadmaps) == 1:
        roadmap = all_roadmaps[0]
    else:
        roadmap = all_roadmaps[0]
        for r in all_roadmaps[1:]:
            roadmap.tickets.extend(r.tickets)
            roadmap.total_elements_scanned += r.total_elements_scanned
            roadmap.total_findings += r.total_findings
            roadmap.critical_count += r.critical_count
            roadmap.high_count += r.high_count
            roadmap.medium_count += r.medium_count
            roadmap.low_count += r.low_count
            for cat in r.categories_found:
                if cat not in roadmap.categories_found:
                    roadmap.categories_found.append(cat)
            for reg in r.regulations_violated:
                if reg not in roadmap.regulations_violated:
                    roadmap.regulations_violated.append(reg)
        roadmap.sort_by_priority()

    elapsed = time.time() - start
    logger.info(f"Pipeline complete in {elapsed:.1f}s — {roadmap.total_findings} findings")
    return roadmap


def run_async_pipeline(scan_id: str, crawl_data: CrawlData,
                       use_clip: bool, use_transformer: bool, verify_gemini: bool):
    """Background task wrapper for async scans."""
    try:
        roadmap = run_pipeline(crawl_data, use_clip, use_transformer, verify_gemini)
        scan_store[scan_id].status = "completed"
        scan_store[scan_id].completed_at = datetime.now()
        scan_store[scan_id].result = roadmap
    except Exception as e:
        logger.error(f"Async scan {scan_id} failed: {e}\n{traceback.format_exc()}")
        scan_store[scan_id].status = "failed"
        scan_store[scan_id].completed_at = datetime.now()
        scan_store[scan_id].error = str(e)


# ── Routes ───────────────────────────────────────────────────

@app.get("/", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check — no auth required."""
    return HealthResponse()


@app.post("/api/v1/scan", response_model=Roadmap, tags=["Scan"])
async def scan_sync(
    crawl_data: CrawlData,
    use_clip: bool = Query(False, description="Enable CLIP CV model (slower, better visual detection)"),
    use_transformer: bool = Query(False, description="Enable transformer NLP (slower, better text classification)"),
    verify_with_gemini: bool = Query(False, description="Run Gemini LLM verification (uses API quota)"),
    _key: str = Security(verify_api_key),
):
    """
    **Synchronous scan** — submit crawl data JSON and wait for the full roadmap response.

    Best for small payloads (1-3 pages). For larger scans, use `/api/v1/scan/async`.
    """
    try:
        roadmap = run_pipeline(crawl_data, use_clip, use_transformer, verify_with_gemini)
        return roadmap
    except Exception as e:
        logger.error(f"Sync scan failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@app.post("/api/v1/scan/async", response_model=AsyncScanResponse, tags=["Scan"])
async def scan_async(
    crawl_data: CrawlData,
    background_tasks: BackgroundTasks,
    use_clip: bool = Query(False, description="Enable CLIP CV model"),
    use_transformer: bool = Query(False, description="Enable transformer NLP"),
    verify_with_gemini: bool = Query(False, description="Run Gemini LLM verification"),
    _key: str = Security(verify_api_key),
):
    """
    **Async scan** — submit crawl data and get a `scan_id` immediately.

    Poll `GET /api/v1/scan/{scan_id}` to check status and retrieve results.
    """
    scan_id = str(uuid.uuid4())

    scan_store[scan_id] = ScanStatusResponse(
        scan_id=scan_id,
        status="processing",
        started_at=datetime.now(),
    )

    background_tasks.add_task(
        run_async_pipeline, scan_id, crawl_data,
        use_clip, use_transformer, verify_with_gemini,
    )

    return AsyncScanResponse(scan_id=scan_id)


@app.get("/api/v1/scan/{scan_id}", response_model=ScanStatusResponse, tags=["Scan"])
async def get_scan_status(
    scan_id: str,
    _key: str = Security(verify_api_key),
):
    """
    **Get scan status** — poll this endpoint after submitting an async scan.

    Returns `processing`, `completed` (with the full roadmap), or `failed`.
    """
    if scan_id not in scan_store:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found")

    return scan_store[scan_id]


@app.get("/api/v1/taxonomy", response_model=TaxonomyResponse, tags=["Reference"])
async def get_taxonomy(
    _key: str = Security(verify_api_key),
):
    """
    **Dark pattern taxonomy** — all 8 categories and ~40 subtypes used by the detection engine.
    """
    return TaxonomyResponse(
        taxonomy=DARK_PATTERN_TAXONOMY,
        total_categories=len(DARK_PATTERN_TAXONOMY),
        total_subtypes=len(ALL_SUBTYPES),
        all_subtypes=ALL_SUBTYPES,
    )


@app.get("/api/v1/config", response_model=ConfigResponse, tags=["Reference"])
async def get_config(
    _key: str = Security(verify_api_key),
):
    """
    **Current configuration** — detection thresholds and settings.
    """
    return ConfigResponse(
        candidate_threshold=cfg.CANDIDATE_THRESHOLD,
        high_confidence_threshold=cfg.HIGH_CONFIDENCE_THRESHOLD,
        shap_significance=cfg.SHAP_SIGNIFICANCE,
        min_touch_target_px=cfg.MIN_TOUCH_TARGET_PX,
        contrast_ratio_aa=cfg.CONTRAST_RATIO_AA,
        contrast_ratio_aaa=cfg.CONTRAST_RATIO_AAA,
        size_asymmetry_ratio=cfg.SIZE_ASYMMETRY_RATIO,
        nlp_classification_threshold=cfg.NLP_CLASSIFICATION_THRESHOLD,
        sentiment_asymmetry_threshold=cfg.SENTIMENT_ASYMMETRY_THRESHOLD,
    )
