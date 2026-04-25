"""
ingest.py — Document ingestion pipeline for the Legal RAG Agent
Loads DPDP Act, EU AI Act, and Consumer Protection Act texts,
chunks them with metadata, embeds them, and stores in ChromaDB.

Run once (or when documents change):
    python ingest.py
"""

import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# ── ChromaDB & Embeddings ──────────────────────────────────────────────────────
import chromadb
from chromadb.utils import embedding_functions

# ── Text Splitting ─────────────────────────────────────────────────────────────
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ── Load environment ───────────────────────────────────────────────────────────
load_dotenv()

BASE_DIR   = Path(__file__).parent
DATA_DIR   = BASE_DIR / "data"
CHROMA_DIR = BASE_DIR / os.getenv("CHROMA_DB_PATH", "./chroma_db").lstrip("./")

COLLECTION_NAME = "legal_docs"
CHUNK_SIZE      = 800   # characters (~200 tokens)
CHUNK_OVERLAP   = 120

# ── Document registry ──────────────────────────────────────────────────────────
DOCUMENTS = [
    {
        "file":   DATA_DIR / "dpdp_act.txt",
        "source": "DPDP Act 2023",
        "short":  "dpdp",
        "jurisdiction": "India",
    },
    {
        "file":   DATA_DIR / "eu_ai_act.txt",
        "source": "EU AI Act 2024",
        "short":  "euai",
        "jurisdiction": "European Union",
    },
    {
        "file":   DATA_DIR / "consumer_protection.txt",
        "source": "Consumer Protection Act 2019 & CCPA Guidelines 2023",
        "short":  "cpa",
        "jurisdiction": "India",
    },
]


def build_chunks(doc: dict) -> tuple[list[str], list[dict]]:
    """Load a document file, split into chunks, attach rich metadata."""
    text = doc["file"].read_text(encoding="utf-8")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    raw_chunks = splitter.split_text(text)

    texts, metadatas = [], []
    for i, chunk in enumerate(raw_chunks):
        # Try to extract section/article reference from the chunk text
        section_ref = _extract_section_ref(chunk, doc["short"])

        texts.append(chunk)
        metadatas.append({
            "source":       doc["source"],
            "short":        doc["short"],
            "jurisdiction": doc["jurisdiction"],
            "chunk_index":  i,
            "section_ref":  section_ref,
            "char_count":   len(chunk),
        })

    return texts, metadatas


def _extract_section_ref(chunk: str, short: str) -> str:
    """Heuristically extract the first Section/Article reference in a chunk."""
    import re
    if short in ("dpdp", "cpa"):
        m = re.search(r"(Section\s+\d+[\w\(\)]*)", chunk)
    else:
        m = re.search(r"(Article\s+\d+[\w\(\)]*)", chunk)
    return m.group(1) if m else "—"


def main():
    print("=" * 60)
    print("  Legal RAG — Document Ingestion Pipeline")
    print("=" * 60)

    # ── 1. Set up ChromaDB with sentence-transformers embedding ───────────────
    print(f"\n[1/4] Initialising ChromaDB at: {CHROMA_DIR}")
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # Use the free, local sentence-transformers model
    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # Delete existing collection so we can re-ingest cleanly
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"   ✓ Deleted old collection '{COLLECTION_NAME}'")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embed_fn,
        metadata={"hnsw:space": "cosine"},
    )
    print(f"   ✓ Created fresh collection '{COLLECTION_NAME}'")

    # ── 2. Process each document ──────────────────────────────────────────────
    print("\n[2/4] Chunking documents...")
    all_texts, all_metas, all_ids = [], [], []
    chunk_counter = 0

    for doc in DOCUMENTS:
        if not doc["file"].exists():
            print(f"   ⚠  MISSING: {doc['file']} — skipping")
            continue

        texts, metas = build_chunks(doc)
        ids = [f"{doc['short']}_{i:04d}" for i in range(len(texts))]

        all_texts.extend(texts)
        all_metas.extend(metas)
        all_ids.extend(ids)
        chunk_counter += len(texts)

        print(f"   ✓ {doc['source']}: {len(texts)} chunks")

    # ── 3. Embed and store in batches ─────────────────────────────────────────
    BATCH = 64
    print(f"\n[3/4] Embedding {chunk_counter} chunks (batch size {BATCH})...")
    t0 = time.time()

    for start in range(0, chunk_counter, BATCH):
        end = min(start + BATCH, chunk_counter)
        collection.add(
            documents=all_texts[start:end],
            metadatas=all_metas[start:end],
            ids=all_ids[start:end],
        )
        pct = int((end / chunk_counter) * 100)
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        print(f"\r   [{bar}] {pct}%  ({end}/{chunk_counter})", end="", flush=True)

    elapsed = time.time() - t0
    print(f"\n   ✓ Done in {elapsed:.1f}s")

    # ── 4. Verify ─────────────────────────────────────────────────────────────
    count = collection.count()
    print(f"\n[4/4] Verification: {count} vectors stored in ChromaDB ✓")
    print("\n  Ready to run:  python api.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
