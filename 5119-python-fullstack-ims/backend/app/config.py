from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "Image Management System"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./ims.db"

    UPLOAD_DIR: str = str(Path("./data/uploads"))
    THUMBNAIL_DIR: str = str(Path("./data/thumbnails"))
    ALLOWED_EXTENSIONS: set = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"}
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    FAISS_INDEX_PATH: str = str(Path("./data/faiss/index.faiss"))
    FAISS_META_PATH: str = str(Path("./data/faiss/meta.json"))
    FAISS_INDEX_TYPE: str = "flat"
    FAISS_NLIST: int = 100
    FAISS_M_HNSW: int = 32
    FAISS_EF_CONSTRUCTION: int = 200
    FAISS_EF_SEARCH: int = 50
    FAISS_NPROBE: int = 10
    FAISS_AUTO_SWITCH_THRESHOLD: int = 100000

    CLIP_MODEL_NAME: str = "clip-ViT-B-32"
    EMBEDDING_DIM: int = 512

    BATCH_TASK_DIR: str = str(Path("./data/batch_tasks"))

    SCRIPT_SANDBOX_TIMEOUT: int = 10
    SCRIPT_SANDBOX_MAX_MEMORY: int = 256 * 1024 * 1024

    CORS_ORIGINS: list = ["http://localhost:5119", "http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
