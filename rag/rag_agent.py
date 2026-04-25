"""
rag_agent.py — Core RAG Query Engine
Wraps ChromaDB retrieval + Gemini 1.5 Flash generation into a clean interface.
"""

import os
import json
import re
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

import chromadb
from chromadb.utils import embedding_functions
import google.generativeai as genai

load_dotenv(override=True)

BASE_DIR        = Path(__file__).parent
CHROMA_DIR      = BASE_DIR / os.getenv("CHROMA_DB_PATH", "./chroma_db").lstrip("./")
COLLECTION_NAME = "legal_docs"
TOP_K           = int(os.getenv("TOP_K_RESULTS", 5))

# ── Gemini setup ───────────────────────────────────────────────────────────────
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
_MODEL = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    generation_config=genai.types.GenerationConfig(
        temperature=0.2,
        max_output_tokens=2048,
    ),
    system_instruction=(
        "You are a legal compliance expert specialising in digital consumer rights, "
        "data privacy law, and AI regulation. You help analyse dark patterns in UI/UX "
        "against applicable laws. Always cite the specific section or article number "
        "when referencing a law. Be precise, structured, and actionable. "
        "If the retrieved context does not contain enough information, say so clearly "
        "rather than hallucinating legal clauses."
    ),
)

# ── Embedding function (must match ingest.py) ──────────────────────────────────
_EMBED_FN = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)


class RAGAgent:
    """
    Retrieval-Augmented Generation agent for legal Q&A and compliance checking.

    Usage:
        agent = RAGAgent()
        result = agent.query("Is forced consent legal under DPDP Act?")
        compliance = agent.compliance_check(["forced_consent", "confirm_shaming"])
    """

    def __init__(self):
        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        self.collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=_EMBED_FN,
        )
        print(f"[RAGAgent] Loaded collection '{COLLECTION_NAME}' "
              f"({self.collection.count()} vectors)")

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def query(self, question: str) -> dict[str, Any]:
        """
        Free-form legal Q&A.

        Returns:
            {
                "answer":   str,          # Gemini-generated answer
                "sources":  list[dict],   # Retrieved chunks with metadata
                "question": str
            }
        """
        chunks = self._retrieve(question, n=TOP_K)
        context = self._format_context(chunks)
        prompt = _QUERY_PROMPT.format(context=context, question=question)
        answer = self._generate(prompt)

        return {
            "question": question,
            "answer":   answer,
            "sources":  chunks,
        }

    def compliance_check(self, patterns: list[dict | str]) -> dict[str, Any]:
        """
        Given a list of detected dark patterns, return legal violations
        with specific clause references.

        patterns can be:
            - list of strings: ["forced_consent", "confirm_shaming"]
            - list of dicts:   [{"pattern": "forced_consent", "confidence": 0.9, ...}]

        Returns:
            {
                "violations": list[dict],   # Per-pattern legal analysis
                "summary":    str,          # Overall compliance summary
                "sources":    list[dict]    # All retrieved legal chunks
            }
        """
        # Normalise input
        pattern_list = []
        for p in patterns:
            if isinstance(p, str):
                pattern_list.append({"pattern": p, "confidence": None, "severity": None})
            else:
                pattern_list.append(p)

        # Build a combined query to retrieve relevant legal context
        pattern_names = [p["pattern"] for p in pattern_list]
        search_query = (
            "dark patterns violations: " + ", ".join(pattern_names) +
            ". consent manipulation, unfair trade practice, prohibited AI practices"
        )
        chunks = self._retrieve(search_query, n=min(TOP_K + 3, 10))
        context = self._format_context(chunks)

        # Build structured prompt
        patterns_str = json.dumps(pattern_list, indent=2)
        prompt = _COMPLIANCE_PROMPT.format(
            context=context,
            patterns=patterns_str,
        )
        raw = self._generate(prompt)

        # Try to parse JSON from the response
        violations = self._parse_json_response(raw)

        # Build overall summary
        summary_prompt = _SUMMARY_PROMPT.format(
            violations_json=json.dumps(violations, indent=2)
        )
        summary = self._generate(summary_prompt)

        return {
            "violations": violations,
            "summary":    summary,
            "sources":    chunks,
        }

    def query_with_audit(self, question: str, audit_data: dict) -> dict[str, Any]:
        """
        Answer a question grounded in BOTH the legal vector store AND a specific
        audit report fetched from MongoDB by the Backend.

        Args:
            question:   The user's natural-language question.
            audit_data: The full auditData payload from AuditReport (same shape
                        as output.json — keys: tickets[], scan_url,
                        regulations_violated, etc.)

        Returns:
            {
                "question":      str,
                "answer":        str,
                "sources":       list[dict],   # legal chunks from ChromaDB
                "audit_summary": dict          # key fields extracted from audit_data
            }
        """
        # 1. Retrieve relevant legal chunks from ChromaDB
        chunks = self._retrieve(question, n=TOP_K)
        legal_context = self._format_context(chunks)

        # 2. Format the audit payload into an LLM-readable string
        audit_context, audit_summary = self._format_audit_context(audit_data)

        # 3. Generate answer with combined context
        prompt = _AUDIT_QUERY_PROMPT.format(
            legal_context=legal_context,
            audit_context=audit_context,
            question=question,
        )
        answer = self._generate(prompt)

        return {
            "question":      question,
            "answer":        answer,
            "sources":       chunks,
            "audit_summary": audit_summary,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _retrieve(self, query: str, n: int = TOP_K) -> list[dict]:
        results = self.collection.query(
            query_texts=[query],
            n_results=n,
            include=["documents", "metadatas", "distances"],
        )
        chunks = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            chunks.append({
                "text":         doc,
                "source":       meta.get("source", "Unknown"),
                "section_ref":  meta.get("section_ref", "—"),
                "jurisdiction": meta.get("jurisdiction", "—"),
                "relevance":    round(1 - dist, 3),   # cosine similarity
            })
        return chunks

    def _format_context(self, chunks: list[dict]) -> str:
        parts = []
        for i, c in enumerate(chunks, 1):
            parts.append(
                f"[Source {i}] {c['source']} | {c['section_ref']} "
                f"(relevance: {c['relevance']})\n{c['text']}"
            )
        return "\n\n---\n\n".join(parts)

    def _generate(self, prompt: str) -> str:
        response = _MODEL.generate_content(prompt)
        return response.text.strip()

    def _parse_json_response(self, raw: str) -> list[dict]:
        """Extract JSON array from the model response."""
        # Strip markdown code fences if present
        cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        try:
            data = json.loads(cleaned)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return [data]
        except json.JSONDecodeError:
            pass
        # Fallback: return raw as a single text result
        return [{"pattern": "unknown", "raw_response": raw}]

    def _format_audit_context(self, audit_data: dict) -> tuple[str, dict]:
        """
        Converts the MongoDB AuditReport.auditData payload into:
        - A human-readable string for the LLM prompt.
        - A compact summary dict returned to the API caller.
        """
        scan_url   = audit_data.get("scan_url", "Unknown URL")
        timestamp  = audit_data.get("scan_timestamp", "")
        tickets    = audit_data.get("tickets", [])
        total      = audit_data.get("total_findings", len(tickets))
        regs       = audit_data.get("regulations_violated", [])

        lines = [
            f"Audit Target: {scan_url}",
            f"Scan Time: {timestamp}",
            f"Total Findings: {total}",
            f"Regulations Violated: {', '.join(regs) if regs else 'None'}",
            "",
            "=== DETECTED DARK PATTERNS ===",
        ]

        for t in tickets:
            lines.append(
                f"\n[●] Pattern: {t.get('dark_pattern_subtype','?')} "
                f"(Category: {t.get('dark_pattern_category','?')}) "
                f"| Severity Score: {t.get('severity_score','?')} "
                f"| Confidence: {round(t.get('detection_confidence', 0) * 100)}%"
            )
            lines.append(f"   Problem: {t.get('problem_description', '')}")
            lines.append(f"   Fix: {t.get('fix_recommendation', '')}")

            annotations = t.get("compliance_annotations", [])
            if annotations:
                lines.append("   Applicable Law Clauses:")
                for a in annotations:
                    lines.append(
                        f"     • [{a.get('act_name','')}] {a.get('section','')} "
                        f"(severity: {a.get('severity','')}, match: {a.get('match_score',0):.2f})"
                    )
                    lines.append(f"       \"{a.get('clause_text','')}\"")

        audit_context = "\n".join(lines)

        audit_summary = {
            "scan_url":             scan_url,
            "total_findings":       total,
            "regulations_violated": regs,
            "pattern_types":        list({t.get("dark_pattern_subtype") for t in tickets}),
        }

        return audit_context, audit_summary


# ══════════════════════════════════════════════════════════════════════════════
# Prompt Templates
# ══════════════════════════════════════════════════════════════════════════════

_QUERY_PROMPT = """
You are a legal compliance expert for digital consumer rights and data privacy.

Use ONLY the legal context below to answer the question. Always cite specific
section or article numbers. If the context is insufficient, say so clearly.

=== RETRIEVED LEGAL CONTEXT ===
{context}

=== QUESTION ===
{question}

=== YOUR ANSWER ===
Provide a structured, precise answer with:
1. Direct answer to the question
2. Relevant legal provisions (with section/article numbers)
3. Practical implication for a digital platform
""".strip()


_COMPLIANCE_PROMPT = """
You are a legal compliance expert. Analyse the following detected dark patterns
against the provided legal clauses and return a JSON array.

=== RETRIEVED LEGAL CONTEXT ===
{context}

=== DETECTED DARK PATTERNS ===
{patterns}

Return a JSON array where each element has this structure:
[
  {{
    "pattern": "pattern_name",
    "violated_laws": [
      {{
        "law": "Law name",
        "section": "Section/Article number",
        "clause_text": "Brief quote or paraphrase of the relevant clause",
        "violation_description": "How this pattern violates this clause"
      }}
    ],
    "risk_level": "high | medium | low",
    "user_harm": "Description of concrete harm to the user",
    "recommendations": [
      "Specific, actionable fix 1",
      "Specific, actionable fix 2"
    ]
  }}
]

IMPORTANT: Cite specific section numbers from the retrieved context.
Respond with ONLY the JSON array, no markdown, no preamble.
""".strip()


_SUMMARY_PROMPT = """
You are a legal compliance expert. Given the following per-pattern violation analysis,
write a concise executive summary (3-5 sentences) covering:
- Total number of violations found
- Which laws are most implicated
- Overall risk level for the platform
- Top 2 priority actions

Violations data:
{violations_json}

Write a plain-text summary paragraph (no markdown headers, no bullet points).
""".strip()


_AUDIT_QUERY_PROMPT = """
You are a legal compliance expert specialising in dark patterns, digital consumer rights,
and data privacy law. You have access to two sources of information:

1. LEGAL CONTEXT — clauses retrieved from DPDP Act 2023, EU AI Act 2024, and
   Consumer Protection Act 2019 / CCPA Guidelines 2023.
2. AUDIT REPORT — the actual scan findings from a dark pattern analysis tool that
   inspected a specific website.

Use BOTH sources together to give a precise, actionable answer. Always cite:
  • The specific Section / Article number from the legal context.
  • The specific pattern type and ticket ID from the audit report (where relevant).

If the audit report contains no relevant findings for the question, say so explicitly
and answer from the legal context alone.

=== LEGAL CONTEXT (from vector database) ===
{legal_context}

=== AUDIT REPORT FINDINGS (from MongoDB) ===
{audit_context}

=== USER QUESTION ===
{question}

=== YOUR ANSWER ===
Structure your response as:
1. **Direct Answer** — a 1-2 sentence response to the question.
2. **Relevant Legal Provisions** — cite specific section/article numbers.
3. **Evidence from Audit** — reference specific detected patterns and their risk levels.
4. **Recommended Action** — concrete, prioritised remediation steps.
""".strip()

