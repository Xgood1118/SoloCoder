import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Image
from app.schemas import SimilarSearchResponse, SimilarSearchRequest
from app.services.embedding_service import search_similar, search_similar_by_id, index_image
from app.services.vector_service import faiss_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])


def _ensure_all_indexed(db: Session):
    all_images = db.query(Image).all()
    indexed_ids = set(faiss_manager.id_map)

    for img in all_images:
        if not Path(img.file_path).exists():
            continue
        if not img.is_indexed or img.id not in indexed_ids:
            try:
                success = index_image(img.id, img.file_path)
                if success:
                    img.is_indexed = True
                    db.commit()
            except Exception as e:
                logger.warning(f"Auto-index failed for image {img.id}: {e}")


@router.post("/similar", response_model=SimilarSearchResponse)
def search_similar_images(
    request: SimilarSearchRequest,
    db: Session = Depends(get_db),
):
    _ensure_all_indexed(db)
    if request.image_id:
        image = db.query(Image).filter(Image.id == request.image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        if not Path(image.file_path).exists():
            raise HTTPException(status_code=404, detail="Image file not found on disk")

        results = search_similar_by_id(
            image.id, image.file_path,
            top_k=request.top_k,
            threshold=request.threshold,
        )
        return SimilarSearchResponse(query_image_id=request.image_id, results=results)

    raise HTTPException(status_code=400, detail="image_id is required")


@router.post("/similar/upload", response_model=SimilarSearchResponse)
async def search_similar_by_upload(
    file: UploadFile = File(...),
    top_k: int = Query(10, ge=1, le=100),
    threshold: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    _ensure_all_indexed(db)
    ext = Path(file.filename).suffix.lstrip(".").lower()
    if ext not in {"jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"}:
        raise HTTPException(status_code=400, detail="Invalid image format")

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        results = search_similar(tmp_path, top_k=top_k, threshold=threshold)
        return SimilarSearchResponse(query_image_id=None, results=results)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.get("/similar/{image_id}", response_model=SimilarSearchResponse)
def search_similar_get(
    image_id: int,
    top_k: int = Query(10, ge=1, le=100),
    threshold: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    _ensure_all_indexed(db)
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    if not Path(image.file_path).exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    results = search_similar_by_id(image.id, image.file_path, top_k=top_k, threshold=threshold)
    return SimilarSearchResponse(query_image_id=image_id, results=results)
