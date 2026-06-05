import json
import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingChunk:
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    embedding: List[float]
    token_count: int
    element_type: str
    page_number: Optional[int]
    metadata: Dict[str, Any]
    content_hash: str
    version: str = "latest"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EmbeddedDocument:
    document_id: str
    file_name: str
    total_chunks: int
    embedding_dimension: int
    model_name: str
    chunks: List[EmbeddingChunk]
    embedded_at: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "file_name": self.file_name,
            "total_chunks": self.total_chunks,
            "embedding_dimension": self.embedding_dimension,
            "model_name": self.model_name,
            "chunks": [chunk.to_dict() for chunk in self.chunks],
            "embedded_at": self.embedded_at,
        }

    def save_to_json(self, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
        logger.info(f"Embedded document saved to: {output_path}")

    def save_to_npz(self, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        embeddings = np.array([chunk.embedding for chunk in self.chunks], dtype=np.float32)
        chunk_ids = [chunk.chunk_id for chunk in self.chunks]

        metadata = {
            "document_id": self.document_id,
            "file_name": self.file_name,
            "total_chunks": self.total_chunks,
            "embedding_dimension": self.embedding_dimension,
            "model_name": self.model_name,
            "embedded_at": self.embedded_at,
            "chunk_ids": json.dumps(chunk_ids, ensure_ascii=False),
        }

        np.savez(output_path, embeddings=embeddings, **metadata)
        logger.info(f"Embeddings saved to npz: {output_path}")

    @classmethod
    def load_from_json(cls, input_path: Path) -> "EmbeddedDocument":
        if not input_path.exists():
            raise FileNotFoundError(f"Embedded document file not found: {input_path}")

        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        chunks = [EmbeddingChunk(**chunk_data) for chunk_data in data.get("chunks", [])]
        data["chunks"] = chunks
        return cls(**data)

    @classmethod
    def load_from_npz(cls, npz_path: Path, json_path: Optional[Path] = None) -> "EmbeddedDocument":
        if not npz_path.exists():
            raise FileNotFoundError(f"Embedding npz file not found: {npz_path}")

        if json_path is None:
            json_path = npz_path.with_suffix(".json")

        if not json_path.exists():
            raise FileNotFoundError(
                f"Embedded document json not found: {json_path}. "
                f"Both .npz and .json files are required."
            )

        embedded_doc = cls.load_from_json(json_path)

        with np.load(npz_path) as data:
            embeddings = data["embeddings"]
            if len(embeddings) != len(embedded_doc.chunks):
                raise ValueError(
                    f"Embedding count mismatch: npz has {len(embeddings)}, "
                    f"json has {len(embedded_doc.chunks)}"
                )
            for i, chunk in enumerate(embedded_doc.chunks):
                chunk.embedding = embeddings[i].tolist()

        return embedded_doc


class BaseEmbeddingProvider:
    def __init__(self, config):
        self.config = config
        self.dimension = config.dimension

    def embed(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

    def embed_query(self, text: str) -> List[float]:
        return self.embed([text])[0]


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, config):
        super().__init__(config)
        self.model_name = config.model_name
        self.api_key = config.api_key
        self.base_url = config.base_url
        self.batch_size = config.batch_size
        self.max_retries = config.max_retries

        if not self.api_key:
            raise ValueError(
                "OpenAI API key is required. Set OPENAI_API_KEY environment variable "
                "or provide it in the config."
            )

        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "OpenAI embeddings require openai package. "
                "Install with: pip install openai"
            )

        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url

        self.client = OpenAI(**client_kwargs)

    def embed(self, texts: List[str]) -> List[List[float]]:
        all_embeddings = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]

            for attempt in range(self.max_retries):
                try:
                    response = self.client.embeddings.create(
                        model=self.model_name,
                        input=batch,
                    )
                    batch_embeddings = [item.embedding for item in response.data]
                    all_embeddings.extend(batch_embeddings)
                    break
                except Exception as e:
                    if attempt == self.max_retries - 1:
                        raise RuntimeError(
                            f"Failed to get embeddings after {self.max_retries} attempts: {e}"
                        )
                    wait_time = 2**attempt
                    logger.warning(
                        f"Embedding attempt {attempt + 1} failed, retrying in {wait_time}s: {e}"
                    )
                    time.sleep(wait_time)

        return all_embeddings


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, config):
        super().__init__(config)
        self.model_name = config.model_name
        self.model_path = config.local_model_path
        self.batch_size = config.batch_size
        self.device = "cpu"

        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "Local embeddings require sentence-transformers. "
                "Install with: pip install sentence-transformers"
            )

        model_name_or_path = self.model_path or self.model_name
        logger.info(f"Loading local embedding model: {model_name_or_path}")
        self.model = SentenceTransformer(model_name_or_path, device=self.device)
        self.dimension = self.model.get_sentence_embedding_dimension()

    def embed(self, texts: List[str]) -> List[List[float]]:
        try:
            embeddings = self.model.encode(
                texts,
                batch_size=self.batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Failed to generate local embeddings: {e}")
            raise


class EmbeddingGenerator:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.embedding_config = self.config.embedding
        self.output_dir = self.config.paths.embeddings_dir
        self.provider = self._create_provider()

    def _create_provider(self) -> BaseEmbeddingProvider:
        provider_type = self.embedding_config.provider.lower()

        if provider_type == "openai":
            return OpenAIEmbeddingProvider(self.embedding_config)
        elif provider_type == "local":
            return LocalEmbeddingProvider(self.embedding_config)
        else:
            raise ValueError(f"Unsupported embedding provider: {provider_type}")

    def generate_embeddings(
        self,
        chunked_doc_path: str,
        use_version: str = "latest",
    ) -> EmbeddedDocument:
        from .chunking import ChunkedDocument

        path = Path(chunked_doc_path)
        if not path.exists():
            raise FileNotFoundError(f"Chunked document file not found: {chunked_doc_path}")

        logger.info(f"Starting to generate embeddings for: {chunked_doc_path}")

        try:
            chunked_doc = ChunkedDocument.load_from_json(path)

            texts = [chunk.content for chunk in chunked_doc.chunks]
            logger.info(f"Generating embeddings for {len(texts)} chunks...")

            embeddings = self.provider.embed(texts)

            embedding_chunks = []
            for i, chunk in enumerate(chunked_doc.chunks):
                embedding_chunks.append(
                    EmbeddingChunk(
                        chunk_id=chunk.chunk_id,
                        document_id=chunk.document_id,
                        document_name=chunk.document_name,
                        content=chunk.content,
                        embedding=embeddings[i],
                        token_count=chunk.token_count,
                        element_type=chunk.element_type,
                        page_number=chunk.page_number,
                        metadata=chunk.metadata,
                        content_hash=chunk.content_hash,
                        version=use_version,
                    )
                )

            embedded_doc = EmbeddedDocument(
                document_id=chunked_doc.document_id,
                file_name=chunked_doc.file_name,
                total_chunks=len(embedding_chunks),
                embedding_dimension=len(embeddings[0]) if embeddings else 0,
                model_name=self.embedding_config.model_name,
                chunks=embedding_chunks,
                embedded_at=datetime.utcnow().isoformat() + "Z",
            )

            output_json = self.output_dir / f"{chunked_doc.document_id}_embeddings.json"
            output_npz = self.output_dir / f"{chunked_doc.document_id}_embeddings.npz"

            embedded_doc.save_to_json(output_json)
            embedded_doc.save_to_npz(output_npz)

            logger.info(
                f"Successfully generated embeddings for {chunked_doc.file_name}: "
                f"{len(embedding_chunks)} chunks, dimension {embedded_doc.embedding_dimension}"
            )
            return embedded_doc

        except Exception as e:
            logger.error(
                f"Failed to generate embeddings for {chunked_doc_path}: {str(e)}",
                exc_info=True,
            )
            raise RuntimeError(
                f"Embedding generation failed for {chunked_doc_path}: {str(e)}"
            ) from e

    def generate_embeddings_for_directory(self, dir_path: str) -> List[EmbeddedDocument]:
        path = Path(dir_path)
        if not path.exists():
            raise FileNotFoundError(f"Directory not found: {dir_path}")

        embedded_docs = []
        for file_path in sorted(path.glob("*_chunks.json")):
            try:
                embedded_doc = self.generate_embeddings(str(file_path))
                embedded_docs.append(embedded_doc)
            except Exception as e:
                logger.warning(f"Skipping {file_path}: {str(e)}")

        logger.info(f"Generated embeddings for {len(embedded_docs)} documents from {dir_path}")
        return embedded_docs

    def embed_query(self, text: str) -> List[float]:
        return self.provider.embed_query(text)


from .config import get_config
