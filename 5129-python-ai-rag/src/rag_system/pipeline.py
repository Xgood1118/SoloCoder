import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import traceback

logger = logging.getLogger(__name__)


class PipelineStep(str, Enum):
    PARSE = "parse"
    CHUNK = "chunk"
    EMBED = "embed"
    STORE = "store"
    INCREMENTAL = "incremental"
    ALL = "all"


@dataclass
class StepResult:
    step: str
    success: bool
    input_file: str
    output_file: Optional[str]
    error_message: Optional[str] = None
    details: Dict[str, Any] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}


@dataclass
class PipelineResult:
    input_path: str
    steps: List[str]
    results: List[StepResult]
    success: bool
    total_duration: float

    def get_failed_steps(self) -> List[StepResult]:
        return [r for r in self.results if not r.success]

    def get_successful_steps(self) -> List[StepResult]:
        return [r for r in self.results if r.success]


class RAGPipeline:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.paths = self.config.paths

        self.parser = None
        self.chunker = None
        self.embedder = None
        self.vector_store = None
        self.reranker = None
        self.cache = None
        self.version_manager = None
        self.incremental_updater = None

    def _get_parser(self):
        if self.parser is None:
            from .document_parser import DocumentParser
            self.parser = DocumentParser(self.config)
        return self.parser

    def _get_chunker(self):
        if self.chunker is None:
            from .chunking import TextChunker
            self.chunker = TextChunker(self.config)
        return self.chunker

    def _get_embedder(self):
        if self.embedder is None:
            from .embedding import EmbeddingGenerator
            self.embedder = EmbeddingGenerator(self.config)
        return self.embedder

    def _get_vector_store(self):
        if self.vector_store is None:
            from .vector_store import VectorStore
            self.vector_store = VectorStore(self.config)
        return self.vector_store

    def _get_reranker(self):
        if self.reranker is None:
            from .reranker import Reranker
            self.reranker = Reranker(self.config)
        return self.reranker

    def _get_cache(self):
        if self.cache is None:
            from .cache import QueryCache
            self.cache = QueryCache(self.config)
        return self.cache

    def _get_version_manager(self):
        if self.version_manager is None:
            from .versioning import VersionManager
            self.version_manager = VersionManager(self.config)
        return self.version_manager

    def _get_incremental_updater(self):
        if self.incremental_updater is None:
            from .incremental import IncrementalUpdater
            self.incremental_updater = IncrementalUpdater(
                vector_store=self._get_vector_store(),
                version_manager=self._get_version_manager(),
                cache=self._get_cache(),
                config=self.config,
            )
        return self.incremental_updater

    def _resolve_input_files(self, input_path: str) -> List[Path]:
        path = Path(input_path)
        if not path.exists():
            raise FileNotFoundError(f"Input path not found: {input_path}")

        if path.is_file():
            return [path]

        from .document_parser import SUPPORTED_EXTENSIONS
        files = []
        for ext in SUPPORTED_EXTENSIONS:
            files.extend(sorted(path.glob(f"*{ext}")))

        if not files:
            logger.warning(f"No supported files found in {input_path}")

        return files

    def _get_parsed_file(self, doc_id: str) -> Path:
        return self.paths.parsed_dir / f"{doc_id}.json"

    def _get_chunks_file(self, doc_id: str) -> Path:
        return self.paths.chunks_dir / f"{doc_id}_chunks.json"

    def _get_embeddings_file(self, doc_id: str) -> Path:
        return self.paths.embeddings_dir / f"{doc_id}_embeddings.json"

    def run_step(
        self,
        step: PipelineStep,
        input_file: str,
    ) -> StepResult:
        import time

        input_path = Path(input_file)
        step_name = step.value

        logger.info(f"Running step: {step_name} on: {input_file}")
        start_time = time.time()

        try:
            if step == PipelineStep.PARSE:
                return self._run_parse_step(input_path, start_time)
            elif step == PipelineStep.CHUNK:
                return self._run_chunk_step(input_path, start_time)
            elif step == PipelineStep.EMBED:
                return self._run_embed_step(input_path, start_time)
            elif step == PipelineStep.STORE:
                return self._run_store_step(input_path, start_time)
            elif step == PipelineStep.INCREMENTAL:
                return self._run_incremental_step(input_path, start_time)
            else:
                raise ValueError(f"Unknown step: {step}")

        except Exception as e:
            duration = time.time() - start_time
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            logger.error(f"Step {step_name} failed on {input_file}: {error_msg}")
            return StepResult(
                step=step_name,
                success=False,
                input_file=str(input_path),
                output_file=None,
                error_message=str(e),
                details={"duration": duration, "traceback": traceback.format_exc()},
            )

    def _run_parse_step(self, input_path: Path, start_time: float) -> StepResult:
        import time

        parser = self._get_parser()
        parsed_doc = parser.parse(str(input_path))

        output_file = self._get_parsed_file(parsed_doc.document_id)
        duration = time.time() - start_time

        logger.info(
            f"Parse step completed for {input_path.name}: "
            f"{len(parsed_doc.elements)} elements, {len(parsed_doc.full_text)} chars"
        )

        return StepResult(
            step=PipelineStep.PARSE.value,
            success=True,
            input_file=str(input_path),
            output_file=str(output_file),
            details={
                "duration": duration,
                "document_id": parsed_doc.document_id,
                "element_count": len(parsed_doc.elements),
                "total_pages": parsed_doc.total_pages,
                "file_size": parsed_doc.file_size,
            },
        )

    def _run_chunk_step(self, input_path: Path, start_time: float) -> StepResult:
        import time

        if input_path.suffix != ".json":
            raise ValueError(
                f"Chunk step requires a parsed JSON file, got: {input_path.suffix}"
            )

        chunker = self._get_chunker()
        chunked_doc = chunker.chunk_document(str(input_path))

        output_file = self._get_chunks_file(chunked_doc.document_id)
        duration = time.time() - start_time

        logger.info(
            f"Chunk step completed for {input_path.name}: "
            f"{chunked_doc.total_chunks} chunks"
        )

        return StepResult(
            step=PipelineStep.CHUNK.value,
            success=True,
            input_file=str(input_path),
            output_file=str(output_file),
            details={
                "duration": duration,
                "document_id": chunked_doc.document_id,
                "total_chunks": chunked_doc.total_chunks,
                "chunk_size": self.config.chunking.chunk_size,
            },
        )

    def _run_embed_step(self, input_path: Path, start_time: float) -> StepResult:
        import time

        if not input_path.name.endswith("_chunks.json"):
            raise ValueError(
                f"Embed step requires a chunks JSON file (*_chunks.json), got: {input_path.name}"
            )

        embedder = self._get_embedder()
        embedded_doc = embedder.generate_embeddings(str(input_path))

        output_file = self._get_embeddings_file(embedded_doc.document_id)
        duration = time.time() - start_time

        logger.info(
            f"Embed step completed for {input_path.name}: "
            f"{embedded_doc.total_chunks} chunks, dimension {embedded_doc.embedding_dimension}"
        )

        return StepResult(
            step=PipelineStep.EMBED.value,
            success=True,
            input_file=str(input_path),
            output_file=str(output_file),
            details={
                "duration": duration,
                "document_id": embedded_doc.document_id,
                "total_chunks": embedded_doc.total_chunks,
                "embedding_dimension": embedded_doc.embedding_dimension,
                "model_name": embedded_doc.model_name,
            },
        )

    def _run_store_step(self, input_path: Path, start_time: float) -> StepResult:
        import time

        if not input_path.name.endswith("_embeddings.json"):
            raise ValueError(
                f"Store step requires an embeddings JSON file (*_embeddings.json), got: {input_path.name}"
            )

        vector_store = self._get_vector_store()
        count = vector_store.load_embeddings_from_file(str(input_path))

        doc_id = input_path.stem.replace("_embeddings", "")
        duration = time.time() - start_time

        logger.info(f"Store step completed: {count} embeddings stored")

        return StepResult(
            step=PipelineStep.STORE.value,
            success=True,
            input_file=str(input_path),
            output_file=None,
            details={
                "duration": duration,
                "document_id": doc_id,
                "embeddings_stored": count,
            },
        )

    def _run_incremental_step(self, input_path: Path, start_time: float) -> StepResult:
        import time

        if not input_path.name.endswith("_chunks.json"):
            raise ValueError(
                f"Incremental step requires a chunks JSON file (*_chunks.json), got: {input_path.name}"
            )

        doc_id = input_path.stem.replace("_chunks", "")
        embeddings_file = self._get_embeddings_file(doc_id)

        if not embeddings_file.exists():
            raise FileNotFoundError(
                f"Embeddings file not found: {embeddings_file}. "
                f"Run embed step first."
            )

        updater = self._get_incremental_updater()
        update_result = updater.update_document(
            str(input_path),
            str(embeddings_file),
        )

        duration = time.time() - start_time
        summary = updater.get_update_summary(update_result)

        logger.info(
            f"Incremental step completed: {summary['chunks_added']} added, "
            f"{summary['chunks_removed']} removed, "
            f"{summary['chunks_modified']} modified"
        )

        return StepResult(
            step=PipelineStep.INCREMENTAL.value,
            success=True,
            input_file=str(input_path),
            output_file=None,
            details={
                "duration": duration,
                "document_id": doc_id,
                "update_summary": summary,
            },
        )

    def run_pipeline(
        self,
        input_path: str,
        steps: Optional[List[PipelineStep]] = None,
    ) -> PipelineResult:
        import time

        if steps is None:
            steps = [
                PipelineStep.PARSE,
                PipelineStep.CHUNK,
                PipelineStep.EMBED,
                PipelineStep.INCREMENTAL,
            ]

        if PipelineStep.ALL in steps:
            steps = [
                PipelineStep.PARSE,
                PipelineStep.CHUNK,
                PipelineStep.EMBED,
                PipelineStep.INCREMENTAL,
            ]

        logger.info(
            f"Starting pipeline on {input_path} with steps: {[s.value for s in steps]}"
        )

        start_time = time.time()
        all_results: List[StepResult] = []

        input_files = self._resolve_input_files(input_path)
        if not input_files:
            raise RuntimeError(f"No input files found at: {input_path}")

        for file_path in input_files:
            current_input = str(file_path)
            file_results: List[StepResult] = []

            for step in steps:
                try:
                    result = self.run_step(step, current_input)
                    file_results.append(result)

                    if not result.success:
                        logger.error(
                            f"Pipeline stopped for {file_path.name} at step {step.value}: "
                            f"{result.error_message}"
                        )
                        break

                    if result.output_file:
                        current_input = result.output_file

                except Exception as e:
                    logger.error(
                        f"Pipeline failed for {file_path.name} at step {step.value}: {e}",
                        exc_info=True,
                    )
                    break

            all_results.extend(file_results)

        success = all(
            any(r.step == s.value and r.success for r in all_results) for s in steps
        ) or (all_results and all(r.success for r in all_results))

        total_duration = time.time() - start_time

        logger.info(
            f"Pipeline completed in {total_duration:.2f}s: "
            f"{sum(1 for r in all_results if r.success)} successful, "
            f"{sum(1 for r in all_results if not r.success)} failed"
        )

        return PipelineResult(
            input_path=input_path,
            steps=[s.value for s in steps],
            results=all_results,
            success=success,
            total_duration=total_duration,
        )

    def search(
        self,
        query: str,
        top_k: int = 50,
        top_n: int = 5,
        use_cache: bool = True,
        filter_version: Optional[str] = "latest",
        filter_document_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        cache = self._get_cache()

        if use_cache:
            cached_results = cache.get(query)
            if cached_results is not None:
                logger.info(f"Returning cached results for query: {query[:50]}...")
                return cached_results

        embedder = self._get_embedder()
        vector_store = self._get_vector_store()
        reranker = self._get_reranker()

        query_embedding = embedder.embed_query(query)

        initial_results = vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            filter_version=filter_version,
            filter_document_ids=filter_document_ids,
        )

        if reranker.is_enabled() and initial_results:
            final_results = reranker.rerank(query, initial_results, top_n=top_n)
            result_dicts = [r.to_dict() for r in final_results]
        else:
            result_dicts = [r.to_dict() for r in initial_results[:top_n]]

        if use_cache:
            cache.set(query, result_dicts)

        return result_dicts

    def list_documents(self) -> List[Dict[str, Any]]:
        vector_store = self._get_vector_store()
        return vector_store.list_documents()

    def get_document_versions(self, document_id: str) -> List[str]:
        vector_store = self._get_vector_store()
        return vector_store.get_document_versions(document_id)

    def delete_document(self, document_id: str, version: Optional[str] = None) -> int:
        vector_store = self._get_vector_store()
        count = vector_store.delete_by_document_id(document_id, version)

        cache = self._get_cache()
        cache.invalidate_by_document(document_id)

        if version is None:
            version_manager = self._get_version_manager()
            version_manager.delete_all_versions(document_id)

        return count

    def get_version_history(self, document_id: str) -> List[Dict[str, Any]]:
        version_manager = self._get_version_manager()
        versions = version_manager.get_versions(document_id)
        return [v.to_dict() for v in versions]

    def compare_versions(
        self,
        document_id: str,
        version1: str,
        version2: str,
    ) -> Dict[str, Any]:
        version_manager = self._get_version_manager()
        return version_manager.compare_versions(document_id, version1, version2)

    def get_cache_stats(self) -> Dict[str, Any]:
        cache = self._get_cache()
        return cache.get_stats()

    def clear_cache(self) -> int:
        cache = self._get_cache()
        return cache.invalidate_all()


from .config import get_config
