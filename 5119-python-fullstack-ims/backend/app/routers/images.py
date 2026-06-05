import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Image, ExifData
from app.schemas import ImageResponse, ImageListResponse
from app.services.exif_service import extract_exif, generate_thumbnail, get_image_info
from app.services.embedding_service import index_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["images"])


def _save_upload_file(upload_file: UploadFile, upload_dir: str) -> tuple[str, str]:
    upload_path = Path(upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)

    ext = Path(upload_file.filename).suffix.lower()
    if not ext:
        ext = ".jpg"

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_path / unique_name

    with open(file_path, "wb") as f:
        content = upload_file.file.read()
        f.write(content)

    return str(file_path), unique_name


@router.post("/upload", response_model=ImageResponse)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename).suffix.lstrip(".").lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '.{ext}' not allowed")

    file_path, filename = _save_upload_file(file, settings.UPLOAD_DIR)

    info = get_image_info(file_path)

    db_image = Image(
        filename=filename,
        original_name=file.filename,
        file_path=file_path,
        file_size=info["file_size"],
        width=info["width"],
        height=info["height"],
        format=info["format"],
        mode=info["mode"],
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)

    exif_data = extract_exif(file_path)
    if exif_data:
        db_exif = ExifData(image_id=db_image.id, **exif_data)
        db.add(db_exif)
        db.commit()

    thumb_path = generate_thumbnail(file_path, settings.THUMBNAIL_DIR)
    if thumb_path:
        db_image.thumbnail_path = thumb_path
        db.commit()
        db.refresh(db_image)

    try:
        success = index_image(db_image.id, file_path)
        if success:
            db_image.is_indexed = True
            db.commit()
    except Exception as e:
        logger.warning(f"Failed to index image {db_image.id}: {e}")

    return ImageResponse(**db_image.to_dict())


@router.post("/upload/batch", response_model=list[ImageResponse])
async def upload_images_batch(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    results = []
    for file in files:
        try:
            result = await upload_image(file=file, db=db)
            results.append(result)
        except HTTPException:
            continue
        except Exception as e:
            logger.error(f"Failed to upload {file.filename}: {e}")
            continue
    return results


@router.get("/", response_model=ImageListResponse)
def list_images(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tag_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Image)

    if tag_id:
        query = query.join(Image.tags).filter(Image.tags.any(id=tag_id))

    if search:
        query = query.filter(Image.original_name.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(Image.uploaded_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return ImageListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ImageResponse(**img.to_dict()) for img in items],
    )


@router.get("/{image_id}", response_model=ImageResponse)
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return ImageResponse(**image.to_dict())


@router.delete("/{image_id}")
def delete_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        Path(image.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    try:
        if image.thumbnail_path:
            Path(image.thumbnail_path).unlink(missing_ok=True)
    except Exception:
        pass

    from app.services.vector_service import faiss_manager
    faiss_manager.remove_vector(image_id)

    db.delete(image)
    db.commit()
    return {"message": "Image deleted", "id": image_id}


@router.get("/{image_id}/thumbnail")
def get_thumbnail(image_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    if not image.thumbnail_path or not Path(image.thumbnail_path).exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(image.thumbnail_path)


@router.get("/{image_id}/download")
def download_image(image_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    image = db.query(Image).filter(Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    if not Path(image.file_path).exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(image.file_path, filename=image.original_name)
