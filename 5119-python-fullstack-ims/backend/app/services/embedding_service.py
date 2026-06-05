import logging
import os
import threading
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image as PILImage

from app.config import settings
from app.services.vector_service import faiss_manager

logger = logging.getLogger(__name__)

_clip_model = None
_clip_available = False
_clip_load_attempted = False


def _try_load_clip_async():
    global _clip_model, _clip_available, _clip_load_attempted
    if _clip_load_attempted:
        return

    def _load():
        global _clip_model, _clip_available
        try:
            from sentence_transformers import SentenceTransformer
            _clip_model = SentenceTransformer(settings.CLIP_MODEL_NAME)
            _clip_available = True
            logger.info(f"CLIP model '{settings.CLIP_MODEL_NAME}' loaded successfully")
        except ImportError:
            logger.info("sentence-transformers not installed, using fallback embedding")
        except Exception as e:
            logger.info(f"CLIP model not available (offline mode), using fallback embedding: {e}")
        finally:
            _clip_load_attempted = True

    threading.Thread(target=_load, daemon=True).start()


_try_load_clip_async()


def _phash_64(image_path: str) -> np.ndarray:
    try:
        import cv2
        img = _read_image_cv2(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return np.zeros(64, dtype=np.float32)
        img = cv2.resize(img, (32, 32), interpolation=cv2.INTER_AREA)
        img = np.float32(img)
        dct = cv2.dct(img)
        dct_low = dct[:8, :8]
        avg = np.mean(dct_low)
        bits = (dct_low > avg).astype(np.float32).flatten()
        bits = bits * 2.0 - 1.0
        return bits
    except Exception as e:
        logger.warning(f"pHash failed: {e}")
        return np.zeros(64, dtype=np.float32)


def _dhash_128(image_path: str) -> np.ndarray:
    try:
        import cv2
        img = _read_image_cv2(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return np.zeros(128, dtype=np.float32)
        img = cv2.resize(img, (17, 16), interpolation=cv2.INTER_AREA)
        diff = img[:, 1:] > img[:, :-1]
        bits = diff.astype(np.float32).flatten()
        bits = bits * 2.0 - 1.0
        return bits
    except Exception as e:
        logger.warning(f"dHash failed: {e}")
        return np.zeros(128, dtype=np.float32)


def get_image_embedding(image_path: str) -> Optional[np.ndarray]:
    try:
        if _clip_available and _clip_model is not None:
            img = PILImage.open(image_path)
            if img.mode != "RGB":
                img = img.convert("RGB")
            embedding = _clip_model.encode(img, convert_to_numpy=True)
            return embedding.astype(np.float32)
        else:
            return _fallback_embedding(image_path)
    except Exception as e:
        logger.error(f"Failed to generate embedding for {image_path}: {e}")
        return None


def _read_image_cv2(image_path: str, flags=-1):
    try:
        import cv2
        import numpy as np
        with open(image_path, 'rb') as f:
            img_bytes = f.read()
        img_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_arr, flags)
        return img
    except Exception as e:
        logger.warning(f"Failed to read image {image_path}: {e}")
        return None


def _fallback_embedding(image_path: str) -> np.ndarray:
    try:
        import cv2
        img = _read_image_cv2(image_path, cv2.IMREAD_COLOR)
        if img is None:
            return np.zeros(settings.EMBEDDING_DIM, dtype=np.float32)

        features = []

        phash = _phash_64(image_path)
        features.extend(phash * 4.0)

        dhash = _dhash_128(image_path)
        features.extend(dhash * 3.0)

        img_small = cv2.resize(img, (16, 16))
        for c in range(3):
            hist = cv2.calcHist([img_small], [c], None, [16], [0, 256]).flatten()
            features.extend(hist * 0.5)

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        hsv_small = cv2.resize(hsv, (16, 16))
        for c in range(3):
            hist = cv2.calcHist([hsv_small], [c], None, [16], [0, 256]).flatten()
            features.extend(hist * 0.3)

        img_8 = cv2.resize(img, (8, 8))
        for c in range(3):
            avg = cv2.calcHist([img_8], [c], None, [8], [0, 256]).flatten()
            features.extend(avg * 0.2)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        img_g = cv2.resize(gray, (8, 8))
        flat = img_g.flatten().astype(np.float32)
        features.extend((flat / 255.0) * 0.5)

        gray_edges = cv2.Canny(gray, 50, 150)
        edge_hist, _ = np.histogram(gray_edges.flatten(), bins=8, range=(0, 256))
        features.extend(edge_hist.astype(np.float32) * 0.4)

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        lab_small = cv2.resize(lab, (8, 8))
        for c in range(3):
            hist = cv2.calcHist([lab_small], [c], None, [8], [0, 256]).flatten()
            features.extend(hist * 0.2)

        feature_array = np.array(features, dtype=np.float32)

        dim = settings.EMBEDDING_DIM
        if len(feature_array) >= dim:
            embedding = feature_array[:dim]
        else:
            embedding = np.zeros(dim, dtype=np.float32)
            embedding[:len(feature_array)] = feature_array

        norm = np.linalg.norm(embedding)
        if norm > 1e-8:
            embedding = embedding / norm
        return embedding
    except Exception as e:
        logger.error(f"Fallback embedding failed for {image_path}: {e}")
        return np.zeros(settings.EMBEDDING_DIM, dtype=np.float32)


def index_image(image_id: int, image_path: str) -> bool:
    embedding = get_image_embedding(image_path)
    if embedding is None:
        return False
    faiss_manager.add_vector(image_id, embedding)
    return True


def search_similar(image_path: str, top_k: int = 10, threshold: float = 0.0) -> list[dict]:
    embedding = get_image_embedding(image_path)
    if embedding is None:
        return []
    results = faiss_manager.search(embedding, top_k=top_k, threshold=threshold)
    if len(results) == 0 and threshold > 0:
        results = faiss_manager.search(embedding, top_k=top_k, threshold=0.0)
    return results


def search_similar_by_id(image_id: int, image_path: str, top_k: int = 10, threshold: float = 0.0) -> list[dict]:
    embedding = get_image_embedding(image_path)
    if embedding is None:
        return []
    results = faiss_manager.search(embedding, top_k=top_k + 1, threshold=threshold)
    if len(results) == 0 and threshold > 0:
        results = faiss_manager.search(embedding, top_k=top_k + 1, threshold=0.0)
    return [r for r in results if r["image_id"] != image_id][:top_k]
