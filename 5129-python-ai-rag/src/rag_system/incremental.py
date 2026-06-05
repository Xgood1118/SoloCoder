import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ChunkDiff:
    chunk_id: str
    status: str  # 'added', 'removed', 'modified', 'unchanged'
    old_hash: Optional[str] = None
    new_hash: Optional[str] = None
    old_content: Optional[str] = None
    new_content: Optional[str] = None


@dataclass
class UpdateResult:
    document_id: str
    old_version: Optional[str]
    new_version: str
    chunks_added: int
    chunks_removed: int
    chunks_modified: int
    chunks_unchanged: int
    total_chunks: int
    diffs: List[ChunkDiff]


class IncrementalUpdater:
    def __init__(
        self,
        vector_store=None,
        version_manager=None,
        cache=None,
        config=None,
    ):
        self.config = config or get_config()
        self.vector_store = vector_store
        self.version_manager = version_manager
        self.cache = cache

    def _load_chunked_document(self, chunked_doc_path: Path):
        from .chunking import ChunkedDocument

        return ChunkedDocument.load_from_json(chunked_doc_path)

    def _get_existing_chunks(
        self,
        document_id: str,
        version: str = "latest",
    ) -> Dict[str, Dict[str, Any]]:
        if not self.vector_store:
            return {}

        docs = self.vector_store.list_documents()
        doc_info = next((d for d in docs if d["document_id"] == document_id), None)

        if not doc_info or version not in doc_info.get("versions", []):
            return {}

        existing_chunks = {}
        all_docs = self.vector_store.list_documents()

        if hasattr(self.vector_store.store, "collection"):
            collection = self.vector_store.store.collection
            backend = self.config.vector_store.backend

            if backend == "chroma":
                results = collection.get(where={"document_id": document_id, "version": version})
                for i, chunk_id in enumerate(results.get("ids", [])):
                    metadata = results["metadatas"][i]
                    existing_chunks[metadata.get("chunk_id", chunk_id)] = {
                        "content": results["documents"][i],
                        "content_hash": metadata.get("content_hash", ""),
                        "metadata": metadata,
                    }
            elif backend == "milvus":
                from pymilvus import Collection

                expr = f'document_id == "{document_id}" && version == "{version}"'
                results = collection.query(
                    expr=expr,
                    output_fields=["chunk_id", "content", "content_hash", "metadata_json"],
                )
                for r in results:
                    try:
                        metadata = json.loads(r.get("metadata_json", "{}"))
                    except json.JSONDecodeError:
                        metadata = {}
                    existing_chunks[r["chunk_id"]] = {
                        "content": r["content"],
                        "content_hash": r["content_hash"],
                        "metadata": metadata,
                    }

        return existing_chunks

    def compare_chunks(
        self,
        old_chunks: Dict[str, Dict[str, Any]],
        new_chunked_doc,
    ) -> List[ChunkDiff]:
        diffs = []

        new_chunk_hashes = {}
        for chunk in new_chunked_doc.chunks:
            new_chunk_hashes[chunk.chunk_id] = {
                "hash": chunk.content_hash,
                "content": chunk.content,
            }

        old_chunk_ids = set(old_chunks.keys())
        new_chunk_ids = set(new_chunk_hashes.keys())

        for chunk_id in new_chunk_ids - old_chunk_ids:
            diffs.append(
                ChunkDiff(
                    chunk_id=chunk_id,
                    status="added",
                    new_hash=new_chunk_hashes[chunk_id]["hash"],
                    new_content=new_chunk_hashes[chunk_id]["content"],
                )
            )

        for chunk_id in old_chunk_ids - new_chunk_ids:
            diffs.append(
                ChunkDiff(
                    chunk_id=chunk_id,
                    status="removed",
                    old_hash=old_chunks[chunk_id]["content_hash"],
                    old_content=old_chunks[chunk_id]["content"],
                )
            )

        for chunk_id in old_chunk_ids & new_chunk_ids:
            old_hash = old_chunks[chunk_id]["content_hash"]
            new_hash = new_chunk_hashes[chunk_id]["hash"]

            if old_hash == new_hash:
                diffs.append(
                    ChunkDiff(
                        chunk_id=chunk_id,
                        status="unchanged",
                        old_hash=old_hash,
                        new_hash=new_hash,
                        old_content=old_chunks[chunk_id]["content"],
                        new_content=new_chunk_hashes[chunk_id]["content"],
                    )
                )
            else:
                diffs.append(
                    ChunkDiff(
                        chunk_id=chunk_id,
                        status="modified",
                        old_hash=old_hash,
                        new_hash=new_hash,
                        old_content=old_chunks[chunk_id]["content"],
                        new_content=new_chunk_hashes[chunk_id]["content"],
                    )
                )

        return diffs

    def update_document(
        self,
        chunked_doc_path: str,
        embedded_doc_path: str,
        description: str = "",
    ) -> UpdateResult:
        chunked_doc_path = Path(chunked_doc_path)
        embedded_doc_path = Path(embedded_doc_path)

        if not chunked_doc_path.exists():
            raise FileNotFoundError(f"Chunked document not found: {chunked_doc_path}")
        if not embedded_doc_path.exists():
            raise FileNotFoundError(f"Embedded document not found: {embedded_doc_path}")

        from .chunking import ChunkedDocument
        from .embedding import EmbeddedDocument

        chunked_doc = ChunkedDocument.load_from_json(chunked_doc_path)
        embedded_doc = EmbeddedDocument.load_from_json(embedded_doc_path)

        document_id = chunked_doc.document_id
        file_name = chunked_doc.file_name
        file_size = Path(chunked_doc.file_path).stat().st_size if Path(chunked_doc.file_path).exists() else 0
        content_hash = ""

        for chunk in chunked_doc.chunks:
            content_hash += chunk.content_hash
        content_hash = content_hash[:64]

        old_version = None
        if self.version_manager and self.version_manager.has_document(document_id):
            old_version_obj = self.version_manager.get_latest_version(document_id)
            old_version = old_version_obj.version_tag if old_version_obj else None

            old_hash = self.version_manager.get_content_hash(document_id)
            if old_hash == content_hash:
                logger.info(
                    f"Content unchanged for {document_id}, skipping update"
                )
                return UpdateResult(
                    document_id=document_id,
                    old_version=old_version,
                    new_version=old_version or "latest",
                    chunks_added=0,
                    chunks_removed=0,
                    chunks_modified=0,
                    chunks_unchanged=len(chunked_doc.chunks),
                    total_chunks=len(chunked_doc.chunks),
                    diffs=[],
                )

        old_chunks = self._get_existing_chunks(document_id)
        diffs = self.compare_chunks(old_chunks, chunked_doc)

        new_version_tag = "latest"
        if self.version_manager:
            source_files = [chunked_doc_path, embedded_doc_path]
            if chunked_doc.file_path and Path(chunked_doc.file_path).exists():
                source_files.append(Path(chunked_doc.file_path))

            version = self.version_manager.create_version(
                document_id=document_id,
                content_hash=content_hash,
                file_name=file_name,
                file_size=file_size,
                description=description,
                source_files=source_files,
            )
            new_version_tag = version.version_tag

            for chunk in embedded_doc.chunks:
                chunk.version = new_version_tag

        if self.vector_store:
            self.vector_store.load_embeddings_from_file(str(embedded_doc_path))

        if self.cache:
            self.cache.update_document_hash(document_id, content_hash)

        counts = {
            "added": 0,
            "removed": 0,
            "modified": 0,
            "unchanged": 0,
        }
        for diff in diffs:
            counts[diff.status] += 1

        result = UpdateResult(
            document_id=document_id,
            old_version=old_version,
            new_version=new_version_tag,
            chunks_added=counts["added"],
            chunks_removed=counts["removed"],
            chunks_modified=counts["modified"],
            chunks_unchanged=counts["unchanged"],
            total_chunks=len(chunked_doc.chunks),
            diffs=diffs,
        )

        logger.info(
            f"Incremental update complete for {document_id}: "
            f"+{counts['added']} -{counts['removed']} ~{counts['modified']} "
            f"={counts['unchanged']} (version: {old_version} -> {new_version_tag})"
        )

        return result

    def update_directory(
        self,
        chunks_dir: str,
        embeddings_dir: str,
    ) -> List[UpdateResult]:
        chunks_dir = Path(chunks_dir)
        embeddings_dir = Path(embeddings_dir)

        if not chunks_dir.exists():
            raise FileNotFoundError(f"Chunks directory not found: {chunks_dir}")
        if not embeddings_dir.exists():
            raise FileNotFoundError(f"Embeddings directory not found: {embeddings_dir}")

        results = []
        for chunk_file in sorted(chunks_dir.glob("*_chunks.json")):
            doc_id = chunk_file.stem.replace("_chunks", "")
            embedding_file = embeddings_dir / f"{doc_id}_embeddings.json"

            if not embedding_file.exists():
                logger.warning(f"Skipping {doc_id}: embedding file not found")
                continue

            try:
                result = self.update_document(
                    str(chunk_file),
                    str(embedding_file),
                )
                results.append(result)
            except Exception as e:
                logger.warning(f"Failed to update {doc_id}: {e}")

        logger.info(f"Incremental update complete for {len(results)} documents")
        return results

    def get_update_summary(self, result: UpdateResult) -> Dict[str, Any]:
        return {
            "document_id": result.document_id,
            "old_version": result.old_version,
            "new_version": result.new_version,
            "chunks_added": result.chunks_added,
            "chunks_removed": result.chunks_removed,
            "chunks_modified": result.chunks_modified,
            "chunks_unchanged": result.chunks_unchanged,
            "total_chunks": result.total_chunks,
            "has_changes": (
                result.chunks_added > 0
                or result.chunks_removed > 0
                or result.chunks_modified > 0
            ),
            "diffs": [
                {
                    "chunk_id": d.chunk_id,
                    "status": d.status,
                    "old_hash": d.old_hash,
                    "new_hash": d.new_hash,
                }
                for d in result.diffs
            ],
        }


from .config import get_config
