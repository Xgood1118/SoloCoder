import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    score: float
    rank: int
    version: str
    metadata: Dict[str, Any]
    page_number: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "document_name": self.document_name,
            "content": self.content,
            "score": self.score,
            "rank": self.rank,
            "version": self.version,
            "metadata": self.metadata,
            "page_number": self.page_number,
        }


class BaseVectorStore(ABC):
    @abstractmethod
    def add_embeddings(self, embedded_doc) -> int:
        pass

    @abstractmethod
    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter_version: Optional[str] = "latest",
        filter_document_ids: Optional[List[str]] = None,
    ) -> List[SearchResult]:
        pass

    @abstractmethod
    def delete_by_document_id(self, document_id: str, version: Optional[str] = None) -> int:
        pass

    @abstractmethod
    def get_document_versions(self, document_id: str) -> List[str]:
        pass

    @abstractmethod
    def list_documents(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def persist(self) -> None:
        pass


class ChromaVectorStore(BaseVectorStore):
    def __init__(self, config):
        self.config = config
        self.collection_name = config.collection_name
        self.persist_directory = str(config.persist_directory)
        self.dimension = config.dimension if hasattr(config, "dimension") else 1536

        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError:
            raise ImportError(
                "Chroma vector store requires chromadb. "
                "Install with: pip install chromadb"
            )

        Path(self.persist_directory).mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(anonymized_telemetry=False),
        )

        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        logger.info(f"Chroma store initialized at: {self.persist_directory}")

    def add_embeddings(self, embedded_doc) -> int:
        from .embedding import EmbeddedDocument

        if not isinstance(embedded_doc, EmbeddedDocument):
            raise TypeError("embedded_doc must be an EmbeddedDocument instance")

        ids = []
        embeddings = []
        documents = []
        metadatas = []

        for chunk in embedded_doc.chunks:
            chunk_id = f"{chunk.chunk_id}_{chunk.version}"
            ids.append(chunk_id)

            embeddings.append(chunk.embedding)
            documents.append(chunk.content)

            metadata = {
                "chunk_id": chunk.chunk_id,
                "document_id": chunk.document_id,
                "document_name": chunk.document_name,
                "version": chunk.version,
                "token_count": chunk.token_count,
                "element_type": chunk.element_type,
                "content_hash": chunk.content_hash,
                **chunk.metadata,
            }
            if chunk.page_number is not None:
                metadata["page_number"] = chunk.page_number

            metadatas.append(metadata)

        if ids:
            self.collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
            )
            logger.info(
                f"Added/updated {len(ids)} embeddings for document "
                f"{embedded_doc.document_id} ({embedded_doc.file_name})"
            )

        return len(ids)

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter_version: Optional[str] = "latest",
        filter_document_ids: Optional[List[str]] = None,
    ) -> List[SearchResult]:
        where_clause = {}

        if filter_version:
            where_clause["version"] = filter_version

        if filter_document_ids:
            if len(filter_document_ids) == 1:
                where_clause["document_id"] = filter_document_ids[0]
            else:
                where_clause["$or"] = [
                    {"document_id": doc_id} for doc_id in filter_document_ids
                ]

        if not where_clause:
            where_clause = None

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_clause,
        )

        search_results = []

        if results.get("ids") and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                metadata = results["metadatas"][0][i]
                score = 1.0 - results["distances"][0][i] if results["distances"] else 0.0

                search_results.append(
                    SearchResult(
                        chunk_id=metadata.get("chunk_id", results["ids"][0][i]),
                        document_id=metadata.get("document_id", ""),
                        document_name=metadata.get("document_name", ""),
                        content=results["documents"][0][i],
                        score=score,
                        rank=i + 1,
                        version=metadata.get("version", "latest"),
                        metadata={
                            k: v
                            for k, v in metadata.items()
                            if k
                            not in [
                                "chunk_id",
                                "document_id",
                                "document_name",
                                "version",
                            ]
                        },
                        page_number=metadata.get("page_number"),
                    )
                )

        return search_results

    def delete_by_document_id(self, document_id: str, version: Optional[str] = None) -> int:
        where_clause = {"document_id": document_id}
        if version:
            where_clause["version"] = version

        results = self.collection.get(where=where_clause)
        ids_to_delete = results.get("ids", [])

        if ids_to_delete:
            self.collection.delete(ids=ids_to_delete)
            logger.info(
                f"Deleted {len(ids_to_delete)} chunks for document {document_id}"
                + (f" version {version}" if version else "")
            )

        return len(ids_to_delete)

    def get_document_versions(self, document_id: str) -> List[str]:
        results = self.collection.get(where={"document_id": document_id})
        versions = set()
        for metadata in results.get("metadatas", []):
            if metadata and "version" in metadata:
                versions.add(metadata["version"])

        return sorted(versions)

    def list_documents(self) -> List[Dict[str, Any]]:
        results = self.collection.get()
        doc_info = {}

        for metadata in results.get("metadatas", []):
            if not metadata:
                continue
            doc_id = metadata.get("document_id")
            if not doc_id:
                continue

            if doc_id not in doc_info:
                doc_info[doc_id] = {
                    "document_id": doc_id,
                    "document_name": metadata.get("document_name", ""),
                    "versions": set(),
                    "chunk_count": 0,
                }

            doc_info[doc_id]["versions"].add(metadata.get("version", "unknown"))
            doc_info[doc_id]["chunk_count"] += 1

        for doc_id in doc_info:
            doc_info[doc_id]["versions"] = sorted(doc_info[doc_id]["versions"])

        return list(doc_info.values())

    def persist(self) -> None:
        import chromadb
        if isinstance(self.client, chromadb.PersistentClient):
            logger.info("Chroma persist completed (automatic for PersistentClient)")


class MilvusVectorStore(BaseVectorStore):
    def __init__(self, config):
        self.config = config
        self.collection_name = config.collection_name
        self.host = config.host
        self.port = config.port
        self.dimension = config.dimension if hasattr(config, "dimension") else 1536
        self.metric_type = config.metric_type
        self.index_type = config.index_type

        try:
            from pymilvus import (
                connections,
                utility,
                Collection,
                CollectionSchema,
                FieldSchema,
                DataType,
            )
        except ImportError:
            raise ImportError(
                "Milvus vector store requires pymilvus. "
                "Install with: pip install pymilvus"
            )

        connections.connect(
            alias="default",
            host=self.host,
            port=self.port,
        )

        self._create_collection_if_not_exists()
        self.collection = Collection(self.collection_name)
        self._create_index_if_not_exists()
        self.collection.load()

        logger.info(
            f"Milvus store initialized at {self.host}:{self.port}, "
            f"collection: {self.collection_name}"
        )

    def _create_collection_if_not_exists(self):
        from pymilvus import utility, Collection, CollectionSchema, FieldSchema, DataType

        if utility.has_collection(self.collection_name):
            return

        fields = [
            FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=512, is_primary=True),
            FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="document_id", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="document_name", dtype=DataType.VARCHAR, max_length=512),
            FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dimension),
            FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=65535),
            FieldSchema(name="version", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="token_count", dtype=DataType.INT64),
            FieldSchema(name="element_type", dtype=DataType.VARCHAR, max_length=64),
            FieldSchema(name="content_hash", dtype=DataType.VARCHAR, max_length=128),
            FieldSchema(name="page_number", dtype=DataType.INT64),
            FieldSchema(name="metadata_json", dtype=DataType.VARCHAR, max_length=65535),
        ]

        schema = CollectionSchema(fields, description=f"RAG document collection: {self.collection_name}")
        Collection(self.collection_name, schema)
        logger.info(f"Created Milvus collection: {self.collection_name}")

    def _create_index_if_not_exists(self):
        from pymilvus import Collection

        collection = Collection(self.collection_name)
        if collection.has_index():
            return

        index_params = {
            "index_type": self.index_type,
            "metric_type": self.metric_type,
            "params": {"M": 8, "efConstruction": 64},
        }

        collection.create_index(field_name="embedding", index_params=index_params)
        logger.info(f"Created index for collection: {self.collection_name}")

    def add_embeddings(self, embedded_doc) -> int:
        from .embedding import EmbeddedDocument
        from pymilvus import Collection

        if not isinstance(embedded_doc, EmbeddedDocument):
            raise TypeError("embedded_doc must be an EmbeddedDocument instance")

        ids = []
        chunk_ids = []
        document_ids = []
        document_names = []
        embeddings = []
        contents = []
        versions = []
        token_counts = []
        element_types = []
        content_hashes = []
        page_numbers = []
        metadata_jsons = []

        for chunk in embedded_doc.chunks:
            entry_id = f"{chunk.chunk_id}_{chunk.version}"
            ids.append(entry_id)
            chunk_ids.append(chunk.chunk_id)
            document_ids.append(chunk.document_id)
            document_names.append(chunk.document_name)
            embeddings.append(chunk.embedding)
            contents.append(chunk.content)
            versions.append(chunk.version)
            token_counts.append(chunk.token_count)
            element_types.append(chunk.element_type)
            content_hashes.append(chunk.content_hash)
            page_numbers.append(chunk.page_number if chunk.page_number else -1)
            metadata_jsons.append(json.dumps(chunk.metadata, ensure_ascii=False))

        if ids:
            data = [
                ids,
                chunk_ids,
                document_ids,
                document_names,
                embeddings,
                contents,
                versions,
                token_counts,
                element_types,
                content_hashes,
                page_numbers,
                metadata_jsons,
            ]
            self.collection.upsert(data)
            logger.info(
                f"Added/updated {len(ids)} embeddings for document "
                f"{embedded_doc.document_id} ({embedded_doc.file_name})"
            )

        return len(ids)

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter_version: Optional[str] = "latest",
        filter_document_ids: Optional[List[str]] = None,
    ) -> List[SearchResult]:
        from pymilvus import Collection

        expr_parts = []
        if filter_version:
            expr_parts.append(f'version == "{filter_version}"')

        if filter_document_ids:
            if len(filter_document_ids) == 1:
                expr_parts.append(f'document_id == "{filter_document_ids[0]}"')
            else:
                doc_ids_str = ", ".join(f'"{d}"' for d in filter_document_ids)
                expr_parts.append(f"document_id in [{doc_ids_str}]")

        expr = " && ".join(expr_parts) if expr_parts else None

        search_params = {
            "metric_type": self.metric_type,
            "params": {"ef": 64},
        }

        output_fields = [
            "chunk_id",
            "document_id",
            "document_name",
            "content",
            "version",
            "token_count",
            "element_type",
            "content_hash",
            "page_number",
            "metadata_json",
        ]

        results = self.collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param=search_params,
            limit=top_k,
            expr=expr,
            output_fields=output_fields,
        )

        search_results = []
        for i, hit in enumerate(results[0]):
            entity = hit.entity
            metadata = {}
            try:
                metadata = json.loads(entity.get("metadata_json", "{}"))
            except json.JSONDecodeError:
                pass

            page_number = entity.get("page_number", -1)
            if page_number == -1:
                page_number = None

            search_results.append(
                SearchResult(
                    chunk_id=entity.get("chunk_id", ""),
                    document_id=entity.get("document_id", ""),
                    document_name=entity.get("document_name", ""),
                    content=entity.get("content", ""),
                    score=hit.score,
                    rank=i + 1,
                    version=entity.get("version", "latest"),
                    metadata=metadata,
                    page_number=page_number,
                )
            )

        return search_results

    def delete_by_document_id(self, document_id: str, version: Optional[str] = None) -> int:
        expr = f'document_id == "{document_id}"'
        if version:
            expr += f' && version == "{version}"'

        results = self.collection.query(expr=expr, output_fields=["id"])
        ids_to_delete = [r["id"] for r in results]

        if ids_to_delete:
            self.collection.delete(expr=f'id in [{", ".join(f'"{i}"' for i in ids_to_delete)}]')
            logger.info(
                f"Deleted {len(ids_to_delete)} chunks for document {document_id}"
                + (f" version {version}" if version else "")
            )

        return len(ids_to_delete)

    def get_document_versions(self, document_id: str) -> List[str]:
        expr = f'document_id == "{document_id}"'
        results = self.collection.query(expr=expr, output_fields=["version"])
        versions = set(r["version"] for r in results)
        return sorted(versions)

    def list_documents(self) -> List[Dict[str, Any]]:
        results = self.collection.query(
            expr="id != ''",
            output_fields=["document_id", "document_name", "version"],
        )

        doc_info = {}
        for r in results:
            doc_id = r["document_id"]
            if doc_id not in doc_info:
                doc_info[doc_id] = {
                    "document_id": doc_id,
                    "document_name": r["document_name"],
                    "versions": set(),
                    "chunk_count": 0,
                }
            doc_info[doc_id]["versions"].add(r["version"])
            doc_info[doc_id]["chunk_count"] += 1

        for doc_id in doc_info:
            doc_info[doc_id]["versions"] = sorted(doc_info[doc_id]["versions"])

        return list(doc_info.values())

    def persist(self) -> None:
        self.collection.flush()
        logger.info("Milvus persist completed")


class VectorStore:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.vector_config = self.config.vector_store
        self.store: BaseVectorStore = self._create_store()

    def _create_store(self) -> BaseVectorStore:
        backend = self.vector_config.backend.lower()

        if backend == "chroma":
            return ChromaVectorStore(self.vector_config)
        elif backend == "milvus":
            return MilvusVectorStore(self.vector_config)
        else:
            raise ValueError(f"Unsupported vector store backend: {backend}")

    def load_embeddings_from_file(self, embedding_file_path: str) -> int:
        from .embedding import EmbeddedDocument

        path = Path(embedding_file_path)
        if not path.exists():
            raise FileNotFoundError(f"Embedding file not found: {embedding_file_path}")

        logger.info(f"Loading embeddings from: {embedding_file_path}")

        try:
            if path.suffix == ".json":
                embedded_doc = EmbeddedDocument.load_from_json(path)
            elif path.suffix == ".npz":
                embedded_doc = EmbeddedDocument.load_from_npz(path)
            else:
                raise ValueError(f"Unsupported file type: {path.suffix}")

            count = self.store.add_embeddings(embedded_doc)
            self.store.persist()
            logger.info(f"Loaded {count} embeddings into vector store")
            return count

        except Exception as e:
            logger.error(
                f"Failed to load embeddings from {embedding_file_path}: {str(e)}",
                exc_info=True,
            )
            raise RuntimeError(
                f"Loading embeddings failed for {embedding_file_path}: {str(e)}"
            ) from e

    def load_embeddings_from_directory(self, dir_path: str) -> int:
        path = Path(dir_path)
        if not path.exists():
            raise FileNotFoundError(f"Directory not found: {dir_path}")

        total_count = 0
        for file_path in sorted(path.glob("*_embeddings.json")):
            try:
                count = self.load_embeddings_from_file(str(file_path))
                total_count += count
            except Exception as e:
                logger.warning(f"Skipping {file_path}: {str(e)}")

        logger.info(f"Loaded total {total_count} embeddings from {dir_path}")
        return total_count

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter_version: Optional[str] = "latest",
        filter_document_ids: Optional[List[str]] = None,
    ) -> List[SearchResult]:
        return self.store.search(
            query_embedding, top_k, filter_version, filter_document_ids
        )

    def delete_by_document_id(self, document_id: str, version: Optional[str] = None) -> int:
        return self.store.delete_by_document_id(document_id, version)

    def get_document_versions(self, document_id: str) -> List[str]:
        return self.store.get_document_versions(document_id)

    def list_documents(self) -> List[Dict[str, Any]]:
        return self.store.list_documents()

    def persist(self) -> None:
        self.store.persist()


from .config import get_config
