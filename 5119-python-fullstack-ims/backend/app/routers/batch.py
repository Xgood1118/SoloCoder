import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.database import get_db
from app.models import Image, BatchTask
from app.schemas import BatchProcessRequest, BatchTaskResponse
from app.services import batch_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/batch", tags=["batch"])

_active_tasks: dict[int, dict] = {}


@router.post("/process", response_model=BatchTaskResponse)
async def create_batch_task(
    request: BatchProcessRequest,
    db: Session = Depends(get_db),
):
    if request.operation not in batch_service.OPERATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown operation: {request.operation}. Available: {list(batch_service.OPERATIONS.keys())}"
        )

    images = db.query(Image).filter(Image.id.in_(request.image_ids)).all()
    if not images:
        raise HTTPException(status_code=404, detail="No images found")

    task = BatchTask(
        task_type=request.operation,
        status="running",
        total=len(images),
        params=request.params,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    _active_tasks[task.id] = {"completed": 0, "failed": 0, "status": "running"}

    asyncio.create_task(_execute_batch(task.id, images, request.operation, request.params))

    return BatchTaskResponse(**task.to_dict())


async def _execute_batch(task_id: int, images: list, operation: str, params: dict):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        task = db.query(BatchTask).filter(BatchTask.id == task_id).first()
        if not task:
            return

        operation_func = batch_service.OPERATIONS[operation]
        completed = 0
        failed = 0
        results = []

        for image in images:
            try:
                if operation in ("extract_exif",):
                    result = operation_func(image.file_path)
                    if result:
                        completed += 1
                        results.append({"image_id": image.id, "status": "success"})
                    else:
                        failed += 1
                        results.append({"image_id": image.id, "status": "failed"})
                elif operation == "regenerate_thumbnail":
                    thumb_path = operation_func(image.file_path, settings.THUMBNAIL_DIR)
                    if thumb_path:
                        image.thumbnail_path = thumb_path
                        completed += 1
                        results.append({"image_id": image.id, "status": "success"})
                    else:
                        failed += 1
                        results.append({"image_id": image.id, "status": "failed"})
                else:
                    output_dir = Path(params.get("output_dir", settings.UPLOAD_DIR + "/processed"))
                    output_dir.mkdir(parents=True, exist_ok=True)

                    ext = params.get("target_format", Path(image.file_path).suffix.lstrip("."))
                    if not ext.startswith("."):
                        ext = f".{ext}"
                    output_path = str(output_dir / f"{Path(image.file_path).stem}_{operation}{ext}")

                    op_params = {k: v for k, v in params.items() if k != "output_dir"}

                    success = operation_func(image.file_path, output_path, **op_params)
                    if success:
                        completed += 1
                        results.append({"image_id": image.id, "status": "success", "output_path": output_path})
                    else:
                        failed += 1
                        results.append({"image_id": image.id, "status": "failed"})

            except Exception as e:
                failed += 1
                results.append({"image_id": image.id, "status": "error", "error": str(e)})
                logger.error(f"Batch operation {operation} failed for image {image.id}: {e}")

            _active_tasks[task_id] = {
                "completed": completed,
                "failed": failed,
                "status": "running",
            }

            await asyncio.sleep(0)

        task.completed = completed
        task.failed = failed
        task.status = "completed"
        task.result = {"details": results}
        task.finished_at = datetime.utcnow()
        db.commit()

        _active_tasks[task_id] = {
            "completed": completed,
            "failed": failed,
            "status": "completed",
        }
    except Exception as e:
        logger.error(f"Batch task {task_id} failed: {e}")
        task = db.query(BatchTask).filter(BatchTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.result = {"error": str(e)}
            task.finished_at = datetime.utcnow()
            db.commit()
        _active_tasks[task_id] = {"completed": 0, "failed": 0, "status": "failed"}
    finally:
        db.close()


@router.get("/tasks/{task_id}/progress")
def get_task_progress(task_id: int):
    progress = _active_tasks.get(task_id, {"completed": 0, "failed": 0, "status": "unknown"})
    return progress


@router.get("/tasks/{task_id}/stream")
async def stream_task_progress(task_id: int):
    async def event_generator():
        while True:
            progress = _active_tasks.get(task_id, {"completed": 0, "failed": 0, "status": "unknown"})
            yield {
                "event": "progress",
                "data": str(progress),
            }
            if progress.get("status") in ("completed", "failed"):
                break
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@router.get("/tasks", response_model=list[BatchTaskResponse])
def list_batch_tasks(
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(BatchTask)
    if status:
        query = query.filter(BatchTask.status == status)
    tasks = query.order_by(BatchTask.created_at.desc()).limit(limit).all()
    return [BatchTaskResponse(**t.to_dict()) for t in tasks]


@router.get("/tasks/{task_id}", response_model=BatchTaskResponse)
def get_batch_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(BatchTask).filter(BatchTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return BatchTaskResponse(**task.to_dict())
