import os
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
import yaml
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"


@dataclass
class PathConfig:
    input_dir: Path = DATA_DIR / "input"
    parsed_dir: Path = DATA_DIR / "processed" / "parsed"
    chunks_dir: Path = DATA_DIR / "processed" / "chunks"
    embeddings_dir: Path = DATA_DIR / "processed" / "embeddings"
    vector_store_dir: Path = DATA_DIR / "vector_store"
    cache_dir: Path = DATA_DIR / "cache"
    versions_dir: Path = DATA_DIR / "versions"

    def __post_init__(self):
        for path in [
            self.input_dir,
            self.parsed_dir,
            self.chunks_dir,
            self.embeddings_dir,
            self.vector_store_dir,
            self.cache_dir,
            self.versions_dir,
        ]:
            path.mkdir(parents=True, exist_ok=True)


@dataclass
class ChunkingConfig:
    chunk_size: int = 512
    chunk_overlap: int = 50
    separators: list = field(
        default_factory=lambda: ["\n\n", "\n", ".", "!", "?", ";", "，", "。", "！", "？", " "]
    )
    respect_sentence_boundary: bool = True
    min_chunk_size: int = 100


@dataclass
class EmbeddingConfig:
    provider: str = "openai"
    model_name: str = "text-embedding-ada-002"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    batch_size: int = 32
    max_retries: int = 3
    local_model_path: Optional[str] = None
    dimension: int = 1536

    def __post_init__(self):
        if self.provider == "openai":
            self.api_key = self.api_key or os.getenv("OPENAI_API_KEY")
            self.base_url = self.base_url or os.getenv("OPENAI_BASE_URL")
        elif self.provider == "local":
            self.dimension = int(os.getenv("LOCAL_EMBED_DIM", "768"))


@dataclass
class VectorStoreConfig:
    backend: str = "chroma"
    collection_name: str = "rag_documents"
    persist_directory: Optional[Path] = None
    host: str = "localhost"
    port: int = 19530
    metric_type: str = "COSINE"
    index_type: str = "HNSW"

    def __post_init__(self):
        if self.backend == "chroma" and self.persist_directory is None:
            self.persist_directory = DATA_DIR / "vector_store" / "chroma"


@dataclass
class RerankerConfig:
    enabled: bool = True
    model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    top_k: int = 50
    top_n: int = 5
    device: str = "cpu"
    max_length: int = 512


@dataclass
class CacheConfig:
    enabled: bool = True
    ttl_seconds: int = 3600
    max_entries: int = 1000
    backend: str = "disk"
    invalidate_on_update: bool = True


@dataclass
class VersioningConfig:
    enabled: bool = True
    max_versions: int = 10
    default_retrieve_latest: bool = True
    hash_algorithm: str = "sha256"


@dataclass
class Config:
    paths: PathConfig = field(default_factory=PathConfig)
    chunking: ChunkingConfig = field(default_factory=ChunkingConfig)
    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig)
    vector_store: VectorStoreConfig = field(default_factory=VectorStoreConfig)
    reranker: RerankerConfig = field(default_factory=RerankerConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    versioning: VersioningConfig = field(default_factory=VersioningConfig)
    log_level: str = "INFO"

    @classmethod
    def from_yaml(cls, yaml_path: str) -> "Config":
        yaml_file = Path(yaml_path)
        if not yaml_file.exists():
            raise FileNotFoundError(f"Config file not found: {yaml_path}")

        with open(yaml_file, "r", encoding="utf-8") as f:
            config_data = yaml.safe_load(f)

        return cls._from_dict(config_data)

    @classmethod
    def _from_dict(cls, data: Dict[str, Any]) -> "Config":
        paths = PathConfig(**(data.get("paths", {}) or {}))
        chunking = ChunkingConfig(**(data.get("chunking", {}) or {}))
        embedding = EmbeddingConfig(**(data.get("embedding", {}) or {}))
        vector_store = VectorStoreConfig(**(data.get("vector_store", {}) or {}))
        reranker = RerankerConfig(**(data.get("reranker", {}) or {}))
        cache = CacheConfig(**(data.get("cache", {}) or {}))
        versioning = VersioningConfig(**(data.get("versioning", {}) or {}))

        return cls(
            paths=paths,
            chunking=chunking,
            embedding=embedding,
            vector_store=vector_store,
            reranker=reranker,
            cache=cache,
            versioning=versioning,
            log_level=data.get("log_level", "INFO"),
        )


_default_config: Optional[Config] = None


def get_config() -> Config:
    global _default_config
    if _default_config is None:
        _default_config = Config()
    return _default_config


def set_config(config: Config) -> None:
    global _default_config
    _default_config = config
