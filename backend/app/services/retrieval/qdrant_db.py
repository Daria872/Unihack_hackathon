from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple
import numpy as np

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

# Dimension for our vector space. Let's use 384 (standard for bge-small-en-v1.5)
VECTOR_DIM = 384
COLLECTION_NAME = "manufacturer_docs"


class DeterministicEmbedder:
    """Generates standard 384-dimensional vectors deterministically from text.
    
    Used as an ultra-fast, zero-dependency backup for tests and offline runs.
    """
    @staticmethod
    def embed(text: str) -> List[float]:
        # Hash text to get seed
        hasher = hashlib.sha256(text.encode("utf-8"))
        seed_bytes = hasher.digest()
        # Seed numpy generator
        seed = int.from_bytes(seed_bytes[:4], "big")
        rng = np.random.default_rng(seed)
        # Generate stable unit vector
        vec = rng.normal(size=VECTOR_DIM)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()


class QdrantDBService:
    """Handles storing document chunks in Qdrant and retrieving them via semantic + keyword queries."""

    def __init__(self, location: str = ":memory:", path: str | None = None) -> None:
        """Initialize Qdrant client. Defaults to in-memory for testing."""
        if path:
            # Persistent local dir
            Path(path).mkdir(parents=True, exist_ok=True)
            self.client = QdrantClient(path=path)
        else:
            self.client = QdrantClient(location=location)
            
        self._init_collection()
        self._embedding_model: Any = None
        self._use_local_embedder = True
        
        # Try loading fastembed
        try:
            from fastembed import TextEmbedding
            # We delay loading the model until first actual embed call to keep boot fast
            self._TextEmbedding = TextEmbedding
            self._use_local_embedder = False
            logger.info("Fastembed available. Will use BGE embeddings.")
        except ImportError:
            logger.info("Fastembed not found or failed to load. Using deterministic hash embedder.")

    def _init_collection(self) -> None:
        """Ensure collection exists in Qdrant."""
        if not self.client.collection_exists(COLLECTION_NAME):
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            )
            logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")

    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding using fastembed or fallback tracker."""
        if self._use_local_embedder:
            return DeterministicEmbedder.embed(text)
        
        try:
            if self._embedding_model is None:
                logger.info("Initializing fastembed model (bge-small-en-v1.5)...")
                # Using cache_dir under workspace tmp to avoid system directory clutter
                cache_path = Path(__file__).resolve().parents[3] / "tmp" / "fastembed_cache"
                cache_path.mkdir(parents=True, exist_ok=True)
                self._embedding_model = self._TextEmbedding(
                    model_name="BAAI/bge-small-en-v1.5",
                    cache_dir=str(cache_path)
                )
            
            # Embed text (bge-small-en-v1.5 outputs 384 dimensions)
            embeddings = list(self._embedding_model.embed([text]))
            if embeddings:
                return embeddings[0].tolist()
        except Exception as e:
            logger.warning(f"Failed to generate fastembed vector ({e}). Falling back to deterministic hasher.")
            
        return DeterministicEmbedder.embed(text)

    def clear_database(self) -> None:
        """Delete and recreate the collection."""
        if self.client.collection_exists(COLLECTION_NAME):
            self.client.delete_collection(COLLECTION_NAME)
        self._init_collection()

    def index_pdf_elements(self, mfg_part_num: str, elements: List[Any]) -> None:
        """Embed and upsert PDF elements for a specific manufacturer part number."""
        points = []
        for idx, el in enumerate(elements):
            text_content = el.text
            page_num = el.page_num
            element_type = el.element_type
            source = el.metadata.get("source", "unknown")
            
            vector = self._get_embedding(text_content)
            
            point_id = hashlib.md5(f"{mfg_part_num}_{source}_{page_num}_{idx}".encode("utf-8")).hexdigest()
            # Store in Qdrant
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "mfg_part_num": mfg_part_num,
                        "text": text_content,
                        "page_num": page_num,
                        "element_type": element_type,
                        "source": source,
                    }
                )
            )
            
        if points:
            # Batch upsert
            self.client.upsert(collection_name=COLLECTION_NAME, points=points)
            logger.info(f"Indexed {len(points)} chunks for MPN: {mfg_part_num}")

    def retrieve(
        self,
        query: str,
        mfg_part_num: str | None = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Retrieve chunks from vector store using semantic search, option filtered by Part Number."""
        query_vector = self._get_embedding(query)
        
        # Build filter by part number if supplied
        qdrant_filter = None
        if mfg_part_num:
            qdrant_filter = Filter(
                must=[
                    FieldCondition(
                        key="mfg_part_num",
                        match=MatchValue(value=mfg_part_num)
                    )
                ]
            )
            
        if hasattr(self.client, "query_points"):
            response = self.client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=qdrant_filter,
                limit=limit,
            )
            results = getattr(response, "points", response)
        elif hasattr(self.client, "search"):
            results = self.client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter=qdrant_filter,
                limit=limit,
            )
        else:
            results = []

        hits = []
        for hit in results:
            hits.append({
                "text": hit.payload.get("text", ""),
                "page_num": hit.payload.get("page_num", 1),
                "element_type": hit.payload.get("element_type", "paragraph"),
                "source": hit.payload.get("source", "unknown"),
                "score": hit.score,
                "mfg_part_num": hit.payload.get("mfg_part_num", ""),
            })
        return hits


_client_instance: QdrantDBService | None = None

def get_qdrant_service() -> QdrantDBService:
    global _client_instance
    if _client_instance is None:
        # For serverless dev/testing, we can set memory or storage
        db_path = Path(__file__).resolve().parents[3] / "tmp" / "qdrant_db"
        _client_instance = QdrantDBService(path=str(db_path))
    return _client_instance

def configure_qdrant_service(service: QdrantDBService) -> None:
    global _client_instance
    _client_instance = service
