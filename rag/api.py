"""
api.py — FastAPI server for the Legal RAG Agent
Runs on port 8001 (configurable via .env RAG_PORT).

Start:
    python api.py
    
Or with auto-reload:
    uvicorn api:app --host 0.0.0.0 --port 8001 --reload
"""

import os
import traceback
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# ── API Key authentication ──────────────────────────────────────────────────────
_RAG_API_KEY    = os.getenv("RAG_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(key: str = Security(_api_key_header)):
    """FastAPI dependency — rejects requests without the correct X-API-Key header."""
    if not _RAG_API_KEY:
        raise HTTPException(500, detail="RAG_API_KEY not configured on server.")
    if key != _RAG_API_KEY:
        raise HTTPException(HTTP_403_FORBIDDEN, detail="Invalid or missing X-API-Key header.")
    return key

# ── Lazy-loaded agent (initialised on startup) ─────────────────────────────────
_agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the RAG agent once when the server starts."""
    global _agent
    print("[Startup] Loading RAG agent…")
    from rag_agent import RAGAgent
    _agent = RAGAgent()
    print("[Startup] RAG agent ready ✓")
    yield
    print("[Shutdown] RAG agent unloaded.")


# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Legal RAG Agent — Dark Pattern Analyzer",
    description=(
        "RAG-based legal AI agent grounded in DPDP Act 2023, EU AI Act 2024, "
        "and Consumer Protection Act 2019 + CCPA Guidelines 2023. "
        "Answers compliance queries and maps detected dark patterns to specific legal violations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# Request / Response Models
# ══════════════════════════════════════════════════════════════════════════════

class QueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=5,
        description="Legal question about dark patterns, consent, or consumer rights.",
        examples=["Is forced consent legal under the DPDP Act?"],
    )


class SourceChunk(BaseModel):
    text:         str
    source:       str
    section_ref:  str
    jurisdiction: str
    relevance:    float


class QueryResponse(BaseModel):
    question: str
    answer:   str
    sources:  list[SourceChunk]


# ── Compliance Check ───────────────────────────────────────────────────────────

class PatternInput(BaseModel):
    pattern:    str  = Field(..., description="Dark pattern type, e.g. 'forced_consent'")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    severity:   Optional[float] = Field(None, ge=0.0, le=1.0)
    evidence:   Optional[str]   = None
    explanation: Optional[str]  = None


class ViolatedLaw(BaseModel):
    law:                   str
    section:               str
    clause_text:           str
    violation_description: str


class PatternViolation(BaseModel):
    pattern:       str
    violated_laws: list[ViolatedLaw]
    risk_level:    str
    user_harm:     str
    recommendations: list[str]


class ComplianceRequest(BaseModel):
    patterns: list[PatternInput] = Field(
        ...,
        min_length=1,
        description="List of detected dark patterns from the ML pipeline.",
    )


class ComplianceResponse(BaseModel):
    violations: list[Any]      # flexible — model output varies
    summary:    str
    sources:    list[SourceChunk]


# ── Simple string-list shortcut ────────────────────────────────────────────────

class SimpleComplianceRequest(BaseModel):
    patterns: list[str] = Field(
        ...,
        description="Simple list of pattern names, e.g. ['forced_consent', 'urgency']"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Meta"])
def health():
    """Server health check."""
    loaded = _agent is not None
    return {
        "status": "ok" if loaded else "initialising",
        "agent_loaded": loaded,
        "collection": "legal_docs",
        "laws_indexed": ["DPDP Act 2023", "EU AI Act 2024", "Consumer Protection Act 2019"],
    }


@app.get("/", tags=["Meta"])
def root():
    return {
        "service": "Legal RAG Agent",
        "docs": "/docs",
        "endpoints": ["/health", "/query", "/query-with-audit", "/compliance-check", "/compliance-check/simple"],
    }


@app.post("/query", response_model=QueryResponse, tags=["Q&A"])
def query_legal(req: QueryRequest):
    """
    Ask any free-form legal question related to dark patterns, consent, or
    consumer rights. Returns an answer grounded in DPDP Act, EU AI Act, and
    Consumer Protection Act with specific clause citations.

    **Example questions:**
    - "Is forced consent legal under the DPDP Act?"
    - "What does the EU AI Act say about manipulative UI techniques?"
    - "What are the penalties for dark patterns under the Consumer Protection Act?"
    """
    if _agent is None:
        raise HTTPException(503, detail="RAG agent not yet initialised. Try again shortly.")
    try:
        result = _agent.query(req.question)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.post("/compliance-check", response_model=ComplianceResponse, tags=["Compliance"])
def compliance_check(req: ComplianceRequest):
    """
    Takes the output of the ML dark-pattern detection pipeline and returns
    a detailed legal compliance analysis with specific law citations.

    **Input:** List of detected pattern objects (from `ML/fusion` or `ML/compliance` pipeline).

    **Output:** Per-pattern legal violations with section numbers, user harm description,
    and actionable recommendations.
    """
    if _agent is None:
        raise HTTPException(503, detail="RAG agent not yet initialised.")
    try:
        patterns_dicts = [p.model_dump() for p in req.patterns]
        result = _agent.compliance_check(patterns_dicts)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@app.post("/compliance-check/simple", response_model=ComplianceResponse, tags=["Compliance"])
def compliance_check_simple(req: SimpleComplianceRequest):
    """
    Simplified compliance check — just pass a list of dark pattern names.

    **Example:**
    ```json
    { "patterns": ["forced_consent", "confirm_shaming", "urgency"] }
    ```

    Useful for quick testing or integration from the Node.js backend
    without having to construct full pattern objects.
    """
    if _agent is None:
        raise HTTPException(503, detail="RAG agent not yet initialised.")
    try:
        result = _agent.compliance_check(req.patterns)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))



# ══════════════════════════════════════════════════════════════════════════════
# Audit-Grounded Q&A
# ══════════════════════════════════════════════════════════════════════════════

class AuditQueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=5,
        description="Natural-language question about this audit's findings or legal implications.",
        examples=["Which laws does this audit violate?", "What is the highest risk finding?"],
    )
    audit_data: dict = Field(
        ...,
        description=(
            "The full auditData object from AuditReport.auditData "
            "(fetched from MongoDB by the Backend and forwarded here)."
        ),
    )
    session_id: Optional[str] = Field(
        None,
        description="Optional session ID for future conversation history support.",
    )


class AuditSummary(BaseModel):
    scan_url:             str
    total_findings:       int
    regulations_violated: list[str]
    pattern_types:        list[str]


class AuditQueryResponse(BaseModel):
    question:      str
    answer:        str
    sources:       list[SourceChunk]
    audit_summary: AuditSummary


@app.post(
    "/query-with-audit",
    response_model=AuditQueryResponse,
    tags=["Audit Q&A"],
    dependencies=[Depends(verify_api_key)],
)
def query_with_audit(req: AuditQueryRequest):
    """
    **Primary integration endpoint — requires `X-API-Key` header.**

    Called by the Node.js Backend after fetching an `AuditReport` from MongoDB.
    Combines two knowledge sources:
    - **Legal vector store** (ChromaDB) — DPDP Act, EU AI Act, Consumer Protection Act.
    - **Audit findings** (passed in `audit_data`) — detected dark patterns, clause annotations,
      severity scores, fix recommendations.

    Returns a structured, citation-rich answer grounded in both sources.

    **Backend usage:**
    ```js
    fetch('http://localhost:8001/query-with-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.RAG_API_KEY,
      },
      body: JSON.stringify({ question, audit_data: report.auditData }),
    })
    ```
    """
    if _agent is None:
        raise HTTPException(503, detail="RAG agent not yet initialised. Try again shortly.")
    try:
        result = _agent.query_with_audit(req.question, req.audit_data)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("RAG_HOST", "0.0.0.0")
    port = int(os.getenv("RAG_PORT", 8001))

    print(f"\n🚀 Starting Legal RAG Agent on http://{host}:{port}")
    print(f"   Docs: http://localhost:{port}/docs\n")

    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )
