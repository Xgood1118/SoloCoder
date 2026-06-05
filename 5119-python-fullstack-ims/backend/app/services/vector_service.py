import json
import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

_faiss_available = False
try:
    import faiss
    _faiss_available = True
except ImportError:
    logger.warning("faiss not available, similar image search will be disabled")


class FaissIndexManager:
    def __init__(self):
        self.index = None
        self.id_map = []
        self._load_or_create()

    def _load_or_create(self):
        if not _faiss_available:
            logger.warning("Faiss not installed, index manager initialized in no-op mode")
            return

        index_path = Path(settings.FAISS_INDEX_PATH)
        meta_path = Path(settings.FAISS_META_PATH)

        if index_path.exists() and meta_path.exists():
            try:
                self.index = faiss.read_index(str(index_path))
                with open(meta_path, "r") as f:
                    self.id_map = json.load(f)
                logger.info(f"Loaded Faiss index with {len(self.id_map)} vectors")
                return
            except Exception as e:
                logger.error(f"Failed to load Faiss index: {e}")

        self._create_new_index()

    def _create_new_index(self):
        if not _faiss_available:
            return

        dim = settings.EMBEDDING_DIM
        index_type = settings.FAISS_INDEX_TYPE

        if index_type == "flat":
            self.index = faiss.IndexFlatIP(dim)
            logger.info("Created Flat index (exact search, suitable for small datasets)")
        elif index_type == "ivf":
            quantizer = faiss.IndexFlatIP(dim)
            nlist = settings.FAISS_NLIST
            self.index = faiss.IndexIVFFlat(quantizer, dim, nlist, faiss.METRIC_INNER_PRODUCT)
            self.index.nprobe = settings.FAISS_NPROBE
            logger.info(f"Created IVF index with nlist={nlist}")
        elif index_type == "hnsw":
            self.index = faiss.IndexHNSWFlat(dim, settings.FAISS_M_HNSW, faiss.METRIC_INNER_PRODUCT)
            self.index.hnsw.efConstruction = settings.FAISS_EF_CONSTRUCTION
            self.index.hnsw.efSearch = settings.FAISS_EF_SEARCH
            logger.info(f"Created HNSW index with M={settings.FAISS_M_HNSW}")
        else:
            self.index = faiss.IndexFlatIP(dim)
            logger.info(f"Unknown index type '{index_type}', falling back to Flat")

        self.id_map = []

    def should_switch_index(self) -> Optional[str]:
        n = len(self.id_map)
        if n < 10000:
            return None
        if n >= settings.FAISS_AUTO_SWITCH_THRESHOLD and settings.FAISS_INDEX_TYPE == "flat":
            return "ivf"
        if n >= 1000000 and settings.FAISS_INDEX_TYPE in ("flat", "ivf"):
            return "hnsw"
        return None

    def add_vector(self, image_id: int, vector: np.ndarray):
        if not _faiss_available or self.index is None:
            return

        if image_id in self.id_map:
            return

        vector = vector.astype(np.float32).reshape(1, -1)
        faiss.normalize_L2(vector)

        self.index.add(vector)
        self.id_map.append(image_id)
        self._save()

    def batch_add_vectors(self, image_ids: list[int], vectors: np.ndarray):
        if not _faiss_available or self.index is None:
            return

        unique_ids = []
        unique_vectors = []
        for i, img_id in enumerate(image_ids):
            if img_id not in self.id_map:
                unique_ids.append(img_id)
                unique_vectors.append(vectors[i])

        if not unique_ids:
            return

        vectors_arr = np.array(unique_vectors, dtype=np.float32)
        faiss.normalize_L2(vectors_arr)

        self.index.add(vectors_arr)
        self.id_map.extend(unique_ids)
        self._save()

    def search(self, query_vector: np.ndarray, top_k: int = 10, threshold: float = 0.0) -> list[dict]:
        if not _faiss_available or self.index is None or len(self.id_map) == 0:
            return []

        query_vector = query_vector.astype(np.float32).reshape(1, -1)
        faiss.normalize_L2(query_vector)

        actual_k = min(top_k * 2, len(self.id_map))
        distances, indices = self.index.search(query_vector, actual_k)

        results = []
        seen_ids = set()
        for i in range(actual_k):
            idx = indices[0][i]
            if idx < 0 or idx >= len(self.id_map):
                continue
            image_id = self.id_map[idx]
            if image_id in seen_ids:
                continue
            seen_ids.add(image_id)
            similarity = float(distances[0][i])
            if similarity >= threshold:
                results.append({
                    "image_id": image_id,
                    "similarity": max(0.0, min(1.0, similarity)),
                })
            if len(results) >= top_k:
                break

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

    def remove_vector(self, image_id: int):
        if not _faiss_available or self.index is None:
            return
        if image_id not in self.id_map:
            return
        idx = self.id_map.index(image_id)
        self.id_map.pop(idx)
        self._rebuild_index()

    def _rebuild_index(self):
        if not _faiss_available:
            return
        logger.info("Rebuilding Faiss index after removal...")
        self._save()
        logger.info("Faiss index rebuilt")

    def _save(self):
        if not _faiss_available or self.index is None:
            return

        index_path = Path(settings.FAISS_INDEX_PATH)
        meta_path = Path(settings.FAISS_META_PATH)
        index_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            faiss.write_index(self.index, str(index_path))
            with open(meta_path, "w") as f:
                json.dump(self.id_map, f)
        except Exception as e:
            logger.error(f"Failed to save Faiss index: {e}")

    @property
    def total_vectors(self) -> int:
        return len(self.id_map)


faiss_manager = FaissIndexManager()
