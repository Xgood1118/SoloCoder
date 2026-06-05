import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Image
from app.schemas import ScriptExecuteRequest, ScriptExecuteResponse
from app.services.script_service import execute_filter_script

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/execute", response_model=ScriptExecuteResponse)
def execute_script(
    request: ScriptExecuteRequest,
    db: Session = Depends(get_db),
):
    if request.image_ids:
        images = db.query(Image).filter(Image.id.in_(request.image_ids)).all()
    else:
        limit = Query(1000)
        images = db.query(Image).limit(1000).all()

    if not images:
        raise HTTPException(status_code=404, detail="No images found")

    images_data = [img.to_dict() for img in images]

    result = execute_filter_script(request.script, images_data)

    return ScriptExecuteResponse(
        success=result["success"],
        matched_ids=result["matched_ids"],
        error=result["error"],
        log=result["log"],
    )


@router.post("/execute/dry-run", response_model=ScriptExecuteResponse)
def dry_run_script(
    request: ScriptExecuteRequest,
    db: Session = Depends(get_db),
):
    sample_images = db.query(Image).limit(10).all()
    if not sample_images:
        raise HTTPException(status_code=404, detail="No images in database for dry run")

    images_data = [img.to_dict() for img in sample_images]

    result = execute_filter_script(request.script, images_data)

    return ScriptExecuteResponse(
        success=result["success"],
        matched_ids=result["matched_ids"],
        error=result["error"],
        log=result["log"],
    )
