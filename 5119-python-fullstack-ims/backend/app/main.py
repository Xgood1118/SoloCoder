import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.routers import images, tags, search, batch, scripts

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.THUMBNAIL_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.FAISS_INDEX_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.BATCH_TASK_DIR).mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)

    logger.info("IMS backend started")
    yield
    logger.info("IMS backend shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(images.router)
app.include_router(tags.router)
app.include_router(search.router)
app.include_router(batch.router)
app.include_router(scripts.router)

try:
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
except Exception:
    pass
try:
    app.mount("/thumbnails", StaticFiles(directory=settings.THUMBNAIL_DIR), name="thumbnails")
except Exception:
    pass


@app.get("/api/health")
def health_check():
    from app.services.vector_service import faiss_manager
    return {
        "status": "ok",
        "faiss_available": faiss_manager.total_vectors,
        "version": "1.0.0",
    }
